export type LocalStats = { games: number; wins: number; streak: number };

const KEY = "kinsa-stats-v1";

function parse(raw: string | null): LocalStats {
  if (!raw) return { games: 0, wins: 0, streak: 0 };
  try {
    const o = JSON.parse(raw) as Partial<LocalStats>;
    return {
      games: Math.max(0, Number(o.games) || 0),
      wins: Math.max(0, Number(o.wins) || 0),
      streak: Math.max(0, Number(o.streak) || 0),
    };
  } catch {
    return { games: 0, wins: 0, streak: 0 };
  }
}

export function loadStats(): LocalStats {
  if (typeof window === "undefined") return { games: 0, wins: 0, streak: 0 };
  return parse(window.localStorage.getItem(KEY));
}

export function recordMatchEnd(won: boolean): LocalStats {
  const prev = loadStats();
  const games = prev.games + 1;
  const wins = prev.wins + (won ? 1 : 0);
  const streak = won ? prev.streak + 1 : 0;
  const next: LocalStats = { games, wins, streak };
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
