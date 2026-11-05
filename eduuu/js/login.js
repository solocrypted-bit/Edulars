// ===================== AUTHENTICATION SCREENS =====================
let schoolRegistrationAvailable = false;
let schoolLogoDataUrl = '';

function showAuthScreen(screenId) {
    ['welcomeScreen', 'loginScreen', 'signupScreen'].forEach(id => {
        document.getElementById(id).classList.toggle('hidden', id !== screenId);
    });
}

function showWelcomeScreen() {
    showAuthScreen('welcomeScreen');
}

function showLoginScreen() {
    showAuthScreen('loginScreen');
    document.getElementById('loginEmail').focus();
}

function showSignupScreen() {
    if (!schoolRegistrationAvailable) {
        showWelcomeScreen();
        return;
    }
    showAuthScreen('signupScreen');
    document.getElementById('signupName').focus();
}

function showNotice(message, isError = false) {
    const notice = document.getElementById('authNotice');
    notice.textContent = message;
    notice.classList.remove('hidden', 'border-red-200/30', 'bg-red-300/10', 'text-red-50', 'border-emerald-200/30', 'bg-emerald-300/10', 'text-emerald-50');
    notice.classList.add(...(isError
        ? ['border-red-200/30', 'bg-red-300/10', 'text-red-50']
        : ['border-emerald-200/30', 'bg-emerald-300/10', 'text-emerald-50']));
}

function showLoginError(message) {
    const errorMessage = document.getElementById('loginError');
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function toggleLoginPassword() {
    const passwordInput = document.getElementById('loginPassword');
    const toggleButton = document.getElementById('loginPasswordToggle');
    const icon = document.getElementById('loginPasswordToggleIcon');
    const isVisible = passwordInput.type === 'text';
    passwordInput.type = isVisible ? 'password' : 'text';
    toggleButton.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
    toggleButton.setAttribute('aria-pressed', String(!isVisible));
    icon.classList.toggle('fa-eye', isVisible);
    icon.classList.toggle('fa-eye-slash', !isVisible);
    passwordInput.focus();
}

async function updateSchoolBranding() {
    const branding = await apiRequest('/auth/branding');
    schoolRegistrationAvailable = branding.registrationAvailable;
    document.getElementById('createAccountButton').classList.toggle('hidden', !schoolRegistrationAvailable);
    document.getElementById('registrationClosedNote').classList.toggle('hidden', schoolRegistrationAvailable);

    const schoolName = branding.schoolName || 'Your school';
    document.getElementById('loginSchoolName').textContent = schoolName;
    const logo = document.getElementById('schoolLogo');
    const placeholder = document.getElementById('schoolLogoPlaceholder');
    if (branding.schoolLogoData) {
        logo.src = branding.schoolLogoData;
        logo.classList.remove('hidden');
        placeholder.classList.add('hidden');
    } else {
        logo.removeAttribute('src');
        logo.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }
}

function handleSignupLogoChange(event) {
    const file = event.target.files[0];
    const error = document.getElementById('signupLogoError');
    const preview = document.getElementById('signupLogoPreview');
    const placeholder = document.getElementById('signupLogoPlaceholder');
    error.textContent = '';
    error.classList.add('hidden');
    schoolLogoDataUrl = '';

    if (!file) {
        preview.removeAttribute('src');
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type) || file.size > 1024 * 1024) {
        error.textContent = 'Choose a PNG, JPEG, or WebP image smaller than 1 MB.';
        error.classList.remove('hidden');
        event.target.value = '';
        preview.removeAttribute('src');
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
        if (typeof reader.result !== 'string') {
            error.textContent = 'The selected image could not be read.';
            error.classList.remove('hidden');
            return;
        }
        schoolLogoDataUrl = reader.result;
        preview.src = schoolLogoDataUrl;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
    });
    reader.addEventListener('error', () => {
        error.textContent = 'The selected image could not be read.';
        error.classList.remove('hidden');
    });
    reader.readAsDataURL(file);
}

