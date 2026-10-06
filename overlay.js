const $ = selector => document.querySelector(selector);
const realtimeMode=document.body.dataset.overlayMode==='realtime';
const overlayStorageKey=realtimeMode?'arena-overlay-realtime-v1':'arena-overlay-edit-v1';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors = {0:'#c5d1df',1:'#e7bd55',2:'#c4a8ff'};
const grades = {0:'실버',1:'골드',2:'프리즘'};
const defaults = {columns:1,width:480,minWidth:220,icon:48,font:20,gap:8,padding:10,paddingX:10,paddingY:10,nameFont:20,levelFont:17,borderWidth:2,highlightWidth:1,opacity:80,scale:2,heading:true,textWrap:true,autoShrink:false};
const limits = {width:[280,3840],minWidth:[120,800],icon:[24,128],font:[12,48],gap:[0,64],padding:[0,48],paddingX:[0,48],paddingY:[0,48],nameFont:[12,48],levelFont:[10,48],borderWidth:[0,32],highlightWidth:[1,32],opacity:[0,100]};
let settings={...defaults}, slots=Array.from({length:6},()=>({id:null,level:1,active:true})), catalog=[], selectedSlot=0;
try { const saved=JSON.parse(localStorage.getItem(overlayStorageKey)||localStorage.getItem('arena-overlay-v1')); if(saved){Object.keys(defaults).forEach(key=>{if((key==='heading'||key==='textWrap'||key==='autoShrink'))settings[key]=key==='autoShrink'?saved.settings?.[key]===true:saved.settings?.[key]!==false;else if(key==='columns'||key==='scale'){const n=Number(saved.settings?.[key] ?? (key==='paddingX'||key==='paddingY'?saved.settings?.padding:key==='nameFont'?saved.settings?.font:key==='levelFont'&&saved.settings?.font!=null?Number(saved.settings.font)*.85:undefined));if((key==='columns'?[1,2,3,6]:[1,2]).includes(n))settings[key]=n;}else{const n=Number(saved.settings?.[key]);if(Number.isFinite(n))settings[key]=Math.max(limits[key][0],Math.min(limits[key][1],Math.round(n)));}});slots=slots.map((slot,i)=>({...slot,id:saved.slots?.[i]?.id??null,level:Math.max(1,Math.min(99,Math.round(Number(saved.slots?.[i]?.level)||1))),active:true}));}} catch {}
if(!realtimeMode)settings.scale=1;
let liveSyncTimer, liveSyncBusy=false, liveSyncPending=false;
async function syncLive(){
 if(!realtimeMode)return;
 if(liveSyncBusy){liveSyncPending=true;return;}
 liveSyncBusy=true;
 try{const response=await fetch('/api/overlay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings,slots})});if(!response.ok)throw Error('Live server unavailable');$('#live-status').textContent='실시간 연결됨 · OBS에 자동 반영';}
 catch{$('#live-status').textContent='실시간 연결 대기 · npm start로 로컬 서버를 실행하세요. PNG 저장은 계속 사용할 수 있습니다.';}
 finally{liveSyncBusy=false;if(liveSyncPending){liveSyncPending=false;syncLive();}}
}
function persist(){try{localStorage.setItem(overlayStorageKey,JSON.stringify({settings,slots}));}catch{$('#status').textContent='브라우저 저장이 제한되어 자동 저장할 수 없습니다.';}if(realtimeMode){clearTimeout(liveSyncTimer);liveSyncTimer=setTimeout(syncLive,80);}}
setInterval(()=>{if(catalog.length)syncLive();},5000);
function overlayFileName(extension){const value=document.querySelector('#overlay-filename')?.value||'arena-overlay';const base=value.replace(/\.(mov|png|rofl)$/i,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').trim().slice(0,150)||'arena-overlay';return base+'.'+extension;}
function activeRows(){return slots.filter(s=>catalog.some(a=>String(a.id)===String(s.id)));}
function renderPreview(){
 slots.forEach(slot=>slot.active=true);
 const node=$('#overlay-canvas');node.style.cssText=`width:${settings.width}px;font-size:${settings.font}px;--columns:${ArenaOverlay.columns(settings)};--icon:${settings.icon}px;--gap:${settings.gap}px;--padding:${settings.padding}px;--card-bg:rgba(10,16,25,${settings.opacity/100})`;
 node.style.cssText+=ArenaOverlay.layoutStyle(settings,catalog);const rows=activeRows();node.innerHTML=rows.length?`${settings.heading?'<div class="overlay-title">현재 활성화된 증강</div>':''}<div class="overlay-grid">${rows.map(s=>ArenaOverlay.card(s,catalog.find(a=>String(a.id)===String(s.id)),escapeHTML,colors)).join('')}</div>`:'<div class="overlay-empty">증강을 선택하세요.</div>';
 ArenaOverlay.decorate(node);
 $('#count').textContent=`${rows.length} / 6`;$('#export').disabled=!rows.length;$('#opacity-value').textContent=`${100-settings.opacity}%`;
 $('#dimensions').textContent=`${settings.width} × ${node.offsetHeight}px${realtimeMode?'':` · PNG ${settings.scale}배`}`;persist();window.onOverlayStateChange?.();
}
function renderSlots(){
 $('#slots').innerHTML=slots.map((s,i)=>{const a=catalog.find(a=>String(a.id)===String(s.id));return `<div class="overlay-slot"><button class="choose" data-choose="${i}">${a?`<img src="${escapeHTML(a.icon)}" alt=""><span>${escapeHTML(a.name)}</span>`:`<span>${i+1}번 슬롯 · 증강 선택</span>`}</button><input type="number" data-level="${i}" min="1" max="99" value="${s.level}" aria-label="${i+1}번 증강 레벨"><button class="clear" data-clear="${i}" aria-label="${i+1}번 슬롯 비우기">✕</button></div>`;}).join('');
 $('[data-choose]');$('#slots').querySelectorAll('[data-choose]').forEach(b=>b.onclick=()=>{selectedSlot=Number(b.dataset.choose);$('#search').value='';renderPicker();$('#overlay-picker').showModal();$('#search').focus();});
 $('#slots').querySelectorAll('[data-level]').forEach(el=>{const slot=slots[el.dataset.level],asset=catalog.find(a=>String(a.id)===String(slot.id));el.max=ArenaOverlay.maxLevel(asset);el.disabled=!asset;el.title=`최대 레벨 ${el.max}`;slot.level=ArenaOverlay.level(slot,asset);el.value=slot.level;el.oninput=()=>{slot.level=ArenaOverlay.level({level:el.value},asset);el.value=slot.level;renderPreview();};});
 $('#slots').querySelectorAll('[data-clear]').forEach(el=>el.onclick=()=>{slots[el.dataset.clear]={id:null,level:1,active:true};renderSlots();renderPreview();});
}
function isAugmentSelectedElsewhere(id){return slots.some((slot,index)=>index!==selectedSlot&&slot.id!=null&&String(slot.id)===String(id));}
function renderPicker(){const q=$('#search').value.trim().toLowerCase(),grade=$('#grade').value;const rows=catalog.filter(a=>(grade==='all'||String(a.rarity)===grade)&&ArenaKeywordText.matchesSearch(a,'augments',q,a));$('#results').innerHTML=rows.map(a=>`<button data-id="${a.id}" style="--grade:${colors[a.rarity]}" ${isAugmentSelectedElsewhere(a.id)?'disabled title="다른 칸에서 이미 선택한 증강입니다."':''}><img src="${escapeHTML(a.icon)}" alt="" loading="lazy"><span>${escapeHTML(a.name)}</span><small>${grades[a.rarity]}${isAugmentSelectedElsewhere(a.id)?' · 선택됨':''}${a.removed?' · 삭제됨':''}</small></button>`).join('')||'<p>검색 결과가 없습니다.</p>';$('#results').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(isAugmentSelectedElsewhere(b.dataset.id))return;slots[selectedSlot]={id:b.dataset.id,level:1,active:true};$('#overlay-picker').close();renderSlots();renderPreview();});}
$('#search').oninput=renderPicker;$('#grade').onchange=renderPicker;$('#picker-close').onclick=()=>$('#overlay-picker').close();
const overlayPicker=document.querySelector('#overlay-picker');
let pickerPointerOutside=false;
const outsidePicker=event=>{const bounds=overlayPicker.getBoundingClientRect();return event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom;};
overlayPicker.addEventListener('pointerdown',event=>{pickerPointerOutside=event.target===overlayPicker&&outsidePicker(event);});
overlayPicker.addEventListener('click',event=>{if(pickerPointerOutside&&event.target===overlayPicker&&outsidePicker(event))overlayPicker.close();pickerPointerOutside=false;});
$('#settings').querySelectorAll('[data-setting]').forEach(el=>{
 const key=el.dataset.setting;if((key==='heading'||key==='textWrap'||key==='autoShrink'))el.checked=settings[key];else el.value=key==='opacity'?100-settings[key]:settings[key];
 const commit=()=>{if((key==='heading'||key==='textWrap'||key==='autoShrink'))settings[key]=el.checked;else{const n=el.value.trim()===''?settings[key]:Number(el.value);if(!Number.isFinite(n)){el.value=settings[key];return;}settings[key]=key==='opacity'?100-Math.round(n):Math.round(n);if(limits[key])settings[key]=Math.max(limits[key][0],Math.min(limits[key][1],settings[key]));el.value=key==='opacity'?100-settings[key]:settings[key];}renderPreview();};
 if(el.type==='number'){el.addEventListener('input',()=>{const n=Number(el.value);if(el.value.trim()===''||!Number.isFinite(n)||limits[key]&&(n<limits[key][0]||n>limits[key][1]))return;settings[key]=Math.round(n);renderPreview();});el.addEventListener('change',commit);el.addEventListener('blur',commit);el.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();el.blur();}});}else el.addEventListener(el.tagName==='SELECT'?'change':'input',commit);
});
$('#export').onclick=async()=>{
 const button=$('#export');button.disabled=true;$('#status').textContent='PNG 생성 중…';const stage=$('#overlay-canvas').cloneNode(true);stage.removeAttribute('id');stage.style.position='absolute';stage.style.left='-16000px';stage.style.top='0';document.body.append(stage);
 try {await document.fonts.ready;await Promise.all([...stage.querySelectorAll('img')].map(img=>img.decode()));const canvas=await ArenaOverlay.capture(stage,{backgroundColor:null,scale:settings.scale,logging:false,windowWidth:Math.max(1440,settings.width)});const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG 생성 실패');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=overlayFileName('png');link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#status').textContent=`투명 PNG 저장 완료 · ${canvas.width} × ${canvas.height}px`;}
 catch(error){console.error(error);$('#status').textContent='PNG 저장에 실패했습니다. 이미지 소스와 로컬 서버 연결을 확인해 주세요.';}
 finally{stage.remove();button.disabled=!activeRows().length;}
};
(async()=>{try{const responses=await Promise.all([fetch('imgs/augments/manifest.json'),fetch('data/augment-descriptions.ko.json')]);if(responses.some(r=>!r.ok))throw Error('증강 데이터 로드 실패');const [assets,descriptions]=await Promise.all(responses.map(r=>r.json()));const details=new Map(descriptions.augments.map(a=>[String(a.id),a]));catalog=assets.filter(a=>[0,1,2].includes(Number(a.rarity))).map(a=>({...a,...details.get(String(a.id)),maxLevel:ArenaOverlay.maxLevel(details.get(String(a.id))),name:a.nameKo||a.name,icon:`imgs/augments/${a.icon}`})).sort((a,b)=>Number(b.rarity)-Number(a.rarity)||a.name.localeCompare(b.name,'ko'));renderSlots();renderPreview();}catch(error){$('#status').textContent='증강 데이터를 불러오지 못했습니다. 로컬 서버 또는 사이트 주소로 열어 주세요.';console.error(error);}})();
