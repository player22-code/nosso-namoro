/** Audited resources and original transparent scene objects. Paths are relative to index.html. */
export const FRAME_SIZE = 240;
export const ANIMATION_ROWS = Object.freeze({
  parado: 0,
  piscando: 1,
  feliz: 2,
  triste: 3,
  rindo: 4,
  comendo: 5,
  banho: 6,
  dormindo: 7,
  acordando: 8,
  carinho: 9,
  dancando: 10,
  pulando: 11,
  brincando: 12,
  comemorando: 13,
});
export const SOUND_NAMES = Object.freeze([
  "toque_botao",
  "abrir_menu",
  "fechar_menu",
  "comer",
  "beber",
  "banho_agua",
  "espuma",
  "secar",
  "escovar_dentes",
  "dormir",
  "acordar",
  "brincar",
  "carinho",
  "beijo",
  "risada",
  "triste",
  "nivel_up",
  "moeda_coletar",
  "compra",
  "missao_concluida",
  "minijogo_inicio",
  "minijogo_vitoria",
  "minijogo_derrota",
  "trocar_comodo",
  "bolha",
  "estrela",
]);
export const OBJECT_NAMES = Object.freeze([
  "geladeira",
  "banheira",
  "agua",
  "presente",
  "papeledeparede",
  "cenoura",
  "maca",
  "banana",
  "morango",
  "leite",
  "bolinho",
  "hamburguer",
  "bola",
  "ursinho",
  "esponja",
  "sabonete",
  "chuveiro",
  "toalha",
  "escova",
  "espelho",
  "regador",
  "flor",
  "borboleta",
  "cama",
  "sofa",
  "tapete",
  "cortina",
  "quadro",
  "luminaria",
  "vaso",
  "camiseta_rosa",
  "pijama_lilas",
  "oculos_coracao",
  "laco_dourado",
  "vestido",
  "fones",
  "coroa",
  "moeda",
  "coracao",
  "estrela",
]);
const aliases = Object.freeze({
  vestido_lilas: "vestido",
  fone_rosa: "fones",
  coroa_rosa: "coroa",
  bola_rosa: "bola",
  ursinho_rosa: "ursinho",
  sofa_rosa: "sofa",
  cama_nuvem: "cama",
  tapete_estrelas: "tapete",
  flor_jardim: "flor",
  luminaria_coracao: "luminaria",
  papel_lavanda: "papeledeparede",
  bolo: "bolinho",
  escova_de_dentes: "escova",
  escovar_dentes: "escova",
  tapete_flor: "tapete",
  almofada_lilas: "sofa",
  vaso_rosa: "vaso",
  cortinas: "cortina",
  abajur: "luminaria",
  papel_parede: "papeledeparede",
  sabonete_rosa: "sabonete",
  esponja_rosa: "esponja",
  escova_rosa: "escova",
  fone: "fones",
  laco: "laco_dourado",
});
export const manifest = Object.freeze({
  character: Object.freeze({
    key: "patch-character",
    path: "Patch_Jogo_Completo/personagem/spritesheet_12_frames_14_estados.png",
    frameWidth: FRAME_SIZE,
    frameHeight: FRAME_SIZE,
    columns: 12,
    rows: 14,
  }),
  objects: Object.freeze(
    Object.fromEntries(
      OBJECT_NAMES.map((name) => [
        name,
        "patch-game/assets/objects/" + name + ".svg",
      ]),
    ),
  ),
  sounds: Object.freeze(
    Object.fromEntries(
      SOUND_NAMES.map((name) => [
        name,
        "Patch_Jogo_Completo/sons/" + name + ".wav",
      ]),
    ),
  ),
});
function canonical(name) {
  if (typeof name !== "string") return null;
  if (Object.values(manifest.objects).includes(name))
    return name.split("/").pop().slice(0, -4);
  if (name.startsWith("Patch_Jogo_Completo/objetos/") && name.endsWith(".svg"))
    name = name.split("/").pop().slice(0, -4);
  return aliases[name] || name;
}
export class AssetManager {
  constructor(scene) {
    this.scene = scene;
    this.manifest = manifest;
  }
  object(name) {
    return manifest.objects[canonical(name)] || null;
  }
  texture(name) {
    const key = canonical(name);
    return manifest.objects[key] ? "obj-" + key : null;
  }
  preload() {
    const s = this.scene,
      c = manifest.character;
    if (!s.textures.exists(c.key))
      s.load.spritesheet(c.key, c.path, {
        frameWidth: c.frameWidth,
        frameHeight: c.frameHeight,
        endFrame: 167,
      });
    for (const [name, path] of Object.entries(manifest.objects))
      if (!s.textures.exists("obj-" + name))
        s.load.svg("obj-" + name, path, { width: 256, height: 256 });
    for (const [name, path] of Object.entries(manifest.sounds))
      if (!s.cache.audio.exists("patch-sound-" + name))
        s.load.audio("patch-sound-" + name, path);
  }
}
