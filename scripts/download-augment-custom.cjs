const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'data/augment-custom-source.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
(async () => {
  const results = await Promise.allSettled(source.augments.map(async row => {
    const candidates = [...new Set([row.iconUrl, row.iconSmallUrl, row.iconSmallUrl.replace('/game/', '/plugins/rcp-be-lol-game-data/global/default/')])];
    for (const url of candidates) {
      const response = await fetch(url);
      if (!response.ok) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error(`Invalid PNG: ${row.name}`);
      fs.writeFileSync(path.join(root, 'imgs/augments', row.icon), bytes);
      row.iconUrl = url;
      return row.name;
    }
    throw Error(`Missing icon: ${row.name}`);
  }));
  for (const result of results) {
    if (result.status === 'rejected') console.error(result.reason.message);
    else console.log(`Downloaded ${result.value}`);
  }
  if (results.some(r => r.status === 'rejected')) process.exitCode = 1;
  else fs.writeFileSync(sourcePath, JSON.stringify(source, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
