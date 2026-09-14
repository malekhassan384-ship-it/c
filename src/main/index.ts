/**
 * Chess Vanguard — Electron main process.
 * © 2026 Malek Hassan Ashour — All Rights Reserved.
 *
 * Security baseline: contextIsolation ON, nodeIntegration OFF, sandbox ON,
 * strict CSP, allowlisted IPC channels with manual payload validation.
 */
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import { JsonStore, uuid } from '../storage/jsonStore';
import { DEFAULT_SETTINGS, sanitizeSettings, AppSettings } from '../settings/settings';
import { EngineManager } from '../engine/engineManager';
import { ACHIEVEMENTS, evaluateAchievements, AchievementStats } from '../achievements/definitions';
import type { GameRecord } from '../statistics/stats';

// ── single instance ────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  bootstrap();
}

let mainWindow: BrowserWindow | null = null;
const engineManager = new EngineManager();

// ── persistence (userData dir) ─────────────────────────────────────────────
const dataDir = () => app.getPath('userData');
const settingsStore = () => new JsonStore<AppSettings>(dataDir(), 'settings', DEFAULT_SETTINGS);
const gamesStore = () => new JsonStore<{ games: GameRecord[] }>(dataDir(), 'games', { games: [] });
const achievementsStore = () => new JsonStore<{ unlocked: Record<string, string>; counters: AchievementStats }>(dataDir(), 'achievements', {
  unlocked: {},
  counters: { gamesPlayed: 0, wins: 0, puzzlesSolved: 0, lessonsCompleted: 0, bestWinLevel: 0, totalMoves: 0, castlesPerformed: 0, enPassantCaptures: 0, promotions: 0, maxPuzzleStreak: 0 }
});
const progressStore = () => new JsonStore<{ solvedPuzzles: string[]; completedLessons: string[]; puzzleStreak: number }>(dataDir(), 'progress', { solvedPuzzles: [], completedLessons: [], puzzleStreak: 0 });

// ── validation helpers (manual, no user input reaches fs/paths) ────────────
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][nbrq]?$/;
const FEN_OK = (fen: unknown): fen is string => typeof fen === 'string' && fen.length < 100 && /^[pnbrqkPNBRQK1-8/]+( [wb] )(K?Q?k?q?|-)( [a-h][1-8]| -)( \d+)( \d+)$/.test(fen);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length < 10_000;
const clampCount = (v: unknown): number => Math.min(200, Math.max(0, Math.floor(Number(v) || 0)));

