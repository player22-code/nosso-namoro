import { SOUND_NAMES } from "./AssetManager.js";
const allowed = new Set(SOUND_NAMES);
/** Scene-owned audio, uses Phaser's browser gesture unlocking. Never queues stale effects. */
export class AudioManager {
  constructor(scene, { isEnabled = () => true, getVolume = () => 0.35 } = {}) {
    this.scene = scene;
    this.isEnabled = isEnabled;
    this.getVolume = getVolume;
    this.voices = new Set();
    this.releases = new Map();
    this.lastPlayed = new Map();
    this.destroyed = false;
    this.shutdown = () => this.destroy();
    scene.events?.once("shutdown", this.shutdown);
    scene.events?.once("destroy", this.shutdown);
  }
  play(name) {
    if (this.destroyed || !allowed.has(name)) return false;
    try {
      if (!this.isEnabled()) return false;
      const manager = this.scene.sound,
        key = "patch-sound-" + name;
      if (!manager || manager.locked || !this.scene.cache.audio.exists(key))
        return false;
      const now = globalThis.performance?.now?.() ?? Date.now();
      if (now - (this.lastPlayed.get(name) ?? -Infinity) < 100) return false;
      const volume = Math.max(0, Math.min(1, Number(this.getVolume()) || 0));
      if (!volume) return false;
      while (this.voices.size >= 3) {
        const oldest = this.voices.values().next().value;
        oldest.stop();
        this.releases.get(oldest)?.();
      }
      const sound = manager.add(key);
      this.voices.add(sound);
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        this.voices.delete(sound);
        this.releases.delete(sound);
        sound.destroy();
      };
      this.releases.set(sound, release);
      sound.once("complete", release);
      sound.once("stop", release);
      try {
        if (sound.play({ volume }) === false) {
          release();
          return false;
        }
      } catch {
        release();
        return false;
      }
      this.lastPlayed.set(name, now);
      return true;
    } catch {
      return false;
    }
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events?.off("shutdown", this.shutdown);
    this.scene.events?.off("destroy", this.shutdown);
    for (const sound of [...this.voices]) {
      sound.removeAllListeners?.();
      try {
        sound.stop();
        sound.destroy();
      } catch {}
    }
    this.voices.clear();
    this.releases.clear();
    this.lastPlayed.clear();
  }
}
