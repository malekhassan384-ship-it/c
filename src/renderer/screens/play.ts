/** Play screen — vs-engine (8 levels) AND local two-player mode.
 *  v1.1.0: fixed stale-token bug that froze engine replies; professional
 *  chess.com-style layout with player cards, captured material, result modal.
 */
import { Game, START_FEN, uciToMove, moveToSan, moveToUci, Position, pieceType, pieceColor, onBoard, PAWN, KNIGHT, BISHOP, ROOK, QUEEN } from '../../chess';
import { BoardView } from '../components/board';
import { state, bridge, toast, openModal, el, saveSettings, emit } from '../state';
import { sounds } from '../../audio/synth';

type Mode = 'ai' | 'local';

interface LevelCfg { skill: number; movetime: number; depth?: number; blunder: number }

const LEVELS: LevelCfg[] = [
  { skill: 0, movetime: 150, depth: 2, blunder: 0.45 },
  { skill: 2, movetime: 200, depth: 3, blunder: 0.3 },
  { skill: 4, movetime: 260, depth: 4, blunder: 0.14 },
  { skill: 7, movetime: 340, depth: 6, blunder: 0.05 },
  { skill: 10, movetime: 500, depth: 8, blunder: 0 },
  { skill: 13, movetime: 750, depth: 11, blunder: 0 },
  { skill: 17, movetime: 1150, depth: 15, blunder: 0 },
  { skill: 20, movetime: 1600, depth: 20, blunder: 0 }
];

const PIECE_VAL: Record<number, number> = { [PAWN]: 1, [KNIGHT]: 3, [BISHOP]: 3, [ROOK]: 5, [QUEEN]: 9 };
const INIT_COUNT: Record<number, number> = { [PAWN]: 8, [KNIGHT]: 2, [BISHOP]: 2, [ROOK]: 2, [QUEEN]: 1, 6: 1 };
const GLYPHS: Record<number, string> = { 1: '\u265F', 2: '\u265E', 3: '\u265D', 4: '\u265C', 5: '\u265B', 6: '\u265A' };

interface CapturedInfo { captured: [number[], number[]]; adv: number }

function materialInfo(pos: Position): CapturedInfo {
  const counts: [Record<number, number>, Record<number, number>] = [{}, {}];
  for (let s = 0; s < 128; s++) {
    if (!onBoard(s)) continue;
    const p = pos.pieceAt(s);
    if (!p) continue;
    const c = pieceColor(p), t = pieceType(p);
    counts[c][t] = (counts[c][t] || 0) + 1;
  }
  const cap: [number[], number[]] = [[], []];
  for (const c of [0, 1] as const) {
    for (const t of [PAWN, KNIGHT, BISHOP, ROOK, QUEEN]) {
      const missing = INIT_COUNT[t] - (counts[c][t] || 0);
      for (let i = 0; i < missing; i++) cap[c].push(t);
    }
    cap[c].sort((a, b) => PIECE_VAL[b] - PIECE_VAL[a]);
  }
  let adv = 0;
  for (const t of [PAWN, KNIGHT, BISHOP, ROOK, QUEEN]) adv += ((counts[0][t] || 0) - (counts[1][t] || 0)) * PIECE_VAL[t];
  return { captured: cap, adv };
}

interface PlayState {
  game: Game;
  mode: Mode;
  playerColor: 0 | 1; // meaningful in ai mode
  level: number;      // 0 = local two players
  thinking: boolean;
  over: boolean;
  engineOk: boolean;
  token: number;
  started: boolean;
  specials: { castles: number; enPassant: number; promotions: number };
}

let ps: PlayState;
let board: BoardView;
let moveListBody: HTMLElement;
let statusText: HTMLElement;
let statusCard: HTMLElement;
let heroCard: HTMLElement;
let topCard: PlayerCard;
let bottomCard: PlayerCard;

