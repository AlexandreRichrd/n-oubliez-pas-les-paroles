import { useLocation, useNavigate } from "react-router";
import type { Route } from "./+types/score";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Score — N'oubliez pas les paroles" }];
}

type EtatScore = {
  bonnes?: number;
  mauvaises?: number;
  titre?: string;
};

export default function Score() {
  const navigate = useNavigate();
  const etat = (useLocation().state ?? null) as EtatScore | null;
  const bonnes = etat?.bonnes ?? 0;
  const mauvaises = etat?.mauvaises ?? 0;

  return (
    <div className="stage-bg flex min-h-dvh w-full flex-col items-center justify-center gap-10 text-center">
      {etat?.titre && (
        <p className="font-heading text-[clamp(1rem,1.6vw,1.6rem)] font-bold tracking-[0.3em] text-sky-300/70 uppercase">
          {etat.titre}
        </p>
      )}

      <div className="flex items-center gap-16">
        <div className="flex flex-col items-center gap-2">
          <span className="font-heading text-[clamp(3rem,7vw,7rem)] font-black text-green-400">
            {bonnes}
          </span>
          <span className="text-[clamp(0.9rem,1.4vw,1.4rem)] font-semibold tracking-[0.2em] text-white/50 uppercase">
            Bonnes
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="font-heading text-[clamp(3rem,7vw,7rem)] font-black text-red-400">
            {mauvaises}
          </span>
          <span className="text-[clamp(0.9rem,1.4vw,1.4rem)] font-semibold tracking-[0.2em] text-white/50 uppercase">
            Mauvaises
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate("/")}
        className="selection-pill px-10 py-4 font-heading text-[clamp(1.1rem,2vw,2rem)] font-extrabold text-white uppercase"
      >
        Retour à l&apos;accueil
      </button>
    </div>
  );
}
