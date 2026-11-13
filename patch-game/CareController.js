/** Gestos reais; o servidor decide progresso, higiene, XP e moedas. */
export class CareController {
  constructor(app, { root, $, el }) {
    Object.assign(this, { app, root, $, el });
    this.session = null;
    this.detach = null;
    this.sending = false;
    this.started = 0;
  }
  reset() {
    this.detach?.();
    this.detach = null;
    this.session = null;
    this.sending = false;
    this.points = [];
    this.hint?.remove();
    this.hint = null;
    this.brush?.destroy();
    this.brush = null;
  }
  async start(type) {
    if (!this.app.scene?.body?.active || !this.app.game) {
      this.app.message("O cenário está carregando. Aguarde um instante.");
      return;
    }
    if (this.app.busy) return;
    const gen = this.app.generation;
    this.app.setBusy(true);
    try {
      const s = await this.app.saves.bridge.rpc("patch_cuidado_iniciar", {
        p_story: this.app.story,
        p_tipo: type,
      });
      if (gen !== this.app.generation) return;
      this.reset();
      this.session = s;
      this.started = performance.now() - (Number(s.decorrido_ms) || 0);
      if (s.estado) this.app.accept(s.estado);
      this.attach();
      this.app.setDragMode(true);
      this.app.actions();
      this.message();
      this.app.scene?.audio?.play(
        type === "dentes"
          ? "escovar_dentes"
          : type === "banho"
            ? "espuma"
            : "carinho",
      );
    } catch (e) {
      this.app.message(
        e.message || "Não foi possível iniciar o cuidado.",
        true,
      );
    } finally {
      if (gen === this.app.generation) this.app.setBusy(false);
    }
  }
  async cancel() {
    if (!this.session) return true;
    const gen = this.app.generation,
      id = this.session.id;
    try {
      const result = await this.app.saves.bridge.rpc("patch_cuidado_cancelar", {
        p_cuidado: id,
      });
      if (gen !== this.app.generation || this.session?.id !== id) return false;
      this.reset();
      this.app.setDragMode(false);
      if (result?.estado) this.app.accept(result.estado);
      return true;
    } catch (e) {
      if (gen === this.app.generation)
        this.app.message(
          e.message || "Não foi possível encerrar o cuidado.",
          true,
        );
      return false;
    }
  }

