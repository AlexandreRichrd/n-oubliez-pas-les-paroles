import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/editeur";
import { slugifier } from "~/lib/editeur/slug";
import { arrondirTemps, formaterTemps } from "~/lib/editeur/temps";
import type { LigneEdition } from "~/lib/editeur/types";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Éditeur — N'oubliez pas les paroles" }];
}

const champClass =
  "w-full rounded border border-white/15 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-sky-400";
const labelClass = "text-xs font-medium text-white/50";
const boutonClass =
  "rounded border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/15";
const boutonMiniClass =
  "rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-xs text-white/80 hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-white/5";

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
  const [tempsActuel, setTempsActuel] = useState(0);
  const [indexSelectionne, setIndexSelectionne] = useState<number | null>(
    null,
  );
  const [modeTap, setModeTap] = useState(false);
  const [indexTap, setIndexTap] = useState(0);

  const audioUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!idModifieManuel) setId(slugifier(titre));
  }, [titre, idModifieManuel]);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  useEffect(() => {
    let frame: number;
    function suivre() {
      const audio = audioRef.current;
      if (audio) setTempsActuel(audio.currentTime);
      frame = requestAnimationFrame(suivre);
    }
    frame = requestAnimationFrame(suivre);
    return () => cancelAnimationFrame(frame);
  }, []);

  const ligneActuelleCle = useMemo(() => {
    let derniereCle: string | null = null;
    for (const l of lignes) {
      if (l.t !== null && l.t <= tempsActuel) derniereCle = l.cle;
    }
    return derniereCle;
  }, [lignes, tempsActuel]);

  useEffect(() => {
    if (!modeTap) return;
    function surKeyDown(e: KeyboardEvent) {
      const cible = document.activeElement;
      const dansChampTexte =
        cible instanceof HTMLInputElement ||
        cible instanceof HTMLTextAreaElement;
      if (dansChampTexte) return;

      if (e.key === " ") {
        e.preventDefault();
        assignerTapCourant();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        reculerTap();
      } else if (e.key === "Escape") {
        e.preventDefault();
        sortirModeTap();
      }
    }
    window.addEventListener("keydown", surKeyDown);
    return () => window.removeEventListener("keydown", surKeyDown);
  }, [modeTap, indexTap, lignes.length]);

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

  function seekEtLire(t: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, t);
    void audio.play();
  }

  function selectionnerLigne(index: number) {
    setIndexSelectionne(index);
    if (modeTap) setIndexTap(index);
    const t = lignes[index]?.t;
    if (t !== null && t !== undefined) seekEtLire(t - 2);
  }

  function entrerModeTap() {
    const audio = audioRef.current;
    if (!audio || lignes.length === 0) return;
    const depart = indexSelectionne ?? 0;
    audio.currentTime = lignes[depart]?.t ?? 0;
    void audio.play();
    setIndexTap(depart);
    setModeTap(true);
  }

  function sortirModeTap() {
    setModeTap(false);
    audioRef.current?.pause();
  }

  function assignerTapCourant() {
    const audio = audioRef.current;
    if (!audio) return;
    const t = arrondirTemps(audio.currentTime);
    setLignes((prev) => {
      if (indexTap >= prev.length) return prev;
      const copie = [...prev];
      copie[indexTap] = { ...copie[indexTap], t };
      return copie;
    });
    setIndexTap((i) => Math.min(i + 1, lignes.length - 1));
  }

  function reculerTap() {
    const nouvelIndex = Math.max(0, indexTap - 1);
    setLignes((prev) => {
      if (nouvelIndex >= prev.length) return prev;
      const copie = [...prev];
      copie[nouvelIndex] = { ...copie[nouvelIndex], t: null };
      return copie;
    });
    setIndexTap(nouvelIndex);
  }

  function modifierTexte(cle: string, texte: string) {
    setLignes((prev) =>
      prev.map((l) => (l.cle === cle ? { ...l, texte } : l)),
    );
  }

  function basculerTrou(cle: string) {
    setLignes((prev) =>
      prev.map((l) => (l.cle === cle ? { ...l, trou: !l.trou } : l)),
    );
  }

  function nudger(cle: string, delta: number) {
    setLignes((prev) =>
      prev.map((l) =>
        l.cle === cle && l.t !== null
          ? { ...l, t: Math.max(0, arrondirTemps(l.t + delta)) }
          : l,
      ),
    );
  }

  function supprimerLigne(cle: string) {
    setLignes((prev) => prev.filter((l) => l.cle !== cle));
  }

  function deplacerLigne(cle: string, direction: -1 | 1) {
    setLignes((prev) => {
      const i = prev.findIndex((l) => l.cle === cle);
      const j = i + direction;
      if (i === -1 || j < 0 || j >= prev.length) return prev;
      const copie = [...prev];
      [copie[i], copie[j]] = [copie[j], copie[i]];
      return copie;
    });
  }

  function insererLigne(cle: string, position: "avant" | "apres") {
    setLignes((prev) => {
      const i = prev.findIndex((l) => l.cle === cle);
      if (i === -1) return prev;
      const nouvelle: LigneEdition = {
        cle: crypto.randomUUID(),
        texte: "",
        t: null,
        trou: false,
      };
      const copie = [...prev];
      copie.splice(position === "avant" ? i : i + 1, 0, nouvelle);
      return copie;
    });
  }

  function surKeyDownTimestamp(e: React.KeyboardEvent, cle: string) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      nudger(cle, e.shiftKey ? -0.5 : -0.1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nudger(cle, e.shiftKey ? 0.5 : 0.1);
    }
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

      <main className="flex flex-col gap-1 overflow-y-auto bg-[#050914] p-4">
        <h1 className="mb-2 text-sm font-semibold tracking-wide text-white/70 uppercase">
          Lignes
        </h1>

        {modeTap && (
          <div className="mb-3 flex flex-col gap-1 rounded border border-sky-400/40 bg-sky-400/10 p-3">
            <p className="text-xs font-medium tracking-wide text-sky-300 uppercase">
              Mode tap — Espace : poser · Retour arrière : annuler · Échap :
              quitter
            </p>
            {lignes.slice(indexTap, indexTap + 3).map((ligne, i) => (
              <p
                key={ligne.cle}
                className={
                  i === 0
                    ? "text-2xl font-bold text-white"
                    : i === 1
                      ? "text-lg text-white/60"
                      : "text-sm text-white/35"
                }
              >
                {ligne.texte || "—"}
              </p>
            ))}
            {indexTap >= lignes.length && (
              <p className="text-sm text-white/50">Fin de la liste.</p>
            )}
          </div>
        )}

        {lignes.length === 0 ? (
          <p className="text-sm text-white/40">
            Collez des paroles à gauche puis générez la liste de lignes.
          </p>
        ) : (
          lignes.map((ligne, index) => {
            const estActuelle = ligne.cle === ligneActuelleCle;
            return (
              <div
                key={ligne.cle}
                onClick={() => selectionnerLigne(index)}
                className={`grid grid-cols-[2rem_auto_1fr_auto_auto] items-center gap-2 rounded border px-2 py-1 ${
                  estActuelle
                    ? "border-sky-400 bg-sky-400/10"
                    : "border-transparent hover:bg-white/5"
                } ${ligne.t === null ? "opacity-60" : ""}`}
              >
                <span className="text-right text-xs text-white/40">
                  {index + 1}
                </span>

                <button
                  type="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectionnerLigne(index);
                  }}
                  onKeyDown={(e) => surKeyDownTimestamp(e, ligne.cle)}
                  className={`rounded border px-1.5 py-0.5 font-mono text-xs focus:border-sky-400 focus:outline-none ${
                    ligne.t === null
                      ? "border-dashed border-white/25 text-white/40"
                      : "border-white/15 text-white/90"
                  }`}
                >
                  {ligne.t !== null ? formaterTemps(ligne.t) : "—:——.-"}
                </button>

                <input
                  className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-white outline-none focus:border-white/20"
                  value={ligne.texte}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => modifierTexte(ligne.cle, e.target.value)}
                />

                <label
                  className="flex items-center gap-1 text-xs text-white/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={ligne.trou}
                    onChange={() => basculerTrou(ligne.cle)}
                  />
                  trou
                </label>

                <div
                  className="flex items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    title="Reculer de 0.5s"
                    disabled={ligne.t === null}
                    className={boutonMiniClass}
                    onClick={() => nudger(ligne.cle, -0.5)}
                  >
                    «
                  </button>
                  <button
                    type="button"
                    title="Reculer de 0.1s"
                    disabled={ligne.t === null}
                    className={boutonMiniClass}
                    onClick={() => nudger(ligne.cle, -0.1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    title="Avancer de 0.1s"
                    disabled={ligne.t === null}
                    className={boutonMiniClass}
                    onClick={() => nudger(ligne.cle, 0.1)}
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    title="Avancer de 0.5s"
                    disabled={ligne.t === null}
                    className={boutonMiniClass}
                    onClick={() => nudger(ligne.cle, 0.5)}
                  >
                    »
                  </button>
                  <span className="mx-1 h-4 w-px bg-white/10" />
                  <button
                    type="button"
                    title="Monter"
                    className={boutonMiniClass}
                    onClick={() => deplacerLigne(ligne.cle, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    title="Descendre"
                    className={boutonMiniClass}
                    onClick={() => deplacerLigne(ligne.cle, 1)}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    title="Insérer une ligne au-dessus"
                    className={boutonMiniClass}
                    onClick={() => insererLigne(ligne.cle, "avant")}
                  >
                    +↑
                  </button>
                  <button
                    type="button"
                    title="Insérer une ligne en dessous"
                    className={boutonMiniClass}
                    onClick={() => insererLigne(ligne.cle, "apres")}
                  >
                    +↓
                  </button>
                  <button
                    type="button"
                    title="Supprimer la ligne"
                    className={boutonMiniClass}
                    onClick={() => supprimerLigne(ligne.cle)}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })
        )}
      </main>

      <aside className="flex flex-col gap-4 overflow-y-auto bg-[#050914] p-4">
        <h1 className="text-sm font-semibold tracking-wide text-white/70 uppercase">
          Lecture &amp; export
        </h1>
        {audioUrl ? (
          <>
            <audio
              ref={audioRef}
              controls
              src={audioUrl}
              className="w-full"
            />
            <button
              type="button"
              className={
                modeTap
                  ? `${boutonClass} border-sky-400 bg-sky-400/20`
                  : boutonClass
              }
              disabled={lignes.length === 0}
              onClick={modeTap ? sortirModeTap : entrerModeTap}
            >
              {modeTap ? "Quitter le mode tap (Échap)" : "Entrer en mode tap"}
            </button>
          </>
        ) : (
          <p className="text-sm text-white/40">
            Sélectionnez un fichier audio à gauche.
          </p>
        )}
      </aside>
    </div>
  );
}
