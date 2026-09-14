import {
  Position, Move, pieceType, PAWN, FLAG_CASTLE_K, FLAG_CASTLE_Q, FLAG_EP
} from './position';

const LETTERS: Record<number, string> = { 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };

/** Standard Algebraic Notation for a legal move in pos (pos is NOT mutated). */
export function moveToSan(pos: Position, m: Move): string {
  let san: string;
  if (m.flags === FLAG_CASTLE_K) san = 'O-O';
  else if (m.flags === FLAG_CASTLE_Q) san = 'O-O-O';
  else {
    const piece = pos.pieceAt(m.from);
    const t = pieceType(piece);
    const isCapture = pos.pieceAt(m.to) !== 0 || m.flags === FLAG_EP;
    if (t === PAWN) {
      san = isCapture ? fileChar(m.from) + 'x' : '';
      san += squareName(m.to);
      if (m.promo) san += '=' + LETTERS[m.promo];
    } else {
      let disamb = '';
      const rivals = pos.generateMoves().filter(x =>
        x.to === m.to && x.from !== m.from && pieceType(pos.pieceAt(x.from)) === t
      );
      if (rivals.length > 0) {
        const sameFile = rivals.some(x => fileChar(x.from) === fileChar(m.from));
        const sameRank = rivals.some(x => rankChar(x.from) === rankChar(m.from));
        if (!sameFile) disamb = fileChar(m.from);
        else if (!sameRank) disamb = rankChar(m.from);
        else disamb = fileChar(m.from) + rankChar(m.from);
      }
      san = LETTERS[t] + disamb + (isCapture ? 'x' : '') + squareName(m.to);
    }
  }
  pos.make(m);
  if (pos.inCheck()) san += pos.generateMoves().length === 0 ? '#' : '+';
  pos.unmake();
  return san;
}

function fileChar(s: number): string { return String.fromCharCode(97 + (s & 15)); }
function rankChar(s: number): string { return String.fromCharCode(49 + (s >> 4)); }
function squareName(s: number): string { return fileChar(s) + rankChar(s); }
