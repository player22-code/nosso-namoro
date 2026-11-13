(()=>{
'use strict';
function init(){
 const hero=document.querySelector('header.nh-hero-referencia');
 if(!hero||hero.querySelector('.nh-theme-film'))return;
 const video=document.createElement('video');
 video.className='nh-theme-film';video.src='diapranoite.mp4';video.preload='auto';video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.disablePictureInPicture=true;
 const canvas=document.createElement('canvas');canvas.className='nh-theme-reverse';canvas.setAttribute('aria-hidden','true');
 hero.prepend(canvas);hero.prepend(video);
 const context=canvas.getContext('2d',{alpha:false});
 let dark=document.body.classList.contains('tema-escuro'), token=0;
 function clear(){video.pause();video.classList.remove('is-active');canvas.classList.remove('is-active');}
 function seek(t){return new Promise(resolve=>{
  let settled=false;const finish=()=>{if(settled)return;settled=true;video.removeEventListener('seeked',finish);clearTimeout(timeout);resolve();};
  const timeout=setTimeout(finish,450);video.addEventListener('seeked',finish,{once:true});
  try{video.currentTime=Math.max(0,Math.min(video.duration||t,t));}catch{finish();}
 });}
 async function animateReverse(id){
  try{
   if(video.readyState<1)await new Promise((resolve,reject)=>{video.addEventListener('loadedmetadata',resolve,{once:true});video.addEventListener('error',reject,{once:true});setTimeout(resolve,4000);});
   if(id!==token)return;
   const duration=video.duration;
   if(!Number.isFinite(duration)||duration<=0||!context)return;
   canvas.width=video.videoWidth||1280;canvas.height=video.videoHeight||720;
   canvas.classList.add('is-active');
   const start=performance.now(),length=Math.min(Math.max(duration*1000,1800),7000);
   while(id===token){
    const progress=Math.min(1,(performance.now()-start)/length);
    await seek(duration*(1-progress));
    if(id!==token)break;
    try{context.drawImage(video,0,0,canvas.width,canvas.height);}catch{}
    if(progress>=1)break;
   }
  }catch(e){console.warn('Transicao reversa indisponivel:',e);}
  if(id===token)clear();
 }
 async function animateForward(id){
  try{
   if(video.readyState<1)await new Promise((resolve,reject)=>{video.addEventListener('loadedmetadata',resolve,{once:true});video.addEventListener('error',reject,{once:true});setTimeout(resolve,4000);});
   if(id!==token)return;
   video.currentTime=0;video.classList.add('is-active');
   const play=video.play();if(play)await play;
   if(id!==token)return;
   await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;video.removeEventListener('ended',finish);video.removeEventListener('error',finish);clearTimeout(timer);resolve();};video.addEventListener('ended',finish,{once:true});video.addEventListener('error',finish,{once:true});const timer=setTimeout(finish,Math.min(Math.max((video.duration||3)*1000+1000,2500),16000));});
  }catch(e){console.warn('Transicao de tema indisponivel:',e);}
  if(id===token)clear();
 }
 const observer=new MutationObserver(()=>{
  const next=document.body.classList.contains('tema-escuro');if(next===dark)return;dark=next;
  const id=++token;clear();if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(next)animateForward(id);else animateReverse(id);
 });
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();