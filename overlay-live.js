const liveNode=document.querySelector('#live-overlay');
const liveEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const liveColors={0:'#c5d1df',1:'#e7bd55',2:'#c4a8ff'};
const liveNumber=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Math.round(Number(value)))):fallback;
let liveCatalog=[],latestState=null;
function renderLive(){
 if(!latestState || !liveCatalog.length){liveNode.innerHTML='';return;}
 const s=latestState.settings||{};
 const columns=ArenaOverlay.columns({...s,width:liveNumber(s.width,280,3840,480),gap:liveNumber(s.gap,0,64,8),icon:liveNumber(s.icon,24,128,48),font:liveNumber(s.font,12,48,20),padding:liveNumber(s.padding,0,48,10),minWidth:liveNumber(s.minWidth,120,800,220)});
 liveNode.style.cssText=`width:${liveNumber(s.width,280,3840,480)}px;font-size:${liveNumber(s.font,12,48,20)}px;--columns:${columns};--icon:${liveNumber(s.icon,24,128,48)}px;--gap:${liveNumber(s.gap,0,64,8)}px;--padding:${liveNumber(s.padding,0,48,10)}px;--card-bg:rgba(10,16,25,${liveNumber(s.opacity,0,100,80)/100})`;
 liveNode.style.cssText+=ArenaOverlay.layoutStyle({...s,width:liveNumber(s.width,280,3840,480),font:liveNumber(s.font,12,48,20),icon:liveNumber(s.icon,24,128,48),gap:liveNumber(s.gap,0,64,8),padding:liveNumber(s.padding,0,48,10)},liveCatalog);const rows=(latestState.slots||[]).slice(0,6).map(slot=>({slot,asset:liveCatalog.find(a=>String(a.id)===String(slot.id))})).filter(row=>row.asset);
 liveNode.innerHTML=rows.length?`${s.heading?'<div class="overlay-title">현재 활성화된 증강</div>':''}<div class="overlay-grid">${rows.map(({slot,asset:a})=>ArenaOverlay.card(slot,a,liveEscape,liveColors)).join('')}</div>`:'';ArenaOverlay.decorate(liveNode);
}
async function loadLiveCatalog(){try{const responses=await Promise.all([fetch('imgs/augments/manifest.json'),fetch('data/augment-descriptions.ko.json')]);if(responses.some(r=>!r.ok))throw Error('Catalog unavailable');const [assets,descriptions]=await Promise.all(responses.map(r=>r.json()));const details=new Map(descriptions.augments.map(a=>[String(a.id),a]));liveCatalog=assets.filter(a=>[0,1,2].includes(Number(a.rarity))).map(a=>({...a,icon:`imgs/augments/${a.icon}`,maxLevel:ArenaOverlay.maxLevel(details.get(String(a.id)))}));renderLive();}catch{setTimeout(loadLiveCatalog,3000);}}
loadLiveCatalog();
const liveEvents=new EventSource('/api/overlay/events');
liveEvents.onmessage=event=>{try{latestState=JSON.parse(event.data);renderLive();}catch{}};
