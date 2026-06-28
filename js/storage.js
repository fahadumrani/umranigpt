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
    } catch {
      return fallback;
    }
  };

  const set = (key, value) => {
    try {
      localStorage.setItem(key, safeJsonStringify(value));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('Storage quota exceeded, purging old chats...');
        purgeOldChats();
        try {
          localStorage.setItem(key, safeJsonStringify(value));
          return true;
        } catch { return false; }
      }
      return false;
    }
  };

  const remove = (key) => {
    try { localStorage.removeItem(key); return true; }
    catch { return false; }
  };

  const clear = (prefix = null) => {
    if (!prefix) {
      localStorage.clear();
      return;
    }
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
    keys.forEach(k => localStorage.removeItem(k));
  };

  /* ---- Ollama URL ---- */
  const getOllamaUrl = () => get(STORAGE.OLLAMA_URL, '');
  const setOllamaUrl = (url) => set(STORAGE.OLLAMA_URL, url);

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
    const stored = get(STORAGE.SETTINGS, {});
    return { ...defaults, ...stored };
  };

  const setSettings = (settings) => set(STORAGE.SETTINGS, settings);

  const updateSetting = (key, value) => {
    const settings = getSettings();
    settings[key] = value;
    return setSettings(settings);
  };

  /* ---- Chats ---- */
  const getChats = () => {
    const data = get(STORAGE.CHATS, {});
    return typeof data === 'object' && !Array.isArray(data) ? data : {};
  };

  const setChats = (chats) => set(STORAGE.CHATS, chats);

  const getChat = (id) => {
    const chats = getChats();
    return chats[id] || null;
  };

  const saveChat = (chat) => {
    if (!chat?.id) return false;
    const chats = getChats();
    chats[chat.id] = { ...chat, updatedAt: Date.now() };
    return setChats(chats);
  };

  const deleteChat = (id) => {
    const chats = getChats();
    delete chats[id];
    return setChats(chats);
  };

  const getAllChats = () => {
    const chats = getChats();
    return Object.values(chats).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  };

  const getCurrentChatId = () => get(STORAGE.CURRENT_CHAT, null);
  const setCurrentChatId = (id) => set(STORAGE.CURRENT_CHAT, id);

  /* ---- Folders ---- */
  const getFolders = () => get(STORAGE.FOLDERS, []);
  const setFolders = (folders) => set(STORAGE.FOLDERS, folders);

  const addFolder = (name) => {
    const folders = getFolders();
    const folder = { id: window.AppUtils.generateId(), name, chatIds: [], createdAt: Date.now() };
    folders.push(folder);
    setFolders(folders);
    return folder;
  };

  const deleteFolder = (folderId) => {
    const folders = getFolders().filter(f => f.id !== folderId);
    setFolders(folders);
  };

  const moveChatToFolder = (chatId, folderId) => {
    const folders = getFolders();
    // Remove from all folders first
    folders.forEach(f => { f.chatIds = f.chatIds.filter(id => id !== chatId); });
    if (folderId) {
      const folder = folders.find(f => f.id === folderId);
      if (folder && !folder.chatIds.includes(chatId)) folder.chatIds.push(chatId);
    }
    setFolders(folders);
  };

  /* ---- Pinned ---- */
  const getPinned = () => get(STORAGE.PINNED, []);
  const setPinned = (ids) => set(STORAGE.PINNED, ids);

  const pinChat = (id) => {
    const pinned = getPinned();
    if (!pinned.includes(id)) { pinned.unshift(id); setPinned(pinned); }
  };

  const unpinChat = (id) => {
    const pinned = getPinned().filter(p => p !== id);
    setPinned(pinned);
  };

  const isChatPinned = (id) => getPinned().includes(id);

  /* ---- Favourites ---- */
  const getFavourites = () => get(STORAGE.FAVORITES, []);
  const setFavourites = (ids) => set(STORAGE.FAVORITES, ids);

  const toggleFavourite = (id) => {
    const favs = getFavourites();
    const idx = favs.indexOf(id);
    if (idx === -1) favs.unshift(id);
    else favs.splice(idx, 1);
    setFavourites(favs);
    return idx === -1;
  };

  const isChatFavourite = (id) => getFavourites().includes(id);

  /* ---- Purge old chats to free space ---- */
  const purgeOldChats = () => {
    const chats = getAllChats();
    const max = window.AppConfig.MAX_HISTORY_ITEMS;
    if (chats.length > max) {
      const toDelete = chats.slice(max);
      const remaining = getChats();
      toDelete.forEach(c => delete remaining[c.id]);
      setChats(remaining);
    }
  };

  /* ---- Export / Import ---- */
  const exportAllData = () => {
    return {
      version: window.AppConfig.VERSION,
      exportedAt: Date.now(),
      settings: getSettings(),
      chats: getAllChats(),
      folders: getFolders(),
      pinned: getPinned(),
      favourites: getFavourites(),
    };
  };

  const importData = (data) => {
    if (!data || typeof data !== 'object') return false;
    try {
      if (data.settings) setSettings(data.settings);
      if (Array.isArray(data.chats)) {
        const chats = {};
        data.chats.forEach(c => { if (c?.id) chats[c.id] = c; });
        setChats(chats);
      }
      if (Array.isArray(data.folders)) setFolders(data.folders);
      if (Array.isArray(data.pinned)) setPinned(data.pinned);
      if (Array.isArray(data.favourites)) setFavourites(data.favourites);
      return true;
    } catch { return false; }
  };

  /* ---- Sidebar ---- */
  const getSidebarWidth = () => get(STORAGE.SIDEBAR_WIDTH, null);
  const setSidebarWidth = (w) => set(STORAGE.SIDEBAR_WIDTH, w);
  const getSidebarOpen = () => get(STORAGE.SIDEBAR_OPEN, true);
  const setSidebarOpen = (v) => set(STORAGE.SIDEBAR_OPEN, v);

  return {
    get, set, remove, clear,
    getOllamaUrl, setOllamaUrl,
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
