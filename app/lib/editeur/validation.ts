import type { LigneEdition } from "./types";

export function validerBrouillon(params: {
  titre: string;
  artiste: string;
  theme: string;
  lignes: LigneEdition[];
  dureeAudio: number | null;
}): string[] {
  const { titre, artiste, theme, lignes, dureeAudio } = params;
  const problemes: string[] = [];

  if (!titre.trim()) problemes.push("Le titre est vide.");
  if (!artiste.trim()) problemes.push("L'artiste est vide.");
  if (!theme.trim()) problemes.push("Le thème est vide.");

  const sansTimestamp = lignes.filter((l) => l.t === null).length;
  if (sansTimestamp > 0) {
    problemes.push(
      `${sansTimestamp} ligne(s) sans timestamp.`,
    );
  }

  const timestamps = lignes
    .map((l) => l.t)
    .filter((t): t is number => t !== null);
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] < timestamps[i - 1]) {
      problemes.push("Les timestamps ne sont pas dans l'ordre croissant.");
      break;
    }
  }

  if (dureeAudio !== null) {
    const auDela = lignes.some((l) => l.t !== null && l.t > dureeAudio);
    if (auDela) {
      problemes.push("Au moins un timestamp dépasse la durée de l'audio.");
    }
  }

  if (!lignes.some((l) => l.trou)) {
    problemes.push("Aucune ligne trou n'est marquée.");
  }

  return problemes;
}
