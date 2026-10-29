(() => {
    'use strict';
    document.querySelectorAll('[data-admin-review-form]').forEach((form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const card = form.closest('[data-review-id]');
            if (card.dataset.sending === 'true') return;
            if (form.dataset.confirm && !window.confirm(form.dataset.confirm)) return;

            const errorBox = form.querySelector('[data-admin-review-error]');
            const buttons = [...card.querySelectorAll('button[type="submit"]')];
            const submit = form.querySelector('button[type="submit"]');
            const label = submit.textContent;
            const payload = Object.fromEntries(new FormData(form));
            errorBox.hidden = true;
            card.dataset.sending = 'true';
            buttons.forEach((button) => {
                button.disabled = true;
            });
            submit.textContent = 'Guardando…';
            try {
                const response = await fetch(form.action, {
                    method: form.dataset.method,
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': payload._csrf || '',
                    },
                    body: JSON.stringify(payload),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.success) {
                    let message = data.message || 'No se pudo guardar el cambio. Inténtalo de nuevo.';
                    if (response.status === 401)
                        message = 'Tu sesión venció. Copia tu texto e inicia sesión para continuar.';
                    if (response.status === 403 && /csrf/i.test(message))
                        message = 'El formulario venció. Copia tu texto y recarga el panel para continuar.';
                    throw new Error(message);
                }
                window.location.reload();
            } catch (error) {
                errorBox.textContent = error.message || 'No hay conexión. Inténtalo de nuevo.';
                errorBox.hidden = false;
                errorBox.focus();
            } finally {
                card.dataset.sending = 'false';
                buttons.forEach((button) => {
                    button.disabled = false;
                });
                submit.textContent = label;
            }
        });
    });
})();
