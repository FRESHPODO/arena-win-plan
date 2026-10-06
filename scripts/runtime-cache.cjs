const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'.runtime-cache');
function initialize(target=directory){
 const directory=path.resolve(target);
 if(fs.existsSync(directory)){
  const stat=fs.lstatSync(directory);
  if(stat.isSymbolicLink()||path.resolve(fs.realpathSync(directory)).toLowerCase()!==directory.toLowerCase())throw Error('Invalid runtime cache path');
  fs.rmSync(directory,{recursive:true,force:true});
 }
 fs.mkdirSync(directory,{recursive:true});
}
module.exports={directory,initialize};
