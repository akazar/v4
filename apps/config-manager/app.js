/**
 * Config Manager: list configs from GET /api/configurations,
 * Delete via DELETE /api/configurations/:id, View opens /factory/web/?id=:id
 */

const listEl = document.getElementById('configList');
const statusEl = document.getElementById('status');

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
                    <button type="button" class="btn btn-view" data-id="${escapeAttr(id)}">View</button>
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

async function handleListClick(e) {
    const viewBtn = e.target.closest('.btn-view');
    const deleteBtn = e.target.closest('.btn-delete');

    if (viewBtn) {
        const id = viewBtn.getAttribute('data-id');
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
loadList();
