#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {read}=require('./rofl_reader.cjs'),{extractFromReplay}=require('./arena_rounds.cjs');
const CONFIRMED_REPLAY_SHA='844ed6ac050f481fe36a78db693ed511f0f1db5507e0055fd03e98f8839d9d19';
function decodePayload(data,profile){
 if(data.length<2)throw Error('Truncated augment-state payload');
 const player=profile.players.find(p=>p.wireKey===data[1]);
 if(!player)throw Error('Unknown player key');
 if(data[0]===0x6f){if(data.length!==2)throw Error('Unexpected empty-state tail');return {playerIndex:player.index,records:[]};}
 if(data[0]!==0x6e||data.length<3)throw Error('Unsupported state header');
 const count=profile.countCodes[data[2].toString(16).padStart(2,'0')];
 if(count===undefined)throw Error('Unknown record-count code');
 const records=[];let offset=3;
 for(let slot=0;slot<count;slot++){
  if(offset>=data.length)throw Error('Truncated record');
  const start=offset,stateCode=data[offset++].toString(16).padStart(2,'0'),state=profile.stateCodes[stateCode];
  if(!state)throw Error('Unknown state code');
  const matches=profile.records.filter(x=>data.subarray(offset,offset+x.wire.length/2).toString('hex')===x.wire);
  if(matches.length!==1)throw Error(`Unknown or ambiguous name hash at offset ${offset}`);
  const item=matches[0];offset+=item.wire.length/2;
  let extra=null;
  if(state.extra){if(offset>=data.length||data[offset++]!==0xbd)throw Error('Unknown extended state');extra='bd';}
  records.push({slot,id:item.id,apiName:item.apiName,name:item.name,nameKo:item.nameKo,category:item.category,
   nameHash:item.hash,wireHash:item.wire,stateCode,extraStateRaw:extra,levelCandidate:state.levelCandidate,
   levelStatus:'inferred, not client/UI confirmed',rawRecord:data.subarray(start,offset).toString('hex')});
 }
 if(offset!==data.length)throw Error('Unconsumed state payload');
 return {playerIndex:player.index,records};
}
function stable(records){return JSON.stringify(records.map(x=>[x.id,x.levelCandidate]));}
function transitions(before,after){
 const changes=[];
 // Align the ordered list, preserving duplicate augments and slot shifts on removal.
 const dp=Array.from({length:before.length+1},()=>Array(after.length+1).fill(0));
 for(let i=before.length-1;i>=0;i--)for(let j=after.length-1;j>=0;j--)dp[i][j]=before[i].id===after[j].id?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
 let i=0,j=0;
 while(i<before.length||j<after.length){
  if(i<before.length&&j<after.length&&before[i].id===after[j].id){
   if(before[i].rawRecord!==after[j].rawRecord)changes.push({kind:'record_state_changed',id:after[j].id,apiName:after[j].apiName,
    oldSlot:i,newSlot:j,before:before[i],after:after[j],levelChangedCandidate:before[i].levelCandidate!==after[j].levelCandidate});i++;j++;
  }else if(j>=after.length||(i<before.length&&dp[i+1][j]>=dp[i][j+1]))changes.push({kind:'removed',record:before[i++]});
  else changes.push({kind:'added',record:after[j++]});
 }
 return changes;
}
function findTransmutations(events){
 const results=[];
 for(let i=0;i<events.length;i++){
  const marker=events[i],selected=marker.changes.filter(x=>x.kind==='added'&&/^Transmute(Gold|Silver|Prismatic)$/.test(x.record.apiName));
  for(const change of selected){
   // Link actual additions in the same tick, before the selection marker.
   // A settlement rewrite that only removes a previous augment is not a new grant.
   const candidates=[];
   for(let j=i-1;j>=0&&events[j].time===marker.time;j--){
    const e=events[j];if(e.playerIndex!==marker.playerIndex)continue;
    for(const c of e.changes)if(c.kind==='added'&&c.record.category==='augment'&&!/^Transmute(Gold|Silver|Prismatic)$/.test(c.record.apiName)){
     const retained=marker.records.some(r=>r.id===c.record.id&&r.wireHash===c.record.wireHash);
     if(retained)candidates.push({record:c.record,evidence:e.evidence});
    }
   }
   const unique=[...new Map(candidates.map(x=>[x.record.wireHash,x])).values()];
   results.push({playerIndex:marker.playerIndex,time:marker.time,round:marker.round,markerId:change.record.id,markerApiName:change.record.apiName,
    status:unique.length===1?'candidate; same-player same-tick result added before marker':'unresolved; no unique new result grant',
    result:unique.length===1?unique[0].record:null,resultCandidates:unique,
    removedInMarkerEvent:marker.changes.filter(x=>x.kind==='removed').map(x=>x.record),
    markerEvidence:marker.evidence});
  }
 }
 return results;
}
function analyze(file,profile,options={}){
 if(!profile)return require('./build_profile.cjs').buildProfile(file).result;
 const r=options.replay||read(file,{streams:[1,2],augmentOpcode:profile.opcode});
 const digest=r.replaySha256||crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 if(digest!==profile.replaySha256)throw Error('Candidate profile is restricted to its exact replay SHA-256');
 if(r.version!==profile.version||r.protocolDigestRaw!==profile.protocolDigestRaw)throw Error('Replay/profile version or protocol mismatch');
 const metadata=JSON.parse(r.metadata.statsJson),game=r.blocks.filter(b=>b.stream===1),frames=r.blocks.filter(b=>b.stream===2);
 const phase=extractFromReplay(r,file),rounds=phase.rounds.map(x=>({...x,phaseStatus:'structural-inference'}));
 const eventRound=t=>{const x=rounds.filter(x=>x.preparationStart<=t).at(-1);return x?.round??null;};
 const initial=frames.filter(b=>b.op===profile.opcode&&b.t===0);
 const events=[],last=new Map();
 for(const b of initial){const x=decodePayload(b.data,profile);last.set(x.playerIndex,x.records);}
 if(last.size!==metadata.length)throw Error('Initial state missing players');
 for(const [blockIndex,b]of game.entries())if(b.op===profile.opcode){
  const x=decodePayload(b.data,profile),prior=last.get(x.playerIndex),changes=transitions(prior,x.records);
  const previous=b.gameBlockIndex!==undefined?b.adjacentObjectCandidate:game[blockIndex-1];
  events.push({playerIndex:x.playerIndex,time:b.t,round:eventRound(b.t),records:x.records,changes,
   evidence:{stream:b.stream,chunk:b.chunk,chunkFileOffset:b.chunkOffset,blockOffset:b.blockOffset,
    payloadOffset:b.payloadOffset,opcode:b.op,param:b.param,payload:b.data.toString('hex'),gameBlockIndex:b.gameBlockIndex??blockIndex,
    adjacentObjectCandidate:previous?.t===b.t&&[0xae,0x47c,0x2b6].includes(previous.op)?{opcode:previous.op,param:previous.param,payload:previous.data.toString('hex')}:null}});
  last.set(x.playerIndex,x.records);
 }
 const frameChecks=[];
 for(const b of frames)if(b.op===profile.opcode){
  const x=decodePayload(b.data,profile),prior=events.filter(e=>e.playerIndex===x.playerIndex&&e.time<=b.t+0.001).at(-1);
  const expected=prior?.records??[];
  frameChecks.push({playerIndex:x.playerIndex,time:b.t,chunk:b.chunk,blockOffset:b.blockOffset,
   sameIds:JSON.stringify(x.records.map(x=>x.id))===JSON.stringify(expected.map(x=>x.id)),
   sameLevelCandidates:stable(x.records)===stable(expected),records:x.records});
 }
 const players=metadata.map((m,index)=>{
  const recordedIds=Array.from({length:6},(_,i)=>Number(m['PLAYER_AUGMENT_'+(i+1)])).filter(n=>n!==0);
  const finalRecords=last.get(index),finalIds=finalRecords.filter(x=>x.category==='augment').map(x=>x.id);
  return {index,riotId:[m.RIOT_ID_GAME_NAME,m.RIOT_ID_TAG_LINE].filter(Boolean).join('#'),puuid:m.PUUID,
   champion:m.SKIN,subteam:Number(m.PLAYER_SUBTEAM),placement:Number(m.PLAYER_SUBTEAM_PLACEMENT),
   wireKey:profile.players[index].wireKey,objectIdCandidate:path.basename(file)==='KR-8404138481.rofl'?'0x'+(0x4000002d+index).toString(16):null,
   objectMappingStatus:'initial keyframe order + adjacent object correlation + final ID comparison; no client decoder confirmation',
   metadataAugmentIds:recordedIds,finalAugmentIds:finalIds,finalIdsMatch:JSON.stringify(recordedIds)===JSON.stringify(finalIds),
   finalRecords};
 });
 const snapshots=[];
 for(const round of rounds)for(const player of players){
  const state=events.filter(e=>e.playerIndex===player.index&&e.time<=round.combatStart).at(-1);
  snapshots.push({playerIndex:player.index,round:round.round,time:round.combatStart,records:state?.records??[],
   lastGameUpdateTime:state?.time??0,lastUpdateRound:state?.round??null,
   participationStatus:'unknown; state retained after elimination',evidence:state?.evidence??profile.players[player.index].initialEvidence});
 }
 const transmutationCandidates=findTransmutations(events);
 for(const x of transmutationCandidates)if(digest===CONFIRMED_REPLAY_SHA&&x.playerIndex===13&&x.round===3&&x.result?.id===1373){
  x.status='user-confirmed in replay; inferred packet linkage';
  x.validation={method:'user replay observation',date:'2026-10-05',confirmedRelation:'TransmuteGold (237) -> ShrinkEngine (1373)',
   scope:'Ivern, round 3, this exact replay; does not confirm unrelated transformations or numeric levels'};
 }
 return {schemaVersion:1,file:path.basename(file),version:r.version,protocolDigestRaw:r.protocolDigestRaw,replaySha256:digest,
  status:'candidate; hash/catalog/metadata correlated, not client decoder or UI confirmed',
  limitations:[...phase.warnings,'Profile is restricted to one replay.','Round times are phase-event candidates.','Numeric levels are inferred; extended state semantics remain unresolved.',
   'Helper records are retained in records and excluded from final metadata comparison using catalog rarity=4.','Snapshots retain last state after elimination; participation is not decoded.',
   'Initial keyframe order is correlated with metadata, not validated using CreateHero decoding.'],
  validation:{gameStatePackets:events.length,keyframeStatePackets:frameChecks.length,
   keyframeIdMatches:frameChecks.filter(x=>x.sameIds).length,keyframeLevelCandidateMatches:frameChecks.filter(x=>x.sameLevelCandidates).length,
  finalPlayersMatched:players.filter(x=>x.finalIdsMatch).length,totalPlayers:players.length},players,rounds,events,keyframeChecks:frameChecks,snapshots,
  transmutationCandidates};
}
module.exports={decodePayload,transitions,findTransmutations,analyze};
if(require.main===module){
 try{
  const args=process.argv.slice(2);const value=flag=>{const i=args.indexOf(flag);if(i<0)return undefined;const v=args[i+1];if(v===undefined||v.startsWith('--'))throw Error('Missing value for '+flag);args.splice(i,2);return v;};
  const output=value('--output'),player=value('--player'),round=value('--round'),result=analyze(args.shift()||'KR-8404138481.rofl');
  if(args.length)throw Error('Unknown arguments: '+args.join(' '));
  let selected=result;
  if(player!==undefined||round!==undefined){
   const ps=player===undefined?result.players:result.players.filter(x=>String(x.index)===player||x.puuid===player||x.riotId===player);
   if(!ps.length)throw Error('Player not found; use zero-based index, exact Riot ID, or PUUID');
   if(round!==undefined&&(!Number.isInteger(Number(round))||!result.rounds.some(x=>x.round===Number(round))))throw Error('Round not found');
   selected={file:result.file,version:result.version,status:result.status,limitations:result.limitations,validation:result.validation,
    players:ps,snapshots:result.snapshots.filter(s=>ps.some(p=>p.index===s.playerIndex)&&(round===undefined||s.round===Number(round))),
    transmutationCandidates:result.transmutationCandidates.filter(s=>ps.some(p=>p.index===s.playerIndex)&&(round===undefined||s.round===Number(round)))};
  }
  const json=JSON.stringify(selected,null,2)+'\n';if(output)fs.writeFileSync(output,json);else process.stdout.write(json);
 }catch(e){console.error(e.message);process.exitCode=1;}
}
