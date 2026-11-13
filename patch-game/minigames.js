/** Mini games share the authenticated challenge/settlement API. No client-side coins. */
export function installMiniGames(SceneClass, deps) {
  const { Phaser: P, app, audio } = deps;
  const originalRenderRoom = SceneClass.prototype.renderRoom;
  const reduced = () => !!deps.reduced?.matches;
  const info = {
    coracoes: {
      title: "Pega-corações",
      icon: "coracao",
      text: "Mova o Patch para os lados e fique embaixo dos corações que caem. Cada coração coletado vale um ponto.",
      control: "Arraste na horizontal, toque onde quer ir ou use ← e →.",
      target:
        "Colete o máximo antes do cronômetro acabar. A dificuldade muda a quantidade e a velocidade.",
    },
    memoria: {
      title: "Jogo da memória",
      icon: "flor",
      text: "Revele duas cartas por vez e encontre os três pares. As cartas são embaralhadas a cada partida.",
      control: "Toque nas cartas ou use Tab e Enter nos controles abaixo.",
      target:
        "Encontre todos os pares em até dois minutos. As tentativas e o tempo aparecem na tela.",
    },
    estrelas: {
      title: "Caminho das estrelas",
      icon: "estrela",
      text: "O Patch corre pelo jardim. Salte sobre os obstáculos que se aproximam e preserve suas três vidas.",
      control: "Toque no cenário, pressione Espaço ou use o botão Saltar.",
      target:
        "Cada obstáculo ultrapassado soma um ponto. Três colisões encerram a partida.",
    },
    passeio: {
      title: "Passeio no parque",
      icon: "coracao",
      text: "Explore o caminho do parque com o Patch. Toque nos três corações para caminhar até eles e recolhê-los.",
      control: "Toque em um coração quando ele aparecer.",
      target:
        "Recolha os três antes do fim do passeio para receber a recompensa.",
    },
  };
  function sound(scene, key) {
    const manager = scene.audio || audio;
    if (manager?.play)
      manager.play(
        {
          inicio: "minijogo_inicio",
          vitoria: "minijogo_vitoria",
          coleta: "moeda_coletar",
          derrota: "minijogo_derrota",
          toque: "toque_botao",
          pular: "estrela",
        }[key] || "toque_botao",
      );
    else
      scene.sfx?.(
        {
          inicio: "patch-click",
          vitoria: "patch-win",
          coleta: "patch-coin",
          derrota: "patch-click",
        }[key] || "patch-click",
      );
  }
  function token(scene, key, x, y, size = 42) {
    const texture = "obj-" + key;
    if (scene.textures.exists(texture))
      return scene.add.image(x, y, texture).setDisplaySize(size, size);
    return scene.add
      .text(
        x,
        y,
        {
          coracao: "♥",
          estrela: "★",
          bola: "●",
          flor: "❀",
          moeda: "●",
          ursinho: "♧",
        }[key] || "♡",
        {
          fontFamily: "sans-serif",
          fontSize: size + "px",
          color: "#be608f",
          stroke: "#fff8fc",
          strokeThickness: 2,
        },
      )
      .setOrigin(0.5);
  }
  function child(scene, object) {
    scene.miniLayer.add(object);
    return object;
  }
  function text(scene, value, x, y, size = 18, color = "#623956") {
    return child(
      scene,
      scene.add
        .text(x, y, value, {
          fontFamily: "system-ui,sans-serif",
          fontSize: size + "px",
          color,
          align: "center",
        })
        .setOrigin(0.5),
    );
  }
  function pet(scene, x, y, size = 136) {
    const body = scene.body,
      sprite = scene.add
        .sprite(x, y, body.texture.key, body.frame.name)
        .setOrigin(0.5, 1)
        .setDisplaySize(size, size);
    const anim = body.anims?.currentAnim?.key;
    if (!reduced() && anim && scene.anims.exists(anim)) sprite.play(anim);
    return child(scene, sprite);
  }
  function makeButton(label, action, className = "") {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.className = className;
    b.onclick = action;
    return b;
  }
  function panel(scene, title, description) {
    scene._clearMiniPanel();
    const host = document.getElementById("patch-stage"),
      overlay = document.createElement("div"),
      card = document.createElement("section");
    overlay.className = "patch-mini-overlay";
    card.className = "patch-mini-panel";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    const id = "patch-mini-title";
    card.setAttribute("aria-labelledby", id);
    const h = document.createElement("h3");
    h.id = id;
    h.textContent = title;
    card.append(h);
    if (description) {
      const p = document.createElement("p");
      p.textContent = description;
      card.append(p);
    }
    const close = makeButton("×", () => scene.cancelMini(), "patch-mini-close");
    close.setAttribute("aria-label", "Fechar minijogo");
    card.prepend(close);
    overlay.append(card);
    host.append(overlay);
    document.getElementById("patch-game").dataset.minigame = "true";
    scene._miniPanel = overlay;
    scene._miniFocus = document.activeElement;
    scene.input.enabled = false;
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        scene.cancelMini();
      }
      if (event.key === "Tab") {
        const items = [
          ...overlay.querySelectorAll("button:not(:disabled),select"),
        ];
        if (event.shiftKey && document.activeElement === items[0]) {
          event.preventDefault();
          items.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
          event.preventDefault();
          items[0]?.focus();
        }
      }
    });
    requestAnimationFrame(() => close.focus({ preventScroll: true }));
    return card;
  }
  function nativeControls(scene, options) {
    scene._miniControls?.remove();
    const host = document.getElementById("patch-stage"),
      area = document.createElement("div");
    area.className = "patch-mini-controls";
    for (const [name, fn] of options) {
      const b = makeButton(name, fn);
      area.append(b);
    }
    host.append(area);
    scene._miniControls = area;
  }
  function challengeDuration(m) {
    return (
      Number(m.desafio.duracao) ||
      { memoria: 120000, estrelas: 12500, coracoes: 12000, passeio: 15000 }[
        m.tipo
      ]
    );
  }
  function isSafeJump(proof, hit) {
    return proof.some((j) => hit - j >= 80 && hit - j <= 600);
  }
  function startClock(scene, m) {
    m.started = performance.now();
    m.duration = challengeDuration(m);
    scene.miniClock = text(scene, "", 240, 132, 15);
    scene._lastMiniSecond = -1;
  }

  Object.assign(SceneClass.prototype, {
    _clearMiniPanel() {
      if (!this.mini)
        document.getElementById("patch-game").dataset.minigame = "false";
      this._miniPanel?.remove();
      this._miniPanel = null;
      this._miniScreen = null;
      if (this.input) this.input.enabled = !app.menu;
    },
    showMiniIntro(type) {
      if (!info[type] || this.mini || app.busy) return;
      app.setDragMode?.(false);
      const rule = info[type];
      const card = panel(this, rule.title, rule.text);
      this._miniScreen = "intro";
      for (const line of [
        rule.control,
        rule.target,
        "As moedas são confirmadas pelo servidor. Não há aposta nem custo de entrada.",
      ]) {
        const p = document.createElement("p");
        p.textContent = line;
        card.append(p);
      }
      const label = document.createElement("label");
      label.textContent = "Dificuldade";
      const select = document.createElement("select");
      select.setAttribute("aria-label", "Dificuldade do minijogo");
      for (const [value, name] of [
        ["easy", "Tranquilo"],
        ["normal", "Normal"],
        ["hard", "Desafio"],
      ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = name;
        select.append(option);
      }
      select.value = this._miniDifficulty || "normal";
      label.append(select);
      card.append(label);
      const start = makeButton(
        "Começar partida",
        () => {
          const difficulty = select.value;
          this._miniDifficulty = difficulty;
          this._clearMiniPanel();
          app.startGame(type, difficulty);
        },
        "patch-mini-primary",
      );
      card.append(
        start,
        makeButton("Voltar ao Patch", () => this.cancelMini()),
      );
    },
    renderRoom(room) {
      if (this._miniPanel) this._clearMiniPanel();
      return originalRenderRoom.call(this, room);
    },
    beginMini(game) {
      this._clearMiniPanel();
      this._miniControls?.remove();
      this.clearRoom();
      this.mini = {
        ...game,
        desafio: game.desafio || {},
        proof: [],
        started: performance.now(),
        spawned: new Set(),
        caught: new Set(),
        targets: [],
        judged: new Set(),
        ending: false,
        stats: { score: 0, moves: 0, lives: 3 },
        targetX: 240,
        keys: { left: false, right: false },
      };
      document.getElementById("patch-game").dataset.minigame = "true";
      const m = this.mini;
      app.setDragMode?.(false);
      this.pet.setVisible(false);
      this.floorShadow.setVisible(false);
      this.night.setVisible(false);
      this.back.setTexture(
        "room-" +
          (m.tipo === "passeio"
            ? "passeio"
            : m.tipo === "estrelas"
              ? "jardim"
              : "sala"),
      );
      this.miniLayer = this.add.container(0, 0).setDepth(40);
      child(
        this,
        this.add.rectangle(
          240,
          320,
          480,
          640,
          0xfff2fa,
          m.tipo === "passeio" ? 0.12 : 0.55,
        ),
      );
      text(this, info[m.tipo]?.title || "Minijogo", 240, 56, 25);
      this.miniInfo = text(this, "Preparando…", 240, 101, 17);
      startClock(this, m);
      if (m.tipo === "memoria") this.memoryBoard();
      else if (m.tipo === "coracoes") {
        this.miniPet = pet(this, 240, 585, 140);
        nativeControls(this, [
          [
            "← Mover",
            () => {
              if (this.mini === m) m.targetX = Math.max(50, m.targetX - 65);
            },
          ],
          [
            "Mover →",
            () => {
              if (this.mini === m) m.targetX = Math.min(430, m.targetX + 65);
            },
          ],
        ]);
      } else if (m.tipo === "estrelas") {
        child(this, this.add.rectangle(240, 546, 480, 8, 0xd0b1ca, 0.7));
        this.jumpPet = pet(this, 105, 535, 125);
        this.jumping = false;
        this._miniLastJump = -10000;
        nativeControls(this, [["Saltar", () => this.jump()]]);
      } else if (m.tipo === "passeio") {
        this.pet.setVisible(true);
        this.floorShadow.setVisible(true);
        this.pet.setPosition(240, 450);
      }
      if (!this._miniInputInstalled) {
        this._miniInputInstalled = true;
        this.input.on("pointerdown", (p) => {
          const current = this.mini;
          if (
            current?.tipo === "coracoes" &&
            !current.ending &&
            (!p.event?.target || p.event.target === this.game.canvas)
          )
            current.targetX = P.Math.Clamp(p.x, 50, 430);
        });
        const keyHandler = (event) => {
          const m = this.mini;
          if (
            m?.tipo === "coracoes" &&
            !m.ending &&
            document.activeElement?.closest?.("#patch-game") &&
            ["ArrowLeft", "ArrowRight"].includes(event.key)
          ) {
            event.preventDefault();
            m.keys[event.key === "ArrowLeft" ? "left" : "right"] = true;
          }
        };
        const keyUp = (event) => {
          if (
            this.mini?.keys &&
            ["ArrowLeft", "ArrowRight"].includes(event.key)
          )
            this.mini.keys[event.key === "ArrowLeft" ? "left" : "right"] =
              false;
        };
        const blur = () => {
          if (this.mini?.keys) this.mini.keys = { left: false, right: false };
        };
        document.addEventListener("keydown", keyHandler);
        document.addEventListener("keyup", keyUp);
        window.addEventListener("blur", blur);
        this.events.once("shutdown", () => {
          document.removeEventListener("keydown", keyHandler);
          document.removeEventListener("keyup", keyUp);
          window.removeEventListener("blur", blur);
        });
        this.input.on("pointermove", (p) => {
          const current = this.mini;
          if (current?.tipo === "coracoes" && !current.ending && p.isDown)
            current.targetX = P.Math.Clamp(p.x, 50, 430);
        });
      }
      this.game.canvas.setAttribute("tabindex", "0");
      this.game.canvas.focus({ preventScroll: true });
      sound(this, "inicio");
      app.actions?.();
      app.refreshControls?.();
    },
    memoryBoard() {
      const m = this.mini;
      m.flips = [];
      m.matched = new Set();
      m.checking = false;
      m.cards = [];
      const images = ["bola", "flor", "ursinho"];
      (m.desafio.cartas || []).forEach((value, i) => {
        const x = 145 + (i % 2) * 190,
          y = 230 + Math.floor(i / 2) * 125;
        const tile = child(
          this,
          this.add
            .rectangle(x, y, 145, 104, 0xe4b3d2)
            .setStrokeStyle(3, 0xffffff)
            .setInteractive({ useHandCursor: true }),
        );
        const face = child(
            this,
            token(this, images[value % images.length], x, y, 64),
          ).setVisible(false),
          back = child(this, token(this, "coracao", x, y, 48));
        m.cards.push({ tile, face, back, value });
        this.bindTap(tile, () => this.flip(i));
      });
      nativeControls(
        this,
        (m.desafio.cartas || []).map((_, i) => [
          "Carta " + (i + 1),
          () => this.flip(i),
        ]),
      );
      this._miniControls.classList.add("patch-mini-memory-controls");
    },
    flip(i) {
      const m = this.mini;
      if (
        !m ||
        m.tipo !== "memoria" ||
        m.ending ||
        m.checking ||
        m.matched.has(i) ||
        m.flips.includes(i) ||
        !m.cards[i]
      )
        return;
      const reveal = (idx, on) => {
        m.cards[idx].face.setVisible(on);
        m.cards[idx].back.setVisible(!on);
      };
      m.flips.push(i);
      reveal(i, true);
      sound(this, "toque");
      if (m.flips.length !== 2) return;
      m.stats.moves++;
      const [a, b] = m.flips;
      m.proof.push([a, b]);
      if (m.cards[a].value === m.cards[b].value) {
        m.matched.add(a);
        m.matched.add(b);
        m.cards[a].tile.setFillStyle(0xb7d6c5);
        m.cards[b].tile.setFillStyle(0xb7d6c5);
        m.flips = [];
        m.stats.score = m.matched.size / 2;
        sound(this, "coleta");
        if (m.matched.size === m.cards.length) {
          m.checking = true;
          this.miniInfo.setText("Todos os pares!");
          const delay = Math.max(0, 6200 - (performance.now() - m.started));
          this.time.delayedCall(delay, () => {
            if (this.mini === m) this.finishMini();
          });
        }
      } else {
        m.checking = true;
        this.time.delayedCall(reduced() ? 250 : 700, () => {
          if (this.mini !== m || m.ending) return;
          reveal(a, false);
          reveal(b, false);
          m.flips = [];
          m.checking = false;
        });
      }
    },
    jump() {
      const m = this.mini;
      if (!m || m.tipo !== "estrelas" || m.ending) return;
      const t = Math.round(performance.now() - m.started);
      if (t - this._miniLastJump < 700) return;
      this._miniLastJump = t;
      m.proof.push(t);
      this.jumping = true;
      sound(this, "pular");
    },
    async collect(target) {
      const m = this.mini;
      if (!m || m.ending || m.caught.has(target.id) || m.collecting) return;
      if (m.tipo === "passeio") {
        m.collecting = true;
        await this.walkTo(target.obj.x, 450);
        m.collecting = false;
      }
      if (this.mini !== m || m.ending) return;
      const t = Math.round(performance.now() - m.started);
      if (t < target.inicio || t > target.inicio + target.duracao) return;
      m.caught.add(target.id);
      m.proof.push({ id: target.id, em: t });
      m.stats.score = m.caught.size;
      target.obj.destroy();
      this.burst(target.x, target.obj.y || 400, "♡");
      sound(this, "coleta");
    },
    finishMini() {
      const m = this.mini;
      if (!m || m.ending) return;
      m.ending = true;
      m.stats.elapsed = Math.round(performance.now() - m.started);
      this.miniInfo.setText("Confirmando resultado…");
      this._miniControls?.remove();
      this._miniControls = null;
      app.finishGame(m, m.proof);
    },
    showMiniResult(result, game) {
      const source = this.mini?.id === game.id ? this.mini : game,
        stats = source.stats || {},
        reward = Number(result.premio) || 0,
        rule = info[game.tipo] || { title: "Atividade" };
      this._miniControls?.remove();
      if (this.mini) {
        this.mini.ending = true;
        this.mini._settled = true;
      }
      const card = panel(
        this,
        rule.title + " · Resultado",
        reward > 0
          ? "Muito bem! Sua recompensa foi confirmada."
          : "Partida concluída. Você pode tentar novamente.",
      );
      this._miniScreen = "result";
      const list = document.createElement("dl");
      for (const [label, value] of [
        ["Pontuação", result.acertos ?? stats.score ?? 0],
        ["Tempo", Math.round((stats.elapsed || 0) / 1000) + "s"],
        ...(game.tipo === "memoria" ? [["Tentativas", stats.moves || 0]] : []),
        ["Moedas recebidas", reward],
      ]) {
        const dt = document.createElement("dt"),
          dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = String(value);
        list.append(dt, dd);
      }
      card.append(list);
      card.append(
        makeButton(
          "Jogar novamente",
          () => {
            const type = game.tipo,
              difficulty =
                game.desafio?.dificuldade || this._miniDifficulty || "normal";
            this.cancelMini();
            app.startGame(type, difficulty);
          },
          "patch-mini-primary",
        ),
        makeButton("Voltar ao Patch", () => this.cancelMini()),
      );
      sound(this, reward ? "vitoria" : "derrota");
    },
    showMiniError(game, proof, error) {
      const card = panel(
        this,
        "Resultado ainda não confirmado",
        error?.message ||
          "A conexão falhou. Nenhuma recompensa foi criada no aparelho.",
      );
      this._miniScreen = "error";
      card.append(
        makeButton(
          "Confirmar novamente",
          () => {
            this._clearMiniPanel();
            app.finishGame(game, proof);
          },
          "patch-mini-primary",
        ),
        makeButton("Voltar ao Patch", () => this.cancelMini()),
      );
    },
    cancelMini(render = true) {
      const abandoned = this.mini && !this.mini._settled ? this.mini : null;
      if (abandoned) app.cancelGame?.(abandoned.id);
      this._clearMiniPanel();
      this._miniControls?.remove();
      this._miniControls = null;
      const had = !!this.mini;
      this.mini = null;
      document.getElementById("patch-game").dataset.minigame = "false";
      this.miniLayer?.destroy(true);
      this.miniLayer = null;
      this.miniPet = null;
      this.jumpPet = null;
      this.floorShadow?.setVisible(true);
      this.pet?.setVisible(true);
      if (had) this.room = null;
      if (render && app.state) this.renderRoom(app.state.comodo);
      if (render) app.actions?.();
      app.refreshControls?.();
      this._miniFocus?.focus?.({ preventScroll: true });
    },
    update(time, delta = 16) {
      this.petFSM?.update(time);
      this.syncCostume?.();
      const m = this.mini;
      if (!m || m.ending) return;
      const t = performance.now() - m.started,
        left = Math.max(0, Math.ceil((m.duration - t) / 1000));
      if (left !== this._lastMiniSecond) {
        this._lastMiniSecond = left;
        this.miniClock.setText(
          "Tempo: " +
            left +
            "s · " +
            ({
              easy: "Tranquilo",
              facil: "Tranquilo",
              normal: "Normal",
              hard: "Desafio",
              dificil: "Desafio",
            }[m.desafio.dificuldade] || "Normal"),
        );
      }
      if (m.tipo === "memoria")
        this.miniInfo.setText(
          "Pares: " +
            m.matched.size / 2 +
            " / " +
            m.cards.length / 2 +
            " · Tentativas: " +
            m.stats.moves,
        );
      if (m.tipo === "coracoes" || m.tipo === "passeio") {
        if (m.tipo === "coracoes") {
          if (m.keys.left) m.targetX -= Math.min(40, delta) * 0.32;
          if (m.keys.right) m.targetX += Math.min(40, delta) * 0.32;
          m.targetX = P.Math.Clamp(m.targetX, 50, 430);
          this.miniPet.x = P.Math.Linear(
            this.miniPet.x,
            m.targetX,
            Math.min(1, delta / 55),
          );
        }
        for (const target of m.desafio.alvos || []) {
          if (t >= target.inicio && !m.spawned.has(target.id)) {
            m.spawned.add(target.id);
            const x = 40 + target.x * 400,
              obj = child(
                this,
                token(this, "coracao", x, m.tipo === "passeio" ? 400 : 158, 48),
              );
            const entry = { ...target, x, obj };
            m.targets.push(entry);
            if (m.tipo === "passeio") {
              obj.setInteractive({ useHandCursor: true });
              this.bindTap(obj, () => this.collect(entry));
            }
          }
        }
        for (const target of m.targets) {
          if (!target.obj.active) continue;
          const elapsed = t - target.inicio;
          if (elapsed > target.duracao) {
            target.obj.destroy();
            continue;
          }
          if (m.tipo === "coracoes") {
            target.obj.y = 158 + (elapsed / target.duracao) * 425;
            if (
              Math.abs(target.obj.x - this.miniPet.x) < 45 &&
              Math.abs(target.obj.y - 515) < 43
            )
              this.collect(target);
          }
        }
        this.miniInfo.setText(
          "Corações: " + m.caught.size + " / " + (m.desafio.alvos?.length || 0),
        );
      }
      if (m.tipo === "estrelas") {
        const dt = t - this._miniLastJump;
        let height = 0;
        if (dt >= 0 && dt <= 700) {
          height =
            dt < 80
              ? (dt / 80) * 70
              : dt <= 600
                ? 70 + 75 * Math.sin(((dt - 80) / 520) * Math.PI)
                : (70 * (700 - dt)) / 100;
        }
        this.jumpPet.y = 535 - height;
        this.jumping = dt >= 0 && dt < 700;
        for (const [i, hit] of (m.desafio.tempos || []).entries()) {
          if (hit - t < 2200 && !m.spawned.has(i)) {
            m.spawned.add(i);
            const obstacle = child(
              this,
              token(this, i % 2 ? "bola" : "ursinho", 540, 510, 52),
            );
            m.targets.push({ id: i, hit, obj: obstacle });
          }
          const target = m.targets.find((x) => x.id === i);
          if (!target?.obj.active) continue;
          target.obj.x = 105 + (hit - t) * 0.23;
          if (t >= hit && !m.judged.has(i)) {
            m.judged.add(i);
            if (isSafeJump(m.proof, hit)) {
              m.caught.add(i);
              m.stats.score++;
              this.burst(105, 430, "☆");
              sound(this, "coleta");
            } else {
              m.stats.lives--;
              if (!reduced()) this.cameras.main.shake(100, 0.005);
              this.burst(105, 470, "!");
            }
            target.obj.destroy();
            if (m.stats.lives <= 0) {
              this.finishMini();
              return;
            }
          }
        }
        this.miniInfo.setText(
          "Pontos: " +
            m.stats.score +
            " · Vidas: " +
            Math.max(0, m.stats.lives) +
            " / 3",
        );
      }
      if (t >= m.duration + 100) this.finishMini();
    },
  });
  return SceneClass;
}
