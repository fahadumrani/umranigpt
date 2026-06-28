# UmraniGPT

<div align="center">

<img src="assets/logo.svg" width="80" alt="UmraniGPT Logo">

### Premium AI Chat Interface for Ollama

A production-ready, feature-complete AI assistant web app —
beautiful as ChatGPT, private as your local machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](#license)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blue.svg)](#pwa)
[![Local AI](https://img.shields.io/badge/Backend-Local_AI-orange.svg)]

</div>

---

## ✨ Features

### 💬 Chat
- **Streaming responses** — see tokens appear in real time
- **Full Markdown** — tables, lists, headings, blockquotes, links
- **Syntax-highlighted code blocks** — with copy, collapse & line numbers
- **KaTeX math rendering** — inline `$x^2$` and display `$$\int$$`
- **Message reactions** — emoji reactions on any message
- **Edit & retry** — edit any user message and regenerate
- **Voice I/O** — microphone input + text-to-speech output
- **File attachments** — drag-and-drop images, text, PDFs & code files
- **Typing indicator** — animated dots while waiting
- **Auto-scroll** with manual scroll button

### 🗂 History
- **Unlimited chats** stored in LocalStorage
- **Grouped by time** — Today / Yesterday / This Week / Older
- **Pin** important chats to the top
- **Favourites**, rename, duplicate, archive
- **Folders** for organisation
- **Export** single chat as JSON or Markdown
- **Import / export all** as a full JSON backup

### 🎨 Themes
| Theme | Style |
|-------|-------|
| Dark | Deep purple-black OLED-friendly |
| Light | Clean white with violet accents |
| OLED | Pure black — perfect for OLED screens |
| Cyber | Cyan on dark navy |
| Ocean | Blue tones |
| Purple | Rich purple |
| Forest | Emerald green |
| Glass | Frosted glass morphism |

### ⚙️ Settings
- Configurable **Server URL** — supports Cloudflare Tunnel
- **Connection tester** with latency measurement
- Full **model parameter** control (temperature, top-p, top-k, repeat penalty, seed, context)
- **System prompt** configuration
- **Streaming toggle**
- Voice speed, pitch & volume
- Font size & animation preferences

### ⌨️ Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Send message |
| `Ctrl+N` | New chat |
| `Ctrl+K` | Focus search |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+,` | Open settings |
| `Ctrl+Shift+T` | Cycle theme |
| `Ctrl+/` | Show all shortcuts |
| `Escape` | Cancel / close |

---

## 🚀 Setup

### Prerequisites
- A local AI server (e.g. Ollama) installed and running
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) for tunnel
- A web host (GitHub Pages, Netlify, etc.)

### 1 — Clone & Deploy

```bash
git clone https://github.com/yourusername/umranigpt.git
cd umranigpt
# Deploy to GitHub Pages or any static host
```

### 2 — Start Ollama

```bash
# Pull a model
# pull a model via your AI server CLI

# Serve with CORS enabled
# start your AI server with CORS enabled
```

### 3 — Create Cloudflare Tunnel

```bash
# Install cloudflared, then:
cloudflared tunnel --url http://localhost:11434
# Copy the generated URL, e.g. https://random-name.trycloudflare.com
```

### 4 — Configure the App

1. Open UmraniGPT in your browser
2. Click **Settings** (gear icon or `Ctrl+,`)
3. Paste your tunnel URL in **Connection → Server URL**
4. Click **Save**, then **Test Connection**
5. Select a model from the header dropdown
6. Start chatting! 🎉

---

## 🏗 Architecture

```
Browser (GitHub Pages)
       ↓  HTTPS
Cloudflare Tunnel
       ↓  localhost
Local AI Server  (:11434)
       ↓
Your GPU / CPU
```

All AI processing happens **on your machine**. No data sent to third-party servers.

---

## 📁 Project Structure

```
umranigpt/
├── index.html          # Main HTML shell
├── style.css           # CSS entry point (@imports all modules)
├── script.js           # JS entry shim
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline support)
│
├── css/
│   ├── variables.css   # Design tokens & 8 themes
│   ├── animations.css  # All keyframes & animation classes
│   ├── layout.css      # App shell, loading screen, drag overlay
│   ├── sidebar.css     # Sidebar, chat list, context menu
│   ├── chat.css        # Messages, bubbles, code blocks, typing
│   ├── components.css  # Buttons, inputs, dropdowns, status
│   ├── modal.css       # Settings modal, overlays, forms
│   └── responsive.css  # Mobile/tablet breakpoints
│
├── js/
│   ├── config.js       # App constants & defaults
│   ├── utils.js        # Helpers: DOM, events, file, string, etc.
│   ├── storage.js      # LocalStorage wrapper + data layer
│   ├── security.js     # DOMPurify config, URL validation
│   ├── notifications.js# Toast notification system
│   ├── theme.js        # Theme switching & previews
│   ├── models.js       # Model list, selector, dropdown
│   ├── voice.js        # Web Speech API (recognition + TTS)
│   ├── markdown.js     # Marked + KaTeX + DOMPurify pipeline
│   ├── codeblock.js    # Highlight.js code blocks
│   ├── search.js       # Real-time sidebar search
│   ├── dragdrop.js     # File drag & drop + clipboard paste
│   ├── history.js      # Chat CRUD, export, import, search
│   ├── sidebar.js      # Sidebar render, context menus, rename
│   ├── settings.js     # Settings modal, all panels, bindings
│   ├── shortcuts.js    # Keyboard shortcut handler
│   ├── chat.js         # Send, stream, render messages, reactions
│   ├── ui.js           # Connection monitor, status UI, PWA prompt
│   └── app.js          # Bootstrap — initialises all modules
│
├── services/
│   ├── ollama.js       # AI server API wrapper (tags, chat, generate)
│   └── stream.js       # Streaming fetch handler (SSE/NDJSON)
│
└── assets/
    ├── logo.svg
    └── icons/          # PWA icons (generate with generate-icons.py)
```

---

## 🛠 Technical Details

### Supported Ollama Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /api/tags`    | List installed models |
| `POST /api/chat` | Streaming chat (primary) |
| `POST /api/generate` | Text generation |
| `POST /api/show` | Model details |
| `GET /api/ps` | Running models |

### Model Parameters
| Parameter | Range | Default |
|-----------|-------|---------|
| Temperature | 0–2 | 0.7 |
| Top-P | 0–1 | 0.9 |
| Top-K | 1–100 | 40 |
| Repeat Penalty | 1–2 | 1.1 |
| Context Length | 512–131072 | 4096 |
| Seed | -1–2147483647 | -1 |

### PWA Features
- Offline-capable via service worker cache
- Installable on desktop and mobile
- App-like experience (no browser chrome in standalone mode)
- Background sync ready
- Push notification skeleton

---

## 🔒 Privacy & Security

- **Zero telemetry** — no analytics, no tracking
- **Local-first** — all data in your browser's LocalStorage
- **DOMPurify** sanitises all rendered HTML
- **Content Security** via strict attribute filtering
- All AI server communication goes through your own tunnel

---

## 📱 PWA Icons

Generate required icons by running:

```bash
pip install cairosvg
python3 assets/generate-icons.py
```

Or manually export `assets/logo.svg` to PNG at these sizes and save to `assets/icons/`:
`72, 96, 128, 144, 152, 192, 384, 512`

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with ❤️ using vanilla JS, CSS, and the power of local AI.

</div>
