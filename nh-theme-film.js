(()=>{
'use strict';
function init(){
 const hero=document.querySelector('header.nh-hero-referencia');
 if(!hero||hero.querySelector('.nh-theme-film'))return;
 const video=document.createElement('video');
 video.className='nh-theme-film';video.src='diapranoite.mp4';video.preload='auto';video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.disablePictureInPicture=true;
 const canvas=document.createElement('canvas');canvas.className='nh-theme-reverse';canvas.setAttribute('aria-hidden','true');
 hero.prepend(canvas);hero.prepend(video);
 // Carrega e decodifica antecipadamente o primeiro quadro para o clique responder sem espera.
 video.load();
 let firstFrameReady=false;
 const prepareFirstFrame=()=>{if(!document.body.classList.contains('tema-escuro')&&video.readyState>=2&&video.currentTime<0.08)firstFrameReady=true;};
 video.addEventListener('loadeddata',prepareFirstFrame);
 video.addEventListener('canplay',prepareFirstFrame);
 prepareFirstFrame();
 const context=canvas.getContext('2d',{alpha:false});
 let dark=document.body.classList.contains('tema-escuro'), token=0;
 hero.dataset.heroScene=dark?'noite':'dia';
 function finishScene(id,night){if(id!==token)return;hero.dataset.heroScene=night?'noite':'dia';clear();
  // Depois da animacao, reposiciona o video oculto para o proximo dia->noite.
  if(video.readyState>=1){try{video.currentTime=0;}catch{}}
 }
 function clear(){video.pause();video.classList.remove('is-active');canvas.classList.remove('is-active');}
 function seek(t){return new Promise(resolve=>{
  let settled=false;const finish=()=>{if(settled)return;settled=true;video.removeEventListener('seeked',finish);clearTimeout(timeout);resolve();};
  const timeout=setTimeout(finish,450);video.addEventListener('seeked',finish,{once:true});
  try{video.currentTime=Math.max(0,Math.min(video.duration||t,t));}catch{finish();}
 });}
 async function animateReverse(id){
  // Reproduz os quadros do MESMO diapranoite.mp4 de tras para frente.
  // O canvas preserva o ultimo quadro enquanto o video faz seek.
  try{
   if(video.readyState<1)await new Promise(resolve=>{
    const done=()=>resolve();
    video.addEventListener('loadedmetadata',done,{once:true});
    setTimeout(done,2500);
   });
   if(id!==token)return;
   const duration=video.duration;
   if(!Number.isFinite(duration)||duration<=0||!context)throw new Error('Video indisponivel');
   const w=video.videoWidth||960,h=video.videoHeight||540;
   const scale=Math.min(1,960/w);
   canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
   hero.dataset.heroScene='noite';
   await seek(Math.max(0,duration-0.04));
   if(id!==token)return;
   context.drawImage(video,0,0,canvas.width,canvas.height);
   canvas.classList.add('is-active');
   const started=performance.now();
   const length=Math.min(duration*1000,6500);
   let last=duration;
   while(id===token){
    const elapsed=performance.now()-started;
    const progress=Math.min(1,elapsed/length);
    const target=Math.max(0.01,duration*(1-progress));
    if(last-target>=0.035||progress===1){
     await seek(target);
     if(id!==token)return;
     try{context.drawImage(video,0,0,canvas.width,canvas.height)}catch{}
     last=target;
    }
    if(progress>=1)break;
    await new Promise(resolve=>requestAnimationFrame(resolve));
   }
  }catch(e){console.warn('Video reverso indisponivel:',e);}
  if(id===token)finishScene(id,false);
 }
 async function animateForward(id){
  try{
   if(video.readyState<1)await new Promise((resolve,reject)=>{video.addEventListener('loadedmetadata',resolve,{once:true});video.addEventListener('error',reject,{once:true});setTimeout(resolve,4000);});
   if(id!==token)return;
   // Nao busca o primeiro quadro novamente quando ele ja esta preparado.
   if(video.currentTime>0.08){
    await seek(0);
   }
   if(video.readyState<2)await new Promise(resolve=>{
    const done=()=>resolve();video.addEventListener('loadeddata',done,{once:true});setTimeout(done,900);
   });
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