const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { backend, install } = require("./helpers/supabase-falso.cjs");
const catalogo = [
  ["camiseta_rosa", "Camiseta de coração", "roupa", 18],
  ["pijama_lilas", "Pijama das estrelas", "roupa", 24],
  ["oculos_coracao", "Óculos de coração", "roupa", 22],
  ["laco_dourado", "Laço dourado", "roupa", 28],
  ["tapete_flor", "Tapete de flor", "decoracao", 20],
  ["almofada_lilas", "Almofada lilás", "decoracao", 16],
  ["vaso_rosa", "Vaso com flores", "decoracao", 14],
].map(([id, nome, tipo, preco]) => ({ id, nome, tipo, preco }));
const catalogo_alimentos = [
  ["cenoura", "Cenoura", "🥕", 2, 25],
  ["maca", "Maçã", "🍎", 3, 20],
  ["leite", "Leite", "🥛", 4, 30],
  ["banana", "Banana", "🍌", 3, 25],
  ["morango", "Morango", "🍓", 4, 18],
  ["bolinho", "Bolinho", "🧁", 6, 35],
].map(([id, nome, icone, preco, saciedade]) => ({
  id,
  nome,
  icone,
  preco,
  saciedade,
}));
function fixture() {
  let s = {
    story_id: "patch-test",
    nome: "Patch",
    nivel: 12,
    experiencia: 1150,
    moedas: 80,
    necessidades: {
      fome: 60,
      higiene: 35,
      sono: 55,
      diversao: 60,
      carinho: 50,
    },
    dormindo: false,
    comodo: "sala",
    roupa: null,
    decoracao: null,
    inventario: [],
    catalogo,
    catalogo_alimentos,
    alimentos: {
      cenoura: 3,
      maca: 2,
      leite: 1,
      banana: 0,
      morango: 0,
      bolinho: 0,
    },
    recompensas_cuidados: 0,
    limite_cuidados: 30,
    progresso: {},
    presente_disponivel: true,
    missao_resgatada: false,
    xp_hoje: 0,
    jogos_hoje: 0,
  };
  let game;
  const events = [];
  return {
    events,
    get state() {
      return s;
    },
    async rpc(name, a) {
      events.push({ name, a });
      if (process.env.PATCH_DEBUG) console.log(name, JSON.stringify(a));
      if (name === "patch_ler") return s;
      if (name === "patch_acao") {
        const action = a.p_acao,
          item = a.p_item;
        s.recompensa_acao = 0;
        const reward =
          action === "alimentar"
            ? 2
            : action === "banho" && s.necessidades.higiene < 85
              ? 2
              : action === "carinho" && s.necessidades.carinho < 90
                ? 1
                : ["brincar", "dancar", "regar"].includes(action) &&
                    s.necessidades.diversao < 90
                  ? 1
                  : 0;
        if (action === "comodo") s.comodo = item;
        else if (action === "alimentar") {
          assert(s.alimentos[item] > 0);
          s.alimentos[item]--;
          s.necessidades.fome -= catalogo_alimentos.find(
            (f) => f.id === item,
          ).saciedade;
          s.progresso.alimentar = 1;
        } else if (action === "banho") {
          s.necessidades.higiene += 45;

          s.progresso.banho = 1;
        } else if (action === "carinho") {
          s.necessidades.carinho += 18;
          s.progresso.carinho = 1;
        } else if (action === "dormir") {
          s.dormindo = true;
          s.comodo = "quarto";
        } else if (action === "acordar") s.dormindo = false;
        else if (action === "comprar_comida") {
          const f = catalogo_alimentos.find((f) => f.id === item);
          assert(s.moedas >= f.preco);
          s.moedas -= f.preco;
          s.alimentos[item]++;
        } else if (action === "comprar") {
          const c = catalogo.find((c) => c.id === item);
          assert(c);
          assert(s.moedas >= c.preco);
          s.moedas -= c.preco;
          s.inventario.push(item);
        } else if (action === "vestir")
          s.roupa = item === "padrao" ? null : item;
        else if (action === "decorar")
          s.decoracao = item === "padrao" ? null : item;
        else if (action === "presente") {
          assert(s.presente_disponivel);
          s.moedas += 8;
          s.presente_disponivel = false;
        } else if (action === "missao") {
          assert(
            ["alimentar", "banho", "carinho"].every((k) => s.progresso[k] >= 1),
          );
          s.moedas += 10;
          s.missao_resgatada = true;
        }
        s.recompensa_acao = Math.min(reward, 30 - s.recompensas_cuidados);
        s.moedas += s.recompensa_acao;
        s.recompensas_cuidados += s.recompensa_acao;
        s.experiencia++;
        return s;
      }
      if (name === "patch_partida_iniciar") {
        const type = a.p_tipo;
        game = {
          id: "game-" + events.length,
          tipo: type,
          desafio:
            type === "memoria"
              ? { cartas: [0, 1, 2, 0, 1, 2] }
              : type === "estrelas"
                ? {
                    tempos: [2000, 3600, 5200, 6800, 8400, 10000, 11600],
                    duracao: 12500,
                  }
                : {
                    alvos: Array.from(
                      { length: type === "passeio" ? 3 : 8 },
                      (_, i) => ({
                        id: i,
                        x: [0.2, 0.75, 0.45][i % 3],
                        inicio: type === "passeio" ? 1000 + i * 4000 : i * 1100,
                        duracao: type === "passeio" ? 6000 : 3000,
                      }),
                    ),
                    duracao: type === "passeio" ? 15000 : 12000,
                  },
        };
        return game;
      }
      if (name === "patch_partida_finalizar") {
        assert.equal(a.p_partida, game.id);

        const hits =
          game.tipo === "estrelas"
            ? game.desafio.tempos.filter((t) =>
                a.p_resposta.some((j) => t - j >= 80 && t - j <= 600),
              ).length
            : game.tipo === "memoria"
              ? 6
              : a.p_resposta.length;
        const prize =
          hits >=
          (game.tipo === "passeio" ? 3 : game.tipo === "memoria" ? 6 : 5)
            ? game.tipo === "passeio"
              ? 1
              : 3
            : 0;
        s.moedas += prize;
        if (prize) s.jogos_hoje++;
        return { premio: prize, estado: s };
      }
      throw Error(name);
    },
  };
}
async function setup(page, db) {
  await install(page, backend());
  await page.exposeFunction("__patchRPC", (n, a) => db.rpc(n, a));
  await page.goto("http://127.0.0.1:8765");
  await page.evaluate(async () => {
    NH_PATCH_BRIDGE.context = () => ({
      storyId: "patch-test",
      userId: "alice",
      modo: "casal",
    });
    NH_PATCH_BRIDGE.rpc = (n, a) => window.__patchRPC(n, a);
    NH_PATCH_BRIDGE.subscribe = (story, fn) => {
      window.__patchSync = fn;
      return () => {};
    };
    document.querySelector("#conteudo-privado").style.display = "block";
    document.querySelector("#historia-painel").hidden = false;
    document.querySelector("#mascote-juntos").style.display = "block";
    await NH_PATCH_GAME.connect();
  });
  await page.locator("#patch-game").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !!NH_PATCH_GAME.scene());
  await page.waitForTimeout(200);
}
async function room(p, key) {
  await p.locator(`[data-room="${key}"]`).click();
  await p.waitForFunction((k) => NH_PATCH_GAME.scene().room === k, key);
}
async function tap(p, x, y) {
  const r = await p.locator("#patch-stage canvas").boundingBox();
  await p.mouse.click(r.x + (x * r.width) / 480, r.y + (y * r.height) / 640);
}
async function drag(p, x, y, toX, toY) {
  const c = p.locator("#patch-stage canvas");
  await c.scrollIntoViewIfNeeded();
  const r = await c.boundingBox();
  const xy = (x, y) => [r.x + (x * r.width) / 480, r.y + (y * r.height) / 640];
  await p.mouse.move(...xy(x, y));
  await p.mouse.down();
  await p.mouse.move(...xy(toX, toY), { steps: 20 });
  await p.mouse.up();
  await p.waitForTimeout(250);
}
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [320, 390, 1280]) {
      const p = await b.newPage({ viewport: { width, height: 1000 } }),
        db = fixture(),
        errors = [],
        missing = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("response", (r) => {
        if (r.status() >= 400 && r.url().includes("127.0.0.1"))
          missing.push(r.url());
      });
      p.setDefaultTimeout(12000);
      await setup(p, db);
      assert.equal(
        await p.locator("#patch-classico").getAttribute("open"),
        null,
      );
      assert.equal(await p.locator("#patch-needs meter").count(), 5);
      assert.equal(await p.locator("#patch-rooms button").count(), 6);
      await p.locator('[data-patch-menu="progresso"]').click();
      assert.equal(await p.locator("#patch-sheet-body img").count(), 5);
      assert.equal(await p.locator("#patch-sheet-body button").count(), 0);
      await p.locator("#patch-sheet-close").click();
      await p
        .locator("#patch-actions")
        .getByRole("button", { name: "Carinho" })
        .click();
      await p.waitForFunction(
        () => NH_PATCH_GAME.getState().progresso.carinho === 1,
      );
      await room(p, "cozinha");
      await drag(p, 130, 540, 240, 360);
      await p.waitForFunction(
        () => NH_PATCH_GAME.getState().necessidades.fome === 35,
      );
      assert.equal(db.state.moedas, 83);
      assert.equal(db.state.alimentos.cenoura, 2);
      await p.locator('[data-patch-menu="comidas"]').click();
      assert.equal(await p.locator("[data-food]").count(), 6);
      await p
        .locator('[data-food="banana"]')
        .getByRole("button", { name: "Comprar +1" })
        .click();
      await p.waitForFunction(
        () => NH_PATCH_GAME.getState().alimentos.banana === 1,
      );
      assert.equal(db.state.moedas, 80);
      await p
        .getByRole("button", { name: "Ir para a cozinha", exact: true })
        .click();
      await p
        .locator("#patch-actions")
        .getByRole("button", { name: /Banana/ })
        .click();
      await p.waitForFunction(
        () => NH_PATCH_GAME.getState().alimentos.banana === 0,
      );
      assert.equal(db.state.moedas, 82);
      assert.match(
        await p.locator("#patch-status").textContent(),
        /\+2 moedas/,
      );
      await room(p, "banheiro");
      await p.locator("#patch-actions").getByText("3 · Toalha").click();
      assert.equal(db.state.progresso.banho, undefined);
      await p.locator("#patch-actions").getByText("1 · Sabonete").click();
      await p.locator("#patch-actions").getByText("2 · Chuveiro").click();
      await p.locator("#patch-actions").getByText("3 · Toalha").click();
      await p.waitForFunction(
        () => NH_PATCH_GAME.getState().progresso.banho === 1,
      );
      await room(p, "quarto");
      await p.locator("#patch-actions").getByText("Dormir").click();
      await p.waitForFunction(() => NH_PATCH_GAME.getState().dormindo);
      assert(await p.evaluate(() => NH_PATCH_GAME.scene().night.visible));
      await p.locator("#patch-actions").getByText("Acordar").click();
      await p.waitForFunction(() => !NH_PATCH_GAME.getState().dormindo);
      await room(p, "jardim");
      await p.locator("#patch-actions").getByText("Regar").click();
      assert(db.events.some((e) => e.a?.p_acao === "regar"));
      await p.locator("#patch-actions").getByText("bola").click();
      assert(db.events.some((e) => e.a?.p_acao === "brincar"));
      await p.locator('[data-patch-menu="tarefas"]').click();
      if (process.env.PATCH_DEBUG) {
        await p
          .locator("#patch-game")
          .screenshot({ path: "/tmp/patch-menu.png" });
        console.log(
          "MENU",
          await p
            .getByText("Resgatar missão · +10 moedas", { exact: true })
            .evaluate((e) => ({
              rect: e.getBoundingClientRect().toJSON(),
              ancestors: [e.parentElement, e.closest("#patch-overlay")].map(
                (x) => ({
                  class: x.className,
                  z: getComputedStyle(x).zIndex,
                  hidden: x.hidden,
                }),
              ),
              elements: document
                .elementsFromPoint(
                  e.getBoundingClientRect().x + 20,
                  e.getBoundingClientRect().y + 20,
                )
                .slice(0, 5)
                .map((x) => x.tagName + ":" + x.id),
            })),
        );
      }
      await p
        .getByText("Resgatar missão · +10 moedas", { exact: true })
        .click();
      await p.waitForFunction(() => NH_PATCH_GAME.getState().missao_resgatada);
      await p.getByText("Presente diário · +8 moedas", { exact: true }).click();
      await p.waitForFunction(
        () => !NH_PATCH_GAME.getState().presente_disponivel,
      );
      assert(db.state.missao_resgatada);
      assert(!db.state.presente_disponivel);
      await p.locator("#patch-sheet-close").click();
      await p.locator('[data-patch-menu="loja"]').click();
      const shirt = p
        .locator(".patch-shop-item")
        .filter({ hasText: "Camiseta de coração" });
      await shirt.getByRole("button", { name: "Comprar" }).click();
      await shirt.getByRole("button", { name: "Usar", exact: true }).click();
      await p.waitForFunction(
        () => NH_PATCH_GAME.getState().roupa === "camiseta_rosa",
      );
      assert.equal(db.state.roupa, "camiseta_rosa");
      await p.locator("#patch-sheet-close").click();
      await p.locator('[data-patch-menu="inventario"]').click();
      assert.equal(await p.locator(".patch-shop-item").count(), 1);
      await p.keyboard.press("Escape");
      assert(await p.locator("#patch-overlay").isHidden());
      // Simula uma atualização Realtime do outro integrante, sem recarregar a página.
      db.state.comodo = "sala";
      db.state.moedas = 97;
      await p.evaluate(() => __patchSync());
      await p.waitForFunction(
        () =>
          NH_PATCH_GAME.getState().moedas === 97 &&
          NH_PATCH_GAME.scene().room === "sala",
      );
      for (const [nivel, a] of [
        [1, "bebe"],
        [5, "filhote"],
        [10, "juvenil"],
        [20, "jovem"],
        [30, "adulto"],
      ]) {
        db.state.nivel = nivel;
        await p.evaluate(() => NH_PATCH_GAME.refresh());
        await p.waitForFunction((a) => NH_PATCH_GAME.scene().age === a, a);
      }
      const measurements = await p.locator("#patch-game").evaluate((e) => ({
        client: e.clientWidth,
        scroll: e.scrollWidth,
        labels: [...e.querySelectorAll(".patch-need b")].map(
          (b) => getComputedStyle(b).color,
        ),
        wallet: e.querySelector(".patch-wallet").getBoundingClientRect().right,
        right: e.getBoundingClientRect().right,
      }));
      assert(measurements.scroll <= measurements.client + 1);
      assert(measurements.wallet <= measurements.right);
      assert(measurements.labels.every((c) => c === "rgb(99, 55, 89)"));
      assert.deepEqual(missing, []);
      assert.deepEqual(errors, []);
      if (width === 390) {
        await p
          .locator("#patch-game")
          .screenshot({ path: "/tmp/patch-jogo-mobile.png" });
        for (const type of ["memoria", "coracoes", "estrelas", "passeio"]) {
          await p.evaluate((t) => NH_PATCH_GAME.startGame(t), type);
          await p.waitForFunction(
            (t) => NH_PATCH_GAME.scene().mini?.tipo === t,
            type,
          );
          await p.locator("#patch-stage canvas").scrollIntoViewIfNeeded();
          if (type === "memoria") {
            for (const [a, c] of [
              [0, 3],
              [1, 4],
              [2, 5],
            ]) {
              await tap(p, 145 + (a % 2) * 190, 220 + Math.floor(a / 2) * 135);
              await tap(p, 145 + (c % 2) * 190, 220 + Math.floor(c / 2) * 135);
            }
          } else {
            while (await p.evaluate(() => !!NH_PATCH_GAME.scene().mini)) {
              const m = await p.evaluate(() => {
                const s = NH_PATCH_GAME.scene(),
                  m = s.mini;
                if (!m || m.ending) return null;
                const t = performance.now() - m.started;
                return {
                  tipo: m.tipo,
                  t,
                  targets: m.targets
                    .filter((x) => x.obj.active && !m.caught.has(x.id))
                    .map((x) => ({ x: x.obj.x, y: x.obj.y })),
                  times: m.desafio.tempos,
                };
              });
              if (
                m?.tipo === "estrelas" &&
                m.times.some((hit) => hit - m.t > 250 && hit - m.t < 420)
              )
                await tap(p, 240, 550);
              else if (m?.targets.length && type !== "estrelas")
                await tap(p, m.targets[0].x, m.targets[0].y);
              await p.waitForTimeout(type === "passeio" ? 600 : 100);
            }
          }
          await p.waitForFunction(() => !NH_PATCH_GAME.scene().mini, null, {
            timeout: 20000,
          });
          assert.equal(
            await p.evaluate(() => NH_PATCH_GAME.scene().room),
            "sala",
          );
          assert(
            await p.evaluate(() => NH_PATCH_GAME.scene().objects.length > 0),
          );
          console.log("PASS activity", type);
        }
        assert.equal(db.state.jogos_hoje, 4);
        const coins = db.state.moedas;
        await p.evaluate(() => NH_PATCH_GAME.startGame("coracoes"));
        await p.waitForFunction(() => !NH_PATCH_GAME.scene().mini, null, {
          timeout: 20000,
        });
        assert.equal(db.state.moedas, coins);
        assert.match(
          await p.locator("#patch-status").textContent(),
          /Tente novamente/,
        );
        console.log("PASS loss: no reward");
        assert.deepEqual(errors, []);
      }
      console.log(
        "PASS Patch",
        width,
        ": rooms, drag food, bath sequence, sleep, garden, missions, shop, ages, realtime, responsive and paths",
      );
      await p.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
