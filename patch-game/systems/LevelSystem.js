export function levelProgress(s) {
  const current = Number.isFinite(s.xp_atual)
      ? s.xp_atual
      : s.experiencia % 100,
    next = Number(s.xp_proximo) || 100;
  return { current, next, percent: Math.min(100, (current / next) * 100) };
}
export const petAge = (n) =>
  n < 5
    ? "bebe"
    : n < 10
      ? "filhote"
      : n < 20
        ? "juvenil"
        : n < 30
          ? "jovem"
          : "adulto";
