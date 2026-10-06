document.querySelector('#timeline-export').textContent='투명 MOV 영상 생성';
const videoHelp=timelinePanel.querySelector('#timeline-export').previousElementSibling;
const transitionControls=document.createElement('div');transitionControls.className='form-grid';transitionControls.innerHTML='<label class="overlay-check"><input id="transition-enabled" type="checkbox" checked>증강 변화 강조 표시</label><label>강조 시간 (초)<input id="transition-duration" type="number" min="0.4" max="3" step="0.1" value="0.8"></label><label>강조 테두리 두께 (px)<input id="transition-width" type="number" min="1" max="32" value="1"></label><label>추가 강조 색상<input id="transition-color-added" type="color" value="#92ffbf"></label><label>레벨업 강조 색상<input id="transition-color-upgraded" type="color" value="#fff3a3"></label><label>최대 레벨 강조 색상<input id="transition-color-max" type="color" value="#fff3a3"></label><label>제거 강조 색상<input id="transition-color-removed" type="color" value="#ffb1d0"></label><p class="wide muted">추가: 외곽 광선 · 레벨업: 외곽 광선과 레벨 텍스트 발광 · 최대 레벨 도달: MAX 발광 · 제거: 외곽 광선 → 페이드아웃 → 남은 증강 위치 이동. 페이드 인 0.15초·아웃 0.25초는 고정되며, 강조 시간을 늘리면 최대 강도 유지 시간이 늘어납니다. 변경이 없는 증강은 그대로 표시합니다.</p>';videoHelp.before(transitionControls);
videoHelp.textContent='배경이 투명한 MOV로 저장합니다. 완성된 영상을 원본 위 트랙에 00:00부터 올리면 라운드 시간이 자동으로 맞춰집니다. PNG와 MOV는 미리보기와 동일한 크기로 출력하며 위치는 편집 프로그램에서 조절하세요. 로컬 서버가 필요하며 인코딩 중에는 이 화면을 열어 두세요.';
document.querySelector('#round-times').value=rounds.map(r=>r.time).join('\n');
const videoFields=['overlay-filename','timeline-end','timeline-fps','transition-duration','transition-color-added','transition-color-upgraded','transition-color-max','transition-color-removed'];
try{const saved=JSON.parse(localStorage.getItem('arena-video-settings-v1'));if(saved)videoFields.forEach(id=>{if(saved[id]!=null)document.getElementById(id).value=saved[id];});}catch{}
const highlightWidthInput=document.querySelector('#transition-width');highlightWidthInput.value=settings.highlightWidth;highlightWidthInput.addEventListener('change',()=>{settings.highlightWidth=Math.max(1,Math.min(32,Math.round(Number(highlightWidthInput.value)||1)));highlightWidthInput.value=settings.highlightWidth;renderPreview();});
videoFields.forEach(id=>document.getElementById(id).addEventListener('change',()=>{try{localStorage.setItem('arena-video-settings-v1',JSON.stringify(Object.fromEntries(videoFields.map(key=>[key,document.getElementById(key).value]))));}catch{}}));
document.querySelector('#timeline-export').onclick=async()=>{
 const button=document.querySelector('#timeline-export'),status=document.querySelector('#timeline-status');button.disabled=true;const filename=overlayFileName('mov');
 const stage=document.createElement('div');
 try{
  if(!catalog.length)throw Error('증강 데이터 로드를 기다려 주세요.');if(!rounds.length)throw Error('라운드 시작 시간을 먼저 입력하세요.');
  const fps=Number(document.querySelector('#timeline-fps').value),width=settings.width,height=ArenaOverlay.layout(settings,catalog).height;
  if(![24,30,60].includes(fps)||![width,height].every(Number.isInteger)||width<280||width>3840||height<1||height>8192)throw Error('소스 크기를 유효한 정수로 입력하세요.');
  const total=Math.round(timeSeconds(document.querySelector('#timeline-end').value)*fps),starts=rounds.map(r=>Math.round(timeSeconds(r.time)*fps));if(total>fps*14400)throw Error('영상은 최대 4시간까지 지원합니다.');if(starts.some((s,i)=>s>=total||(i&&s<=starts[i-1])))throw Error('프레임 단위 시작 시간은 오름차순이며 영상 종료보다 빨라야 합니다.');
  const states=rounds.map((r,i)=>({slots:r.slots,frames:(starts[i+1]??total)-starts[i]}));if(starts[0]>0)states.unshift({slots:[],frames:starts[0]});
  stage.style.cssText=`position:absolute;left:-16000px;top:0;width:${width}px;height:${height}px;background:transparent;overflow:hidden`;document.body.append(stage);await document.fonts.ready;
  const segments=[];let previous=[],previousFrame=null;const transitionEnabled=document.querySelector('#transition-enabled').checked,transitionDuration=Number(document.querySelector('#transition-duration').value),transitionWidth=settings.highlightWidth,transitionColors=Object.fromEntries(['added','upgraded','max','removed'].map(key=>[key,document.querySelector('#transition-color-'+key).value]));if(transitionEnabled&&(!Number.isFinite(transitionDuration)||transitionDuration<0.4||transitionDuration>3))throw Error('강조 시간은 0.4~3초로 입력하세요.');
  for(let i=0;i<states.length;i++){
   status.textContent=`증강 화면 준비 ${i+1} / ${states.length}…`;const card=document.createElement('div');card.className='overlay-canvas';card.style.cssText=`position:absolute;left:0;top:0;width:${width}px;font-size:${settings.font}px;--columns:${ArenaOverlay.columns({...settings,width})};--icon:${settings.icon}px;--gap:${settings.gap}px;--padding:${settings.padding}px;--card-bg:rgba(10,16,25,${settings.opacity/100})`;
   card.style.cssText+=ArenaOverlay.layoutStyle({...settings,width},catalog);const active=states[i].slots.map(s=>({s,a:catalog.find(a=>String(a.id)===String(s.id))})).filter(r=>r.a);
   card.innerHTML=active.length?`${settings.heading?'<div class="overlay-title">현재 활성화된 증강</div>':''}<div class="overlay-grid">${active.map(r=>ArenaOverlay.card(r.s,r.a,escapeHTML,colors)).join('')}</div>`:'';
   stage.replaceChildren(card);ArenaOverlay.decorate(card);await Promise.all([...card.querySelectorAll('img')].map(img=>img.decode()));if(active.length&&(card.offsetHeight>height))throw Error(`${i+1}번째 화면이 소스 높이를 초과합니다. 소스 높이를 늘리거나 글자 크기·간격을 줄이세요.`);
   const bounds=stage.getBoundingClientRect(),rects=[...card.querySelectorAll('.overlay-card')].map(el=>{const r=el.getBoundingClientRect(),l=el.querySelector('.overlay-level').getBoundingClientRect();return {x:r.left-bounds.left,y:r.top-bounds.top,width:r.width,height:r.height,levelRect:{x:l.left-bounds.left,y:l.top-bounds.top,width:l.width,height:l.height}};});
   const current=active.map(({s,a})=>({id:a.id,name:a.name,level:ArenaOverlay.level(s,a),maxLevel:ArenaOverlay.maxLevel(a)})),changes=ArenaOverlayTransitions.changes(previous,current);
   const canvas=await ArenaOverlay.capture(stage,{backgroundColor:null,scale:1,logging:false,windowWidth:Math.max(width,1440)});
   let levelHighlights=null;
   if(transitionEnabled&&changes.upgraded.length){
    const highlightStage=stage.cloneNode(true);highlightStage.classList.add('level-highlight-export');highlightStage.style.setProperty('--upgrade-highlight',transitionColors.upgraded);highlightStage.style.setProperty('--max-highlight',transitionColors.max);
    [...highlightStage.querySelectorAll('.overlay-card')].forEach((el,index)=>{if(!changes.upgraded.includes(index))el.style.visibility='hidden';});
    document.body.append(highlightStage);
    try{levelHighlights=await html2canvas(highlightStage,{backgroundColor:null,scale:1,logging:false,windowWidth:Math.max(width,1440)});}finally{highlightStage.remove();}
   }
   const hasChanges=changes.added.length||changes.upgraded.length||changes.removed.length;
   const effectFrames=transitionEnabled&&hasChanges?Math.min(states[i].frames,Math.max(1,Math.round(transitionDuration*fps))):0;
   if(effectFrames){const images=[];for(let frame=0;frame<effectFrames;frame++){images.push(ArenaOverlayTransitions.animate(previousFrame,canvas,previous,current,rects,changes,effectFrames===1?1:frame/(effectFrames-1),levelHighlights,transitionWidth,(effectFrames-1)/fps,transitionColors).toDataURL('image/png').split(',')[1]);if(frame%10===0)await new Promise(resolve=>setTimeout(resolve,0));}segments.push({frames:effectFrames,images});}
   if(states[i].frames>effectFrames)segments.push({frames:states[i].frames-effectFrames,png:canvas.toDataURL('image/png').split(',')[1]});previous=current;previousFrame={canvas,rects};
  }
  stage.remove();status.textContent='투명 MOV 영상 인코딩 시작…';
  const response=await fetch('/api/overlay/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fps,width,height,editor:'premiere',codec:'qtrle',segments})});if(!response.ok){let message='영상 서버에 연결할 수 없습니다. npm start로 로컬 서버를 실행하세요.';try{message=(await response.json()).error||message;}catch{}throw Error(message);}const {id}=await response.json();
  while(true){await new Promise(resolve=>setTimeout(resolve,1500));const progress=await fetch(`/api/overlay/render/${id}`,{cache:'no-store'});if(!progress.ok)throw Error('인코딩 서버가 재시작되거나 연결이 끊겼습니다. 다시 생성하세요.');const job=await progress.json();if(job.state==='failed')throw Error(job.error);status.textContent=`투명 MOV 인코딩 ${job.progress}% · 완료되면 다운로드됩니다.`;if(job.state==='complete'){const link=document.createElement('a');link.href=`/api/overlay/render/${id}/file?filename=${encodeURIComponent(filename)}`;link.download=filename;link.click();status.textContent='투명 MOV 생성 완료 · 원본 영상 위에 00:00부터 배치하세요.';break;}}
 }catch(e){status.textContent=e.message;console.error(e);}finally{stage.remove();button.disabled=false;}
};

const videoSettingsPanel=document.createElement('section');
videoSettingsPanel.className='overlay-video-settings';
videoSettingsPanel.setAttribute('aria-label','영상 시간 및 출력 설정');
const videoSettingsHeading=document.createElement('h2');videoSettingsHeading.textContent='영상 시간 및 출력 설정';videoSettingsPanel.append(videoSettingsHeading);
const videoSettingsStart=document.querySelector('#timeline-end').closest('.form-grid');
while(videoSettingsStart.nextSibling)videoSettingsPanel.append(videoSettingsStart.nextSibling);
videoSettingsPanel.insertBefore(videoSettingsStart,videoSettingsHeading.nextSibling);
document.querySelector('.overlay-preview-panel').append(videoSettingsPanel);
