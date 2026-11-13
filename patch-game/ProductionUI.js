/* Painéis do Patch. O servidor continua sendo a única fonte de saldo, posse e prêmios. */
const CATEGORIES = [
  ["comidas", "Comidas", "🥕"],
  ["roupas", "Roupas", "👕"],
  ["acessorios", "Acessórios", "🎀"],
  ["brinquedos", "Brinquedos", "🧸"],
  ["moveis", "Móveis", "🛏"],
  ["decoracoes", "Decorações", "🌷"],
];
const ROOMS = {
  sala: "Sala",
  cozinha: "Cozinha",
  banheiro: "Banheiro",
  quarto: "Quarto",
  jardim: "Jardim",
  passeio: "Passeio",
};
const TITLES = {
  loja: "Loja do Patch",
  comidas: "Mercadinho de comidas",
  inventario: "Meu inventário",
  casa: "Personalizar a casa",
  tarefas: "Missões diárias",
  missoes: "Missões diárias",
  conquistas: "Conquistas do Patch",
  config: "Configurações do jogo",
  configuracoes: "Configurações do jogo",
};
const count = (value) =>
  Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const coins = (value) => count(value).toLocaleString("pt-BR");
const priceOf = (item) =>
  Number.isSafeInteger(Number(item.preco)) && Number(item.preco) >= 0
    ? Number(item.preco)
    : null;
const categoryOf = (item) =>
  item.categoria ||
  {
    roupa: "roupas",
    acessorio: "acessorios",
    brinquedo: "brinquedos",
    movel: "moveis",
    decoracao: "decoracoes",
  }[item.tipo];
const safeAsset = (path) =>
  typeof path === "string" &&
  /^(?:\.\/)?(?:Patch_Jogo_Completo|patch-game|patch|assets)\/[A-Za-z0-9_./%\-]+\.(?:svg|png|webp|gif)$/i.test(
    path,
  ) &&
  !path.includes("..");

