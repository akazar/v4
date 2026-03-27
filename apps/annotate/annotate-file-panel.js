/**
 * Left panel: lists COCO JSON files in apps/annotate/annotation-list and allows delete.
 * Requires GET/DELETE routes from annotate-export-server.js.
 */

const LIST_URL = '/api/annotate/annotation-list';

function deleteUrl(name) {
  return '/api/annotate/annotation-list/' + encodeURIComponent(name);
}

/** Strip .json for list labels only; API still uses full `name`. */
function displayFileName(name) {
  if (typeof name !== 'string') {
    return name;
  }
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) {
    return name.slice(0, -5);
  }
  return name;
}

const TRASH_SVG =
  '<svg class="annotate-files-panel-trash-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>' +
  '</svg>';

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

async function fetchList() {
  const res = await fetch(LIST_URL);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText || 'Failed to load list');
  }
  return Array.isArray(data.files) ? data.files : [];
}

async function deleteFile(name) {
  const res = await fetch(deleteUrl(name), { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText || 'Delete failed');
  }
}

function renderPanel(root, files, onRefresh) {
  root.replaceChildren();

  const head = el('div', 'annotate-files-panel-head');
  head.appendChild(el('h2', 'annotate-files-panel-title', 'Annotation exports'));
  const refreshBtn = el('button', 'annotate-files-panel-refresh', 'Refresh');
  refreshBtn.type = 'button';
  refreshBtn.addEventListener('click', () => onRefresh());
  head.appendChild(refreshBtn);
  root.appendChild(head);

  const status = el('p', 'annotate-files-panel-status');
  status.hidden = true;
  root.appendChild(status);

  if (!files.length) {
    root.appendChild(el('p', 'annotate-files-panel-empty', 'No COCO JSON files yet.'));
    return;
  }

  const ul = el('ul', 'annotate-files-panel-list');
  for (const name of files) {
    const li = el('li', 'annotate-files-panel-item');
    const label = displayFileName(name);
    const nameEl = el('span', 'annotate-files-panel-name', label);
    nameEl.title = name;

    const del = el('button', 'annotate-files-panel-delete');
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete ' + label);
    del.innerHTML = TRASH_SVG;
    del.addEventListener('click', async () => {
      if (!window.confirm('Delete "' + label + '"?')) {
        return;
      }
      del.disabled = true;
      try {
        await deleteFile(name);
        await onRefresh();
      } catch (e) {
        status.textContent = e.message || String(e);
        status.hidden = false;
        del.disabled = false;
      }
    });

    li.appendChild(nameEl);
    li.appendChild(del);
    ul.appendChild(li);
  }
  root.appendChild(ul);
}

async function refresh(root) {
  const status = root.querySelector('.annotate-files-panel-status');
  if (status) {
    status.hidden = true;
    status.textContent = '';
  }
  try {
    const files = await fetchList();
    renderPanel(root, files, () => refresh(root));
  } catch (e) {
    root.replaceChildren();
    const err = el('p', 'annotate-files-panel-error', e.message || String(e));
    root.appendChild(err);
    const retry = el('button', 'annotate-files-panel-refresh', 'Retry');
    retry.type = 'button';
    retry.addEventListener('click', () => refresh(root));
    root.appendChild(retry);
  }
}

function init() {
  const root = document.getElementById('annotate-files-panel-root');
  if (!root) {
    return;
  }

  const run = () => refresh(root);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  window.addEventListener('annotate-coco-saved', run);
}

init();
