export const defaults=()=>({version:1,width:5.15,depth:4.9,frequency:65,q:20,detail:96,sources:[{name:'Left',enabled:true,x:1,y:4,gain:0,delay:0,hp:80,hpOrder:2,lp:20000,lpOrder:0},{name:'Right',enabled:true,x:4.15,y:4,gain:0,delay:0,hp:80,hpOrder:2,lp:20000,lpOrder:0},{name:'Sub',enabled:true,x:.65,y:4.3,gain:0,delay:0,hp:20,hpOrder:2,lp:80,lpOrder:2}],obstacles:[]});
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validate(p){
 if(!p||p.version!==1||!finite(p.width,1,20)||!finite(p.depth,1,20)||!finite(p.frequency,20,300)||!finite(p.q,2,60)||![64,96,144].includes(p.detail)||!Array.isArray(p.sources)||p.sources.length!==3||!Array.isArray(p.obstacles)||p.obstacles.length>20)throw Error('Invalid project dimensions or settings.');
 p.sources.forEach(s=>{if(!s||typeof s.enabled!=='boolean'||!finite(s.x,0,p.width)||!finite(s.y,0,p.depth)||!finite(s.gain,-40,20)||!finite(s.delay,0,100)||!finite(s.hp,10,20000)||!finite(s.lp,10,20000)||![0,1,2,4].includes(s.hpOrder)||![0,1,2,4].includes(s.lpOrder))throw Error('Invalid source settings.');});
 p.obstacles.forEach(o=>{if(!o||!finite(o.x,0,p.width)||!finite(o.y,0,p.depth)||!finite(o.w,.05,p.width)||!finite(o.h,.05,p.depth)||o.x+o.w>p.width+1e-8||o.y+o.h>p.depth+1e-8)throw Error('Obstacle must fit inside the room.');});return p;
}
const mul=([a,b],[c,d])=>[a*c-b*d,a*d+b*c];
export function filterResponse(f,cutoff,order,type){
 if(!order)return [1,0];const r=f/cutoff;let h=[1,0];
 const divide=(num,[a,b])=>mul(num,[a/(a*a+b*b),-b/(a*a+b*b)]);
 if(order===1)return divide(type==='hp'?[0,r]:[1,0],[1,r]);
 for(let k=0;k<order/2;k++){const q=1/(2*Math.cos((2*k+1)*Math.PI/(2*order)));h=mul(h,divide(type==='hp'?[-r*r,0]:[1,0],[1-r*r,r/q]));}return h;
}
export function sourceResponse(s,f){let h=mul(filterResponse(f,s.hp,s.hpOrder,'hp'),filterResponse(f,s.lp,s.lpOrder,'lp'));const phase=-2*Math.PI*f*s.delay/1000;return mul(h,[10**(s.gain/20)*Math.cos(phase),10**(s.gain/20)*Math.sin(phase)]);}
export function simulate(p,progress=()=>{}){
 validate(p);const c=343,h=Math.max(p.width,p.depth)/p.detail,nx=Math.ceil(p.width/h),ny=Math.ceil(p.depth/h),dx=p.width/nx,dy=p.depth/ny,n=nx*ny;
 const dt=.92/(c*Math.sqrt(1/dx**2+1/dy**2)),omega=2*Math.PI*p.frequency,alpha=omega/(2*p.q),loss=alpha*dt,ax=(c*dt/dx)**2,ay=(c*dt/dy)**2;
 const solid=new Uint8Array(n);for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){if(p.obstacles.some(o=>(x+.5)*dx>=o.x&&(x+.5)*dx<=o.x+o.w&&(y+.5)*dy>=o.y&&(y+.5)*dy<=o.y+o.h))solid[y*nx+x]=1;}
 const active=p.sources.filter(s=>s.enabled).map(s=>{const ix=Math.min(nx-1,Math.floor(s.x/dx)),iy=Math.min(ny-1,Math.floor(s.y/dy)),i=iy*nx+ix;if(solid[i])throw Error('An enabled source is inside an obstacle. Move it into free space.');return {i,h:sourceResponse(s,p.frequency)};});
 if(!active.length)throw Error('Enable at least one source.');
 const neighbors=new Int32Array(n*4);for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){let i=y*nx+x;const ns=[x>0?i-1:i,x<nx-1?i+1:i,y>0?i-nx:i,y<ny-1?i+nx:i];ns.forEach((j,k)=>neighbors[4*i+k]=solid[j]?i:j);}
 let prev=new Float64Array(n),cur=new Float64Array(n),next=new Float64Array(n);const re=new Float64Array(n),im=new Float64Array(n);
 // Five decay time constants, then an integer number of drive periods (sampled).
 const settle=Math.ceil(Math.max(5/alpha,8/p.frequency)/dt),measure=Math.ceil(8/p.frequency/dt),steps=settle+measure;
 let cc=0,ss=0,cs=0;
 for(let t=0;t<steps;t++){
  for(let i=0;i<n;i++){if(solid[i])continue;const v=cur[i],j=i*4;next[i]=(2*v-(1-loss)*prev[i]+ax*(cur[neighbors[j]]+cur[neighbors[j+1]]-2*v)+ay*(cur[neighbors[j+2]]+cur[neighbors[j+3]]-2*v))/(1+loss);}
  const co=Math.cos(omega*t*dt),si=Math.sin(omega*t*dt),ramp=Math.min(1,t*dt*p.frequency/3);
  for(const s of active)next[s.i]+=dt*dt/(dx*dy)*ramp*(s.h[0]*co-s.h[1]*si);
  if(t>=settle){cc+=co*co;ss+=si*si;cs+=co*si;for(let i=0;i<n;i++){re[i]+=next[i]*co;im[i]+=next[i]*si;}}
  [prev,cur,next]=[cur,next,prev];if(t%500===0)progress(t/steps);
 }
 const amplitude=new Float32Array(n),det=cc*ss-cs*cs;let peak=0;for(let i=0;i<n;i++){amplitude[i]=solid[i]?0:Math.hypot((re[i]*ss-im[i]*cs)/det,(im[i]*cc-re[i]*cs)/det);peak=Math.max(peak,amplitude[i]);}
 return {nx,ny,amplitude,solid,peak,seconds:steps*dt,spacing:Math.max(dx,dy),samplesPerWavelength:c/(p.frequency*Math.max(dx,dy))};
}
