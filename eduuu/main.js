// ===================== APP COMPONENT LOADING =====================
const appComponents = [
    { target: 'loginComponent', file: 'components/login.html' },
    { target: 'topbarComponent', file: 'components/topbar.html' },
    { target: 'sidebarComponent', file: 'components/sidebar.html' },
    { target: 'mainContentComponent', file: 'components/main-content.html' },
    { target: 'reportModalComponent', file: 'components/report-modal.html' },
    { target: 'toastComponent', file: 'components/toast.html' }
];

async function loadAppComponents() {
    try {
        const loadedComponents = await Promise.all(appComponents.map(async component => {
            const response = await fetch(component.file);
            if (!response.ok) {
                throw new Error(`Unable to load ${component.file}: HTTP ${response.status}`);
            }
            return { ...component, markup: await response.text() };
        }));

        loadedComponents.forEach(component => {
            document.getElementById(component.target).innerHTML = component.markup;
        });
        await initializeAuthExperience();
    } catch (error) {
        console.error('EDULARS could not load its interface components.', error);
        const message = document.createElement('p');
        message.className = 'm-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800';
        message.setAttribute('role', 'alert');
        message.textContent = 'The application interface could not be loaded. Run this page from a local web server (for example, VS Code Live Server), then reload it.';
        document.body.prepend(message);
    }
}

document.addEventListener('DOMContentLoaded', loadAppComponents, { once: true });
