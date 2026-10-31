'use strict';

document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    const inputId = button.getAttribute('aria-controls');
    const input = inputId ? document.getElementById(inputId) : null;
    const label = button.querySelector('[data-password-toggle-label]');

    if (!input || !label) return;

    button.hidden = false;
    button.addEventListener('click', () => {
        const showPassword = input.type === 'password';
        input.type = showPassword ? 'text' : 'password';
        button.setAttribute('aria-pressed', String(showPassword));
        label.textContent = showPassword ? 'Ocultar' : 'Mostrar';
    });
});
