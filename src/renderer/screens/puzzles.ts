/** Puzzles screen — free training + 3-minute Rush mode (score/streak/penalty). */
import puzzlesJson from '../../puzzles/puzzles.json';
import { Position, uciToMove, moveToUci } from '../../chess';
import { mateInMoves } from '../../chess/solver';
import type { Puzzle } from '../../puzzles/puzzle';
import { BoardView } from '../components/board';
import { state, bridge, el, toast, openModal } from '../state';
import { sounds } from '../../audio/synth';

const DATA = puzzlesJson as { puzzles: Puzzle[] };
const RUSH_SECONDS = 180;
const RUSH_PENALTY = 10;

interface PzState {
  idx: number;
  pos: Position;
  movesLeft: number;
  solving: boolean;
}

let pz: PzState;
let board: BoardView;
let fb: HTMLElement;
let counter: HTMLElement;
let sideInfoCard: HTMLElement;

// rush state
let rush = {
  active: false,
  timeLeft: 0,
  score: 0,
  streak: 0,
  best: 0,
  solvedInRush: 0,
  order: [] as number[],
  ptr: 0,
  timerId: null as ReturnType<typeof setInterval> | null
};
let rushTimerEl: HTMLElement | null = null;
let rushScoreEl: HTMLElement | null = null;
let rushStreakEl: HTMLElement | null = null;

export async function renderPuzzles(container: HTMLElement): Promise<void> {
  stopRushTimer();
  container.innerHTML = '';
  const t = state.t;
  const prog = await bridge.progress.get();
  const solved = new Set(prog.solvedPuzzles);

  const head = el('div', 'page-head');
  head.appendChild(el('h1', '', t('puzzles.title')));
  head.appendChild(el('div', 'sub', t('puzzles.subtitle')));
  container.appendChild(head);

  const top = el('div', 'puzzle-top');
  const chips = el('div', 'chips');
  counter = el('span', 'chip gold', `${t('puzzles.solvedCount')}: ${solved.size} / ${t('puzzles.totalCount')}: ${DATA.puzzles.length}`);
  chips.appendChild(counter);

  const modeTraining = el('button', 'chip chip-btn', t('puzzles.modeTraining')) as HTMLButtonElement;
  const modeRush = el('button', 'chip chip-btn', t('puzzles.modeRush')) as HTMLButtonElement;
  modeTraining.addEventListener('click', () => { exitRush(container); });
  modeRush.addEventListener('click', () => { void startRush(container); });
  chips.append(modeTraining, modeRush);
  top.appendChild(chips);

  const actions = el('div', 'btn-row');
  const resetBtn = el('button', 'btn sm danger', t('puzzles.reset')) as HTMLButtonElement;
  resetBtn.addEventListener('click', () => {
    const { box, close } = openModal(t('settings.resetConfirm'));
    const row = el('div', 'btn-row');
    row.style.justifyContent = 'flex-end';
    const yes = el('button', 'btn danger', t('common.ok')) as HTMLButtonElement;
    const no = el('button', 'btn ghost', t('common.cancel')) as HTMLButtonElement;
    yes.addEventListener('click', async () => { await bridge.progress.reset(); close(); await renderPuzzles(container); });
    no.addEventListener('click', close);
    row.append(yes, no);
    box.appendChild(row);
  });
  const prev = el('button', 'btn sm ghost', '◀') as HTMLButtonElement;
  const next = el('button', 'btn sm ghost', '▶') as HTMLButtonElement;
  prev.addEventListener('click', () => { if (!rush.active) { pz.idx = (pz.idx - 1 + DATA.puzzles.length) % DATA.puzzles.length; loadPuzzle(); } });
  next.addEventListener('click', () => { if (!rush.active) { pz.idx = (pz.idx + 1) % DATA.puzzles.length; loadPuzzle(); } });
  actions.append(prev, next, resetBtn);
  top.appendChild(actions);
  container.appendChild(top);

  // rush bar (hidden until rush starts)
  const rushBar = el('div', 'card rush-bar');
  rushBar.style.display = 'none';
  rushTimerEl = el('span', 'rush-timer', '3:00');
  rushScoreEl = el('span', 'rush-score', '');
  rushStreakEl = el('span', 'rush-streak', '');
  const quit = el('button', 'btn sm ghost', t('puzzles.rushExit')) as HTMLButtonElement;
  quit.addEventListener('click', () => exitRush(container));
  rushBar.append(rushTimerEl, rushScoreEl, rushStreakEl, quit);
  container.appendChild(rushBar);

  const grid = el('div', 'play-grid');
  const boardCol = el('div', 'board-col');
  const side = el('div', 'side-panel');
  board = new BoardView(boardCol);
  fb = el('div', 'feedback');
  sideInfoCard = el('div', 'card');
  const hintBtn = el('button', 'btn sm ghost', t('puzzles.hint')) as HTMLButtonElement;
  hintBtn.addEventListener('click', () => showHint());
  side.append(sideInfoCard, fb, hintBtn);
  grid.append(boardCol, side);
  container.appendChild(grid);

  pz = { idx: 0, pos: new Position(), movesLeft: 1, solving: false };
  const firstUnsolved = DATA.puzzles.findIndex(p => !solved.has(p.id));
  pz.idx = firstUnsolved >= 0 ? firstUnsolved : 0;
  loadPuzzle();
}

