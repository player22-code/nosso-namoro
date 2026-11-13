/* Integração da interface real com sessão/RPCs simuladas. Segurança/economia real têm suíte SQL própria. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { backend, install } = require("./helpers/supabase-falso.cjs");
const {
  fixture: legacyFixture,
  setup: legacySetup,
} = require("./patch-jogo.cjs");
const STATES = [
  "parado",
  "piscando",
  "feliz",
  "triste",
  "rindo",
  "comendo",
  "banho",
  "dormindo",
  "acordando",
  "carinho",
  "dancando",
  "pulando",
  "brincando",
  "comemorando",
];
function productionFixture() {
  const old = legacyFixture(),
    s = old.state,
    events = [],
    operations = new Map();
  let care = null,
    failAfterCommit = false;
  Object.assign(s, {
    producao: true,
    nivel: 3,
    experiencia: 250,
    xp_total: 280,
    xp_atual: 60,
    xp_proximo: 140,
    moedas: 180,
    casa: {},
    acessorio: null,
    brinquedo: null,
    cuidado_ativo: null,
    estatisticas: { alimentar: 3, banho: 1 },
    esperas: {},
    catalogo: [
      {
        id: "camiseta_rosa",
        nome: "Camiseta de coração",
        tipo: "roupa",
        categoria: "roupas",
        preco: 18,
        min_nivel: 1,
        asset: "pet-juvenil-parado.gif",
        descricao: "Camiseta rosa para o Patch.",
        slot: "roupa",
      },
      {
        id: "pijama_lilas",
        nome: "Pijama das estrelas",
        tipo: "roupa",
        categoria: "roupas",
        preco: 24,
        min_nivel: 1,
        asset: "pet-jovem-dormir.gif",
        descricao: "Pijama para descansar.",
        slot: "roupa",
      },
      {
        id: "oculos_coracao",
        nome: "Óculos de coração",
        tipo: "acessorio",
        categoria: "acessorios",
        preco: 22,
        min_nivel: 1,
        asset: "Patch_Jogo_Completo/objetos/coracao.svg",
        slot: "acessorio",
      },
      {
        id: "coroa_rosa",
        nome: "Coroa do carinho",
        tipo: "acessorio",
        categoria: "acessorios",
        preco: 45,
        min_nivel: 6,
        asset: "Patch_Jogo_Completo/objetos/coroa.svg",
        slot: "acessorio",
      },
      {
        id: "bola_rosa",
        nome: "Bola rosa",
        tipo: "brinquedo",
        categoria: "brinquedos",
        preco: 12,
        min_nivel: 1,
        asset: "Patch_Jogo_Completo/objetos/bola.svg",
        slot: "brinquedo",
      },
      {
        id: "ursinho_rosa",
        nome: "Ursinho fofo",
        tipo: "brinquedo",
        categoria: "brinquedos",
        preco: 25,
        min_nivel: 2,
        asset: "Patch_Jogo_Completo/objetos/ursinho.svg",
        slot: "brinquedo",
      },
      {
        id: "sofa_rosa",
        nome: "Sofá dos sonhos",
        tipo: "movel",
        categoria: "moveis",
        preco: 40,
        min_nivel: 3,
        asset: "Patch_Jogo_Completo/objetos/sofa.svg",
        slot: "sofa",
        comodo: "sala",
      },
      {
        id: "vaso_rosa",
        nome: "Vaso com flores",
        tipo: "decoracao",
        categoria: "decoracoes",
        preco: 14,
        min_nivel: 1,
        asset: "Patch_Jogo_Completo/objetos/flor.svg",
        slot: "planta",
        comodo: "sala",
      },
    ],
    missoes: [
      {
        id: "alimentar3",
        nome: "Três refeições",
        descricao: "Alimente o Patch três vezes.",
        progresso: 3,
        objetivo: 3,
        recompensa: { moedas: 5, xp: 4 },
        concluida: true,
        resgatada: false,
      },
      {
        id: "banho1",
        nome: "Banho do dia",
        descricao: "Complete um banho.",
        progresso: 0,
        objetivo: 1,
        recompensa: { moedas: 4, xp: 5 },
        concluida: false,
        resgatada: false,
      },
    ],
    conquistas: [
      {
        id: "primeira_compra",
        nome: "Primeira compra",
        descricao: "Compre um item.",
        icone: "🛍",
        progresso: 1,
        objetivo: 1,
        recompensa: { moedas: 5, xp: 0 },
        desbloqueada_em: "2026-11-13T00:00:00Z",
        resgatada: false,
      },
    ],
    renova_em: "2026-11-14T00:00:00Z",
  });
  s.catalogo_alimentos = s.catalogo_alimentos.map((f) => ({
    ...f,
    categoria: "comidas",
    min_nivel: 1,
    asset:
      f.id === "leite"
        ? null
        : "Patch_Jogo_Completo/objetos/" +
          (f.id === "bolinho" ? "bolo" : f.id) +
          ".svg",
  }));
  function careView() {
    return care
      ? {
          id: care.id,
          tipo: care.tipo,
          etapa: care.etapa,
          progresso: Math.min(
            100,
            Math.floor((care.blocks * 100) / care.total),
          ),
          blocos_concluidos: care.blocks,
          jogador_id: "alice",
          decorrido_ms: Date.now() - care.started,
          expira_em: new Date(care.started + 300000).toISOString(),
          concluido: care.done,
          cancelado: care.cancelled,
          desafio: {
            blocos: care.total,
            distancia_minima:
              care.tipo === "banho" ? 0.7 : care.tipo === "dentes" ? 0.45 : 0.6,
            duracao_minima: care.tipo === "carinho" ? 600 : 650,
            zonas: { x_min: 0, y_min: 0, x_max: 1, y_max: 1 },
            etapas:
              care.tipo === "banho"
                ? ["esfregar", "enxaguar", "secar"]
                : [care.tipo === "dentes" ? "escovar" : "acariciar"],
          },
        }
      : null;
  }
  function snapshot() {
    s.cuidado_ativo = care && !care.done && !care.cancelled ? careView() : null;
    return structuredClone(s);
  }
  function apply(action, item) {
    s.recompensa_acao = 0;
    if (action === "comprar") {
      const it = s.catalogo.find((i) => i.id === item);
      assert(it);
      assert(s.nivel >= it.min_nivel);
      assert(!s.inventario.includes(item));
      assert(s.moedas >= it.preco);
      s.moedas -= it.preco;
      s.inventario.push(item);
    } else if (action === "comprar_comida") {
      const it = s.catalogo_alimentos.find((i) => i.id === item);
      assert(it);
      assert(s.moedas >= it.preco);
      s.moedas -= it.preco;
      s.alimentos[item] = (s.alimentos[item] || 0) + 1;
    } else if (action === "vestir") s.roupa = item === "padrao" ? null : item;
    else if (action === "acessorio")
      s.acessorio = item === "padrao" ? null : item;
    else if (action === "brinquedo")
      s.brinquedo = item === "padrao" ? null : item;
    else if (action === "instalar") {
      const it = s.catalogo.find((i) => i.id === item);
      assert(s.inventario.includes(item));
      s.casa[it.comodo] ||= {};
      s.casa[it.comodo][it.slot] = item;
    } else if (action === "restaurar_casa") s.casa = {};
    else if (action === "resgatar_missao") {
      const m = s.missoes.find((m) => m.id === item);
      assert(m?.concluida && !m.resgatada);
      m.resgatada = true;
      s.moedas += m.recompensa.moedas;
    } else if (action === "resgatar_conquista") {
      const m = s.conquistas.find((m) => m.id === item);
      assert(m?.desbloqueada_em && !m.resgatada);
      m.resgatada = true;
      s.moedas += m.recompensa.moedas;
    } else if (action === "comodo") {
      assert(!care || care.done || care.cancelled);
      if (s.comodo !== item) s.dormindo = false;
      s.comodo = item;
    } else if (action === "dormir") {
      s.comodo = "quarto";
      s.dormindo = true;
    } else if (action === "acordar") s.dormindo = false;
    else if (action === "alimentar") {
      assert(s.alimentos[item] > 0);
      s.alimentos[item]--;
      s.necessidades.fome = Math.max(
        0,
        s.necessidades.fome -
          s.catalogo_alimentos.find((i) => i.id === item).saciedade,
      );
      s.recompensa_acao = 2;
      s.moedas += 2;
    } else if (action === "presente") {
      assert(s.presente_disponivel);
      s.presente_disponivel = false;
      s.moedas += 8;
    } else if (["brincar", "dancar", "regar"].includes(action)) {
      s.necessidades.diversao = Math.min(100, s.necessidades.diversao + 8);
    } else throw Error("Ação de teste desconhecida " + action);
    return snapshot();
  }
  return {
    state: s,
    events,
    operations,
    get care() {
      return care;
    },
    failPurchaseOnce() {
      failAfterCommit = true;
    },
    async rpc(name, a) {
      events.push({ name, a });
      if (name === "patch_ler") return snapshot();
      if (name === "patch_executar") {
        assert.match(a.p_op_id, /^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
        assert(!("moedas" in a));
        assert(!("premio" in a));
        if (operations.has(a.p_op_id)) return operations.get(a.p_op_id);
        const result = apply(a.p_acao, a.p_item);
        operations.set(a.p_op_id, result);
        if (failAfterCommit && a.p_acao === "comprar_comida") {
          failAfterCommit = false;
          const error = Error(
            "Conexão interrompida após confirmação no servidor de teste",
          );
          error.code = "NETWORK_ERROR";
          throw error;
        }
        return result;
      }
      if (name === "patch_cuidado_iniciar") {
        assert(["banho", "dentes", "carinho"].includes(a.p_tipo));
        assert(!care || care.done || care.cancelled);
        care = {
          id: crypto.randomUUID(),
          tipo: a.p_tipo,
          etapa:
            a.p_tipo === "banho"
              ? "esfregar"
              : a.p_tipo === "dentes"
                ? "escovar"
                : "acariciar",
          blocks: 0,
          total: a.p_tipo === "banho" ? 4 : a.p_tipo === "dentes" ? 3 : 1,
          started: Date.now(),
          stageAt: Date.now(),
          done: false,
          cancelled: false,
        };
        return { ...careView(), estado: snapshot() };
      }
      if (name === "patch_cuidado_avancar") {
        assert.equal(a.p_cuidado, care.id);
        assert.equal(a.p_etapa, care.etapa);
        if (["esfregar", "escovar", "acariciar"].includes(a.p_etapa)) {
          const points = a.p_gestos;
          assert(points.length >= 5 && points.length <= 80);
          const min = care.tipo === "carinho" ? 600 : 650;
          assert(points.at(-1).t - points[0].t >= min);
          for (const p of points) {
            assert(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
            assert(p.t <= Date.now() - care.started + 250);
          }
          const distance = points
            .slice(1)
            .reduce(
              (d, p, i) => d + Math.hypot(p.x - points[i].x, p.y - points[i].y),
              0,
            );
          assert(distance >= careView().desafio.distancia_minima);
          care.blocks++;
          if (care.tipo === "banho") {
            s.necessidades.higiene = Math.min(100, s.necessidades.higiene + 8);
            if (care.blocks === care.total) {
              care.etapa = "enxaguar";
              care.stageAt = Date.now();
            }
          } else if (care.tipo === "dentes") {
            s.necessidades.higiene = Math.min(100, s.necessidades.higiene + 5);
            care.done = care.blocks === care.total;
          } else care.done = true;
        } else if (a.p_etapa === "enxaguar") {
          assert(Date.now() - care.stageAt >= 500);
          care.etapa = "secar";
          care.stageAt = Date.now();
        } else if (a.p_etapa === "secar") {
          assert(Date.now() - care.stageAt >= 700);
          care.done = true;
          s.necessidades.higiene = Math.min(100, s.necessidades.higiene + 13);
        }
        if (care.done) {
          care.etapa = "concluido";
          s.recompensa_acao = care.tipo === "banho" ? 2 : 1;
          s.moedas += s.recompensa_acao;
          s.necessidades.carinho = Math.min(
            100,
            s.necessidades.carinho + (care.tipo === "carinho" ? 18 : 0),
          );
        }
        return {
          ...careView(),
          higiene_preview: s.necessidades.higiene,
          concluido: care.done,
          recompensa_acao: s.recompensa_acao || 0,
          estado: snapshot(),
        };
      }
      if (name === "patch_cuidado_cancelar") {
        assert.equal(a.p_cuidado, care.id);
        care.cancelled = true;
        return { cancelado: true, estado: snapshot() };
      }
      throw Error("RPC de teste desconhecida " + name);
    },
  };
}
async function setupProduction(page, db) {
  await install(page, backend());
  await page.exposeFunction("__productionRPC", (n, a) => db.rpc(n, a));
  await page.goto("http://127.0.0.1:8765");
  await page.waitForFunction(() => !!window.NH_PATCH_GAME);
  await page.evaluate(async () => {
    NH_PATCH_BRIDGE.context = () => ({
      storyId: "patch-test",
      userId: "alice",
      modo: "casal",
    });
    NH_PATCH_BRIDGE.rpc = (n, a) => window.__productionRPC(n, a);
    NH_PATCH_BRIDGE.subscribe = (_, fn) => {
      window.__productionSync = fn;
      return () => {};
    };
    document.querySelector("#conteudo-privado").style.display = "block";
    document.querySelector("#historia-painel").hidden = false;
    document.querySelector("#mascote-juntos").style.display = "block";
    await NH_PATCH_GAME.connect();
  });
  await page.locator("#patch-game").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () =>
      !!NH_PATCH_GAME.scene()?.petFSM && !!NH_PATCH_GAME.scene()?.body?.active,
  );
  await page.waitForTimeout(200);
}
async function go(page, room) {
  await page.locator(`[data-room="${room}"]`).click();
  await page.waitForFunction((r) => NH_PATCH_GAME.scene().room === r, room);
}
async function purchase(page, id) {
  await page.locator(`[data-ui-key="buy-${id}"]`).click();
  await page.locator(`[data-ui-key="confirm-${id}"]`).click();
  await page.waitForFunction(
    (id) => NH_PATCH_GAME.getState().inventario.includes(id),
    id,
  );
}
async function stroke(page) {
  await page
    .locator("#patch-stage canvas")
    .evaluate((e) =>
      e.scrollIntoView({ block: "center", behavior: "instant" }),
    );
  await page.waitForTimeout(60);
  const r = await page.locator("#patch-stage canvas").boundingBox(),
    area = await page.evaluate(() => NH_PATCH_GAME.care().region()),
    point = (x) => ({
      x: r.x + ((area.x + area.w * x) * r.width) / 480,
      y: r.y + ((area.y + area.h * 0.5) * r.height) / 640,
    });
  const start = point(0.2);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) {
    const p = point(i % 2 ? 0.2 : 0.8);
    await page.waitForTimeout(65);
    await page.mouse.move(p.x, p.y);
  }
  await page.mouse.up();
}
async function interactiveCare(page, db, type) {
  const action =
    type === "banho"
      ? "banho-real"
      : type === "dentes"
        ? "dentes-real"
        : "carinho";
  await page.locator(`[data-action="${action}"]`).click();
  await page.waitForFunction(
    (t) => NH_PATCH_GAME.care().session?.tipo === t,
    type,
  );
  const initial = db.state.necessidades.higiene,
    total = type === "banho" ? 4 : type === "dentes" ? 3 : 1;
  for (let i = 0; i < total; i++) {
    await stroke(page);
    await page.waitForFunction((n) => {
      const c = NH_PATCH_GAME.care();
      return !c.sending && (!c.session || c.session.blocos_concluidos >= n);
    }, i + 1);
    if (type === "banho" && i === 0) {
      assert(
        db.state.necessidades.higiene > initial,
        "hygiene increases after validated movement before final bath",
      );
      assert.equal(db.care.done, false);
    }
  }
  if (type === "banho") {
    assert.equal(
      await page.evaluate(() => NH_PATCH_GAME.care().session.etapa),
      "enxaguar",
    );
    await page
      .locator("#patch-actions")
      .getByRole("button", { name: "🚿 Enxaguar", exact: true })
      .click();
    await page.waitForFunction(
      () => NH_PATCH_GAME.care().session?.etapa === "secar",
    );
    await page
      .locator("#patch-actions")
      .getByRole("button", { name: "🧺 Secar", exact: true })
      .click();
  }
  await page.waitForFunction(() => !NH_PATCH_GAME.care().session);
  assert(db.care.done);
  assert.equal(db.state.cuidado_ativo, null);
}
module.exports = {
  productionFixture,
  setupProduction,
  go,
  stroke,
  interactiveCare,
};
if (require.main === module)
  (async () => {
    const browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    try {
      for (const width of process.env.PATCH_WIDTH
        ? [Number(process.env.PATCH_WIDTH)]
        : [320, 390, 1280]) {
        const page = await browser.newPage({
            viewport: {
              width,
              height: Number(process.env.PATCH_HEIGHT) || 1000,
            },
            hasTouch: true,
          }),
          db = productionFixture(),
          errors = [],
          missing = [];
        page.setDefaultTimeout(16000);
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("response", (r) => {
          if (r.status() >= 400 && r.url().includes("127.0.0.1"))
            missing.push(r.url());
        });
        await setupProduction(page, db);
        assert.equal(await page.locator("#patch-needs meter").count(), 5);
        assert(
          (await page.locator("#patch-needs").textContent()).includes(
            "Energia",
          ),
        );
        assert.match(
          await page.locator("#patch-nivel").textContent(),
          /60 \/ 140 XP/,
        );
        assert.equal(
          await page.evaluate(() => NH_PATCH_GAME.scene().body.texture.key),
          "patch-character",
        );
        assert(await page.locator("#patch-classico").isHidden());
        for (const state of STATES) {
          await page.evaluate(
            (s) => NH_PATCH_GAME.scene().petFSM.play(s, { duration: 350 }),
            state,
          );
          assert.equal(
            await page.evaluate(() => NH_PATCH_GAME.scene().petFSM.state),
            state,
          );
          assert.equal(
            await page.evaluate(() => NH_PATCH_GAME.scene().body.texture.key),
            "patch-character",
          );
        }
        await page.evaluate(() =>
          NH_PATCH_GAME.scene().petFSM.rest(
            NH_PATCH_GAME.getState().necessidades,
            false,
          ),
        );
        await page.locator('[data-patch-menu="loja"]').click();
        assert.equal(await page.locator("[data-category]").count(), 6);
        await page.locator('[data-category="acessorios"]').click();
        assert(
          await page.locator('[data-ui-key="buy-coroa_rosa"]').isDisabled(),
        );
        await page.locator('[data-category="roupas"]').click();
        const before = db.state.moedas;
        await page.locator('[data-ui-key="buy-camiseta_rosa"]').click();
        assert.equal(db.state.moedas, before);
        assert.equal(await page.locator(".patch-purchase-confirm").count(), 1);
        await page.locator('[data-ui-key="confirm-camiseta_rosa"]').click();
        await page.waitForFunction(() =>
          NH_PATCH_GAME.getState().inventario.includes("camiseta_rosa"),
        );
        await page.locator('[data-ui-key="equip-camiseta_rosa"]').click();
        await page.waitForFunction(
          () => NH_PATCH_GAME.getState().roupa === "camiseta_rosa",
        );
        assert(
          await page.evaluate(
            () => NH_PATCH_GAME.scene().clothes.commandBuffer.length > 0,
          ),
        );
        await page.locator('[data-category="moveis"]').click();
        await purchase(page, "sofa_rosa");
        await page.locator('[data-ui-key="equip-sofa_rosa"]').click();
        await page.waitForFunction(
          () => NH_PATCH_GAME.getState().casa.sala?.sofa === "sofa_rosa",
        );
        assert(
          await page.evaluate(() =>
            NH_PATCH_GAME.scene().houseObjects.some(
              (o) => o.texture?.key === "obj-sofa",
            ),
          ),
        );
        await page.locator("#patch-sheet-close").click();
        await page.locator('[data-patch-menu="tarefas"]').click();
        assert(
          await page.locator('[data-ui-key="mission-banho1"]').isDisabled(),
        );
        await page.locator('[data-ui-key="mission-alimentar3"]').click();
        await page.waitForFunction(
          () => NH_PATCH_GAME.getState().missoes[0].resgatada,
        );
        assert(
          await page.locator('[data-ui-key="mission-alimentar3"]').isDisabled(),
        );
        await page.locator("#patch-sheet-close").click();
        await page.locator('[data-patch-menu="conquistas"]').click();
        assert.match(
          await page
            .locator('[data-achievement="primeira_compra"]')
            .textContent(),
          /13\/11\/2026/,
        );
        await page
          .locator('[data-ui-key="achievement-primeira_compra"]')
          .click();
        await page.waitForFunction(
          () => NH_PATCH_GAME.getState().conquistas[0].resgatada,
        );
        await page.locator("#patch-sheet-close").click();
        await page.locator('[data-patch-menu="configuracoes"]').click();
        const volume = page.locator("#patch-production-volume");
        await volume.focus();
        const handle = await volume.elementHandle();
        await volume.fill("0.75");
        await page.evaluate(() => __productionSync());
        await page.waitForTimeout(250);
        assert(await handle.evaluate((n) => n.isConnected));
        assert.equal(
          await page.evaluate(() => NH_PATCH_GAME.getVolume()),
          0.75,
        );
        await page.locator('[data-ui-key="sound-enabled"]').uncheck();
        assert.equal(
          await page.locator("#patch-som").getAttribute("data-ativo"),
          "false",
        );
        await page.locator("#patch-sheet-close").click();
        if (width === 390) {
          await page.locator('[data-patch-menu="comidas"]').click();
          const coinsBefore = db.state.moedas,
            stockBefore = db.state.alimentos.banana;
          db.failPurchaseOnce();
          await page.locator('[data-ui-key="buy-banana"]').click();
          await page.locator('[data-ui-key="confirm-banana"]').click();
          await page.waitForSelector(".patch-production-warning");
          await page.locator('[data-ui-key="confirm-banana"]').click();
          await page.waitForFunction(
            (n) => NH_PATCH_GAME.getState().alimentos.banana === n,
            stockBefore + 1,
          );
          assert.equal(db.state.moedas, coinsBefore - 3);
          const buys = db.events.filter(
            (e) =>
              e.name === "patch_executar" &&
              e.a.p_acao === "comprar_comida" &&
              e.a.p_item === "banana",
          );
          assert.equal(buys.length, 2);
          assert.equal(buys[0].a.p_op_id, buys[1].a.p_op_id);
          await page.locator("#patch-sheet-close").click();
          await go(page, "banheiro");
          await interactiveCare(page, db, "banho");
          await interactiveCare(page, db, "dentes");
          await go(page, "sala");
          await interactiveCare(page, db, "carinho");
          console.log(
            "PASS production gestures: progressive bath, teeth, affection with real pointer movement and mock validation; retry reuses operation UUID without double debit",
          );
        }
        db.state.nivel = 4;
        db.state.xp_atual = 0;
        db.state.xp_proximo = 160;
        await page.evaluate(() => NH_PATCH_GAME.refresh());
        await page.waitForFunction(() => NH_PATCH_GAME.getState().nivel === 4);
        assert.equal(
          await page.evaluate(() => NH_PATCH_GAME.scene().petFSM.state),
          "comemorando",
        );
        assert.match(
          await page.locator("#patch-nivel").textContent(),
          /0 \/ 160 XP/,
        );
        await page.locator('[data-patch-menu="progresso"]').click();
        await page.waitForFunction(() =>
          [...document.querySelectorAll("#patch-sheet-body img")].every(
            (i) => i.complete && i.naturalWidth,
          ),
        );
        assert.equal(await page.locator("#patch-sheet-body img").count(), 5);
        await page.locator("#patch-sheet-close").click();
        assert.deepEqual(missing, []);
        assert.deepEqual(errors, []);
        assert(
          await page
            .locator("#patch-game")
            .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        );
        console.log(
          "PASS production",
          width,
          ": 14 states, audited atlas/assets, five needs/energy, progressive XP, six shop categories, confirmed purchases/equip/house, missions/achievements, audio preferences and responsive UI",
        );
        await page.close();
      }
    } finally {
      await browser.close();
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
