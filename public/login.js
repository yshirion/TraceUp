// Check if already logged in
(async () => {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated) {
            window.location.href = 'index.html';
        }
    } catch { }
})();

function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    if (tab === 'login') {
        document.querySelector('.auth-tab:nth-child(1)').classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.querySelector('.auth-tab:nth-child(2)').classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    }
    setStatus(null);
}

function setStatus(type, message) {
    const el = document.getElementById('status');
    if (!type) { el.innerHTML = ''; return; }
    const icon = type === 'loading' ? '<div class="spinner"></div>' : '';
    el.innerHTML = `<div class="status-message status-${type}">${icon} ${message}</div>`;
}

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnLogin');
    btn.disabled = true;
    btn.textContent = 'Logging in...';
    setStatus('loading', 'Authenticating...');

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('loginUsername').value,
                password: document.getElementById('loginPassword').value
            })
        });
        const data = await res.json();

        if (data.success) {
            setStatus('success', 'Welcome back! Redirecting...');
            setTimeout(() => window.location.href = 'index.html', 500);
        } else {
            setStatus('error', data.error);
        }
    } catch (err) {
        setStatus('error', err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Login';
    }
});

// Register
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;

    if (pass !== confirm) {
        setStatus('error', 'Passwords do not match');
        return;
    }

    const btn = document.getElementById('btnRegister');
    btn.disabled = true;
    btn.textContent = 'Creating account...';
    setStatus('loading', 'Setting up your account...');

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('regUsername').value,
                password: pass
            })
        });
        const data = await res.json();

        if (data.success) {
            setStatus('success', 'Account created! Redirecting...');
            setTimeout(() => window.location.href = 'index.html', 500);
        } else {
            setStatus('error', data.error);
        }
    } catch (err) {
        setStatus('error', err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
});
