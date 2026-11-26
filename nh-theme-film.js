(()=>{
'use strict';
function init(){
 const hero=document.querySelector('header.nh-hero-referencia');
 if(!hero||hero.querySelector('.nh-theme-film'))return;
 const day=document.createElement('div'),night=document.createElement('div');
 day.className='nh-scene-photo nh-scene-day';night.className='nh-scene-photo nh-scene-night';
 day.setAttribute('aria-hidden','true');night.setAttribute('aria-hidden','true');
 const video=document.createElement('video');
 video.className='nh-theme-film';video.src='diapranoite.mp4';video.preload='auto';video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.disablePictureInPicture=true;
 const canvas=document.createElement('canvas');canvas.className='nh-theme-reverse';canvas.setAttribute('aria-hidden','true');
 hero.prepend(day,night,canvas,video);hero.classList.add('nh-scenes-ready');
 const context=canvas.getContext('2d',{alpha:true});
 let dark=document.body.classList.contains('tema-escuro'),token=0,raf=0,videoFrame=0,waitTimer=0,cache=[],capturing=[],captureComplete=false,lastCapture=-1;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function setScene(value){hero.dataset.heroScene=value?'noite':'dia';night.classList.toggle('is-active',value);day.classList.toggle('is-active',!value)}
 setScene(dark);
 function stopFrames(){cancelAnimationFrame(raf);raf=0;if(videoFrame&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(videoFrame);videoFrame=0;clearTimeout(waitTimer)}
 function clear(){stopFrames();video.pause();video.classList.remove('is-active');canvas.classList.remove('is-active')}
 function finish(id,value){if(id!==token)return;setScene(value);clear();if(video.readyState>=1){try{video.currentTime=0}catch{}}}
 function waitFor(event,timeout){return new Promise(resolve=>{let settled=false;const done=()=>{if(settled)return;settled=true;clearTimeout(timer);video.removeEventListener(event,done);video.removeEventListener('error',done);resolve()};const timer=setTimeout(done,timeout);video.addEventListener(event,done,{once:true});video.addEventListener('error',done,{once:true})})}
 function capture(time,force=false){
  if(video.readyState<2||!video.videoWidth||!video.videoHeight)return;
  const duration=Number.isFinite(video.duration)?video.duration:5;
  const interval=Math.max(1/24,duration/94);
  if(!force&&time-lastCapture<interval)return;
  if(capturing.length>=96)return;
  const ratio=Math.min(1,320/Math.max(video.videoWidth,video.videoHeight));
  const frame=document.createElement('canvas');frame.width=Math.max(1,Math.round(video.videoWidth*ratio));frame.height=Math.max(1,Math.round(video.videoHeight*ratio));
  try{frame.getContext('2d',{alpha:false}).drawImage(video,0,0,frame.width,frame.height);capturing.push({time,frame});lastCapture=time}catch{}
 }
 function collect(id){
  if(id!==token||video.paused||video.ended)return;
  if(video.requestVideoFrameCallback){videoFrame=video.requestVideoFrameCallback((_,m)=>{videoFrame=0;if(id!==token)return;capture(m.mediaTime);collect(id)})}
  else{raf=requestAnimationFrame(()=>{raf=0;if(id!==token)return;capture(video.currentTime);collect(id)})}
 }
 async function forward(id){
  try{
   if(video.readyState<1)await waitFor('loadedmetadata',2200);
   if(id!==token)return;
   if(video.currentTime>.08){video.currentTime=0;await waitFor('seeked',900)}
   if(id!==token)return;
   if(video.readyState<2)await waitFor('loadeddata',1200);
   if(id!==token)return;
   if(video.readyState<2)throw Error('Quadro inicial indisponível');
   capturing=[];lastCapture=-1;capture(0,true);
   await video.play();if(id!==token)return;
   video.classList.add('is-active');collect(id);
   const complete=()=>{if(id!==token)return;capture(video.currentTime,true);if(capturing.length>=3&&Number.isFinite(video.duration)&&capturing[capturing.length-1].time>=video.duration*.85){cache=capturing;captureComplete=true}capturing=[];finish(id,true)};
   const onEnded=()=>{video.removeEventListener('error',onError);complete()};
   const onError=()=>{video.removeEventListener('ended',onEnded);complete()};
   video.addEventListener('ended',onEnded,{once:true});video.addEventListener('error',onError,{once:true});
   waitTimer=setTimeout(()=>{video.removeEventListener('ended',onEnded);video.removeEventListener('error',onError);complete()},Math.min(Math.max((video.duration||3)*1000+1200,2500),16000));
  }catch(e){if(id===token)finish(id,true)}
 }
 function reverse(id){
  if(!captureComplete||cache.length<3||!context){finish(id,false);return}
  const last=cache[cache.length-1],first=cache[0];canvas.width=last.frame.width;canvas.height=last.frame.height;
  context.drawImage(last.frame,0,0);canvas.classList.add('is-active');const start=performance.now(),length=Math.max(650,Math.min(6500,(last.time-first.time)*1000));let cursor=cache.length-1;
  function step(now){if(id!==token)return;const p=Math.min(1,(now-start)/length),target=last.time-(last.time-first.time)*p;
   while(cursor>1&&cache[cursor-1].time>=target)cursor--;
   const a=cache[cursor-1],b=cache[cursor];const mix=Math.max(0,Math.min(1,(target-a.time)/Math.max(.001,b.time-a.time)));
   context.globalAlpha=1;context.drawImage(a.frame,0,0);context.globalAlpha=mix;context.drawImage(b.frame,0,0);context.globalAlpha=1;
   if(p>=1)finish(id,false);else raf=requestAnimationFrame(step)
  }
  raf=requestAnimationFrame(step)
 }
 const observer=new MutationObserver(()=>{
  const next=document.body.classList.contains('tema-escuro');if(next===dark)return;dark=next;
  const id=++token;clear();capturing=[];
  if(reduced()||document.hidden){finish(id,next);return}
  if(next)forward(id);else reverse(id)
 });
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){const id=++token;finish(id,dark);capturing=[]}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();