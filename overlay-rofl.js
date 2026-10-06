const replayImport=document.createElement('div');
replayImport.innerHTML='<label>리플레이 파일 (.rofl)<input id="replay-upload" type="file" accept=".rofl"></label><p class="muted">16.19 리플레이의 시간을 추정하여 입력합니다. 귀빈 투표 이후의 일반 준비 시간을 사용합니다. 증강 상태는 직접 편집하세요.</p><button id="replay-import">리플레이에서 시간 입력</button><p id="replay-status" role="status"></p>';
timelinePanel.querySelector('#round-times').closest('label').before(replayImport);
document.querySelector('#replay-upload').addEventListener('change',()=>{const file=document.querySelector('#replay-upload').files[0];if(!file||!file.name.toLowerCase().endsWith('.rofl'))return;const input=document.querySelector('#overlay-filename');input.value=file.name.replace(/\.rofl$/i,'');input.dispatchEvent(new Event('change',{bubbles:true}));});
function replayTime(seconds){const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
document.querySelector('#replay-import').onclick=async()=>{
 const button=document.querySelector('#replay-import'),status=document.querySelector('#replay-status');button.disabled=true;
 try{
  const file=document.querySelector('#replay-upload').files[0];
  if(!file||!file.name.toLowerCase().endsWith('.rofl'))throw Error('ROFL 파일을 선택하세요.');
  if(file.size>64*1024*1024)throw Error('파일은 최대 64MB까지 지원합니다.');
  status.textContent='리플레이 시간을 분석하는 중…';
  const response=await fetch('/api/overlay/replay-rounds',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('리플레이 시간 추출은 로컬 서버에서 사용하세요.');
  const result=await response.json();if(!response.ok)throw Error(result.error||'리플레이 분석 실패');
  const next=result.rounds.map((r,i)=>({time:replayTime(r.preparationSeconds),combatTransition:replayTime(r.combatTransitionSeconds),guestOfHonor:r.guestOfHonor,timeSource:'rofl-inferred',shardbladePercent:rounds[i]?.shardbladePercent||0,slots:structuredClone(rounds[i]?.slots||slots)}));
  rounds=next;selectedRound=0;saveRounds();if(catalog.length)selectRound(0);else renderRoundList();
  document.querySelector('#round-times').value=rounds.map(r=>r.time).join('\n');const endInput=document.querySelector('#timeline-end');endInput.value=replayTime(result.duration+1);endInput.dispatchEvent(new Event('change',{bubbles:true}));
  status.textContent=`${file.name} · ${rounds.length}라운드 시간 입력 완료 (추정값). 일반 준비 시간부터 오버레이가 표시됩니다. 전투 전환 시간은 별도로 저장됩니다.`;
 }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
};
