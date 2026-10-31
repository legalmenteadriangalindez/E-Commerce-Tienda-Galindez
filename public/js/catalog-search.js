'use strict';

(() => {
    const input = document.querySelector('.app-search-form input[name="search"]');
    const list = document.getElementById('catalog-search-suggestions');
    if (!input || !list) return;

    let debounceTimer;
    let activeRequest;

    input.addEventListener('input', () => {
        window.clearTimeout(debounceTimer);
        activeRequest?.abort();

        const search = input.value.trim();
        if (search.length < 2) {
            list.replaceChildren();
            return;
        }

        debounceTimer = window.setTimeout(async () => {
            const controller = new AbortController();
            activeRequest = controller;

            try {
                const url = new URL('/api/productos/catalogo/sugerencias', window.location.origin);
                url.searchParams.set('search', search);
                const response = await fetch(url, {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                    signal: controller.signal,
                });
                if (!response.ok) return;

                const payload = await response.json();
                const suggestions = payload.data?.suggestions || payload.suggestions || [];
                if (input.value.trim() !== search) return;

                const options = document.createDocumentFragment();
                suggestions.forEach((suggestion) => {
                    if (typeof suggestion.name !== 'string' || !suggestion.name.trim()) return;
                    const option = document.createElement('option');
                    option.value = suggestion.name;
                    options.append(option);
                });
                list.replaceChildren(options);
            } catch (error) {
                if (error.name !== 'AbortError') console.warn('No se pudieron cargar sugerencias de búsqueda.');
            }
        }, 250);
    });
})();
