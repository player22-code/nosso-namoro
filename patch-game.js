/* Nosso Patch — Phaser 3.90.0. Toda alteração de saldo/progresso passa por RPCs autenticadas. */
(() => {
  "use strict";
  const root = document.getElementById("patch-game"),
    bridge = window.NH_PATCH_BRIDGE;
  if (!root || !bridge) return;
  const $ = (id) => document.getElementById(id),
    rooms = {
      sala: ["⌂", "Sala"],
      cozinha: ["♨", "Cozinha"],
      banheiro: ["♧", "Banheiro"],
      quarto: ["☾", "Quarto"],
      jardim: ["❀", "Jardim"],
      passeio: ["♧", "Passeio"],
    };
  const icons = {
    camiseta_rosa: "👕",
    pijama_lilas: "🌙",
    oculos_coracao: "👓",
    laco_dourado: "🎀",
    tapete_flor: "🌸",
    almofada_lilas: "🛋",
    vaso_rosa: "🌷",
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    age = (n) =>
      n < 5
        ? "bebe"
        : n < 10
          ? "filhote"
          : n < 20
            ? "juvenil"
            : n < 30
              ? "jovem"
              : "adulto";
  const el = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const App = {
    state: null,
    story: null,
    user: null,
    generation: 0,
    busy: false,
    scene: null,
    game: null,
    booting: false,
    visible: false,
    unsubscribe: null,
    poll: null,
    refreshTimer: null,
    reading: null,
    menu: null,
    focusBack: null,
    message(text, error = false) {
      $("patch-status").textContent = text;
      $("patch-status").dataset.error = String(error);
    },
    setBusy(v) {
      this.busy = v;
      root.setAttribute("aria-busy", String(v));
      root.querySelectorAll("button:not(.patch-close)").forEach((b) => {
        b.disabled = v || b.dataset.locked === "true";
      });
    },
    async connect() {
      const c = bridge.context();
      if (!c.userId || !c.storyId) {
        this.disconnect();
        return;
      }
      if (this.story === c.storyId && this.user === c.userId) {
        if (!this.state) this.refresh();
        return;
      }
      this.disconnect();
      this.story = c.storyId;
      this.user = c.userId;
      const gen = this.generation;
      this.message("Conectando ao Patch…");
      try {
        const s = await bridge.rpc("patch_ler", { p_story: this.story });
        if (gen !== this.generation) return;
        this.accept(s);
        if (this.visible) this.boot();
      } catch (e) {
        if (gen === this.generation) this.connectionError(e);
      }
    },
    disconnect() {
      this.generation++;
      clearInterval(this.poll);
      this.poll = null;
      clearTimeout(this.refreshTimer);
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.story = this.user = null;
      this.state = null;
      this.reading = null;
      this.busy = false;
      this.closeMenu();
      this.scene?.cancelMini(false);
      if (this.scene) this.scene.input.enabled = false;
      $("patch-moedas").textContent = "—";
      $("patch-nivel").textContent = "Preparando seu cantinho…";
      $("patch-xp").style.width = "0%";
      $("patch-needs").replaceChildren();
      $("patch-loading").hidden = false;
      $("patch-loading").textContent = "Conectando ao Patch…";
      root.dataset.conectado = "false";
      $("mascote-juntos").classList.remove("patch-conectado");
      $("patch-classico").open = true;
      this.message("Entre em uma história para cuidar do Patch.");
    },
    connectionError(e) {
      this.message(
        "Não foi possível conectar ao novo Patch. Os cuidados clássicos continuam disponíveis.",
        true,
      );
      $("patch-loading").textContent = "Conexão indisponível";
      $("patch-loading").hidden = false;
      $("patch-loading").style.pointerEvents = "none";
      if (!$("patch-retry")) {
        const b = el(
          "button",
          "Tentar conectar novamente",
          "patch-error-retry",
        );
        b.id = "patch-retry";
        b.onclick = () => this.refresh();
        $("patch-status").after(b);
      }
    },
    scheduleRefresh() {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => this.refresh(), 180);
    },
    async refresh() {
      if (!this.story || this.busy || this.reading) return;
      const gen = this.generation,
        story = this.story;
      const task = bridge.rpc("patch_ler", { p_story: story });
      this.reading = task;
      try {
        const s = await task;
        if (gen === this.generation) this.accept(s);
      } catch (e) {
        if (gen === this.generation)
          this.message(
            "Conexão instável. O progresso já confirmado continua salvo.",
            true,
          );
      } finally {
        if (this.reading === task) this.reading = null;
      }
    },
    accept(s) {
      if (
        !s ||
        s.story_id !== this.story ||
        !s.necessidades ||
        !Array.isArray(s.catalogo)
      )
        throw new Error("Estado do Patch indisponível");
      const first = !this.state;
      this.state = s;
      if (!this.unsubscribe) {
        try {
          this.unsubscribe = bridge.subscribe(this.story, () =>
            this.scheduleRefresh(),
          );
        } catch {}
      }
      if (!this.poll)
        this.poll = setInterval(() => {
          if (!document.hidden && this.visible) this.refresh();
        }, 15000);
      root.dataset.conectado = "true";
      $("mascote-juntos").classList.add("patch-conectado");
      if (first) $("patch-classico").open = false;
      $("patch-retry")?.remove();
      this.hud();
      if (this.scene) {
        this.scene.input.enabled = !this.menu;
        this.scene.applyState(s);
        $("patch-loading").hidden = true;
      } else if (this.visible) this.boot();
      if (this.menu) this.renderMenu();
    },
    hud() {
      const s = this.state;
      if (!s) return;
      $("patch-nivel").textContent =
        "Nível " + s.nivel + " · " + (s.experiencia % 100) + " / 100 XP";
      $("patch-xp").style.width = (s.experiencia % 100) + "%";
      root
        .querySelector(".patch-xp")
        .setAttribute("aria-valuenow", String(s.experiencia % 100));
      $("patch-moedas").textContent = Number(s.moedas).toLocaleString("pt-BR");
      $("patch-sync").textContent =
        (bridge.context().modo === "solo"
          ? "Seu progresso"
          : "Progresso compartilhado pelo casal") +
        " · Moedas exclusivas do Patch";
      const area = $("patch-needs");
      area.replaceChildren();
      for (const [key, name, inverse] of [
        ["fome", "Fome", true],
        ["higiene", "Higiene"],
        ["sono", "Sono", true],
        ["diversao", "Diversão"],
        ["carinho", "Carinho"],
      ]) {
        const value = Math.max(
          0,
          Math.min(
            100,
            inverse ? 100 - s.necessidades[key] : s.necessidades[key],
          ),
        );
        const box = el("div", undefined, "patch-need"),
          label = el("b", name),
          meter = el("meter");
        meter.min = 0;
        meter.max = 100;
        meter.low = 30;
        meter.high = 70;
        meter.optimum = 100;
        meter.value = value;
        meter.setAttribute(
          "aria-label",
          (key === "fome" ? "Saciedade" : key === "sono" ? "Descanso" : name) +
            ": " +
            Math.round(value) +
            "%",
        );
        box.title =
          key === "fome"
            ? "A barra cai quando fica com fome"
            : key === "sono"
              ? "A barra sobe quando descansa"
              : name;
        box.append(label, meter, el("span", Math.round(value) + "%"));
        area.append(box);
      }
      $("patch-comodo").textContent =
        (rooms[s.comodo]?.[1] || "Sala") +
        (s.dormindo ? " · Dormindo ☾" : " ♡");
      for (const b of $("patch-rooms").children)
        b.setAttribute("aria-pressed", String(b.dataset.room === s.comodo));
      this.actions();
    },
    actions() {
      const area = $("patch-actions");
      area.replaceChildren();
      if (!this.state) return;
      if (this.scene?.mini) {
        const b = el("button", "Sair da atividade");
        b.onclick = () => this.scene.cancelMini();
        area.append(b);
        if (this.scene.mini.tipo === "estrelas") {
          const jump = el("button", "Saltar");
          jump.onclick = () => this.scene.jump();
          area.append(jump);
        }
        $("patch-help").textContent =
          this.scene.mini.tipo === "memoria"
            ? "Encontre os três pares."
            : this.scene.mini.tipo === "estrelas"
              ? "Toque na tela para saltar e pegar as estrelas."
              : "Toque nos corações antes de desaparecerem.";
        return;
      }
      const s = this.state;
      if (s.dormindo) {
        const b = el("button", "☀ Acordar");
        b.onclick = () => this.care("acordar");
        area.append(b);
        $("patch-help").textContent =
          "Enquanto dorme, o Patch recupera o descanso com o passar do tempo.";
        return;
      }
      const controls = {
        sala: [
          ["♡ Carinho", () => this.care("carinho")],
          ["♬ Dançar", () => this.care("dancar")],
          ["Bola", () => this.scene?.playBall()],
        ],
        cozinha: [
          ["Cenoura · 1 moeda", () => this.care("alimentar", "cenoura")],
          ["Maçã · 1 moeda", () => this.care("alimentar", "maca")],
          ["Leite · 2 moedas", () => this.care("alimentar", "leite")],
        ],
        banheiro: [
          ["1 · Sabonete", () => this.scene?.bathStep("sabao")],
          ["2 · Chuveiro", () => this.scene?.bathStep("chuveiro")],
          ["3 · Toalha · 1 moeda", () => this.scene?.bathStep("toalha")],
        ],
        quarto: [
          ["☾ Dormir / apagar luz", () => this.care("dormir")],
          ["♡ Carinho", () => this.care("carinho")],
        ],
        jardim: [
          ["Regar flores", () => this.scene?.waterPlant()],
          ["Brincar com bola", () => this.scene?.playBall()],
        ],
        passeio: [
          ["Iniciar passeio", () => this.startGame("passeio")],
          ["♡ Carinho", () => this.care("carinho")],
        ],
      };
      for (const [text, fn] of controls[s.comodo] || []) {
        const b = el("button", text);
        b.onclick = fn;
        area.append(b);
      }
      const help = {
        sala: "Toque no Patch para fazer carinho. Arraste a bola ou toque no chão para ele caminhar.",
        cozinha:
          "Abra a geladeira e arraste um alimento até a boca. A alimentação usa moedas do Patch.",
        banheiro:
          "Arraste o sabonete no bichinho, enxágue e seque com a toalha. Também é possível usar os botões.",
        quarto:
          "Toque na cama ou no interruptor para dormir. O descanso continua mesmo fora da página.",
        jardim: "Arraste o regador até as flores e brinque com a bola.",
        passeio:
          "Comece o passeio e toque nos três corações ao longo do caminho.",
      };
      $("patch-help").textContent = help[s.comodo] || "";
      this.setBusy(this.busy);
    },
    async act(action, item) {
      if (this.busy || !this.state) return null;
      const gen = this.generation;
      this.setBusy(true);
      try {
        const s = await bridge.rpc("patch_acao", {
          p_story: this.story,
          p_acao: action,
          p_item: item || null,
        });
        if (gen !== this.generation) return null;
        this.accept(s);
        this.message(
          action === "comprar"
            ? "Item comprado e guardado no inventário."
            : action === "presente"
              ? "Presente recebido: +8 moedas do Patch!"
              : action === "missao"
                ? "Missão concluída: +10 moedas do Patch!"
                : "Progresso salvo ♡",
        );
        return s;
      } catch (e) {
        if (gen === this.generation)
          this.message(
            e.message || "Não foi possível salvar. Tente novamente.",
            true,
          );
        return null;
      } finally {
        if (gen === this.generation) this.setBusy(false);
      }
    },
    async care(action, item) {
      const s = await this.act(action, item);
      if (s) this.scene?.react(action, item);
      return s;
    },
    async go(room) {
      if (this.scene?.mini) {
        this.message(
          "Termine ou saia da atividade antes de trocar de ambiente.",
        );
        return;
      }
      await this.act("comodo", room);
    },
    async boot() {
      if (this.booting || this.game || !this.state) return;
      this.booting = true;
      $("patch-loading").hidden = false;
      $("patch-loading").textContent = "Preparando seu cantinho…";
      try {
        if (!window.Phaser)
          await new Promise((ok, fail) => {
            const script = el("script");
            script.src = "vendor/phaser-3.90.0.min.js";
            script.onload = ok;
            script.onerror = fail;
            document.head.append(script);
          });
        this.game = new Phaser.Game({
          type: Phaser.CANVAS,
          parent: "patch-stage",
          width: 480,
          height: 640,
          transparent: true,
          antialias: true,
          render: { pixelArt: false, roundPixels: false },
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          audio: { disableWebAudio: true },
          scene: makeScene(Phaser, this),
        });
      } catch (e) {
        this.message(
          "Não foi possível abrir o cenário. Recarregue para tentar novamente.",
          true,
        );
        this.booting = false;
      }
    },
    openMenu(name) {
      if (!this.state || this.scene?.mini || this.busy) return;
      this.focusBack = document.activeElement;
      this.menu = name;
      if (this.scene) this.scene.input.enabled = false;
      this.renderMenu();
      $("patch-overlay").hidden = false;
      $("patch-sheet-close").focus();
    },
    closeMenu() {
      this.menu = null;
      if (this.scene) this.scene.input.enabled = true;
      $("patch-overlay").hidden = true;
      if (this.focusBack?.isConnected) this.focusBack.focus();
    },
    renderMenu() {
      const s = this.state,
        area = $("patch-sheet-body");
      if (!s || !this.menu) return;
      area.replaceChildren();
      const title = {
        tarefas: "Tarefas e recompensas",
        loja: "Loja do Patch",
        inventario: "Meu inventário",
        jogos: "Minijogos",
        progresso: "Idades do Patch",
      };
      const panelTitle = $("patch-sheet-title");
      const old = title[this.menu];
      if (panelTitle.textContent !== old) panelTitle.textContent = old;
      if (this.menu === "progresso") {
        const grid = el("div", undefined, "patch-shop-grid");
        for (const [key, label, level] of [
          ["bebe", "Bebê", 1],
          ["filhote", "Filhote", 5],
          ["juvenil", "Juvenil", 10],
          ["jovem", "Jovem", 20],
          ["adulto", "Adulto", 30],
        ]) {
          const card = el("div", undefined, "patch-shop-item"),
            img = el("img");
          img.src = "pet-" + key + "-parado.gif";
          img.alt = label;
          img.width = 96;
          img.height = 96;
          card.append(
            img,
            el("strong", label),
            el(
              "small",
              "Nível " +
                level +
                (s.nivel >= level ? " · Conquistado" : " · Bloqueado"),
            ),
          );
          grid.append(card);
        }
        area.append(
          el(
            "p",
            "A evolução acontece automaticamente pelo nível. Esta lista é apenas uma prévia das idades.",
          ),
          grid,
        );
      } else if (this.menu === "tarefas") {
        for (const [key, name] of [
          ["alimentar", "Alimentar uma vez"],
          ["banho", "Dar um banho"],
          ["carinho", "Fazer carinho"],
        ]) {
          const row = el("div", undefined, "patch-mission");
          row.append(
            el("span", name),
            el("b", (Number(s.progresso[key]) || 0) >= 1 ? "✓" : "0 / 1"),
          );
          area.append(row);
        }
        const claim = el(
          "button",
          s.missao_resgatada
            ? "Missão de hoje já recebida"
            : "Resgatar missão · +10 moedas",
        );
        claim.dataset.locked = String(
          s.missao_resgatada ||
            !["alimentar", "banho", "carinho"].every(
              (k) => s.progresso[k] >= 1,
            ),
        );
        claim.disabled = claim.dataset.locked === "true";
        claim.onclick = () => this.act("missao");
        const gift = el(
          "button",
          s.presente_disponivel
            ? "Presente diário · +8 moedas"
            : "Presente de hoje já recebido",
        );
        gift.dataset.locked = String(!s.presente_disponivel);
        gift.disabled = !s.presente_disponivel;
        gift.onclick = () => this.act("presente");
        area.append(
          claim,
          el(
            "p",
            "Um presente e uma missão por dia, compartilhados pelo casal.",
          ),
          gift,
          el(
            "p",
            "Recompensas de minijogos hoje: " +
              s.jogos_hoje +
              " / 10. Ganhos de XP hoje: " +
              s.xp_hoje +
              " / 100.",
          ),
        );
      } else if (this.menu === "jogos") {
        for (const [type, label, desc] of [
          [
            "coracoes",
            "♡ Pega-corações",
            "Pegue pelo menos cinco dos oito corações que caem.",
          ],
          ["memoria", "▧ Memória", "Encontre os três pares de cartas."],
          [
            "estrelas",
            "☆ Pula-estrelas",
            "Salte no tempo certo e pegue pelo menos cinco estrelas.",
          ],
        ]) {
          const b = el("button", undefined, "patch-mini-card");
          b.append(
            el("strong", label),
            el("small", desc + " Recompensa: até 3 moedas."),
          );
          b.onclick = () => {
            this.closeMenu();
            this.startGame(type);
          };
          area.append(b);
        }
        area.append(
          el(
            "p",
            "Sem aposta ou custo de entrada. Até dez atividades premiadas por dia.",
          ),
        );
      } else {
        const grid = el("div", undefined, "patch-shop-grid"),
          owned = new Set(s.inventario);
        for (const item of s.catalogo) {
          if (this.menu === "inventario" && !owned.has(item.id)) continue;
          const card = el("div", undefined, "patch-shop-item");
          card.append(
            el("span", icons[item.id] || "♡", "patch-item-icon"),
            el("strong", item.nome),
            el(
              "small",
              owned.has(item.id)
                ? "No inventário"
                : item.preco + " moedas do Patch",
            ),
          );
          const active = s.roupa === item.id || s.decoracao === item.id,
            b = el(
              "button",
              active ? "Em uso" : owned.has(item.id) ? "Usar" : "Comprar",
            );
          b.dataset.locked = String(
            active || (!owned.has(item.id) && s.moedas < item.preco),
          );
          b.disabled = b.dataset.locked === "true";
          b.onclick = () =>
            this.act(
              owned.has(item.id)
                ? item.tipo === "roupa"
                  ? "vestir"
                  : "decorar"
                : "comprar",
              item.id,
            );
          card.append(b);
          grid.append(card);
        }
        if (!grid.children.length)
          area.append(
            el(
              "p",
              "Seu inventário está vazio. Os itens adquiridos na loja aparecem aqui.",
            ),
          );
        else area.append(grid);
        const clear = el("button", "Usar roupa original");
        clear.onclick = () => this.act("vestir", "padrao");
        const clearDecor = el("button", "Retirar decoração extra");
        clearDecor.onclick = () => this.act("decorar", "padrao");
        area.append(
          clear,
          clearDecor,
          el(
            "p",
            "Roupas e decorações são compartilhadas pelo casal. As moedas desta loja não são usadas nos cassinos.",
          ),
        );
      }
      this.setBusy(this.busy);
    },
    async startGame(type) {
      if (this.busy || !this.scene || !this.state || this.scene.mini) return;
      if (this.state.dormindo) {
        this.message("Acorde o Patch antes de começar.", true);
        return;
      }
      const gen = this.generation;
      this.setBusy(true);
      try {
        const game = await bridge.rpc("patch_partida_iniciar", {
          p_story: this.story,
          p_tipo: type,
        });
        if (gen !== this.generation) return;
        this.scene.beginMini(game);
        this.message("Boa diversão! O resultado será confirmado ao terminar.");
      } catch (e) {
        this.message(
          e.message || "Não foi possível iniciar a atividade.",
          true,
        );
      } finally {
        if (gen === this.generation) this.setBusy(false);
      }
    },
    async finishGame(game, proof) {
      if (!this.scene?.mini || this.scene.mini.id !== game.id) return;
      const gen = this.generation;
      this.setBusy(true);
      this.message("Confirmando o resultado…");
      try {
        const result = await bridge.rpc("patch_partida_finalizar", {
          p_partida: game.id,
          p_resposta: proof,
        });
        if (gen !== this.generation) return;
        this.scene.cancelMini(false);
        this.accept(result.estado);
        this.message(
          result.premio > 0
            ? "Muito bem! +" + result.premio + " moedas do Patch."
            : "Atividade concluída. Tente novamente para alcançar a meta!",
        );
        if (result.premio > 0) this.scene.sfx("patch-win");
      } catch (e) {
        if (gen === this.generation) {
          this.scene.cancelMini();
          this.message(
            e.message ||
              "Resultado não confirmado. Nenhuma recompensa foi adicionada.",
            true,
          );
        }
      } finally {
        if (gen === this.generation) this.setBusy(false);
      }
    },
  };
  for (const [key, [icon, name]] of Object.entries(rooms)) {
    const b = el("button");
    b.type = "button";
    b.dataset.room = key;
    b.setAttribute("aria-pressed", "false");
    b.append(el("span", icon), document.createTextNode(name));
    b.onclick = () => App.go(key);
    $("patch-rooms").append(b);
  }
  root
    .querySelectorAll("[data-patch-menu]")
    .forEach((b) => (b.onclick = () => App.openMenu(b.dataset.patchMenu)));
  $("patch-sheet-close").onclick = () => App.closeMenu();
  $("patch-overlay").onclick = (e) => {
    if (e.target === $("patch-overlay")) App.closeMenu();
  };
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") App.closeMenu();
    if (e.key === "Tab" && !$("patch-overlay").hidden) {
      const focus = [
        ...$("patch-overlay").querySelectorAll("button:not(:disabled)"),
      ];
      if (e.shiftKey && document.activeElement === focus[0]) {
        e.preventDefault();
        focus.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === focus.at(-1)) {
        e.preventDefault();
        focus[0]?.focus();
      }
    }
  });
  const soundButton = $("patch-som");
  function soundState(on) {
    soundButton.dataset.ativo = String(on);
    soundButton.setAttribute("aria-pressed", String(on));
    soundButton.textContent = on ? "Som ligado ♫" : "Som desligado";
  }
  soundButton.onclick = () => soundState(soundButton.dataset.ativo === "false");
  window.addEventListener("nh-preferencias-aplicar", (e) =>
    soundState(e.detail.patchSom !== false),
  );
  soundState(window.nhPreferencias?.valor("patchSom") !== false);
  const observer = new IntersectionObserver(
    (entries) => {
      App.visible = entries[0].isIntersecting;
      if (App.visible) {
        App.connect();
        App.boot();
      }
    },
    { rootMargin: "120px" },
  );
  observer.observe(root);
  window.addEventListener("nh-mascote-atualizado", () => {
    const c = bridge.context();
    if (c.storyId === App.story && c.userId === App.user) App.scheduleRefresh();
    else App.connect();
  });
  window.addEventListener("nh-patch-desligar", () => App.disconnect());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && App.visible) App.refresh();
  });
  setInterval(() => {
    const c = bridge.context();
    if (c.storyId !== App.story || c.userId !== App.user) App.connect();
  }, 1000);
  window.NH_PATCH_GAME = {
    connect: () => App.connect(),
    refresh: () => App.refresh(),
    getState: () => (App.state ? JSON.parse(JSON.stringify(App.state)) : null),
    scene: () => App.scene,
    action: (a, i) => App.act(a, i),
    startGame: (t) => App.startGame(t),
  };
  function makeScene(P, app) {
    return class PatchScene extends P.Scene {
      constructor() {
        super("PatchRoom");
        this.room = null;
        this.age = null;
        this.mini = null;
        this.reactionTimer = null;
        this.objects = [];
        this.roomTweens = [];
        this.bath = { soap: 0, rinse: false, done: false };
        this.fridgeOpen = true;
        this.downAt = 0;
        this.walkTween = null;
      }
      preload() {
        for (const room of Object.keys(rooms))
          this.load.image("room-" + room, "patch/assets/" + room + ".webp");
        const a = age(app.state?.nivel || 1);
        this.load.spritesheet("pet-" + a, "patch/assets/pet-" + a + ".webp", {
          frameWidth: 256,
          frameHeight: 256,
          endFrame: 27,
        });
        this.load.audio("patch-click", "01_clique_botao.wav");
        this.load.audio("patch-win", "06_vitoria_pequena.wav");
        this.load.audio("patch-coin", "14_moeda_caindo.wav");
        this.load.on("loaderror", () =>
          app.message(
            "Um recurso não carregou. Recarregue para tentar novamente.",
            true,
          ),
        );
      }
      create() {
        app.scene = this;
        this.back = this.add
          .image(240, 320, "room-sala")
          .setDisplaySize(480, 640);
        this.floorShadow = this.add
          .ellipse(240, 458, 110, 18, 0x8f5474, 0.18)
          .setDepth(4);
        this.pet = this.add.container(240, 450).setDepth(10);
        this.body = this.add
          .sprite(0, 0, "pet-" + age(app.state?.nivel || 1), 0)
          .setOrigin(0.5, 1)
          .setDisplaySize(240, 240);
        this.clothes = this.add.graphics().setScale(240 / 190);
        this.pet.add([this.body, this.clothes]);
        this.makeAnims(age(app.state?.nivel || 1));
        this.age = age(app.state?.nivel || 1);
        this.body.setInteractive();
        this.body.on("pointerdown", () => {
          if (!this.mini) app.care("carinho");
        });
        this.night = this.add
          .rectangle(240, 320, 480, 640, 0x201d4b, 0.55)
          .setDepth(24)
          .setVisible(false);
        this.notice = this.add
          .text(240, 80, "", {
            fontFamily: "sans-serif",
            fontSize: "17px",
            color: "#633759",
            align: "center",
            backgroundColor: "#fff2fa",
            padding: { x: 14, y: 8 },
          })
          .setOrigin(0.5)
          .setDepth(50)
          .setVisible(false);
        this.input.on("dragstart", (pointer, obj) => {
          obj.setDepth(40);
          obj._home = { x: obj.x, y: obj.y };
          obj._lastStroke = 0;
        });
        this.input.on("drag", (pointer, obj, x, y) => {
          if (app.busy || this.mini) return;
          obj.setPosition(P.Math.Clamp(x, 25, 455), P.Math.Clamp(y, 90, 590));
          if (
            obj._tool === "sabao" &&
            Math.abs(x - this.pet.x) < 100 &&
            y > this.pet.y - 175 &&
            y < this.pet.y + 10
          ) {
            if (this.time.now - obj._lastStroke > 150) {
              obj._lastStroke = this.time.now;
              this.bathStep("esfregar");
            }
          }
        });
        this.input.on("dragend", (pointer, obj) => {
          if (app.busy || this.mini) return;
          if (
            obj._food &&
            P.Math.Distance.Between(obj.x, obj.y, this.pet.x, this.pet.y - 90) <
              120
          )
            app.care("alimentar", obj._food);
          else if (obj._tool === "toalha" && Math.abs(obj.x - this.pet.x) < 110)
            this.bathStep("toalha");
          else if (obj._tool === "regador" && obj.y > 350) this.waterPlant();
          else if (obj._ball) this.playBall();
          if (obj.active && obj._home)
            this.tweens.add({
              targets: obj,
              x: obj._home.x,
              y: obj._home.y,
              duration: 250,
              ease: "Sine.easeOut",
            });
        });
        this.input.on("pointerdown", (pointer) => {
          if (this.mini?.tipo === "estrelas") {
            this.jump();
            return;
          }
          if (
            !this.mini &&
            pointer.y > 470 &&
            ["sala", "jardim", "passeio"].includes(this.room)
          )
            this.walkTo(pointer.x, 450);
        });
        this.input.keyboard?.on("keydown-SPACE", () => {
          if (this.mini?.tipo === "estrelas") this.jump();
        });
        if (!reduced.matches) {
          this.breathe = this.tweens.add({
            targets: this.body,
            scaleY: this.body.scaleY * 1.025,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
        if (app.state) this.applyState(app.state);
        $("patch-loading").hidden = true;
        app.message("Toque, arraste e cuide do seu Patch ♡");
      }
      makeAnims(a) {
        const key = "pet-" + a;
        if (!this.textures.exists(key)) return;
        for (const [row, name] of [
          "idle",
          "sad",
          "eat",
          "sleep",
          "bath",
          "love",
          "play",
        ].entries()) {
          const anim = key + "-" + name;
          if (!this.anims.exists(anim))
            this.anims.create({
              key: anim,
              frames: this.anims.generateFrameNumbers(key, {
                start: row * 4,
                end: row * 4 + 3,
              }),
              frameRate: reduced.matches ? 1 : name === "idle" ? 3 : 7,
              repeat: -1,
            });
        }
      }
      ensureAge(a) {
        if (this.age === a) return;
        if (this.textures.exists("pet-" + a)) {
          this.makeAnims(a);
          this.age = a;
          this.body.setTexture("pet-" + a);
          this.rest();
          return;
        }
        if (this.loadingAge === a) return;
        this.loadingAge = a;
        this.load.spritesheet("pet-" + a, "patch/assets/pet-" + a + ".webp", {
          frameWidth: 256,
          frameHeight: 256,
          endFrame: 27,
        });
        this.load.once("complete", () => {
          this.loadingAge = null;
          if (this.sys.isActive() && app.state)
            this.ensureAge(age(app.state.nivel));
        });
        this.load.start();
      }
      applyState(s) {
        if (!this.body) return;
        this.ensureAge(age(s.nivel));
        if (this.room !== s.comodo && !this.mini) this.renderRoom(s.comodo);
        this.drawClothes(s.roupa);
        this.night.setVisible(s.dormindo);
        if (!this.reactionTimer) this.rest();
        if (!this.mini) this.renderDecor(s.decoracao);
      }
      rest() {
        if (!app.state || !this.body.active) return;
        const n = app.state.necessidades;
        const anim = app.state.dormindo
          ? "sleep"
          : n.fome > 75 ||
              n.sono > 75 ||
              n.diversao < 25 ||
              n.higiene < 25 ||
              n.carinho < 25
            ? "sad"
            : "idle";
        if (reduced.matches) {
          this.body.stop();
          this.body.setFrame({ idle: 0, sad: 4, sleep: 12 }[anim] || 0);
        } else this.body.play("pet-" + this.age + "-" + anim, true);
      }
      react(action, item) {
        if (!this.body?.active) return;
        this.reactionTimer?.remove();
        this.reactionTimer = null;
        const name = {
          alimentar: "eat",
          carinho: "love",
          brincar: "play",
          dancar: "play",
          banho: "love",
          regar: "love",
        }[action];
        if (name && !reduced.matches)
          this.body.play("pet-" + this.age + "-" + name, true);
        if (action === "dormir" || action === "acordar") {
          this.rest();
          return;
        }
        if (action === "alimentar") {
          const food = this.add
            .text(
              this.pet.x + 65,
              this.pet.y - 65,
              { maca: "🍎", leite: "🥛" }[item] || "🥕",
              { fontSize: "30px" },
            )
            .setOrigin(0.5)
            .setDepth(30);
          this.tweens.add({
            targets: food,
            x: this.pet.x,
            y: this.pet.y - 120,
            scale: 0,
            alpha: 0,
            duration: 600,
            onComplete: () => food.destroy(),
          });
        }
        this.sfx(action === "alimentar" ? "patch-coin" : "patch-click");
        this.burst(
          this.pet.x,
          this.pet.y - 115,
          action === "banho" ? "✧" : "♡",
          0xc75d96,
        );
        if (!reduced.matches)
          this.tweens.add({
            targets: this.pet,
            angle: action === "dancar" ? 8 : 3,
            duration: 200,
            yoyo: true,
            repeat: action === "dancar" ? 5 : 1,
            ease: "Sine.easeInOut",
            onComplete: () => this.pet.setAngle(0),
          });
        this.reactionTimer = this.time.delayedCall(
          action === "dancar" ? 2600 : 1700,
          () => {
            this.reactionTimer = null;
            this.rest();
          },
        );
      }
      sfx(key) {
        if ($("patch-som").dataset.ativo === "false") return;
        try {
          this.sound.play(key, { volume: 0.25 });
        } catch {}
      }
      track(obj) {
        this.objects.push(obj);
        return obj;
      }
      icon(text, x, y, size = 45, action) {
        const obj = this.add
          .text(x, y, text, {
            fontFamily: "sans-serif",
            fontSize: size + "px",
            color: "#8c4676",
            stroke: "#fff3fa",
            strokeThickness: 2,
          })
          .setOrigin(0.5)
          .setDepth(20)
          .setInteractive({ useHandCursor: true });
        obj.setPadding(9);
        if (action) obj.on("pointerdown", action);
        this.track(obj);
        return obj;
      }
      label(text, x, y) {
        return this.track(
          this.add
            .text(x, y, text, {
              fontFamily: "sans-serif",
              fontSize: "13px",
              color: "#6d365b",
              backgroundColor: "#fff0f7",
              padding: { x: 9, y: 5 },
              align: "center",
            })
            .setOrigin(0.5)
            .setDepth(21),
        );
      }
      draggable(obj) {
        this.input.setDraggable(obj);
        return obj;
      }
      clearRoom() {
        this.walkTween?.stop();
        this.walkResolve?.();
        this.walkResolve = null;
        this.reactionTimer?.remove();
        this.reactionTimer = null;
        this.roomTweens.forEach((t) => t.stop());
        this.roomTweens = [];
        for (const obj of this.objects) if (obj.active) obj.destroy();
        this.objects = [];
        this.extraDecor?.destroy();
        this.extraDecor = null;
        this.pet.setPosition(240, 450).setAngle(0).setVisible(true);
        this.floorShadow.setPosition(240, 458);
        this.body.setVisible(true);
        this.bath = { soap: 0, rinse: false, done: false };
      }
      renderRoom(room) {
        this.clearRoom();
        this.room = room;
        this.back.setTexture("room-" + room);
        this.pet.setPosition(240, 450);
        if (!reduced.matches) this.cameras.main.fadeIn(220, 255, 225, 240);
        this.notice.setVisible(false);
        if (room === "sala" || room === "jardim") {
          const ball = this.draggable(
            this.icon("⚽", 360, 525, 50, () => this.playBall()),
          );
          ball._ball = true;
          if (room === "sala")
            this.icon("♪", 415, 165, 30, () => app.care("dancar"));
        }
        if (room === "cozinha") {
          this.icon("▥", 414, 240, 64, () => {
            this.fridgeOpen = !this.fridgeOpen;
            this.foods.forEach((o) => o.setVisible(this.fridgeOpen));
            app.message(
              this.fridgeOpen
                ? "Escolha e arraste um alimento."
                : "Geladeira fechada. Toque para abrir.",
            );
          });
          this.label("Geladeira", 408, 300);
          this.foods = [];
          for (const [i, [name, emoji]] of [
            ["cenoura", "🥕"],
            ["maca", "🍎"],
            ["leite", "🥛"],
          ].entries()) {
            const food = this.draggable(
              this.icon(emoji, 130 + i * 110, 540, 48),
            );
            food._food = name;
            this.foods.push(food);
          }
          this.label("Arraste até a boca", 240, 594);
        }
        if (room === "banheiro") {
          const tub = this.add.graphics().setDepth(14);
          tub.fillStyle(0xf8afd4, 1);
          tub.fillRoundedRect(130, 417, 220, 98, 35);
          tub.lineStyle(5, 0xffedf7, 1);
          tub.strokeRoundedRect(130, 417, 220, 98, 35);
          tub.fillStyle(0xffedf7, 1);
          tub.fillEllipse(240, 421, 220, 40);
          tub.fillStyle(0xcfe9f6, 0.9);
          tub.fillEllipse(240, 418, 190, 25);
          this.track(tub);
          this.pet.setPosition(240, 446);
          const soap = this.draggable(
            this.icon("🧼", 77, 550, 42, () => this.bathStep("sabao")),
          );
          soap._tool = "sabao";
          this.icon("🚿", 408, 170, 48, () => this.bathStep("chuveiro"));
          const towel = this.draggable(
            this.icon("▰", 400, 548, 52, () => this.bathStep("toalha")),
          );
          towel._tool = "toalha";
          this.bathLabel = this.label("Sabonete → chuveiro → toalha", 240, 594);
        }
        if (room === "quarto") {
          const bed = this.add.graphics().setDepth(5);
          bed.fillStyle(0xd7b0ed, 1);
          bed.fillRoundedRect(100, 368, 285, 145, 30);
          bed.lineStyle(5, 0xffe5f5, 1);
          bed.strokeRoundedRect(100, 368, 285, 145, 30);
          bed.fillStyle(0xffe5f5, 1);
          bed.fillRoundedRect(122, 380, 90, 52, 20);
          this.track(bed);
          const hit = this.add
            .zone(240, 440, 290, 150)
            .setInteractive({ useHandCursor: true });
          hit.on("pointerdown", () =>
            app.care(app.state.dormindo ? "acordar" : "dormir"),
          );
          this.track(hit);
          this.pet.setPosition(250, 456);
          this.icon("💡", 413, 170, 43, () =>
            app.care(app.state.dormindo ? "acordar" : "dormir"),
          );
          this.label("Toque na cama ou na luz", 240, 566);
        }
        if (room === "jardim") {
          this.plants = [];
          for (let i = 0; i < 3; i++)
            this.plants.push(
              this.icon("🌷", 115 + i * 90, 502, 40, () => this.waterPlant()),
            );
          const can = this.draggable(
            this.icon("🚿", 407, 560, 43, () => this.waterPlant()),
          );
          can._tool = "regador";
          this.label("Regue as flores ♡", 230, 580);
        }
        if (room === "passeio") {
          this.label("Toque em Iniciar passeio", 240, 570);
        }
        this.rest();
        if (app.state) this.renderDecor(app.state.decoracao);
      }
      renderDecor(id) {
        if (this.decorId === id && this.extraDecor?.active) return;
        this.extraDecor?.destroy();
        this.extraDecor = null;
        this.decorId = id;
        if (!id) return;
        const values = {
            tapete_flor: ["🌸", 240, 510, 94, 3],
            almofada_lilas: ["🛋", 92, 429, 60, 6],
            vaso_rosa: ["🌷", 410, 410, 55, 6],
          },
          v = values[id];
        if (v)
          this.extraDecor = this.add
            .text(v[1], v[2], v[0], { fontSize: v[3] + "px" })
            .setOrigin(0.5)
            .setDepth(v[4]);
      }
      drawClothes(id) {
        const g = this.clothes;
        g.clear();
        if (!id) return;
        if (id === "camiseta_rosa" || id === "pijama_lilas") {
          g.fillStyle(id === "camiseta_rosa" ? 0xf5a2cb : 0xc5a6e5, 1);
          g.fillRoundedRect(-24, -63, 48, 25, 8);
          g.fillStyle(0xfff2f8, 1);
          g.fillCircle(0, -50, 6);
          g.lineStyle(2, 0xffe2f0, 0.8);
          g.strokeRoundedRect(-24, -63, 48, 25, 8);
        } else if (id === "oculos_coracao") {
          g.lineStyle(3, 0xe875ac, 1);
          g.strokeCircle(-22, -111, 15);
          g.strokeCircle(22, -111, 15);
          g.lineBetween(-7, -111, 7, -111);
        } else if (id === "laco_dourado") {
          g.fillStyle(0xf3ca61, 1);
          g.fillTriangle(20, -167, 42, -181, 41, -157);
          g.fillTriangle(44, -168, 66, -183, 64, -155);
          g.fillCircle(43, -168, 7);
        }
      }
      burst(x, y, text = "♡", color = 0xc8689c) {
        if (reduced.matches) return;
        for (let i = 0; i < 5; i++) {
          const heart = this.add
            .text(x, y, text, {
              fontSize: 18 + i * 2 + "px",
              color: "#" + color.toString(16).padStart(6, "0"),
            })
            .setOrigin(0.5)
            .setDepth(45);
          this.tweens.add({
            targets: heart,
            x: x + (i - 2) * 26,
            y: y - 75 - Math.random() * 30,
            alpha: 0,
            duration: 700 + i * 90,
            onComplete: () => heart.destroy(),
          });
        }
      }
      walkTo(x, y = 450) {
        if (app.state?.dormindo || (this.mini && this.mini.tipo !== "passeio"))
          return Promise.resolve();
        this.walkTween?.stop();
        this.walkResolve?.();
        this.walkResolve = null;
        return new Promise((ok) => {
          this.walkResolve = ok;
          this.walkTween = this.tweens.add({
            targets: this.pet,
            x: P.Math.Clamp(x, 70, 410),
            duration: reduced.matches ? 0 : 500,
            ease: "Sine.easeInOut",
            onUpdate: () => this.floorShadow.setX(this.pet.x),
            onComplete: () => ok(),
          });
        });
      }
      async playBall() {
        if (this.mini || app.busy) return;
        const s = await app.care("brincar");
        if (!s) return;
        const ball = this.objects.find((o) => o._ball);
        if (ball)
          this.tweens.add({
            targets: ball,
            x: 100,
            y: 460,
            duration: 450,
            yoyo: true,
            ease: "Sine.easeInOut",
          });
        this.burst(this.pet.x, this.pet.y - 40, "☆");
      }
      async waterPlant() {
        if (this.mini || app.busy) return;
        const s = await app.care("regar");
        if (!s) return;
        for (const plant of this.plants || [])
          this.tweens.add({
            targets: plant,
            scale: 1.25,
            duration: 450,
            yoyo: true,
          });
        this.burst(240, 400, "✧", 0x77b99a);
      }
      async bathStep(tool) {
        if (
          this.room !== "banheiro" ||
          this.bath.done ||
          app.busy ||
          app.state?.dormindo
        )
          return;
        if (tool === "sabao") this.bath.soap += 5;
        else if (tool === "esfregar") this.bath.soap++;
        if (tool === "sabao" || tool === "esfregar") {
          this.burst(this.pet.x, this.pet.y - 80, "○", 0xffffff);
          this.bathLabel.setText(
            this.bath.soap >= 5
              ? "Espuma pronta! Use o chuveiro."
              : "Esfregue mais um pouco…",
          );
          return;
        }
        if (tool === "chuveiro") {
          if (this.bath.soap < 5) {
            app.message("Passe o sabonete antes de enxaguar.");
            return;
          }
          this.bath.rinse = true;
          for (let i = 0; i < 16; i++) {
            const drop = this.add
              .ellipse(210 + (i % 5) * 14, 210, 4, 12, 0xb7e7fa, 0.85)
              .setDepth(30);
            this.tweens.add({
              targets: drop,
              y: 440,
              alpha: 0,
              delay: i * 35,
              duration: 600,
              onComplete: () => drop.destroy(),
            });
          }
          this.bathLabel.setText("Enxaguado! Agora use a toalha.");
          return;
        }
        if (tool === "toalha") {
          if (!this.bath.rinse) {
            app.message("Ensaboe e enxágue antes de secar.");
            return;
          }
          this.bath.done = true;
          const s = await app.care("banho");
          if (s) {
            this.bathLabel.setText("Limpinho! ♡");
            this.bath = { soap: 0, rinse: false, done: false };
          } else this.bath.done = false;
        }
      }
      beginMini(game) {
        this.clearRoom();
        this.mini = {
          ...game,
          proof: [],
          started: performance.now(),
          spawned: new Set(),
          caught: new Set(),
          targets: [],
          ending: false,
        };
        this.pet.setVisible(false);
        this.floorShadow.setVisible(false);
        this.night.setVisible(false);
        this.back.setTexture(
          "room-" +
            (game.tipo === "passeio"
              ? "passeio"
              : game.tipo === "estrelas"
                ? "jardim"
                : "sala"),
        );
        this.miniLayer = this.add.container(0, 0).setDepth(40);
        const shade = this.add.rectangle(240, 320, 480, 640, 0xffedf7, 0.65);
        if (game.tipo === "passeio") shade.setAlpha(0.1);
        this.miniLayer.add(shade);
        this.miniTitle = this.add
          .text(
            240,
            50,
            {
              coracoes: "Pega-corações",
              memoria: "Memória",
              estrelas: "Pula-estrelas",
              passeio: "Passeio",
            }[game.tipo],
            {
              fontSize: "25px",
              fontFamily: "sans-serif",
              color: "#783f68",
              fontStyle: "bold",
            },
          )
          .setOrigin(0.5);
        this.miniLayer.add(this.miniTitle);
        this.miniInfo = this.add
          .text(240, 100, "", {
            fontSize: "17px",
            fontFamily: "sans-serif",
            color: "#783f68",
            align: "center",
          })
          .setOrigin(0.5);
        this.miniLayer.add(this.miniInfo);
        if (game.tipo === "memoria") this.memoryBoard();
        if (game.tipo === "estrelas") {
          this.jumpPet = this.add
            .sprite(110, 475, "pet-" + this.age, 0)
            .setOrigin(0.5, 1)
            .setDisplaySize(125, 125);
          this.miniLayer.add(this.jumpPet);
          this.jumping = false;
          this.mini.judged = new Set();
        }
        if (game.tipo === "passeio") {
          this.pet.setVisible(true);
          this.floorShadow.setVisible(true);
        }
        app.actions();
      }
      memoryBoard() {
        const m = this.mini;
        m.flips = [];
        m.matched = new Set();
        m.checking = false;
        m.cards = [];
        m.desafio.cartas.forEach((value, i) => {
          const x = 145 + (i % 2) * 190,
            y = 220 + Math.floor(i / 2) * 135;
          const tile = this.add
            .rectangle(x, y, 145, 108, 0xe8b8d8)
            .setStrokeStyle(3, 0xffffff)
            .setInteractive({ useHandCursor: true });
          const label = this.add
            .text(x, y, "♡", {
              fontSize: "42px",
              fontFamily: "sans-serif",
              color: "#fff",
            })
            .setOrigin(0.5);
          this.miniLayer.add([tile, label]);
          m.cards.push({ tile, label, value });
          tile.on("pointerdown", () => this.flip(i));
        });
      }
      flip(i) {
        const m = this.mini;
        if (
          !m ||
          m.tipo !== "memoria" ||
          m.checking ||
          m.matched.has(i) ||
          m.flips.includes(i) ||
          m.ending
        )
          return;
        m.flips.push(i);
        m.cards[i].label.setText(["♥", "★", "❀"][m.cards[i].value]);
        if (m.flips.length === 2) {
          const [a, b] = m.flips;
          m.proof.push([a, b]);
          if (m.cards[a].value === m.cards[b].value) {
            m.matched.add(a);
            m.matched.add(b);
            m.cards[a].tile.setFillStyle(0xb3d7b4);
            m.cards[b].tile.setFillStyle(0xb3d7b4);
            m.flips = [];
            if (m.matched.size === 6) {
              m.checking = true;
              this.miniInfo.setText("Todos os pares! Confirmando…");
              const delay = Math.max(0, 6300 - (performance.now() - m.started));
              this.time.delayedCall(delay, () => {
                if (this.mini === m) this.finishMini();
              });
            }
          } else {
            m.checking = true;
            this.time.delayedCall(650, () => {
              if (this.mini !== m) return;
              m.cards[a].label.setText("♡");
              m.cards[b].label.setText("♡");
              m.flips = [];
              m.checking = false;
            });
          }
        }
      }
      jump() {
        const m = this.mini;
        if (!m || m.tipo !== "estrelas" || m.ending || this.jumping) return;
        this.jumping = true;
        m.proof.push(Math.round(performance.now() - m.started));
        this.tweens.add({
          targets: this.jumpPet,
          y: 350,
          duration: 350,
          yoyo: true,
          ease: "Sine.easeOut",
          onComplete: () => (this.jumping = false),
        });
      }
      async collect(target) {
        const m = this.mini;
        if (!m || m.ending || m.caught.has(target.id)) return;
        if (m.collecting) return;
        if (m.tipo === "passeio") {
          m.collecting = true;
          await this.walkTo(target.obj.x, 450);
          m.collecting = false;
        }
        if (this.mini !== m) return;
        const elapsed = Math.round(performance.now() - m.started);
        if (elapsed < target.inicio || elapsed > target.inicio + target.duracao)
          return;
        m.caught.add(target.id);
        m.proof.push({ id: target.id, em: elapsed });
        target.obj.destroy();
        this.burst(target.x, 400, "♡");
        this.sfx("patch-click");
      }
      finishMini() {
        const m = this.mini;
        if (!m || m.ending) return;
        m.ending = true;
        this.miniInfo.setText("Confirmando o resultado…");
        app.finishGame(m, m.proof);
      }
      cancelMini(render = true) {
        if (!this.mini) return;
        this.mini = null;
        this.miniLayer?.destroy(true);
        this.miniLayer = null;
        this.jumpPet = null;
        this.floorShadow.setVisible(true);
        this.pet.setVisible(true);
        this.room = null;
        if (render && app.state) this.renderRoom(app.state.comodo);
        if (render) app.actions();
      }
      update() {
        const m = this.mini;
        if (!m || m.ending) return;
        const t = performance.now() - m.started;
        if (m.tipo === "memoria") {
          if (!m.checking)
            this.miniInfo.setText("Pares: " + m.matched.size / 2 + " / 3");
          return;
        }
        if (m.tipo === "coracoes" || m.tipo === "passeio") {
          for (const target of m.desafio.alvos) {
            if (t >= target.inicio && !m.spawned.has(target.id)) {
              m.spawned.add(target.id);
              const x = 40 + target.x * 400,
                obj = this.add
                  .text(x, m.tipo === "passeio" ? 410 : 50, "♥", {
                    fontSize: "58px",
                    fontFamily: "sans-serif",
                    color: "#e873ab",
                    stroke: "#fff",
                    strokeThickness: 3,
                    padding: { x: 10, y: 10 },
                  })
                  .setOrigin(0.5)
                  .setInteractive({ useHandCursor: true });
              const entry = { ...target, x, obj };
              obj.on("pointerdown", () => this.collect(entry));
              this.miniLayer.add(obj);
              m.targets.push(entry);
            }
          }
          for (const target of m.targets) {
            if (!target.obj.active) continue;
            if (t > target.inicio + target.duracao) target.obj.destroy();
            else if (m.tipo === "coracoes")
              target.obj.setY(
                60 + ((t - target.inicio) / target.duracao) * 465,
              );
          }
          this.miniInfo.setText(
            "Corações: " +
              m.caught.size +
              " / " +
              m.desafio.alvos.length +
              "   ·   " +
              Math.max(0, Math.ceil((m.desafio.duracao - t) / 1000)) +
              "s",
          );
        }
        if (m.tipo === "estrelas") {
          for (const [i, hit] of m.desafio.tempos.entries()) {
            if (hit - t < 2100 && !m.spawned.has(i)) {
              m.spawned.add(i);
              const star = this.add
                .text(500, 365, "★", {
                  fontSize: "48px",
                  color: "#efbd50",
                  stroke: "#fff",
                  strokeThickness: 2,
                })
                .setOrigin(0.5);
              this.miniLayer.add(star);
              m.targets.push({ id: i, hit, obj: star });
            }
            const target = m.targets.find((x) => x.id === i);
            if (target?.obj.active) {
              target.obj.x = 110 + (hit - t) * 0.2;
              if (t >= hit && !m.judged.has(i)) {
                m.judged.add(i);
                if (m.proof.some((j) => hit - j >= 80 && hit - j <= 600)) {
                  m.caught.add(i);
                  this.burst(110, 365, "☆");
                }
                target.obj.destroy();
              }
            }
          }
          this.miniInfo.setText(
            "Estrelas: " +
              m.caught.size +
              " / 7   ·   " +
              Math.max(0, Math.ceil((12500 - t) / 1000)) +
              "s",
          );
        }
        if (t >= m.desafio.duracao + 150) this.finishMini();
      }
    };
  }
})();
