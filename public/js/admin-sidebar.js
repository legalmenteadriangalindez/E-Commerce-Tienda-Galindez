(() => {
    const sidebar = document.getElementById('adminSidebar');
    const toggle = document.querySelector('[data-admin-sidebar-toggle]');
    const backdrop = document.querySelector('[data-admin-sidebar-close]');

    if (!sidebar) return;

    const closeSidebar = () => {
        document.body.classList.remove('admin-sidebar-open');
        toggle?.setAttribute('aria-expanded', 'false');
        toggle?.setAttribute('aria-label', 'Abrir navegación administrativa');
    };

    toggle?.addEventListener('click', () => {
        const isOpen = document.body.classList.toggle('admin-sidebar-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute(
            'aria-label',
            isOpen ? 'Cerrar navegación administrativa' : 'Abrir navegación administrativa'
        );
    });

    backdrop?.addEventListener('click', closeSidebar);
    sidebar.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeSidebar));

    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    sidebar.querySelectorAll('[data-admin-route]').forEach((link) => {
        const route = link.getAttribute('data-admin-route');
        const isCurrent = route === currentPath || (route !== '/' && currentPath.startsWith(`${route}/`));
        if (!isCurrent) return;

        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
    });
})();
