// Real browser decoding/playback with a simulated backend; no user data is changed.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_URL||'http://127.0.0.1:8766';
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.fulfill({contentType:'application/javascript',body:r.request().url().includes('supabase.min.js')?`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{}},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{},from:()=>{const q=new Proxy({}, {get:(t,k)=>k==='then'?r=>r({data:[],error:null}):()=>q});return q},rpc:async()=>({data:[]})})};`:''}));
 await page.goto(base);
 await page.waitForFunction(()=>document.querySelectorAll('.nh-bedroom video').length===2&&[...document.querySelectorAll('.nh-bedroom video')].every(v=>v.readyState>=2));
 assert.ok(await page.locator('.nh-bedroom video').evaluateAll(vs=>vs.every(v=>v.paused&&v.muted&&v.playsInline&&!v.loop)));
 const set=async night=>page.evaluate(n=>document.body.classList.toggle('tema-escuro',n),night);
 const waitStatic=async()=>page.waitForFunction(()=>[...document.querySelectorAll('.nh-bedroom video')].every(v=>v.paused&&!v.classList.contains('is-playing')));
 await set(true);await page.waitForFunction(()=>document.querySelector('video[data-direction="night"]').currentTime>.1);await page.waitForFunction(()=>document.querySelector('.nh-bedroom').dataset.state==='night');await waitStatic();
 assert.equal(await page.locator('.nh-bedroom__night').evaluate(e=>getComputedStyle(e).opacity),'1');
 await set(false);await page.waitForFunction(()=>document.querySelector('video[data-direction="day"]').currentTime>.1);await waitStatic();
 assert.equal(await page.locator('.nh-bedroom__night').evaluate(e=>getComputedStyle(e).opacity),'0');
 // Reverse in flight; no overlapping players or stale ended callbacks may win.
 await set(true);await page.waitForFunction(()=>document.querySelector('video[data-direction="night"]').currentTime>.35);await set(false);await page.waitForTimeout(150);assert.ok(await page.locator('.nh-bedroom video').evaluateAll(vs=>vs.filter(v=>!v.paused).length<=1));await waitStatic();assert.equal(await page.locator('.nh-bedroom').getAttribute('data-state'),'day');
 for(const n of [true,false,true,false,true]){await set(n);await page.waitForTimeout(80)}await waitStatic();assert.equal(await page.locator('.nh-bedroom').getAttribute('data-state'),'night');
 await page.emulateMedia({reducedMotion:'reduce'});await set(false);await page.waitForTimeout(80);assert.equal(await page.locator('.nh-bedroom video.is-playing').count(),0);
 await page.screenshot({path:'/tmp/cabecalho-video-dia-'+width+'.png'});await set(true);await page.waitForTimeout(80);await page.screenshot({path:'/tmp/cabecalho-video-noite-'+width+'.png'});
 assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
 console.log('PASS video',width,': decoded both MP4s, forward/reverse playback, static endpoints, mid-flight reversal, rapid toggles, muted inline playback, reduced motion and no overflow/errors');await page.close();
}
// Video download/decoding failure must keep the static endpoints usable.
const p=await browser.newPage();await p.route('**/*.mp4',r=>r.abort());await p.route('https://**/*',r=>r.abort());await p.goto(base);await p.waitForSelector('.nh-bedroom');await p.evaluate(()=>document.body.classList.add('tema-escuro'));await p.waitForTimeout(200);assert.equal(await p.locator('.nh-bedroom video.is-playing').count(),0);assert.equal(await p.locator('.nh-bedroom__night').evaluate(e=>getComputedStyle(e).opacity),'1');console.log('PASS fallback: failed video keeps night poster visible');await p.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
