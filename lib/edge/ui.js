/**
 * Injects ON/OFF buttons at the bottom center of the document when config.ui is true.
 * Dispatches custom event 'ui:state' with { active: boolean } when a button is clicked.
 * @param {Document} doc - Current page document object
 * @param {object} config - Config object (e.g. from config-factory.js); must have config.ui
 */
export function injectTopButtons(doc, config) {
    if (!config?.ui) return;

    let active = false;

    const container = doc.createElement('div');
    container.className = 'edge-ui-bar';
    container.style.cssText = [
        'position:fixed',
        'bottom:0',
        'left:0',
        'right:0',
        'z-index:9999',
        'display:flex',
        'justify-content:center',
        'gap:clamp(6px, 1.5vw, 12px)',
        'padding:clamp(6px, 1.5vw, 12px)',
        'padding-bottom:max(clamp(6px, 1.5vw, 12px), env(safe-area-inset-bottom, 0px))',
        'background:transparent',
        'box-sizing:border-box',
        'min-height:44px',
        'align-items:center'
    ].join(';');

    const baseButtonStyle = [
        'padding:clamp(6px, 1.2vw, 10px) clamp(12px, 2.5vw, 20px)',
        'min-height:44px',
        'min-width:60px',
        'cursor:pointer',
        'font-size:clamp(14px, 2.5vw, 18px)',
        'border:1px solid rgba(120,120,120,0.6)',
        'border-radius:6px',
        'transition:border-color 0.2s, color 0.2s, opacity 0.2s',
        'box-sizing:border-box',
        'background:transparent'
    ].join(';');

    const onBtn = doc.createElement('button');
    onBtn.id = 'edge-ui-on';
    onBtn.textContent = 'ON';
    onBtn.setAttribute('aria-pressed', 'false');
    onBtn.style.cssText = baseButtonStyle + ';color:rgba(140,140,140,0.9);';

    const offBtn = doc.createElement('button');
    offBtn.id = 'edge-ui-off';
    offBtn.textContent = 'OFF';
    offBtn.setAttribute('aria-pressed', 'true');
    offBtn.style.cssText = baseButtonStyle + ';color:rgba(180,180,180,0.95);';

    function setActive(value) {
        active = value;
        onBtn.setAttribute('aria-pressed', String(value));
        offBtn.setAttribute('aria-pressed', String(!value));
        onBtn.style.color = value ? 'rgba(220,220,220,1)' : 'rgba(100,100,100,0.7)';
        onBtn.style.borderColor = value ? 'rgba(180,180,180,0.9)' : 'rgba(100,100,100,0.5)';
        onBtn.style.opacity = value ? '1' : '0.7';
        offBtn.style.color = !value ? 'rgba(220,220,220,1)' : 'rgba(100,100,100,0.7)';
        offBtn.style.borderColor = !value ? 'rgba(180,180,180,0.9)' : 'rgba(100,100,100,0.5)';
        offBtn.style.opacity = !value ? '1' : '0.7';
        doc.dispatchEvent(new CustomEvent('ui:state', { detail: { active } }));
    }

    onBtn.addEventListener('click', () => setActive(true));
    offBtn.addEventListener('click', () => setActive(false));

    container.appendChild(onBtn);
    container.appendChild(offBtn);
    doc.body.appendChild(container);

    setActive(false);
}