function registerIpc(): void {
  // settings
  ipcMain.handle('settings:get', async () => await settingsStore().load());
  ipcMain.handle('settings:set', async (_e, raw: unknown) => {
    const next = sanitizeSettings(raw);
    await settingsStore().save(next);
    return next;
  });

  // games history
  ipcMain.handle('history:list', async () => (await gamesStore().load()).games.slice().reverse());
  ipcMain.handle('history:save', async (_e, raw: unknown) => {
    const g = raw as Partial<GameRecord>;
    if (!isStr(g.id) || !isStr(g.finishedAt) || !isStr(g.playerColor) || !isStr(g.result) || !isStr(g.reason) ||
      typeof g.level !== 'number' || !Array.isArray(g.sanMoves) || !Array.isArray(g.uciMoves)) throw new Error('invalid game record');
    const store = gamesStore();
    const cur = await store.load();
    const record: GameRecord = {
      id: uuid(), finishedAt: new Date().toISOString(), playerColor: g.playerColor === 'black' ? 'black' : 'white',
      level: Math.min(8, Math.max(0, Math.floor(g.level))), result: g.result === 'win' ? 'win' : g.result === 'draw' ? 'draw' : 'loss',
      reason: g.reason,
      sanMoves: g.sanMoves.filter(isStr).slice(0, 1000),
      uciMoves: g.uciMoves.filter(m => UCI_MOVE.test(String(m))).slice(0, 1000),
      startFen: isStr(g.startFen) ? g.startFen : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      specials: {
        castles: clampCount((g.specials as { castles?: unknown } | undefined)?.castles),
        enPassant: clampCount((g.specials as { enPassant?: unknown } | undefined)?.enPassant),
        promotions: clampCount((g.specials as { promotions?: unknown } | undefined)?.promotions)
      }
    };
    await store.save({ games: [...cur.games, record] });
    await bumpCounters({
      gamesPlayed: 1,
      wins: record.result === 'win' ? 1 : 0,
      bestWinLevel: record.result === 'win' ? record.level : 0,
      totalMoves: record.sanMoves.length,
      castlesPerformed: record.specials?.castles ?? 0,
      enPassantCaptures: record.specials?.enPassant ?? 0,
      promotions: record.specials?.promotions ?? 0
    });
    return record;
  });
  ipcMain.handle('history:delete', async (_e, id: unknown) => {
    if (!isStr(id)) throw new Error('invalid id');
    const store = gamesStore();
    const cur = await store.load();
    await store.save({ games: cur.games.filter(g => g.id !== id) });
    return true;
  });

  // progress (puzzles + lessons)
  ipcMain.handle('progress:get', async () => await progressStore().load());
  ipcMain.handle('progress:puzzleSolved', async (_e, raw: unknown) => {
    const p = raw as { puzzleId?: unknown; streak?: unknown; failed?: unknown };
    if (!isStr(p.puzzleId)) throw new Error('invalid puzzle id');
    const store = progressStore();
    const cur = await store.load();
    if (!cur.solvedPuzzles.includes(p.puzzleId)) cur.solvedPuzzles.push(p.puzzleId);
    const failed = p.failed === true;
    cur.puzzleStreak = failed ? 0 : cur.puzzleStreak + 1;
    await store.save(cur);
    await bumpCounters({
      puzzlesSolved: cur.solvedPuzzles.includes(p.puzzleId) && !failed ? 1 : 0,
      maxPuzzleStreak: cur.puzzleStreak
    });
    return cur;
  });
  ipcMain.handle('progress:lessonCompleted', async (_e, raw: unknown) => {
    const p = raw as { lessonId?: unknown };
    if (!isStr(p.lessonId)) throw new Error('invalid lesson id');
    const store = progressStore();
    const cur = await store.load();
    if (!cur.completedLessons.includes(p.lessonId)) cur.completedLessons.push(p.lessonId);
    await store.save(cur);
    await bumpCounters({ lessonsCompleted: cur.completedLessons.length });
    return cur;
  });
  ipcMain.handle('progress:reset', async () => {
    await progressStore().clear();
    return true;
  });

  // achievements
  ipcMain.handle('achievements:get', async () => {
    const a = await achievementsStore().load();
    return { unlocked: a.unlocked, counters: a.counters, defs: ACHIEVEMENTS };
  });

  // engine
  ipcMain.handle('engine:getInfo', async () => {
    try {
      return await engineManager.ensureStarted();
    } catch (e) {
      return { error: String(e) };
    }
  });
  ipcMain.handle('engine:analyze', async (_e, raw: unknown) => {
    const r = raw as { fen?: unknown; moves?: unknown; movetime?: unknown; depth?: unknown; skill?: unknown; token?: unknown };
    const moves = Array.isArray(r.moves) ? r.moves.filter(m => UCI_MOVE.test(String(m))).slice(0, 1000) : [];
    if (r.fen !== 'startpos' && !FEN_OK(r.fen)) throw new Error('invalid fen');
    const token = typeof r.token === 'number' ? r.token : 0;
    const go = {
      movetime: typeof r.movetime === 'number' ? Math.min(5000, Math.max(50, r.movetime)) : undefined,
      depth: typeof r.depth === 'number' ? Math.min(20, Math.max(1, r.depth)) : undefined,
      skill: typeof r.skill === 'number' ? Math.min(20, Math.max(0, r.skill)) : undefined
    };
    try {
      return await engineManager.analyze({ fen: r.fen as string, moves, go, token }, 30000);
    } catch (e) {
      return { error: String(e) };
    }
  });
  ipcMain.handle('engine:stop', () => { engineManager.stop(); return true; });

  // app meta / data reset
  ipcMain.handle('app:getMeta', () => ({
    version: app.getVersion(),
    platform: process.platform,
    copyright: 'Copyright © 2026 Malek Hassan Ashour — All Rights Reserved.',
    developer: 'Malek Hassan Ashour',
    licenseFile: 'THIRD_PARTY_LICENSES.md'
  }));
  ipcMain.handle('app:resetData', async (e) => {
    if (!mainWindow || e.sender !== mainWindow.webContents) throw new Error('forbidden');
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'warning', buttons: ['Cancel', 'Delete'], defaultId: 0, cancelId: 0, message: 'Delete ALL local data?'
    });
    if (choice.response !== 1) return false;
    await gamesStore().clear();
    await progressStore().clear();
    await achievementsStore().clear();
    return true;
  });
  ipcMain.handle('app:openLicense', async () => {
    try {
      const base = app.isPackaged ? path.join(process.resourcesPath, 'engines') : path.join(app.getAppPath(), 'resources', 'engines');
      const text = await readFile(path.join(base, 'NOTICE.txt'), 'utf-8');
      return text;
    } catch {
      return 'Chess Vanguard uses the Stockfish chess engine (GPLv3) as an independent external process.\nSource: https://github.com/official-stockfish/Stockfish';
    }
  });
}

