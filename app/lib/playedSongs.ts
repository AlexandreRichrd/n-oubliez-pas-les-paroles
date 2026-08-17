const STORAGE_KEY = "noublip:chansons-jouees";

export function getPlayedSongIds(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markSongPlayed(id: string): void {
  const played = getPlayedSongIds();
  played.add(id);
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...played]));
}
