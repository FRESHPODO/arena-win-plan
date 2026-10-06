#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {read}=require('./rofl_reader.cjs'),{analyze}=require('./arena_augments.cjs');
const {buildProfile,validate}=require('./build_profile.cjs');
const schema=require('./data/anvils-16.19.json');
const {recordNotifications}=require('./anvil_stat_lookup.cjs');
function decode(data){
 const wire=data.subarray(schema.stringOffset);
 if(![...wire].every(b=>schema.byteMap[b]!==undefined))return null;
 const name=Buffer.from([...wire].map(b=>schema.byteMap[b])).reverse().toString();
 return schema.spellNames.includes(name)?name:null;
}
function extract(file,{player,profile:explicit}={}){
 if(player===undefined)throw Error('--player INDEX|RIOT_ID|PUUID is required');
 const profileFile=explicit;
 let analysis;
 if(profileFile&&fs.existsSync(profileFile)){analysis=analyze(file,JSON.parse(fs.readFileSync(profileFile)));validate(analysis);}
 else if(explicit)throw Error('Profile file not found');
 else analysis=buildProfile(file).result;
 const p=analysis.players.find(p=>String(p.index)===String(player)||p.riotId===player||p.puuid===player);
 if(!p)throw Error('Player not found');
 const counts=new Map();
 for(const e of analysis.events.filter(e=>e.playerIndex===p.index)){
  const b=e.evidence.adjacentObjectCandidate;
  if(b?.opcode===0xae&&b.param>=0x40000000&&b.param<0x40010000)counts.set(b.param,(counts.get(b.param)||0)+1);
 }
 const owners=[...counts].sort((a,b)=>b[1]-a[1]);
 if(!owners.length||owners[0][1]<2||owners[0][1]===owners[1]?.[1])throw Error('Player object mapping is ambiguous');
 const netId=owners[0][0];
 const r=read(file,{streams:[1],retainBlock:b=>b.op===schema.opcode&&b.param>=0x40000000&&b.param<0x40010000&&(b.param&255)===(netId&255)});
 if(r.version!==schema.version||r.protocolDigestRaw!==schema.protocolDigestRaw)throw Error('Unsupported anvil protocol; see arena_rofl_support/update/ANVILS.md');
 const at=new Map(),unresolved=[];
 for(const b of r.blocks){
  const name=decode(b.data);
  const evidence={opcode:'0x'+b.op.toString(16),paramRaw:'0x'+b.param.toString(16),gameBlockIndex:b.gameBlockIndex,chunk:b.chunk,blockOffset:b.blockOffset,payload:b.data.toString('hex')};
  if(!name){const partial=Buffer.from([...b.data.subarray(schema.stringOffset)].map(x=>schema.byteMap[x]??63)).reverse().toString();if(partial.includes('StatAnvil'))unresolved.push({time:b.t,partial,evidence});continue;}
  if(!at.has(b.t))at.set(b.t,[]);at.get(b.t).push({spellName:name,evidence});
 }
 const label=name=>schema.labels[name.replace(/^Augment_/,'').toLowerCase()]??name;
 const events=[...at].sort((a,b)=>a[0]-b[0]).map(([time,ns])=>({time,round:analysis.rounds.filter(r=>r.preparationStart<=time).at(-1)?.round??null,selectedSpell:ns[0].spellName,selectedShard:label(ns[0].spellName),additionalNotifications:[...new Set(ns.slice(1).filter(n=>n.spellName!==ns[0].spellName).map(n=>n.spellName))],purchaseConfirmed:false,statGains:null,evidence:ns.map(n=>n.evidence)}));
 for(const event of events)event.statReference=recordNotifications(at.get(event.time));
 const metadata=JSON.parse(r.metadata.statsJson)[p.index];
 return {file,version:r.version,replaySha256:r.replaySha256,player:{index:p.index,riotId:p.riotId,puuid:p.puuid,champion:p.champion,objectId:'0x'+netId.toString(16),ownerCorrelationCounts:owners},method:'First reversed substituted ASCII anvil spell notification per tick; includes free grants and subsequent automatic rewards, not a paid transaction ledger.',summary:{selectionNotificationTimes:events.length,spellNotifications:[...at.values()].reduce((n,a)=>n+a.length,0),unresolvedAnvilLike:unresolved.length,metadataItemsPurchased:metadata.ITEMS_PURCHASED,metadataConsumablesPurchased:metadata.CONSUMABLES_PURCHASED},events,unresolved};
}
function run(args){
 const value=flag=>{const i=args.indexOf(flag);if(i<0)return undefined;const v=args[i+1];if(!v||v.startsWith('--'))throw Error('Missing '+flag);args.splice(i,2);return v;};
 const output=value('--output'),csv=value('--csv'),player=value('--player'),profile=value('--profile'),file=args.shift();
 if(!file||args.length)throw Error('Usage: node parse_anvils.cjs FILE.rofl --player INDEX|RIOT_ID|PUUID [--profile PROFILE] [--output JSON] [--csv CSV]');
 const result=extract(file,{player,profile});
 if(csv){const rows=[['round','seconds','selected_shard','spell_name','additional_notifications','purchase_confirmed','tier','record_mode','base_stats','granted_shards']];for(const e of result.events)rows.push([e.round,e.time,e.selectedShard,e.selectedSpell,e.additionalNotifications.join(';'),false,e.statReference.tier,e.statReference.recordMode,JSON.stringify(e.statReference.baseStats??e.statReference.baseStatsByRange??null),JSON.stringify(e.statReference.grantedShards)]);fs.writeFileSync(csv,'\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');}
 const json=JSON.stringify(result,null,2)+'\n';if(output)fs.writeFileSync(output,json);else process.stdout.write(json);
}
module.exports={decode,extract,run};
if(require.main===module)try{run(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
