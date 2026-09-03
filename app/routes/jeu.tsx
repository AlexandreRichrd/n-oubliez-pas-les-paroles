import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/jeu";
import type { Chanson, Line } from "~/lib/chanson";
import { blanchirTexte, indexLigneCourante } from "~/lib/lecture";
import { markSongPlayed } from "~/lib/playedSongs";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `${params.chansonId} — N'oubliez pas les paroles` }];
}

type Statut = "chargement" | "trouvee" | "introuvable";
type Resultat = "correct" | "faux";

/** Les timestamps des chansons exportées ont déjà le décalage intégré. */
const tDe = (ligne: Line) => ligne.t;

const DUREE_FONDU_MS = 200;

/** Rampe de volume sur l'élément lui-même — pas de Web Audio ici. */
function lancerFondu(
  audio: HTMLAudioElement,
  cible: number,
  refFrame: { current: number | null },
  surFin?: () => void,
) {
  if (refFrame.current !== null) cancelAnimationFrame(refFrame.current);
  const depart = audio.volume;
  const debut = performance.now();
  function etape(maintenant: number) {
    const progression = Math.min(
      1,
      (maintenant - debut) / DUREE_FONDU_MS,
    );
    audio.volume = depart + (cible - depart) * progression;
    if (progression < 1) {
      refFrame.current = requestAnimationFrame(etape);
    } else {
      refFrame.current = null;
      surFin?.();
    }
  }
  refFrame.current = requestAnimationFrame(etape);
}

