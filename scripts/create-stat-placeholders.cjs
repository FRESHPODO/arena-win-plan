const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', 'imgs', 'stats');
// Replaceable UI placeholders, not Riot artwork.
const icons = {
  mana:['#70beff','마나','M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0C19 11 14 7 12 3Z'],
  lifesteal:['#ef8194','생명력 흡수','M12 20 4 12C-1 5 8 1 12 7c4-6 13-2 8 5ZM7 12h10m-4-4 4 4-4 4'],
  omnivamp:['#dd88ee','모든 피해 흡혈','M12 3 21 12 12 21 3 12ZM7 12h10m-5-5v10'],
  tenacity:['#d6b58c','강인함','M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6ZM8 12l3 3 5-6'],
  healthregen:['#45d691','체력 재생','M19 8a8 8 0 1 0 1 8M19 3v5h-5M8 12h8m-4-4v8'],
  manaregen:['#70beff','마나 재생','M19 8a8 8 0 1 0 1 8M19 3v5h-5M12 8c-6 6-4 10 0 10s6-4 0-10'],
  armorpen:['#f0a279','방어구 관통력','M5 4h14v9l-7 7-7-7ZM3 21 21 3m-6 0h6v6'],
  magicpen:['#98fcf5','마법 관통력','m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3ZM3 21 21 3'],
  crit:['#efb572','치명타','m12 2 2 7 7-5-4 8 5 3-8 1-2 6-3-7-7 3 5-7-4-4 7 1Z'],
  healshield:['#91e4bc','체력 회복 및 보호막','M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6ZM8 11h8m-4-4v8'],
  range:['#d4dce5','공격 사거리','M3 12h18M7 8l-4 4 4 4m10-8 4 4-4 4'],
  size:['#d4dce5','크기','M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6M3 3l6 6m6 6 6 6'],
  true:['#ffffff','고정 피해','m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z']
};
for (const [id,[color,label,d]] of Object.entries(icons)) {
  fs.writeFileSync(path.join(root,`${id}-placeholder.svg`),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>${label} 임시 아이콘</title><path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`);
}
console.log(`Created ${Object.keys(icons).length} labeled stat placeholders.`);