interface PlayerCardHandle { root: HTMLElement; update(p: { glyph: string; name: string; sub: string; capturedGlyphs: number[]; adv: number | null; active: boolean; thinking: boolean }): void }
type PlayerCard = PlayerCardHandle;

function makePlayerCard(): PlayerCardHandle {
  const root = el('div', 'player-card');
  const av = el('div', 'pc-avatar', '♛');
  const mid = el('div', 'pc-mid');
  const name = el('div', 'pc-name', '');
  const sub = el('div', 'pc-sub', '');
  mid.append(name, sub);
  const cap = el('div', 'pc-cap');
  const adv = el('span', 'pc-adv', '');
  const dot = el('span', 'pc-dot');
  root.append(av, mid, cap, adv, dot);
  return {
    root,
    update(p) {
      av.textContent = p.glyph;
      name.textContent = p.name;
      sub.textContent = p.sub;
      cap.innerHTML = '';
      for (const t of p.capturedGlyphs) {
        const g = el('span', 'cap-glyph', GLYPHS[t]);
        cap.appendChild(g);
      }
      adv.textContent = p.adv !== null && p.adv > 0 ? `+${p.adv}` : '';
      root.classList.toggle('active', p.active);
      root.classList.toggle('thinking', p.thinking);
    }
  };
}

export function renderPlay(container: HTMLElement): void {
  container.innerHTML = '';
  const t = state.t;
  const head = el('div', 'page-head');
  head.appendChild(el('h1', '', t('app.play')));
  head.appendChild(el('div', 'sub', t('app.tagline')));
  container.appendChild(head);

  const grid = el('div', 'play-grid');
  const boardCol = el('div', 'board-col');
  topCard = makePlayerCard();
  board = new BoardView(boardCol);
  bottomCard = makePlayerCard();
  boardCol.append(topCard.root);
  boardCol.appendChild(bottomCard.root);
  // board renders between cards: reorder (top card, board host, bottom card)
  const boardHost = boardCol.querySelector('.board-wrap') as HTMLElement;
  boardCol.insertBefore(boardHost, bottomCard.root);

  const side = el('div', 'side-panel');

  statusCard = el('div', 'card status-card');
  statusText = el('div', 'status-text', '');
  statusCard.appendChild(statusText);

  heroCard = el('div', 'card hero-card');
  heroCard.style.display = 'none';

  const movesCard = el('div', 'card moves-card');
  const movesHead = el('div', 'moves-head', t('play.moves'));
  moveListBody = el('div', 'move-list');
  movesCard.append(movesHead, moveListBody);

  const actions = el('div', 'btn-row actions');
  const mkBtn = (label: string, icon: string, cls: string, fn: () => void): HTMLButtonElement => {
    const b = el('button', `btn ${cls}`) as HTMLButtonElement;
    if (icon) b.appendChild(el('span', 'b-ic', icon));
    b.appendChild(el('span', '', label));
    b.addEventListener('click', fn);
    actions.appendChild(b);
    return b;
  };
  mkBtn(t('play.newGame'), '＋', 'primary', () => showNewGameDialog());
  mkBtn(t('play.undo'), '↩', '', () => undoPly());
  mkBtn(t('play.hint'), '💡', '', () => requestHint());
  mkBtn(t('play.flipBoard'), '⇅', '', () => { void saveSettings({ boardFlipped: !state.settings.boardFlipped }); applyBoardOpts(); refreshCards(); });
  mkBtn(t('play.resign'), '⚑', 'danger', () => resign());

  side.append(statusCard, heroCard, movesCard, actions);
  grid.append(boardCol, side);
  container.appendChild(grid);

  ps = {
    game: new Game(),
    mode: 'ai',
    playerColor: 0,
    level: state.settings.defaultLevel,
    thinking: false,
    over: false,
    engineOk: true,
    token: 0,
    started: false,
    specials: { castles: 0, enPassant: 0, promotions: 0 }
  };

  void checkEngine();
  applyBoardOpts();
  refresh();
  showNewGameDialog();
}

