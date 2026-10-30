'use strict';

(function () {
    const csrfToken = document.querySelector('#cartForm input[name="_csrf"]')?.value || '';

    async function requestCart(path, body) {
        const response = await fetch(path, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'No se pudo actualizar la despensa.');
        return data;
    }

    window.TiendaCartApi = { requestCart };
})();
