(() => {
    'use strict';

    document.querySelectorAll('[data-edit-review]').forEach(link => {
        link.addEventListener('click', () => {
            document.getElementById('review-comment')?.focus({ preventScroll: true });
        });
    });

    document.querySelectorAll('[data-review-form]').forEach(form => {
        const comment = form.querySelector('[name="comentario"]');
        const counter = form.querySelector('[data-review-count]');
        if (comment && counter) {
            comment.addEventListener('input', () => {
                counter.textContent = String(comment.value.length);
            });
        }

        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (form.dataset.sending === 'true') return;

            const method = form.dataset.method || 'POST';
            if (method === 'DELETE' && !window.confirm('¿Quieres eliminar esta reseña?')) return;

            const errorBox = form.querySelector('[data-review-error]');
            const button = form.querySelector('[type="submit"]');
            const originalLabel = button.textContent;
            const payload = Object.fromEntries(new FormData(form));

            errorBox.hidden = true;
            form.dataset.sending = 'true';
            button.disabled = true;
            button.textContent = method === 'DELETE' ? 'Eliminando…' : 'Guardando…';

            try {
                const response = await fetch(form.action, {
                    method,
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': payload._csrf || ''
                    },
                    body: JSON.stringify(payload)
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.success) {
                    let message = data.message || 'No se pudo guardar el cambio. Inténtalo de nuevo.';
                    if (response.status === 401) {
                        message = 'Tu sesión venció. Inicia sesión antes de continuar.';
                    } else if (response.status === 403 && /csrf/i.test(message)) {
                        message = 'La sesión del formulario venció. Copia tu comentario y recarga la página para continuar.';
                    }
                    throw new Error(message);
                }

                if (typeof data.redirectUrl === 'string' && data.redirectUrl.startsWith('/Detalles/')) {
                    const target = new URL(data.redirectUrl, window.location.origin);
                    if (target.pathname === window.location.pathname && target.search === window.location.search) {
                        window.location.hash = target.hash;
                        window.location.reload();
                    } else {
                        window.location.assign(target.href);
                    }
                } else {
                    window.location.reload();
                }
            } catch (error) {
                errorBox.textContent = error.message || 'No hay conexión. Inténtalo de nuevo.';
                errorBox.hidden = false;
                errorBox.focus();
            } finally {
                form.dataset.sending = 'false';
                button.disabled = false;
                button.textContent = originalLabel;
            }
        });
    });
})();
