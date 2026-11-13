import { AssetManager } from "../AssetManager.js";
import { AudioManager } from "../AudioManager.js";
import { PetStateMachine } from "../PetStateMachine.js";
import { normalizeNeeds } from "../systems/NeedsSystem.js";
import { installMiniGames } from "../minigames.js";
export function makeScene(P, app, { rooms, age, reduced, $ }) {
  class PatchScene extends P.Scene {
    constructor() {
      super("PatchRoom");
      this.room = null;
      this.age = null;
      this.mini = null;
      this.reactionTimer = null;
      this.objects = [];
      this.houseKey = null;
      this.houseObjects = [];
      this.roomTweens = [];
      this.bath = {
        soap: 0,
        rinse: false,
        done: false,
        phase: "sabao",
        animating: false,
      };
      this.fridgeOpen = true;
      this.downAt = 0;
      this.walkTween = null;
    }
    preload() {
      this.assets = new AssetManager(this);
      this.assets.preload();
      for (const room of Object.keys(rooms))
        this.load.image("room-" + room, "patch/assets/" + room + ".webp");
      this.load.audio("patch-click", "01_clique_botao.wav");
      this.load.audio("patch-win", "06_vitoria_pequena.wav");
      this.load.audio("patch-coin", "14_moeda_caindo.wav");
      this.assetFailures = [];
      this.load.on("progress", (v) => {
        $("patch-loading").textContent =
          "Preparando seu cantinho… " + Math.round(v * 100) + "%";
      });
      this.load.on("loaderror", (file) => {
        this.assetFailures.push(file.key);
      });
    }
    create() {
      if (this.assetFailures.length) {
        $("patch-loading").hidden = false;
        $("patch-loading").textContent = "Alguns recursos não carregaram.";
        let retry = $("patch-asset-retry");
        if (!retry) {
          retry = document.createElement("button");
          retry.id = "patch-asset-retry";
          retry.type = "button";
          retry.textContent = "Tentar carregar o cenário novamente";
          retry.onclick = () => app.retryScene();
          $("patch-loading").append(retry);
        }
        app.message(
          "Falha ao carregar o cenário. Seu progresso salvo foi preservado.",
          true,
        );
        return;
      }
      app.scene = this;
      this.back = this.add
        .image(240, 320, "room-sala")
        .setDisplaySize(480, 640);
      this.floorShadow = this.add
        .ellipse(240, 458, 110, 18, 0x8f5474, 0.18)
        .setDepth(4);
      this.pet = this.add.container(240, 450).setDepth(10);
      this.body = this.add
        .sprite(0, 0, "patch-character", 0)
        .setOrigin(0.5, 1)
        .setDisplaySize(240, 240);
      this.clothes = this.add.graphics().setScale(240 / 190);
      this.pet.add([this.body, this.clothes]);
      app.productionUI.assets = this.assets;
      this.audio = new AudioManager(this, {
        isEnabled: () => app.getSound(),
        getVolume: () => app.getVolume(),
      });
      this.petFSM = new PetStateMachine(this, this.body, { reduced });
      this.age = age(app.state?.nivel || 1);
      this.body.setInteractive();
      this.bindTap(this.body, () => {
        if (!this.mini && !app.careController?.session) app.care("carinho");
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
        if (app.careController?.session) return;
        obj._dragAllowed =
          (!pointer.wasTouch || app.dragMode) &&
          (!pointer.event?.target || pointer.event.target === this.game.canvas);
        if (!obj._dragAllowed) return;
        obj._didDrag = true;
        obj.setDepth(40);
        obj._home = { x: obj.x, y: obj.y };
        obj._lastStroke = 0;
      });
      this.input.on("drag", (pointer, obj, x, y) => {
        if (app.busy || this.mini || !obj._dragAllowed) return;
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
        if (app.busy || this.mini || !obj._dragAllowed) return;
        if (
          obj._food &&
          P.Math.Distance.Between(obj.x, obj.y, this.pet.x, this.pet.y - 90) <
            120
        )
          app.care("alimentar", obj._food);
        else if (obj._tool === "toalha" && Math.abs(obj.x - this.pet.x) < 110)
          this.bathStep("toalha");
        else if (obj._tool === "regador" && obj.y > 350) this.waterPlant();
        else if (obj._toy) this.playToy(obj);
        else if (obj._ball) this.playBall();
        if (pointer.wasTouch) app.setDragMode(false);
        if (obj.active && obj._home)
          this.tweens.add({
            targets: obj,
            x: obj._home.x,
            y: obj._home.y,
            duration: 250,
            ease: "Sine.easeOut",
          });
      });
      this.input.on("pointerdown", (p) => {
        if (p.event?.target && p.event.target !== this.game.canvas) return;
        this.floorTap = { x: p.x, y: p.y, t: this.time.now };
      });
      this.input.on("pointerup", (pointer) => {
        const tap = this.floorTap;
        this.floorTap = null;
        if (
          !tap ||
          P.Math.Distance.Between(tap.x, tap.y, pointer.x, pointer.y) > 12 ||
          this.time.now - tap.t > 700 ||
          app.busy
        )
          return;
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
      if (app.state) this.applyState(app.state);
      $("patch-loading").hidden = true;
      app.message("Toque, arraste e cuide do seu Patch ♡");
    }
    ensureAge(a) {
      this.age = a;
    }
    applyState(s) {
      if (!this.body) return;
      this.ensureAge(age(s.nivel));
      if (this.room !== s.comodo && !this.mini) this.renderRoom(s.comodo);
      this.drawClothes(s.roupa);
      this.renderHouse(s);
      this.night.setVisible(s.dormindo);
      if (!this.reactionTimer) this.rest();
      if (!this.mini && !s.producao) this.renderDecor(s.decoracao);
      if (this.room === "cozinha" && !this.mini) this.syncFoods(s);
    }
    rest() {
      if (app.state && this.body.active)
        this.petFSM?.rest(app.state.necessidades, app.state.dormindo);
    }
    celebrateLevel(level) {
      this.petFSM?.play("comemorando", { duration: 2400 });
      this.audio?.play("nivel_up");
      this.burst(this.pet.x, 220, "★", 0xd6a340);
      app.message(
        "Novo nível: " + level + "! Recompensa salva no seu progresso.",
      );
    }
    react(action, item) {
      if (!this.body?.active) return;
      this.reactionTimer?.remove();
      this.reactionTimer = null;
      const name = {
        alimentar: "comendo",
        carinho: "carinho",
        brincar: "brincando",
        dancar: "dancando",
        banho: "feliz",
        regar: "feliz",
        descansar: "feliz",
        dormir: "dormindo",
        acordar: "acordando",
      }[action];
      if (name)
        this.petFSM?.play(name, {
          duration: action === "dancar" ? 2600 : 1700,
        });
      this.audio?.play(
        {
          alimentar: item === "leite" ? "beber" : "comer",
          carinho: "carinho",
          brincar: "brincar",
          dancar: "risada",
          dormir: "dormir",
          acordar: "acordar",
          banho: "secar",
          regar: "banho_agua",
        }[action] || "toque_botao",
      );
      if (action === "dormir" || action === "acordar") {
        this.rest();
        return;
      }
      if (action === "alimentar") {
        this.foodVisual?.destroy();
        this.lastFood = item;
        this.lastFoodAnimation = "idle";
        if (!reduced.matches)
          this.roomTweens.push(
            this.tweens.add({
              targets: this.pet,
              y: this.pet.y - 5,
              duration: 150,
              yoyo: true,
              repeat: 5,
              ease: "Sine.easeInOut",
            }),
          );
        const food = this.add
          .text(
            this.pet.x + 65,
            this.pet.y - 65,
            {
              maca: "🍎",
              leite: "🥛",
              banana: "🍌",
              morango: "🍓",
              bolinho: "🧁",
            }[item] || "🥕",
            { fontSize: "30px" },
          )
          .setOrigin(0.5)
          .setDepth(30);
        this.foodVisual = food;
        food.setText(
          app.state.catalogo_alimentos?.find((f) => f.id === item)?.icone ||
            "🍽",
        );
        this.tweens.add({
          targets: food,
          x: this.pet.x,
          y: this.pet.y - 120,
          scale: 0,
          alpha: 0,
          duration: 1100,
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
      if (this.audio) {
        this.audio.play(
          {
            "patch-click": "toque_botao",
            "patch-win": "minijogo_vitoria",
            "patch-coin": "moeda_coletar",
          }[key] || key,
        );
        return;
      }
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
      if (action) this.bindTap(obj, action);
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
    bindTap(obj, fn) {
      obj.on("pointerdown", (p) => {
        if (p.event?.target && p.event.target !== this.game.canvas) {
          obj._tap = null;
          return;
        }
        obj._tap = { x: p.x, y: p.y, t: this.time.now };
        obj._didDrag = false;
      });
      obj.on("pointerup", (p, x, y, event) => {
        if (app.careController?.session) return;
        const start = obj._tap;
        obj._tap = null;
        if (
          !start ||
          obj._didDrag ||
          P.Math.Distance.Between(start.x, start.y, p.x, p.y) > 12 ||
          this.time.now - start.t > 700 ||
          app.busy
        )
          return;
        event?.stopPropagation();
        fn(p);
      });
      return obj;
    }
    draggable(obj) {
      this.input.setDraggable(obj);
      return obj;
    }
    clearRoom() {
      this.bathVersion = (this.bathVersion || 0) + 1;
      this.bathTimer?.remove();
      this.bathTimer = null;
      this.foam?.destroy();
      this.foam = null;
      this.foodVisual?.destroy();
      this.walkTween?.stop();
      this.walkResolve?.();
      this.walkResolve = null;
      this.reactionTimer?.remove();
      this.reactionTimer = null;
      this.roomTweens.forEach((t) => t.stop());
      this.roomTweens = [];
      for (const obj of this.objects) if (obj.active) obj.destroy();
      this.objects = [];
      this.houseKey = null;
      this.houseObjects?.forEach((o) => o.destroy());
      this.houseObjects = [];
      this.extraDecor?.destroy();
      this.extraDecor = null;
      this.pet.setPosition(240, 450).setAngle(0).setVisible(true);
      this.floorShadow.setPosition(240, 458);
      this.body.setVisible(true);
      this.bath = {
        soap: 0,
        rinse: false,
        done: false,
        phase: "sabao",
        animating: false,
      };
    }
    renderRoom(room) {
      this.audio?.play("trocar_comodo");
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
        if (room === "sala") {
          const bear = this.track(
            this.add
              .image(95, 510, "obj-ursinho")
              .setDisplaySize(70, 70)
              .setDepth(20)
              .setInteractive({ useHandCursor: true }),
          );
          bear._toy = true;
          this.draggable(bear);
          this.bindTap(bear, () => {
            if (app.state?.brinquedo || !app.state?.producao)
              this.playToy(bear);
            else
              app.message(
                "O ursinho está na loja. Equipe um brinquedo para brincar com ele.",
              );
          });
        }

        if (room === "sala")
          this.icon("♪", 415, 165, 30, () => app.care("dancar"));
      }
      if (room === "cozinha") {
        this.fridgeOpen = true;
        this.icon("▥", 414, 240, 64, () => {
          this.fridgeOpen = !this.fridgeOpen;
          this.foods.forEach((o) => {
            o.setVisible(this.fridgeOpen);
            o._qty?.setVisible(this.fridgeOpen);
          });
          app.message(
            this.fridgeOpen
              ? "Toque em um alimento ou ative Mover objetos para arrastar."
              : "Geladeira fechada. Toque para abrir.",
          );
        });
        this.label("Geladeira", 408, 300);
        this.foods = [];
        for (const [i, f] of (app.state.catalogo_alimentos || []).entries()) {
          const x = 130 + (i % 3) * 110,
            y = 540 + Math.floor(i / 3) * 65,
            food = this.draggable(
              this.icon(f.icone, x, y, 38, () => app.care("alimentar", f.id)),
            );
          food._food = f.id;
          food._qty = this.label("", x, y + 25);
          this.foods.push(food);
        }
        this.syncFoods(app.state);
        this.label("Toque para alimentar · Estoque da cozinha", 240, 485);
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
          this.icon("🧺", 400, 548, 45, () => this.bathStep("toalha")),
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
        this.bindTap(hit, () =>
          app.care(app.state.dormindo ? "acordar" : "dormir"),
        );
        this.track(hit);
        this.pet.setPosition(250, 456);
        this.icon("💡", 413, 170, 43, () =>
          app.care(app.state.dormindo ? "acordar" : "dormir"),
        );
        this.label("Toque na cama ou na luz", 240, 566);
      }
      if (room === "jardim" || room === "passeio") {
        for (let i = 0; i < 2; i++) {
          const butterfly = this.track(
            this.add
              .image(95 + i * 280, 170 + i * 50, "obj-borboleta")
              .setDisplaySize(30, 30)
              .setDepth(5),
          );
          if (!reduced.matches)
            this.roomTweens.push(
              this.tweens.add({
                targets: butterfly,
                x: butterfly.x + 35,
                y: butterfly.y - 22,
                duration: 1900 + i * 400,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut",
              }),
            );
        }
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
      if (app.state) {
        if (app.state.producao) this.renderHouse(app.state);
        else this.renderDecor(app.state.decoracao);
      }
    }
    syncFoods(s) {
      for (const obj of this.foods || []) {
        if (!obj.active) continue;
        const qty = Number(s.alimentos?.[obj._food] || 0);
        obj.setAlpha(qty ? 1 : 0.35);
        if (obj.input) obj.input.enabled = qty > 0;
        obj._qty?.setText("× " + qty);
      }
    }
    coinReward(amount) {
      this.sfx("patch-coin");
      this.burst(this.pet.x, this.pet.y - 160, "●", 0xd6a340);
      const label = this.add
        .text(this.pet.x, this.pet.y - 170, "+" + amount + " moedas", {
          fontFamily: "sans-serif",
          fontSize: "23px",
          fontStyle: "bold",
          color: "#956511",
          stroke: "#fff2cf",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(55);
      this.tweens.add({
        targets: label,
        y: label.y - 60,
        alpha: 0,
        duration: 1400,
        onComplete: () => label.destroy(),
      });
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
    renderHouse(s) {
      if (!s.producao) return;
      const selected = s.casa?.[s.comodo] || {},
        key = JSON.stringify([s.comodo, selected, s.brinquedo, s.acessorio]);
      if (key === this.houseKey) return;
      this.houseKey = key;
      this.houseObjects?.forEach((o) => o.destroy());
      this.houseObjects = [];
      const slots = {
        sofa: [240, 340, 420, 180, 4],
        cama: [240, 430, 310, 155, 5],
        tapete: [240, 490, 340, 100, 3],
        cortina: [240, 140, 370, 220, 2],
        quadro: [74, 200, 75, 75, 4],
        luminaria: [420, 330, 80, 145, 4],
        luz: [420, 330, 80, 145, 4],
        planta: [410, 425, 75, 100, 4],
        parede: [240, 150, 400, 240, 1],
      };
      for (const [slot, id] of Object.entries(selected)) {
        const item = s.catalogo.find((i) => i.id === id),
          asset = item?.asset || item?.imagem || slot,
          texture = this.assets.texture(item?.id) || this.assets.texture(asset),
          v = slots[slot] || [85, 440, 90, 90, 6];
        if (texture && this.textures.exists(texture)) {
          const o = this.add
            .image(v[0], v[1], texture)
            .setDisplaySize(v[2], v[3])
            .setDepth(v[4]);
          this.houseObjects.push(o);
        }
      }
      if (s.acessorio) {
        const item = s.catalogo.find((i) => i.id === s.acessorio),
          texture =
            this.assets.texture(s.acessorio) ||
            this.assets.texture(item?.asset);
        if (texture) {
          const key = s.acessorio,
            pose = key.includes("oculos")
              ? [0, -130, 115, 48]
              : key.includes("fone")
                ? [0, -145, 170, 140]
                : key.includes("coroa")
                  ? [0, -210, 100, 70]
                  : [55, -200, 65, 65];
          const accessory = this.add
            .image(pose[0], pose[1], texture)
            .setDisplaySize(pose[2], pose[3]);
          accessory._outfitPose = [pose[0], pose[1]];
          accessory._outfitScale = [accessory.scaleX, accessory.scaleY];
          this.pet.add(accessory);
          this.houseObjects.push(accessory);
        }
      }
    }
    syncCostume() {
      if (!this.body?.active || !this.clothes) return;
      const angle = this.body.rotation,
        sx = this.body.scaleX / (this.petFSM?.baseScaleX || 1),
        sy = this.body.scaleY / (this.petFSM?.baseScaleY || 1);
      this.clothes
        .setRotation(angle)
        .setScale((240 / 190) * sx, (240 / 190) * sy);
      for (const o of this.houseObjects || []) {
        if (!o.active || !o._outfitPose) continue;
        const [x, y] = o._outfitPose;
        o.setPosition(
          x * sx * Math.cos(angle) - y * sy * Math.sin(angle),
          x * sx * Math.sin(angle) + y * sy * Math.cos(angle),
        )
          .setRotation(angle)
          .setScale(o._outfitScale[0] * sx, o._outfitScale[1] * sy);
      }
    }
    drawClothes(id) {
      const g = this.clothes;
      g.clear();
      const original = !id;
      if (!id)
        id = {
          bebe: "pijama_lilas",
          filhote: "camiseta_rosa",
          juvenil: "camiseta_rosa",
          jovem: "pijama_lilas",
          adulto: "camiseta_rosa",
        }[this.age];
      id = this.assets.texture(id)?.replace("obj-", "") || id;
      if (id === "vestido") {
        g.fillStyle(0xc8a2e8);
        g.fillTriangle(-34, -30, 34, -30, 0, -82);
        g.lineStyle(2, 0xffeffb);
        g.lineBetween(-34, -30, 34, -30);
        g.fillStyle(0xf48fb1);
        g.fillCircle(0, -61, 7);
        return;
      }
      if (id === "camiseta_rosa" || id === "pijama_lilas") {
        g.fillStyle(id === "camiseta_rosa" ? 0xf5a2cb : 0xc5a6e5, 1);
        g.fillRoundedRect(-24, -63, 48, 25, 8);
        g.fillStyle(0xfff2f8, 1);
        g.fillCircle(0, -50, 6);
        if (original && this.age === "bebe") {
          g.fillStyle(0xfff7f5);
          g.fillRoundedRect(-13, -67, 26, 21, 8);
        }
        if (original && this.age === "filhote") {
          g.lineStyle(4, 0xd77ba9);
          g.lineBetween(-16, -65, -16, -35);
          g.lineBetween(16, -65, 16, -35);
        }
        if (original && this.age === "adulto") {
          g.lineStyle(2, 0xffeff8);
          g.lineBetween(0, -61, 0, -38);
          g.fillStyle(0xffefd1);
          g.fillCircle(5, -53, 2);
          g.fillCircle(5, -43, 2);
        }
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
    async playToy(obj) {
      if (this.mini || app.busy) return;
      const state = await app.care("brincar");
      if (state && obj?.active) {
        this.roomTweens.push(
          this.tweens.add({
            targets: obj,
            x: this.pet.x + 55,
            y: this.pet.y - 65,
            angle: 12,
            duration: 450,
            yoyo: true,
            ease: "Sine.easeInOut",
          }),
        );
        this.petFSM?.play("brincando", { duration: 1800 });
      }
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
      if (app.state?.producao) {
        if (!app.careController.session)
          await app.careController.start("banho");
        return;
      }
      if (
        this.room !== "banheiro" ||
        app.busy ||
        app.state?.dormindo ||
        this.bath.animating
      )
        return;
      if ((app.waits.banho || 0) > performance.now()) {
        app.message("O Patch já tomou banho. Espere o contador para repetir.");
        return;
      }
      if (this.bath.phase === "done" && tool === "sabao")
        this.bath = {
          soap: 0,
          rinse: false,
          done: false,
          phase: "sabao",
          animating: false,
        };
      const b = this.bath,
        version = this.bathVersion;
      const finish = (delay, fn) => {
        b.animating = true;
        app.refreshControls();
        this.bathTimer = this.time.delayedCall(
          reduced.matches ? 80 : delay,
          () => {
            this.bathTimer = null;
            if (
              this.room !== "banheiro" ||
              this.bathVersion !== version ||
              this.bath !== b
            )
              return;
            b.animating = false;
            fn();
            app.refreshControls();
          },
        );
      };
      if (tool === "sabao" || tool === "esfregar") {
        if (b.phase !== "sabao") return;
        b.soap += tool === "sabao" ? 5 : 1;
        if (!this.foam) {
          this.foam = this.add
            .container(this.pet.x, this.pet.y - 65)
            .setDepth(15);
          for (let i = 0; i < 10; i++)
            this.foam.add(
              this.add.circle(
                ((i % 5) - 2) * 24,
                Math.floor(i / 5) * -24,
                18,
                0xfff8ff,
                0.85,
              ),
            );
        }
        this.burst(this.pet.x, this.pet.y - 100, "○", 0xffffff);
        this.bathLabel.setText("Preparando espuma…");
        if (b.soap >= 5)
          finish(700, () => {
            b.phase = "chuveiro";
            this.bathLabel.setText("Espuma pronta! Agora enxágue.");
            app.message("Etapa 1 de 3 concluída: use o chuveiro.");
          });
        return;
      }
      if (tool === "chuveiro") {
        if (b.phase !== "chuveiro") {
          app.message("Use o sabonete primeiro.");
          return;
        }
        this.bathLabel.setText("Enxaguando…");
        for (let i = 0; i < 22; i++) {
          const drop = this.track(
            this.add
              .ellipse(188 + (i % 7) * 17, 215, 5, 14, 0xa6d8f3, 0.9)
              .setDepth(30),
          );
          this.roomTweens.push(
            this.tweens.add({
              targets: drop,
              y: 430,
              alpha: 0,
              delay: i * 28,
              duration: 600,
              onComplete: () => drop.destroy(),
            }),
          );
        }
        if (this.foam)
          this.roomTweens.push(
            this.tweens.add({ targets: this.foam, alpha: 0, duration: 850 }),
          );
        finish(1300, () => {
          this.foam?.destroy();
          this.foam = null;
          b.rinse = true;
          b.phase = "toalha";
          this.bathLabel.setText("Enxaguado! Agora seque com a toalha.");
          app.message("Etapa 2 de 3 concluída: use a toalha.");
        });
        return;
      }
      if (tool === "toalha") {
        if (b.phase !== "toalha") {
          app.message("Ensaboe e enxágue antes de secar.");
          return;
        }
        this.bathLabel.setText("Secando…");
        const towel = this.track(
          this.add
            .rectangle(this.pet.x - 65, this.pet.y - 80, 70, 45, 0xd3b2ed)
            .setStrokeStyle(3, 0xfff3fb)
            .setDepth(25),
        );
        this.roomTweens.push(
          this.tweens.add({
            targets: towel,
            x: this.pet.x + 65,
            duration: 250,
            yoyo: true,
            repeat: 1,
          }),
        );
        finish(1100, async () => {
          towel.destroy();
          b.animating = true;
          app.refreshControls();
          const result = await app.care("banho");
          if (this.room !== "banheiro" || version !== this.bathVersion) return;
          b.animating = false;
          if (result) {
            b.phase = "done";
            b.done = true;
            this.bathLabel.setText("Limpinho! Banho concluído ♡");
          } else {
            b.phase = "toalha";
            this.bathLabel.setText(
              "Não foi salvo. Toque em Secar para tentar de novo.",
            );
          }
          app.refreshControls();
        });
      }
    }
  }
  installMiniGames(PatchScene, { Phaser: P, app, reduced, $ });
  return PatchScene;
}
