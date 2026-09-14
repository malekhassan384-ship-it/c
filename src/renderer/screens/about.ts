/** About screen. */
import { state, bridge, el } from '../state';

export async function renderAbout(container: HTMLElement): Promise<void> {
  container.innerHTML = '';
  const t = state.t;
  const meta = await bridge.app.getMeta();
  const engineInfo = await bridge.engine.getInfo() as { name?: string; binary?: string; error?: string };
  const notice = await bridge.app.licenseNotice();

  const head = el('div', 'page-head');
  head.appendChild(el('h1', '', t('about.title')));
  container.appendChild(head);

  const wrap = el('div');
  wrap.style.display = 'grid';
  wrap.style.gap = '14px';
  wrap.style.maxWidth = '640px';

  const heroCard = el('div', 'card');
  heroCard.style.textAlign = 'center';
  heroCard.style.padding = '34px 18px';
  const logo = el('div', '', '♞');
  logo.style.cssText = 'font-size:56px;color:var(--accent);text-shadow:0 0 24px var(--accent-glow);';
  heroCard.appendChild(logo);
  heroCard.appendChild(el('h2', '', 'Chess Vanguard'));
  heroCard.appendChild(el('div', 'sub', `${t('about.version')} ${meta.version}`)).style.color = 'var(--muted)';
  heroCard.appendChild(el('p', '', t('about.description'))).style.cssText = 'max-width:460px;margin:12px auto 0;line-height:1.9;color:var(--text);';

  const ownerCard = el('div', 'card');
  ownerCard.appendChild(el('h3', '', t('about.developer')));
  ownerCard.appendChild(el('p', '', 'Malek Hassan Ashour')).style.fontWeight = '700';
  ownerCard.appendChild(el('p', '', t('about.copyright'))).style.cssText = 'color:var(--muted);font-size:12.5px;';

  const engineCard = el('div', 'card');
  engineCard.appendChild(el('h3', '', 'Stockfish'));
  const engineName = engineInfo && !engineInfo.error ? `${engineInfo.name} (${engineInfo.binary})` : t('common.error');
  engineCard.appendChild(el('p', '', engineName));
  engineCard.appendChild(el('p', '', t('about.engineNote'))).style.cssText = 'color:var(--muted);line-height:1.8;font-size:13px;';
  const pre = el('pre', '', notice);
  pre.style.cssText = 'background:var(--panel-2);border:1px solid var(--border);border-radius:10px;padding:10px;font-size:11px;white-space:pre-wrap;direction:ltr;text-align:left;';
  engineCard.appendChild(pre);

  const toolsCard = el('div', 'card');
  toolsCard.appendChild(el('h3', '', t('about.devTools')));
  toolsCard.appendChild(el('p', '', 'Electron · TypeScript · Vite · electron-builder · Stockfish (GPLv3)')).style.cssText = 'color:var(--muted);font-size:13px;direction:ltr;';

  const smart = el('div', 'card');
  smart.appendChild(el('h3', '', 'Windows SmartScreen'));
  smart.appendChild(el('p', '', t('about.smartscreen'))).style.cssText = 'color:var(--muted);line-height:1.8;font-size:13px;';

  wrap.append(heroCard, ownerCard, engineCard, toolsCard, smart);
  container.appendChild(wrap);
}
