export type LigneEdition = {
  cle: string;
  texte: string;
  t: number | null;
  trou: boolean;
  instrumental: boolean;
  label: string;
};

export type BrouillonEditeur = {
  id: string;
  idModifieManuel: boolean;
  titre: string;
  artiste: string;
  theme: string;
  annee: string;
  texteParoles: string;
  lignes: LigneEdition[];
  decalageMs: number;
  vitesseLecture: number;
};
