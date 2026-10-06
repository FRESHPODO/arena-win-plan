#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {analyze}=require('./arena_augments.cjs'),{buildProfile,validate}=require('./build_profile.cjs');
function run(args){
 const value=flag=>{const i=args.indexOf(flag);if(i<0)return undefined;const v=args[i+1];if(!v||v.startsWith('--'))throw Error('Missing value for '+flag);args.splice(i,2);return v;};
 const output=value('--output'),csv=value('--csv'),player=value('--player'),champion=value('--champion'),round=value('--round'),explicit=value('--profile');
 const file=args.shift();if(!file||args.length)throw Error('Usage: node parse.cjs FILE.rofl [--player INDEX|RIOT_ID|PUUID] [--champion NAME] [--round N] [--output JSON] [--csv CSV] [--profile PROFILE]');
 const profileFile=explicit;
 let result;
 if(profileFile&&fs.existsSync(profileFile)){result=analyze(file,JSON.parse(fs.readFileSync(profileFile)));validate(result);}
 else if(explicit)throw Error('Profile file does not exist: '+explicit);
 else result=buildProfile(file).result;
 const players=result.players.filter(p=>(player===undefined||String(p.index)===player||p.riotId===player||p.puuid===player)&&(champion===undefined||p.champion.toLowerCase()===champion.toLowerCase()));
 if(!players.length)throw Error('No matching player');
 if(round!==undefined&&(!Number.isInteger(Number(round))||!result.rounds.some(r=>r.round===Number(round))))throw Error('Round not found');
 const matches=x=>players.some(p=>p.index===x.playerIndex)&&(round===undefined||x.round===Number(round));
 const selected={...result,players,rounds:result.rounds.filter(r=>round===undefined||r.round===Number(round)),snapshots:result.snapshots.filter(matches),events:result.events.filter(matches),transmutationCandidates:result.transmutationCandidates.filter(matches),keyframeChecks:result.keyframeChecks.filter(x=>players.some(p=>p.index===x.playerIndex))};
 if(csv){const rows=[['player_index','riot_id','champion','round','combat_start_seconds','last_update_seconds','augment_ids','augment_names','level_candidates']];for(const s of selected.snapshots){const p=players.find(p=>p.index===s.playerIndex),a=s.records.filter(x=>x.category==='augment');rows.push([p.index,p.riotId,p.champion,s.round,s.time,s.lastGameUpdateTime,a.map(x=>x.id).join(';'),a.map(x=>x.nameKo||x.apiName).join(';'),a.map(x=>x.levelCandidate).join(';')]);}fs.writeFileSync(csv,'\ufeff'+rows.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');}
 const json=JSON.stringify(selected,null,2)+'\n';if(output)fs.writeFileSync(output,json);else process.stdout.write(json);
}
module.exports={run};
if(require.main===module)try{run(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
