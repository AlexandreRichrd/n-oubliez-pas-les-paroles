export type Line = {
  t: number;
  texte: string;
  trou?: boolean;
};

export type Chanson = {
  id: string;
  titre: string;
  artiste: string;
  annee?: number;
  theme: string;
  audio: string;
  lignes: Line[];
};

export type ChansonResume = Pick<
  Chanson,
  "id" | "titre" | "artiste" | "annee" | "theme"
>;

export type Theme = {
  id: string;
  nom: string;
};

export type IndexChansons = {
  themes: Theme[];
  chansons: ChansonResume[];
};
