export function formaterTemps(t: number): string {
  const total = Math.max(0, t);
  const minutes = Math.floor(total / 60);
  const secondes = total % 60;
  return `${minutes}:${secondes.toFixed(1).padStart(4, "0")}`;
}

export function arrondirTemps(t: number): number {
  return Math.round(t * 10) / 10;
}
