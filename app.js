const app = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let builds = [], catalog = {}, draft, pickKind, pickCore=true;
let itemTab = 'prismatic';
const itemTabNames = {prismatic:'프리즘',legendary:'전설',anvil:'모루',consumable:'소비'};
const augmentTabNames = {'0':'실버','1':'골드','2':'프리즘','4':'귀빈'};
const augmentOrder = ['2','1','0','4'];
const augmentTabEntries = () => augmentOrder.map(key=>[key,augmentTabNames[key]]);
const matchesGrade = (a,kind,grade) => kind==='items'?a.category===grade:kind==='augments'?String(a.rarity)===grade:true;
function renderItemTabs() {
  const tabs=document.querySelector('#item-tabs');
  tabs.hidden=pickKind==='champions';
  tabs.setAttribute('aria-label',pickKind==='augments'?'증강 등급':'아이템 등급');
  tabs.innerHTML=pickKind!=='champions'?(pickKind==='augments'?augmentTabEntries():Object.entries(itemTabNames)).map(([key,name])=>`<button type="button" role="tab" aria-selected="${key===itemTab}" tabindex="${key===itemTab?0:-1}" data-category="${key}">${name}</button>`).join(''):'';
  tabs.querySelectorAll('button').forEach((button,index)=>{
    button.onclick=()=>{itemTab=button.dataset.category;renderItemTabs();renderAssets();tabs.querySelector(`[data-category="${itemTab}"]`).focus();};
    button.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const all=[...tabs.querySelectorAll('button')];const next=event.key==='Home'?0:event.key==='End'?all.length-1:(index+(event.key==='ArrowLeft'?-1:1)+all.length)%all.length;all[next].click();}};
  });
}
const keywordStyles = {
  '자동 사용':['autocast','autocast'], '자동사용':['autocast','autocast'], '자동 시전':['autocast','autocast'], '자동 발사':['autocast','autocast'], '자동으로 사용':['autocast','autocast'], '자동으로 시전':['autocast','autocast'], '자동으로 발사':['autocast','autocast'],
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
let statIcons = {};
function richItemText(text) {
  const value=esc(text);
  const protectedRanges=[];
  for(const name of new Set([...itemDescriptions.values()].map(item=>item.name).filter(Boolean))){
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
function richItemEffects(item) {
  if(!item.descriptionHtml) return richItemText(item.effects || '별도 고유 효과가 없습니다.');
  const doc=new DOMParser().parseFromString(item.descriptionHtml,'text/html');
  const render=node=>{
    if(node.nodeType===3)return richItemText(node.textContent);
    if(node.nodeType!==1)return '';
    const tag=node.tagName.toLowerCase();
    if(['stats','script','style','iframe','img'].includes(tag))return '';
    if(tag==='br')return '\n';
    if(tag==='onhit')return `<span class="stat-keyword stat-onhit" style="--keyword-color:var(--stat-onhit,#ede665);color:var(--keyword-color)"><img src="imgs/stats/${esc(statIcons.onhit || 'onhit.svg')}" alt="" aria-hidden="true">${esc(node.textContent)}</span>`;
    if(tag.startsWith('rarity'))return esc(node.textContent);
    if(['passive','active'].includes(tag))return `<strong class="effect-name">${esc(node.textContent)}</strong>`;
    return [...node.childNodes].map(render).join('');
  };
  return [...doc.body.childNodes].map(render).join('').trim();
}
let itemDescriptions = new Map();
let iconColors = {stats:{},champions:{}};
let disposeItemTooltips = () => {};
let carouselObservers = [];
function clearCarousels() { disposeItemTooltips(); carouselObservers.forEach(observer=>observer.disconnect()); carouselObservers=[]; }
const image = (asset, cls = '') => `<img class="${cls}" src="${esc(asset.icon)}" alt="${esc(asset.name)}" loading="lazy">`;
const date = value => new Intl.DateTimeFormat('ko-KR', {year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function organizeItems(items) {
  const rank = {prismatic:0, legendary:1, anvil:2, consumable:3};
  const normalized = items.map(item => ({...item, category: item.category === 'exclusive' ? ([2142,2143,2144].includes(Number(item.id)) ? 'consumable' : 'legendary') : item.category}));
  // Prefer prismatic variants, then the original ID; retain source assets for existing builds.
  normalized.sort((a,b) => (rank[a.category] ?? 4)-(rank[b.category] ?? 4) || Number(a.id)-Number(b.id));
  const unique = new Map();
  for (const item of normalized) {
    const key = (item.nameKo || item.name).normalize('NFKC').trim();
    if (!unique.has(key)) unique.set(key,item);
  }
  return [...unique.values()].sort((a,b) => (rank[a.category] ?? 4)-(rank[b.category] ?? 4) || a.name.localeCompare(b.name,'ko'));
}
async function init() {
  try {
    const urls = ['data/builds/index.json','imgs/items/manifest.json','imgs/augments/manifest.json','imgs/champions/manifest.json','data/item-descriptions.ko.json','data/augment-descriptions.ko.json','data/icon-colors.json','data/stat-icons.json'];
    const data = await Promise.all(urls.map(async url => {const r = await fetch(url); if (!r.ok) throw Error(url); return r.json();}));
    builds = await Promise.all(data[0].map(async file=>{
      if(typeof file!=='string' || file.includes('/') || file.includes('\\') || !file.endsWith('.json'))throw Error('Invalid build filename');
      const response=await fetch('data/builds/'+encodeURIComponent(file));
      if(!response.ok)throw Error(file);
      return response.json();
    }));
    iconColors = data[6]; statIcons = data[7];
    Object.entries(iconColors.stats).forEach(([key,color])=>{if(/^[a-z]+$/.test(key) && /^#[0-9a-f]{6}$/i.test(color))document.documentElement.style.setProperty(`--stat-${key}`,color);});
    itemDescriptions = new Map([...data[4].items,...data[5].augments.map(item=>({...item,kind:'augment'}))].flatMap(item=>[item.icon,...(item.aliases || [])].map(icon=>[icon,item])));
    const currentItem = asset => {const entry=itemDescriptions.get(asset?.icon);return entry && !entry.kind ? {...asset,name:entry.name,icon:entry.icon}:asset;};
    builds = builds.map(build=>({...build,representative:currentItem(build.representative),items:(build.items || []).map(currentItem)}));
    ['items','augments','champions'].forEach((type,i) => catalog[type] = data[i+1].map(a => ({...a, icon:`imgs/${type}/${a.icon}`, name: (a.nameKo || a.name)})));
    catalog.items = organizeItems(catalog.items);
    catalog.augments.sort((a,b) => augmentOrder.indexOf(String(a.rarity))-augmentOrder.indexOf(String(b.rarity)) || a.name.localeCompare(b.name,'ko'));
    catalog.champions.sort((a,b) => Number(b.id === 'bravery') - Number(a.id === 'bravery') || a.name.localeCompare(b.name,'ko'));
    window.addEventListener('hashchange', route); route();
  } catch (error) { app.innerHTML = '<h1>보관함을 불러오지 못했습니다.</h1><p class="muted">로컬 서버 또는 GitHub Pages에서 열어 주세요. 데이터 파일과 네트워크 연결을 확인한 후 새로고침해 주세요.</p>'; console.error(error); }
}
function route() {
  const hash = location.hash || '#/';
  if (hash.startsWith('#/edit')) renderEditor(hash.split('/')[2]);
  else if (hash.startsWith('#/build/')) renderDetail(builds.find(b => b.id === decodeURIComponent(hash.slice(8))));
  else if (hash.startsWith('#/encyclopedia')) renderEncyclopedia();
  else renderHome();
  window.scrollTo(0,0);
}
const buildSearchState = {keyword:'',champion:''};
const normalizeSearch = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g,' ').trim();
function matchesBuildSearch(build, keyword, champion) {
  const championQuery=normalizeSearch(champion);
  if(championQuery && !(build.champions || []).some(c=>normalizeSearch(c.name).includes(championQuery)))return false;
  const text=normalizeSearch([build.title,build.description,build.equipmentDescription,build.cautions,build.championNote,...['items','augments','champions'].flatMap(kind=>(build[kind] || []).flatMap(a=>[a.name,a.note]))].join(' '));
  return normalizeSearch(keyword).split(' ').filter(Boolean).every(word=>text.includes(word));
}
function renderHome() {
  clearCarousels();
  document.title = '아레나 추천 빌드 정리 · 아레나농가';
  const sorted = [...builds].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  const champions=[...new Set(builds.flatMap(b=>(b.champions || []).map(c=>c.name)))].sort((a,b)=>Number(b==='용기')-Number(a==='용기')||a.localeCompare(b,'ko'));
  app.innerHTML = `<div class="intro"><div><h1>아레나 추천 빌드 정리</h1></div><div class="archive-count"><strong>${builds.length.toString().padStart(2,'0')}</strong> BUILDS</div></div><div class="build-search"><label>키워드 검색<input id="build-keyword" type="search" placeholder="빌드 이름, 설명, 아이템, 증강 검색" value="${esc(buildSearchState.keyword)}"></label><label>추천 챔피언<input id="build-champion" type="search" list="build-champion-options" placeholder="챔피언 이름 입력" value="${esc(buildSearchState.champion)}"><datalist id="build-champion-options">${champions.map(name=>`<option value="${esc(name)}"></option>`).join('')}</datalist></label><button type="button" id="reset-build-search">초기화</button></div><div class="section-bar"><b>추천 빌드 정리 <span id="build-result-count" role="status" aria-live="polite"></span></b><span>최근 추가순 ↓</span></div><div id="build-results" class="build-grid"></div><p id="build-search-empty" class="empty" hidden></p>`;
  const renderResults=()=>{
    const results=sorted.filter(b=>matchesBuildSearch(b,buildSearchState.keyword,buildSearchState.champion));
    document.querySelector('#build-result-count').textContent=`${results.length} / ${builds.length}개`;
    document.querySelector('#build-results').innerHTML=results.map(b=>`<a class="build-link" href="#/build/${encodeURIComponent(b.id)}" aria-label="${esc(b.title)}"><img src="${esc(b.representative.icon)}" alt=""><span class="tooltip">${esc(b.title)}</span></a>`).join('');
    document.querySelector('#build-results').hidden=!results.length;
    const empty=document.querySelector('#build-search-empty');empty.hidden=!!results.length;empty.textContent=builds.length?'검색 결과가 없습니다. 키워드나 추천 챔피언을 변경해 주세요.':'등록된 빌드가 없습니다.';
  };
  document.querySelector('#build-keyword').oninput=event=>{buildSearchState.keyword=event.target.value;renderResults();};
  document.querySelector('#build-champion').oninput=event=>{buildSearchState.champion=event.target.value;renderResults();};
  document.querySelector('#reset-build-search').onclick=()=>{buildSearchState.keyword='';buildSearchState.champion='';document.querySelector('#build-keyword').value='';document.querySelector('#build-champion').value='';renderResults();};
  renderResults();
}
function matchesAssetSearch(asset,kind,query){
  const compact=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  const q=compact(query);
  if(!q)return true;
  const names=compact([asset.name,asset.nameEn,asset.apiName,asset.id,asset.icon].join(' '));
  if(names.includes(q))return true;
  if(!['items','augments'].includes(kind))return false;
  const description=itemDescriptions.get(asset.icon);
  const text=compact([description?.stats,description?.effects,...(description?.levels||[])].join(' '));
  if(['적중시','적중시효과','onhit','on-hit'].includes(q))return /적중시효과|on-?hit/.test(text)||/<onhit\b/i.test(description?.descriptionHtml||'');
  if(['자동사용','자동시전','자동발사','autocast','auto-cast'].includes(q))return /자동(?:으로)?(?:사용|시전|발사)/.test(text);
  if(q==='충전')return text.includes('충전');
  return text.includes(q);
}
function renderEncyclopedia() {
  clearCarousels();
  document.title='아이템·증강 도감 · 아레나농가';
  let kind='items',grade='all';
  app.innerHTML=`<h1>아이템·증강 도감</h1><div class="encyclopedia-types"><button type="button" data-kind="items" aria-pressed="true">아이템</button><button type="button" data-kind="augments" aria-pressed="false">증강</button></div><label class="encyclopedia-search">이름 또는 ID 검색<input id="encyclopedia-search" type="search" placeholder="이름·키워드 검색: 적중시, 자동 사용, 충전, 주문력"></label><div id="encyclopedia-grades" class="item-tabs" aria-label="등급 필터"></div><p id="encyclopedia-count" class="muted" aria-live="polite"></p><div id="encyclopedia-list" class="encyclopedia-grid"></div>`;
  const renderList=()=>{
    disposeItemTooltips();
    const q=document.querySelector('#encyclopedia-search').value.trim().toLowerCase();
    const rows=catalog[kind].filter(a=>(grade==='all'||matchesGrade(a,kind,grade))&&matchesAssetSearch(a,kind,q));
    document.querySelector('#encyclopedia-count').textContent=`${rows.length}개`;
    document.querySelector('#encyclopedia-list').dataset.kind=kind;
    document.querySelector('#encyclopedia-list').innerHTML=rows.map(a=>`<button type="button" class="encyclopedia-entry item-info-trigger ${kind==='augments'?`encyclopedia-rarity-${a.rarity}`:a.category==='prismatic'?'encyclopedia-prismatic':''}" data-item-icon="${esc(a.icon)}" aria-label="${esc(a.name)} 설명">${image(a)}<strong>${esc(a.name)}</strong><small>${kind==='items'?itemTabNames[a.category]:augmentTabNames[a.rarity]}</small></button>`).join('')||'<p class="empty">검색 결과가 없습니다.</p>';
    setupItemTooltips();
  };
  const renderGrades=()=>{
    const labels=[['all','전체'],...(kind==='items'?Object.entries(itemTabNames):augmentTabEntries())];
    document.querySelector('#encyclopedia-grades').innerHTML=labels.map(([key,label])=>`<button type="button" data-grade="${key}" aria-pressed="${key===grade}">${label}</button>`).join('');
    document.querySelectorAll('[data-grade]').forEach(button=>button.onclick=()=>{grade=button.dataset.grade;renderGrades();renderList();document.querySelector(`[data-grade="${grade}"]`).focus();});
  };
  document.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>{kind=button.dataset.kind;grade='all';document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderGrades();renderList();});
  document.querySelector('#encyclopedia-search').oninput=renderList;
  renderGrades();renderList();
}
function gearCards(assets, augment=false) {
  const carousel = assets.length > 5;
  const label = augment ? '증강' : '아이템';
  return `<div class="gear-section">${carousel?`<div class="carousel-controls"><button type="button" data-direction="-1" aria-label="이전 ${label}">←</button><button type="button" data-direction="1" aria-label="다음 ${label}">→</button></div>`:''}<div class="cards ${augment?'augment':''} ${carousel?'carousel':''}" ${carousel?`tabindex="0" role="region" aria-label="${label} 목록, 좌우 방향키로 이동"`:''}>${assets.map(a => `<div class="gear ${!augment && a.icon.includes('/prismatic/')?'prismatic-gear':''}">${`<button type="button" class="item-info-trigger" data-item-icon="${esc(a.icon)}" aria-label="${esc(a.name)} ${augment?'증강':'아이템'} 설명">${image(a)}</button>`}<strong>${esc(a.name)}</strong>${a.note?`<span class="gear-note">${esc(a.note)}</span>`:''}</div>`).join('')}</div></div>`;
}
const augmentLevels = new Map();
function augmentMaxLevel(item) { return Math.max(1,item.levels?.length || 1); }
function augmentTooltip(item) {
  const max=augmentMaxLevel(item),level=Math.max(1,Math.min(max,augmentLevels.get(item.icon)||1));
  return `<div class="augment-description-heading">${image(item)}<strong>${esc(item.name)}</strong><span>${augmentTabNames[item.rarity] || '증강'}${item.removed?' · 삭제된 증강':''}</span></div><div class="item-description-effects">${richItemText(item.effects)}</div>${item.levels?.length?`<div class="augment-level-controls" aria-label="증강 레벨 조절"><button type="button" data-level-step="-1" aria-label="증강 레벨 감소" ${level<=1?'disabled':''}>−</button><strong aria-live="polite">증강 레벨 ${level} / ${max}</strong><button type="button" data-level-step="1" aria-label="증강 레벨 증가" ${level>=max?'disabled':''}>＋</button></div><div class="augment-level-effect item-description-effects" aria-live="polite">${richItemText(item.levels[level-1])}</div>`:'<p class="augment-level-hint">레벨별 강화 정보 없음</p>'}${item.iconPlaceholder?'<p class="augment-level-hint">등급별 임시 아이콘</p>':''}${item.wikiSource?'<a class="augment-source" href="https://wiki.leagueoflegends.com/en-us/Arena/Augments" target="_blank" rel="noopener noreferrer">수치 출처: LoL Wiki · CC BY-SA 3.0 ↗</a>':''}`;
}
function setupItemTooltips() {
  const box=document.createElement('div');
  box.id='item-description-tooltip'; box.className='item-description-tooltip'; box.role='tooltip'; box.hidden=true;
  document.body.append(box);
  let active=null, timer, pinned=false;
  const hide=()=>{pinned=false;clearTimeout(timer);active?.removeAttribute('aria-describedby');active=null;box.hidden=true;};
  const scheduleHide=()=>{if(!pinned)hide();};
  const position=()=>{
    if(!active)return;
    const rect=active.getBoundingClientRect();
    const width=box.offsetWidth, height=box.offsetHeight;
    const left=Math.max(12,Math.min(rect.right+12,innerWidth-width-12));
    const top=Math.max(12,Math.min(rect.top,innerHeight-height-12));
    box.style.left=`${left}px`;box.style.top=`${top}px`;
  };
  const show=button=>{
    clearTimeout(timer);active?.removeAttribute('aria-describedby');active=button;
    const item=itemDescriptions.get(button.dataset.itemIcon);
    const isAugment=item?.kind==='augment';
    box.className=`item-description-tooltip${isAugment?` augment-description rarity-${item.rarity}`:''}`;
    box.innerHTML=item?`<div class="item-description-title">${image(item)}<strong>${esc(item.name)}</strong></div>${item.stats?`<div class="item-description-stats">${richItemText(item.stats)}</div>`:''}<div class="item-description-effects">${richItemEffects(item)}</div>`:'<p>아이템 설명을 찾을 수 없습니다.</p>';
    if(isAugment) box.innerHTML=augmentTooltip(item);
    box.role=isAugment?'dialog':'tooltip';
    box.setAttribute('aria-label',item?`${item.name} 설명`:'아이템 설명');
    box.style.pointerEvents=pinned?'auto':'none';box.hidden=false;button.setAttribute('aria-describedby',box.id);position();
  };
  const changeLevel=step=>{
    const item=active && itemDescriptions.get(active.dataset.itemIcon);
    if(item?.kind!=='augment'||augmentMaxLevel(item)<=1)return false;
    const level=Math.max(1,Math.min(augmentMaxLevel(item),(augmentLevels.get(item.icon)||1)+step));
    clearTimeout(timer);
    augmentLevels.set(item.icon,level);
    box.querySelector('.augment-level-controls strong').textContent=`증강 레벨 ${level} / ${augmentMaxLevel(item)}`;
    box.querySelector('[data-level-step="-1"]').disabled=level<=1;
    box.querySelector('[data-level-step="1"]').disabled=level>=augmentMaxLevel(item);
    box.querySelector('.augment-level-effect').innerHTML=richItemText(item.levels[level-1]);
    return true;
  };
  document.querySelectorAll('.item-info-trigger').forEach(button=>{
    const hoverTarget=button.closest('.gear') || button;
    hoverTarget.addEventListener('mouseenter',()=>{if(!pinned)show(button);});
    hoverTarget.addEventListener('mouseleave',()=>{if(active===button&&!pinned)hide();});
    button.addEventListener('focus',()=>{if(!pinned)show(button);});
    button.addEventListener('blur',scheduleHide);
    button.addEventListener('click',()=>{if(pinned&&active===button){hide();return;}show(button);pinned=true;box.style.pointerEvents='auto';});
    button.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown'].includes(event.key)&&changeLevel(event.key==='ArrowUp'?1:-1)){event.preventDefault();event.stopPropagation();}});
  });
  box.addEventListener('click',event=>{const button=event.target.closest('[data-level-step]');if(!button)return;const step=Number(button.dataset.levelStep);changeLevel(step);const next=box.querySelector(`[data-level-step="${step}"]:not(:disabled)`) || box.querySelector('[data-level-step]:not(:disabled)');next?.focus();});
  box.addEventListener('focusin',()=>clearTimeout(timer));box.addEventListener('focusout',scheduleHide);
  box.addEventListener('pointerenter',()=>{if(!pinned)hide();});
  const trackPointer=event=>{
    if(!active||pinned||box.hidden||event.pointerType==='touch')return;
    const rect=(active.closest('.gear')||active).getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>=rect.right||event.clientY<rect.top||event.clientY>=rect.bottom)hide();
  };
  document.addEventListener('pointermove',trackPointer,true);
  const escape=event=>{if(event.key==='Escape')hide();};
  const outside=event=>{if(!box.contains(event.target)&&!event.target.closest('.item-info-trigger'))hide();};
  const scroll=event=>{if(!box.contains(event.target))hide();};
  document.addEventListener('keydown',escape);document.addEventListener('pointerdown',outside);
  window.addEventListener('resize',hide);document.addEventListener('scroll',scroll,true);
  disposeItemTooltips=()=>{hide();box.remove();document.removeEventListener('pointermove',trackPointer,true);document.removeEventListener('keydown',escape);document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',hide);document.removeEventListener('scroll',scroll,true);};
}
function setupCarousels() {
  document.querySelectorAll('.gear-section').forEach(section => {
    const track = section.querySelector('.carousel');
    if (!track) return;
    const buttons = section.querySelectorAll('[data-direction]');
    const update = () => {
      buttons[0].disabled = track.scrollLeft <= 1;
      buttons[1].disabled = track.scrollLeft >= track.scrollWidth-track.clientWidth-1;
    };
    const move = direction => track.scrollBy({left:direction*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    buttons.forEach(button => button.onclick=()=>move(Number(button.dataset.direction)));
    track.addEventListener('scroll',update,{passive:true});
    track.addEventListener('wheel',event=>{
      if (event.ctrlKey) return;
      const delta = Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
      const canMove = delta<0 ? track.scrollLeft>0 : track.scrollLeft<track.scrollWidth-track.clientWidth-1;
      if (!canMove) return;
      event.preventDefault();
      track.scrollLeft += delta*(event.deltaMode===1?20:event.deltaMode===2?track.clientWidth:1);
    },{passive:false});
    track.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}});
    const observer = new ResizeObserver(update);
    observer.observe(track);
    carouselObservers.push(observer);
    update();
  });
}
const buildParameters = [['carry','캐리력'],['luck','운'],['burden','통나무']];
function parameterBars(b, editable=false) {
  return `<div class="parameter-bars">${buildParameters.map(([key,label])=>{
    const value=Number.isInteger(b.parameters?.[key]) && b.parameters[key]>=1 && b.parameters[key]<=5?b.parameters[key]:0;
    return `<div class="parameter-row"><span id="parameter-${key}">${label}</span><div class="parameter-segments" role="group" aria-labelledby="parameter-${key}">${[1,2,3,4,5].map(n=>editable?`<button type="button" data-parameter="${key}" data-value="${n}" aria-label="${label} ${n}" aria-pressed="${value===n}" class="parameter-segment ${n<=value?'filled':''}">${n}</button>`:`<span class="parameter-segment ${n<=value?'filled':''}" aria-hidden="true">${n}</span>`).join('')}</div><span class="parameter-value">${value?`${value} / 5`:'미설정'}</span></div>`;
  }).join('')}</div>`;
}
function youtubeUrl(value) {
  try {const url=new URL(value);return url.protocol==='https:' && ['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(url.hostname) && !url.username && !url.password?url.href:'';} catch {return '';}
}
function videoLinks(b) {
  return (Array.isArray(b.youtubeUrls)?b.youtubeUrls:[b.youtubeUrl]).filter(value=>typeof value==='string' && value.trim()).map(value=>value.trim());
}
function renderVideoInputs(values) {
  document.querySelector('#video-inputs').innerHTML=values.map((value,i)=>`<div class="video-input-row"><input type="url" data-video-url aria-label="유튜브 영상 링크 ${i+1}" value="${esc(value)}" placeholder="https://www.youtube.com/watch?v=…"><button type="button" data-remove-video="${i}" aria-label="유튜브 영상 링크 ${i+1} 삭제">삭제</button></div>`).join('');
  document.querySelectorAll('[data-remove-video]').forEach(button=>button.onclick=()=>{
    const values=[...document.querySelectorAll('[data-video-url]')].map(input=>input.value);
    values.splice(Number(button.dataset.removeVideo),1);renderVideoInputs(values);syncFields();
  });
}
function buildDescription(b) {
  return `<div class="build-description">${[['핵심 매커니즘',b.description],['아이템/증강',b.equipmentDescription],['주의사항',b.cautions]].map(([title,body])=>`<section><h2>${title}</h2><p>${esc(body || '등록된 설명이 없습니다.')}</p></section>`).join('')}</div>${videoLinks(b).filter(url=>youtubeUrl(url)).map((url,i)=>`<a class="related-video" href="${esc(youtubeUrl(url))}" target="_blank" rel="noopener noreferrer">▶ 관련 유튜브 영상 ${i+1} 보기 ↗</a>`).join('')}`;
}
function renderDetail(b, preview=false) {
  clearCarousels();
  if (!b) {app.innerHTML='<h1>빌드를 찾을 수 없습니다.</h1><a class="button" href="#/">보관함으로</a>';return;}
  document.title = `${b.title} · 아레나농가`;
  app.innerHTML = `<a class="back" href="#/">← 추천 빌드 정리</a>${preview?'<div class="notice">작성 미리보기입니다. 아직 공개되지 않았습니다. <button id="resume">편집으로 돌아가기</button></div>':''}<article class="detail"><div><div class="detail-title"><h1>${esc(b.title)}</h1><div class="detail-meta"><span>${date(b.createdAt)} 등록</span>${!preview?`<a href="#/edit/${encodeURIComponent(b.id)}">빌드 편집 ↗</a>`:''}</div></div>${buildDescription(b)}<h2 class="section-heading">핵심 아이템</h2>${gearCards(b.items.filter(a=>a.core!==false))}${b.items.some(a=>a.core===false)?`<h2 class="section-heading">보조 아이템</h2>${gearCards(b.items.filter(a=>a.core===false))}`:''}<h2 class="section-heading">핵심 증강</h2>${gearCards(b.augments.filter(a=>a.core!==false),true)}${b.augments.some(a=>a.core===false)?`<h2 class="section-heading">보조 증강</h2>${gearCards(b.augments.filter(a=>a.core===false),true)}`:''}</div><aside class="champions">${parameterBars(b)}<h2>추천 챔피언</h2><p class="muted">${esc(b.championNote || '이 플랜과 함께할 챔피언')}</p>${b.champions.map(c=>`<div class="champion" style="--champion-accent:${/^#[0-9a-f]{6}$/i.test(iconColors.champions[c.icon] || '')?iconColors.champions[c.icon]:'#b7c8d9'}">${image(c)}<div><h3>${esc(c.name)}</h3><p>${esc(c.note)}</p></div></div>`).join('')}</aside></article>`;
  setupCarousels();
  setupItemTooltips();
  if (preview) document.querySelector('#resume').onclick=()=>renderEditor(null,true);
}
function renderEditor(id, keep=false) {
  clearCarousels();
  if (!keep) {
    const existing = builds.find(b=>b.id===decodeURIComponent(id || ''));
    draft = existing ? structuredClone(existing) : {id:crypto.randomUUID(),title:'',description:'',createdAt:new Date().toISOString(),items:[],augments:[],champions:[],championNote:'',representative:null};
  }
  document.title='빌드 작성 · 아레나농가';
  app.innerHTML=`<div class="editor"><a class="back" href="#/">← 추천 빌드 정리</a><h1>빌드 작성</h1><div class="notice">아이템과 증강을 추가한 뒤 대표 아이콘 하나를 선택하세요.<br>현재 작성한 빌드 하나를 JSON 파일로 저장할 수 있습니다. 이 화면의 변경은 다운로드 전까지 저장되지 않습니다.</div><form id="build-form"><div class="form-grid"><label class="wide">빌드 이름<input name="title" required maxlength="80" value="${esc(draft.title)}" placeholder="예: 반향 무한 CC"></label><div class="wide" id="editor-parameters">${parameterBars(draft,true)}</div><label class="wide">핵심 매커니즘<textarea name="description" required maxlength="4000">${esc(draft.description)}</textarea></label><label class="wide">아이템/증강<textarea name="equipmentDescription" maxlength="4000" placeholder="아이템과 증강의 조합 및 활용 방법">${esc(draft.equipmentDescription)}</textarea></label><label class="wide">주의사항<textarea name="cautions" maxlength="4000" placeholder="운용할 때 주의할 점">${esc(draft.cautions)}</textarea></label><div class="wide video-editor"><span>관련 유튜브 영상 (선택)</span><div id="video-inputs"></div><button type="button" id="add-video" class="small">＋ 영상 링크 추가</button><small>여러 영상 링크를 추가할 수 있습니다. 비워 두어도 됩니다.</small></div><label class="wide">추천 챔피언 설명<input name="championNote" value="${esc(draft.championNote)}" maxlength="180"></label></div>${[["items",true,"핵심 아이템"],["items",false,"보조 아이템"],["augments",true,"핵심 증강"],["augments",false,"보조 증강"],["champions",true,"추천 챔피언"]].map(([kind,core,label])=>`<h2 class="section-heading">${label}</h2><div id="rows-${kind}-${core}"></div><button type="button" data-add="${kind}" data-core="${core}" class="small">＋ ${label} 추가</button>`).join('')}<h2 class="section-heading">대표 아이콘 · 하나 선택</h2><div id="representative" class="representative"></div><p id="editor-error" role="alert"></p><div class="actions"><button type="submit" class="primary">파일로 저장 ↓</button><button type="button" id="preview">이미지로 공유 ↗</button></div></form></div>`;
  document.querySelectorAll('[data-add]').forEach(btn=>btn.onclick=()=>openPicker(btn.dataset.add,btn.dataset.core!=='false'));
  document.querySelector('#editor-parameters').onclick=e=>{
    const button=e.target.closest('[data-parameter]');if(!button)return;
    draft.parameters={...draft.parameters,[button.dataset.parameter]:Number(button.dataset.value)};
    document.querySelectorAll('[data-parameter]').forEach(segment=>{
      const value=draft.parameters[segment.dataset.parameter] || 0;
      segment.classList.toggle('filled',Number(segment.dataset.value)<=value);
      segment.setAttribute('aria-pressed',String(Number(segment.dataset.value)===value));
      segment.closest('.parameter-row').querySelector('.parameter-value').textContent=value?value+' / 5':'미설정';
    });
  };
  renderVideoInputs(videoLinks(draft));
  document.querySelector('#add-video').onclick=()=>{
    const values=[...document.querySelectorAll('[data-video-url]')].map(input=>input.value);
    renderVideoInputs([...values,'']);document.querySelector('#video-inputs .video-input-row:last-child input').focus();
  };
  document.querySelector('#build-form').oninput=syncFields;
  document.querySelector('#build-form').onsubmit=e=>{e.preventDefault();syncFields();if(!validDraft())return;const next=structuredClone(draft); const url=URL.createObjectURL(new Blob([JSON.stringify(next,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=String(draft.id).replace(/[^a-zA-Z0-9_-]/g,'_')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.querySelector('#editor-error').textContent='현재 빌드를 별도 JSON 파일로 저장했습니다.';};
  document.querySelector('#preview').onclick=()=>{syncFields();if(document.querySelector('form').reportValidity() && validDraft())exportBuildImage();};
  renderRows();
}
async function exportBuildImage(){
  const scrollPosition=window.scrollY;
  renderDetail(draft,true);
  const card=document.querySelector('article.detail').cloneNode(true);
  renderEditor(null,true);
  const button=document.querySelector('#preview');button.disabled=true;button.textContent='이미지 생성 중…';
  const stage=document.createElement('div');stage.style.cssText='position:absolute;left:-16000px;top:0;width:1280px;padding:40px;background:#252e38;color:#f0f2f4;';
  const heading=document.createElement('h2');heading.textContent='아레나농가';stage.append(heading,card);document.body.append(stage);
  card.style.gridTemplateColumns='minmax(0,1.8fr) minmax(280px,1fr)';
  card.querySelectorAll('.cards.carousel').forEach(el=>{el.classList.remove('carousel');el.style.display='grid';el.style.gridTemplateColumns='repeat(5,minmax(0,1fr))';});
  card.querySelectorAll('.carousel-controls').forEach(el=>el.remove());
  window.scrollTo(0,scrollPosition);
  try{
    await document.fonts.ready;
    await Promise.all([...card.querySelectorAll('img')].map(img=>{img.loading='eager';return img.decode();}));
    const canvas=await html2canvas(stage,{scale:2,backgroundColor:'#252e38',windowWidth:1440,logging:false});
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG conversion failed');
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=draft.title.replace(/[<>:"/\\|?*]/g,'_')+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    document.querySelector('#editor-error').textContent='공유용 PNG 이미지를 저장했습니다.';
  }catch(error){console.error(error);const status=document.querySelector('#editor-error');if(status)status.textContent='이미지 저장에 실패했습니다. 다시 시도해 주세요.';}
  finally{stage.remove();button.disabled=false;button.textContent='이미지로 공유 ↗';}
}
function syncFields(){const f=document.querySelector('#build-form');if(!f)return;['title','description','equipmentDescription','cautions','championNote'].forEach(k=>draft[k]=f.elements[k].value.trim());draft.youtubeUrls=[...f.querySelectorAll('[data-video-url]')].map(input=>input.value.trim()).filter(Boolean);delete draft.youtubeUrl;}
function validDraft(){const message=videoLinks(draft).some(url=>!youtubeUrl(url))?'https://로 시작하는 유튜브 링크를 입력해 주세요.':!draft.representative?'대표 아이콘을 선택해 주세요.':!draft.champions.length?'추천 챔피언을 한 명 이상 추가해 주세요.':'';document.querySelector('#editor-error').textContent=message;return !message;}
function renderRows(){
  [['items',true],['items',false],['augments',true],['augments',false],['champions',true]].forEach(([kind,core])=>{
    const target=document.querySelector(`#rows-${kind}-${core}`);
    target.innerHTML=draft[kind].map((a,i)=>({a,i})).filter(({a})=>kind==='champions'||(a.core!==false)===core).map(({a,i})=>`<div class="editor-row">${image(a)}${kind==='champions'?`<input type="text" aria-label="표시 이름" maxlength="80" data-field="name" data-index="${i}" value="${esc(a.name)}">`:`<strong class="editor-asset-name">${esc(a.name)}</strong>`}${kind==='champions'?`<input type="text" aria-label="챔피언 간단한 설명" data-field="note" data-index="${i}" value="${esc(a.note)}" placeholder="간단한 설명">`:`<input type="text" maxlength="80" aria-label="${esc(a.name)} 소제목 설명" data-field="note" data-index="${i}" value="${esc(a.note)}" placeholder="소제목 설명 (선택)">`}<button class="remove" type="button" data-remove="${i}" aria-label="${esc(a.name)} 삭제">✕</button></div>`).join('');
    target.querySelectorAll('[data-field]').forEach(el=>el.oninput=()=>{draft[kind][el.dataset.index][el.dataset.field]=el.value;renderRepresentative();});
    target.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{const [removed]=draft[kind].splice(Number(el.dataset.remove),1);if(draft.representative?.icon===removed.icon)draft.representative=null;renderRows();});
  });renderRepresentative();
}
function renderRepresentative(){const assets=[...draft.items,...draft.augments];document.querySelector('#representative').innerHTML=assets.length?assets.map((a,i)=>`<button type="button" data-rep="${i}" aria-label="${esc(a.name)} 대표 아이콘으로 선택" aria-pressed="${draft.representative?.icon===a.icon}" class="${draft.representative?.icon===a.icon?'selected':''}">${image(a)}</button>`).join(''):'<p class="muted">아이템 또는 증강을 먼저 추가하세요.</p>';document.querySelectorAll('[data-rep]').forEach(btn=>btn.onclick=()=>{draft.representative={...assets[btn.dataset.rep]};renderRepresentative();});}
function openPicker(kind,core=true){document.querySelector('#asset-search').placeholder=kind==='champions'?'한글·영문 이름 또는 ID 검색':'이름 또는 키워드: 적중시, 자동 사용, 충전, 주문력';pickKind=kind;pickCore=core;itemTab=kind==='augments'?'2':'prismatic';renderItemTabs();document.querySelector('#asset-search').value='';renderAssets();document.querySelector('#picker').showModal();document.querySelector('#asset-search').focus();}
function renderAssets(){const q=document.querySelector('#asset-search').value.toLowerCase();const list=catalog[pickKind].filter(a=>matchesGrade(a,pickKind,itemTab)).filter(a=>matchesAssetSearch(a,pickKind,q));document.querySelector('#asset-results').innerHTML=list.map(a=>`<button type="button" data-asset="${a.id}">${image(a)}<span>${esc(a.name)}</span></button>`).join('')||'<p>검색 결과가 없습니다.</p>';document.querySelectorAll('[data-asset]').forEach(btn=>btn.onclick=()=>{const a=catalog[pickKind].find(a=>String(a.id)===btn.dataset.asset);const existing=draft[pickKind].find(x=>x.icon===a.icon);if(existing && pickKind!=='champions')existing.core=pickCore;if(!existing)draft[pickKind].push({name:a.name,icon:a.icon,...(pickKind==='champions'?{note:''}:{core:pickCore})});document.querySelector('#picker').close();renderRows();});}
document.querySelector('#asset-search').oninput=renderAssets;
document.querySelector('#close-picker').onclick=()=>document.querySelector('#picker').close();
init();