export class ProductionUI {
  constructor(app, { root, $, el, assets } = {}) {
    this.app = app;
    this.root = root;
    this.$ = $ || ((id) => document.getElementById(id));
    this.el =
      el ||
      ((tag, text, cls) => {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (cls) node.className = cls;
        return node;
      });
    this.assets = assets;
    this.category = "comidas";
    this.inventoryCategory = "comidas";
    this.menu = null;
    this.pending = null;
    this.area = null;
    this.state = null;
    this.destroyed = false;
    this.configControls = null;
  }
  render(name, state, area) {
    if (this.destroyed || state?.producao !== true || !(name in TITLES))
      return false;
    const same = this.menu === name && this.area === area;
    if (!same) {
      this.pending = null;
      if (name === "comidas") this.category = "comidas";
      this.configControls = null;
    }
    this.menu = name;
    this.area = area;
    this.state = state;
    const heading = this.$("patch-sheet-title");
    if (heading) heading.textContent = TITLES[name];
    // Um evento Realtime não substitui o slider ou o campo que o jogador está usando.
    if (
      (name === "config" || name === "configuracoes") &&
      same &&
      this.configControls &&
      area.contains(this.configControls.volume)
    ) {
      if (!area.contains(document.activeElement)) this.syncSettings();
      return true;
    }
    const focused = area.contains(document.activeElement)
      ? document.activeElement?.dataset?.uiKey
      : null;
    area.replaceChildren();
    area.classList.add("patch-production-panel");
    if (name === "config" || name === "configuracoes") this.renderSettings();
    else if (name === "tarefas" || name === "missoes") this.renderMissions();
    else if (name === "conquistas") this.renderAchievements();
    else this.renderStore(name);
    this.app.setBusy?.(!!this.app.busy);
    if (focused) {
      const button = [...area.querySelectorAll("[data-ui-key]")].find(
        (node) => node.dataset.uiKey === focused && !node.disabled,
      );
      button?.focus({ preventScroll: true });
    }
    return true;
  }
  node(tag, text, cls) {
    return this.el(tag, text, cls);
  }
  button(label, onClick, { locked = false, key, cls } = {}) {
    const button = this.node("button", label, cls);
    button.type = "button";
    button.dataset.locked = String(locked);
    button.disabled = locked || !!this.app.busy;
    if (key) button.dataset.uiKey = key;
    button.addEventListener("click", () => {
      if (!button.disabled) onClick();
    });
    return button;
  }
  info(text, cls = "patch-production-info") {
    return this.node("p", text, cls);
  }
  itemIcon(item) {
    const box = this.node("span", undefined, "patch-product-picture");
    const category = categoryOf(item) || "comidas";
    const fallback =
      item.icone || CATEGORIES.find((c) => c[0] === category)?.[2] || "♡";
    let path;
    try {
      path =
        this.assets?.object?.(item.id) || this.assets?.object?.(item.asset);
    } catch {}
    if (safeAsset(path)) {
      const img = this.node("img");
      img.src = path;
      img.alt = "";
      img.width = 72;
      img.height = 72;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener(
        "error",
        () => {
          box.replaceChildren(this.node("span", fallback));
        },
        { once: true },
      );
      box.append(img);
    } else box.append(this.node("span", fallback));
    return box;
  }
  foods() {
    return (this.state.catalogo_alimentos || []).map((item) => ({
      ...item,
      categoria: "comidas",
      tipo: "comida",
    }));
  }
  allItems() {
    return [...this.foods(), ...(this.state.catalogo || [])];
  }
  owned(item) {
    return categoryOf(item) === "comidas"
      ? count(this.state.alimentos?.[item.id]) > 0
      : (this.state.inventario || []).includes(item.id);
  }
  equipped(item) {
    if (
      [
        this.state.roupa,
        this.state.acessorio,
        this.state.brinquedo,
        this.state.decoracao,
      ].includes(item.id)
    )
      return true;
    return Object.values(this.state.casa || {}).some(
      (room) =>
        room &&
        typeof room === "object" &&
        Object.values(room).includes(item.id),
    );
  }
  equipAction(item) {
    if (item.tipo === "acessorio" || categoryOf(item) === "acessorios")
      return "acessorio";
    if (item.tipo === "brinquedo" || categoryOf(item) === "brinquedos")
      return "brinquedo";
    if (
      ["movel", "decoracao"].includes(item.tipo) ||
      ["moveis", "decoracoes"].includes(categoryOf(item))
    )
      return "instalar";
    return "vestir";
  }
  renderStore(name) {
    const inventory = name === "inventario" || name === "casa";
    this.area.append(this.balance());
    let available =
      name === "casa"
        ? CATEGORIES.filter((c) => ["moveis", "decoracoes"].includes(c[0]))
        : CATEGORIES;
    let category = inventory ? this.inventoryCategory : this.category;
    if (name === "comidas") category = "comidas";
    if (!available.some((c) => c[0] === category)) category = available[0][0];
    if (inventory) this.inventoryCategory = category;
    else this.category = category;
    if (name !== "comidas")
      this.area.append(this.categoryTabs(available, category, inventory));
    this.area.append(
      this.info(
        inventory
          ? "Tudo o que o casal adquiriu fica disponível aqui. Equipar ou instalar altera o bichinho ou o cenário."
          : "Use as moedas virtuais do Patch. O preço, o desbloqueio e a compra são confirmados pelo servidor.",
      ),
    );
    if (this.pending) this.renderConfirmation();
    let items = this.allItems().filter((item) => categoryOf(item) === category);
    if (inventory) items = items.filter((item) => this.owned(item));
    const grid = this.node("div", undefined, "patch-production-grid");
    grid.setAttribute(
      "aria-label",
      CATEGORIES.find((c) => c[0] === category)?.[1] || "Itens",
    );
    for (const item of items) grid.append(this.itemCard(item, inventory));
    if (!items.length) {
      const empty = this.node("div", undefined, "patch-production-empty");
      empty.append(
        this.node(
          "span",
          CATEGORIES.find((c) => c[0] === category)?.[2] || "♡",
        ),
        this.node(
          "strong",
          inventory
            ? "Ainda não há itens nesta categoria."
            : "Nenhum item disponível nesta categoria.",
        ),
        this.info(
          inventory
            ? "As compras confirmadas aparecem automaticamente no inventário."
            : "O catálogo é carregado do servidor.",
        ),
      );
      if (inventory)
        empty.append(
          this.button(
            "Abrir a loja",
            () => {
              this.category = category;
              this.app.openMenu?.(category === "comidas" ? "comidas" : "loja");
            },
            { key: "open-store" },
          ),
        );
      this.area.append(empty);
    } else this.area.append(grid);
    if (category === "comidas")
      this.area.append(
        this.button(
          "Ir para a cozinha",
          () => {
            this.app.closeMenu?.();
            this.app.go?.("cozinha");
          },
          { key: "go-kitchen", cls: "patch-production-wide" },
        ),
      );
    if (inventory && category === "roupas")
      this.area.append(
        this.button(
          "Usar roupa original",
          () => this.app.act("vestir", "padrao"),
          {
            key: "original-clothes",
            locked: !this.state.roupa,
            cls: "patch-production-wide",
          },
        ),
      );
    if (inventory && category === "acessorios")
      this.area.append(
        this.button(
          "Retirar acessório",
          () => this.app.act("acessorio", "padrao"),
          {
            key: "remove-accessory",
            locked: !this.state.acessorio,
            cls: "patch-production-wide",
          },
        ),
      );
    if (inventory && category === "brinquedos")
      this.area.append(
        this.button(
          "Guardar brinquedo",
          () => this.app.act("brinquedo", "padrao"),
          {
            key: "remove-toy",
            locked: !this.state.brinquedo,
            cls: "patch-production-wide",
          },
        ),
      );
    if (name === "casa")
      this.area.append(
        this.button(
          "Restaurar decoração original",
          () => this.app.act("restaurar_casa", null),
          {
            key: "reset-house",
            locked: !Object.values(this.state.casa || {}).some(
              (room) => room && Object.keys(room).length,
            ),
            cls: "patch-production-wide",
          },
        ),
      );
    if (name === "comidas")
      this.area.append(
        this.button(
          "Ver roupas, acessórios e casa",
          () => {
            this.category = "roupas";
            this.app.openMenu?.("loja");
          },
          { key: "full-store", cls: "patch-production-wide" },
        ),
      );
  }
  balance() {
    const row = this.node("div", undefined, "patch-production-balance");
    row.append(
      this.node("span", "🪙 Moedas do Patch"),
      this.node("strong", coins(this.state.moedas)),
    );
    return row;
  }
  categoryTabs(categories, selected, inventory) {
    const nav = this.node("div", undefined, "patch-production-categories");
    nav.setAttribute("role", "group");
    nav.setAttribute(
      "aria-label",
      inventory ? "Categorias do inventário" : "Categorias da loja",
    );
    for (const [id, label, icon] of categories) {
      const button = this.button(
        undefined,
        () => {
          if (inventory) this.inventoryCategory = id;
          else this.category = id;
          this.pending = null;
          this.render(this.menu, this.app.state || this.state, this.area);
        },
        { key: "category-" + id },
      );
      button.dataset.category = id;
      button.setAttribute("aria-pressed", String(selected === id));
      button.append(this.node("span", icon), document.createTextNode(label));
      nav.append(button);
    }
    return nav;
  }
  itemCard(item, inventory) {
    const category = categoryOf(item),
      food = category === "comidas",
      owned = this.owned(item),
      used = this.equipped(item),
      qty = count(this.state.alimentos?.[item.id]),
      level = Math.max(1, count(item.min_nivel || 1)),
      unlocked = count(this.state.nivel) >= level,
      price = priceOf(item);
    const card = this.node("article", undefined, "patch-production-item");
    card.dataset.product = item.id;
    card.append(
      this.itemIcon(item),
      this.node("strong", item.nome || item.id),
      this.info(
        item.descricao ||
          (food
            ? "Um alimento para recuperar a saciedade do Patch."
            : "Item para personalizar o Patch e sua casa."),
        "patch-product-description",
      ),
    );
    if (item.comodo)
      card.append(
        this.node(
          "small",
          (ROOMS[item.comodo] || item.comodo) +
            (item.slot ? " · " + String(item.slot).replaceAll("_", " ") : ""),
          "patch-product-detail",
        ),
      );
    if (food)
      card.append(
        this.node("small", "No estoque: " + qty, "patch-product-stock"),
        this.node(
          "small",
          "Recupera " + count(item.saciedade) + " de saciedade",
          "patch-product-detail",
        ),
      );
    else
      card.append(
        this.node(
          "small",
          owned
            ? used
              ? "Em uso"
              : "No inventário"
            : "Desbloqueia no nível " + level,
          "patch-product-stock",
        ),
      );
    if (!unlocked)
      card.append(
        this.node("small", "🔒 Chegue ao nível " + level, "patch-product-lock"),
      );
    if (food || !owned) {
      card.append(
        this.node(
          "small",
          price === null ? "Preço indisponível" : coins(price) + " moedas",
          "patch-product-price",
        ),
      );
      const locked =
        !unlocked ||
        price === null ||
        count(this.state.moedas) < price ||
        (food && qty >= 99);
      const label = !unlocked
        ? "Bloqueado"
        : food && qty >= 99
          ? "Estoque cheio"
          : count(this.state.moedas) < price
            ? "Moedas insuficientes"
            : food
              ? "Comprar +1"
              : "Comprar";
      card.append(
        this.button(label, () => this.confirmPurchase(item), {
          locked,
          key: "buy-" + item.id,
          cls: "patch-product-buy",
        }),
      );
    } else {
      card.append(
        this.button(
          used ? "Em uso" : item.comodo ? "Instalar" : "Usar",
          () => this.app.act(this.equipAction(item), item.id),
          {
            locked: used || !unlocked,
            key: "equip-" + item.id,
            cls: "patch-product-equip",
          },
        ),
      );
    }
    if (inventory && food) {
      const button = this.button(
        "Alimentar na cozinha",
        () => {
          this.app.closeMenu?.();
          this.app.go?.("cozinha");
        },
        { key: "feed-" + item.id, cls: "patch-product-equip" },
      );
      card.append(button);
    }
    return card;
  }
  confirmPurchase(item) {
    this.pending = { id: item.id, category: categoryOf(item), failed: false };
    this.render(this.menu, this.app.state || this.state, this.area);
    const panel = this.area.querySelector(".patch-purchase-confirm");
    panel?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    panel?.querySelector("button")?.focus({ preventScroll: true });
  }
  renderConfirmation() {
    const item = this.allItems().find(
      (item) =>
        item.id === this.pending.id &&
        categoryOf(item) === this.pending.category,
    );
    if (!item) {
      this.pending = null;
      return;
    }
    const food = categoryOf(item) === "comidas",
      price = priceOf(item),
      owned = this.owned(item),
      quantity = count(this.state.alimentos?.[item.id]),
      level = Math.max(1, count(item.min_nivel || 1));
    if ((!food && owned) || quantity >= 99) {
      this.pending = null;
      return;
    }
    const panel = this.node("section", undefined, "patch-purchase-confirm");
    panel.setAttribute("aria-label", "Confirmar compra");
    panel.append(
      this.node("strong", "Confirmar compra"),
      this.info(
        (food ? "Uma unidade de " : "") +
          (item.nome || item.id) +
          " por " +
          (price === null ? "preço indisponível" : coins(price) + " moedas") +
          ".",
      ),
      this.node(
        "small",
        "Saldo atual: " +
          coins(this.state.moedas) +
          " moedas. A confirmação vem do servidor.",
      ),
    );
    if (this.pending.failed)
      panel.append(
        this.info(
          "A compra não foi confirmada. Confira a conexão e tente novamente.",
          "patch-production-warning",
        ),
      );
    const locked =
      price === null ||
      count(this.state.moedas) < price ||
      count(this.state.nivel) < level;
    const controls = this.node("div", undefined, "patch-confirm-buttons");
    controls.append(
      this.button(
        this.pending.failed
          ? "Tentar confirmar novamente"
          : "Confirmar · " + coins(price) + " moedas",
        async () => {
          const id = item.id;
          const result = await this.app.act(
            food ? "comprar_comida" : "comprar",
            id,
          );
          if (this.destroyed || this.pending?.id !== id) return;
          if (result) {
            this.pending = null;
            this.render(this.menu, this.app.state || result, this.area);
          } else {
            this.pending.failed = true;
            this.render(this.menu, this.app.state || this.state, this.area);
          }
        },
        { locked, key: "confirm-" + item.id },
      ),
      this.button(
        "Cancelar",
        () => {
          this.pending = null;
          this.render(this.menu, this.app.state || this.state, this.area);
          [...this.area.querySelectorAll("[data-ui-key]")]
            .find((node) => node.dataset.uiKey === "buy-" + item.id)
            ?.focus({ preventScroll: true });
        },
        { key: "cancel-purchase" },
      ),
    );
    panel.append(controls);
    this.area.append(panel);
  }
  rewardText(reward) {
    return (
      coins(reward?.moedas) +
      " moedas" +
      (count(reward?.xp) ? " · " + count(reward.xp) + " XP" : "")
    );
  }
  progress(current, goal, label) {
    const target = Math.max(1, count(goal)),
      value = Math.min(target, count(current)),
      wrap = this.node("div", undefined, "patch-production-progress"),
      meter = this.node("progress");
    meter.max = target;
    meter.value = value;
    meter.setAttribute("aria-label", label + ": " + value + " de " + target);
    wrap.append(meter, this.node("span", value + " / " + target));
    return wrap;
  }
  renderMissions() {
    this.area.append(
      this.balance(),
      this.info(
        "Missões compartilhadas pelo casal. Cada recompensa pode ser resgatada uma vez por dia. A renovação acontece à meia-noite UTC.",
      ),
    );
    const missions = Array.isArray(this.state.missoes)
      ? this.state.missoes
      : [];
    if (!missions.length)
      this.area.append(
        this.info(
          "As missões ainda não foram carregadas. Tente atualizar a conexão.",
        ),
      );
    for (const mission of missions) {
      const row = this.node("article", undefined, "patch-production-objective");
      row.dataset.mission = mission.id;
      row.append(
        this.node("strong", mission.nome || mission.id),
        this.info(mission.descricao || ""),
        this.progress(
          mission.progresso,
          mission.objetivo,
          mission.nome || "Missão",
        ),
        this.node(
          "small",
          this.rewardText(mission.recompensa),
          "patch-objective-reward",
        ),
      );
      const ready = mission.concluida === true && !mission.resgatada;
      row.append(
        this.button(
          mission.resgatada
            ? "Recompensa recebida"
            : ready
              ? "Resgatar recompensa"
              : "Em andamento",
          () => this.app.act("resgatar_missao", mission.id),
          { locked: !ready, key: "mission-" + mission.id },
        ),
      );
      this.area.append(row);
    }
    const gift = this.node("article", undefined, "patch-production-objective");
    gift.append(
      this.node("strong", "🎁 Presente diário"),
      this.info("Um presente por dia para o Patch, compartilhado pelo casal."),
      this.button(
        this.state.presente_disponivel
          ? "Receber presente · +8 moedas"
          : "Presente de hoje já recebido",
        () => this.app.act("presente"),
        { locked: !this.state.presente_disponivel, key: "daily-gift" },
      ),
    );
    this.area.append(gift);
    const date = new Date(this.state.renova_em);
    if (Number.isFinite(date.getTime()))
      this.area.append(
        this.info(
          "Próxima renovação: " +
            date.toLocaleString("pt-BR", {
              timeZone: "UTC",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }) +
            " UTC.",
        ),
      );
    this.area.append(
      this.info(
        "Recompensas de jogos hoje: " +
          count(this.state.jogos_hoje) +
          " / 10. Moedas por cuidados: " +
          count(this.state.recompensas_cuidados) +
          " / " +
          count(this.state.limite_cuidados || 30) +
          ".",
      ),
    );
  }
  renderAchievements() {
    this.area.append(
      this.info(
        "As conquistas acompanham toda a história do Patch. O desbloqueio e a data ficam salvos, mesmo depois de resgatar a recompensa.",
      ),
    );
    const achievements = Array.isArray(this.state.conquistas)
      ? this.state.conquistas
      : [];
    if (!achievements.length)
      this.area.append(
        this.info(
          "As conquistas ainda não foram carregadas. Tente atualizar a conexão.",
        ),
      );
    for (const achievement of achievements) {
      const unlocked =
          typeof achievement.desbloqueada_em === "string" &&
          achievement.desbloqueada_em.length > 0,
        ready = unlocked && !achievement.resgatada,
        row = this.node("article", undefined, "patch-production-objective");
      row.dataset.achievement = achievement.id;
      row.classList.toggle("is-unlocked", unlocked);
      row.append(
        this.node("span", achievement.icone || "⭐", "patch-achievement-icon"),
        this.node("strong", achievement.nome || achievement.id),
        this.info(achievement.descricao || ""),
        this.progress(
          achievement.progresso,
          achievement.objetivo,
          achievement.nome || "Conquista",
        ),
        this.node(
          "small",
          this.rewardText(achievement.recompensa),
          "patch-objective-reward",
        ),
      );
      const date = new Date(achievement.desbloqueada_em);
      if (unlocked && Number.isFinite(date.getTime()))
        row.append(
          this.node(
            "small",
            "Conquistado em " +
              date.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
            "patch-product-detail",
          ),
        );
      row.append(
        this.button(
          achievement.resgatada
            ? "Recompensa recebida"
            : ready
              ? "Resgatar conquista"
              : "Ainda não conquistado",
          () => this.app.act("resgatar_conquista", achievement.id),
          { locked: !ready, key: "achievement-" + achievement.id },
        ),
      );
      this.area.append(row);
    }
  }
  renderSettings() {
    const settings = this.node("div", undefined, "patch-production-settings"),
      soundRow = this.node("label", undefined, "patch-setting-row"),
      sound = this.node("input");
    sound.type = "checkbox";
    sound.dataset.uiKey = "sound-enabled";
    sound.checked = this.app.getSound?.() !== false;
    sound.addEventListener("change", () => this.app.setSound?.(sound.checked));
    soundRow.append(sound, this.node("span", "Efeitos sonoros"));
    const volumeLabel = this.node(
        "label",
        "Volume dos efeitos",
        "patch-setting-label",
      ),
      volume = this.node("input"),
      value = this.node("output");
    volume.id = "patch-production-volume";
    volume.type = "range";
    volume.min = "0";
    volume.max = "1";
    volume.step = "0.05";
    volume.dataset.uiKey = "sound-volume";
    volume.value = String(
      Math.min(1, Math.max(0, Number(this.app.getVolume?.() ?? 0.35))),
    );
    volume.setAttribute("aria-label", "Volume dos efeitos do Patch");
    volumeLabel.htmlFor = volume.id;
    value.setAttribute("for", volume.id);
    value.textContent = Math.round(Number(volume.value) * 100) + "%";
    const line = this.node("div", undefined, "patch-volume-line");
    line.append(volume, value);
    volume.addEventListener("input", () => {
      const amount = Math.min(1, Math.max(0, Number(volume.value)));
      value.textContent = Math.round(amount * 100) + "%";
      this.app.setVolume?.(amount);
    });
    settings.append(
      soundRow,
      volumeLabel,
      line,
      this.info(
        "O navegador pode pedir um toque antes de liberar o áudio. As preferências de som pertencem à sua conta.",
      ),
      this.info(
        "Dica: deslize no cenário para rolar a página. Para mover um objeto, use Mover objetos; ao soltar, a rolagem volta ao normal.",
      ),
    );
    this.configControls = { sound, volume, value };
    this.area.append(settings);
  }
  syncSettings() {
    if (!this.configControls) return;
    const { sound, volume, value } = this.configControls;
    sound.checked = this.app.getSound?.() !== false;
    volume.value = String(
      Math.min(1, Math.max(0, Number(this.app.getVolume?.() ?? 0.35))),
    );
    value.textContent = Math.round(Number(volume.value) * 100) + "%";
  }
  destroy() {
    this.destroyed = true;
    this.pending = null;
    this.configControls = null;
    this.area = null;
    this.state = null;
  }
}
