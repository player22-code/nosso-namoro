export const NEEDS = [
  ["fome", "Fome", "🍎"],
  ["higiene", "Higiene", "💧"],
  ["energia", "Energia", "🌙"],
  ["diversao", "Diversão", "🎮"],
  ["carinho", "Carinho", "💗"],
];
export function normalizeNeeds(s) {
  const n = s.necessidades || {};
  const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  return {
    fome: clamp(100 - n.fome),
    higiene: clamp(n.higiene),
    energia: clamp(100 - n.sono),
    diversao: clamp(n.diversao),
    carinho: clamp(n.carinho),
  };
}
