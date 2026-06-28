/* ============================================
   UMRANIGPT - Settings Manager
   ============================================ */
'use strict';

window.AppSettings = (() => {
  const { $, emit, normaliseUrl, isValidUrl, formatDate } = window.AppUtils;

  let overlayEl, modalEl;
  let activePanel = 'connection';
  let testAbortController = null;

  const init = () => {
    overlayEl = document.getElementById('settings-overlay');
    modalEl = document.getElementById('settings-modal');
    if (!overlayEl || !modalEl) return;

    bindNav();
    bindCloseHandlers();

    // Bind all control events
    bindConnectionPanel();
    bindModelPanel();
    bindAppearancePanel();
    bindVoicePanel();
    bindDataPanel();

    // Listen for external open request
    AppUtils.on('action:openSettings', () => open());
  };

  /* ---- Open/Close ---- */
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
    if (testAbortController) { testAbortController.abort(); testAbortController = null; }
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

  /* ---- Load all values from storage ---- */
  const loadAllValues = () => {
    const settings = AppStorage.getSettings();
    const url = AppStorage.getOllamaUrl();

    // Connection
    setVal('#ollama-url-input', url);

    // Model params
    setRange('#temperature-range', '#temperature-val', settings.temperature);
    setRange('#top-p-range', '#top-p-val', settings.topP);
    setRange('#top-k-range', '#top-k-val', settings.topK);
    setRange('#repeat-penalty-range', '#repeat-penalty-val', settings.repeatPenalty);
    setVal('#context-length-input', settings.contextLength);
    setVal('#seed-input', settings.seed);
    setVal('#system-prompt-input', settings.systemPrompt);
    setToggle('#streaming-toggle', settings.streaming);

    // Appearance
    AppTheme.renderThemePreviews($('#theme-grid'));
    setRange('#font-size-range', '#font-size-val', settings.fontSize, 'px');
    setToggle('#animations-toggle', settings.animations);
    setToggle('#timestamps-toggle', settings.showTimestamps);
    setToggle('#line-numbers-toggle', settings.codeLineNumbers);

    // Voice
    setRange('#voice-speed-range', '#voice-speed-val', settings.voiceSpeed);
    setRange('#voice-pitch-range', '#voice-pitch-val', settings.voicePitch);
    setRange('#voice-volume-range', '#voice-volume-val', settings.voiceVolume);
    AppVoice.populateVoiceSelect($('#voice-select'));

    // Data stats
    renderDataStats();
  };

  /* ---- Connection Panel ---- */
  const bindConnectionPanel = () => {
    const saveBtn = $('#save-url-btn');
    const testBtn = $('#test-connection-btn');
    const pingBtn = $('#ping-btn');
    const refreshBtn = $('#refresh-models-btn');
    const deleteBtn = $('#delete-url-btn');

    saveBtn?.addEventListener('click', saveUrl);
    testBtn?.addEventListener('click', testConnection);
    pingBtn?.addEventListener('click', pingServer);
    refreshBtn?.addEventListener('click', refreshModels);
    deleteBtn?.addEventListener('click', deleteUrl);

    const input = $('#ollama-url-input');
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') saveUrl(); });
  };

  const saveUrl = () => {
    const input = $('#ollama-url-input');
    if (!input) return;
    const raw = input.value.trim();
    const url = AppUtils.normaliseUrl(raw);

    if (!url) {
      AppStorage.setOllamaUrl('');
      AppNotifications.info('URL cleared');
      emit('urlChanged', { url: '' });
      return;
    }

    if (!isValidUrl(url)) {
      showResult('url-test-result', 'error', 'Invalid URL format.');
      return;
    }

    AppStorage.setOllamaUrl(url);
    input.value = url;
    AppNotifications.success('Saved', 'Ollama URL saved successfully.');
    emit('urlChanged', { url });
    hideResult('url-test-result');
  };

  const testConnection = async () => {
    const url = AppUtils.normaliseUrl($('#ollama-url-input')?.value || '');
    if (!url) { showResult('url-test-result', 'error', 'Please enter a URL first.'); return; }

    const btn = $('#test-connection-btn');
    setButtonLoading(btn, true, 'Testing...');
    hideResult('url-test-result');

    try {
      const orig = AppStorage.getOllamaUrl();
      AppStorage.setOllamaUrl(url);
      const result = await OllamaService.testConnection();
      AppStorage.setOllamaUrl(orig);

      if (result.ok) {
        showResult('url-test-result', 'success',
          `✓ Connected! Latency: ${result.latency}ms · ${result.models.length} model(s) found.`);
      } else {
        showResult('url-test-result', 'error', `✗ Failed: ${result.error}`);
      }
    } catch (err) {
      showResult('url-test-result', 'error', `✗ Error: ${err.message}`);
    } finally {
      setButtonLoading(btn, false, '<i class="fa-solid fa-plug"></i> Test Connection');
    }
  };

  const pingServer = async () => {
    const url = AppUtils.normaliseUrl($('#ollama-url-input')?.value || '');
    if (!url) { AppNotifications.warning('No URL', 'Enter a URL first.'); return; }

    const btn = $('#ping-btn');
    setButtonLoading(btn, true, 'Pinging...');

    const start = Date.now();
    try {
      AppStorage.setOllamaUrl(url);
      await OllamaService.testConnection();
      const ms = Date.now() - start;
      AppNotifications.success('Ping', `Response time: ${ms}ms`);
    } catch {
      AppNotifications.error('Ping failed', 'Server not reachable.');
    } finally {
      setButtonLoading(btn, false, '<i class="fa-solid fa-satellite-dish"></i> Ping');
    }
  };

  const refreshModels = async () => {
    const url = AppUtils.normaliseUrl($('#ollama-url-input')?.value || '');
    if (url) AppStorage.setOllamaUrl(url);
    const btn = $('#refresh-models-btn');
    setButtonLoading(btn, true, 'Refreshing...');
    try {
      await AppModels.refresh();
      AppNotifications.success('Models refreshed', `${AppModels.getModels().length} model(s) available.`);
    } catch (err) {
      AppNotifications.error('Refresh failed', err.message);
    } finally {
      setButtonLoading(btn, false, '<i class="fa-solid fa-rotate"></i> Refresh Models');
    }
  };

  const deleteUrl = () => {
    AppStorage.setOllamaUrl('');
    const input = $('#ollama-url-input');
    if (input) input.value = '';
    hideResult('url-test-result');
    AppNotifications.info('URL removed');
    emit('urlChanged', { url: '' });
  };

  /* ---- Model Params Panel ---- */
  const bindModelPanel = () => {
    bindRange('#temperature-range', '#temperature-val', 'temperature');
    bindRange('#top-p-range', '#top-p-val', 'topP');
    bindRange('#top-k-range', '#top-k-val', 'topK');
    bindRange('#repeat-penalty-range', '#repeat-penalty-val', 'repeatPenalty');

    const ctxInput = $('#context-length-input');
    ctxInput?.addEventListener('change', () => {
      const val = parseInt(ctxInput.value);
      const clamped = AppUtils.clamp(val,
        AppConfig.MIN_CONTEXT_LENGTH, AppConfig.MAX_CONTEXT_LENGTH);
      ctxInput.value = clamped;
      AppStorage.updateSetting('contextLength', clamped);
    });

    const seedInput = $('#seed-input');
    seedInput?.addEventListener('change', () => {
      AppStorage.updateSetting('seed', parseInt(seedInput.value) || -1);
    });

    const systemInput = $('#system-prompt-input');
    systemInput?.addEventListener('input', () => {
      AppStorage.updateSetting('systemPrompt', systemInput.value);
    });

    bindToggle('#streaming-toggle', 'streaming');

    $('#reset-params-btn')?.addEventListener('click', () => {
      const cfg = AppConfig;
      AppStorage.updateSetting('temperature', cfg.DEFAULT_TEMPERATURE);
      AppStorage.updateSetting('topP', cfg.DEFAULT_TOP_P);
      AppStorage.updateSetting('topK', cfg.DEFAULT_TOP_K);
      AppStorage.updateSetting('repeatPenalty', cfg.DEFAULT_REPEAT_PENALTY);
      AppStorage.updateSetting('contextLength', cfg.DEFAULT_CONTEXT_LENGTH);
      AppStorage.updateSetting('seed', cfg.DEFAULT_SEED);
      loadAllValues();
      AppNotifications.success('Reset', 'Parameters reset to defaults.');
    });
  };

  /* ---- Appearance Panel ---- */
  const bindAppearancePanel = () => {
    bindRange('#font-size-range', '#font-size-val', 'fontSize', null, (v) => {
      document.documentElement.style.fontSize = `${v}px`;
    });

    bindToggle('#animations-toggle', 'animations', (v) => {
      document.body.classList.toggle('no-animations', !v);
    });

    bindToggle('#timestamps-toggle', 'showTimestamps', (v) => {
      document.querySelectorAll('.message-meta').forEach(el => {
        el.style.display = v ? '' : 'none';
      });
    });

    bindToggle('#line-numbers-toggle', 'codeLineNumbers');
  };

  /* ---- Voice Panel ---- */
  const bindVoicePanel = () => {
    bindRange('#voice-speed-range', '#voice-speed-val', 'voiceSpeed');
    bindRange('#voice-pitch-range', '#voice-pitch-val', 'voicePitch');
    bindRange('#voice-volume-range', '#voice-volume-val', 'voiceVolume');

    const voiceSelect = $('#voice-select');
    voiceSelect?.addEventListener('change', () => {
      AppStorage.updateSetting('voiceName', voiceSelect.value);
    });

    $('#test-voice-btn')?.addEventListener('click', () => {
      AppVoice.speak('Hello! I am UmraniGPT, your AI assistant. How can I help you today?');
    });

    $('#stop-voice-btn')?.addEventListener('click', () => AppVoice.stopSpeaking());
  };

  /* ---- Data Panel ---- */
  const bindDataPanel = () => {
    $('#export-all-btn')?.addEventListener('click', () => {
      AppHistory.exportAll();
      AppNotifications.success('Exported', 'All data exported.');
    });

    $('#import-all-btn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const result = await AppHistory.importChats(file);
        if (result.ok) {
          AppNotifications.success('Imported', `${result.count} chat(s) imported.`);
          emit('dataImported', {});
        } else {
          AppNotifications.error('Import failed', result.error);
        }
      };
      input.click();
    });

    $('#backup-settings-btn')?.addEventListener('click', () => {
      const settings = AppStorage.getSettings();
      AppUtils.downloadFile(JSON.stringify(settings, null, 2),
        'umranigpt-settings.json', 'application/json');
    });

    $('#restore-settings-btn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await AppUtils.readFileAsText(file);
        const data = AppUtils.safeJsonParse(text);
        if (data && typeof data === 'object') {
          AppStorage.setSettings(data);
          loadAllValues();
          AppNotifications.success('Restored', 'Settings restored.');
        } else {
          AppNotifications.error('Error', 'Invalid settings file.');
        }
      };
      input.click();
    });

    $('#clear-history-btn')?.addEventListener('click', () => {
      if (confirm('Delete ALL chat history? This cannot be undone.')) {
        AppStorage.setChats({});
        AppStorage.setCurrentChatId(null);
        AppNotifications.success('Cleared', 'All chat history deleted.');
        emit('historyCleared', {});
        close();
      }
    });

    $('#clear-settings-btn')?.addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) {
        AppStorage.setSettings({});
        loadAllValues();
        AppNotifications.success('Reset', 'Settings reset to defaults.');
      }
    });
  };

  const renderDataStats = () => {
    const all = AppStorage.getAllChats();
    const msgCount = all.reduce((n, c) => n + (c.messages?.length || 0), 0);

    const statsEl = $('#data-stats');
    if (!statsEl) return;
    statsEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-3);">
        ${stat('Chats', all.length, 'fa-message')}
        ${stat('Messages', msgCount, 'fa-comments')}
        ${stat('Storage', getStorageSize(), 'fa-database')}
      </div>
    `;
  };

  const stat = (label, value, icon) => `
    <div style="background:var(--surface-1);border:1px solid var(--border-default);border-radius:var(--radius-md);padding:var(--space-3);text-align:center;">
      <i class="fa-solid ${icon}" style="color:var(--accent-primary);margin-bottom:4px;display:block;"></i>
      <div style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);">${value}</div>
      <div style="font-size:var(--text-xs);color:var(--text-muted);">${label}</div>
    </div>
  `;

  const getStorageSize = () => {
    let total = 0;
    try {
      for (const key of Object.keys(localStorage)) {
        total += (localStorage.getItem(key) || '').length * 2;
      }
    } catch {}
    return AppUtils.formatBytes(total);
  };

  /* ---- Helpers ---- */
  const setVal = (sel, val) => {
    const el = $(sel);
    if (el) el.value = val ?? '';
  };

  const setRange = (rangeSel, valSel, val, suffix = '', callback) => {
    const range = $(rangeSel);
    const valEl = $(valSel);
    if (range) range.value = val;
    if (valEl) valEl.textContent = `${val}${suffix || ''}`;
    if (callback) callback(val);
  };

  const setToggle = (sel, val) => {
    const el = $(sel);
    if (el) el.checked = !!val;
  };

  const bindRange = (rangeSel, valSel, settingKey, suffix = null, callback) => {
    const range = $(rangeSel);
    const valEl = $(valSel);
    if (!range) return;
    range.addEventListener('input', () => {
      const v = parseFloat(range.value);
      if (valEl) valEl.textContent = `${v}${suffix || ''}`;
      AppStorage.updateSetting(settingKey, v);
      callback?.(v);
    });
  };

  const bindToggle = (sel, settingKey, callback) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener('change', () => {
      AppStorage.updateSetting(settingKey, el.checked);
      callback?.(el.checked);
    });
  };

  const showResult = (id, type, msg) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `url-test-result ${type}`;
    el.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-xmark'}"></i> ${AppUtils.escapeHtml(msg)}`;
    el.style.display = 'flex';
  };

  const hideResult = (id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  };

  const setButtonLoading = (btn, loading, html) => {
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading
      ? '<span class="spinner spinner-sm"></span>'
      : html;
  };

  return { init, open, close };
})();
