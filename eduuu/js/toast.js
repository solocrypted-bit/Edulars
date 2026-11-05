// ===================== APPLICATION TOAST NOTIFICATIONS =====================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = message;
    document.getElementById('toastIcon').className = type === 'success' ? 'fas fa-check-circle text-success-500' : 'fas fa-info-circle text-blue-500';
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}
