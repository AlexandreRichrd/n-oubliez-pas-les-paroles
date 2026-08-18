import type { BrouillonEditeur } from "./types";

const CLE_STOCKAGE = "noublip:brouillon-editeur";

export function chargerBrouillon(): BrouillonEditeur | null {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return null;
    const brouillon = JSON.parse(brut) as BrouillonEditeur;
    // Les brouillons d'avant les passages instrumentaux n'ont pas ces champs.
    return {
      ...brouillon,
      lignes: (brouillon.lignes ?? []).map((l) => ({
        ...l,
        instrumental: !!l.instrumental,
        label: l.label ?? "",
      })),
    };
  } catch {
    return null;
  }
}

export function sauvegarderBrouillon(brouillon: BrouillonEditeur): void {
  try {
    window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(brouillon));
  } catch {
    // stockage indisponible (navigation privée, quota) — on abandonne silencieusement
  }
}

export function effacerBrouillon(): void {
  window.localStorage.removeItem(CLE_STOCKAGE);
}