function applyBoardOpts(): void {
  const s = state.settings;
  board.updateOpts({
    interactive: !ps.over && !ps.thinking && ps.started,
    flipped: ps.mode === 'ai' && ps.playerColor === 1 ? !s.boardFlipped : s.boardFlipped,
    showLegal: s.showLegalMoves,
    showCoords: s.showCoordinates,
    movableColor: ps.mode === 'ai' ? ps.playerColor : null,
    onUserMove: uci => void userMove(uci)
  });
}

async function checkEngine(): Promise<void> {
  const info = await bridge.engine.getInfo() as { name?: string; error?: string };
  if (info && (info as { error?: string }).error) {
    ps.engineOk = false;
    const banner = el('div', 'banner', state.t('play.engineOff'));
    statusCard.parentNode?.insertBefore(banner, statusCard.nextSibling);
  }
}

function showNewGameDialog(): void {
  const t = state.t;
  const { box, close } = openModal(t('play.newGame'));

  // opponent mode selector
  const modeRow = el('div', 'setting-row');
  modeRow.appendChild(el('div', 'lbl', t('play.mode')));
  const modeSel = el('select') as HTMLSelectElement;
  const oAI = el('option', '', t('play.vsComputer')) as HTMLOptionElement; oAI.value = 'ai';
  const oLocal = el('option', '', t('play.twoPlayers')) as HTMLOptionElement; oLocal.value = 'local';
  modeSel.append(oAI, oLocal);
  modeSel.value = ps.mode;
  modeRow.appendChild(modeSel);
  box.appendChild(modeRow);

  const sideRow = el('div', 'setting-row');
  const lvlRow = el('div', 'setting-row');
  const syncMode = (): void => {
    const ai = modeSel.value === 'ai';
    sideRow.style.display = ai ? '' : 'none';
    lvlRow.style.display = ai ? '' : 'none';
  };

  const sideLbl = el('div', 'lbl', t('play.yourSide'));
  const sideSel = el('select') as HTMLSelectElement;
  for (const [v, label] of [['white', t('play.white')], ['black', t('play.black')], ['random', t('play.random')]] as Array<[string, string]>) {
    const o = el('option', '', label) as HTMLOptionElement;
    o.value = v;
    sideSel.appendChild(o);
  }
  sideSel.value = 'white';
  sideRow.append(sideLbl, sideSel);

  const lvlLbl = el('div', 'lbl', t('play.level'));
  const lvlSel = el('select') as HTMLSelectElement;
  for (let i = 1; i <= 8; i++) {
    const o = el('option', '', `${i} — ${t(`levels.${i}`)}`) as HTMLOptionElement;
    o.value = String(i);
    lvlSel.appendChild(o);
  }
  lvlSel.value = String(state.settings.defaultLevel);
  lvlRow.append(lvlLbl, lvlSel);

  modeSel.addEventListener('change', syncMode);
  syncMode();

  const startBtn = el('button', 'btn primary', t('play.newGame')) as HTMLButtonElement;
  startBtn.style.marginTop = '14px';
  startBtn.style.width = '100%';
  startBtn.addEventListener('click', () => {
    const ai = modeSel.value === 'ai';
    const sideVal = sideSel.value;
    const color: 0 | 1 = sideVal === 'black' ? 1 : sideVal === 'random' ? (Math.random() < 0.5 ? 0 : 1) : 0;
    startGame(ai ? 'ai' : 'local', ai ? color : 0, ai ? Number(lvlSel.value) : 0);
    close();
  });
  box.append(sideRow, lvlRow, startBtn);
}