async function handleAdminSignup(event) {
    event.preventDefault();
    const errorMessage = document.getElementById('signupError');
    const successMessage = document.getElementById('signupSuccess');
    const submitButton = document.getElementById('signupSubmit');
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
    successMessage.classList.add('hidden');

    const password = document.getElementById('signupPassword').value;
    const passwordConfirmation = document.getElementById('signupPasswordConfirm').value;
    if (password !== passwordConfirmation) {
        errorMessage.textContent = 'The passwords do not match.';
        errorMessage.classList.remove('hidden');
        return;
    }
    if (document.getElementById('signupLogo').files.length && !schoolLogoDataUrl) {
        errorMessage.textContent = 'Wait for the school logo preview to finish, or remove the selected image.';
        errorMessage.classList.remove('hidden');
        return;
    }

    submitButton.disabled = true;
    try {
        const result = await apiRequest('/auth/register-admin', {
            method: 'POST',
            body: JSON.stringify({
                name: document.getElementById('signupName').value.trim(),
                email: document.getElementById('signupEmail').value.trim().toLowerCase(),
                password,
                schoolName: document.getElementById('signupSchool').value.trim(),
                schoolLogoData: schoolLogoDataUrl || ''
            })
        });
        schoolRegistrationAvailable = false;
        document.getElementById('createAccountButton').classList.add('hidden');
        document.getElementById('registrationClosedNote').classList.remove('hidden');
        successMessage.replaceChildren(document.createTextNode(result.message));
        successMessage.classList.remove('hidden');
        submitButton.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Verification email sent';
        document.getElementById('signupPassword').value = '';
        document.getElementById('signupPasswordConfirm').value = '';
    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('hidden');
        submitButton.disabled = false;
    }
}

async function verifyAdminEmail(token) {
    showLoginScreen();
    showNotice('Verifying your email address…');
    try {
        await apiRequest('/auth/verify-admin-email', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
        await updateSchoolBranding();
        showNotice('Your email is verified. Your administrator account is ready—sign in to open the admin dashboard.');
    } catch (error) {
        showNotice(error.message, true);
    } finally {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
}

async function initializeAuthExperience() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('signupForm').addEventListener('submit', handleAdminSignup);
    document.getElementById('signupLogo').addEventListener('change', handleSignupLogoChange);

    try {
        await updateSchoolBranding();
    } catch (error) {
        schoolRegistrationAvailable = true;
        document.getElementById('createAccountButton').classList.remove('hidden');
        document.getElementById('registrationClosedNote').textContent = 'School registration could not be checked. Verify that the API is available, then reload this page.';
        document.getElementById('registrationClosedNote').classList.remove('hidden');
        console.error('Unable to load public school branding.', error);
    }

    const verifyToken = new URLSearchParams(window.location.hash.slice(1)).get('verify');
    if (verifyToken) {
        await verifyAdminEmail(verifyToken);
    } else {
        showWelcomeScreen();
    }
}

// ===================== AUTHENTICATION AND SESSION STARTUP =====================
async function handleLogin(event) {
    event.preventDefault();
    const errorMessage = document.getElementById('loginError');
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const submitButton = document.getElementById('loginSubmit');
    submitButton.disabled = true;

    try {
        const result = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        sessionStorage.setItem(API_TOKEN_KEY, result.token);
        store.currentUser = result.user;
        store.currentRole = result.user.role;
        await loadStoreData();

        document.getElementById('authExperience').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        document.getElementById('userName').textContent = result.user.name;
        document.getElementById('userRole').textContent = result.user.role.charAt(0).toUpperCase() + result.user.role.slice(1);
        document.getElementById('userAvatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(result.user.name)}&background=16a34a&color=fff`;

        renderSidebar();
        navigateTo('dashboard');
        renderActivityPanels();
    } catch (error) {
        sessionStorage.removeItem(API_TOKEN_KEY);
        store.currentUser = null;
        store.currentRole = null;
        showLoginError(error.message);
    } finally {
        submitButton.disabled = false;
    }
}

// ===================== SESSION END =====================
function logout() {
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('authExperience').classList.remove('hidden');
    showWelcomeScreen();
    store.currentUser = null;
    store.currentRole = null;
    sessionStorage.removeItem(API_TOKEN_KEY);
    document.getElementById('loginPassword').value = '';
}
