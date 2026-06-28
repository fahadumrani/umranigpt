/* ============================================
   UMRANIGPT - UI State Manager
   ============================================ */
'use strict';

window.AppUI = (() => {
  const { $, emit, on, debounce } = window.AppUtils;

  let statusState = 'connecting';
  let latencyCheckInterval = null;
  let latencyMs = null;
  let retryCount = 0;

  /* ---- Init ---- */
  const init = () => {
    applyFontSize();
    setupConnectionMonitor();
    setupHeaderActions();
    bindWindowEvents();
    updateStatusUI('connecting');

    on('urlChanged', ({ url }) => {
      if (url) { checkConnection(); }
      else { updateStatusUI('offline', 'No server configured'); stopConnectionMonitor(); }
    });

    on('modelsLoaded', () => updateStatusUI('online'));

    on('sidebarToggled', ({ open }) => {
      const toggle = document.getElementById('sidebar-toggle-btn');
      if (toggle) {
        const icon = toggle.querySelector('i');
        if (icon) icon.className = open ? 'fa-solid fa-angles-left' : 'fa-solid fa-angles-right';
      }
    });
  };

  /* ---- Font size ---- */
  const applyFontSize = () => {
    const s = AppStorage.getSettings();
    if (s.fontSize) document.documentElement.style.fontSize = `${s.fontSize}px`;
    if (!s.animations) document.body.classList.add('no-animations');
  };

  /* ---- Connection monitor ---- */
  const setupConnectionMonitor = () => {
    const url = AppStorage.getServerUrl();
    if (!url) { updateStatusUI('offline', 'Server URL not set in index.html'); return; }
    checkConnection();
    startConnectionMonitor();
  };

  const startConnectionMonitor = () => {
    stopConnectionMonitor();
    latencyCheckInterval = setInterval(checkConnection, AppConfig.LATENCY_CHECK_INTERVAL);
  };

  const stopConnectionMonitor = () => {
    if (latencyCheckInterval) { clearInterval(latencyCheckInterval); latencyCheckInterval = null; }
  };

  const checkConnection = async () => {
    const url = AppStorage.getServerUrl();
    if (!url) { updateStatusUI('offline', 'Server URL not set'); return; }
    updateStatusUI('connecting');
    try {
      const result = await OllamaService.testConnection();
      if (result.ok) {
        latencyMs = result.latency;
        retryCount = 0;
        updateStatusUI('online', null, result.latency);
        if (AppModels.getModels().length === 0) await AppModels.refresh();
      } else { throw new Error(result.error); }
    } catch (err) {
      retryCount++;
      updateStatusUI(retryCount >= 3 ? 'offline' : 'error',
        retryCount >= 3 ? 'Connection failed' : err.message?.slice(0, 50));
    }
  };

  /* ---- Status UI ---- */
  const updateStatusUI = (state, msg = null, latency = null) => {
    statusState = state;
    const dot      = document.getElementById('status-dot');
    const text     = document.getElementById('status-text');
    const latEl    = document.getElementById('status-latency');
    if (!dot || !text) return;

    dot.className = 'status-dot ' + state;

    const labels = {
      online:     '🟢 Connected',
      connecting: '🟡 Connecting',
      offline:    '🔴 Offline',
      error:      '⚠ Error',
    };
    text.textContent = msg || labels[state] || state;

    if (latEl) {
      if (latency !== null && state === 'online') {
        latEl.textContent = `${latency}ms`;
        latEl.className = `latency-pill ${latency < 100 ? 'fast' : latency < 500 ? 'medium' : 'slow'}`;
        latEl.style.display = '';
      } else { latEl.style.display = 'none'; }
    }
  };

  /* ---- Header actions ---- */
  const setupHeaderActions = () => {
    document.getElementById('connection-status')?.addEventListener('click', () => {
      if (statusState !== 'online') AppSettings.open('connection');
      else checkConnection();
    });

    document.getElementById('clear-chat-btn')?.addEventListener('click', () => {
      if (confirm('Clear this chat? This cannot be undone.')) AppChat.newChat();
    });

    document.getElementById('export-chat-btn')?.addEventListener('click', () => {
      const chat = AppChat.getCurrentChat();
      if (chat) AppHistory.exportChat(chat.id);
      else AppNotifications.warning('Nothing to export', 'No active chat.');
    });

    document.getElementById('sidebar-toggle-btn')?.addEventListener('click', () => {
      emit('action:toggleSidebar', {});
    });
  };

  /* ---- Window events ---- */
  const bindWindowEvents = () => {
    window.addEventListener('online',  () => checkConnection());
    window.addEventListener('offline', () => updateStatusUI('offline', 'No internet connection'));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && AppStorage.getServerUrl()) checkConnection();
    });
    window.addEventListener('resize', debounce(() => {
      emit('windowResized', { width: window.innerWidth, height: window.innerHeight });
    }, 200));
  };

  /* ---- PWA install ---- */
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; showInstallBanner(); });

  const showInstallBanner = () => {
    if (document.getElementById('install-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--surface-2);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:12px 16px;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow-lg);z-index:var(--z-toast);animation:fadeInUp 0.3s ease forwards;backdrop-filter:var(--backdrop-blur);font-size:var(--text-sm);`;
    banner.innerHTML = `<i class="fa-solid fa-download" style="color:var(--accent-primary);"></i><span style="color:var(--text-primary);">Install UmraniGPT as an app</span><button onclick="AppUI.triggerInstall()" style="padding:5px 12px;background:var(--accent-gradient);border:none;border-radius:var(--radius-sm);color:white;font-size:12px;cursor:pointer;font-weight:600;">Install</button><button onclick="this.closest('#install-banner').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;"><i class="fa-solid fa-xmark"></i></button>`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 15000);
  };

  const triggerInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') AppNotifications.success('Installed!', 'UmraniGPT added to your home screen.');
    installPrompt = null;
    document.getElementById('install-banner')?.remove();
  };

  /* ---- Loading screen ---- */
  const hideLoadingScreen = () => {
    const ls = document.getElementById('loading-screen');
    if (!ls) return;
    setTimeout(() => { ls.classList.add('hidden'); setTimeout(() => ls.remove(), 500); }, 800);
  };

  const getStatus  = () => statusState;
  const getLatency = () => latencyMs;

  return { init, checkConnection, updateStatusUI, hideLoadingScreen, triggerInstall, getStatus, getLatency };
})();