function startGame(mode: Mode, color: 0 | 1, level: number): void {
  ps.game = new Game();
  ps.mode = mode;
  ps.playerColor = color;
  ps.level = level;
  ps.over = false;
  ps.thinking = false;
  ps.started = true;
  ps.token++;
  ps.specials = { castles: 0, enPassant: 0, promotions: 0 };
  heroCard.style.display = 'none';
  board.clearLast();
  board.clearHint();
  applyBoardOpts();
  refresh();
  if (mode === 'ai' && ps.game.position.turn !== color) void engineTurn();
}

function refresh(): void {
  const t = state.t;
  board.setPosition(ps.game.position, {});
  refreshCards();
  // status text
  const pos = ps.game.position;
  if (!ps.started) statusText.textContent = '—';
  else if (ps.over) statusText.textContent = '';
  else if (ps.thinking) { statusText.textContent = t('play.thinking'); statusText.classList.add('thinking-dots'); }
  else {
    statusText.classList.remove('thinking-dots');
    statusText.textContent = pos.inCheck() ? `${t('play.turn')}: ${pos.turn === 0 ? t('play.white') : t('play.black')} — ${t('play.check')}` : `${t('play.turn')}: ${pos.turn === 0 ? t('play.white') : t('play.black')}`;
  }
  // move list
  moveListBody.innerHTML = '';
  const sans = ps.game.sanMoves;
  for (let i = 0; i < sans.length; i += 2) {
    const row = el('div', 'move-row');
    row.appendChild(el('span', 'num', `${i / 2 + 1}.`));
    const w = el('span', 'mv' + (i === sans.length - 1 ? ' latest' : ''), sans[i]);
    const b = el('span', 'mv' + (i + 1 === sans.length - 1 ? ' latest' : ''), sans[i + 1] ?? '');
    row.append(w, b);
    moveListBody.appendChild(row);
  }
  moveListBody.scrollTop = moveListBody.scrollHeight;
}

function refreshCards(): void {
  const t = state.t;
  const pos = ps.game.position;
  const mat = materialInfo(pos);
  const whiteBottom = ps.mode === 'local' ? !state.settings.boardFlipped : ps.playerColor === 0 ? !state.settings.boardFlipped : state.settings.boardFlipped;
  const topColor: 0 | 1 = whiteBottom ? 1 : 0;
  const bottomColor: 0 | 1 = whiteBottom ? 0 : 1;
  const info = (c: 0 | 1): { glyph: string; name: string; sub: string; capturedGlyphs: number[]; adv: number | null; active: boolean; thinking: boolean } => {
    // captured[0] = pieces WHITE captured (black pieces missing) → shown on white's card
    const capturedBy = c === 0 ? mat.captured[0] : mat.captured[1];
    const myAdv = c === 0 ? mat.adv : -mat.adv;
    const isTurn = ps.started && !ps.over && pos.turn === c;
    let name: string, sub: string;
    if (ps.mode === 'local') {
      name = c === 0 ? t('play.playerWhite') : t('play.playerBlack');
      sub = '';
    } else if (c === ps.playerColor) {
      name = t('play.you');
      sub = c === 0 ? t('play.white') : t('play.black');
    } else {
      name = `${t('play.engineName')} · ${t(`levels.${ps.level}`)}`;
      sub = c === 0 ? t('play.white') : t('play.black');
    }
    const thinking = ps.mode === 'ai' && c !== ps.playerColor && ps.thinking && isTurn;
    return { glyph: c === 0 ? '♔' : '♚', name, sub, capturedGlyphs: capturedBy, adv: myAdv > 0 ? myAdv : null, active: isTurn, thinking };
  };
  topCard.update(info(topColor));
  bottomCard.update(info(bottomColor));
}

async function userMove(uci: string): Promise<void> {
  if (ps.over || ps.thinking || !ps.started) return;
  if (ps.mode === 'ai' && ps.game.position.turn !== ps.playerColor) return;
  const m = uciToMove(ps.game.position, uci);
  if (!m) return;
  applySound(m.flags, ps.game.position.pieceAt(m.to) !== 0);
  ps.game.playUci(uci);
  board.setLastMove(m.from, m.to);
  applyBoardOpts();
  refresh();
  const out = ps.game.outcome();
  if (out.over) { finish(out.winner!, out.reason!); return; }
  if (ps.mode === 'ai') void engineTurn();
}

