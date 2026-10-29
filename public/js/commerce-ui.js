document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-commerce-action]');
    if (!button) return;
    const action = button.dataset.commerceAction;
    if (action === 'print') window.print();
    if (action === 'add' && typeof window.agregarProducto === 'function') window.agregarProducto();
    if (action === 'cancel' && typeof window.cancelarVenta === 'function') window.cancelarVenta();
});
