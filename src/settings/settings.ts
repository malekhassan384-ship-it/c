export interface AppSettings {
  language: 'ar' | 'en';
  theme: 'professional' | 'midnight-gold' | 'emerald-night' | 'crimson-dusk';
  soundEnabled: boolean;
  soundVolume: number; // 0..1
  showLegalMoves: boolean;
  showCoordinates: boolean;
  confirmMoves: boolean; // require second click on target square
  defaultLevel: number; // 1..8 engine strength
  boardFlipped: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'ar',
  theme: 'professional',
  soundEnabled: true,
  soundVolume: 0.7,
  showLegalMoves: true,
  showCoordinates: true,
  confirmMoves: false,
  defaultLevel: 3,
  boardFlipped: false
};

export const THEMES: Array<AppSettings['theme']> = ['professional', 'midnight-gold', 'emerald-night', 'crimson-dusk'];

export function sanitizeSettings(input: unknown): AppSettings {
  const out = { ...DEFAULT_SETTINGS };
  if (!input || typeof input !== 'object') return out;
  const v = input as Partial<AppSettings>;
  if (v.language === 'ar' || v.language === 'en') out.language = v.language;
  if (typeof v.theme === 'string' && (THEMES as string[]).includes(v.theme)) out.theme = v.theme as AppSettings['theme'];
  if (typeof v.soundEnabled === 'boolean') out.soundEnabled = v.soundEnabled;
  if (typeof v.soundVolume === 'number' && v.soundVolume >= 0 && v.soundVolume <= 1) out.soundVolume = v.soundVolume;
  if (typeof v.showLegalMoves === 'boolean') out.showLegalMoves = v.showLegalMoves;
  if (typeof v.showCoordinates === 'boolean') out.showCoordinates = v.showCoordinates;
  if (typeof v.confirmMoves === 'boolean') out.confirmMoves = v.confirmMoves;
  if (typeof v.defaultLevel === 'number' && v.defaultLevel >= 1 && v.defaultLevel <= 8) out.defaultLevel = Math.floor(v.defaultLevel);
  if (typeof v.boardFlipped === 'boolean') out.boardFlipped = v.boardFlipped;
  return out;
}
