/* Shared encyclopedia keyword formatting. */
(()=>{
const keywordStyles = {
  '자동 사용':['autocast','autocast'], '자동사용':['autocast','autocast'], '자동 시전':['autocast','autocast'], '자동 발사':['autocast','autocast'], '자동으로 사용':['autocast','autocast'], '자동으로 시전':['autocast','autocast'], '자동으로 발사':['autocast','autocast'],
  '자동화':['autocast','autocast'],
  '충전 상태':['charge','charge'],
  '마나':['mana','mana-placeholder'], '최대 마나':['mana','mana-placeholder'],
  '생명력 흡수':['lifesteal','lifesteal-placeholder'], '모든 피해 흡혈':['omnivamp','omnivamp-placeholder'], '흡혈':['omnivamp','omnivamp-placeholder'],
  '강인함':['tenacity','tenacity-placeholder'], '둔화 저항':['tenacity','tenacity-placeholder'],
  '기본 체력 재생':['health','healthregen-placeholder'], '체력 재생':['health','healthregen-placeholder'],
  '기본 마나 재생':['mana','manaregen-placeholder'], '마나 재생':['mana','manaregen-placeholder'],
  '방어구 관통력':['armorpen','armorpen-placeholder'], '물리 관통력':['armorpen','armorpen-placeholder'], '마법 관통력':['ap','magicpen-placeholder'],
  '치명타 확률':['crit','crit-placeholder'], '치명타 피해량':['crit','crit-placeholder'], '치명타 피해':['crit','crit-placeholder'],
  '체력 회복 및 보호막':['healshield','healshield-placeholder'], '회복 및 보호막':['healshield','healshield-placeholder'],
  '공격 사거리':['range','range-placeholder'], '크기':['range','size-placeholder'], '궁극기 가속':['haste','haste'], '아이템 가속':['haste','haste'],
  '적응형 능력치':['adaptive','adaptive-placeholder'], '적응형':['adaptive','adaptive-placeholder'],
  '주문력':['ap','ap'], '공격력':['ad','ad'], '최대 체력':['health','health'], '체력':['health','health'],
  '방어력':['armor','armor'], '마법 저항력':['mr','mr'], '공격 속도':['speed','speed'], '스킬 가속':['haste','haste'], '이동 속도':['move','move'],
  '적중 시 효과':['onhit','onhit-placeholder'], '적중시 효과':['onhit','onhit-placeholder'], '마법 피해':['ap','ap'], '물리 피해':['ad','ad'], '고정 피해':['true','true-placeholder']
};
const keywordPattern = new RegExp(Object.keys(keywordStyles).sort((a,b)=>b.length-a.length).join('|'),'g');

function render(text,{escape:esc,icons:statIcons={},names=[]}) {
  const value=esc(text);
  const protectedRanges=[];
  for(const name of new Set(names.filter(Boolean))){
    const literal=esc(name);let index=value.indexOf(literal);
    while(index!==-1){protectedRanges.push([index,index+literal.length]);index=value.indexOf(literal,index+literal.length);}
  }
  return value.replace(keywordPattern,(word,offset)=>{
    if(protectedRanges.some(([start,end])=>offset>=start&&offset<end) || /[가-힣A-Za-z]/.test(value[offset-1]||''))return word;
    const [color,icon]=keywordStyles[word];
    const key=word.startsWith("치명타 피해")?"critdamage":(icon || color).replace("-placeholder","");
    const filename=statIcons[key];
    return `<span class="stat-keyword stat-${key}" style="--keyword-color:var(--stat-${key},var(--text));color:var(--keyword-color)">${filename?`<img src="imgs/stats/${esc(filename)}" alt="" aria-hidden="true">`:""}${word}</span>`;
  });
}

function matchesSearch(asset,kind,query,description=asset){
  const compact=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  const q=compact(query);
  if(!q)return true;
  const names=compact([asset.name,asset.nameEn,asset.apiName,asset.id,asset.icon].join(' '));
  if(names.includes(q))return true;
  if(!['items','augments'].includes(kind))return false;
  const text=compact([description?.stats,description?.effects,...(description?.levels||[])].join(' '));
  if(['적중시','적중시효과','onhit','on-hit'].includes(q))return /적중시효과|on-?hit/.test(text)||/<onhit\b/i.test(description?.descriptionHtml||'');
  if(['자동화','자동사용','자동시전','자동발사','autocast','auto-cast'].includes(q))return /자동화|자동(?:으로)?(?:사용|시전|발사)/.test(text);
  if(q==='충전')return text.includes('충전');
  return text.includes(q);
}

window.ArenaKeywordText={render,matchesSearch};
})();
