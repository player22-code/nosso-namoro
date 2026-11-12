/* Reactions only: Supabase responses are mocked. No live account or credit. */
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:8765';
const noWin=['cenoura','coracao','morango','coelho','moeda','estrela','trevo','coroa','cenoura','coracao','morango','coelho','moeda','estrela','trevo'];
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 for(const width of [1280,390,320]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[],missing=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)){requests.push(new URL(r.url()).pathname);if(r.status()>=400)missing.push(r.url())}});
  await page.route('https://**/*',route=>{if(route.request().url().includes('supabase.min.js'))return route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{}},removeChannel:()=>{},channel:()=>({on(){return this},subscribe(){return this}}),from:()=>{const q=new Proxy({}, {get:(t,k)=>k==='then'?r=>r({data:[],error:null}):()=>q});return q},rpc:async(n,args)=>{if(n==='nh_meu_saldo')return {data:window.testBalance??100};if(n==='cassino_girar'){window.lastArgs=args;window.spinCalls=(window.spinCalls||0)+1;if(window.testError)return {error:{message:'Erro simulado'}};const d=window.testResult;window.testBalance=d.saldo;return {data:d}};return {data:null}}})};`});return route.fulfill({body:'',contentType:'application/javascript'})});
  await page.goto(base);await page.waitForTimeout(100);await page.evaluate(()=>{usuario={id:'test-user'};historiaAtual={historia_id:'test-story'};modoAtual='casal';document.getElementById('conteudo-privado').style.display='block';document.getElementById('historia-painel').hidden=false;document.getElementById('login-painel').hidden=true;document.getElementById('janela-configuracoes').hidden=true;atualizarInterfaceModo()});await page.click('#aba-btn-jogos');
  for(const game of [
   {id:'cassino-amor',spin:'cassino-girar',bet:'cassino-aposta',reels:'cassino-grade',cell:'.cassino-celula img',effect:'ft-efeitos',prize:'ft-premio',title:'cassino-premio-titulo',value:'cassino-premio-valor',particle:'cassino-particulas',close:'cassino-fechar',hero:'.ft-cabecalho',pseudo:null,label:'AMOR'},
   {id:'girininho-modal',spin:'girininho-spin',bet:'girininho-bet',reels:'girininho-grid',cell:'.gi-cell img',effect:'girininho-particulas',prize:'girininho-premio',title:'girininho-premio-titulo',value:'girininho-premio-valor',particle:'girininho-particulas-imagem',close:'girininho-close',hero:'.gi-wrap',pseudo:'::before',label:'GIRINNHO'}
  ]){
   async function open(){if(game.id==='cassino-amor')await page.click('#cassino-abrir');else await page.evaluate(()=>window.abrirGirininhoSecreto())}
   await open();const root=page.locator('#'+game.id);assert.equal(await root.getAttribute('data-estado'),'idle');
   const art=()=>root.locator(game.hero).evaluate((el,pseudo)=>{const s=getComputedStyle(el,pseudo);return {animation:s.animationName,background:s.backgroundImage,transform:s.transform}},game.pseudo);
   assert.match((await art()).background,/cassinos-referencia\.jpg/);assert.equal((await art()).animation,'nh-arte-repouso');
   await page.selectOption('#'+game.bet,'2');
   for(const c of [
    {prize:0,symbols:noWin,state:'derrota',animation:'nh-arte-derrota'},
    {prize:6,symbols:['coelho','coelho','coelho','cenoura','moeda',...noWin.slice(5)],state:'vitoria',animation:'nh-arte-vitoria'},
    {prize:30,symbols:['coelho','coelho','coelho','coelho','coelho',...noWin.slice(5)],state:'grande_vitoria',animation:'nh-arte-grande-premio'},
    {prize:90,symbols:Array(15).fill('coelho'),state:'grande_vitoria',animation:'nh-arte-grande-premio'}
   ]){
    await page.evaluate(({prize,symbols})=>{window.testError=false;window.testResult={simbolos:symbols,premio:prize,saldo:98+prize}},{prize:c.prize,symbols:c.symbols});
    const before=await page.evaluate(()=>window.spinCalls||0);await page.click('#'+game.spin);
    assert.equal(await root.getAttribute('data-estado'),'girando');assert.equal((await art()).animation,'nh-arte-torcendo');
    await page.waitForFunction(id=>!document.getElementById(id).disabled,game.spin);
    assert.equal(await page.evaluate(()=>window.spinCalls),before+1);assert.deepEqual(await page.evaluate(()=>window.lastArgs),{p_story_id:'test-story',p_aposta:2});
    assert.equal(await root.getAttribute('data-estado'),c.state);assert.equal((await art()).animation,c.animation);assert.match((await art()).background,/cassinos-referencia\.jpg/);
    await root.locator(game.hero).evaluate(el=>el.scrollIntoView({block:'start'}));
    const first=(await art()).transform;let moved=false;for(let sample=0;sample<8;sample++){await page.waitForTimeout(120);if((await art()).transform!==first){moved=true;break}}
    assert.ok(moved,JSON.stringify({width,game:game.id,state:c.state,first,computed:await art(),running:await root.locator(game.hero).evaluate(el=>el.getAnimations({subtree:true}).map(a=>({name:a.animationName,time:a.currentTime,state:a.playState})))}));
    assert.deepEqual(await root.locator(game.cell).evaluateAll(els=>els.map(el=>el.alt)),c.symbols,'Final reels must not be overwritten by spin animation');
    assert.equal(await page.locator('#'+game.effect).isVisible(),c.prize>0);
    if(c.prize>0){
     assert.match(await page.locator('#'+game.title).innerText(),new RegExp(game.label));assert.match(await page.locator('#'+game.value).innerText(),new RegExp('\\+'+c.prize));
     assert.equal(await page.locator('#'+game.particle).getAttribute('src'),c.state==='grande_vitoria'?'efeito_grande_vitoria.gif':'efeito_moedas.gif');
     const img=page.locator('#'+game.particle);await img.evaluate(el=>el.decode());assert.ok(await img.evaluate(el=>el.naturalWidth>0));
    }
    if(c.prize===30)await page.screenshot({path:'/tmp/reacoes-'+game.id+'-'+width+'.png'});
   }
   if(width===1280){await page.waitForFunction(id=>document.getElementById(id).dataset.estado==='idle',game.id,{timeout:7000});assert.equal(await page.locator('#'+game.prize).isVisible(),false)}
   await page.evaluate(()=>window.testError=true);await page.click('#'+game.spin);await page.waitForFunction(id=>!document.getElementById(id).disabled,game.spin);assert.equal(await root.getAttribute('data-estado'),'idle');assert.equal(await page.locator('#'+game.prize).isVisible(),false);
   await page.click('#'+game.close);assert.equal(await root.isVisible(),false);await open();assert.equal(await root.getAttribute('data-estado'),'idle');assert.equal(await page.locator('#'+game.prize).isVisible(),false);await page.click('#'+game.close);
  }
  // Accessibility: the same illustrations and status remain when movement is reduced.
  await page.emulateMedia({reducedMotion:'reduce'});await page.click('#cassino-abrir');assert.equal(await page.locator('#cassino-amor .ft-cabecalho').evaluate(el=>getComputedStyle(el).animationName),'none');await page.click('#cassino-fechar');
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  for(const old of ['top3.webm','grande-ganho.webp','super-mega-ganho2.webp','speedlight.webm','stars.webm'])assert.ok(!requests.some(url=>url.endsWith('/'+old)),'Old tiger celebration requested: '+old);
  console.log('PASS',width,': original artwork, actual movement for every outcome, themed prizes, stable results, errors, reopen, reduced motion; no old tiger celebration or missing resource.');await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
