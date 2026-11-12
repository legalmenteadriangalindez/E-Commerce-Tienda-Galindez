(() => {
    const body = document.body;
    const sidebar = document.getElementById('adminSidebar');
    const toggle = document.querySelector('[data-admin-sidebar-toggle]');
    const backdrop = document.querySelector('[data-admin-sidebar-close]');

    if (!sidebar) return;

    const mobileQuery = window.matchMedia('(max-width: 991px)');
    // El contenido queda inerte mientras el menú móvil está abierto para que
    // un formulario no reciba clics o foco a través de la capa de fondo.
    const pageElements = [...body.children].filter(
        (element) => !element.matches('header, .admin-sidebar, .admin-sidebar-backdrop, script, noscript')
    );
    const focusableSelector =
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusableSidebarElements = () =>
        [...sidebar.querySelectorAll(focusableSelector)].filter((element) => !element.hidden);

    const updatePageInertState = (isOpen) => {
        pageElements.forEach((element) => {
            element.inert = isOpen;
        });
    };

    const setSidebarState = (isOpen, { restoreFocus = true } = {}) => {
        const shouldOpen = mobileQuery.matches && isOpen;
        body.classList.toggle('admin-sidebar-open', shouldOpen);

        if (mobileQuery.matches) {
            sidebar.setAttribute('aria-hidden', String(!shouldOpen));
            sidebar.inert = !shouldOpen;
            updatePageInertState(shouldOpen);
        } else {
            sidebar.removeAttribute('aria-hidden');
            sidebar.inert = false;
            updatePageInertState(false);
        }

        toggle?.setAttribute('aria-expanded', String(shouldOpen));
        toggle?.setAttribute(
            'aria-label',
            shouldOpen ? 'Cerrar navegación administrativa' : 'Abrir navegación administrativa'
        );

        if (shouldOpen) {
            focusableSidebarElements()[0]?.focus({ preventScroll: true });
        } else if (restoreFocus && mobileQuery.matches) {
            toggle?.focus({ preventScroll: true });
        }
    };

    const closeSidebar = (restoreFocus = true) => setSidebarState(false, { restoreFocus });

    toggle?.addEventListener('click', () => setSidebarState(!body.classList.contains('admin-sidebar-open')));
    backdrop?.addEventListener('click', () => closeSidebar());
    sidebar.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeSidebar(false)));

    // Mantiene el foco dentro del menú móvil hasta que el usuario lo cierre.
    sidebar.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeSidebar();
            return;
        }

        if (event.key !== 'Tab' || !body.classList.contains('admin-sidebar-open')) return;
        const elements = focusableSidebarElements();
        if (!elements.length) return;

        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    const handleViewportChange = () => setSidebarState(false, { restoreFocus: false });
    if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', handleViewportChange);
    } else {
        mobileQuery.addListener(handleViewportChange);
    }

    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    sidebar.querySelectorAll('[data-admin-route]').forEach((link) => {
        const route = link.getAttribute('data-admin-route');
        const isCurrent = route === currentPath || (route !== '/' && currentPath.startsWith(`${route}/`));
        if (!isCurrent) return;

        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
    });

    setSidebarState(false, { restoreFocus: false });
})();
