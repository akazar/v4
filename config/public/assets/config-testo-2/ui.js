const overlay = document.getElementById('ui-overlay');
const dump = document.getElementById('recognitionDump');
const btnShow = document.getElementById('btnShowResults');
const btnManual = document.getElementById('btnManualCapture');
const btnClose = document.getElementById('btnCloseOverlay');
const streamLabel = document.getElementById('streamLabel');

const streamId = new URLSearchParams(location.search).get('streamId');
if (streamLabel) streamLabel.textContent = streamId ? `streamId=${streamId}` : 'no stream';

btnShow?.addEventListener('click', () => {
    const results = window.vision?.getLatestRecognition?.() || [];
    dump.textContent = JSON.stringify(results, null, 2);
    overlay.hidden = false;
});

btnClose?.addEventListener('click', () => { overlay.hidden = true; });

btnManual?.addEventListener('click', () => {
    window.vision?.manualCapture?.();
    window.vision?.drawBoundingBoxes?.();
});