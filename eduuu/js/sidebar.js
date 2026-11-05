// ===================== ROLE-BASED SIDEBAR RENDERING =====================
function renderSidebar() {
    const menu = menuConfig[store.currentRole] || menuConfig.admin;
    document.getElementById('sidebarMenu').innerHTML = menu.map(item => `
        <button onclick="navigateTo('${item.id}')" 
                class="sidebar-item w-full flex items-center gap-9 px-6 py-4 rounded-lg text-xl font-lg text-slate-600 ${store.currentPage === item.id ? 'active' : ''}">
            <i class="fas ${item.icon} w-5 text-center"></i>
            <span>${item.label}</span>
        </button>
    `).join('');
}
