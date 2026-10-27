document.addEventListener('click', event => {
    const button = event.target.closest('[data-commerce-action]');
    if (!button) return;
    const action = button.dataset.commerceAction;
    if (action === 'print') window.print();
    if (action === 'add' && typeof agregarProducto === 'function') agregarProducto();
    if (action === 'cancel' && typeof cancelarVenta === 'function') cancelarVenta();
});
