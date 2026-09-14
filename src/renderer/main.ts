/** Chess Vanguard renderer entry — layout, router, boot. */
import { loadInitialSettings, state, bridge, el, on, toast } from './state';
import { renderPlay, autoplayEngineTest } from './screens/play';
import { renderAcademy } from './screens/academy';
import { renderPuzzles } from './screens/puzzles';
import { renderHistory } from './screens/history';
import { renderStats } from './screens/stats';
import { renderAchievements } from './screens/achievements';
import { renderSettings } from './screens/settings';
import { renderAbout } from './screens/about';
import { initAudio } from '../audio/synth';

type ScreenId = 'play' | 'academy' | 'puzzles' | 'history' | 'statistics' | 'achievements' | 'settings' | 'about';

const SCREENS: Array<{ id: ScreenId; icon: string; tKey: string }> = [
  { id: 'play', icon: '♟', tKey: 'app.play' },
  { id: 'academy', icon: '♘', tKey: 'app.academy' },
  { id: 'puzzles', icon: '♞', tKey: 'app.puzzles' },
  { id: 'history', icon: '☰', tKey: 'app.history' },
  { id: 'statistics', icon: '▤', tKey: 'app.statistics' },
  { id: 'achievements', icon: '♛', tKey: 'app.achievements' },
  { id: 'settings', icon: '⚙', tKey: 'app.settings' },
  { id: 'about', icon: 'ⓘ', tKey: 'app.about' }
];

let content: HTMLElement;
let navButtons = new Map<string, HTMLButtonElement>();

function currentRoute(): ScreenId {
  const h = location.hash.replace('#', '') as ScreenId;
  return SCREENS.some(s => s.id === h) ? h : 'play';
}

async function renderScreen(): Promise<void> {
  const route = currentRoute();
  content.innerHTML = '';
  navButtons.forEach((btn, id) => btn.classList.toggle('active', id === route));
  try {
    switch (route) {
      case 'play': renderPlay(content); break;
      case 'academy': await renderAcademy(content); break;
      case 'puzzles': await renderPuzzles(content); break;
      case 'history': await renderHistory(content); break;
      case 'statistics': await renderStats(content); break;
      case 'achievements': await renderAchievements(content); break;
      case 'settings': renderSettings(content); break;
      case 'about': await renderAbout(content); break;
    }
  } catch (e) {
    content.appendChild(el('div', 'card', state.t('common.error')));
    console.error(e);
  }
}

function buildLayout(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  app.className = 'app-shell';

  const side = el('aside', 'sidebar');
  const brand = el('div', 'brand');
  const logo = el('div', 'logo', '♞');
  const nameWrap = el('div');
  nameWrap.appendChild(el('div', 'name', 'Chess Vanguard'));
  nameWrap.appendChild(el('div', 'tag', state.t('app.tagline')));
  brand.append(logo, nameWrap);
  side.appendChild(brand);

  navButtons = new Map();
  for (const s of SCREENS) {
    const btn = el('button', 'nav-btn') as HTMLButtonElement;
    const ic = el('span', 'ic', s.icon);
    const label = el('span', '', state.t(s.tKey));
    btn.append(ic, label);
    btn.addEventListener('click', () => { location.hash = s.id; });
    side.appendChild(btn);
    navButtons.set(s.id, btn);
  }

  const foot = el('div', 'side-foot', state.t('about.copyright'));
  side.appendChild(foot);

  content = el('main', 'content');
  app.append(side, content);
}

async function boot(): Promise<void> {
  await loadInitialSettings();
  buildLayout();
  window.addEventListener('hashchange', () => void renderScreen());
  on('navigate', id => { location.hash = String(id); });

  // audio unlock on first gesture
  const unlock = (): void => { initAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);

  // achievements live toasts
  bridge.achievements.onUnlocked(ids => {
    toast(state.t('achievements.unlocked') + ' ♛', 'gold');
    void ids;
  });

  await renderScreen();

  // signal main process that renderer is alive (smoke test relies on this)
  bridge.app.ready();

  // automation mode (scripts/smoke.mjs --play): prove the engine actually replies
  if (location.hash.includes('autoplay')) {
    try {
      const res = await autoplayEngineTest();
      console.log(`AUTOPLAY_RESULT: moves=${res.moves}`);
    } catch (e) {
      console.log(`AUTOPLAY_RESULT: moves=0 error=${String(e)}`);
    }
  }
}

void boot();
