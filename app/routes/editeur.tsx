import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/editeur";
import { slugifier } from "~/lib/editeur/slug";
import {
  arrondirTemps,
  formaterTemps,
  tempsCorrige,
} from "~/lib/editeur/temps";
import type { LigneEdition } from "~/lib/editeur/types";
import { validerBrouillon } from "~/lib/editeur/validation";
import {
  chargerBrouillon,
  effacerBrouillon,
  sauvegarderBrouillon,
} from "~/lib/editeur/persistence";
import type { Chanson, Line } from "~/lib/chanson";

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
  const [brouillonInitial] = useState(() => chargerBrouillon());

  const [id, setId] = useState(brouillonInitial?.id ?? "");
  const [idModifieManuel, setIdModifieManuel] = useState(
    brouillonInitial?.idModifieManuel ?? false,
  );
  const [titre, setTitre] = useState(brouillonInitial?.titre ?? "");
  const [artiste, setArtiste] = useState(brouillonInitial?.artiste ?? "");
  const [theme, setTheme] = useState(brouillonInitial?.theme ?? "");
  const [annee, setAnnee] = useState(brouillonInitial?.annee ?? "");

  const [nomFichierAudio, setNomFichierAudio] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [texteParoles, setTexteParoles] = useState(
    brouillonInitial?.texteParoles ?? "",
  );
  const [lignes, setLignes] = useState<LigneEdition[]>(
    brouillonInitial?.lignes ?? [],
  );
  const [tempsActuel, setTempsActuel] = useState(0);
  const [indexSelectionne, setIndexSelectionne] = useState<number | null>(
    null,
  );
  const [modeTap, setModeTap] = useState(false);
  const [indexTap, setIndexTap] = useState(0);
  const [decalageMs, setDecalageMs] = useState(
    brouillonInitial?.decalageMs ?? 0,
  );
  const [vitesseLecture, setVitesseLecture] = useState(
    brouillonInitial?.vitesseLecture ?? 1,
  );
  const [modeApercu, setModeApercu] = useState(false);
  const [dureeAudio, setDureeAudio] = useState<number | null>(null);

  const audioUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const entreeImportRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!idModifieManuel) setId(slugifier(titre));
  }, [titre, idModifieManuel]);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = vitesseLecture;
  }, [vitesseLecture, audioUrl]);

  useEffect(() => {
    const minuteur = setTimeout(() => {
      sauvegarderBrouillon({
        id,
        idModifieManuel,
        titre,
        artiste,
        theme,
        annee,
        texteParoles,
        lignes,
        decalageMs,
        vitesseLecture,
      });
    }, 500);
    return () => clearTimeout(minuteur);
  }, [
    id,
    idModifieManuel,
    titre,
    artiste,
    theme,
    annee,
    texteParoles,
    lignes,
    decalageMs,
    vitesseLecture,
  ]);

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
      const t = tempsCorrige(l, decalageMs);
      if (t !== null && t <= tempsActuel) derniereCle = l.cle;
    }
    return derniereCle;
  }, [lignes, tempsActuel, decalageMs]);

  const lignesAffichees = useMemo(
    () =>
      lignes.filter((l) => {
        const t = tempsCorrige(l, decalageMs);
        return t !== null && t <= tempsActuel;
      }),
    [lignes, tempsActuel, decalageMs],
  );

  const problemesValidation = useMemo(
    () =>
      validerBrouillon({
        titre,
        artiste,
        theme,
        lignes: lignes.map((l) => ({ ...l, t: tempsCorrige(l, decalageMs) })),
        dureeAudio,
      }),
    [titre, artiste, theme, lignes, decalageMs, dureeAudio],
  );

  useEffect(() => {
    if (!modeApercu) return;
    function surKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        sortirApercu();
      }
    }
    window.addEventListener("keydown", surKeyDown);
    return () => window.removeEventListener("keydown", surKeyDown);
  }, [modeApercu]);

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
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        insererInstrumentalTap();
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
  }, [modeTap, indexTap, lignes]);

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
          instrumental: false,
          label: "",
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
    const ligne = lignes[index];
    if (!ligne) return;
    const t = tempsCorrige(ligne, decalageMs);
    if (t !== null) seekEtLire(t - 2);
  }

  function entrerModeTap() {
    const audio = audioRef.current;
    if (!audio || lignes.length === 0) return;
    const depart = indexSelectionne ?? 0;
    const ligneDepart = lignes[depart];
    audio.currentTime = ligneDepart
      ? (tempsCorrige(ligneDepart, decalageMs) ?? 0)
      : 0;
    void audio.play();
    setIndexTap(depart);
    setModeTap(true);
  }

  function sortirModeTap() {
    setModeTap(false);
    audioRef.current?.pause();
  }

  function entrerApercu() {
    const audio = audioRef.current;
    if (!audio || lignes.length === 0) return;
    setModeTap(false);
    audio.currentTime = 0;
    void audio.play();
    setModeApercu(true);
  }

  function sortirApercu() {
    setModeApercu(false);
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
    // Un instrumental juste au-dessus a été inséré, pas tapé : on le retire
    // entièrement, ce qui ramène la ligne en attente à sa place précédente.
    const precedente = indexTap > 0 ? lignes[indexTap - 1] : undefined;
    if (precedente?.instrumental) {
      setLignes((prev) => prev.filter((l) => l.cle !== precedente.cle));
      setIndexTap(indexTap - 1);
      return;
    }

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

  function modifierLabel(cle: string, label: string) {
    setLignes((prev) =>
      prev.map((l) => (l.cle === cle ? { ...l, label } : l)),
    );
  }

  function basculerTrou(cle: string) {
    setLignes((prev) =>
      prev.map((l) =>
        l.cle === cle
          ? // Marquer trou lève l'instrumental : on ne peut pas chanter un solo.
            { ...l, trou: !l.trou, instrumental: l.trou ? l.instrumental : false }
          : l,
      ),
    );
  }

  function basculerInstrumental(cle: string) {
    setLignes((prev) =>
      prev.map((l) =>
        l.cle === cle
          ? {
              ...l,
              instrumental: !l.instrumental,
              trou: l.instrumental ? l.trou : false,
            }
          : l,
      ),
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
        instrumental: false,
        label: "",
      };
      const copie = [...prev];
      copie.splice(position === "avant" ? i : i + 1, 0, nouvelle);
      return copie;
    });
  }

  function creerLigneInstrumentale(t: number | null): LigneEdition {
    return {
      cle: crypto.randomUUID(),
      texte: "",
      t,
      trou: false,
      instrumental: true,
      label: "",
    };
  }

  /**
   * Insère un passage instrumental AU-DESSUS de `index`. La ligne qui s'y
   * trouvait reste en attente : elle est simplement décalée d'un cran.
   */
  function insererInstrumental(index: number, t: number | null) {
    setLignes((prev) => {
      const copie = [...prev];
      copie.splice(index, 0, creerLigneInstrumentale(t));
      return copie;
    });
  }

  function insererInstrumentalTap() {
    const audio = audioRef.current;
    if (!audio) return;
    // Capture, pas lecture : on écrit le temps brut, sans décalage.
    insererInstrumental(indexTap, arrondirTemps(audio.currentTime));
    setIndexTap((i) => i + 1);
  }

  function insererIntro() {
    insererInstrumental(0, 0);
    if (modeTap) setIndexTap((i) => i + 1);
  }

  function blanchirTexte(texte: string): string {
    return texte
      .split(/\s+/)
      .filter((mot) => mot.length > 0)
      .map((mot) => "_".repeat(mot.length))
      .join(" ");
  }

  function construireChanson(): Chanson {
    return {
      id,
      titre,
      artiste,
      ...(annee.trim() ? { annee: Number(annee) } : {}),
      theme,
      audio: `/audio/${id}.mp3`,
      lignes: lignes.map((l): Line => {
        const ligne: Line = {
          t: tempsCorrige(l, decalageMs) ?? 0,
          texte: l.texte,
        };
        if (l.trou) ligne.trou = true;
        if (l.instrumental) {
          ligne.instrumental = true;
          if (l.label.trim()) ligne.label = l.label.trim();
        }
        return ligne;
      }),
    };
  }

  function exporterJson() {
    const chanson = construireChanson();
    const blob = new Blob([JSON.stringify(chanson, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id || "chanson"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function surImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    fichier.text().then((texte) => {
      const chanson = JSON.parse(texte) as Chanson;
      setId(chanson.id);
      setIdModifieManuel(true);
      setTitre(chanson.titre);
      setArtiste(chanson.artiste);
      setTheme(chanson.theme);
      setAnnee(chanson.annee !== undefined ? String(chanson.annee) : "");
      setDecalageMs(0);
      setLignes(
        chanson.lignes.map(
          (l): LigneEdition => ({
            cle: crypto.randomUUID(),
            texte: l.texte,
            t: l.t,
            // L'exclusion mutuelle prime : un instrumental n'est jamais un trou.
            trou: !!l.trou && !l.instrumental,
            instrumental: !!l.instrumental,
            label: l.label ?? "",
          }),
        ),
      );
    });
  }

  function effacerLeBrouillon() {
    const confirmer = window.confirm(
      "Effacer le brouillon sauvegardé et réinitialiser l'éditeur ?",
    );
    if (!confirmer) return;
    effacerBrouillon();
    setId("");
    setIdModifieManuel(false);
    setTitre("");
    setArtiste("");
    setTheme("");
    setAnnee("");
    setTexteParoles("");
    setLignes([]);
    setDecalageMs(0);
    setVitesseLecture(1);
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
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold tracking-wide text-white/70 uppercase">
            Métadonnées
          </h1>
          <button
            type="button"
            className="text-xs text-white/40 underline hover:text-white/70"
            onClick={effacerLeBrouillon}
          >
            Effacer le brouillon
          </button>
        </div>

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
          {brouillonInitial && !audioUrl && (
            <p className="rounded border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-300">
              Brouillon restauré — sélectionnez à nouveau le fichier audio.
            </p>
          )}
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
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-sm font-semibold tracking-wide text-white/70 uppercase">
            Lignes
          </h1>
          <button
            type="button"
            className={boutonMiniClass}
            title="Insérer un passage instrumental d'intro à 0:00"
            onClick={insererIntro}
          >
            ♪ Intro à 0:00
          </button>
        </div>

        {modeTap && (
          <div className="mb-3 flex flex-col gap-1 rounded border border-sky-400/40 bg-sky-400/10 p-3">
            <p className="text-xs font-medium tracking-wide text-sky-300 uppercase">
              Mode tap — Espace : poser · I : passage instrumental · Retour
              arrière : annuler · Échap : quitter
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
                {ligne.instrumental
                  ? `♪ ${ligne.label || "Passage instrumental"}`
                  : ligne.texte || "—"}
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
                    : ligne.instrumental
                      ? "border-violet-400/30 bg-violet-400/5 hover:bg-violet-400/10"
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
                  {(() => {
                    const t = tempsCorrige(ligne, decalageMs);
                    return t !== null ? formaterTemps(t) : "—:——.-";
                  })()}
                </button>

                {ligne.instrumental ? (
                  <div className="flex w-full items-center gap-2">
                    <span
                      className="text-base text-violet-300"
                      title="Passage sans paroles"
                    >
                      ♪
                    </span>
                    <input
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-violet-200 italic outline-none placeholder:text-violet-300/40 focus:border-violet-400/40"
                      placeholder="Intro, Solo guitare, Pont…"
                      value={ligne.label}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => modifierLabel(ligne.cle, e.target.value)}
                    />
                  </div>
                ) : (
                  <input
                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-white outline-none focus:border-white/20"
                    value={ligne.texte}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => modifierTexte(ligne.cle, e.target.value)}
                  />
                )}

                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label
                    className={`flex items-center gap-1 text-xs ${
                      ligne.instrumental
                        ? "cursor-not-allowed text-white/25"
                        : "text-white/60"
                    }`}
                    title={
                      ligne.instrumental
                        ? "Impossible : un passage instrumental n'a rien à chanter"
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={ligne.trou}
                      disabled={ligne.instrumental}
                      onChange={() => basculerTrou(ligne.cle)}
                    />
                    trou
                  </label>
                  <label
                    className="flex items-center gap-1 text-xs text-violet-300/80"
                    title="Passage instrumental (sans paroles)"
                  >
                    <input
                      type="checkbox"
                      checked={ligne.instrumental}
                      onChange={() => basculerInstrumental(ligne.cle)}
                    />
                    ♪
                  </label>
                </div>

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
                    title="Insérer un passage instrumental au-dessus (au temps de lecture courant)"
                    className={boutonMiniClass}
                    onClick={() =>
                      insererInstrumental(
                        index,
                        audioRef.current
                          ? arrondirTemps(audioRef.current.currentTime)
                          : null,
                      )
                    }
                  >
                    +♪
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
              onLoadedMetadata={(e) =>
                setDureeAudio(e.currentTarget.duration)
              }
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

            <button
              type="button"
              className={boutonClass}
              disabled={lignes.length === 0}
              onClick={entrerApercu}
            >
              Lancer l'aperçu
            </button>

            <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
              <span className={labelClass}>Vitesse de lecture</span>
              <div className="flex gap-1">
                {[0.75, 1].map((vitesse) => (
                  <button
                    key={vitesse}
                    type="button"
                    className={
                      vitesseLecture === vitesse
                        ? `${boutonMiniClass} border-sky-400 bg-sky-400/20`
                        : boutonMiniClass
                    }
                    onClick={() => setVitesseLecture(vitesse)}
                  >
                    {vitesse}×
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
              <span className={labelClass}>
                Décalage global (appliqué à l'export)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={boutonMiniClass}
                  onClick={() => setDecalageMs((v) => v - 10)}
                >
                  −10ms
                </button>
                <input
                  type="number"
                  step={10}
                  className={`${champClass} w-24 text-center`}
                  value={decalageMs}
                  onChange={(e) =>
                    setDecalageMs(Number(e.target.value) || 0)
                  }
                />
                <button
                  type="button"
                  className={boutonMiniClass}
                  onClick={() => setDecalageMs((v) => v + 10)}
                >
                  +10ms
                </button>
              </div>
              <p className="text-xs text-sky-300">
                Décalage actuel : {decalageMs > 0 ? "+" : ""}
                {decalageMs} ms
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-white/40">
            Sélectionnez un fichier audio à gauche.
          </p>
        )}

        <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
          <span className={labelClass}>Import / export</span>

          {problemesValidation.length > 0 && (
            <ul className="flex flex-col gap-1 rounded border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-300">
              {problemesValidation.map((probleme) => (
                <li key={probleme}>⚠ {probleme}</li>
              ))}
            </ul>
          )}

          <button type="button" className={boutonClass} onClick={exporterJson}>
            Exporter en JSON
          </button>

          <input
            ref={entreeImportRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={surImportJson}
          />
          <button
            type="button"
            className={boutonClass}
            onClick={() => entreeImportRef.current?.click()}
          >
            Importer un JSON existant
          </button>
        </div>
      </aside>

      {modeApercu && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#050914] p-12">
          <button
            type="button"
            className={`${boutonClass} absolute top-6 right-6`}
            onClick={sortirApercu}
          >
            Fermer l'aperçu (Échap)
          </button>

          <div className="flex w-full max-w-3xl flex-col items-center gap-3 text-center">
            {lignesAffichees.slice(-4, -1).map((ligne) => (
              <p
                key={ligne.cle}
                className={
                  ligne.instrumental
                    ? "text-lg text-violet-300/40 italic"
                    : "text-lg text-white/35"
                }
              >
                {ligne.instrumental
                  ? `♪ ${ligne.label || ""}`.trim()
                  : ligne.texte}
              </p>
            ))}
            {(() => {
              const courante = lignesAffichees[lignesAffichees.length - 1];
              if (!courante) {
                return (
                  <p className="text-sm text-white/30">
                    En attente de la première ligne…
                  </p>
                );
              }
              // Un passage instrumental vide la zone de paroles au lieu de
              // laisser la ligne précédente figée à l'écran.
              if (courante.instrumental) {
                return (
                  <p className="text-3xl font-bold text-violet-300 italic">
                    ♪ {courante.label}
                  </p>
                );
              }
              return (
                <p className="text-4xl font-bold text-white">
                  {courante.trou
                    ? blanchirTexte(courante.texte)
                    : courante.texte}
                </p>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
