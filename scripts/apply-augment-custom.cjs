// Preserve Arena augments missing from the legacy CommunityDragon Arena export.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const write = (file, value) => fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + '\n');
const source = read('data/augment-custom-source.json');
const manifest = read('imgs/augments/manifest.json');
const db = read('data/augment-descriptions.ko.json');
for (const row of source.augments) {
  const { effects, levels, dataValues, descriptionHtml, tooltipHtml, ...asset } = row;
  const entry = manifest.find(a => a.id === row.id);
  if (entry) Object.assign(entry, asset);
  else manifest.push(asset);
  const description = {
    id: row.id, name: row.name, icon: `imgs/augments/${row.icon}`, rarity: row.rarity,
    stats: '', effects, levels, maxLevel: row.maxLevel, dataValues, descriptionHtml, tooltipHtml,
    sourceUrl: source.patchNotes, sourceDataset: 'augment-custom-source.json',
    removed: false, iconPlaceholder: false, unresolvedTokens: []
  };
  const previous = db.augments.find(a => a.id === row.id);
  if (previous) Object.assign(previous, description);
  else db.augments.push(description);
}
// Patch overrides take precedence over the older wiki and legacy exports.
for (const row of source.overrides || []) {
  const asset = manifest.find(a => a.id === row.id);
  const description = db.augments.find(a => a.id === row.id);
  if (!asset || !description) throw Error(`Missing patch override target: ${row.id}`);
  if (row.rarity !== undefined) asset.rarity = description.rarity = row.rarity;
  for (const key of ['effects', 'levels']) if (row[key] !== undefined) description[key] = row[key];
  description.sourceUrl = source.patchNotes;
  description.patch = source.patch;
}
db.customSource = source.definitionSource;
db.updatedAtUtc = source.retrievedAt;
write('imgs/augments/manifest.json', manifest);
write('data/augment-descriptions.ko.json', db);
console.log(`Applied ${source.augments.length} supplemental Arena augments.`);
