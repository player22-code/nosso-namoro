/* Browser regression tests. The wallet is mocked; no real account or credit is used.
   Start: python -m http.server 8765 --bind 127.0.0.1
   Run: node tests/cassinos.cjs (Playwright + Chromium required). */
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:8765';
const lose=['cenoura','coracao','morango','coelho','moeda','estrela','trevo','coroa','cenoura','coracao','morango','coelho','moeda','estrela','trevo'];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const report=[];
 for(const viewport of (process.argv[2]||'1280,390,320').split(',').map(Number).map(width=>({width,height:width===1280?900:width===390?844:640}))){
  const page=await browser.newPage({viewport});const errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)missing.push(r.url())});
  await page.route('https://**/*',route=>{
   if(route.request().url().includes('supabase.min.js'))return route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{}},removeChannel:()=>{},channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}}),from:()=>{const q=new Proxy({}, {get:(t,k)=>k==='then'?r=>r({data:[],error:null}):()=>q});return q},rpc:async(n,args)=>{if(n==='nh_meu_saldo')return {data:window.fakeBalance??100};if(n==='cassino_girar'){window.spinCalls=(window.spinCalls||0)+1;window.lastArgs=args;if(window.holdRpc)await new Promise(r=>window.releaseRpc=r);await new Promise(r=>setTimeout(r,window.rpcDelay||20));if(window.fakeError)return {error:{message:window.fakeError}};const data=window.fakeResult;window.fakeBalance=data.saldo;return {data}};return {data:null}}})};`});
   return route.fulfill({body:'',contentType:'application/javascript'});
  });
  await page.goto(base);await page.waitForTimeout(100);
  await page.evaluate(()=>{usuario={id:'test-user'};historiaAtual={historia_id:'test-story'};modoAtual='casal';document.getElementById('conteudo-privado').style.display='block';document.getElementById('historia-painel').hidden=false;document.getElementById('login-painel').hidden=true;document.getElementById('janela-configuracoes').hidden=true;atualizarInterfaceModo();});
  await page.click('#aba-btn-jogos');const hub=page.locator('#nh-casinos');
  async function settled(){await page.waitForFunction(()=>!document.querySelector('#nh-casinos .nh-spin').disabled)}
  async function setup(symbols,prize,extra={}){await page.evaluate(({symbols,prize,extra})=>{window.fakeResult={simbolos:symbols,premio:prize,saldo:99+prize};window.fakeBalance=100;window.fakeError=null;Object.assign(window,extra)},{symbols,prize,extra})}
  for(const [theme,entry] of [['amor','#cassino-abrir'],['girinnho','#girinnho-abrir']]){
   await page.click(entry);await hub.waitFor({state:'visible'});const root=page.locator('#nh-cassino-'+theme);assert.equal(await root.isVisible(),true);
   assert.equal(await root.locator('.nh-cell').count(),15);
   assert.equal(await root.locator('.nh-reels').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),5);
   assert.equal(await hub.evaluate(el=>el.scrollWidth>el.clientWidth+1),false,JSON.stringify(await hub.evaluate(el=>({w:el.clientWidth,s:el.scrollWidth,over:[...el.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().right>el.clientWidth+1).map(n=>n.className)}))));
   if(viewport.width>700)assert.equal(await page.locator('#nh-cassino-'+(theme==='amor'?'girinnho':'amor')).isVisible(),true);
   await page.screenshot({path:'/tmp/cassinos-reference-'+theme+'-'+viewport.width+'.png'});
   await root.locator('.nh-plus').click();assert.equal(await root.locator('.nh-bet').innerText(),'2');await root.locator('.nh-plus').click();assert.equal(await root.locator('.nh-plus').isDisabled(),true);
   await root.locator('.nh-minus').click();await root.locator('.nh-minus').click();assert.equal(await root.locator('.nh-minus').isDisabled(),true);
   await root.locator('.nh-sound').click();assert.equal(await root.locator('.nh-sound').getAttribute('aria-pressed'),'true');
   await root.locator('.nh-music').click();await page.waitForFunction(id=>{const r=document.getElementById(id);return r.querySelector('.nh-music').getAttribute('aria-pressed')==='true'||r.querySelector('.nh-result').textContent.includes('autorizar')},'nh-cassino-'+theme);if(await root.locator('.nh-music').getAttribute('aria-pressed')==='true')await root.locator('.nh-music').click();
   const cases=viewport.width===1280?[
    {symbols:lose,prize:0},
    {symbols:['cenoura','cenoura','cenoura','coracao','moeda',...lose.slice(5)],prize:3},
    {symbols:['cenoura','cenoura','cenoura','cenoura','moeda',...lose.slice(5)],prize:7},
    {symbols:['cenoura','cenoura','cenoura','cenoura','cenoura',...lose.slice(5)],prize:15},
    {symbols:Array(15).fill('coracao'),prize:45}
   ]:[{symbols:['cenoura','cenoura','cenoura','coracao','moeda',...lose.slice(5)],prize:3}];
   for(const c of cases){
    await setup(c.symbols,c.prize);const before=await page.evaluate(()=>window.spinCalls||0);
    await root.locator('.nh-spin').click();assert.equal(await root.locator('.nh-spin').isDisabled(),true);
    assert.equal(await page.locator('.nh-spin:disabled').count(),2);await settled();
    assert.equal(await page.evaluate(()=>window.spinCalls),before+1);
    const text=await root.locator('.nh-result').innerText();assert.ok(c.prize?text.includes('Prêmio: '+c.prize):text.includes('Sem prêmio'),text);
    await page.waitForTimeout(150);assert.deepEqual(await root.locator('.nh-cell').evaluateAll(els=>els.map(e=>e.dataset.symbol)),c.symbols);
    assert.equal(await root.locator('.nh-cell.nh-paid').count(),c.prize===45?15:c.prize===15?5:c.prize===7?4:c.prize===3?3:0);
    if(c.prize>=7)assert.equal(await root.locator('.nh-big-win').isVisible(),true);
   }
   if(viewport.width===1280){
    await setup(lose,0,{fakeError:'Saldo insuficiente'});await root.locator('.nh-spin').click();await settled();assert.match(await root.locator('.nh-result').innerText(),/Saldo insuficiente/);
    await setup(['bad'],0);await root.locator('.nh-spin').click();await settled();assert.match(await root.locator('.nh-result').innerText(),/inválida/);
    await setup(lose,7);await root.locator('.nh-auto').click();await settled();assert.match(await root.locator('.nh-result').innerText(),/diverge/);assert.equal(await root.locator('.nh-auto').getAttribute('aria-checked'),'false');
    await setup(lose,0,{rpcDelay:800});await root.locator('.nh-spin').click();await hub.locator('.nh-close').click();assert.equal(await hub.isVisible(),false);await page.click(entry);assert.equal(await root.locator('.nh-spin').isDisabled(),true);await settled();await page.evaluate(()=>window.rpcDelay=20);
   }
   // Auto can be stopped during a pending round and never sends another debit.
   await setup(lose,0,{holdRpc:true});const beforeAuto=await page.evaluate(()=>window.spinCalls||0);await root.locator('.nh-auto').click();assert.equal(await root.locator('.nh-auto').getAttribute('aria-checked'),'true');await root.locator('.nh-auto').click();await page.evaluate(()=>{window.holdRpc=false;window.releaseRpc()});await settled();await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>window.spinCalls),beforeAuto+1);
   // An insufficient balance is blocked locally, without an RPC.
   await page.evaluate(()=>{window.fakeBalance=0;window.nhSaldoIndividual=0});const beforeLow=await page.evaluate(()=>window.spinCalls);await root.locator('.nh-spin').click();assert.match(await root.locator('.nh-result').innerText(),/Saldo insuficiente/);assert.equal(await page.evaluate(()=>window.spinCalls),beforeLow);await page.evaluate(()=>{window.nhSaldoIndividual=100;window.fakeBalance=100});
   await page.keyboard.press('Escape');assert.equal(await hub.isVisible(),false);assert.equal(await page.locator(entry).evaluate(el=>el===document.activeElement),true);
  }
  if(viewport.width===1280){
   // Full Auto cap: exactly 10 server requests, with no restart after completion.
   await page.click('#cassino-abrir');await setup(lose,0);const before=await page.evaluate(()=>window.spinCalls);await page.locator('#nh-cassino-amor .nh-auto').click();
   await page.waitForFunction(()=>document.querySelector('#nh-cassino-amor .nh-auto').getAttribute('aria-checked')==='false',{},{timeout:35000});await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>window.spinCalls),before+10);await page.keyboard.press('Escape');
  }
  // Actual navigation shortcuts, independent of the wallet mock.
  await page.click('#cassino-abrir');await hub.locator('[data-nh-nav="perfil"]').click();assert.equal(await page.locator('#janela-configuracoes').isVisible(),true);await page.click('#fechar-configuracoes');
  await page.click('#cassino-abrir');await hub.locator('[data-nh-nav="bonus"]').first().click();assert.equal(await page.locator('#mascote-premios').isVisible(),true);await page.click('#mascote-premios-fechar');
  await page.click('#cassino-abrir');await hub.locator('[data-nh-nav="planos"]').click();assert.equal(await page.locator('#conteudo-planos').getAttribute('hidden'),null);await page.evaluate(()=>document.getElementById('fechar-planos').click());
  await page.click('#aba-btn-galeria');assert.equal(await page.locator('#aba-galeria').isVisible(),true);await page.click('#aba-btn-inicio');await page.click('#botao-tema');assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('tema-escuro')),true);
  for(const id of ['galeria','lista-historias','nosso-cineminha','chat-rodape','lista-musicas','quiz-amor','compat-casal'])assert.equal(await page.locator('#'+id).count(),1,id);
  await page.click('#aba-btn-jogos');await page.click('#cassino-abrir');await page.evaluate(()=>{usuario=null;historiaAtual=null});await page.waitForTimeout(450);assert.equal(await hub.isVisible(),false);
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  const broken=await page.locator('#nh-casinos img,#cassino-abrir img,#girinnho-abrir img').evaluateAll(els=>els.filter(e=>!e.complete||!e.naturalWidth).map(e=>e.getAttribute('src')));assert.deepEqual(broken,[]);
  report.push({viewport,passed:true,pageErrors:errors,missingResources:missing});console.log('PASS',viewport.width);await page.close();
 }
 console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
