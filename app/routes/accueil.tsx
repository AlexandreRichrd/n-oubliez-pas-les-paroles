import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/accueil";
import type { ChansonResume, IndexChansons, Theme } from "~/lib/chanson";
import { getPlayedSongIds } from "~/lib/playedSongs";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "N'oubliez pas les paroles" },
    { name: "description", content: "Jeu de soirée : devinez les paroles." },
  ];
}

type Etape = "theme" | "chanson";

export default function Accueil() {
  const navigate = useNavigate();
  const [index, setIndex] = useState<IndexChansons | null>(null);
  const [etape, setEtape] = useState<Etape>("theme");
  const [themeIndex, setThemeIndex] = useState(0);
  const [chansonIndex, setChansonIndex] = useState(0);
  const [chansonsJouees, setChansonsJouees] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setChansonsJouees(getPlayedSongIds());
    fetch("/songs/index.json")
      .then((r) => r.json())
      .then((data: IndexChansons) => setIndex(data));
  }, []);

  const theme: Theme | undefined = index?.themes[themeIndex];

  const chansonsDuTheme = useMemo<ChansonResume[]>(() => {
    if (!index || !theme) return [];
    return index.chansons.filter((c) => c.theme === theme.id);
  }, [index, theme]);

  useEffect(() => {
    function surAppuiTouche(e: KeyboardEvent) {
      if (!index) return;

      if (etape === "theme") {
        const nb = index.themes.length;
        if (nb === 0) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setThemeIndex((i) => (i + 1) % nb);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setThemeIndex((i) => (i - 1 + nb) % nb);
        } else if (e.key === "Enter") {
          e.preventDefault();
          setChansonIndex(0);
          setEtape("chanson");
        }
        return;
      }

      const nb = chansonsDuTheme.length;
      if (e.key === "Escape") {
        e.preventDefault();
        setEtape("theme");
      } else if (nb === 0) {
        return;
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setChansonIndex((i) => (i + 1) % nb);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setChansonIndex((i) => (i - 1 + nb) % nb);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const chanson = chansonsDuTheme[chansonIndex];
        navigate("/jeu", { state: { chansonId: chanson.id } });
      }
    }

    window.addEventListener("keydown", surAppuiTouche);
    return () => window.removeEventListener("keydown", surAppuiTouche);
  }, [index, etape, chansonsDuTheme, chansonIndex, navigate]);

  if (!index) {
    return (
      <div className="stage-bg flex min-h-dvh w-full items-center justify-center">
        <p className="font-heading text-2xl font-bold text-white/70">
          Chargement…
        </p>
      </div>
    );
  }

  return (
    <div className="stage-bg relative flex min-h-dvh w-full flex-col overflow-hidden">
      <header className="pt-14 pb-6 text-center">
        {etape === "chanson" && (
          <p className="text-[clamp(0.85rem,1.3vw,1.3rem)] font-semibold tracking-[0.35em] text-sky-300/80 uppercase">
            Thème
          </p>
        )}
        <h1 className="font-heading mt-2 text-[clamp(2.1rem,4vw,3.5rem)] font-black tracking-wide text-white uppercase [text-shadow:0_3px_0_oklch(0.15_0.08_260),0_8px_24px_oklch(0_0_0/0.5)]">
          {etape === "theme" ? "Choisissez un thème" : theme?.nom}
        </h1>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-4 px-8 pb-10">
        {etape === "theme"
          ? index.themes.map((t, i) => {
              const chansonsTheme = index.chansons.filter(
                (c) => c.theme === t.id,
              );
              const joue =
                chansonsTheme.length > 0 &&
                chansonsTheme.every((c) => chansonsJouees.has(c.id));
              return (
                <Pill
                  key={t.id}
                  selectionnee={i === themeIndex}
                  jouee={joue}
                  onClick={() => {
                    setThemeIndex(i);
                    setChansonIndex(0);
                    setEtape("chanson");
                  }}
                >
                  <span className="font-heading text-[clamp(1.4rem,2.6vw,2.6rem)] font-extrabold uppercase">
                    {t.nom}
                  </span>
                  {joue && <PlayedBadge />}
                </Pill>
              );
            })
          : chansonsDuTheme.map((c, i) => {
              const joue = chansonsJouees.has(c.id);
              return (
                <Pill
                  key={c.id}
                  selectionnee={i === chansonIndex}
                  jouee={joue}
                  onClick={() =>
                    navigate("/jeu", { state: { chansonId: c.id } })
                  }
                >
                  <span className="font-heading text-[clamp(1.4rem,2.9vw,2.9rem)] font-extrabold uppercase">
                    {c.titre}
                  </span>
                  <span className="flex items-center gap-5 whitespace-nowrap">
                    <span className="text-[clamp(0.95rem,1.5vw,1.5rem)] font-semibold opacity-80">
                      {c.artiste}
                      {c.annee ? ` · ${c.annee}` : ""}
                    </span>
                    {joue && <PlayedBadge />}
                  </span>
                </Pill>
              );
            })}
      </div>

      <div className="flex justify-center gap-12 pb-10 text-[clamp(0.85rem,1.2vw,1.35rem)] font-semibold tracking-wide text-sky-100/60">
        <span>↑ ↓ &nbsp;Se déplacer</span>
        <span>Entrée &nbsp;Choisir</span>
        {etape === "chanson" && <span>Échap &nbsp;Retour aux thèmes</span>}
      </div>
    </div>
  );
}

function Pill({
  selectionnee,
  jouee,
  onClick,
  children,
}: {
  selectionnee: boolean;
  jouee: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "selection-pill flex w-full items-center justify-between gap-6 px-10 py-3 text-left transition-transform duration-150",
        selectionnee
          ? "selection-pill--selected scale-[1.03] text-[oklch(0.2_0.06_85)]"
          : jouee
            ? "selection-pill--played text-[oklch(0.55_0.01_260)]"
            : "text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PlayedBadge() {
  return (
    <span className="rounded-full bg-[oklch(0.15_0.01_260)] px-4 py-1.5 text-[0.85rem] font-bold tracking-[0.12em] text-[oklch(0.7_0.01_260)] uppercase">
      Jouée
    </span>
  );
}
