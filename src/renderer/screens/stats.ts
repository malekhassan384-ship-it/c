/** Statistics screen — derived numbers + pure-CSS/SVG charts. */
import { summarize } from '../../statistics/stats';
import { state, bridge, el } from '../state';

export async function renderStats(container: HTMLElement): Promise<void> {
  container.innerHTML = '';
  const t = state.t;
  const games = await bridge.history.list();
  const prog = await bridge.progress.get();

  const head = el('div', 'page-head');
  head.appendChild(el('h1', '', t('stats.title')));
  head.appendChild(el('div', 'sub', t('stats.subtitle')));
  container.appendChild(head);

  const s = summarize(games);

  const grid = el('div', 'stat-grid');
  const mkStat = (v: string | number, k: string): void => {
    const c = el('div', 'card stat-card');
    c.appendChild(el('div', 'v', String(v)));
    c.appendChild(el('div', 'k', k));
    grid.appendChild(c);
  };
  mkStat(s.gamesPlayed, t('stats.gamesPlayed'));
  mkStat(s.wins, t('stats.wins'));
  mkStat(s.losses, t('stats.losses'));
  mkStat(s.draws, t('stats.draws'));
  mkStat(`${Math.round(s.winRate * 100)}%`, t('stats.winRate'));
  mkStat(prog.solvedPuzzles.length, t('stats.puzzlesSolved'));
  mkStat(prog.completedLessons.length, t('stats.lessonsDone'));
  container.appendChild(grid);

  if (!games.length) {
    const empty = el('div', 'card', t('stats.noData'));
    empty.style.textAlign = 'center';
    empty.style.padding = '30px';
    empty.style.color = 'var(--muted)';
    container.appendChild(empty);
    return;
  }

  // by-level bars
  const byLevel = el('div', 'card');
  byLevel.appendChild(el('h2', '', t('stats.byLevel')));
  for (const lvl of s.byLevel) {
    const total = lvl.wins + lvl.losses + lvl.draws || 1;
    const row = el('div', 'bar-row');
    row.appendChild(el('span', '', lvl.level === 0 ? t('history.localGame') : `${t('play.level')} ${lvl.level}`));
    const bar = el('div', 'bar');
    const w = el('div', 'w'); w.style.width = `${(lvl.wins / total) * 100}%`;
    const d = el('div', 'd'); d.style.width = `${(lvl.draws / total) * 100}%`;
    const l = el('div', 'l'); l.style.width = `${(lvl.losses / total) * 100}%`;
    bar.append(w, d, l);
    row.appendChild(bar);
    row.appendChild(el('span', '', `${lvl.wins}W / ${lvl.draws}D / ${lvl.losses}L`));
    byLevel.appendChild(row);
  }
  container.appendChild(byLevel);

  // recent form
  const recent = el('div', 'card');
  recent.style.marginTop = '16px';
  recent.appendChild(el('h2', '', t('stats.recentForm')));
  const dots = el('div', 'form-dots');
  for (const r of s.recent) {
    const d = el('span', `d ${r.result}`);
    d.title = `${r.result} · ${t('history.vsLevel')} ${r.level}`;
    dots.appendChild(d);
  }
  recent.appendChild(dots);
  // donut
  recent.appendChild(donut(s.wins, s.draws, s.losses));
  container.appendChild(recent);
}

function donut(w: number, d: number, l: number): HTMLElement {
  const host = el('div');
  host.style.cssText = 'display:flex;align-items:center;gap:16px;margin-top:14px;direction:ltr;';
  const total = w + d + l || 1;
  const R = 52, C = 2 * Math.PI * R;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '130');
  svg.setAttribute('height', '130');
  svg.setAttribute('viewBox', '0 0 130 130');
  let offset = 0;
  const parts: Array<[number, string]> = [[w, 'var(--success)'], [d, 'var(--muted)'], [l, 'var(--danger)']];
  for (const [val, color] of parts) {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '65'); circle.setAttribute('cy', '65'); circle.setAttribute('r', String(R));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', '16');
    const len = (val / total) * C;
    circle.setAttribute('stroke-dasharray', `${len} ${C - len}`);
    circle.setAttribute('stroke-dashoffset', String(-offset));
    circle.setAttribute('transform', 'rotate(-90 65 65)');
    svg.appendChild(circle);
    offset += len;
  }
  host.appendChild(svg);
  return host;
}