function loadPuzzle(): void {
  const t = state.t;
  const puzzle = DATA.puzzles[pz.idx];
  pz.pos = Position.fromFEN(puzzle.fen);
  pz.movesLeft = puzzle.mateIn;
  pz.solving = true;
  fb.className = 'feedback';
  fb.textContent = rush.active ? t('puzzles.yourTurn') : t('puzzles.yourTurn');
  sideInfoCard.innerHTML = '';
  sideInfoCard.appendChild(el('h2', '', `${puzzle.id} — ${puzzle.mateIn === 1 ? t('puzzles.mateIn1') : t('puzzles.mateIn2')}`));
  const meta = el('div', '', `★ ${puzzle.difficulty}`);
  meta.style.color = 'var(--muted)';
  meta.style.fontSize = '12.5px';
  meta.style.marginBottom = '8px';
  sideInfoCard.appendChild(meta);
  sideInfoCard.appendChild(el('p', '', t('puzzles.subtitle')));

  board.setPosition(pz.pos, {
    interactive: true,
    flipped: state.settings.boardFlipped,
    showLegal: state.settings.showLegalMoves,
    showCoords: state.settings.showCoordinates,
    onUserMove: uci => onMove(uci, puzzle)
  });
}

function onMove(uci: string, puzzle: Puzzle): void {
  const t = state.t;
  const m = uciToMove(pz.pos, uci);
  if (!m) return;
  const sols = mateInMoves(pz.pos, pz.movesLeft).map(moveToUci);
  if (!sols.includes(uci)) {
    sounds.wrong();
    fb.className = 'feedback err';
    fb.textContent = rush.active ? `${t('puzzles.wrong')} (${t('puzzles.wrongRush')})` : t('puzzles.wrong');
    if (rush.active) {
      rush.streak = 0;
      rush.timeLeft = Math.max(0, rush.timeLeft - RUSH_PENALTY);
      updateRushBar();
      if (rush.timeLeft <= 0) endRush(false);
    } else {
      void bridge.progress.puzzleSolved({ puzzleId: puzzle.id, failed: true });
    }
    board.setPosition(pz.pos, {
      interactive: true, flipped: state.settings.boardFlipped,
      showLegal: state.settings.showLegalMoves, showCoords: state.settings.showCoordinates,
      onUserMove: u => onMove(u, puzzle)
    });
    return;
  }
  pz.pos.make(m);
  board.setPosition(pz.pos, { interactive: false, flipped: state.settings.boardFlipped, showCoords: state.settings.showCoordinates });
  board.setLastMove(m.from, m.to);
  sounds.move();
  pz.movesLeft--;

  const outcome = checkMate();
  if (outcome === 'mate') { solved(puzzle); return; }
  if (outcome === 'nowhere') {
    fb.className = 'feedback err';
    fb.textContent = t('common.error');
    return;
  }
  const replies = pz.pos.generateMoves();
  const reply = replies[Math.floor(Math.random() * replies.length)];
  pz.pos.make(reply);
  setTimeout(() => {
    board.setPosition(pz.pos, {
      interactive: true, flipped: state.settings.boardFlipped,
      showLegal: state.settings.showLegalMoves, showCoords: state.settings.showCoordinates,
      onUserMove: u => onMove(u, puzzle)
    });
    board.setLastMove(reply.from, reply.to);
  }, 320);
}

function checkMate(): 'mate' | 'nowhere' | 'continue' {
  const moves = pz.pos.generateMoves();
  if (moves.length === 0) return pz.pos.inCheck() ? 'mate' : 'nowhere';
  return 'continue';
}

