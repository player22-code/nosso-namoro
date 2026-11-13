const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const { fixture, setup, room, tap } = require("./patch-jogo.cjs");
async function gesture(p, from, to) {
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from.x, y: from.y }],
  });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * i) / 12,
          y: from.y + ((to.y - from.y) * i) / 12,
        },
      ],
    });
    await p.waitForTimeout(20);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
  await p.waitForTimeout(350);
}
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of process.env.PATCH_WIDTH
      ? [Number(process.env.PATCH_WIDTH)]
      : [320, 390, 1280]) {
      const p = await b.newPage({
          viewport: { width, height: 900 },
          hasTouch: true,
          isMobile: width < 700,
        }),
        db = fixture(),
        errors = [];
      p.setDefaultTimeout(15000);
      p.on("pageerror", (e) => errors.push(e.message));
      for (const f of db.state.catalogo_alimentos) db.state.alimentos[f.id] = 3;
      await setup(p, db);
      await room(p, "quarto");
      await p
        .locator("#patch-actions")
        .getByRole("button", { name: /Dormir/ })
        .click();
      await p.waitForFunction(() => NH_PATCH_GAME.getState().dormindo);
      await room(p, "cozinha");
      assert.equal(
        await p.evaluate(() => NH_PATCH_GAME.getState().dormindo),
        false,
      );
      assert.equal(
        await p.evaluate(() => NH_PATCH_GAME.scene().night.visible),
        false,
      );
      for (const food of db.state.catalogo_alimentos) {
        db.state.necessidades.fome = 80;
        await p.evaluate(() => NH_PATCH_GAME.refresh());
        await p.locator(`[data-food-action="${food.id}"]`).click();
        await p.waitForFunction(
          (id) =>
            NH_PATCH_GAME.scene().lastFood === id &&
            NH_PATCH_GAME.scene().foodVisual?.active,
          food.id,
        );
        const actual = await p.evaluate(() => ({
          icon: NH_PATCH_GAME.scene().foodVisual.text,
          anim: NH_PATCH_GAME.scene().body.anims.currentAnim.key,
        }));
        assert.equal(actual.icon, food.icone);
        assert.match(actual.anim, /-idle$/);
        assert.doesNotMatch(actual.anim, /-eat$/);
      }
      await room(p, "banheiro");
      const soap = p.locator('[data-action="bath-sabao"]'),
        rinse = p.locator('[data-action="bath-chuveiro"]'),
        towel = p.locator('[data-action="bath-toalha"]');
      assert(await rinse.isDisabled());
      assert(await towel.isDisabled());
      const initial = db.events.filter((e) => e.a?.p_acao === "banho").length;
      await soap.click();
      assert(await soap.isDisabled());
      assert(await towel.isDisabled());
      await rinse.click();
      assert(await rinse.isDisabled());
      await towel.click();
      await p.waitForFunction(
        () => NH_PATCH_GAME.scene().bath.phase === "done",
      );
      assert.equal(
        db.events.filter((e) => e.a?.p_acao === "banho").length,
        initial + 1,
      );
      await room(p, "sala");
      await p.locator("#patch-stage canvas").scrollIntoViewIfNeeded();
      await p.waitForTimeout(100);
      const canvas = p.locator("#patch-stage canvas");
      assert.equal(
        await canvas.evaluate((e) => getComputedStyle(e).touchAction),
        "pan-y",
      );
      const rect = await canvas.boundingBox(),
        start = {
          x: rect.x + rect.width / 2,
          y: Math.min(780, rect.y + rect.height * 0.8),
        },
        before = await p.evaluate(() => scrollY),
        calls = db.events.filter((e) => e.name === "patch_acao").length;
      await gesture(p, start, { x: start.x, y: start.y - 210 });
      assert(
        (await p.evaluate(() => scrollY)) > before + 80,
        "vertical swipe scrolls the page",
      );
      assert.equal(
        db.events.filter((e) => e.name === "patch_acao").length,
        calls,
        "scroll must not pet/feed/walk",
      );
      if (width === 390) {
        await room(p, "cozinha");
        db.state.necessidades.fome = 80;
        await p.evaluate(() => NH_PATCH_GAME.refresh());
        await p.locator("#patch-drag-mode").click();
        await canvas.scrollIntoViewIfNeeded();
        const r = await canvas.boundingBox(),
          point = (x, y) => ({
            x: r.x + (x * r.width) / 480,
            y: r.y + (y * r.height) / 640,
          });
        const old = db.state.alimentos.cenoura;
        if (process.env.PATCH_DEBUG) {
          console.log(
            "DRAG POSITION",
            r,
            await p.evaluate(
              ({ x, y }) => ({
                hit: document.elementFromPoint(x, y)?.outerHTML.slice(0, 130),
                mode: document.querySelector("#patch-game").dataset.arrastar,
              }),
              point(130, 540),
            ),
          );
          await p.evaluate(() => {
            window.dragTrace = [];
            for (const name of [
              "pointerdown",
              "dragstart",
              "drag",
              "dragend",
              "pointerup",
            ])
              NH_PATCH_GAME.scene().input.on(name, (p, o) =>
                window.dragTrace.push([
                  name,
                  p.x,
                  p.y,
                  p.wasTouch,
                  o?._food,
                  o?.x,
                  o?.y,
                ]),
              );
          });
        }

        await gesture(p, point(130, 540), point(240, 345));
        if (process.env.PATCH_DEBUG)
          console.log("TRACE", await p.evaluate(() => window.dragTrace));
        await p.waitForFunction(
          (n) => NH_PATCH_GAME.getState().alimentos.cenoura === n,
          old - 1,
        );
        assert.equal(
          await p.locator("#patch-drag-mode").getAttribute("aria-pressed"),
          "false",
        );
        assert.equal(
          await canvas.evaluate((e) => getComputedStyle(e).touchAction),
          "pan-y",
        );
      }
      // Countdowns disable a care action rather than allowing repeated server errors.
      db.state.esperas = { carinho: 2 };
      db.state.comodo = "sala";
      await p.evaluate(() => NH_PATCH_GAME.refresh());
      const pet = p.locator('[data-action="carinho"]');
      assert(await pet.isDisabled());
      assert.match(await pet.textContent(), /Disponível em/);
      db.state.esperas = {};
      await p.waitForFunction(
        () => !document.querySelector('[data-action="carinho"]').disabled,
        null,
        { timeout: 5000 },
      );
      assert(await pet.isEnabled());
      assert.deepEqual(errors, []);
      assert(
        await p
          .locator("#patch-game")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      );
      console.log(
        "PASS controls",
        width,
        ": wake, six correct food animations, bath sequence/no double reward, native touch scroll/no accidental care, drag reset, cooldown feedback",
      );
      if (width === 390)
        await p
          .locator("#patch-game")
          .screenshot({ path: "/tmp/patch-controles-mobile.png" });
      await p.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
