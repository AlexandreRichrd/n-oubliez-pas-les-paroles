import { useEffect, useState } from "react";
import type { Route } from "./+types/jeu";
import type { Chanson } from "~/lib/chanson";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `${params.chansonId} — N'oubliez pas les paroles` }];
}

type Statut = "chargement" | "trouvee" | "introuvable";

export default function Jeu({ params }: Route.ComponentProps) {
  const { chansonId } = params;
  const [chanson, setChanson] = useState<Chanson | null>(null);
  const [statut, setStatut] = useState<Statut>("chargement");

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

  return (
    <div className="stage-bg flex min-h-dvh w-full flex-col items-center justify-center gap-4 text-center">
      <p className="font-heading text-4xl font-black text-white uppercase">
        {chanson.titre}
      </p>
      <p className="text-xl text-white/70">{chanson.artiste}</p>
      <p className="text-lg text-white/50">{chanson.lignes[0]?.texte}</p>
    </div>
  );
}
