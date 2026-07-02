export function onServerAlert(detections, entry) {
    const classes = (detections || []).map((d) => d.class || d.name);
    console.log('[server/onServerAlert]', classes.length, 'detections:', classes, { timeout: entry?.timeout });
}

export function onServerStart(config) {
    console.log('[server/onServerStart] pipeline ready for config:', config?.id);
}