async function engineTurn(): Promise<void> {
  if (!ps.engineOk || ps.over) return;
  ps.thinking = true;
  applyBoardOpts();
  refresh();
  const cfg = LEVELS[ps.level - 1];
  const token = ++ps.token;
  const fen = ps.game.startFen === START_FEN ? 'startpos' : ps.game.startFen;
  const res = await bridge.engine.analyze({
    fen, moves: ps.game.uciMoves,
    movetime: cfg.movetime, depth: cfg.depth, skill: cfg.skill, token
  }) as { bestmove?: string; error?: string };
  ps.thinking = false;
  if (res.error || !res.bestmove) {
    toast(state.t('common.error'), 'err');
    applyBoardOpts(); refresh();
    return;
  }
  // v1.1.0 FIX: stale = token CHANGED since we captured it (new game started etc).
  if (ps.token !== token) { applyBoardOpts(); refresh(); return; }
  // low levels: occasionally play a random legal move instead (beginner feel)
  let uci = res.bestmove;
  if (cfg.blunder > 0 && Math.random() < cfg.blunder) {
    const legal = ps.game.legalMoves();
    if (legal.length) uci = moveToUci(legal[Math.floor(Math.random() * legal.length)]);
  }
  const mv = uciToMove(ps.game.position, uci);
  if (!mv) { toast(state.t('common.error'), 'err'); applyBoardOpts(); refresh(); return; }
  applySound(mv.flags, ps.game.position.pieceAt(mv.to) !== 0);
  ps.game.playUci(uci);
  board.setLastMove(mv.from, mv.to);
  applyBoardOpts();
  refresh();
  const out = ps.game.outcome();
  if (out.over) { finish(out.winner!, out.reason!); return; }
}

function applySound(flags: number, isCapture: boolean): void {
  if (flags === 2 || flags === 3) { sounds.castle(); ps.specials.castles++; }
  else if (flags === 1) { sounds.capture(); ps.specials.enPassant++; }
  else if (isCapture) sounds.capture();
  else sounds.move();
}

async function requestHint(): Promise<void> {
  if (!ps.started || ps.over || ps.thinking) return;
  if (ps.mode === 'ai' && !ps.engineOk) { toast(state.t('play.engineOff'), 'err'); return; }
  const fen = ps.game.startFen === START_FEN ? 'startpos' : ps.game.startFen;
  const res = await bridge.engine.analyze({ fen, moves: ps.game.uciMoves, movetime: 900, skill: 20, token: ++ps.token }) as { bestmove?: string; error?: string };
  if (res.error || !res.bestmove) { toast(state.t('play.engineOff'), 'err'); return; }
  const m = uciToMove(ps.game.position, res.bestmove);
  if (m) {
    board.setHint([m.from, m.to]);
    const san = moveToSan(ps.game.position, m);
    toast(`${state.t('play.hintMove')}: ${san}`, 'gold');
    setTimeout(() => board.clearHint(), 2500);
  }
}

function undoPly(): void {
  if (!ps.started || ps.thinking || ps.over) return;
  if (ps.mode === 'local') {
    ps.game.undo();
  } else {
    // vs engine: undo engine reply + own move when possible
    ps.game.undo();
    if (ps.game.uciMoves.length && ps.game.position.turn !== ps.playerColor) ps.game.undo();
  }
  board.clearLast();
  board.clearHint();
  applyBoardOpts();
  refresh();
}

