/* ============================================
   UMRANIGPT - Application Bootstrap
   ============================================ */
'use strict';

window.App = (() => {
  let initialised = false;

  /* ---- Initialise all modules in order ---- */
  const init = async () => {
    if (initialised) return;
    initialised = true;

    try {
      // Animate loading dots
      animateLoadingDots();

      // Step 1: Security
      AppSecurity.init();

      // Step 2: Theme (apply immediately to prevent flash)
      AppTheme.init();

      // Step 3: Notifications
      AppNotifications.init();

      // Step 4: History
      AppHistory.init();

      // Step 5: Markdown + Code highlighting
      AppMarkdown.init();

      // Step 6: Voice
      AppVoice.init();

      // Step 7: Keyboard shortcuts
      AppShortcuts.init();

      // Step 8: Settings modal
      AppSettings.init();

      // Step 9: Sidebar
      AppSidebar.init();

      // Step 10: Model selector
      await AppModels.init();

      // Step 11: File drag & drop
      AppDragDrop.init((files) => {
        AppUtils.emit('fileAdded', files);
      });

      // Step 12: UI state manager & connection monitor
      AppUI.init();

      // Step 13: Chat engine (must be last)
      AppChat.init();

      // Register service worker
      registerServiceWorker();

      // Hide loading screen
      AppUI.hideLoadingScreen();

      // Start connection + model fetch if URL is set
      const url = AppStorage.getOllamaUrl();
      if (url) {
        setTimeout(() => AppModels.refresh(), 500);
      }

      console.log('%c✨ UmraniGPT v' + AppConfig.VERSION + ' loaded',
        'background: linear-gradient(135deg, #8b5cf6, #ec4899); color: white; padding: 6px 12px; border-radius: 6px; font-weight: bold;');

    } catch (err) {
      console.error('App init error:', err);
      AppNotifications.error('Startup Error', err.message || 'Failed to initialise app');
    }
  };

  /* ---- Service Worker ---- */
  const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            AppNotifications.info('Update available', 'Reload to apply the latest version.');
          }
        });
      });
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  };

  /* ---- Loading dots animation ---- */
  const animateLoadingDots = () => {
    const dots = document.querySelectorAll('.loading-dot');
    dots.forEach((dot, i) => {
      setTimeout(() => dot.style.opacity = '1', i * 150);
    });
  };

  /* ---- Global error handler ---- */
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('Unhandled promise rejection:', e.reason);
  });

  window.addEventListener('error', (e) => {
    console.error('Global error:', e.message);
  });

  return { init };
})();

/* ---- Boot when DOM is ready ---- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.init);
} else {
  App.init();
}
