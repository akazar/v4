/**
 * Injects a fixed header + left sidebar with links mirroring the landing "All features" grid
 * (apps/landing/index.html). Skip by setting <html data-v4-app-shell="off">.
 */

const S = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICON = {
  home: S(
    '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'
  ),
  factory: S(
    '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>'
  ),
  streaming: S(
    '<rect x="2" y="7" width="15" height="10" rx="1"/><path d="M17 10l5-3v10l-5-3v-4z"/>'
  ),
  configManager: S(
    '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'
  ),
  configCreator: S(
    '<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>'
  ),
  configCreatorAdv: S(
    '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'
  ),
  conveyor: S(
    '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/>'
  ),
  camera: S(
    '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'
  ),
  imageUpload: S(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'
  ),
  modelDash: S(
    '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'
  ),
  modelTrain: S(
    '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 17v-4"/><path d="M12 17V9"/><path d="M16 17v-7"/><path d="M20 17v-3"/>'
  ),
  annotate: S(
    '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>'
  ),
  compare: S(
    '<rect x="3" y="4" width="8" height="16" rx="1"/><rect x="13" y="4" width="8" height="16" rx="1"/><path d="M7 9h0M17 9h0"/>'
  ),
  serverDet: S(
    '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/>'
  ),
  serverReason: S(
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M9 10h6"/><path d="M9 14h4"/>'
  ),
  docs: S(
    '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8M8 11h6"/>'
  ),
};

const NAV = [
  { href: '/', name: 'Home', icon: ICON.home },
  { href: '/config-manager', name: 'Config manager', icon: ICON.configManager },
  { href: '/config-creator-adv', name: 'Config generator', icon: ICON.configCreatorAdv },
  { href: '/conveyor-poc', name: 'Conveyor POC', icon: ICON.conveyor },
  { href: '/model-training/dashboard', name: 'Models dashboard', icon: ICON.modelDash },
  { href: '/annotate', name: 'Image annotator', icon: ICON.annotate },
  { href: '/model-training', name: 'Model training', icon: ICON.modelTrain },
  { href: '/image-upload', name: 'Image recognition', icon: ICON.imageUpload },
  { href: '/server-detection', name: 'Server recognition', icon: ICON.serverDet },
  { href: '/server-reasoning', name: 'Server reasoning', icon: ICON.serverReason },
  { href: '/compare', name: 'Compare models', icon: ICON.compare },
  { href: '/documentation/', name: 'Documentation', icon: ICON.docs },
  { href: '/factory/web', name: 'Production demo', icon: ICON.factory },
  { href: '/camera-stream', name: 'Camera stream', icon: ICON.camera },
  { href: '/streaming', name: 'Streaming', icon: ICON.streaming },
];

function normalizePath(p) {
  if (!p || p === '') return '/';
  let s = p.split('?')[0];
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

function isActivePath(current, href) {
  const c = normalizePath(current);
  const h = normalizePath(href);
  if (h === '/') return c === '/';
  if (c === h) return true;
  if (h === '/model-training' && c.startsWith('/model-training/')) {
    return !c.startsWith('/model-training/dashboard');
  }
  if (h === '/model-training/dashboard') {
    return c === '/model-training/dashboard' || c.startsWith('/model-training/dashboard/');
  }
  return c.startsWith(h + '/');
}

function openNav() {
  document.body.classList.add('v4-app-shell--nav-open');
  const b = document.getElementById('v4-app-menu-btn');
  if (b) {
    b.setAttribute('aria-expanded', 'true');
    b.setAttribute('aria-label', 'Close navigation');
  }
  const n = document.getElementById('v4-app-nav');
  if (n) n.removeAttribute('inert');
}

function closeNav() {
  document.body.classList.remove('v4-app-shell--nav-open');
  const b = document.getElementById('v4-app-menu-btn');
  if (b) {
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-label', 'Open navigation');
  }
  const n = document.getElementById('v4-app-nav');
  if (n) n.setAttribute('inert', '');
}

function toggleNav() {
  if (document.body.classList.contains('v4-app-shell--nav-open')) closeNav();
  else openNav();
}

function init() {
  if (document.documentElement.dataset.v4AppShell === 'off') return;

  const path = window.location.pathname;
  const chrome = document.createElement('header');
  chrome.id = 'v4-app-chrome';
  chrome.setAttribute('role', 'banner');
  chrome.innerHTML = `
    <button type="button" class="v4-shell-menu-btn" id="v4-app-menu-btn" aria-label="Open navigation" aria-controls="v4-app-nav" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
    <a class="v4-shell-home-link" href="/">Vision System</a>
  `;

  const nav = document.createElement('aside');
  nav.id = 'v4-app-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'All apps');
  nav.setAttribute('inert', '');

  const list = document.createElement('ul');
  list.className = 'v4-app-nav-list';

  for (const item of NAV) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.href;
    a.innerHTML = `<span class="v4-app-nav-icon">${item.icon}</span><span class="v4-app-nav-label">${item.name}</span>`;
    if (isActivePath(path, item.href)) {
      a.classList.add('is-active');
      a.setAttribute('aria-current', 'page');
    }
    a.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 720px)').matches) closeNav();
    });
    li.appendChild(a);
    list.appendChild(li);
  }
  nav.appendChild(list);

  const scrim = document.createElement('div');
  scrim.id = 'v4-app-scrim';
  scrim.setAttribute('aria-hidden', 'true');

  document.body.classList.add('v4-app-shell');
  document.body.insertBefore(scrim, document.body.firstChild);
  document.body.insertBefore(nav, document.body.firstChild);
  document.body.insertBefore(chrome, document.body.firstChild);

  document.getElementById('v4-app-menu-btn')?.addEventListener('click', toggleNav);
  scrim.addEventListener('click', closeNav);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNav();
  });

  openNav();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
