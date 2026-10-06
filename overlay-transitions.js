window.ArenaOverlayTransitions={
 envelope(elapsed,duration){return Math.max(0,Math.min(1,elapsed/.15,(duration-elapsed)/.25));},
 animate(previousFrame,canvas,previous,current,rects,changes,progress,levelHighlights=null,borderWidth=1,duration=0.8,colors={}){
  const palette={added:'#92ffbf',upgraded:'#fff3a3',removed:'#ffb1d0',max:'#fff3a3'};Object.keys(palette).forEach(key=>{if(/^#[0-9a-f]{6}$/i.test(colors[key]))palette[key]=colors[key];});
  borderWidth=Math.max(1,Math.min(32,Number(borderWidth)||1));
  const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;const ctx=output.getContext('2d');ctx.drawImage(canvas,0,0);rects.forEach(r=>ctx.clearRect(r.x,r.y,r.width,r.height));
  const elapsed=progress*duration,highlight=this.envelope(elapsed,duration);
  const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);},move=ease((elapsed-(duration-.15))/.15),available=previous.map((r,index)=>({...r,index}));
  const glow=(r,color,alpha=1)=>{ctx.save();ctx.strokeStyle=color;ctx.lineWidth=.5;ctx.shadowBlur=0;const steps=Math.max(2,borderWidth*2);for(let step=0;step<steps;step++){const distance=(step+.5)*borderWidth/steps;ctx.globalAlpha=alpha*Math.pow(1-distance/borderWidth,2);ctx.lineWidth=borderWidth/steps;ctx.beginPath();ctx.roundRect(r.x-distance,r.y-distance,r.width+distance*2,r.height+distance*2,9+distance);ctx.stroke();}ctx.restore();};
  current.forEach((row,index)=>{const target=rects[index],match=available.findIndex(old=>String(old.id)===String(row.id));let old=null;if(match>=0)old=available.splice(match,1)[0];const origin=old&&previousFrame?.rects[old.index]||target;const position={x:origin.x+(target.x-origin.x)*move,y:origin.y+(target.y-origin.y)*move,width:origin.width+(target.width-origin.width)*move,height:origin.height+(target.height-origin.height)*move};ctx.save();ctx.globalAlpha=old?1:ease(elapsed/.15);ctx.drawImage(canvas,target.x,target.y,target.width,target.height,position.x,position.y,position.width,position.height);ctx.restore();if(changes.added.includes(index)||changes.upgraded.includes(index))glow(position,changes.added.includes(index)?palette.added:row.level>=row.maxLevel?palette.max:palette.upgraded,changes.added.includes(index)?this.envelope(elapsed-.15,Math.max(0,duration-.15)):highlight);if(levelHighlights&&changes.upgraded.includes(index)){const l=target.levelRect;if(l){const dx=position.x-target.x,dy=position.y-target.y;ctx.save();ctx.globalAlpha=highlight;ctx.beginPath();ctx.rect(position.x,position.y,position.width,position.height);ctx.clip();ctx.drawImage(levelHighlights,l.x-8,l.y-8,l.width+16,l.height+16,l.x+dx-8,l.y+dy-8,l.width+16,l.height+16);ctx.restore();}}});
  if(previousFrame)changes.removed.forEach(row=>{const r=previousFrame.rects[row.index];if(!r)return;const alpha=1-ease((elapsed-(duration-.4))/.25);if(alpha<=0)return;ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(previousFrame.canvas,r.x,r.y,r.width,r.height,r.x,r.y,r.width,r.height);ctx.restore();glow(r,palette.removed,alpha*highlight);});
  return output;
 },
 changes(previous,current){
  const remaining=previous.map((row,index)=>({...row,index})),added=[],upgraded=[];
  current.forEach((row,index)=>{const match=remaining.findIndex(old=>String(old.id)===String(row.id));if(match<0){added.push(index);return;}const [old]=remaining.splice(match,1);if(row.level>old.level)upgraded.push(index);});
  return {added,upgraded,removed:remaining};
 },
 paint(canvas,rects,changes){const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;const ctx=output.getContext('2d');ctx.drawImage(canvas,0,0);
  const mark=(index,color,label)=>{const r=rects[index];if(!r)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=4;ctx.shadowColor=color;ctx.shadowBlur=12;ctx.strokeRect(r.x+3,r.y+3,Math.max(0,r.width-6),Math.max(0,r.height-6));ctx.shadowBlur=0;ctx.font='bold 13px "Malgun Gothic",sans-serif';const w=ctx.measureText(label).width+14;ctx.fillStyle=color;ctx.fillRect(r.x+r.width-w-5,r.y+3,w,21);ctx.fillStyle='#081018';ctx.fillText(label,r.x+r.width-w+2,r.y+18);ctx.restore();};
  changes.added.forEach(index=>mark(index,'#92ffbf','추가'));changes.upgraded.forEach(index=>mark(index,'#fff3a3','레벨업'));
  if(changes.removed.length){ctx.save();ctx.font='bold 14px "Malgun Gothic",sans-serif';const text='제거: '+changes.removed.map(row=>row.name).join(' · '),w=Math.min(canvas.width,ctx.measureText(text).width+24),y=Math.max(0,canvas.height-30);ctx.fillStyle='#2d101de8';ctx.fillRect(0,y,w,30);ctx.strokeStyle='#ff99b1';ctx.lineWidth=2;ctx.strokeRect(1,y+1,w-2,28);ctx.fillStyle='#ffbdcd';ctx.fillText(text,12,y+20,Math.max(1,w-24));ctx.restore();}
  return output;
 }
};
