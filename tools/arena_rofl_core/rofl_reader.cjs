const fs=require('fs'), zlib=require('zlib'),crypto=require('node:crypto');
function read(file, {streams=[1],augmentOpcode=null,retainBlock=null}={}){
 const compact=augmentOpcode!==null||retainBlock!==null;
 if(retainBlock!==null&&typeof retainBlock!=='function')throw Error('retainBlock must be a function');
 const b=fs.readFileSync(file);
 if(b.length<32 || b.subarray(0,4).toString()!=='RIOT' || b.readUInt16LE(4)!==2)throw Error('Unsupported or truncated ROFL container (requires RIOT v2)');
 const ml=b.readUInt32LE(b.length-4), end=b.length-4-ml-256;
 if(end<15+b[14])throw Error('Invalid metadata boundary');
 const metadata=JSON.parse(b.subarray(b.length-4-ml,b.length-4));
 const blocks=[], chunks=[],globalOpcodeCounts=new Map();let gameBlockIndex=0,previousGame=null,o=15+b[14];
 while(o<end){if(o+17>end)throw Error('Truncated chunk header');const chunkOffset=o,id=b.readUInt32LE(o),type=b[o+4],stream=b.readUInt32LE(o+5)>>>24,ul=b.readUInt32LE(o+9),cl=b.readUInt32LE(o+13);o+=17;
 if(o+(cl||ul)>end)throw Error('Truncated chunk body');if(ul>256*1024*1024)throw Error('Chunk too large');
 const bodyOffset=o;o+=cl||ul;
 if(compact&&streams!==null&&!streams.includes(stream)){chunks.push({id,type,stream,chunkOffset,uncompressedSize:ul,compressedSize:cl});continue;}
 const d=cl?zlib.zstdDecompressSync(b.subarray(bodyOffset,bodyOffset+cl),{maxOutputLength:ul}):b.subarray(bodyOffset,bodyOffset+ul);
 if(d.length!==ul)throw Error('length');chunks.push({id,type,stream,chunkOffset,uncompressedSize:ul,compressedSize:cl});if(streams!==null&&!streams.includes(stream))continue;
 let p=0,t=0,op=0,param=0;
 while(p<d.length){const blockOffset=p,m=d[p++],need=(m&128?1:4)+(m&16?1:4)+(m&64?0:2)+(m&32?1:4);if(p+need>d.length)throw Error('Truncated block header');if(m&128)t+=d[p++]/1000;else{t=d.readFloatLE(p);p+=4;}let n;if(m&16)n=d[p++];else{n=d.readUInt32LE(p);p+=4;}if(!(m&64)){op=d.readUInt16LE(p);p+=2;}if(m&32)param=(param+d[p++])>>>0;else{param=d.readUInt32LE(p);p+=4;}if(!Number.isFinite(t))throw Error('Invalid timestamp');if(p+n>d.length)throw Error('Truncated block payload');const data=d.subarray(p,p+n);
 if(!compact)blocks.push({t,op,param,data,chunk:id,stream,chunkOffset,blockOffset,payloadOffset:p});
 else {
  if(stream===1&&param===0)globalOpcodeCounts.set(op,(globalOpcodeCounts.get(op)||0)+1);
  const keep=retainBlock?retainBlock({t,op,param,length:n,stream,chunk:id}):op===augmentOpcode||(stream===1&&param===0&&((n>=7&&n<=10)||n===16||n===17));
  if(keep){const block={t,op,param,data:Buffer.from(data),chunk:id,stream,chunkOffset,blockOffset,payloadOffset:p};
   if(stream===1){block.gameBlockIndex=gameBlockIndex;if(op===augmentOpcode&&previousGame?.t===t)block.adjacentObjectCandidate=previousGame;}
   blocks.push(block);
  }
  if(stream===1)previousGame=[0xae,0x47c,0x2b6].includes(op)?{t,op,param,data:Buffer.from(data)}:null;
 }
 if(stream===1)gameBlockIndex++;p+=n;}
 }
 return {version:b.subarray(15,15+b[14]).toString(),protocolDigestRaw:b.subarray(6,14).toString('hex'),metadata,blocks,chunks,...(compact?{globalOpcodeCounts,replaySha256:crypto.createHash('sha256').update(b).digest('hex')}:{})};
}
module.exports={read};
if(require.main===module)for(const file of process.argv.slice(2)){
 const r=read(file);const counts={};for(const x of r.blocks){counts[x.op]=(counts[x.op]||0)+1;const s=x.data.toString('latin1');if(/round|phase|combat|guest|arena/i.test(s))console.log(file,x.t,x.op.toString(16),JSON.stringify(s));}
 console.log(file,r.version,r.blocks.length,Object.entries(counts).sort((a,b)=>a[1]-b[1]));
}
