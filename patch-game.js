import { makeScene } from "./patch-game/scenes/HouseScene.js";
import { SaveManager } from "./patch-game/SaveManager.js";
import { ProductionUI } from "./patch-game/ProductionUI.js";
import { CareController } from "./patch-game/CareController.js";
import { NEEDS, normalizeNeeds } from "./patch-game/systems/NeedsSystem.js";
import { levelProgress } from "./patch-game/systems/LevelSystem.js";
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
    audioVolume: 0.35,
    getVolume() {
      return this.audioVolume;
    },
    getSound() {
      return $("patch-som").dataset.ativo !== "false";
    },
    setVolume(value) {
      this.audioVolume = Math.max(0, Math.min(1, Number(value) || 0));
      window.dispatchEvent(new Event("nh-config-alterada"));
    },
    setSound(on) {
      const b = $("patch-som");
      b.dataset.ativo = String(on);
      b.setAttribute("aria-pressed", String(on));
      b.textContent = on ? "Som ligado ♫" : "Som desligado";
      window.dispatchEvent(new Event("nh-config-alterada"));
    },
    dragMode: false,
    waits: {},
    pending: null,
    setDragMode(on) {
      this.dragMode = !!on;
      root.dataset.arrastar = String(this.dragMode);
      if (this.dragMode && this.game?.canvas) {
        this.game.canvas.scrollIntoView({
          block: "center",
          behavior: "instant",
        });
        this.game.scale.updateBounds();
      }
      $("patch-drag-mode").setAttribute("aria-pressed", String(this.dragMode));
      $("patch-drag-mode").textContent = this.dragMode
        ? "✓ Terminar de mover"
        : "↔ Mover objetos";
      $("patch-gesture-help").textContent = this.dragMode
        ? "Arraste um objeto. Ao soltar, a rolagem volta ao normal."
        : "Toque para cuidar · Deslize para rolar a página";
    },
    refreshControls() {
      const now = performance.now(),
        bath = this.scene?.bath;
      root
        .querySelectorAll("[data-room],[data-patch-menu],#patch-drag-mode")
        .forEach((b) => {
          b.disabled = this.busy || !!bath?.animating || !!this.scene?.mini;
        });
      for (const b of $("patch-actions").querySelectorAll("[data-action]")) {
        const a = b.dataset.action,
          wait = Math.max(0, Math.ceil(((this.waits[a] || 0) - now) / 1000));
        let locked = b.dataset.locked === "true",
          note = b.dataset.note || "";
        if (a.startsWith("bath-")) {
          const step = a.slice(5);
          locked = bath?.phase !== step || !!bath?.animating;
          note = bath?.animating
            ? "Aguarde a animação…"
            : bath?.phase === step
              ? {
                  sabao: "Começar por aqui",
                  chuveiro: "Espuma pronta",
                  toalha: "Enxaguado: pode secar",
                }[step]
              : bath?.phase === "done"
                ? "Banho concluído"
                : "Conclua a etapa anterior";
          if (bath?.phase === "done" && step === "sabao" && !wait)
            locked = false;
        }
        const realAction = a.startsWith("bath-")
            ? "banho"
            : a.endsWith("-real")
              ? a.slice(0, -5)
              : a,
          remaining = Math.max(
            wait,
            Math.ceil(((this.waits[realAction] || 0) - now) / 1000),
          );
        b.disabled = this.busy || !this.scene || locked || remaining > 0;
        b.classList.toggle(
          "is-working",
          this.busy && this.pending === realAction,
        );
        const n = b.querySelector(".patch-action-note");
        if (n)
          n.textContent =
            remaining > 0
              ? "Disponível em " + remaining + "s"
              : this.busy && this.pending === realAction
                ? "Salvando…"
                : note;
      }
    },
    setBusy(v) {
      this.busy = v;
      root.setAttribute("aria-busy", String(v));
      root.querySelectorAll("button:not(.patch-close)").forEach((b) => {
        b.disabled = v || b.dataset.locked === "true";
      });
      this.refreshControls();
      if (
        !v &&
        this.levelNotice &&
        !this.menu &&
        !this.scene?.mini &&
        !this.careController?.session
      ) {
        this.levelToShow = this.levelNotice;
        this.levelNotice = null;
        this.openMenu("nivel");
      }
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
      this.saves?.clear();
      this.careController?.reset();
      this.scene?.cancelMini(false);
      this.setDragMode(false);
      this.waits = {};
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
      $("patch-classico").hidden = false;
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
      const oldLevel = this.state?.nivel;
      const first = !this.state;
      this.state = s;
      this.waits = Object.fromEntries(
        Object.entries(s.esperas || {}).map(([k, v]) => [
          k,
          performance.now() + Math.max(0, Number(v) || 0) * 1000,
        ]),
      );
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
      $("patch-classico").hidden = !!s.producao;
      $("patch-retry")?.remove();
      this.hud();
      if (this.scene) {
        this.scene.input.enabled = !this.menu;
        this.scene.applyState(s);
        $("patch-loading").hidden = true;
      } else if (this.visible) this.boot();
      if (this.menu) this.renderMenu();
      if (oldLevel && s.nivel > oldLevel) {
        this.levelNotice = s.nivel;
        this.scene?.celebrateLevel(s.nivel);
      }
    },
    hud() {
      const s = this.state;
      if (!s) return;
      $("patch-nivel").textContent =
        "Nível " +
        s.nivel +
        " · " +
        levelProgress(s).current +
        " / " +
        levelProgress(s).next +
        " XP";
      $("patch-xp").style.width = levelProgress(s).percent + "%";
      root
        .querySelector(".patch-xp")
        .setAttribute("aria-valuenow", String(levelProgress(s).percent));
      $("patch-moedas").textContent = Number(s.moedas).toLocaleString("pt-BR");
      $("patch-sync").textContent =
        (bridge.context().modo === "solo"
          ? "Seu progresso"
          : "Progresso compartilhado pelo casal") +
        " · Moedas exclusivas do Patch";
      const area = $("patch-needs");
      area.replaceChildren();
      for (const [key, name, icon] of NEEDS) {
        const value = normalizeNeeds(s)[key];
        const box = el("div", undefined, "patch-need"),
          label = el("b", icon + " " + name),
          meter = el("meter");
        meter.min = 0;
        meter.max = 100;
        meter.low = 30;
        meter.high = 70;
        meter.optimum = 100;
        meter.value = value;
        meter.setAttribute("aria-label", name + ": " + Math.round(value) + "%");
        box.title =
          key === "fome"
            ? "A barra cai quando fica com fome"
            : key === "energia"
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
      if (s.producao && this.careController?.render(area)) return;
      if (s.cuidado_ativo) {
        const owned = s.cuidado_ativo.jogador_id === this.user,
          b = el(
            "button",
            owned
              ? "Retomar cuidado em andamento"
              : "Seu par está cuidando do Patch",
          );
        b.disabled = !owned;
        b.dataset.locked = String(!owned);
        b.onclick = () => this.careController.start(s.cuidado_ativo.tipo);
        area.append(b);
        return;
      }
      if (s.atividade_ativa) {
        const owned = s.atividade_ativa.jogador_id === this.user,
          b = el(
            "button",
            owned
              ? "Encerrar partida anterior"
              : "Seu par está em uma atividade",
          );
        b.disabled = !owned;
        b.dataset.locked = String(!owned);
        b.onclick = () => this.cancelGame(s.atividade_ativa.id);
        area.append(b);
        return;
      }
      if (s.dormindo) {
        const b = el("button", "☀ Acordar");
        b.onclick = () => this.care("acordar");
        area.append(b);
        $("patch-help").textContent =
          "Enquanto dorme, o Patch recupera o descanso com o passar do tempo.";
        return;
      }
      const button = (action, label, icon, note, fn, locked = false) => {
        const b = el("button", undefined, "patch-action");
        b.dataset.action = action;
        b.dataset.note = note;
        b.dataset.locked = String(locked);
        b.append(
          el("span", icon, "patch-action-icon"),
          el("strong", label),
          el("small", note, "patch-action-note"),
        );
        b.onclick = fn;
        area.append(b);
        return b;
      };
      area.dataset.room = s.comodo;
      const care = (a, title, icon, note) =>
        button(a, title, icon, note, () => this.care(a));
      if (s.comodo === "sala") {
        care("carinho", "Fazer carinho", "♡", "Toque e ganhe afeto");
        care("dancar", "Dançar", "♫", "Animar o Patch");
        if (s.producao)
          care("descansar", "Descansar", "🛋", "Recuperar energia no sofá");
        button("brincar", "Jogar bola", "⚽", "Brincar juntos", () =>
          this.scene?.playBall(),
        );
      } else if (s.comodo === "cozinha") {
        for (const f of s.catalogo_alimentos || []) {
          const qty = Number(s.alimentos?.[f.id] || 0),
            b = button(
              "alimentar",
              f.nome,
              f.icone,
              qty ? qty + " no estoque" : "Acabou",
              () => this.care("alimentar", f.id),
              !qty,
            );
          b.dataset.foodAction = f.id;
        }
        button("mercado", "Comprar comidas", "🛒", "Repor o estoque", () =>
          this.openMenu("comidas"),
        );
      } else if (s.comodo === "banheiro" && s.producao) {
        button(
          "banho-real",
          "Dar banho",
          "🧽",
          "Esfregue, enxágue e seque",
          () => this.careController.start("banho"),
        );
        button(
          "dentes-real",
          "Escovar dentes",
          "🪥",
          "Deslize a escova sobre a boca",
          () => this.careController.start("dentes"),
        );
      } else if (s.comodo === "banheiro") {
        for (const [i, key, label, icon] of [
          [1, "sabao", "Ensaboar", "🧼"],
          [2, "chuveiro", "Enxaguar", "🚿"],
          [3, "toalha", "Secar", "🧺"],
        ])
          button("bath-" + key, i + " · " + label, icon, "", () =>
            this.scene?.bathStep(key),
          );
      } else if (s.comodo === "quarto") {
        care("dormir", "Dormir", "☾", "Apagar a luz e descansar");
        care("carinho", "Fazer carinho", "♡", "Um carinho antes de dormir");
      } else if (s.comodo === "jardim") {
        button("regar", "Regar flores", "🌷", "Cuidar do jardim", () =>
          this.scene?.waterPlant(),
        );
        button("brincar", "Jogar bola", "⚽", "Diversão ao ar livre", () =>
          this.scene?.playBall(),
        );
      } else if (s.comodo === "passeio") {
        button(
          "passear",
          "Iniciar passeio",
          "🌳",
          "Encontrar três corações",
          () => this.startGame("passeio"),
        );
        care("carinho", "Fazer carinho", "♡", "Cuidar durante o passeio");
      }
      const help = {
        sala: "Toque no Patch para fazer carinho, na bola para brincar ou no chão para caminhar. Deslize para rolar a página.",
        cozinha:
          "Toque em uma comida para alimentar. Para arrastar até a boca, ative Mover objetos. Reponha o estoque na aba Comidas.",
        banheiro:
          "Siga as etapas: ensaboar, enxaguar e secar. Aguarde cada animação; a próxima etapa será liberada automaticamente.",
        quarto:
          "Toque na cama ou no interruptor para dormir. O descanso continua mesmo fora da página.",
        jardim:
          "Toque nas flores para regar ou na bola para brincar. Ative Mover objetos se quiser arrastar.",
        passeio:
          "Comece o passeio e toque nos três corações ao longo do caminho.",
      };
      $("patch-help").textContent = help[s.comodo] || "";
      this.setBusy(this.busy);
    },
    async act(action, item) {
      if (this.busy || !this.state) return null;
      const gen = this.generation;
      this.pending = action;
      this.setBusy(true);
      try {
        const s = await this.saves.command(this.state, this, action, item);
        if (gen !== this.generation) return null;
        this.accept(s);
        this.scene?.audio?.play(
          action.startsWith("comprar")
            ? "compra"
            : action.startsWith("resgatar")
              ? "missao_concluida"
              : "toque_botao",
        );
        this.message(
          action === "comprar"
            ? "Item comprado e guardado no inventário."
            : action === "presente"
              ? "Presente recebido: +8 moedas do Patch!"
              : action === "missao"
                ? "Missão concluída: +10 moedas do Patch!"
                : "Progresso salvo ♡",
        );
        if (action === "comprar_comida")
          this.message("Comida comprada! Veja o estoque na cozinha.");
        if (s.recompensa_acao > 0) {
          this.message(
            "Cuidado concluído! +" + s.recompensa_acao + " moedas ♡",
          );
          this.scene?.coinReward(s.recompensa_acao);
        }
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
      if (
        this.state?.producao &&
        ["banho", "carinho", "dentes"].includes(action)
      ) {
        await this.careController.start(
          action === "banho"
            ? "banho"
            : action === "dentes"
              ? "dentes"
              : "carinho",
        );
        return null;
      }
      if (this.scene?.bath.animating && action !== "banho") {
        this.message("Espere a etapa do banho terminar.");
        return null;
      }
      const wait = Math.ceil(
        ((this.waits[action] || 0) - performance.now()) / 1000,
      );
      if (wait > 0) {
        this.message("Este cuidado estará disponível em " + wait + "s.");
        return null;
      }
      const s = await this.act(action, item);
      if (s) this.scene?.react(action, item);
      return s;
    },
    async go(room) {
      if (this.careController?.session && !(await this.careController.cancel()))
        return;
      if (this.scene?.bath.animating) {
        this.message("Espere terminar esta etapa do banho.");
        return;
      }
      if (this.state?.comodo === room) return;
      this.setDragMode(false);
      if (this.scene?.mini) {
        this.message(
          "Termine ou saia da atividade antes de trocar de ambiente.",
        );
        return;
      }
      await this.act("comodo", room);
    },
    retryScene() {
      this.scene = null;
      this.game?.destroy(true);
      this.game = null;
      this.booting = false;
      $("patch-asset-retry")?.remove();
      if (this.state) this.boot();
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
          input: {
            touch: { capture: false },
            mouse: { preventDefaultWheel: false },
          },
          audio: { disableWebAudio: true },
          scene: makeScene(Phaser, this, { rooms, age, reduced, $ }),
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
      if (this.scene?.bath.animating) {
        this.message("Espere a etapa do banho terminar.");
        return;
      }
      if (!this.state || this.scene?.mini || this.busy) return;
      this.scene?.audio?.play("abrir_menu");
      this.focusBack = document.activeElement;
      this.menu = name;
      if (this.scene) this.scene.input.enabled = false;
      this.renderMenu();
      $("patch-overlay").hidden = false;
      const dialog = $("patch-dialog");
      if (dialog && !dialog.open) dialog.showModal();
      $("patch-sheet-close").focus();
    },
    closeMenu() {
      if (this.menu) this.scene?.audio?.play("fechar_menu");
      this.menu = null;
      if (this.scene) this.scene.input.enabled = true;
      $("patch-dialog")?.close();
      $("patch-overlay").hidden = true;
      if (this.focusBack?.isConnected) this.focusBack.focus();
    },
    renderMenu() {
      const s = this.state,
        area = $("patch-sheet-body");
      if (!s || !this.menu) return;
      if (this.menu === "nivel") {
        $("patch-sheet-title").textContent = "Novo nível!";
        area.replaceChildren(
          el("p", "O Patch chegou ao nível " + this.levelToShow + " ♡"),
          el(
            "p",
            "A experiência e a recompensa foram salvas. Confira os novos itens disponíveis na loja.",
          ),
        );
        const close = el("button", "Continuar cuidando");
        close.onclick = () => this.closeMenu();
        area.append(close);
        return;
      }
      if (this.productionUI?.render(this.menu, s, area)) return;
      area.replaceChildren();
      const title = {
        tarefas: "Tarefas e recompensas",
        loja: "Loja do Patch",
        inventario: "Meu inventário",
        jogos: "Minijogos",
        progresso: "Idades do Patch",
        comidas: "Mercadinho de comidas",
      };
      const panelTitle = $("patch-sheet-title");
      const old = title[this.menu];
      if (panelTitle.textContent !== old) panelTitle.textContent = old;
      if (this.menu === "comidas") {
        area.append(
          el(
            "p",
            "Compre com moedas do Patch. O estoque é compartilhado pelo casal. Cada compra adiciona uma unidade.",
          ),
        );
        const grid = el("div", undefined, "patch-shop-grid");
        for (const food of s.catalogo_alimentos || []) {
          const qty = Number(s.alimentos?.[food.id] || 0),
            card = el("div", undefined, "patch-shop-item");
          card.dataset.food = food.id;
          card.append(
            el("span", food.icone, "patch-item-icon"),
            el("strong", food.nome),
            el(
              "small",
              food.preco + " moedas · +" + food.saciedade + " de saciedade",
            ),
            el("small", "No estoque: " + qty),
          );
          const buy = el("button", "Comprar +1");
          buy.dataset.locked = String(s.moedas < food.preco || qty >= 99);
          buy.disabled = buy.dataset.locked === "true";
          buy.onclick = () => this.act("comprar_comida", food.id);
          card.append(buy);
          grid.append(card);
        }
        const kitchen = el("button", "Ir para a cozinha");
        kitchen.onclick = () => {
          this.closeMenu();
          this.go("cozinha");
        };
        area.append(grid, kitchen);
      } else if (this.menu === "progresso") {
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
        area.append(
          el(
            "p",
            "Moedas ganhas nos cuidados hoje: " +
              (s.recompensas_cuidados || 0) +
              " / " +
              (s.limite_cuidados || 30) +
              ". Alimentar e dar banho rendem até 2 moedas; carinho, dança, brincadeira e rega rendem até 1 quando melhoram uma necessidade.",
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
            this.scene.showMiniIntro(type);
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
    async cancelGame(id) {
      if (!this.state?.producao) return;
      const gen = this.generation;
      this.setBusy(true);
      try {
        const r = await bridge.rpc("patch_partida_cancelar", { p_partida: id });
        if (gen === this.generation && r?.estado) this.accept(r.estado);
      } catch (e) {
        if (gen === this.generation)
          this.message(
            e.message ||
              "Não foi possível encerrar a partida. Tente novamente.",
            true,
          );
      } finally {
        if (gen === this.generation) this.setBusy(false);
      }
    },
    async startGame(type, difficulty = "normal") {
      if (this.careController?.session) {
        this.message("Encerre o cuidado antes de jogar.");
        return;
      }
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
          ...(this.state.producao ? { p_dificuldade: difficulty } : {}),
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
        this.accept(result.estado);
        this.scene.showMiniResult(result, game);
        this.message(
          result.premio > 0
            ? "Muito bem! +" + result.premio + " moedas do Patch."
            : "Atividade concluída. Tente novamente para alcançar a meta!",
        );
        if (result.premio > 0) this.scene.sfx("patch-win");
      } catch (e) {
        if (gen === this.generation) {
          this.scene.showMiniError(game, proof, e);
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
        ...$("patch-overlay").querySelectorAll(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ),
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
  $("patch-drag-mode").onclick = () => App.setDragMode(!App.dragMode);
  App.setDragMode(false);
  setInterval(() => {
    if (App.state) App.refreshControls();
  }, 250);
  root.querySelectorAll("[data-patch-menu]").forEach((b) => {
    const menus = {
      comidas: ["🥕", "Comidas"],
      tarefas: ["✓", "Tarefas"],
      loja: ["🛍", "Loja"],
      inventario: ["🎒", "Itens"],
      jogos: ["🎮", "Jogos"],
    };
    const item = menus[b.dataset.patchMenu];
    if (item) {
      b.replaceChildren(
        el("span", item[0], "patch-tool-icon"),
        el("span", item[1]),
      );
    }
  });
  App.saves = new SaveManager(bridge);
  App.productionUI = new ProductionUI(App, { root, $, el });
  App.careController = new CareController(App, { root, $, el });
  App.audioVolume = window.nhPreferencias?.valor("patchVolume") ?? 0.35;
  window.addEventListener("nh-preferencias-aplicar", (e) => {
    App.audioVolume = e.detail.patchVolume ?? 0.35;
  });
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
    getVolume: () => App.getVolume(),
    care: () => App.careController,
    action: (a, i) => App.act(a, i),
    startGame: (t) => App.startGame(t),
  };
})();