async function bumpCounters(delta: Partial<AchievementStats>): Promise<void> {
  const store = achievementsStore();
  const cur = await store.load();
  const c = { ...cur.counters };
  for (const [k, v] of Object.entries(delta)) {
    if (k === 'bestWinLevel' || k === 'maxPuzzleStreak') c[k] = Math.max(c[k], v as number);
    else (c as Record<string, number>)[k] = ((c as Record<string, number>)[k] ?? 0) + (v as number);
  }
  const fresh = evaluateAchievements(c, cur.unlocked);
  const now = new Date().toISOString();
  for (const id of fresh) cur.unlocked[id] = now;
  await store.save({ unlocked: cur.unlocked, counters: c });
  if (fresh.length && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('achievements:unlocked', fresh);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#0b0e14',
    show: false,
    title: 'Chess Vanguard',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // hard navigation & window-open policy
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost:')) e.preventDefault();
  });

  if (process.argv.includes('--smoke-play')) {
    void mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), { hash: 'autoplay' });
    const t = setTimeout(() => { console.error('AUTOPLAY_TIMEOUT'); app.exit(1); }, 70000);
    mainWindow.webContents.on('console-message', (...args: unknown[]) => {
      const msg = typeof args[2] === 'string' ? args[2] : String((args[0] as { message?: string })?.message ?? '');
      if (msg.startsWith('AUTOPLAY_RESULT:')) {
        clearTimeout(t);
        const moves = Number(msg.split('=')[1] || 0);
        const pass = moves >= 2;
        console.log(`${pass ? 'AUTOPLAY_PASS' : 'AUTOPLAY_FAIL'} moves=${moves}`);
        app.exit(pass ? 0 : 1);
      }
    });
  } else if (app.isPackaged || !process.env.CV_DEV_SERVER_URL) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  } else {
    mainWindow.loadURL(process.env.CV_DEV_SERVER_URL);
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  // ── smoke test mode (CI): renderer signals readiness, we exit 0 ────────
  if (process.argv.includes('--smoke')) {
    const t = setTimeout(() => { console.error('SMOKE_TIMEOUT'); app.exit(1); }, 45000);
    ipcMain.once('app:ready', () => {
      clearTimeout(t);
      console.log('SMOKE_OK window=' + (mainWindow !== null) + ' renderer=ready');
      app.exit(0);
    });
  }
}

function bootstrap(): void {
  app.setAppUserModelId('com.malekashour.chessvanguard');

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    void engineManager.shutdown();
  });
}
