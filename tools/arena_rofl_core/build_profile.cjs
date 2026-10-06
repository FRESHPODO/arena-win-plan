'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {read}=require('./rofl_reader.cjs'),{analyze}=require('./arena_augments.cjs');
function buildProfile(file,seedFile=path.join(__dirname,'data/build-16.19.json'),catalogFile=path.join(__dirname,'data/catalog-16.19.json')){
 const seed=JSON.parse(fs.readFileSync(seedFile)),catalog=JSON.parse(fs.readFileSync(catalogFile));
 if(crypto.createHash('sha256').update(fs.readFileSync(catalogFile)).digest('hex')!==seed.catalogSha256)throw Error('Catalog digest mismatch');
 const r=read(file,{streams:[1,2],augmentOpcode:seed.opcode});
if(r.version!==seed.version||r.protocolDigestRaw!==seed.protocolDigestRaw)throw Error('Unsupported build/protocol. See arena_rofl_support/update/README.md');
 function hash(s){let n=2166136261;for(const b of Buffer.from(s.toLowerCase()))n=Math.imul(n^b,16777619)>>>0;return n;}
 function vint(n){const a=[];do{const b=n&127;n>>>=7;a.push(b|(n?128:0));}while(n);return a;}
 const universe=catalog.map(x=>({...x,hash:hash(x.apiName),v:vint(hash(x.apiName))}));
 const packets=r.blocks.filter(b=>b.op===seed.opcode),map={...seed.hashByteMap},inv={};
 for(const[k,v]of Object.entries(map)){if(inv[v]!==undefined)throw Error('Non-bijective seed');inv[v]=Number(k);}
 for(let pass=0;pass<10;pass++){
  let added=0;
  for(const {data:d}of packets.filter(b=>b.stream===1))for(let i=4;i<d.length;i++){
   if(!seed.stateCodes[d[i-1].toString(16).padStart(2,'0')])continue;
   for(const len of [4,5]){
    const s=d.subarray(i,i+len);if(s.length!==len||[...s].filter(b=>map[b]!==undefined).length<2)continue;
    const matches=universe.filter(x=>x.v.length===len&&x.v.every((v,j)=>(map[s[j]]===undefined||map[s[j]]===v)&&(inv[v]===undefined||inv[v]===s[j])));
    if(matches.length!==1)continue;
    matches[0].v.forEach((v,j)=>{if(map[s[j]]===undefined){map[s[j]]=v;inv[v]=s[j];added++;}});
   }
  }
  if(!added)break;
 }
 const records=universe.filter(x=>x.v.every(v=>inv[v]!==undefined)).map(({v,...x})=>({...x,wire:Buffer.from(v.map(b=>inv[b])).toString('hex'),category:x.id===3?'sentinel':x.rarity===4?'auxiliary':'augment'}));
 const counts={...seed.countCodes};
 for(const {data:d}of packets.filter(b=>b.stream===1)){
  if(d[0]===0x6f)continue;
  if(d[0]!==0x6e||d.length<3)throw Error('Unexpected state header');
  let offset=3,count=0;
  while(offset<d.length){
   const state=seed.stateCodes[d[offset++].toString(16).padStart(2,'0')];if(!state)throw Error('Unknown state code: '+d.toString('hex'));
   const matches=records.filter(x=>d.subarray(offset,offset+x.wire.length/2).toString('hex')===x.wire);
   if(matches.length!==1)throw Error('Unknown/ambiguous hash: '+d.toString('hex'));
   offset+=matches[0].wire.length/2;if(state.extra&&d[offset++]!==0xbd)throw Error('Extended state mismatch');count++;
  }
  const code=d[2].toString(16).padStart(2,'0');if(counts[code]!==undefined&&counts[code]!==count)throw Error('Count mismatch');counts[code]=count;
 }
 const initial=packets.filter(b=>b.stream===2&&b.t===0),metadata=JSON.parse(r.metadata.statsJson);
 if(initial.length!==metadata.length||initial.some(b=>b.data.length!==2||b.data[0]!==0x6f)||new Set(initial.map(b=>b.data[1])).size!==metadata.length)throw Error('Initial frame mismatch');
 const profile={...seed,schemaVersion:1,status:'candidate',file:path.basename(file),scope:'Exact replay, validated against keyframes and final metadata',replaySha256:r.replaySha256,players:initial.map((b,index)=>({index,wireKey:b.data[1],initialEvidence:{chunk:b.chunk,stream:b.stream,blockOffset:b.blockOffset,payload:b.data.toString('hex')}})),records,countCodes:counts,hashByteMap:map};
 const result=analyze(file,profile,{replay:r});validate(result);profile.validation=result.validation;
 return {profile,result};
}
function validate(result){const v=result.validation;if(!v.gameStatePackets||!v.keyframeStatePackets||v.keyframeIdMatches!==v.keyframeStatePackets||v.keyframeLevelCandidateMatches!==v.keyframeStatePackets||v.finalPlayersMatched!==v.totalPlayers)throw Error('Validation failed: '+JSON.stringify(v));}
module.exports={buildProfile,validate};
if(require.main===module){try{const [file,out]=process.argv.slice(2);if(!file)throw Error('Usage: node build_profile.cjs FILE.rofl [PROFILE.json]');const {profile}=buildProfile(file);const target=out||path.resolve(path.basename(file,'.rofl')+'.candidate-profile.json');fs.writeFileSync(target,JSON.stringify(profile,null,2)+'\n');console.log(JSON.stringify({profile:target,validation:profile.validation}));}catch(e){console.error(e.message);process.exitCode=1;}}