async function solved(puzzle: Puzzle): Promise<void> {
  const t = state.t;
  sounds.correct();
  fb.className = 'feedback ok';
  fb.textContent = t('puzzles.solved');

  if (rush.active) {
    rush.solvedInRush++;
    rush.streak++;
    rush.best = Math.max(rush.best, rush.streak);
    rush.score += 100 + (rush.streak - 1) * 20;
    updateRushBar();
    try { await bridge.progress.puzzleSolved({ puzzleId: puzzle.id }); } catch { /* non-blocking */ }
    // advance in rush order
    if (rush.ptr >= rush.order.length) { endRush(true); return; }
    pz.idx = rush.order[rush.ptr++];
    loadPuzzle();
    return;
  }

  const res = await bridge.progress.puzzleSolved({ puzzleId: puzzle.id }) as { solvedPuzzles: string[] };
  counter.textContent = `${t('puzzles.solvedCount')}: ${res.solvedPuzzles.length} / ${t('puzzles.totalCount')}: ${DATA.puzzles.length}`;
  toast(t('puzzles.solved'), 'gold');
  setTimeout(() => {
    const btn = el('button', 'btn primary', t('puzzles.next')) as HTMLButtonElement;
    fb.appendChild(btn);
    btn.addEventListener('click', () => { pz.idx = (pz.idx + 1) % DATA.puzzles.length; loadPuzzle(); });
  }, 400);
}

// ── Rush mode ─────────────────────────────────────────────────────────────
async function startRush(container: HTMLElement): Promise<void> {
  const t = state.t;
  // deterministic shuffle
  const order = DATA.puzzles.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  rush = { active: true, timeLeft: RUSH_SECONDS, score: 0, streak: 0, best: 0, solvedInRush: 0, order, ptr: 0, timerId: null };
  const bar = container.querySelector('.rush-bar') as HTMLElement | null;
  if (bar) bar.style.display = '';
  updateRushBar();
  pz.idx = order[0];
  rush.ptr = 1;
  loadPuzzle();
  stopRushTimer();
  rush.timerId = setInterval(() => {
    rush.timeLeft--;
    updateRushBar();
    if (rush.timeLeft <= 0) endRush(false);
  }, 1000);
  toast(`${t('puzzles.modeRush')} — ${t('puzzles.timeLeft')}: 3:00`, 'gold');
}

function stopRushTimer(): void {
  if (rush.timerId) { clearInterval(rush.timerId); rush.timerId = null; }
}

function exitRush(container: HTMLElement): void {
  if (!rush.active) return;
  stopRushTimer();
  rush.active = false;
  const bar = container.querySelector('.rush-bar') as HTMLElement | null;
  if (bar) bar.style.display = 'none';
  loadPuzzle();
}

function updateRushBar(): void {
  if (!rushTimerEl) return;
  const mm = Math.floor(rush.timeLeft / 60);
  const ss = String(rush.timeLeft % 60).padStart(2, '0');
  rushTimerEl.textContent = `${mm}:${ss}`;
  rushTimerEl.classList.toggle('urgent', rush.timeLeft <= 15);
  if (rushScoreEl) rushScoreEl.textContent = `${state.t('puzzles.score')}: ${rush.score}`;
  if (rushStreakEl) rushStreakEl.textContent = `${state.t('puzzles.streak')}: ${rush.streak}`;
}

function endRush(allSolved: boolean): void {
  stopRushTimer();
  const wasActive = rush.active;
  rush.active = false;
  if (!wasActive) return;
  const t = state.t;
  if (allSolved) rush.score += 500;
  sounds.unlock();
  const { box } = openModal(allSolved ? t('puzzles.allSolved') : t('puzzles.rushOver'));
  const hero = el('div', 'result-hero');
  hero.appendChild(el('div', 'big', allSolved ? '♛' : '⏱'));
  hero.appendChild(el('div', 'msg', `${t('puzzles.finalScore')}: ${rush.score}`));
  const statsRow = el('div', 'why');
  statsRow.textContent = `${t('puzzles.rushSolved')}: ${rush.solvedInRush} · ${t('puzzles.bestStreak')}: ${rush.best}`;
  hero.appendChild(statsRow);
  const row = el('div', 'btn-row');
  row.style.justifyContent = 'center';
  row.style.marginTop = '12px';
  const restart = el('button', 'btn primary', t('puzzles.rushRestart')) as HTMLButtonElement;
  const exitBtn = el('button', 'btn ghost', t('puzzles.rushExit')) as HTMLButtonElement;
  row.append(restart, exitBtn);
  hero.appendChild(row);
  box.appendChild(hero);
}

function showHint(): void {
  if (rush.active) return;
  const puzzle = DATA.puzzles[pz.idx];
  if (puzzle.hintSquare) {
    const file = puzzle.hintSquare.charCodeAt(0) - 97;
    const rank = puzzle.hintSquare.charCodeAt(1) - 49;
    board.setHint([rank * 16 + file]);
    setTimeout(() => board.clearHint(), 2500);
  }
}
