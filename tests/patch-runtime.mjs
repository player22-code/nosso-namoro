import assert from "node:assert/strict";
import { SaveManager } from "../patch-game/SaveManager.js";
import { CareController } from "../patch-game/CareController.js";
let count = 0;
const ids = [],
  bridge = {
    async rpc(name, args) {
      assert.equal(name, "patch_executar");
      ids.push(args.p_op_id);
      if (ids.length === 1) {
        count++;
        throw new Error("connection dropped after commit");
      }
      return { repetido: true, estado_atual: { story_id: "s", moedas: 18 } };
    },
  };
const saver = new SaveManager(bridge),
  ctx = { story: "s", user: "a" };
await assert.rejects(
  saver.command({ producao: true }, ctx, "comprar_comida", "maca"),
);
const state = await saver.command(
  { producao: true },
  ctx,
  "comprar_comida",
  "maca",
);
assert.equal(state.moedas, 18);
assert.equal(count, 1);
assert.equal(ids[0], ids[1]);
assert.equal(saver.pending.size, 0);
let resolve,
  cancelResets = 0;
const app = {
  generation: 1,
  saves: { bridge: { rpc: () => new Promise((r) => (resolve = r)) } },
  setBusy() {},
  message() {},
  setDragMode() {},
  accept() {},
};
const care = Object.create(CareController.prototype);
Object.assign(care, {
  app,
  session: { id: "old" },
  reset() {
    cancelResets++;
  },
});
const pending = care.cancel();
app.generation = 2;
care.session = { id: "new" };
resolve({ estado: { story_id: "old" } });
assert.equal(await pending, false);
assert.equal(cancelResets, 0);
assert.equal(care.session.id, "new");
app.generation = 3;
care.session = { id: "old", tipo: "banho" };
care.sending = false;
const advance = care.advance("esfregar", []);
app.generation = 4;
care.session = { id: "next" };
care.sending = true;
resolve({});
await advance;
assert.equal(care.sending, true);
assert.equal(care.session.id, "next");
console.log(
  "PASS runtime: retry UUID after committed network failure; stale care responses cannot reset/unlock the next account.",
);
