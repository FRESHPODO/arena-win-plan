const fs=require('node:fs'),path=require('node:path');
const directory=path.resolve(__dirname,'../data/builds');
function indexBuilds(){
  const files=fs.readdirSync(directory).filter(name=>name.endsWith('.json') && name!=='index.json').sort();
  const ids=new Set();
  for(const file of files){
    const build=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
    if(!build.id || !build.title || Array.isArray(build) || ids.has(build.id))throw Error(`Invalid or duplicate build: ${file}`);
    ids.add(build.id);
  }
  fs.writeFileSync(path.join(directory,'index.json'),JSON.stringify(files,null,2)+'\n');
  return files;
}
module.exports=indexBuilds;
if(require.main===module)console.log(`Indexed ${indexBuilds().length} builds.`);
