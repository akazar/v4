/**
 * Expand/collapse .module-content inside each .module-card via header toggle.
 */
(function initModuleCards() {
    const lang = document.documentElement.lang || 'en';
    const labels = lang.startsWith('uk')
        ? { toggle: 'Показати або сховати опис модуля', expand: 'Розгорнути', collapse: 'Згорнути' }
        : { toggle: 'Show or hide module details', expand: 'Expand', collapse: 'Collapse' };

    document.querySelectorAll('.module-card').forEach((card, index) => {
        const header = card.querySelector('.module-header');
        const content = card.querySelector('.module-content');
        if (!header || !content) return;

        const contentId = content.id || `module-content-${index}`;
        content.id = contentId;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'module-toggle';
        toggle.setAttribute('aria-controls', contentId);
        toggle.setAttribute('aria-label', labels.toggle);
        toggle.innerHTML = '<span class="module-toggle-icon" aria-hidden="true"></span>';

        function setExpanded(expanded) {
            card.classList.toggle('module-card--collapsed', !expanded);
            toggle.setAttribute('aria-expanded', String(expanded));
            toggle.title = expanded ? labels.collapse : labels.expand;
        }

        toggle.addEventListener('click', () => {
            setExpanded(card.classList.contains('module-card--collapsed'));
        });

        const headerEnd = document.createElement('div');
        headerEnd.className = 'module-header-end';
        [...header.children].forEach((child) => {
            if (
                child.classList.contains('cta-button') ||
                child.classList.contains('module-header-actions')
            ) {
                headerEnd.appendChild(child);
            }
        });
        headerEnd.append(toggle);
        header.append(headerEnd);

        setExpanded(false);
    });
})();
