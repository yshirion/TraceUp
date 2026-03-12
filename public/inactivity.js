// ═══ Auto-logout after 2 minutes of inactivity ═══
(function () {
    const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
    const HEARTBEAT_MS = 30 * 1000;   // ping server every 30s while active
    let logoutTimer;
    let heartbeatInterval;
    let isActive = false;

    function resetTimer() {
        isActive = true;
        clearTimeout(logoutTimer);
        logoutTimer = setTimeout(autoLogout, TIMEOUT_MS);
    }

    async function autoLogout() {
        clearInterval(heartbeatInterval);
        try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { }
        window.location.href = 'login.html';
    }

    // Heartbeat: ping server every 30s while user is active
    // This keeps the rolling session alive on the server side
    heartbeatInterval = setInterval(async () => {
        if (isActive) {
            try {
                const res = await fetch('/api/auth/me');
                const data = await res.json();
                if (!data.authenticated) {
                    window.location.href = 'login.html';
                    return;
                }
            } catch { }
            isActive = false; // reset, will be set to true on next user activity
        }
    }, HEARTBEAT_MS);

    // Track user activity
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
        document.addEventListener(evt, resetTimer, { passive: true });
    });

    resetTimer();
})();
