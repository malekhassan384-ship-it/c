/** Settings screen — bound to persisted settings; instant apply. */
import { AppSettings } from '../../settings/settings';
import { state, bridge, el, saveSettings, toast, openModal, emit } from '../state';

export function renderSettings(container: HTMLElement): void {
  container.innerHTML = '';
  const t = state.t;
  const s = state.settings;

  const head = el('div', 'page-head');
  head.appendChild(el('h1', '', t('settings.title')));
  container.appendChild(head);

  const card = el('div', 'card');

  const rowOf = (): HTMLElement => { const r = el('div', 'setting-row'); card.appendChild(r); return r; };

  // language
  {
    const r = rowOf();
    r.appendChild(el('div', 'lbl', t('settings.language')));
    const sel = el('select') as HTMLSelectElement;
    const o1 = el('option', '', t('settings.arabic')) as HTMLOptionElement; o1.value = 'ar';
    const o2 = el('option', '', t('settings.english')) as HTMLOptionElement; o2.value = 'en';
    sel.append(o1, o2);
    sel.value = s.language;
    sel.addEventListener('change', async () => { await saveSettings({ language: sel.value as 'ar' | 'en' }); emit('navigate', 'settings'); });
    r.appendChild(sel);
  }
  // theme
  {
    const r = rowOf();
    r.appendChild(el('div', 'lbl', t('settings.theme')));
    const sel = el('select') as HTMLSelectElement;
    const opts: Array<[AppSettings['theme'], string]> = [
      ['professional', t('settings.themePro')],
      ['midnight-gold', t('settings.themeMidnight')],
      ['emerald-night', t('settings.themeEmerald')],
      ['crimson-dusk', t('settings.themeCrimson')]
    ];
    for (const [v, label] of opts) {
      const o = el('option', '', label) as HTMLOptionElement;
      o.value = v;
      sel.appendChild(o);
    }
    sel.value = s.theme;
    sel.addEventListener('change', async () => { await saveSettings({ theme: sel.value as AppSettings['theme'] }); });
    r.appendChild(sel);
  }
  // sound
  {
    const r = rowOf();
    const lbls = el('div');
    lbls.appendChild(el('div', 'lbl', t('settings.sound')));
    r.appendChild(lbls);
    const tg = el('div', `toggle${s.soundEnabled ? ' on' : ''}`) as HTMLElement;
    tg.addEventListener('click', async () => { await saveSettings({ soundEnabled: !state.settings.soundEnabled }); tg.classList.toggle('on', state.settings.soundEnabled); });
    r.appendChild(tg);
  }
  // volume
  {
    const r = rowOf();
    r.appendChild(el('div', 'lbl', t('settings.volume')));
    const range = el('input') as HTMLInputElement;
    range.type = 'range';
    range.min = '0'; range.max = '100';
    range.value = String(Math.round(s.soundVolume * 100));
    range.addEventListener('input', () => void saveSettings({ soundVolume: Number(range.value) / 100 }));
    r.appendChild(range);
  }
  // show legal moves
  {
    const r = rowOf();
    r.appendChild(el('div', 'lbl', t('settings.showLegalMoves')));
    const tg = el('div', `toggle${s.showLegalMoves ? ' on' : ''}`) as HTMLElement;
    tg.addEventListener('click', async () => { await saveSettings({ showLegalMoves: !state.settings.showLegalMoves }); tg.classList.toggle('on', state.settings.showLegalMoves); });
    r.appendChild(tg);
  }
  // coordinates
  {
    const r = rowOf();
    r.appendChild(el('div', 'lbl', t('settings.showCoordinates')));
    const tg = el('div', `toggle${s.showCoordinates ? ' on' : ''}`) as HTMLElement;
    tg.addEventListener('click', async () => { await saveSettings({ showCoordinates: !state.settings.showCoordinates }); tg.classList.toggle('on', state.settings.showCoordinates); });
    r.appendChild(tg);
  }
  // default level
  {
    const r = rowOf();
    r.appendChild(el('div', 'lbl', t('settings.defaultLevel')));
    const sel = el('select') as HTMLSelectElement;
    for (let i = 1; i <= 8; i++) {
      const o = el('option', '', `${i} — ${state.t(`levels.${i}`)}`) as HTMLOptionElement;
      o.value = String(i);
      sel.appendChild(o);
    }
    sel.value = String(s.defaultLevel);
    sel.addEventListener('change', async () => { await saveSettings({ defaultLevel: Number(sel.value) }); });
    r.appendChild(sel);
  }
  // reset data
  {
    const r = rowOf();
    r.appendChild(el('div', 'lbl', t('settings.resetData')));
    const b = el('button', 'btn sm danger', t('settings.resetData')) as HTMLButtonElement;
    b.addEventListener('click', () => {
      const { box, close } = openModal(t('settings.resetConfirm'));
      const row = el('div', 'btn-row');
      row.style.justifyContent = 'flex-end';
      const yes = el('button', 'btn danger', t('common.ok')) as HTMLButtonElement;
      const no = el('button', 'btn ghost', t('common.cancel')) as HTMLButtonElement;
      yes.addEventListener('click', async () => {
        const ok = await bridge.app.resetData();
        close();
        toast(ok ? t('common.ok') : t('common.error'), ok ? 'gold' : 'err');
        emit('navigate', 'play');
      });
      no.addEventListener('click', close);
      row.append(yes, no);
      box.appendChild(row);
    });
    r.appendChild(b);
  }

  container.appendChild(card);
  void toast;
}
