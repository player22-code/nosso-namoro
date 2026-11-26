(()=>{
'use strict';
function init(){
 const hero=document.querySelector('header.nh-hero-referencia');if(!hero||hero.querySelector('.nh-theme-film'))return;
 const make=(tag,cls)=>{const el=document.createElement(tag);el.className=cls;el.setAttribute('aria-hidden','true');return el};
 const day=make('div','nh-scene-photo nh-scene-day'),night=make('div','nh-scene-photo nh-scene-night'),video=make('video','nh-theme-film'),canvas=make('canvas','nh-theme-reverse');
 video.src='diapranoite.mp4';video.preload='auto';video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');video.disablePictureInPicture=true;
 hero.prepend(day,night,canvas,video);hero.classList.add('nh-scenes-ready');
 const ctx=canvas.getContext('2d',{alpha:false}),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x)};
 let target=document.body.classList.contains('tema-escuro')?1:0,progress=target,raf=0,job=0,from=progress,started=0,length=0,cache=[],record=[],last=-1,playing=false,kind='none',frameId=0,abort=null;
 function render(p){progress=clamp(p);day.style.opacity='1';night.style.opacity=String(progress);hero.dataset.heroScene=target?'noite':'dia';hero.style.setProperty('--nh-scene-progress',String(progress))}
 function stop(){cancelAnimationFrame(raf);raf=0;if(frameId&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frameId);frameId=0;if(abort)abort.abort();abort=null;playing=false;video.pause();video.classList.remove('is-active');canvas.classList.remove('is-active');video.style.opacity='0';canvas.style.opacity='0';kind='none';record=[]}
 function settle(){stop();render(target)}
 function capture(force=false){
  if(!playing||video.readyState<2||!video.videoWidth||!video.videoHeight)return;
  const t=video.currentTime,d=video.duration||5,interval=Math.max(1/24,d/71);
  if((!force&&t-last<interval)||record.length>=73)return;
  const ratio=Math.min(1,448/Math.max(video.videoWidth,video.videoHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(video.videoWidth*ratio));c.height=Math.max(1,Math.round(video.videoHeight*ratio));
  try{c.getContext('2d',{alpha:false}).drawImage(video,0,0,c.width,c.height);record.push({t,c});last=t}catch{}
 }
 function captureLoop(id){if(id!==job||!playing)return;capture();if(video.requestVideoFrameCallback)frameId=video.requestVideoFrameCallback(()=>{frameId=0;captureLoop(id)})}
 function drawReverse(p){if(!ctx||cache.length<3)return false;const first=cache[0],last=cache.at(-1),t=first.t+(last.t-first.t)*clamp(p);let lo=0,hi=cache.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(cache[mid].t<t)lo=mid;else hi=mid}const a=cache[lo],b=cache[hi],mix=clamp((t-a.t)/Math.max(.001,b.t-a.t));if(canvas.width!==a.c.width||canvas.height!==a.c.height){canvas.width=a.c.width;canvas.height=a.c.height}ctx.globalAlpha=1;ctx.drawImage(a.c,0,0);ctx.globalAlpha=mix;ctx.drawImage(b.c,0,0);ctx.globalAlpha=1;return true}
 function overlay(p){return Math.min(ease(p/.13),ease((1-p)/.15))}
 function tick(now,id){if(id!==job)return;const q=clamp((now-started)/length),p=from+(target-from)*ease(q);render(p);
  if(kind==='reverse'&&drawReverse(p))canvas.style.opacity=String(overlay(p));
  if(kind==='forward'){
   if(playing&&!video.requestVideoFrameCallback)capture();
   if(playing&&video.readyState>=2){const d=video.duration||length/1000;const f=clamp(video.currentTime/d);video.style.opacity=String(Math.min(overlay(f),overlay(p)))}
   if(video.ended){capture(true);if(record.length>=3&&record.at(-1).t>=(video.duration||1)*.85)cache=record.slice();playing=false;video.style.opacity='0'}
  }
  if(q>=1){if(kind==='forward'&&record.length>=3&&record.at(-1).t>=(video.duration||1)*.85)cache=record.slice();settle();return}raf=requestAnimationFrame(t=>tick(t,id))
 }
 function transition(next){
  if(next===target)return;target=next;const id=++job;const was=progress;stop();render(was);if(reduce.matches||document.hidden){settle();return}
  from=was;started=performance.now();length=Math.max(280,1250*Math.abs(target-from));
  if(target===0&&cache.length>=3&&ctx){kind='reverse';length=Math.max(350,Math.min(6500,(cache.at(-1).t-cache[0].t)*1000)*Math.abs(target-from));canvas.classList.add('is-active')}
  else if(target===1&&was<.025&&video.readyState>=2&&Number.isFinite(video.duration)&&video.duration>0&&video.duration<16){
   kind='forward';length=Math.max(1250,video.duration*1000+160);record=[];last=-1;abort=new AbortController();
   const signal=abort.signal;const begin=()=>{if(id!==job||signal.aborted)return;video.play().then(()=>{if(id!==job||signal.aborted){if(kind!=='forward')video.pause();return}playing=true;video.classList.add('is-active');capture(true);captureLoop(id)}).catch(()=>{if(id===job){kind='none';playing=false}})};
   if(video.currentTime>.08){video.addEventListener('seeked',begin,{once:true,signal});try{video.currentTime=0}catch{kind='none'}}else begin();
  }
  raf=requestAnimationFrame(t=>tick(t,id))
 }
 render(progress);
 new MutationObserver(()=>transition(document.body.classList.contains('tema-escuro')?1:0)).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){job++;settle()}});
 reduce.addEventListener?.('change',()=>{if(reduce.matches){job++;settle()}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();