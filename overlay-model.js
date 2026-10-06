/* Shared rendering rules for the editor, PNG export and OBS output. */
window.ArenaOverlay={
 layout(settings,assets=[]){const columns=this.columns(settings),rows=Math.ceil(6/columns),font=Number(settings.nameFont??settings.font),levelFont=Number(settings.levelFont??Number(settings.font)*.85),gap=Number(settings.gap),padding=Number(settings.paddingY??settings.padding),icon=Number(settings.icon);const rowHeight=Math.ceil(Math.max(icon,font*1.3*2,levelFont*1.2+22)+padding*2+Number(settings.borderWidth??2)*2),gridHeight=rows*rowHeight+(rows-1)*gap,height=Number(settings.highlightWidth??1)*2+gridHeight+(settings.heading?Math.ceil(Number(settings.font)*1.2)+12:0);return {columns,rows,rowHeight,gridHeight,height};},
 layoutStyle(settings,assets=[]){const m=this.layout(settings,assets);return `height:${m.height}px;--name-auto-shrink:${settings.autoShrink?1:0};--border-width:${Number(settings.borderWidth??2)}px;--outer-padding:${Number(settings.highlightWidth??1)}px;--name-display:${settings.textWrap===false?'block':'-webkit-box'};--name-whitespace:${settings.textWrap===false?'nowrap':'normal'};--padding-x:${Number(settings.paddingX??settings.padding)}px;--padding-y:${Number(settings.paddingY??settings.padding)}px;--name-font:${Number(settings.nameFont??settings.font)}px;--level-font:${Number(settings.levelFont??Number(settings.font)*.85)}px;--slot-height:${m.rowHeight}px;--grid-height:${m.gridHeight}px;--heading-height:${Math.ceil(Number(settings.font)*1.2)}px;`;},
 fitText(root){
  for(const name of root.querySelectorAll('.overlay-name')){
   name.style.removeProperty('font-size');
   const style=getComputedStyle(name);
   if(style.getPropertyValue('--name-auto-shrink').trim()!=='1'||!name.clientWidth)continue;
   const base=parseFloat(style.fontSize),lines=style.whiteSpace==='nowrap'?1:2;
   const display=name.style.display,maxHeight=name.style.maxHeight,clamp=name.style.webkitLineClamp;
   name.style.display='block';name.style.maxHeight='none';name.style.webkitLineClamp='unset';
   const fits=()=>{const lineHeight=parseFloat(getComputedStyle(name).lineHeight);return name.scrollWidth<=name.clientWidth+1&&name.scrollHeight<=lineHeight*lines+1;};
   if(!fits()){let low=1,high=base;for(let i=0;i<12;i++){const size=(low+high)/2;name.style.fontSize=`${size}px`;if(fits())low=size;else high=size;}name.style.fontSize=`${Math.floor(low*10)/10}px`;}
   name.style.display=display;name.style.maxHeight=maxHeight;name.style.webkitLineClamp=clamp;
  }
 },
 async capture(root,options={}){
  this.fitText(root);
  const origin=root.getBoundingClientRect(),scale=options.scale??1;
  const cards=[...(root.matches?.('.description-export-card')?[root]:[]),...root.querySelectorAll('.overlay-card')];
  const edges=cards.map(el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el),rarity=[0,1,2,4].find(n=>el.classList.contains('rarity-'+n));return {x:r.left-origin.left,y:r.top-origin.top,w:r.width,h:r.height,radius:parseFloat(style.borderTopLeftRadius)||9,border:parseFloat(style.borderTopWidth)||0,rarity,color:style.getPropertyValue('--grade').trim()||({0:'#c5d1df',1:'#e7bd55',2:'#c4a8ff',4:'#ee986e'}[rarity]),background:style.getPropertyValue(el.matches('.description-export-card')?'--description-bg':'--card-bg').trim()||'rgba(10,16,25,.8)'};});
  const canvas=await html2canvas(root,{...options,onclone:doc=>{doc.querySelectorAll('.overlay-card,.description-export-card').forEach(el=>{el.style.setProperty('background','transparent','important');el.style.setProperty('background-image','none','important');el.style.setProperty('border-color','transparent','important');el.style.setProperty('box-shadow','none','important');});options.onclone?.(doc);}});
  const ctx=canvas.getContext('2d');ctx.save();ctx.setTransform(scale,0,0,scale,0,0);
  ctx.globalCompositeOperation='destination-over';
  edges.forEach(r=>{ctx.fillStyle=r.background;ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,r.radius);ctx.fill();});
  ctx.globalCompositeOperation='source-over';
  edges.forEach(r=>{if(!r.border)return;let color=r.color;if(r.rarity===2){color=ctx.createLinearGradient(r.x,r.y,r.x+r.w,r.y+r.h);[[0,'#87e7f2'],[.38,'#bba8ff'],[.72,'#f3b8e4'],[1,'#9ddfea']].forEach(([stop,value])=>color.addColorStop(stop,value));}ctx.strokeStyle=color;ctx.lineWidth=r.border;ctx.beginPath();ctx.roundRect(r.x+r.border/2,r.y+r.border/2,Math.max(0,r.w-r.border),Math.max(0,r.h-r.border),Math.max(0,r.radius-r.border/2));ctx.stroke();});
  ctx.restore();return canvas;
 },
 decorate(root){this.fitText(root);const cards=[...(root.matches?.('.description-export-card.rarity-2')?[root]:[]),...root.querySelectorAll('.overlay-card.rarity-2')];cards.forEach(card=>{const w=card.offsetWidth,h=card.offsetHeight,border=parseFloat(getComputedStyle(card).borderTopWidth)||0,r=Math.max(0,(card.classList.contains('description-export-card')?12:9)-border/2);const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#87e7f2"/><stop offset=".38" stop-color="#bba8ff"/><stop offset=".72" stop-color="#f3b8e4"/><stop offset="1" stop-color="#9ddfea"/></linearGradient></defs><rect x="${border/2}" y="${border/2}" width="${Math.max(0,w-border)}" height="${Math.max(0,h-border)}" rx="${r}" fill="none" stroke="url(#p)" stroke-width="${border}"/></svg>`;card.style.setProperty('--prism-border',`url("data:image/svg+xml,${encodeURIComponent(svg)}")`);});},
 maxLevel(asset){return Math.max(1,Number(asset?.maxLevel)||asset?.levels?.length||1);},
 level(slot,asset){return Math.max(1,Math.min(this.maxLevel(asset),Math.round(Number(slot.level)||1)));},
 columns(settings){return [1,2,3,6].includes(Number(settings.columns))?Number(settings.columns):1;},
 card(slot,asset,escape,colors){const level=this.level(slot,asset),max=this.maxLevel(asset),isMax=level===max;return `<div class="overlay-card rarity-${asset.rarity}${isMax?' is-max':''}" style="--grade:${colors[asset.rarity]}"><img src="${escape(asset.icon)}" alt=""><span class="overlay-name" title="${escape(asset.nameKo||asset.name)}">${escape(asset.nameKo||asset.name)}</span><span class="overlay-level">Lv. ${level}${isMax?'<span class="overlay-max">MAX</span>':''}</span></div>`;}
};
