/** Chessboard view component — renders a Position, handles click-to-move. */
import { Position, Move, pieceType, pieceColor, WHITE, moveToUci, algebraic } from '../../chess';
import { state } from '../state';

const GLYPHS: Record<number, string> = { 1: '\u265F', 2: '\u265E', 3: '\u265D', 4: '\u265C', 5: '\u265B', 6: '\u265A' };

export interface BoardOpts {
  interactive?: boolean;
  flipped?: boolean;
  showLegal?: boolean;
  showCoords?: boolean;
  /** only allow moving pieces of this color */
  movableColor?: 0 | 1 | null;
  onUserMove?: (uci: string) => void;
  onSquareClick?: (algebraicSq: string) => void;
}

export class BoardView {
  private container: HTMLElement;
  private boardEl: HTMLElement;
  private pos: Position | null = null;
  private opts: BoardOpts = {};
  private selected = -1;
  private lastFrom = -1;
  private lastTo = -1;
  private hintSquares: number[] = [];
  private squares = new Map<number, HTMLElement>();
  /** promotion continuation: pending from/to awaiting choice */
  private pendingPromo: { from: number; to: number; options: Move[] } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    const wrap = document.createElement('div');
    wrap.className = 'board-wrap';
    this.boardEl = document.createElement('div');
    this.boardEl.className = 'board';
    wrap.appendChild(this.boardEl);
    container.appendChild(wrap);
    this.boardEl.addEventListener('click', e => this.handleClick(e));
  }

  setPosition(pos: Position, opts: Partial<BoardOpts> = {}): void {
    this.pos = pos;
    this.opts = { ...this.opts, ...opts };
    if (opts.flipped !== undefined || opts.interactive !== undefined) { /* re-render handles it */ }
    this.selected = -1;
    this.pendingPromo = null;
    this.render();
  }

  updateOpts(opts: Partial<BoardOpts>): void {
    this.opts = { ...this.opts, ...opts };
    this.render();
  }

  setLastMove(from: number, to: number): void { this.lastFrom = from; this.lastTo = to; this.render(); }
  setHint(squares: number[]): void { this.hintSquares = squares; this.render(); }
  clearHint(): void { this.hintSquares = []; this.render(); }
  clearLast(): void { this.lastFrom = -1; this.lastTo = -1; this.render(); }

  private render(): void {
    if (!this.pos) return;
    const flipped = !!this.opts.flipped;
    this.boardEl.classList.toggle('interactive', !!this.opts.interactive);
    this.boardEl.innerHTML = '';
    this.squares.clear();
    const legal = this.opts.interactive ? this.pos.generateMoves() : [];
    const targets = this.selected >= 0 ? legal.filter(m => m.from === this.selected) : [];
    const checkSq = this.pos.inCheck() ? this.pos.kingSq[this.pos.turn] : -1;

    for (let r = 7; r >= 0; r--) {
      for (let f = 0; f < 8; f++) {
        const file = flipped ? 7 - f : f;
        const rank = flipped ? 7 - r : r;
        const sqi = rank * 16 + file;
        const div = document.createElement('div');
        const isLight = (file + rank) % 2 === 1;
        div.className = `sq ${isLight ? 'light' : 'dark'}`;
        div.dataset.sq = String(sqi);
        const piece = this.pos.pieceAt(sqi);
        if (piece !== 0) {
          const sp = document.createElement('span');
          sp.className = `piece ${pieceColor(piece) === WHITE ? 'p-w' : 'p-b'}`;
          sp.textContent = GLYPHS[pieceType(piece)];
          div.appendChild(sp);
        }
        if (this.opts.showCoords) {
          const showFile = flipped ? r === 7 : r === 0;   // bottom displayed row
          const showRank = flipped ? f === 7 : f === 0;   // left displayed column
          if (showFile) {
            const c = document.createElement('span');
            c.className = 'coord file';
            c.textContent = String.fromCharCode(97 + file);
            div.appendChild(c);
          }
          if (showRank) {
            const c = document.createElement('span');
            c.className = 'coord rank';
            c.textContent = String(rank + 1);
            div.appendChild(c);
          }
        }
        if (sqi === this.selected) div.classList.add('sel');
        if (sqi === this.lastFrom) div.classList.add('last-from');
        if (sqi === this.lastTo) div.classList.add('last-to');
        if (sqi === checkSq) div.classList.add('check-sq');
        if (this.hintSquares.includes(sqi)) div.classList.add('hint-sq');
        if (this.opts.showLegal && targets.some(m => m.to === sqi)) {
          const dot = document.createElement('span');
          dot.className = this.pos.pieceAt(sqi) !== 0 ? 'dot capture' : 'dot';
          div.appendChild(dot);
        }
        this.squares.set(sqi, div);
        this.boardEl.appendChild(div);
      }
    }
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const sqEl = target.closest('.sq') as HTMLElement | null;
    if (!sqEl || !this.pos || !this.opts.interactive) return;
    const sqi = Number(sqEl.dataset.sq);
    this.opts.onSquareClick?.(algebraic(sqi));
    if (this.pendingPromo) return; // must pick promotion first

    const legal = this.pos.generateMoves();
    const movable = this.opts.movableColor ?? this.pos.turn;

    if (this.selected >= 0) {
      const candidate = legal.filter(m => m.from === this.selected && m.to === sqi);
      if (candidate.length === 1) {
        this.commitMove(candidate[0]);
        return;
      }
      if (candidate.length > 1) { // promotion
        this.pendingPromo = { from: this.selected, to: sqi, options: candidate };
        this.showPromoPicker(pieceColor(this.pos.pieceAt(this.selected)));
        return;
      }
    }
    const p = this.pos.pieceAt(sqi);
    if (p !== 0 && pieceColor(p) === movable) {
      this.selected = sqi;
      this.render();
    } else {
      this.selected = -1;
      this.render();
    }
  }

  private commitMove(m: Move): void {
    const uci = moveToUci(m);
    this.selected = -1;
    this.opts.onUserMove?.(uci);
  }

  private showPromoPicker(color: 0 | 1): void {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const box = document.createElement('div');
    box.className = 'card modal';
    const h = document.createElement('h2');
    h.textContent = state.t('play.choosePromotion');
    box.appendChild(h);
    const row = document.createElement('div');
    row.className = 'promo-row';
    const options = this.pendingPromo!.options;
    for (const m of options) {
      const b = document.createElement('button');
      b.className = 'promo-btn';
      const sp = document.createElement('span');
      sp.className = `piece ${color === WHITE ? 'p-w' : 'p-b'}`;
      sp.style.fontSize = '42px';
      sp.textContent = GLYPHS[pieceType(m.promo)];
      b.appendChild(sp);
      b.addEventListener('click', () => {
        overlay.remove();
        const pp = this.pendingPromo;
        this.pendingPromo = null;
        if (pp) this.commitMove(options.find(x => x.promo === m.promo)!);
      });
      row.appendChild(b);
    }
    box.appendChild(row);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }
}
