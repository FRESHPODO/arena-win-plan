const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cache=require('./runtime-cache.cjs'),renderer=require('./render-overlay.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'arena-cleanup-test-'));
try{
 const settings=path.join(root,'user_custom/settings');fs.mkdirSync(settings,{recursive:true});
 const layout=path.join(settings,'layout.json');fs.writeFileSync(layout,'{"width":987}');
 const temporary=path.join(root,'.runtime-cache');fs.mkdirSync(temporary);fs.writeFileSync(path.join(temporary,'replay.rofl'),'temporary');cache.initialize(temporary);
 assert.deepEqual(fs.readdirSync(temporary),[]);assert.equal(fs.readFileSync(layout,'utf8'),'{"width":987}');
 const exports=path.join(root,'exports');fs.mkdirSync(exports);
 const complete=path.join(exports,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),partial=path.join(exports,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
 fs.mkdirSync(complete);fs.mkdirSync(partial);fs.writeFileSync(path.join(complete,'arena-overlay.mov'),'finished');fs.writeFileSync(path.join(complete,'state-0.png'),'temporary');fs.writeFileSync(path.join(complete,'notes.txt'),'keep');fs.writeFileSync(path.join(partial,'part-0.mov'),'unfinished');
 renderer.cleanupStartup(exports);
 assert(!fs.existsSync(partial));assert(!fs.existsSync(path.join(complete,'state-0.png')));assert.equal(fs.readFileSync(path.join(complete,'arena-overlay.mov'),'utf8'),'finished');assert(fs.existsSync(path.join(complete,'notes.txt')));
 renderer.jobs.set('test',{state:'rendering'});assert.throws(()=>renderer.start({}),/진행 중/);renderer.jobs.delete('test');
 console.log('Startup cleanup preserves settings, completed videos and unrelated files; concurrent render rejected.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
