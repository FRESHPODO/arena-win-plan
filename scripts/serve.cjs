const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const runtimeCache=require('./runtime-cache.cjs');
const videoRenderer=require('./render-overlay.cjs');
let heavyRequest=false;
function acquireHeavy(res){if(heavyRequest||[...videoRenderer.jobs.values()].some(job=>job.state==='rendering')){res.writeHead(429,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'분석 또는 영상 요청이 진행 중입니다. 완료 후 다시 시도하세요.'}));return false;}heavyRequest=true;res.once('close',()=>{heavyRequest=false;});return true;}
const parseReplayRounds=require('./parse-replay-rounds.cjs');
let overlayState = null;
const overlayClients = new Set();
function sendOverlay(res) { res.write(`data: ${JSON.stringify(overlayState)}\n\n`); }
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
http.createServer((req,res)=>{
  const endpoint = new URL(req.url,'http://localhost').pathname;
  if(endpoint==='/api/overlay/replay-anvils' && req.method==='POST'){
    if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end();return;}
    if(!acquireHeavy(res))return;
    const chunks=[];let size=0;
    req.on('data',chunk=>{size+=chunk.length;if(size<=64*1024*1024)chunks.push(chunk);});
    req.on('end',async()=>{
      let directory;
      try{
        if(size>64*1024*1024)throw Error('리플레이는 최대 64MB까지 지원합니다.');
        const player=new URL(req.url,'http://localhost').searchParams.get('player');
        if(!player)throw Error('플레이어 인덱스 또는 Riot ID를 입력하세요.');
        directory=fs.mkdtempSync(path.join(runtimeCache.directory,'arena-anvils-'));
        const file=path.join(directory,'replay.rofl');fs.writeFileSync(file,Buffer.concat(chunks));
        const result=await new Promise((resolve,reject)=>require('node:child_process').execFile(process.execPath,[path.join(root,'tools/arena_rofl_core/parse_anvils.cjs'),file,'--player',player],{windowsHide:true,maxBuffer:16*1024*1024,timeout:120000},(error,stdout,stderr)=>error?reject(Error(stderr.trim()||error.message)):resolve(JSON.parse(stdout))));
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result));
      }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
      finally{if(directory)fs.rmSync(directory,{recursive:true,force:true});}
    });return;
  }
  if(endpoint==='/api/overlay/replay-rounds' && req.method==='POST'){
    if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end();return;}
    if(!acquireHeavy(res))return;
    const chunks=[];let size=0;
    req.on('data',chunk=>{size+=chunk.length;if(size<=64*1024*1024)chunks.push(chunk);});
    req.on('end',()=>{try{if(size>64*1024*1024)throw Error('리플레이는 최대 64MB까지 지원합니다.');const result=parseReplayRounds(Buffer.concat(chunks));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result));}catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}});return;
  }
  if(endpoint==='/api/overlay/render' && req.method==='POST'){
    if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end();return;}
    if(!acquireHeavy(res))return;
    let chunks=[],size=0;
    req.on('data',chunk=>{size+=chunk.length;if(size<=256*1024*1024)chunks.push(chunk);});
    req.on('end',()=>{try{if(size>256*1024*1024)throw Error('소스가 너무 큽니다.');const id=videoRenderer.start(JSON.parse(Buffer.concat(chunks).toString()));res.writeHead(202,{'Content-Type':'application/json'});res.end(JSON.stringify({id}));}catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}});return;
  }
  const videoMatch=endpoint.match(/^\/api\/overlay\/render\/([a-f0-9-]+)(\/file)?$/);
  if(videoMatch && req.method==='GET'){
    const job=videoRenderer.jobs.get(videoMatch[1]);if(!job){res.writeHead(404);res.end();return;}
    if(videoMatch[2]){if(job.state!=='complete'){res.writeHead(409);res.end();return;}const file=path.join(job.directory,'arena-overlay.mov');const requestedName=new URL(req.url,'http://localhost').searchParams.get('filename')||'arena-overlay.mov';const downloadName=requestedName.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,180);res.writeHead(200,{'Content-Type':'video/quicktime','Content-Length':fs.statSync(file).size,'Content-Disposition':`attachment; filename="arena-overlay.mov"; filename*=UTF-8''${encodeURIComponent(downloadName)}`});job.downloads=(job.downloads||0)+1;const stream=fs.createReadStream(file);let finished=false,closed=false;const release=()=>{if(!closed)return;if(finished)videoRenderer.cleanup(job.id);};res.once('finish',()=>{finished=true;release();});res.once('close',()=>{if(!res.writableFinished)stream.destroy();});stream.once('close',()=>{closed=true;job.downloads--;release();});stream.once('error',()=>res.destroy());stream.pipe(res);return;}
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({state:job.state,progress:job.progress,error:job.error}));return;
  }
  if(endpoint==='/api/overlay/events' && req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
    overlayClients.add(res);sendOverlay(res);
    const heartbeat=setInterval(()=>res.write(': keepalive\n\n'),15000);
    req.on('close',()=>{clearInterval(heartbeat);overlayClients.delete(res);});return;
  }
  if(endpoint==='/api/overlay' && req.method==='POST'){
    if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end();return;}
    let body='',tooLarge=false;
    req.on('data',chunk=>{if(!tooLarge)body+=chunk;if(body.length>16384){tooLarge=true;body='';}});
    req.on('end',()=>{try{
      if(tooLarge)throw Error('Too large');
      const state=JSON.parse(body);
      if(!state.settings || !Array.isArray(state.slots) || state.slots.length>6)throw Error('Invalid state');
      overlayState=state;overlayClients.forEach(sendOverlay);
      res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');
    }catch{res.writeHead(400);res.end('Invalid overlay state');}});return;
  }
  try {const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size});if(req.method==='HEAD'){res.end();return;}const stream=fs.createReadStream(file);res.once('close',()=>stream.destroy());stream.once('error',()=>res.destroy());stream.pipe(res);});} catch {res.writeHead(400);res.end('Bad request');}
}).listen(4173,'127.0.0.1',()=>{runtimeCache.initialize();videoRenderer.cleanupStartup();console.log('Preview: http://127.0.0.1:4173');});