  region() {
    const p = this.app.scene.pet;
    return this.session?.tipo === "dentes"
      ? { x: p.x - 45, y: p.y - 143, w: 90, h: 55 }
      : { x: p.x - 92, y: p.y - 205, w: 184, h: 195 };
  }
  point(event) {
    const r = this.app.game.canvas.getBoundingClientRect(),
      p = this.region(),
      x = ((event.clientX - r.x) * 480) / r.width,
      y = ((event.clientY - r.y) * 640) / r.height;
    return {
      x: (x - p.x) / p.w,
      y: (y - p.y) / p.h,
      t: Math.round(performance.now() - this.started),
    };
  }
  valid(p) {
    return p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  }
  attach() {
    const canvas = this.app.game.canvas,
      scene = this.app.scene;
    this.hint = this.el("div", undefined, "patch-care-hint");
    this.hint.setAttribute("role", "status");
    this.$("patch-stage").append(this.hint);
    this.brush = scene.add
      .image(
        240,
        350,
        this.session.tipo === "dentes"
          ? "obj-escova"
          : this.session.tipo === "banho"
            ? "obj-esponja"
            : "obj-coracao",
      )
      .setDisplaySize(55, 55)
      .setDepth(60)
      .setVisible(false);
    const down = (e) => {
      if (this.sending || !this.session || !this.isStroke()) return;
      const p = this.point(e);
      if (!this.valid(p)) return;
      this.points = [p];
      this.pointer = e.pointerId;
      canvas.setPointerCapture?.(e.pointerId);
      this.brush.setVisible(true);
    };
    const move = (e) => {
      if (e.pointerId !== this.pointer || !this.points) return;
      const p = this.point(e),
        last = this.points.at(-1);
      if (!this.valid(p) || p.t - last.t < 20) return;
      this.points.push(p);
      if (this.points.length > 80) this.points.splice(1, 1);
      const a = this.region();
      this.brush.setPosition(a.x + p.x * a.w, a.y + p.y * a.h);
    };
    const up = async (e) => {
      if (e.pointerId !== this.pointer) return;
      this.pointer = null;
      this.brush?.setVisible(false);
      const pts = this.points;
      this.points = null;
      if (!pts || pts.length < 5) return;
      const duration = pts.at(-1).t - pts[0].t,
        distance = pts
          .slice(1)
          .reduce(
            (d, p, i) => d + Math.hypot(p.x - pts[i].x, p.y - pts[i].y),
            0,
          );
      if (
        duration < (this.session.desafio?.duracao_minima || 650) ||
        distance < (this.session.desafio?.distancia_minima || 0.7)
      ) {
        this.app.message(
          "Deslize mais devagar e cubra uma área maior do personagem.",
        );
        return;
      }
      await this.advance(this.strokeName(), pts);
    };
    const cancel = () => {
      this.pointer = null;
      this.points = null;
      this.brush?.setVisible(false);
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", cancel);
    this.detach = () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
    };
  }
  isStroke() {
    return (
      this.session &&
      ["esfregar", "escovar", "acariciar", "sabao"].includes(this.session.etapa)
    );
  }
  strokeName() {
    return this.session.tipo === "banho"
      ? "esfregar"
      : this.session.tipo === "dentes"
        ? "escovar"
        : "acariciar";
  }
  message() {
    if (!this.session) return;
    const s = this.session,
      text =
        s.etapa === "enxaguar"
          ? "Espuma pronta! Use Enxaguar."
          : s.etapa === "secar"
            ? "Enxaguado! Use Secar."
            : s.tipo === "dentes"
              ? "Deslize a escova sobre a boca."
              : s.tipo === "banho"
                ? "Deslize a esponja sobre o Patch."
                : "Deslize a mão sobre o Patch para fazer carinho.";
    if (this.hint)
      this.hint.textContent = text + " " + Math.round(s.progresso || 0) + "%";
    this.app.message(text);
  }
  async advance(step, points = []) {
    if (!this.session || this.sending) return;
    const gen = this.app.generation,
      id = this.session.id;
    this.sending = true;
    this.app.setBusy(true);
    try {
      const result = await this.app.saves.bridge.rpc("patch_cuidado_avancar", {
        p_cuidado: id,
        p_etapa: step,
        p_gestos: points,
      });
      if (gen !== this.app.generation) return;
      const challenge = this.session.desafio;
      this.session = {
        ...this.session,
        ...result,
        desafio: result.desafio || challenge,
      };
      if (result.estado) this.app.accept(result.estado);
      this.app.scene?.burst(
        this.app.scene.pet.x,
        330,
        step === "esfregar" ? "○" : "♡",
      );
      this.app.scene?.audio?.play(
        step === "enxaguar"
          ? "banho_agua"
          : step === "secar"
            ? "secar"
            : step === "escovar"
              ? "escovar_dentes"
              : "espuma",
      );
      if (result.concluido) {
        const type = this.session.tipo;
        this.reset();
        this.app.setDragMode(false);
        this.app.scene?.petFSM?.play(type === "carinho" ? "carinho" : "feliz", {
          duration: 1500,
        });
        this.app.message("Cuidado concluído e salvo! ♡");
        if (result.recompensa_acao > 0)
          this.app.scene?.coinReward(result.recompensa_acao);
      } else this.message();
      this.app.actions();
    } catch (e) {
      if (gen === this.app.generation)
        this.app.message(
          e.message || "O gesto não foi confirmado. Tente novamente.",
          true,
        );
    } finally {
      if (
        gen === this.app.generation &&
        (!this.session || this.session.id === id)
      ) {
        this.sending = false;
        this.app.setBusy(false);
      }
    }
  }
  render(area) {
    if (!this.session) return false;
    area.replaceChildren();
    const s = this.session;
    area.dataset.room = "cuidado";
    const title = this.el(
        "p",
        s.tipo === "banho"
          ? "Banho interativo"
          : s.tipo === "dentes"
            ? "Escovação"
            : "Carinho por gestos",
        "patch-care-title",
      ),
      meter = this.el("progress");
    meter.max = 100;
    meter.value = Number(s.progresso) || 0;
    meter.setAttribute("aria-label", "Progresso do cuidado");
    area.append(title, meter);
    if (this.isStroke()) {
      const info = this.el(
        "p",
        "Passe o dedo ou o mouse sobre a área indicada no personagem. Cada movimento válido aumenta o progresso.",
      );
      area.append(info);
      const keyboard = this.el(
        "div",
        "Teclado: segure e alterne ← e →; pressione Enter para enviar.",
        "patch-care-keyboard",
      );
      keyboard.tabIndex = 0;
      keyboard.setAttribute("role", "group");
      let pts = [],
        x = 0.2;
      keyboard.addEventListener("keydown", (e) => {
        if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          x = e.key === "ArrowLeft" ? 0.2 : 0.8;
          const t = Math.round(performance.now() - this.started);
          if (!pts.length || t - pts.at(-1).t >= 20) pts.push({ x, y: 0.5, t });
        } else if (e.key === "Enter") {
          e.preventDefault();
          this.advance(this.strokeName(), pts);
          pts = [];
        }
      });
      area.append(keyboard);
    } else {
      const step = s.etapa,
        b = this.el("button", step === "enxaguar" ? "🚿 Enxaguar" : "🧺 Secar");
      b.onclick = async () => {
        b.disabled = true;
        const scene = this.app.scene;
        scene?.burst(240, 350, step === "enxaguar" ? "○" : "✧");
        await new Promise((r) =>
          setTimeout(r, step === "enxaguar" ? 650 : 850),
        );
        if (this.session?.id === s.id) await this.advance(step, []);
      };
      area.append(b);
    }
    const exit = this.el("button", "Encerrar cuidado");
    exit.onclick = async () => {
      if (await this.cancel()) this.app.actions();
    };
    area.append(exit);
    return true;
  }
}
