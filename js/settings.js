/* ============================================
   UMRANIGPT - Settings Manager
   ============================================ */
'use strict';

window.AppSettings = (() => {
  const { $, emit } = window.AppUtils;

  let overlayEl, modalEl;
  let activePanel = 'connection';

  const init = () => {
    overlayEl = document.getElementById('settings-overlay');
    modalEl   = document.getElementById('settings-modal');
    if (!overlayEl || !modalEl) return;

    bindNav();
    bindCloseHandlers();
    bindConnectionPanel();
    bindModelPanel();
    bindAppearancePanel();
    bindVoicePanel();
    bindDataPanel();

    AppUtils.on('action:openSettings', () => open());
  };

  /* ---- Open / Close ---- */
  const open = (panel = 'connection') => {
    if (!overlayEl) return;
    loadAllValues();
    switchPanel(panel);
    overlayEl.classList.add('visible');
    AppShortcuts.disable();
  };

  const close = () => {
    overlayEl?.classList.remove('visible');
    AppShortcuts.enable();
  };

  const bindCloseHandlers = () => {
    overlayEl?.addEventListener('click', e => { if (e.target === overlayEl) close(); });
    modalEl?.querySelector('.modal-close')?.addEventListener('click', close);
  };

  /* ---- Navigation ---- */
  const bindNav = () => {
    modalEl?.querySelectorAll('.settings-nav-item').forEach(item => {
      item.addEventListener('click', () => switchPanel(item.dataset.panel));
    });
  };

  const switchPanel = (panel) => {
    activePanel = panel;
    modalEl?.querySelectorAll('.settings-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.panel === panel);
    });
    modalEl?.querySelectorAll('.settings-panel').forEach(el => {
      el.classList.toggle('active', el.id === `panel-${panel}`);
    });
  };

  /* ---- Load all values ---- */
  const loadAllValues = () => {
    const s = AppStorage.getSettings();

    // Connection — show current server URL read-only
    const urlDisplay = $('#server-url-display');
    if (urlDisplay) {
      const url = AppStorage.getServerUrl();
      urlDisplay.textContent = url || 'Not set — edit UMRANI_SERVER_URL in index.html';
      urlDisplay.style.color = url ? 'var(--status-online)' : 'var(--status-offline)';
    }

    // Model params
    setRange('#temperature-range',    '#temperature-val',    s.temperature);
    setRange('#top-p-range',          '#top-p-val',          s.topP);
    setRange('#top-k-range',          '#top-k-val',          s.topK);
    setRange('#repeat-penalty-range', '#repeat-penalty-val', s.repeatPenalty);
    setVal('#context-length-input', s.contextLength);
    setVal('#seed-input',           s.seed);
    setVal('#system-prompt-input',  s.systemPrompt);
    setToggle('#streaming-toggle',  s.streaming);

    // Appearance
    AppTheme.renderThemePreviews($('#theme-grid'));
    setRange('#font-size-range', '#font-size-val', s.fontSize, 'px');
    setToggle('#animations-toggle',   s.animations);
    setToggle('#timestamps-toggle',   s.showTimestamps);
    setToggle('#line-numbers-toggle', s.codeLineNumbers);

    // Voice
    setRange('#voice-speed-range',  '#voice-speed-val',  s.voiceSpeed);
    setRange('#voice-pitch-range',  '#voice-pitch-val',  s.voicePitch);
    setRange('#voice-volume-range', '#voice-volume-val', s.voiceVolume);
    AppVoice.populateVoiceSelect($('#voice-select'));

    // Data stats
    renderDataStats();
  };

  /* ---- Connection Panel (no URL editing — read-only display) ---- */
  const bindConnectionPanel = () => {
    $('#test-connection-btn')?.addEventListener('click', testConnection);
    $('#ping-btn')?.addEventListener('click',            pingServer);
    $('#refresh-models-btn')?.addEventListener('click',  refreshModels);
  };

  const testConnection = async () => {
    const btn = $('#test-connection-btn');
    setButtonLoading(btn, true);
    showResult('conn-test-result', 'info', '');

    try {
      const result = await OllamaService.testConnection();
      if (result.ok) {
        showResult('conn-test-result', 'success',
          `✓ Connected! Latency: ${result.latency}ms · ${result.models.length} model(s) found.`);
        AppUI.updateStatusUI('online', null, result.latency);
      } else {
        showResult('conn-test-result', 'error', `✗ ${result.error}`);
        AppUI.updateStatusUI('error', result.error?.slice(0, 50));
      }
    } catch (err) {
      showResult('conn-test-result', 'error', `✗ ${err.message}`);
    } finally {
      setButtonLoading(btn, false, '<i class="fa-solid fa-plug"></i> Test Connection');
    }
  };

  const pingServer = async () => {
    const btn = $('#ping-btn');
    setButtonLoading(btn, true);
    const start = Date.now();
    try {
      await OllamaService.testConnection();
      AppNotifications.success('Ping', `Response time: ${Date.now() - start}ms`);
    } catch {
      AppNotifications.error('Ping failed', 'Server not reachable.');
    } finally {
      setButtonLoading(btn, false, '<i class="fa-solid fa-satellite-dish"></i> Ping');
    }
  };

  const refreshModels = async () => {
    const btn = $('#refresh-models-btn');
    setButtonLoading(btn, true);
    try {
      await AppModels.refresh();
      AppNotifications.success('Models refreshed', `${AppModels.getModels().length} model(s) available.`);
    } catch (err) {
      AppNotifications.error('Refresh failed', err.message);
    } finally {
      setButtonLoading(btn, false, '<i class="fa-solid fa-rotate"></i> Refresh Models');
    }
  };

  /* ---- Model Panel ---- */
  const bindModelPanel = () => {
    bindRange('#temperature-range',    '#temperature-val',    'temperature');
    bindRange('#top-p-range',          '#top-p-val',          'topP');
    bindRange('#top-k-range',          '#top-k-val',          'topK');
    bindRange('#repeat-penalty-range', '#repeat-penalty-val', 'repeatPenalty');

    const ctxInput = $('#context-length-input');
    ctxInput?.addEventListener('change', () => {
      const v = AppUtils.clamp(parseInt(ctxInput.value), AppConfig.MIN_CONTEXT_LENGTH, AppConfig.MAX_CONTEXT_LENGTH);
      ctxInput.value = v;
      AppStorage.updateSetting('contextLength', v);
    });

    const seedInput = $('#seed-input');
    seedInput?.addEventListener('change', () => AppStorage.updateSetting('seed', parseInt(seedInput.value) || -1));

    const sysInput = $('#system-prompt-input');
    sysInput?.addEventListener('input', () => AppStorage.updateSetting('systemPrompt', sysInput.value));

    bindToggle('#streaming-toggle', 'streaming');

    $('#reset-params-btn')?.addEventListener('click', () => {
      const c = AppConfig;
      ['temperature','topP','topK','repeatPenalty','contextLength','seed'].forEach(k => {
        AppStorage.updateSetting(k, c[`DEFAULT_${k.replace(/([A-Z])/g,'_$1').toUpperCase()}`]);
      });
      loadAllValues();
      AppNotifications.success('Reset', 'Parameters reset to defaults.');
    });
  };

  /* ---- Appearance Panel ---- */
  const bindAppearancePanel = () => {
    bindRange('#font-size-range', '#font-size-val', 'fontSize', null, v => {
      document.documentElement.style.fontSize = `${v}px`;
    });
    bindToggle('#animations-toggle',   'animations',      v => document.body.classList.toggle('no-animations', !v));
    bindToggle('#timestamps-toggle',   'showTimestamps',  v => document.querySelectorAll('.message-meta').forEach(el => el.style.display = v ? '' : 'none'));
    bindToggle('#line-numbers-toggle', 'codeLineNumbers');
  };

  /* ---- Voice Panel ---- */
  const bindVoicePanel = () => {
    bindRange('#voice-speed-range',  '#voice-speed-val',  'voiceSpeed');
    bindRange('#voice-pitch-range',  '#voice-pitch-val',  'voicePitch');
    bindRange('#voice-volume-range', '#voice-volume-val', 'voiceVolume');
    $('#voice-select')?.addEventListener('change', e => AppStorage.updateSetting('voiceName', e.target.value));
    $('#test-voice-btn')?.addEventListener('click', () => AppVoice.speak('Hello! I am UmraniGPT, your AI assistant. How can I help you today?'));
    $('#stop-voice-btn')?.addEventListener('click', () => AppVoice.stopSpeaking());
  };

  /* ---- Data Panel ---- */
  const bindDataPanel = () => {
    $('#export-all-btn')?.addEventListener('click', () => { AppHistory.exportAll(); AppNotifications.success('Exported', 'All data exported.'); });
    $('#import-all-btn')?.addEventListener('click', () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
      inp.onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        const r = await AppHistory.importChats(f);
        if (r.ok) { AppNotifications.success('Imported', `${r.count} chat(s) imported.`); emit('dataImported', {}); }
        else AppNotifications.error('Import failed', r.error);
      };
      inp.click();
    });
    $('#backup-settings-btn')?.addEventListener('click', () => AppUtils.downloadFile(JSON.stringify(AppStorage.getSettings(), null, 2), 'umranigpt-settings.json', 'application/json'));
    $('#restore-settings-btn')?.addEventListener('click', () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
      inp.onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        const t = await AppUtils.readFileAsText(f);
        const d = AppUtils.safeJsonParse(t);
        if (d && typeof d === 'object') { AppStorage.setSettings(d); loadAllValues(); AppNotifications.success('Restored', 'Settings restored.'); }
        else AppNotifications.error('Error', 'Invalid settings file.');
      };
      inp.click();
    });
    $('#clear-history-btn')?.addEventListener('click', () => {
      if (confirm('Delete ALL chat history? This cannot be undone.')) {
        AppStorage.setChats({}); AppStorage.setCurrentChatId(null);
        AppNotifications.success('Cleared', 'All chat history deleted.');
        emit('historyCleared', {}); close();
      }
    });
    $('#clear-settings-btn')?.addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) { AppStorage.setSettings({}); loadAllValues(); AppNotifications.success('Reset', 'Settings reset to defaults.'); }
    });
  };

  /* ---- Stats ---- */
  const renderDataStats = () => {
    const all = AppStorage.getAllChats();
    const msgs = all.reduce((n, c) => n + (c.messages?.length || 0), 0);
    const statsEl = $('#data-stats');
    if (!statsEl) return;
    statsEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-3);">${stat('Chats', all.length, 'fa-message')}${stat('Messages', msgs, 'fa-comments')}${stat('Storage', getStorageSize(), 'fa-database')}</div>`;
  };

  const stat = (label, value, icon) => `<div style="background:var(--surface-1);border:1px solid var(--border-default);border-radius:var(--radius-md);padding:var(--space-3);text-align:center;"><i class="fa-solid ${icon}" style="color:var(--accent-primary);margin-bottom:4px;display:block;"></i><div style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);">${value}</div><div style="font-size:var(--text-xs);color:var(--text-muted);">${label}</div></div>`;

  const getStorageSize = () => { let t = 0; try { for (const k of Object.keys(localStorage)) t += (localStorage.getItem(k)||'').length*2; } catch {} return AppUtils.formatBytes(t); };

  /* ---- Helpers ---- */
  const setVal    = (sel, val)        => { const el = $(sel); if (el) el.value = val ?? ''; };
  const setRange  = (rs, vs, val, sfx = '', cb) => { const r = $(rs), v = $(vs); if (r) r.value = val; if (v) v.textContent = `${val}${sfx||''}`; cb?.(val); };
  const setToggle = (sel, val)        => { const el = $(sel); if (el) el.checked = !!val; };

  const bindRange  = (rs, vs, key, sfx = null, cb) => {
    const r = $(rs), v = $(vs); if (!r) return;
    r.addEventListener('input', () => { const val = parseFloat(r.value); if (v) v.textContent = `${val}${sfx||''}`; AppStorage.updateSetting(key, val); cb?.(val); });
  };
  const bindToggle = (sel, key, cb) => {
    const el = $(sel); if (!el) return;
    el.addEventListener('change', () => { AppStorage.updateSetting(key, el.checked); cb?.(el.checked); });
  };

  const showResult = (id, type, msg) => {
    const el = document.getElementById(id); if (!el) return;
    if (!msg) { el.style.display = 'none'; return; }
    el.className = `url-test-result ${type}`;
    el.innerHTML = `<i class="fa-solid fa-${type==='success'?'circle-check':'circle-xmark'}"></i> ${AppUtils.escapeHtml(msg)}`;
    el.style.display = 'flex';
  };

  const setButtonLoading = (btn, loading, html) => {
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading ? '<span class="spinner spinner-sm"></span>' : (html || btn.innerHTML);
  };

  return { init, open, close };
})();
