const zlib=require('node:zlib');
module.exports=function parseReplayRounds(b){
 if(b.length<300||b.subarray(0,4).toString()!=='RIOT'||b.readUInt16LE(4)!==2)throw Error('지원하지 않는 ROFL 파일입니다.');
 const version=b.subarray(15,15+b[14]).toString();
 if(!version.startsWith('16.19.'))throw Error(`현재 라운드 추출은 16.19 리플레이만 지원합니다. 파일 버전: ${version}`);
 const n=b.readUInt32LE(b.length-4),end=b.length-4-n-256;
 if(end<15+b[14])throw Error('리플레이 구조가 잘못되었습니다.');
 const metadata=JSON.parse(b.subarray(b.length-4-n,b.length-4));
 const events={115:[],246:[],991:[]};let offset=15+b[14],expanded=0;
 while(offset<end){
  if(offset+17>end)throw Error('청크가 잘렸습니다.');
  const stream=b.readUInt32LE(offset+5)>>>24,raw=b.readUInt32LE(offset+9),comp=b.readUInt32LE(offset+13),size=comp||raw;
  expanded+=raw;if(raw>64*1024*1024||expanded>512*1024*1024||offset+17+size>end)throw Error('리플레이 크기 또는 청크 구조가 잘못되었습니다.');
  const data=b.subarray(offset+17,offset+17+size);offset+=17+size;
  if(stream!==1)continue;
  const d=comp?zlib.zstdDecompressSync(data,{maxOutputLength:raw}):data;
  if(d.length!==raw)throw Error('압축 해제 크기가 일치하지 않습니다.');
  if(stream!==1)continue;
  let pos=0,t=0,packet=0,param=0;
  while(pos<d.length){const marker=d[pos++];if(marker&128)t+=d[pos++]/1000;else{t=d.readFloatLE(pos);pos+=4;}let len;if(marker&16)len=d[pos++];else{len=d.readUInt32LE(pos);pos+=4;}if(!(marker&64)){packet=d.readUInt16LE(pos);pos+=2;}if(marker&32)param+=d[pos++];else{param=d.readUInt32LE(pos);pos+=4;}if(!Number.isFinite(t)||pos+len>d.length)throw Error('패킷 구조가 잘못되었습니다.');if(events[packet])events[packet].push({t,len,mask:len>1?d[pos+1]&224:null,param});pos+=len;}
 }
 const phases=events[115],combats=events[246].filter(e=>e.len===8&&e.param===0),preps=events[246].filter(e=>e.len===9&&e.param===0);
 const before=t=>phases.filter(e=>e.mask===160&&e.t<t).at(-1);
 const active=t=>phases.find(e=>e.mask===128&&e.t>t)?.t;
 if(!combats.length||combats.length>100||combats.length!==preps.length)throw Error('라운드 패턴을 식별하지 못했습니다. 시간을 수동 입력하세요.');
 const rounds=combats.map((combat,i)=>{const previous=i?combats[i-1].t:-1;const prep=preps.find(e=>e.t>previous&&e.t<combat.t);const transition=prep&&before(prep.t);const preparation=transition&&active(transition.t);const combatActive=active(combat.t);const guest=events[991].some(e=>e.t>previous&&e.t<combat.t);
  if(!transition||!Number.isFinite(preparation)||!Number.isFinite(combatActive)||preparation>=combat.t||combatActive-combat.t<5||combatActive-combat.t>7)throw Error('준비·전투 경계 패턴이 일치하지 않습니다.');
  return {round:i+1,preparationSeconds:preparation,combatTransitionSeconds:combat.t,guestOfHonor:guest};});
 const duration=Number(metadata.gameLength)/1000;
 if(!Number.isFinite(duration)||rounds.at(-1).combatTransitionSeconds>=duration||rounds.some((r,i)=>i&&r.preparationSeconds<=rounds[i-1].combatTransitionSeconds)||rounds.some(r=>r.guestOfHonor&&![2,8].includes(r.round)))throw Error('라운드 시간 검증에 실패했습니다.');
 return {version,duration,status:'inferred',rounds};
};
