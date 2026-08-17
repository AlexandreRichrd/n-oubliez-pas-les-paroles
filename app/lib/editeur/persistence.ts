import type { BrouillonEditeur } from "./types";

const CLE_STOCKAGE = "noublip:brouillon-editeur";

export function chargerBrouillon(): BrouillonEditeur | null {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    return brut ? (JSON.parse(brut) as BrouillonEditeur) : null;
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
