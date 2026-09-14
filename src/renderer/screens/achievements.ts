/** Achievements screen — badges with progress. */
import { state, bridge, el } from '../state';

export async function renderAchievements(container: HTMLElement): Promise<void> {
  container.innerHTML = '';
  const t = state.t;
  const data = await bridge.achievements.get();

  const head = el('div', 'page-head');
  head.appendChild(el('h1', '', t('achievements.title')));
  head.appendChild(el('div', 'sub', t('achievements.subtitle')));
  container.appendChild(head);

  const grid = el('div', 'ach-grid');
  for (const def of data.defs) {
    const unlocked = !!data.unlocked[def.id];
    const card = el('div', `card ach-card${unlocked ? '' : ' locked'}`);
    const ic = el('div', 'ic', def.icon);
    const body = el('div');
    body.style.flex = '1';
    body.appendChild(el('div', 'nm', state.lang === 'ar' ? def.ar : def.en));
    body.appendChild(el('div', 'ds', unlocked ? `${t('achievements.unlocked')} · ${new Date(data.unlocked[def.id]).toLocaleDateString(state.lang === 'ar' ? 'ar-EG' : 'en-GB')}` : t('achievements.locked')));
    if (!unlocked) {
      const cur = Math.min(def.threshold, data.counters[def.metric] ?? 0);
      const prog = el('div', 'ach-prog');
      const inner = el('div');
      inner.style.width = `${(cur / def.threshold) * 100}%`;
      prog.appendChild(inner);
      body.appendChild(prog);
      const lbl = el('div', 'ds', `${cur} / ${def.threshold}`);
      lbl.style.marginTop = '4px';
      body.appendChild(lbl);
    }
    card.append(ic, body);
    grid.appendChild(card);
  }
  container.appendChild(grid);
}