export default function Jeu({ params }: Route.ComponentProps) {
  const { chansonId } = params;
  const navigate = useNavigate();

  const [chanson, setChanson] = useState<Chanson | null>(null);
  const [statut, setStatut] = useState<Statut>("chargement");
  const [erreurAudio, setErreurAudio] = useState(false);

  const [tempsActuel, setTempsActuel] = useState(0);
  const [enPause, setEnPause] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [attente, setAttente] = useState<number | null>(null);
  const [resultats, setResultats] = useState<Record<number, Resultat>>({});
  const [indiceInitiales, setIndiceInitiales] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fonduRef = useRef<number | null>(null);
  /** Trous déjà joués — jugés ou sautés — pour ne pas s'y arrêter deux fois. */
  const trousTraitesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    setStatut("chargement");
    setChanson(null);
    fetch(`/songs/${chansonId}.json`)
      .then((r) => {
        if (!r.ok) throw new Error("introuvable");
        return r.json() as Promise<Chanson>;
      })
      .then((data) => {
        setChanson(data);
        setStatut("trouvee");
      })
      .catch(() => setStatut("introuvable"));
  }, [chansonId]);

  useEffect(() => {
    let frame: number;
    function suivre() {
      const audio = audioRef.current;
      if (audio) setTempsActuel(audio.currentTime);
      frame = requestAnimationFrame(suivre);
    }
    frame = requestAnimationFrame(suivre);
    return () => cancelAnimationFrame(frame);
  }, [statut]);

  useEffect(() => {
    return () => {
      if (fonduRef.current !== null) cancelAnimationFrame(fonduRef.current);
    };
  }, []);

  // L'indice ne doit jamais survivre au trou pour lequel il a été demandé.
  useEffect(() => {
    setIndiceInitiales(false);
  }, [attente]);

  // Arrivée sur un trou : fondu à 0, pause, et on attend le jugement.
  useEffect(() => {
    if (!chanson || attente !== null) return;
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    const index = indexLigneCourante(chanson.lignes, tempsActuel, tDe);
    if (index === -1) return;
    const ligne = chanson.lignes[index];
    if (!ligne.trou || ligne.instrumental) return;
    if (trousTraitesRef.current.has(index)) return;

    trousTraitesRef.current.add(index);
    setAttente(index);
    lancerFondu(audio, 0, fonduRef, () => audio.pause());
  }, [chanson, tempsActuel, attente]);

  function juger(resultat: Resultat) {
    if (attente === null) return;
    setResultats((prev) => ({ ...prev, [attente]: resultat }));
    setAttente(null);
    const audio = audioRef.current;
    if (!audio) return;
    void audio.play();
    lancerFondu(audio, 1, fonduRef);
  }

  useEffect(() => {
    function surKeyDown(e: KeyboardEvent) {
      const audio = audioRef.current;
      if (e.key === "Enter") {
        e.preventDefault();
        // Ignoré hors jugement : une touche perdue ne doit pas noter une
        // ligne qui n'est pas soumise au jury.
        juger("correct");
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        juger("faux");
        return;
      }
      if (e.key === " ") {
        // Sans preventDefault le navigateur défile et re-déclenche le dernier
        // contrôle qui avait le focus.
        e.preventDefault();
        if (!audio) return;
        // L'arrêt sur un trou est délibéré : Espace ne doit pas le relancer
        // sans jugement, sinon le son revient à volume 0.
        if (attente !== null) return;
        if (audio.paused) {
          void audio.play();
          setEnPause(false);
        } else {
          audio.pause();
          setEnPause(true);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        allerLigneSuivante();
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Abandonner ne marque pas la chanson comme jouée.
        navigate("/");
      } else if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        setOverlayVisible((v) => !v);
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        // L'indice n'a de sens que pendant le jugement d'un trou.
        if (attente === null) return;
        setIndiceInitiales((v) => !v);
      }
    }
    window.addEventListener("keydown", surKeyDown);
    return () => window.removeEventListener("keydown", surKeyDown);
  }, [chanson, tempsActuel, navigate, attente]);

  function allerLigneSuivante() {
    const audio = audioRef.current;
    if (!audio || !chanson) return;
    const index = indexLigneCourante(chanson.lignes, audio.currentTime, tDe);
    const suivante = chanson.lignes[index + 1];
    if (!suivante) return;
    // Sauter par-dessus un trou l'abandonne sans le noter.
    if (attente !== null) setAttente(null);
    audio.currentTime = suivante.t;
    if (audio.paused) {
      void audio.play();
      setEnPause(false);
    }
    lancerFondu(audio, 1, fonduRef);
  }

  if (statut === "chargement") {
    return (
      <div className="stage-bg flex min-h-dvh w-full items-center justify-center">
        <p className="font-heading text-2xl font-bold text-white/70">
          Chargement…
        </p>
      </div>
    );
  }

  if (statut === "introuvable" || !chanson) {
    return (
      <div className="stage-bg flex min-h-dvh w-full flex-col items-center justify-center gap-4 text-center">
        <p className="font-heading text-3xl font-black text-white uppercase">
          Chanson introuvable
        </p>
        <p className="text-white/60">
          Aucune chanson avec l&apos;identifiant « {chansonId} ».
        </p>
      </div>
    );
  }

  const index = indexLigneCourante(chanson.lignes, tempsActuel, tDe);
  const courante = index === -1 ? undefined : chanson.lignes[index];
  const precedentes = chanson.lignes.slice(Math.max(0, index - 3), index);

  const jugements = Object.values(resultats);
  const bonnes = jugements.filter((r) => r === "correct").length;
  const mauvaises = jugements.filter((r) => r === "faux").length;

  function terminerManche() {
    markSongPlayed(chansonId);
    navigate("/score", {
      state: { bonnes, mauvaises, titre: chanson?.titre },
    });
  }

  return (
    <div className="stage-bg relative flex min-h-dvh w-full flex-col overflow-hidden">
      {/*
        Un seul <audio>, monté pour toute la manche. Le remonter en cours de
        chanson couperait le son devant tout le monde : pas de key changeante,
        pas de rendu conditionnel de cet élément.
      */}
      <audio
        ref={audioRef}
        src={chanson.audio}
        preload="auto"
        autoPlay
        onError={() => setErreurAudio(true)}
        onEnded={terminerManche}
      />

      <header className="flex items-center justify-between px-10 pt-10">
        <span className="w-32" />
        <p className="font-heading text-[clamp(1rem,1.6vw,1.6rem)] font-bold tracking-[0.3em] text-sky-300/70 uppercase">
          {chanson.titre}
        </p>
        {/* Le score reste discret : cet écran parle des paroles. */}
        <p className="w-32 text-right font-heading text-[clamp(0.9rem,1.3vw,1.3rem)] font-bold tracking-widest">
          <span className="text-green-400/70">{bonnes}</span>
          <span className="text-white/25"> / </span>
          <span className="text-red-400/70">{mauvaises}</span>
        </p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 text-center">
        {precedentes.map((ligne, i) => (
          <p
            key={`${i}-${ligne.t}`}
            className={
              ligne.instrumental
                ? "font-heading text-[clamp(1rem,2vw,2rem)] font-bold text-violet-300/25 italic"
                : "font-heading text-[clamp(1rem,2vw,2rem)] font-bold text-white/25"
            }
          >
            {ligne.instrumental
              ? `♪ ${ligne.label ?? ""}`.trim()
              : ligne.texte}
          </p>
        ))}

        {!courante ? (
          <p className="font-heading text-[clamp(1.5rem,3vw,3rem)] font-bold text-white/30">
            …
          </p>
        ) : courante.instrumental ? (
          // Un passage instrumental vide la zone de paroles : jamais la ligne
          // précédente figée pendant un solo.
          <p className="font-heading text-[clamp(2rem,4.5vw,4.5rem)] font-black text-violet-300 uppercase italic">
            ♪ {courante.label ?? ""}
          </p>
        ) : (
          <p
            className={`font-heading text-[clamp(2.2rem,5.5vw,5.5rem)] font-black uppercase [text-shadow:0_3px_0_oklch(0.15_0.08_260),0_8px_24px_oklch(0_0_0/0.5)] ${
              resultats[index] === "correct"
                ? "text-green-400"
                : resultats[index] === "faux"
                  ? "text-red-400"
                  : "text-white"
            }`}
          >
            {attente === index
              ? blanchirTexte(courante.texte, indiceInitiales)
              : courante.texte}
          </p>
        )}
      </div>

      {enPause && (
        <p className="pb-4 text-center font-heading text-[clamp(0.9rem,1.4vw,1.4rem)] font-bold tracking-[0.3em] text-amber-300/80 uppercase">
          Pause
        </p>
      )}

      {erreurAudio && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#050914]/95 text-center">
          <p className="font-heading text-[clamp(1.5rem,3vw,3rem)] font-black text-red-400 uppercase">
            Audio introuvable
          </p>
          <p className="text-[clamp(0.9rem,1.5vw,1.5rem)] text-white/70">
            Le fichier « {chanson.audio} » n&apos;a pas pu être chargé.
          </p>
          <p className="text-[clamp(0.8rem,1.2vw,1.2rem)] text-white/40">
            Échap pour revenir à l&apos;accueil.
          </p>
        </div>
      )}

      {overlayVisible && (
        <div className="absolute right-6 bottom-6 rounded-lg border border-white/10 bg-black/60 px-5 py-4 text-left">
          <ul className="flex flex-col gap-1 text-[clamp(0.75rem,1vw,1rem)] font-semibold text-white/60">
            <li>Espace — Pause / reprise</li>
            <li>Entrée — Bonne réponse</li>
            <li>Retour arr. — Mauvaise réponse</li>
            <li>→ — Ligne suivante</li>
            <li>I — Indice (initiales)</li>
            <li>Échap — Abandonner</li>
            <li>H — Masquer cette aide</li>
          </ul>
        </div>
      )}
    </div>
  );
}
