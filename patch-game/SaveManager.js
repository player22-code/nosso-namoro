/** Nenhum saldo ou prêmio é calculado aqui. UUIDs tornam o reenvio de comandos seguro. */
export class SaveManager {
  constructor(bridge) {
    this.bridge = bridge;
    this.pending = new Map();
  }
  clear() {
    this.pending.clear();
  }
  async command(state, context, action, item) {
    if (!state.producao)
      return this.bridge.rpc("patch_acao", {
        p_story: context.story,
        p_acao: action,
        p_item: item || null,
      });
    const key = [context.user, context.story, action, item || ""].join(":"),
      replay = this.pending.has(key),
      id = this.pending.get(key) || crypto.randomUUID();
    this.pending.set(key, id);
    try {
      let result = await this.bridge.rpc("patch_executar", {
        p_story: context.story,
        p_acao: action,
        p_item: item || null,
        p_op_id: id,
      });
      if (result.repetido && result.estado_atual) {
        result = { ...result.estado_atual, recompensa_acao: 0 };
      } else if (replay) {
        const fresh = await this.bridge.rpc("patch_ler", {
          p_story: context.story,
        });
        result = { ...fresh, recompensa_acao: 0 };
      }
      this.pending.delete(key);
      return result;
    } catch (error) {
      if (
        error.code &&
        error.code !== "NETWORK_ERROR" &&
        !String(error.code).startsWith("PGRST")
      )
        this.pending.delete(key);
      throw error;
    }
  }
}
