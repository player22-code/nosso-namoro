/* Isolated browser exercise of the production mini-game module; no personal data. */
const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const origin = "http://127.0.0.1:8765";
const html = `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/patch-game/styles/minigames.css"><style>body{margin:0;background:#f6e4f0}#patch-game{width:480px;position:relative;font-family:system-ui}#patch-stage{position:relative;width:480px;height:640px}button{font:600 14px system-ui;cursor:pointer}canvas{touch-action:pan-y}</style><div id="patch-game"><div id="patch-stage"></div></div><script src="/vendor/phaser-3.90.0.min.js"></script><script type="module">
import{installMiniGames}from'/patch-game/minigames.js';let serial=0;const settlements=[],cancelled=[];
const app={cancelGame(id){cancelled.push(id)},state:{comodo:'sala'},busy:false,actions(){},refreshControls(){},setDragMode(){},startGame(type,difficulty='normal'){const desafio={dificuldade:difficulty,duracao:type==='memoria'?120000:type==='estrelas'?12500:type==='passeio'?15000:12000};if(type==='memoria')desafio.cartas=[0,1,2,0,1,2];else if(type==='estrelas')desafio.tempos=[2000,3600,5200,6800,8400,10000,11600];else desafio.alvos=Array.from({length:type==='passeio'?3:8},(_,i)=>({id:i,x:[.2,.75,.45][i%3],inicio:type==='passeio'?1000+i*4000:i*1100,duracao:type==='passeio'?6000:3000}));scene.beginMini({id:'mini-'+(++serial),tipo:type,desafio});},finishGame(m,proof){settlements.push({id:m.id,tipo:m.tipo,proof,stats:{...m.stats}});if(window.failOnce){window.failOnce=false;scene.showMiniError(m,proof,new Error('Rede simulada'));return;}scene.showMiniResult({premio:m.stats.score>=3?3:0,acertos:m.stats.score},m)}};
let scene;class Harness extends Phaser.Scene{constructor(){super('mini-test')}preload(){for(const key of['sala','jardim','passeio'])this.load.image('room-'+key,'/patch/assets/'+key+'.webp');this.load.spritesheet('pet-bebe','/patch/assets/pet-bebe.webp',{frameWidth:256,frameHeight:256});for(const key of['coracao','estrela','bola','flor','moeda','ursinho'])this.load.svg('obj-'+key,'/Patch_Jogo_Completo/objetos/'+key+'.svg');}create(){scene=this;this.age='bebe';this.back=this.add.image(240,320,'room-sala').setDisplaySize(480,640);this.floorShadow=this.add.ellipse(240,458,110,18,0x8f5474,.18);this.pet=this.add.container(240,450);this.body=this.add.sprite(0,0,'pet-bebe',0).setOrigin(.5,1).setDisplaySize(190,190);this.pet.add(this.body);this.night=this.add.rectangle(240,320,480,640,0x332244,.5).setVisible(false);this.petFSM={update(){window.fsmTicks=(window.fsmTicks||0)+1}};window.h={scene,app,settlements,cancelled};}clearRoom(){this.pet.setVisible(true)}renderRoom(room){this.room=room;this.back.setTexture('room-'+room)}bindTap(obj,fn){obj.on('pointerup',fn)}walkTo(x){this.pet.x=x;return Promise.resolve()}burst(){}sfx(){}}
installMiniGames(Harness,{Phaser,app,reduced:{matches:false}});new Phaser.Game({type:Phaser.CANVAS,parent:'patch-stage',width:480,height:640,audio:{noAudio:true},scene:Harness});
</script></html>`;
async function tap(p, x, y) {
  await p.mouse.click(x, y);
}
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const p = await browser.newPage({ viewport: { width: 500, height: 740 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route(origin + "/__minis-test", (r) =>
      r.fulfill({ contentType: "text/html", body: html }),
    );
    await p.goto(origin + "/__minis-test");
    await p.waitForFunction(() => window.h?.scene);
    await p.evaluate(() => h.scene.showMiniIntro("memoria"));
    assert.match(
      await p.locator(".patch-mini-panel").textContent(),
      /três pares/,
    );
    await p.locator(".patch-mini-panel select").selectOption("hard");
    await p.getByRole("button", { name: "Começar partida" }).click();
    assert.equal(
      await p.evaluate(() => h.scene.mini.desafio.dificuldade),
      "hard",
    );
    for (const [a, b] of [
      [0, 3],
      [1, 4],
      [2, 5],
    ]) {
      for (const i of [a, b])
        await tap(p, 145 + (i % 2) * 190, 230 + Math.floor(i / 2) * 125);
    }
    await p
      .getByRole("button", { name: "Jogar novamente" })
      .waitFor({ timeout: 10000 });
    assert.equal(await p.evaluate(() => h.settlements.at(-1).stats.moves), 3);
    assert.equal(await p.evaluate(() => h.settlements.at(-1).proof.length), 3);
    await p
      .getByRole("button", { name: "Voltar ao Patch", exact: true })
      .click();
    assert.equal(await p.evaluate(() => h.scene.mini), null);
    assert(await p.evaluate(() => fsmTicks > 10));
    console.log(
      "PASS memory: real image cards, pairs, moves, timer, result, exit and FSM updates",
    );
    await p.evaluate(() => h.app.startGame("coracoes"));
    await p.keyboard.down("ArrowLeft");
    await p.waitForTimeout(150);
    await p.keyboard.up("ArrowLeft");
    assert(await p.evaluate(() => h.scene.miniPet.x < 230));
    while (await p.evaluate(() => h.scene.mini && !h.scene.mini.ending)) {
      const x = await p.evaluate(() => {
        const m = h.scene.mini;
        const target = m.targets
          .filter((x) => x.obj.active && !m.caught.has(x.id) && x.obj.y > 390)
          .sort((a, b) => b.obj.y - a.obj.y)[0];
        return target?.obj.x;
      });
      if (x !== undefined) await tap(p, x, 350);
      await p.waitForTimeout(45);
    }
    await p.getByRole("button", { name: "Jogar novamente" }).waitFor();
    assert((await p.evaluate(() => h.settlements.at(-1).proof.length)) >= 5);
    await p
      .getByRole("button", { name: "Voltar ao Patch", exact: true })
      .click();
    console.log(
      "PASS hearts: player movement, collision collection, timed score and result",
    );
    await p.evaluate(() => h.app.startGame("estrelas"));
    while (await p.evaluate(() => h.scene.mini && !h.scene.mini.ending)) {
      const jump = await p.evaluate(() => {
        const m = h.scene.mini,
          t = performance.now() - m.started;
        return m.desafio.tempos.some((hit) => hit - t > 280 && hit - t < 380);
      });
      if (jump)
        await p.getByRole("button", { name: "Saltar", exact: true }).click();
      await p.waitForTimeout(30);
    }
    await p.getByRole("button", { name: "Jogar novamente" }).waitFor();
    assert((await p.evaluate(() => h.settlements.at(-1).stats.score)) >= 5);
    assert((await p.evaluate(() => h.settlements.at(-1).stats.lives)) > 0);
    await p.getByRole("button", { name: "Jogar novamente" }).click();
    await p
      .getByRole("button", { name: "Jogar novamente" })
      .waitFor({ timeout: 10000 });
    assert.equal(await p.evaluate(() => h.settlements.at(-1).stats.lives), 0);
    assert.equal(await p.evaluate(() => h.settlements.at(-1).stats.score), 0);
    await p
      .getByRole("button", { name: "Voltar ao Patch", exact: true })
      .click();
    console.log(
      "PASS obstacles: jumps, collisions, lives, loss, result and restart",
    );
    await p.evaluate(() => {
      window.failOnce = true;
      h.app.startGame("memoria");
      h.scene.mini.started -= 120000;
    });
    await p.getByRole("button", { name: "Confirmar novamente" }).waitFor();
    const id = await p.evaluate(() => h.settlements.at(-1).id);
    await p.getByRole("button", { name: "Confirmar novamente" }).click();
    await p.getByRole("button", { name: "Jogar novamente" }).waitFor();
    assert.equal(await p.evaluate(() => h.settlements.at(-1).id), id);
    await p
      .getByRole("button", { name: "Voltar ao Patch", exact: true })
      .click();
    await p.evaluate(() => {
      h.app.startGame("coracoes");
      h.scene.cancelMini();
    });
    assert.equal(await p.evaluate(() => h.cancelled.length), 1);
    assert.deepEqual(errors, []);
    await p.screenshot({ path: "/tmp/patch-minigame-result.png" });
    console.log(
      "PASS timeout, partial loss and retry keeps the same operation id; no JavaScript errors",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
