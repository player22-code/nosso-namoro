/* Faces are rendered as local masked frames; original scene must remain pixel-identical.
   Run with Playwright + Chromium, serving this repo on TEST_URL or port 8765.
   Supabase is mocked; no account or wallet is changed by this test. */
const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const {execFileSync}=require('node:child_process');
const base=process.env.TEST_URL||'http://127.0.0.1:8765';const out=process.env.CAPTURE_DIR||'/tmp/cassinos-expressoes';fs.mkdirSync(out,{recursive:true});
const noWin=['cenoura','coracao','morango','coelho','moeda','estrela','trevo','coroa','cenoura','coracao','morango','coelho','moeda','estrela','trevo'];
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
for(const width of (process.argv[2]||'1280,390,320').split(',').map(Number)){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[],missing=[],requested=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)){requested.push(new URL(r.url()).pathname);if(r.status()>=400)missing.push(r.url())}});
 await page.route('https://**/*',route=>{if(route.request().url().includes('supabase.min.js'))return route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{}},removeChannel:()=>{},channel:()=>({on(){return this},subscribe(){return this}}),from:()=>{const q=new Proxy({}, {get:(t,k)=>k==='then'?r=>r({data:[],error:null}):()=>q});return q},rpc:async(n,args)=>{if(n==='nh_meu_saldo')return {data:window.testBalance??100};if(n==='cassino_girar'){window.lastArgs=args;window.spinCalls=(window.spinCalls||0)+1;if(window.testError)return {error:{message:'Erro simulado'}};const data=window.testResult;window.testBalance=data.saldo;return {data}};return {data:null}}})};`});return route.fulfill({body:'',contentType:'application/javascript'})});
 // Pixel captures can outlast the existing 5.5s presentation reset; extend only that visual timer.
 await page.addInitScript(()=>{const original=setTimeout;window.setTimeout=(fn,delay,...args)=>original(fn,delay===5500?30000:delay,...args)});
 await page.goto(base);await page.waitForTimeout(100);await page.evaluate(()=>{usuario={id:'test-user'};historiaAtual={historia_id:'test-story'};modoAtual='casal';document.getElementById('conteudo-privado').style.display='block';document.getElementById('historia-painel').hidden=false;document.getElementById('login-painel').hidden=true;document.getElementById('janela-configuracoes').hidden=true;atualizarInterfaceModo()});await page.click('#aba-btn-jogos');
 for(const game of [
  {id:'cassino-amor',spin:'cassino-girar',bet:'cassino-aposta',close:'cassino-fechar',header:'.ft-cabecalho',mask:[334,132,89,58],prize:'ft-premio'},
  {id:'girininho-modal',spin:'girininho-spin',bet:'girininho-bet',close:'girininho-close',header:'.nh-girinnho-cabecalho',mask:[391,82,46,59],prize:'girininho-premio'}
 ]){
  async function open(){if(game.id==='cassino-amor')await page.click('#cassino-abrir');else await page.evaluate(()=>window.abrirGirininhoSecreto())}
  await open();const root=page.locator('#'+game.id),header=root.locator(game.header),layer=root.locator('.nh-expression-layer');
  await page.waitForFunction(id=>document.querySelector('#'+id+' .nh-expression-layer').dataset.ready==='true',game.id);
  assert.equal(await layer.isVisible(),false);const initial=await header.evaluate(el=>({bg:getComputedStyle(el).backgroundImage,animation:getComputedStyle(el).animationName,transform:getComputedStyle(el).transform,filter:getComputedStyle(el).filter}));assert.equal(initial.animation,'none');assert.equal(initial.transform,'none');assert.equal(initial.filter,'none');assert.match(initial.bg,/cassinos-referencia/);
  await header.evaluate(el=>el.scrollIntoView({block:'start'}));const neutral=out+'/'+game.id+'-'+width+'-idle.png';await header.screenshot({path:neutral});
  await page.selectOption('#'+game.bet,'2');
  for(const c of [
   {prize:6,state:'vitoria',range:[0,3],symbols:['coelho','coelho','coelho','cenoura','moeda',...noWin.slice(5)]},
   {prize:0,state:'derrota',range:[4,7],symbols:noWin},
   {prize:30,state:'grande_vitoria',range:[8,11],symbols:['coelho','coelho','coelho','coelho','coelho',...noWin.slice(5)]}
  ]){
   await page.evaluate(c=>{window.testError=false;window.testResult={simbolos:c.symbols,premio:c.prize,saldo:98+c.prize}},c);const before=await page.evaluate(()=>window.spinCalls||0);await page.click('#'+game.spin);assert.equal(await root.getAttribute('data-estado'),'girando');assert.equal(await layer.isVisible(),false);
   await page.waitForFunction(id=>!document.getElementById(id).disabled,game.spin);assert.equal(await root.getAttribute('data-estado'),c.state);assert.equal(await page.evaluate(()=>window.spinCalls),before+1);assert.deepEqual(await page.evaluate(()=>window.lastArgs),{p_story_id:'test-story',p_aposta:2});assert.equal(await layer.isVisible(),true);
   let frame=Number(await layer.getAttribute('data-frame'));assert.ok(frame>=c.range[0]&&frame<=c.range[1]);await page.waitForFunction(({id,frame})=>Number(document.querySelector('#'+id+' .nh-expression-layer').dataset.frame)!==frame,{id:game.id,frame},{timeout:5000});
   const alpha=await layer.evaluate(el=>{const a=el.getContext('2d').getImageData(0,0,640,286).data;let outside=0,inside=0;const [cx,cy,rx,ry]=JSON.parse(el.dataset.mask||'[]');for(let y=0;y<286;y++)for(let x=0;x<640;x++){const v=a[(y*640+x)*4+3];if(v){inside++;if(((x-cx)/rx)**2+((y-cy)/ry)**2>1.08)outside++}}return {inside,outside}});
   assert.deepEqual(await root.locator(game.id==='cassino-amor'?'.cassino-celula img':'.gi-cell img').evaluateAll(els=>els.map(e=>e.alt)),c.symbols);
   assert.ok(alpha.inside>500);assert.equal(alpha.outside,0,'No expression pixels may leave the character mask');
   await header.evaluate(el=>el.scrollIntoView({block:'start'}));const current=await header.evaluate(el=>({bg:getComputedStyle(el).backgroundImage,animation:getComputedStyle(el).animationName,transform:getComputedStyle(el).transform,filter:getComputedStyle(el).filter}));assert.deepEqual(current,initial,'The complete banner must never move, zoom or change its background');
   // Capture a deterministic expression for visual review and compare every scene pixel.
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(60);
   // Compare at one scroll/raster position. Only the rounded 24px corner clip (the card radius is 22px) is ignored
   // because Chromium changes its edge antialiasing when a transparent canvas is hidden.
   // A 2px capture rim is also excluded to avoid the fractional crop including the grid below.
   const aligned=out+'/'+game.id+'-'+width+'-'+c.state+'-original.png';
   await layer.evaluate(el=>el.style.visibility='hidden');await header.screenshot({path:aligned});await layer.evaluate(el=>el.style.visibility='');
   const reaction=out+'/'+game.id+'-'+width+'-'+c.state+'.png';await header.screenshot({path:reaction});
   const pixelCheck=execFileSync('python',['-c',`from PIL import Image,ImageChops\nimport sys,json\na=Image.open(sys.argv[1]).convert('RGB');b=Image.open(sys.argv[2]).convert('RGB');assert a.size==b.size\nw,h=a.size;cx,cy,rx,ry=json.loads(sys.argv[3]);box=((cx-rx)*w/640-2,(cy-ry)*h/286-2,(cx+rx)*w/640+2,(cy+ry)*h/286+2)\nd=ImageChops.difference(a,b);count=0;outside=0\nfor y in range(h):\n for x in range(w):\n  if 2<=x<w-2 and 2<=y<h-2 and max(d.getpixel((x,y)))>2:\n   count+=1\n   if not(box[0]<=x<=box[2] and box[1]<=y<=box[3]) and not ((x<24 or x>=w-24) and (y<24 or y>=h-24)):outside+=1\nassert count>30,(count,'face did not change')\nassert outside==0,(outside,'background/title/decoration changed')\nprint(count)`,aligned,reaction,JSON.stringify(game.mask)],{encoding:'utf8'}).trim();
   assert.ok(Number(pixelCheck)>30);
   const staticFrame=await layer.getAttribute('data-frame');await page.waitForTimeout(250);assert.equal(await layer.getAttribute('data-frame'),staticFrame,'Reduced motion retains expression without cycling');await page.emulateMedia({reducedMotion:'no-preference'});
   if(c.prize===30)await page.screenshot({path:out+'/'+game.id+'-'+width+'-pagina.png'});
  }
  await page.evaluate(()=>window.testError=true);await page.click('#'+game.spin);await page.waitForFunction(id=>!document.getElementById(id).disabled,game.spin);assert.equal(await root.getAttribute('data-estado'),'idle');assert.equal(await layer.isVisible(),false);
  await page.click('#'+game.close);assert.equal(await root.isVisible(),false);await open();assert.equal(await layer.isVisible(),false);await page.click('#'+game.close);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);for(const old of ['top3.webm','grande-ganho.webp','super-mega-ganho2.webp','speedlight.webm','stars.webm'])assert.ok(!requested.some(url=>url.endsWith('/'+old)),'Old tiger celebration: '+old);console.log('PASS',width,': expressions change only character pixels; scene/title static; correct win/loss/big-win, RPC, reduced motion, errors and reopen.');await page.close();
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
