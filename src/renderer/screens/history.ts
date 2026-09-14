/** History screen — list + move-by-move replay. */
import { Position, uciToMove } from '../../chess';
import { GameRecordLite } from '../state';
import { state, bridge, el, openModal, toast } from '../state';
import { BoardView } from '../components/board';

export async function renderHistory(container: HTMLElement): Promise<void> {
  container.innerHTML = '';
  const t = state.t;
  const games = await bridge.history.list();

  const head = el('div', 'page-head');
  head.appendChild(el('h1', '', t('history.title')));
  head.appendChild(el('div', 'sub', t('history.subtitle')));
  container.appendChild(head);

  if (!games.length) {
    const empty = el('div', 'card', t('history.empty'));
    empty.style.textAlign = 'center';
    empty.style.padding = '40px';
    empty.style.color = 'var(--muted)';
    container.appendChild(empty);
    return;
  }

  const list = el('div', 'card');
  for (const g of games) {
    const row = el('div', 'game-item');
    const badge = el('span', `badge ${g.result}`, g.result === 'win' ? t('history.resultWin') : g.result === 'loss' ? t('history.resultLoss') : t('history.resultDraw'));
    const info = el('div', '');
    info.style.flex = '1';
    const d = new Date(g.finishedAt);
    const dateStr = d.toLocaleDateString(state.lang === 'ar' ? 'ar-EG' : 'en-GB') + ' ' + d.toLocaleTimeString(state.lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
    info.appendChild(el('div', '', g.level === 0
      ? `👥 ${t('history.localGame')} · ${g.sanMoves.length} ♟`
      : `${g.playerColor === 'white' ? '♔' : '♚'} ${t('history.vsLevel')} ${g.level} · ${g.sanMoves.length} ♟`));
    const dateEl = el('div', '', dateStr);
    dateEl.style.color = 'var(--muted)';
    dateEl.style.fontSize = '12px';
    info.appendChild(dateEl);
    row.append(badge, info);
    const replayBtn = el('button', 'btn sm primary', t('history.replay')) as HTMLButtonElement;
    replayBtn.addEventListener('click', () => openReplay(g));
    const delBtn = el('button', 'btn sm danger', t('history.delete')) as HTMLButtonElement;
    delBtn.addEventListener('click', async () => {
      await bridge.history.remove(g.id);
      toast(t('common.ok'));
      await renderHistory(container);
    });
    row.append(replayBtn, delBtn);
    list.appendChild(row);
  }
  container.appendChild(list);
}

function openReplay(g: GameRecordLite): void {
  const t = state.t;
  const { box, close } = openModal(t('history.replay'));
  const boardHost = el('div');
  const board = new BoardView(boardHost);
  let idx = 0;
  const posLabel = el('div', 'chip', '0');
  posLabel.style.margin = '10px 0';
  const renderAt = (i: number): void => {
    const pos = Position.fromFEN(g.startFen);
    for (let k = 0; k < i; k++) {
      const m = uciToMove(pos, g.uciMoves[k]);
      if (!m) break;
      if (k === i - 1) board.setLastMove(m.from, m.to);
      pos.make(m);
    }
    board.setPosition(pos, { interactive: false, flipped: state.settings.boardFlipped, showCoords: state.settings.showCoordinates });
    posLabel.textContent = `${Math.ceil(i / 2)} · ${g.sanMoves[i - 1] ?? ''}`;
  };
  const row = el('div', 'btn-row');
  row.style.justifyContent = 'center';
  row.style.marginTop = '12px';
  const mk = (label: string, fn: () => void): HTMLButtonElement => {
    const b = el('button', 'btn sm', label) as HTMLButtonElement;
    b.addEventListener('click', fn);
    row.appendChild(b);
    return b;
  };
  mk(t('history.startAgain'), () => { idx = 0; renderAt(0); });
  mk('◀ ' + t('history.prevMove'), () => { idx = Math.max(0, idx - 1); renderAt(idx); });
  mk(t('history.nextMove') + ' ▶', () => { idx = Math.min(g.uciMoves.length, idx + 1); renderAt(idx); });
  const closeBtn = el('button', 'btn sm ghost', t('common.close')) as HTMLButtonElement;
  closeBtn.addEventListener('click', close);
  row.appendChild(closeBtn);
  box.append(boardHost, posLabel, row);
  renderAt(0);
}
