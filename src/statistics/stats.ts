/** Game record schema (persisted in games.json) + derived statistics (pure functions). */

export interface GameRecord {
  id: string;
  finishedAt: string; // ISO date
  playerColor: 'white' | 'black';
  level: number; // 1..8
  result: 'win' | 'loss' | 'draw';
  reason: string; // checkmate | resignation | stalemate | fifty-move | threefold | insufficient-material
  sanMoves: string[];
  uciMoves: string[];
  startFen: string;
  specials?: { castles: number; enPassant: number; promotions: number };
}

export interface LevelTally { level: number; wins: number; losses: number; draws: number; }

export interface StatsSummary {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // 0..1
  bestWinLevel: number;
  byLevel: LevelTally[];
  recent: Array<{ result: 'win' | 'loss' | 'draw'; finishedAt: string; level: number }>;
}

export function summarize(games: GameRecord[]): StatsSummary {
  const wins = games.filter(g => g.result === 'win').length;
  const losses = games.filter(g => g.result === 'loss').length;
  const draws = games.filter(g => g.result === 'draw').length;
  const byLevelMap = new Map<number, LevelTally>();
  for (const g of games) {
    const t = byLevelMap.get(g.level) ?? { level: g.level, wins: 0, losses: 0, draws: 0 };
    if (g.result === 'win') t.wins++;
    else if (g.result === 'loss') t.losses++;
    else t.draws++;
    byLevelMap.set(g.level, t);
  }
  const bestWinLevel = games.filter(g => g.result === 'win').reduce((m, g) => Math.max(m, g.level), 0);
  return {
    gamesPlayed: games.length,
    wins,
    losses,
    draws,
    winRate: games.length ? wins / games.length : 0,
    bestWinLevel,
    byLevel: [...byLevelMap.values()].sort((a, b) => a.level - b.level),
    recent: [...games].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, 20)
      .map(g => ({ result: g.result, finishedAt: g.finishedAt, level: g.level }))
  };
}
