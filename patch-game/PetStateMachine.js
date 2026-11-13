import { ANIMATION_ROWS } from "./AssetManager.js";
const aliases = {
  idle: "parado",
  sad: "triste",
  happy: "feliz",
  laugh: "rindo",
  eat: "comendo",
  sleep: "dormindo",
  wake: "acordando",
  love: "carinho",
  dance: "dancando",
  jump: "pulando",
  play: "brincando",
  celebrate: "comemorando",
  bath: "banho",
  blink: "piscando",
};
const durations = {
  piscando: 160,
  feliz: 1000,
  rindo: 1200,
  comendo: 1500,
  banho: 1300,
  acordando: 800,
  carinho: 1400,
  dancando: 2400,
  pulando: 850,
  brincando: 1700,
  comemorando: 2100,
};
/** Exclusive visual states; gameplay and rewards remain server-owned. */
export class PetStateMachine {
  constructor(scene, sprite, { reduced = false } = {}) {
    this.scene = scene;
    this.sprite = sprite;
    this.reduced = reduced;
    this.state = null;
    this.token = 0;
    this.timer = null;
    this.actionTweens = [];
    this.destroyed = false;
    this.until = 0;
    this.needs = null;
    this.sleeping = false;
    this.nextBlink = this.now() + 3000;
    this.baseAngle = sprite.angle || 0;
    this.baseScaleX = sprite.scaleX;
    this.baseScaleY = sprite.scaleY;
    this.createAnimations();
    this.shutdown = () => this.destroy();
    scene.events?.once("shutdown", this.shutdown);
    scene.events?.once("destroy", this.shutdown);
  }
  now() {
    return Number(this.scene.time?.now) || 0;
  }
  reducedMotion() {
    return typeof this.reduced === "function"
      ? !!this.reduced()
      : typeof this.reduced === "object"
        ? !!this.reduced.matches
        : !!this.reduced;
  }
  get locked() {
    return this.until > this.now();
  }
  createAnimations() {
    if (!this.scene.textures.exists("patch-character")) return;
    for (const [state, row] of Object.entries(ANIMATION_ROWS)) {
      // The supplied eating frames have a fixed orange food. Use the neutral row instead.
      const effective = state === "comendo" ? 0 : row,
        key = "patch-state-" + state;
      if (!this.scene.anims.exists(key))
        this.scene.anims.create({
          key,
          frames: this.scene.anims.generateFrameNumbers("patch-character", {
            start: effective * 12,
            end: effective * 12 + 11,
          }),
          frameRate: state === "parado" ? 9 : state === "piscando" ? 14 : 10,
          repeat: -1,
        });
    }
  }
  cancelAction() {
    this.timer?.remove();
    this.timer = null;
    for (const tween of this.actionTweens) tween.stop();
    this.actionTweens = [];
    if (this.sprite?.active) {
      this.sprite.setAngle(this.baseAngle);
      this.sprite.setScale(this.baseScaleX, this.baseScaleY);
    }
  }
  play(input, { duration, onComplete } = {}) {
    const state = aliases[input] || input;
    if (this.destroyed || !this.sprite?.active || !(state in ANIMATION_ROWS))
      return false;
    if (this.state === state && duration === undefined) return false;
    this.cancelAction();
    const token = ++this.token;
    this.state = state;
    this.createAnimations();
    const ms =
      state === "dormindo"
        ? 0
        : duration === undefined
          ? (durations[state] ?? 0)
          : Math.max(0, Number(duration) || 0);
    this.until = ms ? this.now() + ms : 0;
    if (this.reducedMotion()) {
      this.sprite.stop();
      this.sprite.setTexture(
        "patch-character",
        (state === "comendo" ? 0 : ANIMATION_ROWS[state]) * 12,
      );
    } else {
      this.sprite.play("patch-state-" + state, true);
      const wiggle = {
        rindo: 3,
        carinho: 2,
        feliz: 1.5,
        banho: 1.3,
        dancando: 7,
        brincando: 4,
        comemorando: 5,
        triste: 0.7,
        comendo: 1.5,
        acordando: 2,
      }[state];
      if (wiggle)
        this.actionTweens.push(
          this.scene.tweens.add({
            targets: this.sprite,
            angle: this.baseAngle + wiggle,
            duration: state === "dancando" ? 220 : 300,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          }),
        );
      // Static rows are supplemented; sleep continues gently without rest() restarting it.
      if (state === "dormindo")
        this.actionTweens.push(
          this.scene.tweens.add({
            targets: this.sprite,
            scaleY: this.baseScaleY * 1.025,
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          }),
        );
      if (state === "pulando" || state === "acordando")
        this.actionTweens.push(
          this.scene.tweens.add({
            targets: this.sprite,
            scaleY: this.baseScaleY * 1.045,
            scaleX: this.baseScaleX * 0.98,
            duration: state === "pulando" ? 200 : 350,
            yoyo: true,
            repeat: state === "pulando" ? 1 : 0,
            ease: "Sine.easeInOut",
          }),
        );
    }
    if (ms)
      this.timer = this.scene.time.delayedCall(ms, () => {
        if (this.destroyed || token !== this.token) return;
        this.until = 0;
        this.cancelAction();
        onComplete?.();
        if (this.destroyed || token !== this.token) return;
        if (
          !this.sleeping &&
          ["carinho", "comendo", "brincando"].includes(state)
        )
          this.play("feliz", { duration: 550 });
        else {
          this.state = null;
          this.applyRest();
        }
      });
    return true;
  }
  rest(needs = {}, sleeping = false) {
    if (this.destroyed) return;
    this.needs = needs;
    this.sleeping = !!sleeping;
    const hygiene = Number(needs.higiene ?? 100);
    if (hygiene < 25) this.sprite.setTint?.(0xdfd0d9);
    else this.sprite.clearTint?.();
    if (this.sleeping) {
      if (this.state !== "dormindo") this.play("dormindo");
      return;
    }
    if (this.state === "dormindo") {
      this.play("acordando");
      return;
    }
    if (!this.locked) this.applyRest();
  }
  applyRest() {
    if (this.destroyed) return;
    if (this.sleeping) {
      this.play("dormindo");
      return;
    }
    const n = this.needs || {},
      normalized = Number.isFinite(n.energia),
      hungry = normalized
        ? Number(n.fome ?? 100) < 25
        : Number(n.fome ?? 0) > 75,
      tired = normalized
        ? Number(n.energia ?? 100) < 25
        : Number(n.sono ?? 0) > 75;
    const low =
      hungry ||
      tired ||
      Number(n.higiene ?? 100) < 25 ||
      Number(n.diversao ?? 100) < 25 ||
      Number(n.carinho ?? 100) < 25;
    this.play(low ? "triste" : "parado");
  }
  update(time) {
    if (this.destroyed || this.reducedMotion() || this.locked || this.sleeping)
      return;
    const now = this.now();
    if (this.state === "parado" && now >= this.nextBlink) {
      this.nextBlink = now + 3000 + Math.random() * 4000;
      this.play("piscando", { duration: 160 });
    }
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    ++this.token;
    this.cancelAction();
    this.scene.events?.off("shutdown", this.shutdown);
    this.scene.events?.off("destroy", this.shutdown);
    this.sprite?.stop?.();
  }
}
