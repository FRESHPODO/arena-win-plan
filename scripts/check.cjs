const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const root=path.resolve(__dirname,'..');const builds=require('./index-builds.cjs')().map(file=>JSON.parse(fs.readFileSync(path.join(root,'data/builds',file),'utf8')));const ids=new Set();
for(const b of builds){assert(!ids.has(b.id),'Duplicate build ID');ids.add(b.id);assert(b.title && b.description && Number.isFinite(Date.parse(b.createdAt)),'Invalid build');const assets=[...b.items,...b.augments,...b.champions,b.representative];for(const a of assets)assert(fs.existsSync(path.join(root,a.icon)),`Missing asset: ${a.icon}`);assert([...b.items,...b.augments].some(a=>a.icon===b.representative.icon),'Representative must be an item or augment');}
for(const kind of ['items','augments','champions']){const assets=JSON.parse(fs.readFileSync(path.join(root,'imgs',kind,'manifest.json'),'utf8'));for(const a of assets)assert(fs.existsSync(path.join(root,'imgs',kind,a.icon)),`Missing catalog asset ${a.icon}`);}
console.log(`Validated ${builds.length} builds, representative choices, and all catalog icons.`);
const descriptions=JSON.parse(fs.readFileSync(path.join(root,'data/item-descriptions.ko.json'),'utf8'));
const itemCatalog=JSON.parse(fs.readFileSync(path.join(root,'imgs/items/manifest.json'),'utf8'));
for(const item of itemCatalog){const description=descriptions.items.find(row=>row.id===item.id);assert(description,`Missing Korean description: ${item.id}`);assert(description.name && (description.stats || description.effects),`Empty description: ${item.id}`);assert(!/<[^>]+>/.test(description.stats+description.effects),`Unstripped description tags: ${item.id}`);}
console.log(`Validated ${descriptions.items.length} Korean item descriptions.`);
const arenaSource=JSON.parse(fs.readFileSync(path.join(root,'data/item-arena-source.json'),'utf8'));
assert.equal(new Set(itemCatalog.map(i=>i.name)).size,itemCatalog.length,'Duplicate Arena item names');
for(const item of itemCatalog)assert(arenaSource.items.some(s=>s.id===item.id && s.map===30 && s.category===item.category),`Non-Arena item: ${item.id}`);
assert(!itemCatalog.some(i=>[6653,3172].includes(i.id)),'Regular-mode item leaked into Arena');
assert.equal(itemCatalog.find(i=>i.id===226630).category,'prismatic');
assert.equal(itemCatalog.find(i=>i.id===226693).category,'prismatic');
assert.match(descriptions.items.find(i=>i.id===226653).stats,/주문력\s+50\n체력\s+250/);
assert(descriptions.items.find(i=>i.id===223004).aliases.includes('imgs/items/legendary/3004-manamune.png'),'Legacy build alias missing');
for(const id of [223040,223042,223121])assert(itemCatalog.some(i=>i.id===id),'Missing transformed item');
const augmentDescriptions=JSON.parse(fs.readFileSync(path.join(root,'data/augment-descriptions.ko.json'),'utf8')).augments;
const augmentCatalog=JSON.parse(fs.readFileSync(path.join(root,'imgs/augments/manifest.json'),'utf8'));
for(const augment of augmentCatalog){const description=augmentDescriptions.find(row=>row.id===augment.id);assert(description?.effects,`Missing augment description: ${augment.id}`);assert.equal(description.rarity,augment.rarity);assert(!/@[^@]+@|\{\{|%i:|<[^>]+>/.test(description.effects),`Unresolved markup: ${augment.id}`);}
console.log(`Validated ${augmentDescriptions.length} Korean augment descriptions.`);
const wikiAugments=JSON.parse(fs.readFileSync(path.join(root,'data/augment-wiki-source.json'),'utf8')).augments;
assert.equal(new Set(augmentCatalog.map(a=>String(a.id))).size,augmentCatalog.length,'Duplicate augment ID');
for(const wiki of wikiAugments){
  const entry=augmentCatalog.find(a=>a.wikiName===wiki.name);
  assert(entry,`Missing wiki augment ${wiki.name}`);
  const description=augmentDescriptions.find(a=>a.id===entry.id);
  const max=Math.max(1,...wiki.levels.map((value,i)=>value?i+1:0));
  assert.equal(description.maxLevel,max,`Incorrect max level ${wiki.name}`);
  if(wiki.levels.some(Boolean)){
    assert.equal(description.levels.length,max,`Missing level ${wiki.name}`);
    for(const level of description.levels)assert(/[가-힣]/.test(level)&&!/@[^@]+@|\{\{|<[^>]+>/.test(level),`Invalid Korean level text ${wiki.name}`);
  }
  assert.equal(entry.removed,/Removed since/.test(wiki.effect));
}
const wildFire=augmentDescriptions.find(a=>a.wikiName==='Wild Fire');
assert.equal(wildFire.name,'야생 불꽃');
assert(wildFire.levels[0].includes('350')&&wildFire.levels[1].includes('450')&&wildFire.levels[2].includes('550'),'Wild Fire scaling regression');
assert(augmentDescriptions.find(a=>a.wikiName==='Mystic Punch').effects.includes('1.25'),'Mystic Punch coefficient regression');
console.log(`Validated ${wikiAugments.length} wiki entries, level bounds, and Korean level descriptions.`);