function resign(): void {
  if (!ps.started || ps.over) return;
  const t = state.t;
  const { box, close } = openModal(t('play.confirmResign'));
  const row = el('div', 'btn-row');
  row.style.justifyContent = 'flex-end';
  const yes = el('button', 'btn danger', t('play.yes')) as HTMLButtonElement;
  const no = el('button', 'btn ghost', t('play.no')) as HTMLButtonElement;
  yes.addEventListener('click', () => {
    close();
    // resigning side: the side to move (in ai mode always the human)
    const resigning = ps.mode === 'ai' ? ps.playerColor : ps.game.position.turn;
    finish(resigning === 0 ? 'black' : 'white', 'resignation');
  });
  no.addEventListener('click', close);
  row.append(yes, no);
  box.appendChild(row);
}

async function finish(winner: 'white' | 'black' | 'draw', reason: string): Promise<void> {
  ps.over = true;
  ps.thinking = false;
  applyBoardOpts();
  const t = state.t;
  let result: 'win' | 'loss' | 'draw';
  if (winner === 'draw') result = 'draw';
  else if (ps.mode === 'local') result = winner === 'white' ? 'win' : 'loss'; // stored from white's perspective
  else result = (winner === 'white') === (ps.playerColor === 0) ? 'win' : 'loss';

  const reasonKey: Record<string, string> = {
    checkmate: t('play.checkmate'), stalemate: t('play.stalemate'), resignation: t('play.resign'),
    'fifty-move': t('play.fiftyMove'), threefold: t('play.threefold'), 'insufficient-material': t('play.insufficient')
  };

  try {
    await bridge.history.save({
      id: 'pending', finishedAt: new Date().toISOString(),
      playerColor: 'white', // local games recorded from white's perspective
      level: ps.mode === 'local' ? 0 : ps.level,
      result, reason, sanMoves: ps.game.sanMoves, uciMoves: ps.game.uciMoves,
      startFen: ps.game.startFen, specials: ps.specials
    });
  } catch { /* storage failure must not block UX */ }
  if (result === 'win') sounds.win();
  else if (result === 'loss') sounds.lose();
  else sounds.draw();
  emit('game:finished');

  // result modal
  const { box, close } = openModal('');
  const hero = el('div', 'result-hero');
  const titleMsg = ps.mode === 'local'
    ? (winner === 'draw' ? t('play.draw') : winner === 'white' ? t('play.whiteWins') : t('play.blackWins'))
    : (result === 'win' ? t('play.youWin') : result === 'loss' ? t('play.youLose') : t('play.draw'));
  hero.appendChild(el('div', 'big', result === 'win' ? '♛' : result === 'loss' ? '♚' : '½–½'));
  hero.appendChild(el('div', 'msg', titleMsg));
  hero.appendChild(el('div', 'why', reasonKey[reason] ?? reason));
  const again = el('button', 'btn primary', t('play.playAgain')) as HTMLButtonElement;
  again.style.marginTop = '12px';
  again.addEventListener('click', () => { close(); showNewGameDialog(); });
  const review = el('button', 'btn ghost', t('common.close')) as HTMLButtonElement;
  review.style.marginTop = '6px';
  review.addEventListener('click', close);
  hero.appendChild(again);
  hero.appendChild(review);
  box.appendChild(hero);
  refresh();
}

/** Automation hook (used by scripts/smoke.mjs --play): starts an AI game as
 *  White (level 1), plays e2e4, and resolves once the ENGINE has replied —
 *  proving end-to-end that engine moves are applied to the board/game. */
export function autoplayEngineTest(): Promise<{ moves: number }> {
  return new Promise(resolve => {
    startGame('ai', 0, 1);
    setTimeout(() => { void userMove('e2e4'); }, 400);
    const t0 = Date.now();
    const check = (): void => {
      const n = ps.game.uciMoves.length;
      if (n >= 2) { resolve({ moves: n }); return; }
      if (Date.now() - t0 > 25000) { resolve({ moves: n }); return; }
      setTimeout(check, 250);
    };
    setTimeout(check, 600);
  });
}
