/**
 * Achievements — pure logic, unit-tested. Definitions are data; evaluation
 * consumes aggregated player stats (kept in storage by the main process).
 */

export interface AchievementDef {
  id: string;
  icon: string; // chess glyph shown in the badge
  threshold: number; // progress value needed to unlock
  metric: keyof AchievementStats;
  ar: string;
  en: string;
}

export interface AchievementStats {
  gamesPlayed: number;
  wins: number;
  puzzlesSolved: number;
  lessonsCompleted: number;
  bestWinLevel: number; // highest engine level beaten (0 = none)
  totalMoves: number;
  castlesPerformed: number;
  enPassantCaptures: number;
  promotions: number;
  maxPuzzleStreak: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-game', icon: '♟', threshold: 1, metric: 'gamesPlayed', ar: 'أول مباراة — خضت أول مباراة لك', en: 'First game — you played your first game' },
  { id: 'first-win', icon: '♘', threshold: 1, metric: 'wins', ar: 'أول فوز — انتصارك الأول', en: 'First win — your first victory' },
  { id: 'ten-games', icon: '♗', threshold: 10, metric: 'gamesPlayed', ar: 'عشر مباريات — لاعب نشِط', en: 'Ten games — an active player' },
  { id: 'fifty-games', icon: '♖', threshold: 50, metric: 'gamesPlayed', ar: 'خمسون مباراة — مخضرم', en: 'Fifty games — veteran' },
  { id: 'win-level-5', icon: '♕', threshold: 5, metric: 'bestWinLevel', ar: 'هزيمة المستوى 5 — لاعب متقدم', en: 'Beating level 5 — advanced player' },
  { id: 'win-level-8', icon: '♛', threshold: 8, metric: 'bestWinLevel', ar: 'هزيمة الأستاذ الكبير — إنجاز استثنائي', en: 'Beating the Grandmaster level — exceptional' },
  { id: 'puzzles-10', icon: '⚔', threshold: 10, metric: 'puzzlesSolved', ar: 'حل 10 ألغاز — عين تكتيكية', en: '10 puzzles solved — tactical eye' },
  { id: 'puzzles-all', icon: '♚', threshold: 24, metric: 'puzzlesSolved', ar: 'حل كل الألغاز — قناص كش مات', en: 'All puzzles solved — checkmate sniper' },
  { id: 'streak-5', icon: '⚡', threshold: 5, metric: 'maxPuzzleStreak', ar: 'سلسلة 5 ألغاز متتالية', en: 'Streak of 5 puzzles in a row' },
  { id: 'academy-basics', icon: '🎓', threshold: 8, metric: 'lessonsCompleted', ar: 'إكمال دروس الأساسيات', en: 'Completing the basics lessons' },
  { id: 'castle-king', icon: '♜', threshold: 1, metric: 'castlesPerformed', ar: 'أول تبييت — ملكك في أمان', en: 'First castling — king to safety' },
  { id: 'en-passant', icon: '♟', threshold: 1, metric: 'enPassantCaptures', ar: 'أسر بالتجاوز — نقلة نادرة', en: 'En passant capture — a rare move' },
  { id: 'promotion', icon: '♛', threshold: 1, metric: 'promotions', ar: 'أول ترقية بيدق', en: 'First pawn promotion' },
  { id: 'moves-500', icon: '♞', threshold: 500, metric: 'totalMoves', ar: '500 نقلة لعبتها', en: '500 moves played' }
];

export interface UnlockedMap { [id: string]: string; } // id -> ISO date unlocked

/** Pure evaluation: returns newly-unlocked ids given stats and previous unlocks. */
export function evaluateAchievements(stats: AchievementStats, unlocked: UnlockedMap): string[] {
  const fresh: string[] = [];
  for (const def of ACHIEVEMENTS) {
    if (unlocked[def.id]) continue;
    if ((stats[def.metric] as number) >= def.threshold) fresh.push(def.id);
  }
  return fresh;
}
