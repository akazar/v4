/**
 * Lists and deletes checkpoint files via GET/DELETE /api/model-training/models-list
 */

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error('Missing element: ' + id);
  return el;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

const TRASH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

function setModelsDashboardStatus(message, isError = false) {
  const el = $('modelsDashboardStatus');
  el.textContent = message || '';
  el.className = 'status' + (isError ? ' error' : '');
}

async function loadModelsDashboard() {
  const listEl = $('modelsDashboardList');
  listEl.innerHTML = '';
  listEl.className = 'model-files-list';
  setModelsDashboardStatus('Loading…');
  try {
    const res = await fetch('/api/model-training/models-list');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    const files = Array.isArray(data.files) ? data.files : [];
    if (files.length === 0) {
      listEl.classList.add('empty');
      listEl.innerHTML = '<li>No saved model files yet.</li>';
      setModelsDashboardStatus('');
      return;
    }
    for (const fileName of files) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="model-file-name">${escapeHtml(fileName)}</span>
        <button type="button" class="model-trash-btn" data-filename="${escapeAttr(fileName)}" title="Delete ${escapeAttr(fileName)}" aria-label="Delete ${escapeAttr(fileName)}">${TRASH_ICON_SVG}</button>
      `;
      listEl.appendChild(li);
    }
    setModelsDashboardStatus(`${files.length} file(s)`);
  } catch (e) {
    listEl.classList.add('empty');
    listEl.innerHTML = '<li>Could not load the list.</li>';
    setModelsDashboardStatus(e instanceof Error ? e.message : 'Failed to load models', true);
  }
}

async function deleteModelFile(fileName) {
  if (!fileName) return;
  if (!confirm(`Delete model file "${fileName}" from the server?`)) return;
  setModelsDashboardStatus('Deleting…');
  try {
    const res = await fetch(
      '/api/model-training/models-list/' + encodeURIComponent(fileName),
      { method: 'DELETE' }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    setModelsDashboardStatus(`Removed ${fileName}`);
    await loadModelsDashboard();
  } catch (e) {
    setModelsDashboardStatus(e instanceof Error ? e.message : 'Delete failed', true);
  }
}

function wireModelsDashboard() {
  $('refreshModelsDashboardBtn').addEventListener('click', () => loadModelsDashboard());
  $('modelsDashboardList').addEventListener('click', (e) => {
    const btn = e.target.closest('.model-trash-btn');
    if (!btn) return;
    const name = btn.getAttribute('data-filename');
    if (name) deleteModelFile(name);
  });
}

wireModelsDashboard();
loadModelsDashboard();
