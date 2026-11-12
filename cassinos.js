/* Both casino themes use the existing authenticated, server-controlled wallet. */
(() => {
 'use strict';
 const hub=document.getElementById('nh-casinos');if(!hub)return;
 const keys=['cenoura','coracao','morango','coelho','moeda','estrela','trevo','coroa'];
 const sounds={click:'01_clique_botao.wav',open:'18_abrir_menu.wav',start:'02_iniciar_rodada.wav',spin:'03_roleta_girando.wav',stop:'04_roleta_parando.wav',coins:'14_moeda_caindo.wav',win:'06_vitoria_pequena.wav',big:'09_super_win.wav',lose:'05_sem_premio.wav'};
 const poses={amor:{idle:'coelho_idle.gif',win:'coelho_vitoria.gif',lose:'coelho_derrota.gif',big:'coelho_grande_vitoria.gif'},girinnho:{idle:'cucoparado.gif',win:'cucofeliz.gif',lose:'cucotriste.gif',big:'cucofeliz.gif'}};
 // Artwork is displayed through CSS windows over the unmodified supplied JPEG.
 // The canonical server symbol IDs and probabilities are unchanged by the theme.
 const art={amor:{cenoura:[46,367,'Lingote dourado'],coracao:[377,367,'Cartas de amor'],morango:[157,367,'Laranja'],coelho:[266,367,'Coelhinho'],estrela:[484,576,'Fogos'],moeda:['simbolo_moeda.png','Moeda'],trevo:['simbolo_trevo.png','Trevo'],coroa:['simbolo_coracao.png','Coração']},girinnho:{cenoura:[795,367,'Serpente neon'],coracao:[906,367,'Coroa'],morango:[1014,367,'Esmeralda'],coelho:[687,367,'Girinnho'],moeda:[1125,367,'Moedas'],estrela:['ft_ouro.png','Ouro'],trevo:['ft_fogos.png','Fogos'],coroa:['ft_cartas.png','Cartas']}};
 const states=[];const playing=new Set();const small=matchMedia('(max-width:700px)');
 let current='amor',transaction=false,previousFocus=null,openStory=null,openUser=null,ambient=null,ambientWasPlaying=false;
 const story=()=>typeof historiaAtual!=='undefined'?historiaAtual?.historia_id:null;
 const user=()=>typeof usuario!=='undefined'?usuario?.id:null;
 const connected=()=>typeof db!=='undefined'&&db&&story()&&user();
 const sameSession=(sid,uid)=>story()===sid&&user()===uid;
 const pauseSounds=()=>{for(const a of playing)a.pause();playing.clear()};
 function balance(){const n=window.nhSaldoIndividual;return Number.isSafeInteger(n)&&n>=0?n:null}
 function syncBalances(){const n=balance();states.forEach(s=>s.root.querySelector('.nh-balance').textContent='🪙 Saldo: '+(n??'--'));hub.querySelector('.nh-wallet-value').textContent='🪙 '+(n===null?'--':n.toLocaleString('pt-BR'));const pet=document.getElementById('mascote-saldo');if(pet&&n!==null)pet.textContent='🪙 '+n}
 // Display-only verification. The browser never credits rewards to the server.
 function lines(symbols,bet){let total=0;const paid=[];for(let row=0;row<3;row++){let count=1;while(count<5&&symbols[row*5+count]===symbols[row*5])count++;if(count>=3){total+=bet*({3:3,4:7,5:15}[count]);for(let col=0;col<count;col++)paid.push(row*5+col)}}return {total,paid}}
 function controls(){states.forEach(s=>{s.spin.disabled=transaction;s.minus.disabled=transaction||s.bet===1||s.auto;s.plus.disabled=transaction||s.bet===3||s.auto;s.refresh.disabled=transaction;s.autoButton.disabled=transaction&&!s.auto;s.autoButton.setAttribute('aria-checked',String(s.auto));s.autoButton.setAttribute('aria-label',s.auto?'Parar giros automáticos':'Ativar até 10 giros automáticos');s.root.querySelector('.nh-auto-count').textContent=s.auto?s.remaining+' restantes':'Até 10 giros';s.root.querySelector('.nh-bet').textContent=s.bet})}
 function stopAuto(s){s.auto=false;s.token++;clearTimeout(s.next);controls()}
 function stopAllAuto(){states.forEach(stopAuto)}
 function theme(name){stopAllAuto();pauseSounds();states.forEach(s=>s.stopMusic());current=name;layout();const selected=states.find(s=>s.theme===name);if(small.matches)hub.scrollTop=0;selected?.spin.focus({preventScroll:true})}
 function layout(){states.forEach(s=>s.root.hidden=small.matches&&s.theme!==current);hub.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===current)))}
 function open(name){
  if(hub.hidden){previousFocus=document.activeElement;openStory=story();openUser=user();ambient=document.getElementById('musica');ambientWasPlaying=!!ambient&&!ambient.paused;if(ambientWasPlaying)ambient.pause()}
  current=name;hub.hidden=false;layout();document.body.classList.add('nh-casino-open');
  states.forEach(s=>s.entry.setAttribute('aria-expanded',String(!s.root.hidden)));hub.querySelector('.nh-close').focus();syncBalances();states.find(s=>s.theme===name)?.refreshBalance();
 }
 function close(restore=true){
  stopAllAuto();pauseSounds();states.forEach(s=>{s.clearEffect();s.stopMusic();s.entry.setAttribute('aria-expanded','false')});
  hub.hidden=true;document.body.classList.remove('nh-casino-open');
  if(restore&&previousFocus?.isConnected)previousFocus.focus();
  if(ambientWasPlaying&&!document.hidden){ambient?.play().catch(()=>{});ambientWasPlaying=false}
 }
 hub.querySelectorAll('.nh-casino').forEach(root=>{
  const themeName=root.classList.contains('nh-casino-amor')?'amor':'girinnho';
  const q=selector=>root.querySelector(selector);
  const s={root,theme:themeName,entry:document.getElementById(themeName==='amor'?'cassino-abrir':'girinnho-abrir'),spin:q('.nh-spin'),minus:q('.nh-minus'),plus:q('.nh-plus'),refresh:q('.nh-refresh'),autoButton:q('.nh-auto'),bet:1,auto:false,remaining:0,token:0,next:null};states.push(s);
  const grid=q('.nh-reels'),hero=q('.nh-hero'),result=q('.nh-result'),effect=q('.nh-win-effect'),bigWin=q('.nh-big-win');
  let sound=false,effectTimer=null;const music=new Audio('bgsound.ogg');music.loop=true;music.volume=.12;
  const cells=Array.from({length:15},()=>{const cell=document.createElement('div');cell.className='nh-cell';cell.setAttribute('role','img');const img=document.createElement('span');img.className='nh-symbol';img.setAttribute('aria-hidden','true');cell.append(img);grid.append(cell);return cell});
  function paint(symbols){symbols.forEach((key,i)=>{
   const cell=cells[i],img=cell.firstElementChild,a=art[themeName][key];cell.dataset.symbol=key;
   if(typeof a[0]==='string'){img.className='nh-symbol nh-symbol-file';img.style.backgroundImage='url("'+a[0]+'")';img.style.backgroundSize='';img.style.backgroundPosition='';cell.setAttribute('aria-label',a[1])}
   else{img.className='nh-symbol';img.style.backgroundImage='url("cassinos-referencia.jpg")';img.style.backgroundSize=(1280/98*100)+'% '+(853/98*100)+'%';img.style.backgroundPosition=(a[0]/(1280-98)*100)+'% '+(a[1]/(853-98)*100)+'%';cell.setAttribute('aria-label',a[2])}
  })}
  function pose(state){hero.src=poses[themeName][state];hero.alt=(themeName==='amor'?'Coelhinho branco':'Girinnho')+' — '+({idle:'pronto para jogar',win:'vitória',lose:'sem prêmio',big:'supervitória'}[state])}
  function audio(name,loop=false){if(!sound||hub.hidden||root.hidden||document.hidden)return null;const a=new Audio(sounds[name]);a.volume=.35;a.loop=loop;playing.add(a);a.onended=()=>playing.delete(a);a.play().catch(()=>playing.delete(a));return a}
  s.stopMusic=()=>{music.pause();q('.nh-music').setAttribute('aria-pressed','false');q('.nh-music').textContent='♫ Música'};
  s.clearEffect=()=>{clearTimeout(effectTimer);effect.hidden=true;bigWin.hidden=true;cells.forEach(cell=>cell.classList.remove('nh-paid'))};
  s.refreshBalance=async()=>{
   if(!connected()){result.textContent='Entre na sua conta e escolha o Modo Solo ou uma história do casal para jogar.';return}
   if(transaction)return;const sid=story(),uid=user();
   try{const {data,error}=await db.rpc('nh_meu_saldo');if(error)throw error;if(!sameSession(sid,uid)||transaction)return;const n=Number(data);if(data===null||!Number.isSafeInteger(n)||n<0)throw new Error('Saldo inválido');window.nhSaldoIndividual=n;syncBalances()}
   catch(e){if(sameSession(sid,uid))result.textContent='Não foi possível atualizar o saldo: '+e.message}
  };
  async function spin(){
   if(transaction||hub.hidden||root.hidden)return false;
   if(!connected()){result.textContent='Entre na sua conta e escolha uma história para jogar.';return false}
   const sid=story(),uid=user(),bet=s.bet;
   if(balance()!==null&&balance()<bet){result.textContent='Saldo insuficiente. Abra Bônus para ver as recompensas gratuitas.';return false}
   transaction=true;controls();s.clearEffect();pose('idle');result.textContent='Girando… boa sorte!';audio('start');audio('coins');
   const loop=audio('spin',true);grid.classList.add('nh-spinning');
   const anim=setInterval(()=>{if(!hub.hidden&&!root.hidden)paint(Array.from({length:15},()=>keys[Math.floor(Math.random()*keys.length)]))},95);const started=Date.now();
   try{
    // Never automatically retry a debit: a lost response may already have consumed it.
    const {data,error}=await db.rpc('cassino_girar',{p_story_id:sid,p_aposta:bet});if(error)throw error;
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,1250-(Date.now()-started))));
    clearInterval(anim);grid.classList.remove('nh-spinning');if(loop){loop.pause();playing.delete(loop)}
    if(!sameSession(sid,uid))return false;
    if(!data||!Array.isArray(data.simbolos)||data.simbolos.length!==15||!data.simbolos.every(n=>keys.includes(n))||!Number.isSafeInteger(data.saldo)||data.saldo<0||!Number.isSafeInteger(data.premio)||data.premio<0)throw new Error('Resposta do servidor inválida. Atualize o saldo.');
    paint(data.simbolos);window.nhSaldoIndividual=data.saldo;syncBalances();const payout=lines(data.simbolos,bet);
    if(payout.total!==data.premio){result.textContent='Prêmio informado pelo servidor: '+data.premio+' moedas. Ele diverge da tabela; Auto foi parado. Confira as regras com o administrador.';pose('idle');return false}
    if(!hub.hidden&&!root.hidden){
     audio('stop');
     if(data.premio>0){const big=data.premio>=bet*7;pose(big?'big':'win');audio(big?'big':'win');payout.paid.forEach(i=>cells[i].classList.add('nh-paid'));effect.hidden=false;bigWin.hidden=!big;result.textContent=(big?'Supervitória! ':'Vitória! ')+'Prêmio: '+data.premio+' moedas. Saldo: '+data.saldo+'.';effectTimer=setTimeout(()=>{effect.hidden=true;bigWin.hidden=true;pose('idle')},3200)}
     else{pose('lose');audio('lose');result.textContent='Sem prêmio neste giro. Custo: '+bet+' moeda(s). Saldo: '+data.saldo+'.'}
    }
    return true;
   }catch(e){if(sameSession(sid,uid)){result.textContent='Não foi possível confirmar o giro: '+(e?.message||'falha de conexão')+' Atualize o saldo antes de tentar novamente.';pose('idle')}return false}
   finally{clearInterval(anim);grid.classList.remove('nh-spinning');if(loop){loop.pause();playing.delete(loop)}transaction=false;controls()}
  }
  async function autoRound(token){
   if(!s.auto||s.token!==token||hub.hidden||root.hidden||document.hidden)return;
   s.remaining--;controls();const ok=await spin();
   if(!s.auto||s.token!==token)return;
   if(!ok||s.remaining<=0||balance()===null||balance()<s.bet){stopAuto(s);return}
   s.next=setTimeout(()=>autoRound(token),1100);
  }
  s.spin.addEventListener('click',()=>{stopAllAuto();spin()});
  s.minus.addEventListener('click',()=>{if(transaction||s.auto)return;s.bet=Math.max(1,s.bet-1);audio('click');controls()});
  s.plus.addEventListener('click',()=>{if(transaction||s.auto)return;s.bet=Math.min(3,s.bet+1);audio('click');controls()});
  s.autoButton.addEventListener('click',()=>{if(s.auto){stopAuto(s);return}if(transaction)return;stopAllAuto();s.auto=true;s.remaining=10;controls();autoRound(s.token)});
  s.entry.addEventListener('click',()=>open(themeName));s.refresh.addEventListener('click',()=>{audio('click');s.refreshBalance()});
  q('.nh-sound').addEventListener('click',e=>{sound=!sound;e.currentTarget.setAttribute('aria-pressed',String(sound));e.currentTarget.textContent=sound?'🔊 Sons ligados':'🔇 Ativar sons';if(sound)audio('click');else pauseSounds()});
  q('.nh-music').addEventListener('click',async e=>{const target=e.currentTarget,on=music.paused;if(on){states.filter(other=>other!==s).forEach(other=>other.stopMusic());try{await music.play()}catch{result.textContent='Toque novamente para autorizar a música.';return}if(hub.hidden||document.hidden){s.stopMusic();return}}else music.pause();target.setAttribute('aria-pressed',String(on));target.textContent=on?'♫ Música ligada':'♫ Música'});
  paint(themeName==='amor'?['cenoura','morango','coelho','coracao','morango','coracao','cenoura','morango','coelho','cenoura','coelho','morango','cenoura','coracao','estrela']:['coelho','cenoura','coracao','morango','moeda','morango','coelho','moeda','cenoura','coracao','cenoura','coracao','coelho','morango','moeda']);
 });
 hub.querySelector('.nh-close').addEventListener('click',()=>close());
 hub.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>theme(b.dataset.theme)));
 hub.querySelectorAll('[data-nh-nav]').forEach(b=>b.addEventListener('click',()=>{
  const target=b.dataset.nhNav;
  if(target==='planos'&&document.getElementById('planos-casal')?.hidden){const status=hub.querySelector('.nh-nav-status');status.hidden=false;status.textContent='Os planos estão disponíveis no Modo Casal. Volte ao início para escolher esse modo.';return}
  close(false);
  if(target==='inicio')document.getElementById('aba-btn-inicio')?.click();
  if(target==='planos'){document.getElementById('aba-btn-inicio')?.click();document.getElementById('abrir-planos')?.click();document.getElementById('planos-casal')?.scrollIntoView({block:'center'})}
  if(target==='bonus')document.getElementById('mascote-premios-abrir')?.click();
  if(target==='perfil')document.getElementById('botao-configuracoes')?.click();
 }));
 hub.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();close()}
  if(e.key==='Tab'){const nodes=[...hub.querySelectorAll('button:not(:disabled),summary')].filter(el=>el.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
 });
 small.addEventListener('change',()=>{stopAllAuto();layout()});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stopAllAuto();pauseSounds();states.forEach(s=>s.stopMusic())}});
 // Preserve the previous secret chat command as an additional entry.
 window.abrirGirininhoSecreto=()=>open('girinnho');const form=document.getElementById('chat-rodape'),input=document.getElementById('chat-texto-enviar');
 form?.addEventListener('submit',e=>{if(input.value.trim().toLowerCase()!=='/girininho777')return;e.preventDefault();e.stopImmediatePropagation();input.value='';open('girinnho')},true);
 setInterval(()=>{
  if(hub.hidden)return;
  if(!sameSession(openStory,openUser)||document.getElementById('aba-jogos')?.hidden||document.getElementById('conteudo-privado')?.style.display==='none'){close();return}
  if(!transaction)syncBalances();
 },400);
 controls();layout();
})();
