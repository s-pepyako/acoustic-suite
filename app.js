import {defaults,validate} from './model.js';
import {moveRectangle,resizeRectangle,corners,clamp} from './geometry.js';
import {RenderController} from './render-controller.js';
const $=id=>document.getElementById(id),colors=['#a0e7be','#e9bb7a','#c7a2f6'],names=['Left speaker','Right speaker','Subwoofer'];let state=defaults(),result=null,drag=null,selected=-1,box=null;
try{const saved=localStorage.getItem('acoustic-suite-v1');if(saved)state=validate(JSON.parse(saved));}catch{}
const status=s=>$('status').textContent=s;
function save(){try{localStorage.setItem('acoustic-suite-v1',JSON.stringify(state));}catch{$('saveStatus').textContent='Browser saving unavailable — export your project';}}
const renderer=new RenderController({
 createWorker:()=>new Worker(new URL('./worker.js',import.meta.url),{type:'module'}),
 onBusy:busy=>{$('run').disabled=busy;$('cancel').hidden=!busy;},onStatus:status,
 onError:message=>{status(message);$('empty').hidden=false;$('empty').textContent=message;},
 onResult:(field,stage,project)=>{result=field;$('empty').hidden=true;const warn=field.samplesPerWavelength<10?' | Coarse grid: use finer detail.':'';status(project.frequency+' Hz | '+field.nx+' x '+field.ny+' cells | '+(stage==='preview'?'Preview - refining shortly':'Refined')+warn);draw();}
});
function dirty(){
 $('empty').hidden=false;$('empty').textContent=$('live').checked?'Updating field...':'Settings changed - calculate field';
 save();draw();renderer.change(state);
}
const num=(label,key,value,min,max,step='.05')=>`<label>${label}<input data-key="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${Number(value.toFixed(3))}"></label>`;
function filter(s,type){return `<div class="filter">${num(type.toUpperCase()+'  /  Hz',type,s[type],10,20000,1)}<label>Butterworth slope<select data-key="${type}Order">${[0,1,2,4].map(o=>`<option value="${o}" ${s[type+'Order']===o?'selected':''}>${o?o*6+' dB/oct':'Off'}</option>`).join('')}</select></label></div>`;}
function render(){
 for(const k of ['width','depth','frequency','q','detail'])$(k).value=state[k];$('frequencyLabel').textContent=state.frequency+' Hz';
 $('sources').innerHTML=state.sources.map((s,i)=>`<div class="source" data-source="${i}"><div class="sourceTitle"><span class="dot" style="--source:${colors[i]}"></span><label><input type="checkbox" data-key="enabled" ${s.enabled?'checked':''}> ${names[i]}</label></div><div class="pair">${num('X  /  m','x',s.x,0,state.width)}${num('Y  /  m','y',s.y,0,state.depth)}</div><div class="pair">${num('Level  /  dB','gain',s.gain,-40,20,.5)}${i===2?num('Delay  /  ms','delay',s.delay,0,100,.1):''}</div>${filter(s,'hp')}${filter(s,'lp')}</div>`).join('');
 $('obstacles').innerHTML=state.obstacles.map((o,i)=>`<div class="obstacle" data-obstacle="${i}"><div class="obstacleTitle">Rectangle ${i+1}<button data-delete="${i}" aria-label="Remove rectangle ${i+1}">×</button></div><div class="pair">${num('X  /  m','x',o.x,0,state.width)}${num('Y  /  m','y',o.y,0,state.depth)}</div><div class="pair">${num('Width  /  m','w',o.w,.05,state.width)}${num('Depth  /  m','h',o.h,.05,state.depth)}</div></div>`).join('');
 draw();
}
function edit(e,kind,silent=false){const key=e.target.dataset.key;if(!key)return;if(silent&&e.target.value==='')return;const parent=e.target.closest(kind==='sources'?'[data-source]':'[data-obstacle]'),i=Number(parent.dataset[kind==='sources'?'source':'obstacle']),old=structuredClone(state);state[kind][i][key]=e.target.type==='checkbox'?e.target.checked:Number(e.target.value);try{validate(state);dirty();}catch(error){state=old;if(!silent){render();status(error.message);}}}
 $('sources').addEventListener('input',e=>edit(e,'sources',true));$('obstacles').addEventListener('input',e=>edit(e,'obstacles',true));$('sources').addEventListener('change',e=>edit(e,'sources'));$('obstacles').addEventListener('change',e=>edit(e,'obstacles'));
 $('obstacles').addEventListener('click',e=>{if(e.target.dataset.delete!==undefined){state.obstacles.splice(Number(e.target.dataset.delete),1);selected=-1;dirty();render();}});
 for(const k of ['width','depth','q','detail'])$(k).addEventListener('change',()=>{const old=structuredClone(state);state[k]=Number($(k).value);if(k==='width'||k==='depth'){state.sources.forEach(s=>{s.x=Math.min(s.x,state.width);s.y=Math.min(s.y,state.depth);});}try{validate(state);dirty();render();}catch(e){state=old;render();status(e.message);}});
 $('frequency').addEventListener('input',()=>{state.frequency=Number($('frequency').value);$('frequencyLabel').textContent=state.frequency+' Hz';dirty();});
 $('addObstacle').onclick=()=>{if(state.obstacles.length>=20){status('Maximum 20 rectangles.');return;}state.obstacles.push({x:Number((state.width*.4).toFixed(2)),y:Number((state.depth*.4).toFixed(2)),w:Number((state.width*.2).toFixed(2)),h:Number((state.depth*.15).toFixed(2))});selected=state.obstacles.length-1;dirty();render();};
 $('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='acoustic-suite-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('Project file is too large.');state=validate(JSON.parse(await file.text()));dirty();render();status('Project imported. Calculate to update the field.');}catch(err){status('Import failed: '+err.message);}e.target.value='';};
 $('live').onchange=()=>{renderer.setLive($('live').checked,state);try{localStorage.setItem('acoustic-suite-live',String($('live').checked));}catch{}if(!$('live').checked)status('Live rendering off');};
 $('cancel').onclick=()=>{renderer.stop();renderer.live=false;$('live').checked=false;try{localStorage.setItem('acoustic-suite-live','false');}catch{}status('Calculation cancelled - live rendering off');};
 $('run').onclick=()=>renderer.manual(state);
 const canvas=$('field'),ctx=canvas.getContext('2d');
 function palette(t){const stops=[[16,45,134],[0,165,230],[66,201,133],[230,202,80],[237,76,64]],v=Math.max(0,Math.min(1,t))*4,i=Math.min(3,Math.floor(v)),u=v-i;return stops[i].map((a,k)=>Math.round(a+(stops[i+1][k]-a)*u));}
 function draw(){if(!ctx)return;const dpr=window.devicePixelRatio||1,w=canvas.clientWidth,height=canvas.clientHeight;canvas.width=w*dpr;canvas.height=height*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,height);const scale=Math.min((w-90)/state.width,(height-100)/state.depth);box={x:(w-state.width*scale)/2,y:(height-state.depth*scale)/2,w:state.width*scale,h:state.depth*scale,scale};
 const b=box;ctx.fillStyle='#14242b';ctx.fillRect(b.x,b.y,b.w,b.h);
 if(result){const off=document.createElement('canvas');off.width=result.nx;off.height=result.ny;const oc=off.getContext('2d'),pixels=oc.createImageData(result.nx,result.ny);for(let y=0;y<result.ny;y++)for(let x=0;x<result.nx;x++){const i=y*result.nx+x,j=((result.ny-1-y)*result.nx+x)*4,db=20*Math.log10(Math.max(1e-20,result.amplitude[i])/Math.max(1e-20,result.peak)),rgb=result.solid[i]?[48,58,62]:palette((db+36)/36);pixels.data.set([...rgb,255],j);}oc.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(off,b.x,b.y,b.w,b.h);}
 ctx.lineWidth=1;ctx.strokeStyle='#ffffff14';for(let x=0;x<=state.width;x++){ctx.beginPath();ctx.moveTo(b.x+x*scale,b.y);ctx.lineTo(b.x+x*scale,b.y+b.h);ctx.stroke();}for(let y=0;y<=state.depth;y++){ctx.beginPath();ctx.moveTo(b.x,b.y+b.h-y*scale);ctx.lineTo(b.x+b.w,b.y+b.h-y*scale);ctx.stroke();}
 for(const [i,o]of state.obstacles.entries()){const x=b.x+o.x*scale,y=b.y+b.h-(o.y+o.h)*scale;ctx.fillStyle='#303a3e';ctx.fillRect(x,y,o.w*scale,o.h*scale);ctx.strokeStyle='#c0cbd0';ctx.strokeRect(x,y,o.w*scale,o.h*scale);ctx.fillStyle='#d1dadd';ctx.font='11px Segoe UI';ctx.fillText(String(i+1),x+5,y+15);if(i===selected){ctx.strokeStyle='#9fe2bc';ctx.lineWidth=2;ctx.strokeRect(x,y,o.w*scale,o.h*scale);for(const [,cx,cy]of corners(o)){ctx.fillStyle='#9fe2bc';ctx.fillRect(b.x+cx*scale-5,b.y+b.h-cy*scale-5,10,10);ctx.strokeStyle='#10201d';ctx.strokeRect(b.x+cx*scale-5,b.y+b.h-cy*scale-5,10,10);}}}
 ctx.strokeStyle='#a9bbc1';ctx.lineWidth=1.5;ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.fillStyle='#9bb0b8';ctx.font='12px Segoe UI';ctx.textAlign='center';ctx.fillText(`${state.width} m`,w/2,b.y+b.h+25);ctx.save();ctx.translate(b.x-22,height/2);ctx.rotate(-Math.PI/2);ctx.fillText(`${state.depth} m`,0,0);ctx.restore();ctx.textAlign='left';ctx.fillText('(0, 0)',b.x,b.y+b.h+44);
 state.sources.forEach((s,i)=>{const x=b.x+s.x*scale,y=b.y+b.h-s.y*scale;ctx.globalAlpha=s.enabled?1:.35;ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.fillStyle=colors[i];ctx.fill();ctx.strokeStyle='#101719';ctx.lineWidth=2;ctx.stroke();ctx.textAlign='center';ctx.fillStyle='#10201d';ctx.font='bold 11px Segoe UI';ctx.fillText(['L','R','S'][i],x,y+4);ctx.globalAlpha=1;});ctx.textAlign='left';
 }
 function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left-box.x)/box.scale,y:(box.y+box.h-e.clientY+r.top)/box.scale};}
 function hit(p){
  if(selected>=0&&state.obstacles[selected])for(const [corner,x,y]of corners(state.obstacles[selected]))if(Math.hypot(p.x-x,p.y-y)*box.scale<13)return {kind:'resize',i:selected,corner};
  const source=state.sources.findIndex(s=>Math.hypot(s.x-p.x,s.y-p.y)*box.scale<18);if(source>=0)return {kind:'source',i:source};
  for(let i=state.obstacles.length-1;i>=0;i--){const o=state.obstacles[i];if(p.x>=o.x&&p.x<=o.x+o.w&&p.y>=o.y&&p.y<=o.y+o.h)return {kind:'obstacle',i};}return null;
 }
 function syncInputs(){
  document.querySelectorAll('[data-source]').forEach(el=>{const source=state.sources[Number(el.dataset.source)];for(const key of ['x','y'])el.querySelector('[data-key="'+key+'"]').value=source[key].toFixed(2);});
  document.querySelectorAll('[data-obstacle]').forEach(el=>{const o=state.obstacles[Number(el.dataset.obstacle)];if(o)for(const key of ['x','y','w','h'])el.querySelector('[data-key="'+key+'"]').value=o[key].toFixed(2);});
 }
 canvas.onpointerdown=e=>{const p=point(e),target=hit(p);selected=target&&target.kind!=='source'?target.i:-1;drag=target?{...target,start:p,original:structuredClone(target.kind==='source'?state.sources[target.i]:state.obstacles[target.i])}:null;if(drag){canvas.setPointerCapture(e.pointerId);canvas.style.cursor=drag.kind==='resize'?'nwse-resize':'grabbing';}draw();};
 canvas.onpointermove=e=>{const p=point(e);if(!drag){const target=hit(p);canvas.style.cursor=target?(target.kind==='resize'?(target.corner==='ne'||target.corner==='sw'?'nesw-resize':'nwse-resize'):'grab'):'default';return;}
  const dx=p.x-drag.start.x,dy=p.y-drag.start.y;
  if(drag.kind==='source'){state.sources[drag.i].x=clamp(drag.original.x+dx,0,state.width);state.sources[drag.i].y=clamp(drag.original.y+dy,0,state.depth);}
  else state.obstacles[drag.i]=drag.kind==='resize'?resizeRectangle(drag.original,drag.corner,dx,dy,state.width,state.depth):moveRectangle(drag.original,dx,dy,state.width,state.depth);
  syncInputs();dirty();
 };
 const release=()=>{if(drag){drag=null;canvas.style.cursor='default';syncInputs();save();draw();}};
 canvas.onpointerup=release;canvas.onpointercancel=release;canvas.onlostpointercapture=release;
 new ResizeObserver(draw).observe(canvas);render();save();
 try{$('live').checked=localStorage.getItem('acoustic-suite-live')!=='false';}catch{$('live').checked=true;}
 renderer.setLive($('live').checked,state);
