export function formaterTemps(t: number): string {
  const total = Math.max(0, t);
  const minutes = Math.floor(total / 60);
  const secondes = total % 60;
  return `${minutes}:${secondes.toFixed(1).padStart(4, "0")}`;
}

export function arrondirTemps(t: number): number {
  return Math.round(t * 10) / 10;
}

/**
 * Timestamp corrigé du décalage global. Les lignes stockent toujours le temps
 * brut tapé ; le décalage est appliqué à chaque lecture, jamais aux données.
 */
export function tempsCorrige(
  ligne: { t: number | null },
  decalageMs: number,
): number | null {
  if (ligne.t === null) return null;
  return Math.max(0, arrondirTemps(ligne.t + decalageMs / 1000));
}
