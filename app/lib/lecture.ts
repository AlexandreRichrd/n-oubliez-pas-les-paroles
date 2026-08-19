/**
 * Logique de synchronisation partagée entre l'aperçu de /editeur et /jeu.
 * Les deux écrans doivent rester d'accord : si l'aperçu diverge du jeu, il
 * cesse de prédire ce que verront les joueurs.
 *
 * Les fonctions prennent un accesseur `tDe` plutôt que de lire `.t` : /jeu lit
 * les timestamps bruts, tandis que /editeur y applique son décalage de travail.
 */

/** Index de la dernière ligne dont le timestamp est atteint, -1 si aucune. */
export function indexLigneCourante<T>(
  lignes: readonly T[],
  tempsActuel: number,
  tDe: (ligne: T) => number | null,
): number {
  let index = -1;
  for (let i = 0; i < lignes.length; i++) {
    const t = tDe(lignes[i]);
    if (t !== null && t <= tempsActuel) index = i;
  }
  return index;
}

/** Lignes déjà atteintes, dans l'ordre de la liste. */
export function lignesJouees<T>(
  lignes: readonly T[],
  tempsActuel: number,
  tDe: (ligne: T) => number | null,
): T[] {
  return lignes.filter((ligne) => {
    const t = tDe(ligne);
    return t !== null && t <= tempsActuel;
  });
}

/** Remplace chaque mot par des underscores de même longueur. */
export function blanchirTexte(texte: string): string {
  return texte
    .split(/\s+/)
    .filter((mot) => mot.length > 0)
    .map((mot) => "_".repeat(mot.length))
    .join(" ");
}
