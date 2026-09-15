// Modal Manager
const Modal = {
    create(id, content) {
        const html = `
            <div id="${id}" class="app-modal-overlay hidden">
                <div class="app-modal-card opacity-0">
                    ${content}
                </div>
            </div>
        `;
        document.getElementById('modalsContainer').insertAdjacentHTML('beforeend', html);
    },

    open(id) {
        const modal = document.getElementById(id);
        modal.classList.remove('hidden');
        document.documentElement.classList.add('is-modal-open');
        if (window.__pinViewportOverlay) window.__pinViewportOverlay(modal);
        setTimeout(() => {
            const content = modal.querySelector('div');
            content.classList.remove('opacity-0');
            content.classList.add('opacity-100');
        }, 10);
    },

    close(id) {
        const modal = document.getElementById(id);
        const content = modal.querySelector('div');
        content.classList.remove('opacity-100');
        content.classList.add('opacity-0');
        document.documentElement.classList.remove('is-modal-open');
        if (window.__unpinViewportOverlay) window.__unpinViewportOverlay(modal);
        setTimeout(() => modal.remove(), 200);
    }
};
