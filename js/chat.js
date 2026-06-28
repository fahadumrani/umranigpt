/* ============================================
   UMRANIGPT - Chat Engine
   ============================================ */
'use strict';

window.AppChat = (() => {
  const { $, emit, on, generateId, isScrolledToBottom, scrollToBottom,
          escapeHtml, copyToClipboard, formatTime, estimateTokens } = window.AppUtils;

  let currentChat = null;
  let isGenerating = false;
  let pendingFiles = [];
  let streamBuffer = '';
  let streamMsgEl = null;
  let streamContentEl = null;
  let autoScroll = true;

  /* ---- Init ---- */
  const init = () => {
    bindInput();
    bindSendButton();
    bindScrollButton();
    bindVoiceButton();
    bindStopButton();
    autoResizeTextarea();
    on('action:newChat',   () => newChat());
    on('chatSelected',     ({ chat }) => renderChat(chat));
    on('historyCleared',   () => newChat());
    on('dataImported',     () => { newChat(); AppSidebar.renderAll(); });
    on('fileAdded',        (files) => { pendingFiles.push(...files); });
    on('fileRemoved',      ({ name }) => {
      pendingFiles = pendingFiles.filter(f => f.name !== name);
    });
    on('action:stopStream', () => stopGeneration());
    on('action:exportChat', () => {
      if (currentChat) AppHistory.exportChat(currentChat.id);
    });
    on('action:prevChat', () => navigateChats(-1));
    on('action:nextChat', () => navigateChats(1));

    // Scroll tracking
    const msgs = document.getElementById('messages');
    msgs?.addEventListener('scroll', AppUtils.throttle(() => {
      const atBottom = isScrolledToBottom(msgs);
      autoScroll = atBottom;
      const btn = document.getElementById('scroll-btn');
      btn?.classList.toggle('visible', !atBottom);
    }, 100));

    // Voice callback
    on('voiceResult', ({ transcript, final }) => {
      if (!final) return;
      const input = $('#message-input');
      if (input) {
        input.value = (input.value + ' ' + transcript).trim();
        autoResize(input);
        updateSendBtn();
      }
    });

    // Try restoring last chat
    const lastId = AppStorage.getCurrentChatId();
    if (lastId) {
      const chat = AppHistory.load(lastId);
      if (chat) renderChat(chat);
      else newChat();
    } else {
      newChat();
    }
  };

  /* ---- New Chat ---- */
  const newChat = () => {
    const chat = AppHistory.create();
    currentChat = chat;
    AppHistory.setCurrentId(chat.id);
    clearMessages();
    showWelcome();
    stopGeneration();
    pendingFiles = [];
    AppDragDrop.clearPreviews();
    AppSidebar.renderAll();
    document.getElementById('message-input')?.focus();
  };

  /* ---- Render existing chat ---- */
  const renderChat = (chat) => {
    currentChat = chat;
    clearMessages();
    hideWelcome();

    const msgs = chat.messages || [];
    if (msgs.length === 0) { showWelcome(); return; }

    const frag = document.createDocumentFragment();
    msgs.forEach((msg, i) => {
      const el = createMessageEl(msg, false);
      el.style.animationDelay = `${Math.min(i * 15, 200)}ms`;
      frag.appendChild(el);
    });

    document.getElementById('messages').appendChild(frag);
    scrollToBottom(document.getElementById('messages'), false);
  };

  /* ---- Send message ---- */
  const send = async () => {
    const input = $('#message-input');
    if (!input || isGenerating) return;

    const text = input.value.trim();
    const files = [...pendingFiles];
    if (!text && files.length === 0) return;

    // Validate model
    const model = AppModels.getSelected();
    if (!model) {
      AppNotifications.warning('No model selected', 'Please select a model in the header.');
      return;
    }

    // Validate connection
    if (!AppStorage.getOllamaUrl()) {
      AppNotifications.error('Not configured', 'Set your Ollama URL in Settings.');
      AppSettings.open('connection');
      return;
    }

    // Clear input
    input.value = '';
    autoResize(input);
    updateSendBtn();

    // Clear file previews
    pendingFiles = [];
    AppDragDrop.clearPreviews();

    // Ensure we have a chat
    if (!currentChat) newChat();

    hideWelcome();

    // Build user message
    const images = files.filter(f => f.type === 'image').map(f => f.base64).filter(Boolean);
    const textParts = [];
    files.filter(f => f.type !== 'image' && f.content).forEach(f => {
      textParts.push(`\n\n**File: ${f.name}**\n\`\`\`\n${f.content}\n\`\`\``);
    });

    const fullText = text + textParts.join('');
    const userMsg = {
      id: generateId(),
      role: 'user',
      content: fullText,
      images: images.length > 0 ? images : undefined,
      imageFiles: files.filter(f => f.type === 'image').map(f => ({ name: f.name, dataUrl: f.dataUrl })),
      timestamp: Date.now(),
    };

    // Add to chat
    currentChat.messages = currentChat.messages || [];
    currentChat.messages.push(userMsg);
    AppHistory.save(currentChat);
    AppHistory.updateTitle(currentChat.id, currentChat.messages);

    // Render user message
    appendMessage(userMsg, true);

    // Show typing indicator
    showTypingIndicator();
    isGenerating = true;
    updateStopBtn(true);

    // Build assistant message
    const assistantMsg = {
      id: generateId(),
      role: 'assistant',
      content: '',
      model,
      timestamp: Date.now(),
    };

    streamBuffer = '';
    const settings = AppStorage.getSettings();

    try {
      await OllamaService.chat(currentChat.messages.slice(0, -1).concat([userMsg]), {
        model,
        streaming: settings.streaming,

        onChunk: (chunk) => {
          removeTypingIndicator();
          streamBuffer += chunk;

          if (!streamMsgEl) {
            assistantMsg.content = '';
            streamMsgEl = appendMessage(assistantMsg, true);
            streamContentEl = streamMsgEl.querySelector('.message-content');
          }

          // Render incrementally
          if (streamContentEl) {
            AppMarkdown.renderInto(streamContentEl, streamBuffer);
            addStreamingCursor(streamContentEl);
          }

          if (autoScroll) {
            scrollToBottom(document.getElementById('messages'), false);
          }
        },

        onDone: (stats) => {
          removeStreamingCursor();
          isGenerating = false;
          updateStopBtn(false);

          // Final render
          assistantMsg.content = streamBuffer;
          if (stats && !stats.aborted) {
            assistantMsg.tokens = stats.totalTokens;
            assistantMsg.duration = stats.duration;
          }

          if (streamContentEl) {
            AppMarkdown.renderInto(streamContentEl, streamBuffer);
          }

          // Update meta
          if (streamMsgEl) {
            const metaEl = streamMsgEl.querySelector('.message-model');
            if (metaEl && stats?.totalTokens) {
              metaEl.textContent = `${model} · ${stats.totalTokens} tokens`;
            }
          }

          // Save
          if (!stats?.aborted) {
            currentChat.messages.push(assistantMsg);
            AppHistory.save(currentChat);
          }

          streamMsgEl = null;
          streamContentEl = null;
          streamBuffer = '';

          // TTS if enabled
          if (settings.ttsEnabled && assistantMsg.content) {
            AppVoice.speak(assistantMsg.content);
          }

          AppSidebar.renderAll();
          emit('responseDone', { message: assistantMsg });
        },

        onError: (err) => {
          removeTypingIndicator();
          removeStreamingCursor();
          isGenerating = false;
          updateStopBtn(false);
          streamMsgEl = null;
          streamContentEl = null;
          streamBuffer = '';

          const errMsg = {
            id: generateId(),
            role: 'assistant',
            content: `**Error:** ${err.message || 'Something went wrong. Check your connection and Ollama URL.'}`,
            error: true,
            timestamp: Date.now(),
          };
          appendMessage(errMsg, true);
          AppNotifications.error('Generation failed', err.message || 'Unknown error');
        },
      });
    } catch (err) {
      removeTypingIndicator();
      isGenerating = false;
      updateStopBtn(false);
      AppNotifications.error('Error', err.message || 'Failed to send message');
    }
  };

  /* ---- Stop generation ---- */
  const stopGeneration = () => {
    if (!isGenerating) return;
    OllamaService.abort();
    isGenerating = false;
    updateStopBtn(false);
    removeTypingIndicator();
    removeStreamingCursor();

    // Save partial response
    if (streamBuffer && currentChat) {
      currentChat.messages.push({
        id: generateId(),
        role: 'assistant',
        content: streamBuffer + ' *(stopped)*',
        timestamp: Date.now(),
        stopped: true,
      });
      AppHistory.save(currentChat);
    }

    streamMsgEl = null;
    streamContentEl = null;
    streamBuffer = '';
  };

  /* ---- Continue generation ---- */
  const continueGeneration = () => {
    if (!currentChat || isGenerating) return;
    const msgs = currentChat.messages;
    if (!msgs.length) return;
    const last = msgs[msgs.length - 1];
    if (last.role !== 'assistant') return;

    // Add a "continue" system message
    const continueMsg = {
      id: generateId(),
      role: 'user',
      content: 'Continue from where you left off.',
      timestamp: Date.now(),
      hidden: true,
    };
    currentChat.messages.push(continueMsg);
    AppHistory.save(currentChat);
    send();
  };

  /* ---- Retry last message ---- */
  const retry = (msgId) => {
    if (!currentChat || isGenerating) return;
    const msgs = currentChat.messages;
    const idx = msgs.findIndex(m => m.id === msgId);
    if (idx === -1) return;

    // Remove from idx onwards
    const removed = msgs.splice(idx);
    AppHistory.save(currentChat);

    // Remove those elements from DOM
    removed.forEach(m => {
      document.querySelector(`.message-wrapper[data-id="${m.id}"]`)?.remove();
    });

    // Re-send the user message before them
    const prevUser = msgs[msgs.length - 1];
    if (prevUser?.role === 'user') send();
  };

  /* ---- Edit message ---- */
  const editMessage = (msgId) => {
    if (!currentChat) return;
    const msg = currentChat.messages.find(m => m.id === msgId);
    if (!msg || msg.role !== 'user') return;

    const input = $('#message-input');
    if (!input) return;
    input.value = msg.content;
    autoResize(input);
    updateSendBtn();
    input.focus();

    // Remove this message and everything after from history & DOM
    const idx = currentChat.messages.findIndex(m => m.id === msgId);
    const removed = currentChat.messages.splice(idx);
    AppHistory.save(currentChat);
    removed.forEach(m => {
      document.querySelector(`.message-wrapper[data-id="${m.id}"]`)?.remove();
    });
  };

  /* ---- Append message to DOM ---- */
  const appendMessage = (msg, animate = true) => {
    const el = createMessageEl(msg, animate);
    document.getElementById('messages').appendChild(el);
    if (autoScroll) scrollToBottom(document.getElementById('messages'), false);
    hideWelcome();
    return el;
  };

  /* ---- Create message element ---- */
  const createMessageEl = (msg, animate = false) => {
    const isUser = msg.role === 'user';
    const isSystem = msg.role === 'system';
    const settings = AppStorage.getSettings();

    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${msg.role} ${animate ? '' : 'no-animate'}`;
    wrapper.dataset.id = msg.id;
    if (!animate) wrapper.style.animation = 'none';
    if (!animate) wrapper.style.opacity = '1';

    if (isSystem) {
      wrapper.innerHTML = `<div class="system-message"><i class="fa-solid fa-circle-info"></i>${escapeHtml(msg.content)}</div>`;
      return wrapper;
    }

    const avatarHtml = isUser
      ? `<div class="msg-avatar user-avatar" aria-hidden="true"><i class="fa-solid fa-user"></i></div>`
      : `<div class="msg-avatar ai-avatar" aria-hidden="true"><i class="fa-solid fa-robot"></i></div>`;

    const timeStr = formatTime(msg.timestamp || Date.now());
    const modelStr = msg.model || '';
    const tokenStr = msg.tokens ? `${msg.tokens} tokens` : '';
    const metaParts = [modelStr, tokenStr].filter(Boolean);

    // Files
    const filesHtml = buildFilesHtml(msg);

    // Content
    let contentHtml = '';
    if (msg.error) {
      contentHtml = `<div class="message-error"><i class="fa-solid fa-circle-exclamation"></i>${msg.content}</div>`;
    } else if (isUser) {
      contentHtml = `<div class="message-content">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>`;
    } else {
      contentHtml = `<div class="message-content"></div>`;
    }

    wrapper.innerHTML = `
      <div class="message-row">
        ${!isUser ? avatarHtml : ''}
        <div style="flex:1;min-width:0;">
          ${filesHtml}
          <div class="message-bubble">
            ${contentHtml}
          </div>
          <div class="message-meta" ${settings.showTimestamps ? '' : 'style="display:none"'}>
            <span class="message-time">${timeStr}</span>
            ${metaParts.length ? `<span class="message-model" style="color:var(--text-muted);font-size:10px;">${escapeHtml(metaParts.join(' · '))}</span>` : ''}
            ${msg.edited ? '<span class="edited-badge">(edited)</span>' : ''}
          </div>
          <div class="message-actions">
            ${buildActionButtons(msg, isUser)}
          </div>
          <div class="message-reactions" id="reactions-${msg.id}"></div>
        </div>
        ${isUser ? avatarHtml : ''}
      </div>
    `;

    // Render markdown for assistant messages
    if (!isUser && !msg.error && msg.content) {
      const contentEl = wrapper.querySelector('.message-content');
      if (contentEl) AppMarkdown.renderInto(contentEl, msg.content);
    }

    // Bind action buttons
    bindMessageActions(wrapper, msg);
    return wrapper;
  };

  const buildFilesHtml = (msg) => {
    if (!msg.imageFiles?.length) return '';
    return `<div class="message-files">
      ${msg.imageFiles.map(f =>
        `<img class="message-file-thumb" src="${f.dataUrl}" alt="${escapeHtml(f.name)}"
              loading="lazy" onclick="AppMarkdown.openLightbox('${f.dataUrl}')">`
      ).join('')}
    </div>`;
  };

  const buildActionButtons = (msg, isUser) => {
    const btns = [
      `<button class="msg-action-btn" data-action="copy" title="Copy" aria-label="Copy message">
        <i class="fa-regular fa-copy"></i>
      </button>`,
    ];

    if (isUser) {
      btns.push(`<button class="msg-action-btn" data-action="edit" title="Edit" aria-label="Edit message">
        <i class="fa-solid fa-pen"></i>
      </button>`);
    } else {
      btns.push(`<button class="msg-action-btn" data-action="speak" title="Read aloud" aria-label="Read message aloud">
        <i class="fa-solid fa-volume-high"></i>
      </button>`);
      btns.push(`<button class="msg-action-btn" data-action="retry" title="Retry" aria-label="Retry">
        <i class="fa-solid fa-rotate"></i>
      </button>`);
    }

    btns.push(`<button class="msg-action-btn" data-action="react" title="React" aria-label="Add reaction">
      <i class="fa-regular fa-face-smile"></i>
    </button>`);

    btns.push(`<button class="msg-action-btn danger" data-action="delete" title="Delete" aria-label="Delete message">
      <i class="fa-solid fa-trash"></i>
    </button>`);

    return btns.join('');
  };

  const bindMessageActions = (wrapper, msg) => {
    wrapper.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        switch (action) {
          case 'copy':
            const content = wrapper.querySelector('.message-content')?.textContent || msg.content;
            const ok = await copyToClipboard(content);
            if (ok) {
              btn.innerHTML = '<i class="fa-solid fa-check"></i>';
              setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1500);
              AppNotifications.success('Copied');
            }
            break;
          case 'edit':   editMessage(msg.id); break;
          case 'delete':
            wrapper.style.opacity = '0';
            wrapper.style.transform = 'translateY(-4px)';
            wrapper.style.transition = 'all 0.2s ease';
            setTimeout(() => {
              wrapper.remove();
              if (currentChat) {
                AppHistory.deleteMessage(currentChat.id, msg.id);
              }
              if (document.getElementById('messages')?.children.length === 0) showWelcome();
            }, 200);
            break;
          case 'retry':  retry(msg.id); break;
          case 'speak':
            if (AppVoice.isTalking()) AppVoice.stopSpeaking();
            else AppVoice.speak(msg.content);
            break;
          case 'react':  showReactionPicker(wrapper, msg); break;
        }
      });
    });
  };

  /* ---- Reaction picker ---- */
  const showReactionPicker = (wrapper, msg) => {
    const existing = document.querySelector('.reaction-picker');
    existing?.remove();

    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    picker.style.cssText = `
      position:fixed; z-index:${AppConfig.STORAGE ? 400 : 400};
      background:var(--surface-2); border:1px solid var(--border-default);
      border-radius:var(--radius-lg); padding:8px; display:flex; gap:6px;
      box-shadow:var(--shadow-md); backdrop-filter:var(--backdrop-blur);
    `;

    AppConfig.REACTIONS.forEach(emoji => {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      btn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;padding:4px;border-radius:6px;transition:transform 0.15s;';
      btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.3)'; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
      btn.addEventListener('click', () => {
        addReaction(wrapper, msg.id, emoji);
        picker.remove();
      });
      picker.appendChild(btn);
    });

    const rect = wrapper.getBoundingClientRect();
    picker.style.top = `${rect.bottom + 4}px`;
    picker.style.left = `${rect.left}px`;
    document.body.appendChild(picker);

    setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 10);
  };

  const addReaction = (wrapper, msgId, emoji) => {
    let reactionsEl = wrapper.querySelector(`#reactions-${msgId}`);
    if (!reactionsEl) return;

    const existing = [...reactionsEl.querySelectorAll('.reaction-badge')].find(b => b.dataset.emoji === emoji);
    if (existing) {
      const count = parseInt(existing.querySelector('span')?.textContent || '1');
      if (count > 1) existing.querySelector('span').textContent = count - 1;
      else existing.remove();
      return;
    }

    const badge = document.createElement('div');
    badge.className = 'reaction-badge active';
    badge.dataset.emoji = emoji;
    badge.innerHTML = `${emoji}<span>1</span>`;
    badge.addEventListener('click', () => addReaction(wrapper, msgId, emoji));
    reactionsEl.appendChild(badge);
  };

  /* ---- Typing indicator ---- */
  const showTypingIndicator = () => {
    removeTypingIndicator();
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = `
      <div class="msg-avatar ai-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    document.getElementById('messages').appendChild(indicator);
    if (autoScroll) scrollToBottom(document.getElementById('messages'), false);
  };

  const removeTypingIndicator = () => {
    document.getElementById('typing-indicator')?.remove();
  };

  /* ---- Streaming cursor ---- */
  const addStreamingCursor = (el) => {
    if (!el || el.querySelector('.streaming-cursor')) return;
    const cursor = document.createElement('span');
    cursor.className = 'streaming-cursor';
    el.appendChild(cursor);
  };

  const removeStreamingCursor = () => {
    document.querySelectorAll('.streaming-cursor').forEach(el => el.remove());
  };

  /* ---- Welcome screen ---- */
  const showWelcome = () => {
    const ws = document.getElementById('welcome-screen');
    ws?.classList.remove('hidden');
    renderSuggestions();
  };

  const hideWelcome = () => {
    document.getElementById('welcome-screen')?.classList.add('hidden');
  };

  const renderSuggestions = () => {
    const grid = document.querySelector('.suggestion-grid');
    if (!grid || grid.dataset.rendered) return;
    grid.dataset.rendered = '1';

    AppConfig.SUGGESTIONS.forEach((s, i) => {
      const card = document.createElement('button');
      card.className = 'suggestion-card';
      card.style.animationDelay = `${i * 80 + 200}ms`;
      card.innerHTML = `
        <i class="fa-solid ${s.icon} suggestion-icon"></i>
        <span class="suggestion-title">${escapeHtml(s.title)}</span>
        <span class="suggestion-desc">${escapeHtml(s.desc)}</span>
      `;
      card.addEventListener('click', () => {
        const input = document.getElementById('message-input');
        if (input) {
          input.value = s.title;
          autoResize(input);
          updateSendBtn();
          input.focus();
        }
      });
      grid.appendChild(card);
    });
  };

  /* ---- Clear messages ---- */
  const clearMessages = () => {
    const msgs = document.getElementById('messages');
    if (msgs) msgs.innerHTML = '';
    removeTypingIndicator();
    removeStreamingCursor();
    streamMsgEl = null;
    streamContentEl = null;
    streamBuffer = '';
  };

  /* ---- Input binding ---- */
  const bindInput = () => {
    const input = $('#message-input');
    if (!input) return;

    input.addEventListener('input', () => {
      autoResize(input);
      updateSendBtn();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        if (!isGenerating) send();
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && window.innerWidth > 768) {
        e.preventDefault();
        if (!isGenerating) send();
      }
    });

    // Paste image support
    input.addEventListener('paste', async (e) => {
      const items = [...(e.clipboardData?.items || [])];
      const imgItems = items.filter(i => i.type.startsWith('image/'));
      if (imgItems.length === 0) return;
      e.preventDefault();
      const files = imgItems.map(i => i.getAsFile()).filter(Boolean);
      await AppDragDrop.processFiles(files);
    });
  };

  const bindSendButton = () => {
    $('#send-btn')?.addEventListener('click', () => { if (!isGenerating) send(); });
  };

  const bindStopButton = () => {
    $('#stop-btn')?.addEventListener('click', stopGeneration);
  };

  const bindScrollButton = () => {
    $('#scroll-btn')?.addEventListener('click', () => {
      scrollToBottom(document.getElementById('messages'));
    });
  };

  const bindVoiceButton = () => {
    $('#voice-btn')?.addEventListener('click', () => {
      AppVoice.toggleListening((transcript) => {
        const input = $('#message-input');
        if (input) {
          input.value = (input.value + ' ' + transcript).trim();
          autoResize(input);
          updateSendBtn();
        }
      });
    });
  };

  /* ---- Auto-resize textarea ---- */
  const autoResizeTextarea = () => autoResize($('#message-input'));

  const autoResize = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const updateSendBtn = () => {
    const input = $('#message-input');
    const btn = $('#send-btn');
    if (!btn || !input) return;
    btn.disabled = input.value.trim() === '' && pendingFiles.length === 0;
  };

  const updateStopBtn = (show) => {
    const stopBtn = $('#stop-btn');
    const sendBtn = $('#send-btn');
    if (stopBtn) stopBtn.style.display = show ? 'flex' : 'none';
    if (sendBtn) sendBtn.style.display = show ? 'none' : 'flex';
  };

  /* ---- Navigate chats ---- */
  const navigateChats = (dir) => {
    const chats = AppStorage.getAllChats().filter(c => !c.archived);
    if (!chats.length) return;
    const idx = chats.findIndex(c => c.id === AppHistory.getCurrentId());
    const next = chats[AppUtils.clamp(idx + dir, 0, chats.length - 1)];
    if (next && next.id !== AppHistory.getCurrentId()) {
      const chat = AppHistory.load(next.id);
      if (chat) { currentChat = chat; renderChat(chat); AppSidebar.renderAll(); }
    }
  };

  return {
    init, newChat, send, stopGeneration, continueGeneration,
    appendMessage, createMessageEl, renderChat,
    getCurrentChat: () => currentChat,
    isGenerating: () => isGenerating,
  };
})();
