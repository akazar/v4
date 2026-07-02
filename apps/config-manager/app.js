/**
 * Config Manager: list configs from GET /api/configurations,
 * Delete via DELETE /api/configurations/:id,
 * Test opens /factory/web/?id=:id (apps/factory/web), View shows read-only file content from /config/public/
 */

const listEl = document.getElementById('configList');
const statusEl = document.getElementById('status');
const viewPanel = document.getElementById('viewPanel');
const viewPanelTitle = document.getElementById('viewPanelTitle');
const viewPanelCode = document.getElementById('viewPanelCode');
const viewPanelClose = document.getElementById('viewPanelClose');

function setStatus(message, isError = false) {
    statusEl.textContent = message || '';
    statusEl.className = 'status' + (isError ? ' error' : '');
}

/** Get id from file name (strip .js). */
function fileNameToId(fileName) {
    if (typeof fileName !== 'string') return '';
    return fileName.endsWith('.js') ? fileName.slice(0, -3) : fileName;
}

async function loadList() {
    setStatus('Loading…');
    listEl.innerHTML = '';
    listEl.className = 'config-list loading';
    try {
        const res = await fetch('/api/configurations');
        if (!res.ok) throw new Error(res.status === 404 ? 'API not found' : `HTTP ${res.status}`);
        const names = await res.json();
        if (!Array.isArray(names)) throw new Error('Invalid response');

        listEl.className = 'config-list';
        if (names.length === 0) {
            listEl.classList.add('empty');
            listEl.innerHTML = '<li>No configurations in config/public</li>';
            setStatus('');
            return;
        }

        for (const fileName of names) {
            const id = fileNameToId(fileName);
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="name">${escapeHtml(fileName)}</span>
                <span class="actions">
                    <button type="button" class="btn btn-view" data-file="${escapeAttr(fileName)}">View</button>
                    <button type="button" class="btn btn-test" data-id="${escapeAttr(id)}">Test</button>
                    <button type="button" class="btn btn-danger btn-delete" data-id="${escapeAttr(id)}" data-name="${escapeAttr(fileName)}">Delete</button>
                </span>
            `;
            listEl.appendChild(li);
        }

        setStatus('');
    } catch (err) {
        listEl.className = 'config-list';
        listEl.innerHTML = '';
        setStatus(err.message || 'Failed to load configurations', true);
    }
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
}

function closeViewPanel() {
    if (!viewPanel) return;
    viewPanel.hidden = true;
    viewPanel.setAttribute('aria-hidden', 'true');
    viewPanelCode.textContent = '';
}

function openViewPanel(fileName, text) {
    if (!viewPanel || !viewPanelTitle || !viewPanelCode) return;
    viewPanelTitle.textContent = fileName;
    viewPanelCode.textContent = text;
    viewPanel.hidden = false;
    viewPanel.setAttribute('aria-hidden', 'false');
    viewPanelClose.focus();
}

async function showConfigSource(fileName) {
    setStatus('Loading file…');
    try {
        const res = await fetch('/config/public/' + encodeURIComponent(fileName), { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status === 404 ? 'File not found' : `HTTP ${res.status}`);
        const text = await res.text();
        setStatus('');
        openViewPanel(fileName, text);
    } catch (err) {
        setStatus(err.message || 'Failed to load file', true);
    }
}

async function handleListClick(e) {
    const viewBtn = e.target.closest('.btn-view');
    const testBtn = e.target.closest('.btn-test');
    const deleteBtn = e.target.closest('.btn-delete');

    if (viewBtn) {
        const file = viewBtn.getAttribute('data-file');
        if (file) await showConfigSource(file);
        return;
    }

    if (testBtn) {
        const id = testBtn.getAttribute('data-id');
        if (id) window.open('/factory/web/?id=' + encodeURIComponent(id), '_blank', 'noopener');
        return;
    }

    if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        const name = deleteBtn.getAttribute('data-name');
        if (!id) return;
        if (!confirm(`Delete configuration "${name}"?`)) return;

        setStatus('Deleting…');
        try {
            const res = await fetch('/api/configurations/' + encodeURIComponent(id), { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            setStatus(`Deleted ${name}`);
            await loadList();
        } catch (err) {
            setStatus(err.message || 'Delete failed', true);
        }
    }
}

listEl.addEventListener('click', handleListClick);

if (viewPanelClose) {
    viewPanelClose.addEventListener('click', closeViewPanel);
}
if (viewPanel) {
    viewPanel.querySelector('.view-panel__backdrop')?.addEventListener('click', closeViewPanel);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && viewPanel && !viewPanel.hidden) closeViewPanel();
    });
}

loadList();
