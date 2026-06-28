/* ============================================
   UMRANIGPT - Configuration
   ============================================ */
'use strict';

window.AppConfig = Object.freeze({
  APP_NAME: 'UmraniGPT',
  VERSION: '1.0.0',
  AUTHOR: 'UmraniGPT',

  /* Defaults */
  DEFAULT_THEME: 'dark',
  DEFAULT_MODEL: '',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_TOP_P: 0.9,
  DEFAULT_TOP_K: 40,
  DEFAULT_REPEAT_PENALTY: 1.1,
  DEFAULT_CONTEXT_LENGTH: 4096,
  DEFAULT_SEED: -1,
  DEFAULT_STREAMING: true,
  DEFAULT_SYSTEM_PROMPT: '',
  DEFAULT_FONT_SIZE: 15,
  DEFAULT_ANIMATIONS: true,
  DEFAULT_VOICE_SPEED: 1.0,
  DEFAULT_VOICE_PITCH: 1.0,
  DEFAULT_VOICE_VOLUME: 1.0,
  DEFAULT_VOICE_NAME: '',
  DEFAULT_LANGUAGE: 'en',
  DEFAULT_AUTO_SCROLL: true,
  DEFAULT_SHOW_TIMESTAMPS: true,
  DEFAULT_SHOW_TOKENS: false,
  DEFAULT_CODE_LINE_NUMBERS: true,
  DEFAULT_SIDEBAR_OPEN: true,

  /* Limits */
  MAX_HISTORY_ITEMS: 2000,
  MAX_FILE_SIZE_MB: 10,
  MAX_IMAGE_SIZE_MB: 5,
  MAX_CONTEXT_LENGTH: 131072,
  MIN_CONTEXT_LENGTH: 512,
  SIDEBAR_MIN_WIDTH: 180,
  SIDEBAR_MAX_WIDTH: 400,

  /* Timings */
  CONNECTION_TIMEOUT: 10000,
  RECONNECT_INTERVAL: 5000,
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 100,
  TYPING_INDICATOR_DELAY: 200,
  TOAST_DURATION: 3500,
  LATENCY_CHECK_INTERVAL: 30000,

  /* Storage Keys */
  STORAGE: {
    OLLAMA_URL: 'umrani_ollama_url',
    SETTINGS: 'umrani_settings',
    CHATS: 'umrani_chats',
    CURRENT_CHAT: 'umrani_current_chat',
    THEME: 'umrani_theme',
    SIDEBAR_WIDTH: 'umrani_sidebar_width',
    SIDEBAR_OPEN: 'umrani_sidebar_open',
    FOLDERS: 'umrani_folders',
    PINNED: 'umrani_pinned',
    FAVORITES: 'umrani_favorites',
  },

  /* Supported file types */
  SUPPORTED_FILES: {
    text: ['txt', 'md', 'markdown', 'csv', 'json', 'xml', 'html', 'htm', 'yaml', 'yml', 'log'],
    image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'],
    document: ['pdf'],
    code: ['js', 'ts', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'php', 'rb', 'sh', 'sql'],
  },

  /* Themes */
  THEMES: ['dark', 'light', 'oled', 'cyber', 'blue', 'purple', 'green', 'glass'],

  /* Ollama endpoints */
  ENDPOINTS: {
    TAGS: '/api/tags',
    CHAT: '/api/chat',
    GENERATE: '/api/generate',
    SHOW: '/api/show',
    EMBED: '/api/embed',
    VERSION: '/api/version',
    PS: '/api/ps',
  },

  /* Suggestions for welcome screen */
  SUGGESTIONS: [
    { icon: 'fa-code', title: 'Write Code', desc: 'Get help writing, reviewing, or debugging code in any language' },
    { icon: 'fa-pen-fancy', title: 'Creative Writing', desc: 'Stories, essays, poems and more with your creative assistant' },
    { icon: 'fa-magnifying-glass', title: 'Research & Analysis', desc: 'Analyze data, summarize documents, explore complex topics' },
    { icon: 'fa-robot', title: 'Brainstorm Ideas', desc: 'Generate ideas, explore concepts, think through problems' },
  ],

  /* Reaction emojis */
  REACTIONS: ['👍', '❤️', '😂', '🤔', '🔥', '👎'],
});
