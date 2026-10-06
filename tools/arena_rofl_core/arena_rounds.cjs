#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {read} = require('./rofl_reader.cjs');

// Discover the event stream afresh for each replay; no build/opcode tables.
function detect(blocks) {
  const groups = new Map();
  for (const b of blocks) {
    if (b.param !== 0 || b.data.length < 7 || b.data.length > 10) continue;
    if (!groups.has(b.op)) groups.set(b.op, []);
    groups.get(b.op).push(b);
  }
  const candidates = [];
  for (const [op, events] of groups) {
    if (events.length < 8 || events.length % 2) continue;
    const a = events[0].data.subarray(-6).toString('hex');
    const z = events[1].data.subarray(-6).toString('hex');
    if (a === z || events[0].t > 3 || events[0].t < 0 || events[1].t < 40 || events[1].t > 90) continue;
    if (!events.every((b,i) => b.data.subarray(-6).toString('hex') === (i%2 ? z : a))) continue;
    if (!events.every((b,i) => !i || b.t > events[i-1].t)) continue;
    if (!events.every((b,i) => !(i%2) || (b.t-events[i-1].t >= 10 && b.t-events[i-1].t <= 120))) continue;
    candidates.push({op, events, preparationSignature:a, combatSignature:z});
  }
  if (candidates.length !== 1) throw Error(`Expected one alternating round stream; found ${candidates.length}. Refusing ambiguous/unsupported replay.`);
  return candidates[0];
}

function extract(file) {
  return extractFromReplay(read(file),file);
}
function extractFromReplay(r,file) {
  const blocks=r.blocks.filter(b=>b.stream===undefined||b.stream===1), detected = detect(blocks);
  const rounds = [];
  for (let i=0; i<detected.events.length; i+=2) {
    const prep=detected.events[i], combat=detected.events[i+1];
    rounds.push({round:i/2+1, preparationStart:prep.t, shoppingStart:prep.t, combatStart:combat.t,
      guestVoteStart:null, evidence:{preparation:{opcode:prep.op,chunk:prep.chunk,payload:prep.data.toString('hex')},
        combat:{opcode:combat.op,chunk:combat.chunk,payload:combat.data.toString('hex')}}});
  }
  // Guest-vote setup packets occur before the normal shopping event. Both
  // supplied builds encode these as 16/17-byte, global, twice-per-game packets.
  const guests=rounds.filter(x=>[2,8].includes(x.round));
  const byOp=new Map();
  for(const b of blocks) if(b.param===0){if(!byOp.has(b.op))byOp.set(b.op,[]);byOp.get(b.op).push(b);}
  const voteCandidates=[];
  if(guests.length===2) for(const [op,bs]of byOp) {
    if((r.globalOpcodeCounts?.get(op)??bs.length)!==2 || bs.length!==2 || !bs.every(b=>[16,17].includes(b.data.length)))continue;
    if(bs.every((b,i)=>guests[i].shoppingStart-b.t>4 && guests[i].shoppingStart-b.t<45 &&
      b.t>rounds[guests[i].round-2].combatStart))voteCandidates.push({op,bs});
  }
  const warnings=[];
  if(voteCandidates.length===1){
    voteCandidates[0].bs.forEach((b,i)=>{const x=guests[i];x.guestVoteStart=b.t;x.preparationStart=b.t;
      x.evidence.guestVote={opcode:b.op,chunk:b.chunk,payload:b.data.toString('hex')};});
  }else warnings.push('Guest-vote setup not uniquely identified; preparationStart on rounds 2/8 is only the shopping event, and may be late.');
  return {file:path.basename(file),version:r.version,gameLengthSeconds:r.metadata.gameLength/1000,
    method:'structural-inference', semanticStatus:'candidate; phase events, not proven input-unlock times',
    roundOpcode:detected.op, preparationSignature:detected.preparationSignature, combatSignature:detected.combatSignature,
    warnings, rounds};
}
module.exports={detect,extract,extractFromReplay};
if(require.main===module){
  try {
    const args=process.argv.slice(2), outputIndex=args.indexOf('--output');let output;
    if(outputIndex>=0){output=args[outputIndex+1];if(!output)throw Error('--output requires a path');args.splice(outputIndex,2);}
    const files=args.length?args:fs.readdirSync('.').filter(f=>f.toLowerCase().endsWith('.rofl')).sort();
    if(!files.length)throw Error('No ROFL files');
    const results=files.map(extract), json=JSON.stringify(results,null,2)+'\n';
    if(output)fs.writeFileSync(output,json);else process.stdout.write(json);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
