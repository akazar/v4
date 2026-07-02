export function onServerAlert(detections, entry) 
	console.log('local recognition results onServerAlert:', detections, entry);
    const classes = (detections || []).map((d) => d.categoryName || d.name);
    console.log('[server/onServerAlert]', classes.length, 'detections:', classes, { timeout: entry?.timeout });
}