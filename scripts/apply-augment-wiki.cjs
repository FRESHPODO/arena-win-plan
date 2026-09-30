// Wiki text translations are distributed under CC BY-SA 3.0; see data/augment-wiki-source.json.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,''));
const write=(file,data)=>fs.writeFileSync(path.join(root,file),JSON.stringify(data,null,2)+'\n');
const lines=file=>new Map(fs.readFileSync(path.join(root,file),'utf8').trim().split(/\r?\n/).map(line=>{const [name,...values]=line.split('|');return [name,values];}));
const wiki=read('data/augment-wiki-source.json');
const names=read('data/augment-official-names.json').names;
const fallbackNames=lines('data/augment-wiki-names.ko.txt');
const effects=lines('data/augment-wiki-effects.ko.txt'),levels=lines('data/augment-wiki-levels.ko.txt');
const manifest=read('imgs/augments/manifest.json'),db=read('data/augment-descriptions.ko.json');
const norm=s=>s.toLowerCase().replace(/[^a-z0-9?]/g,'');
const aliases={'Grevious Venom':'Grievous Venom','Null':'Null Augment'};
const sources=read('data/augment-wiki-icons.json');
let added=0;
for(const row of wiki.augments){
  const name=aliases[row.name]||row.name;
  let entry=manifest.find(a=>norm(a.nameEn)===norm(name));
  if(!entry){
    const slug=norm(name)==='???'?'missing-pings':name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const nameKo=names[row.name]?.nameKo||fallbackNames.get(row.name)?.[0];
    assert(nameKo,`Missing name ${row.name}`);assert(sources[row.name],`Missing icon ${row.name}`);
    entry={id:`wiki-${slug}`,apiName:slug,name:nameKo,nameKo,nameEn:row.name,rarity:{Silver:0,Gold:1,Prismatic:2}[row.tier],icon:`icons/wiki-${slug}.png`,iconUrl:sources[row.name].url,nameSource:names[row.name]?'game-stringtable':'wiki-translation',iconPlaceholder:!!sources[row.name].placeholder};
    manifest.push(entry);added++;
  }
  entry.wikiName=row.name;entry.wikiSource=wiki.source;
  entry.removed=/Removed since/.test(row.effect);
  let description=db.augments.find(a=>a.id===entry.id);
  if(!description){description={id:entry.id,name:entry.name,icon:`imgs/augments/${entry.icon}`,rarity:entry.rarity,stats:''};db.augments.push(description);}
  assert(effects.has(row.name),`Missing translation ${row.name}`);
  const maxLevel=Math.max(1,...row.levels.map((text,i)=>text?i+1:0));
  if(row.levels.some(Boolean))assert.equal(levels.get(row.name)?.length,maxLevel,`Level mismatch ${row.name}`);
  Object.assign(description,{effects:effects.get(row.name)[0],wikiName:row.name,wikiSource:wiki.source,sourceLicense:wiki.license,levels:levels.get(row.name)||[],maxLevel,removed:entry.removed,iconPlaceholder:!!entry.iconPlaceholder,unresolvedTokens:[]});
  // Keep raw game data for reference; the displayed text uses the verified wiki overlay.
}
db.wikiSource=wiki.source;db.wikiRetrievedAt=wiki.retrievedAt;db.wikiLicense=wiki.license;
write('imgs/augments/manifest.json',manifest);write('data/augment-descriptions.ko.json',db);
console.log(`Applied ${wiki.augments.length} wiki descriptions, ${levels.size} level tables, ${added} new augments; ${manifest.length} total.`);
