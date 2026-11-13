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
 hero.dataset.heroScene=dark?'noite':'dia';
 function finishScene(id,night){if(id!==token)return;hero.dataset.heroScene=night?'noite':'dia';clear();}
 function clear(){video.pause();video.classList.remove('is-active');canvas.classList.remove('is-active');}
 function seek(t){return new Promise(resolve=>{
  let settled=false;const finish=()=>{if(settled)return;settled=true;video.removeEventListener('seeked',finish);clearTimeout(timeout);resolve();};
  const timeout=setTimeout(finish,450);video.addEventListener('seeked',finish,{once:true});
  try{video.currentTime=Math.max(0,Math.min(video.duration||t,t));}catch{finish();}
 });}
 async function animateReverse(id){
  // Evita dezenas de seeks/decodificacoes de video por segundo no celular.
  // Uma unica camada noturna desaparece revelando a foto diurna.
  video.pause();
  canvas.classList.add('is-active');
  hero.dataset.heroScene='noite';
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(id!==token)return;
  hero.dataset.heroScene='dia';
  canvas.classList.remove('is-active');
  await new Promise(resolve=>setTimeout(resolve,1150));
  if(id===token)finishScene(id,false);
 }
 async function animateForward(id){
  try{
   if(video.readyState<1)await new Promise((resolve,reject)=>{video.addEventListener('loadedmetadata',resolve,{once:true});video.addEventListener('error',reject,{once:true});setTimeout(resolve,4000);});
   if(id!==token)return;
   video.currentTime=0;
   await new Promise(resolve=>{if(video.readyState>=2)return resolve();video.addEventListener('loadeddata',resolve,{once:true});setTimeout(resolve,1200)});
   if(id!==token)return;
   video.classList.add('is-active');
   const play=video.play();if(play)await play;
   if(id!==token)return;
   await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;video.removeEventListener('ended',finish);video.removeEventListener('error',finish);clearTimeout(timer);resolve();};video.addEventListener('ended',finish,{once:true});video.addEventListener('error',finish,{once:true});const timer=setTimeout(finish,Math.min(Math.max((video.duration||3)*1000+1000,2500),16000));});
  }catch(e){console.warn('Transicao de tema indisponivel:',e);}
  if(id===token)finishScene(id,true);
 }
 const observer=new MutationObserver(()=>{
  const next=document.body.classList.contains('tema-escuro');if(next===dark)return;dark=next;
  const id=++token;clear();if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){finishScene(id,next);return;}
  if(next)animateForward(id);else animateReverse(id);
 });
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();