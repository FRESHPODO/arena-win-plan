// Rebuild only from the versioned Arena (map 30) source snapshot.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
const write = (p,v) => fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');
const source = read('data/item-arena-source.json');
source.items.push(...read('data/item-custom-source.json').items);
const old = read('imgs/items/manifest.json');
const previous = read('data/item-descriptions.ko.json');
const plain = s => s.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
const rows = source.items.map(s => {
  const existing = old.find(o=>String(o.id)===String(s.id) && o.category===s.category);
  const icon = s.icon || existing?.icon || `${s.category}/${s.id}-arena.png`;
  const donor = old.find(o=>o.iconUrl===s.iconUrl && fs.existsSync(path.join(root,'imgs/items',o.icon)));
  const target = path.join(root,'imgs/items',icon);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  if (!fs.existsSync(target) && donor) fs.copyFileSync(path.join(root,'imgs/items',donor.icon),target);
  return {id:s.id,name:s.name,nameKo:s.name,nameEn:s.nameEn,category:s.category,...(s.rarity?{rarity:s.rarity}:{}),icon,iconUrl:s.iconUrl,patch:source.patch};
});
const descriptions = rows.map(r => {
  const s=source.items.find(s=>s.id===r.id);
  const aliases=new Set(previous.items.find(p=>String(p.id)===String(r.id))?.aliases || []);
  for(const o of old) if(o.name===r.name || (o.iconUrl===r.iconUrl && o.name==='리안드리의 고통')) aliases.add('imgs/items/'+o.icon);
  aliases.delete('imgs/items/'+r.icon);
  return {id:r.id,name:r.name,icon:'imgs/items/'+r.icon,...(r.rarity?{rarity:r.rarity}:{}),aliases:[...aliases],stats:plain((s.description.match(/<stats>([\s\S]*?)<\/stats>/i)||[])[1]||''),effects:plain(s.description.replace(/<stats>[\s\S]*?<\/stats>/gi,'')),descriptionHtml:s.description};
});
function manifest(file,records){write(file+'.json',records);const keys=[...new Set(records.flatMap(record=>Object.keys(record)))];const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';fs.writeFileSync(path.join(root,file+'.csv'),[keys.map(cell).join(','),...records.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\n')+'\n');}
manifest('imgs/items/manifest',rows);
for(const category of ['prismatic','legendary','anvil','consumable','exclusive']) {fs.mkdirSync(path.join(root,'imgs/items',category),{recursive:true});manifest(`imgs/items/${category}/manifest`,rows.filter(r=>r.category===category));}
write('data/item-descriptions.ko.json',{locale:'ko_KR',patch:source.patch,source:source.source,items:descriptions});
write('data/item-downloads.json',rows.filter(r=>!fs.existsSync(path.join(root,'imgs/items',r.icon))));
console.log(`Arena catalog: ${rows.length} items; missing icons: ${read('data/item-downloads.json').length}`);
