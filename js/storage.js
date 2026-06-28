/* ============================================
   UMRANIGPT - Storage Module
   ============================================ */
'use strict';

window.AppStorage = (() => {
  const { STORAGE } = window.AppConfig;
  const { safeJsonParse, safeJsonStringify } = window.AppUtils;

  /* ---- Core localStorage wrappers ---- */
  const get = (key, fallback = null) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return safeJsonParse(raw, raw);
    } catch { return fallback; }
  };

  const set = (key, value) => {
    try {
      localStorage.setItem(key, safeJsonStringify(value));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        purgeOldChats();
        try { localStorage.setItem(key, safeJsonStringify(value)); return true; }
        catch { return false; }
      }
      return false;
    }
  };

  const remove = (key) => { try { localStorage.removeItem(key); return true; } catch { return false; } };
  const clear  = (prefix = null) => {
    if (!prefix) { localStorage.clear(); return; }
    Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k));
  };

  /* ---- Server URL
   *  Priority: 1) window.UMRANI_SERVER_URL (set in index.html)
   *            2) localStorage fallback
   * ---- */
  const getServerUrl = () => {
    // Read from the HTML-level config first
    const hardcoded = window.UMRANI_SERVER_URL || '';
    if (hardcoded) return hardcoded.trim().replace(/\/+$/, '');
    // Fallback to any previously stored value
    return get(STORAGE.SERVER_URL, '');
  };

  /* kept for compatibility — writes to localStorage only (not used when hardcoded) */
  const setServerUrl = (url) => set(STORAGE.SERVER_URL, url);

  /* Legacy aliases so other modules still work unchanged */
  const getOllamaUrl = getServerUrl;
  const setOllamaUrl = setServerUrl;

  /* ---- Settings ---- */
  const getSettings = () => {
    const cfg = window.AppConfig;
    const defaults = {
      theme: cfg.DEFAULT_THEME,
      fontSize: cfg.DEFAULT_FONT_SIZE,
      animations: cfg.DEFAULT_ANIMATIONS,
      temperature: cfg.DEFAULT_TEMPERATURE,
      topP: cfg.DEFAULT_TOP_P,
      topK: cfg.DEFAULT_TOP_K,
      repeatPenalty: cfg.DEFAULT_REPEAT_PENALTY,
      contextLength: cfg.DEFAULT_CONTEXT_LENGTH,
      seed: cfg.DEFAULT_SEED,
      streaming: cfg.DEFAULT_STREAMING,
      systemPrompt: cfg.DEFAULT_SYSTEM_PROMPT,
      voiceSpeed: cfg.DEFAULT_VOICE_SPEED,
      voicePitch: cfg.DEFAULT_VOICE_PITCH,
      voiceVolume: cfg.DEFAULT_VOICE_VOLUME,
      voiceName: cfg.DEFAULT_VOICE_NAME,
      autoScroll: cfg.DEFAULT_AUTO_SCROLL,
      showTimestamps: cfg.DEFAULT_SHOW_TIMESTAMPS,
      showTokens: cfg.DEFAULT_SHOW_TOKENS,
      codeLineNumbers: cfg.DEFAULT_CODE_LINE_NUMBERS,
      language: cfg.DEFAULT_LANGUAGE,
      sidebarOpen: cfg.DEFAULT_SIDEBAR_OPEN,
    };
    return { ...defaults, ...get(STORAGE.SETTINGS, {}) };
  };

  const setSettings    = (s) => set(STORAGE.SETTINGS, s);
  const updateSetting  = (key, value) => { const s = getSettings(); s[key] = value; return setSettings(s); };

  /* ---- Chats ---- */
  const getChats    = () => { const d = get(STORAGE.CHATS, {}); return (typeof d === 'object' && !Array.isArray(d)) ? d : {}; };
  const setChats    = (c) => set(STORAGE.CHATS, c);
  const getChat     = (id) => getChats()[id] || null;
  const saveChat    = (chat) => { if (!chat?.id) return false; const c = getChats(); c[chat.id] = { ...chat, updatedAt: Date.now() }; return setChats(c); };
  const deleteChat  = (id) => { const c = getChats(); delete c[id]; return setChats(c); };
  const getAllChats  = () => Object.values(getChats()).sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0));

  const getCurrentChatId  = () => get(STORAGE.CURRENT_CHAT, null);
  const setCurrentChatId  = (id) => set(STORAGE.CURRENT_CHAT, id);

  /* ---- Folders ---- */
  const getFolders  = () => get(STORAGE.FOLDERS, []);
  const setFolders  = (f) => set(STORAGE.FOLDERS, f);
  const addFolder   = (name) => { const f = getFolders(); const folder = { id: window.AppUtils.generateId(), name, chatIds: [], createdAt: Date.now() }; f.push(folder); setFolders(f); return folder; };
  const deleteFolder = (id) => setFolders(getFolders().filter(f => f.id !== id));
  const moveChatToFolder = (chatId, folderId) => {
    const folders = getFolders();
    folders.forEach(f => { f.chatIds = f.chatIds.filter(id => id !== chatId); });
    if (folderId) { const f = folders.find(f => f.id === folderId); if (f && !f.chatIds.includes(chatId)) f.chatIds.push(chatId); }
    setFolders(folders);
  };

  /* ---- Pinned ---- */
  const getPinned   = () => get(STORAGE.PINNED, []);
  const setPinned   = (ids) => set(STORAGE.PINNED, ids);
  const pinChat     = (id) => { const p = getPinned(); if (!p.includes(id)) { p.unshift(id); setPinned(p); } };
  const unpinChat   = (id) => setPinned(getPinned().filter(p => p !== id));
  const isChatPinned = (id) => getPinned().includes(id);

  /* ---- Favourites ---- */
  const getFavourites  = () => get(STORAGE.FAVORITES, []);
  const setFavourites  = (ids) => set(STORAGE.FAVORITES, ids);
  const toggleFavourite = (id) => { const f = getFavourites(); const i = f.indexOf(id); if (i===-1) f.unshift(id); else f.splice(i,1); setFavourites(f); return i===-1; };
  const isChatFavourite = (id) => getFavourites().includes(id);

  /* ---- Purge ---- */
  const purgeOldChats = () => {
    const all = getAllChats(); const max = window.AppConfig.MAX_HISTORY_ITEMS;
    if (all.length > max) { const rem = getChats(); all.slice(max).forEach(c => delete rem[c.id]); setChats(rem); }
  };

  /* ---- Export / Import ---- */
  const exportAllData = () => ({ version: window.AppConfig.VERSION, exportedAt: Date.now(), settings: getSettings(), chats: getAllChats(), folders: getFolders(), pinned: getPinned(), favourites: getFavourites() });
  const importData = (data) => {
    if (!data || typeof data !== 'object') return false;
    try {
      if (data.settings) setSettings(data.settings);
      if (Array.isArray(data.chats)) { const c = {}; data.chats.forEach(ch => { if (ch?.id) c[ch.id] = ch; }); setChats(c); }
      if (Array.isArray(data.folders))    setFolders(data.folders);
      if (Array.isArray(data.pinned))     setPinned(data.pinned);
      if (Array.isArray(data.favourites)) setFavourites(data.favourites);
      return true;
    } catch { return false; }
  };

  /* ---- Sidebar ---- */
  const getSidebarWidth = () => get(STORAGE.SIDEBAR_WIDTH, null);
  const setSidebarWidth = (w) => set(STORAGE.SIDEBAR_WIDTH, w);
  const getSidebarOpen  = () => get(STORAGE.SIDEBAR_OPEN, true);
  const setSidebarOpen  = (v) => set(STORAGE.SIDEBAR_OPEN, v);

  return {
    get, set, remove, clear,
    getServerUrl, setServerUrl,
    getOllamaUrl, setOllamaUrl,          // legacy aliases
    getSettings, setSettings, updateSetting,
    getChats, setChats, getChat, saveChat, deleteChat, getAllChats,
    getCurrentChatId, setCurrentChatId,
    getFolders, setFolders, addFolder, deleteFolder, moveChatToFolder,
    getPinned, setPinned, pinChat, unpinChat, isChatPinned,
    getFavourites, setFavourites, toggleFavourite, isChatFavourite,
    exportAllData, importData,
    getSidebarWidth, setSidebarWidth, getSidebarOpen, setSidebarOpen,
  };
})();
