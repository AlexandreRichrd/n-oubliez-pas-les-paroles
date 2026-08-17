import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/editeur";
import { slugifier } from "~/lib/editeur/slug";
import type { LigneEdition } from "~/lib/editeur/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Éditeur — N'oubliez pas les paroles" }];
}

const champClass =
  "w-full rounded border border-white/15 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-sky-400";
const labelClass = "text-xs font-medium text-white/50";
const boutonClass =
  "rounded border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/15";

export default function Editeur() {
  const [id, setId] = useState("");
  const [idModifieManuel, setIdModifieManuel] = useState(false);
  const [titre, setTitre] = useState("");
  const [artiste, setArtiste] = useState("");
  const [theme, setTheme] = useState("");
  const [annee, setAnnee] = useState("");

  const [nomFichierAudio, setNomFichierAudio] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [texteParoles, setTexteParoles] = useState("");
  const [lignes, setLignes] = useState<LigneEdition[]>([]);

  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!idModifieManuel) setId(slugifier(titre));
  }, [titre, idModifieManuel]);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  function surChangementFichierAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(fichier);
    audioUrlRef.current = url;
    setAudioUrl(url);
    setNomFichierAudio(fichier.name);
  }

  function genererLignes() {
    const aDesTimestamps = lignes.some((l) => l.t !== null);
    if (aDesTimestamps) {
      const confirmer = window.confirm(
        "Remplacer la liste de lignes actuelle ? Les timestamps déjà posés seront perdus.",
      );
      if (!confirmer) return;
    }
    const nouvellesLignes = texteParoles
      .split("\n")
      .map((texte) => texte.trim())
      .filter((texte) => texte.length > 0)
      .map(
        (texte): LigneEdition => ({
          cle: crypto.randomUUID(),
          texte,
          t: null,
          trou: false,
        }),
      );
    setLignes(nouvellesLignes);
  }

  return (
    <div className="grid h-dvh w-full grid-cols-[340px_1fr_320px] gap-px bg-white/10 text-white">
      <aside className="flex flex-col gap-4 overflow-y-auto bg-[#050914] p-4">
        <h1 className="text-sm font-semibold tracking-wide text-white/70 uppercase">
          Métadonnées
        </h1>

        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Titre</span>
            <input
              className={champClass}
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>Id (slug)</span>
            <input
              className={champClass}
              value={id}
              onChange={(e) => {
                setIdModifieManuel(true);
                setId(e.target.value);
              }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>Artiste</span>
            <input
              className={champClass}
              value={artiste}
              onChange={(e) => setArtiste(e.target.value)}
            />
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className={labelClass}>Thème</span>
              <input
                className={champClass}
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              />
            </label>
            <label className="flex w-24 flex-col gap-1">
              <span className={labelClass}>Année</span>
              <input
                className={champClass}
                inputMode="numeric"
                value={annee}
                onChange={(e) => setAnnee(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
          <span className={labelClass}>Fichier audio (local uniquement)</span>
          <input
            type="file"
            accept="audio/*"
            onChange={surChangementFichierAudio}
            className="text-xs text-white/70"
          />
          {nomFichierAudio && (
            <p className="text-xs text-white/50">{nomFichierAudio}</p>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 border-t border-white/10 pt-4">
          <span className={labelClass}>Paroles (une ligne par ligne)</span>
          <textarea
            className={`${champClass} min-h-40 flex-1 resize-none font-mono`}
            value={texteParoles}
            onChange={(e) => setTexteParoles(e.target.value)}
          />
          <button type="button" className={boutonClass} onClick={genererLignes}>
            Générer la liste de lignes
          </button>
        </div>
      </aside>

      <main className="flex flex-col gap-2 overflow-y-auto bg-[#050914] p-4">
        <h1 className="text-sm font-semibold tracking-wide text-white/70 uppercase">
          Lignes
        </h1>
        {lignes.length === 0 ? (
          <p className="text-sm text-white/40">
            Collez des paroles à gauche puis générez la liste de lignes.
          </p>
        ) : (
          <p className="text-sm text-white/60">
            {lignes.length} ligne(s) prête(s) — la liste éditable arrive à
            l'étape suivante.
          </p>
        )}
      </main>

      <aside className="flex flex-col gap-4 overflow-y-auto bg-[#050914] p-4">
        <h1 className="text-sm font-semibold tracking-wide text-white/70 uppercase">
          Lecture &amp; export
        </h1>
        {audioUrl ? (
          <audio controls src={audioUrl} className="w-full" />
        ) : (
          <p className="text-sm text-white/40">
            Sélectionnez un fichier audio à gauche.
          </p>
        )}
      </aside>
    </div>
  );
}
