import { sendMessage, ws, getApiBase } from "./network.js";
import { you, goblins } from "./index.js";

// HTML-based Chat overlay that sits atop the canvas (bottom-right)
class Chat {
    constructor({ height = 180, width = 360 } = {}) {
        // Data
        this.messages = [];
        this.max_messages = 100; // keep a decent backlog in DOM

        // DOM elements
        this.container = null;
        this.messagesEl = null;
        this.inputEl = null;
        this.hover = false;

        // Build UI once
        this.#mount(width, height);
        // Try to fetch MOTD once the UI mounts
        this.#fetchMOTD();
        this.#attachGlobalHandlers();
        this.#applyUIColor();
    }

    // No-op for compatibility with old p5 loop
    update() {}

    // Keep method for compatibility with old code
    moveInput() {}

    // Returns true if chat is focused or hovered
    isMouseInteracting() {
        return document.activeElement === this.inputEl || this.hover;
    }

    // Public API used by index.js when messages arrive from server
    addMessage({ user, content }) {
        this.messages.push({ user, content });
        if (this.messages.length > this.max_messages) {
            this.messages.splice(0, this.messages.length - this.max_messages);
        }
        this.#renderMessage(user, content);
    }

    // Send local message: show speech bubble and send to server.
    // If not connected to a lobby, immediately add to chat locally (offline mode).
    sendLocal(text) {
        const msg = (text || "").trim();
        if (!msg) return;
        try {
            // local say bubble
            if (you && typeof you.say === 'function') you.say(msg);
            // network send
            const connected = ws && ws.readyState === WebSocket.OPEN;
            if (!connected) {
                // No lobby connection: append immediately to chat box
                this.addMessage({ user: you || null, content: msg });
            }
            sendMessage({ type: 'chat', content: msg });
        } finally {
            this.inputEl.value = '';
            this.#blurInput();
        }
    }

    // ----- Private helpers -----
    async #fetchMOTD() {
        try {
            // Fetch from backend API (dev: localhost:3000, prod: api.drawbl.in)
            const res = await fetch(`${getApiBase()}/api/motd`, { method: 'GET' });
            if (!res.ok) return;
            const data = await res.json();
            const msg = (data && data.message) ? String(data.message) : '';
            if (msg) {
                // System message: use player's UI color if available, otherwise a readable default
                const sysUser = { ui_color: [180,180,180] };
                this.addMessage({ user: sysUser, content: msg });
            }
        } catch (_) {
            // Silent fail; MOTD is optional
        }
    }
    #mount(width, height) {
        // Avoid duplicate mount
        if (document.getElementById('chat')) {
            this.container = document.getElementById('chat');
            this.messagesEl = this.container.querySelector('.chat__messages');
            this.inputEl = this.container.querySelector('.chat__input');
            return;
        }

        const container = document.createElement('div');
        container.id = 'chat';
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
        container.innerHTML = `
            <button class="chat__toggle" aria-expanded="true" title="Collapse chat">▾</button>
            <div class="chat__messages" aria-live="polite" aria-label="Chat messages"></div>
            <input class="chat__input" type="text" placeholder="Press Enter or Click Here to Chat" maxlength="240" aria-label="Type a message" />
        `;
        document.body.appendChild(container);

        // Cache refs
        this.container = container;
    this.messagesEl = container.querySelector('.chat__messages');
    this.inputEl = container.querySelector('.chat__input');
    this.toggleEl = container.querySelector('.chat__toggle');

        // Stop canvas/p5 events when interacting with chat
        const stop = (e) => { e.stopPropagation(); };
        ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'pointerdown', 'pointerup'].forEach(evt => {
            container.addEventListener(evt, stop);
            this.inputEl.addEventListener(evt, stop);
        });

        // Track hover state
        container.addEventListener('mouseenter', () => { this.hover = true; });
        container.addEventListener('mouseleave', () => { this.hover = false; });

        // Submit on Enter
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.sendLocal(this.inputEl.value);
            } else if (e.key === 'Escape') {
                this.#blurInput();
            }
        });

    // Freeze movement while typing (handle mouse-click focus/blur too)
    this.inputEl.addEventListener('focus', () => { if (you) you.frozen = true; });
    this.inputEl.addEventListener('blur', () => { if (you) you.frozen = false; });

        if (this.toggleEl) {
            this.toggleEl.addEventListener('click', (e) => {
                e.preventDefault();
                const collapsed = this.container.classList.toggle('chat--collapsed');
                this.toggleEl.setAttribute('aria-expanded', String(!collapsed));
                this.toggleEl.textContent = collapsed ? '▸' : '▾';
            });
        }
    }

    #attachGlobalHandlers() {
        // Focus input when pressing Enter anywhere (unless typing in another input/textarea)
        window.addEventListener('keydown', (e) => {
            const target = e.target;
            const tag = (target && target.tagName) ? target.tagName.toLowerCase() : '';
            if (e.key === 'Enter' && tag !== 'input' && tag !== 'textarea') {
                e.preventDefault();
                this.#focusInput();
            }
        });

        // React to UI color changes (optional event fired elsewhere)
        window.addEventListener('ui:color-changed', () => this.#applyUIColor());
    }

    #applyUIColor() {
        if (!you || !Array.isArray(you.ui_color)) return;
        const [r, g, b] = you.ui_color;
        const border = `rgba(${r}, ${g}, ${b}, 0.2)`;
        const borderHover = `rgba(${r}, ${g}, ${b}, 0.2)`;
        this.container.style.borderColor = border;
        this.container.style.setProperty('--chat-border', border);
        this.container.style.setProperty('--chat-border-hover', borderHover);
        this.container.style.setProperty('--chat-text', `rgba(${r}, ${g}, ${b}, 0.8)`);
        if (this.inputEl) {
            this.inputEl.style.borderColor = border;
            this.inputEl.style.color = `rgba(${r}, ${g}, ${b}, 0.8)`;
        }
    }

    #focusInput() {
        if (!this.inputEl) return;
        if (this.container?.classList.contains('chat--collapsed') && this.toggleEl) {
            this.container.classList.remove('chat--collapsed');
            this.toggleEl.setAttribute('aria-expanded', 'true');
            this.toggleEl.textContent = '▾';
        }
        this.inputEl.focus();
        // Freeze movement while typing
        if (you) you.frozen = true;
    }
    #blurInput() {
        if (!this.inputEl) return;
        this.inputEl.blur();
        if (you) you.frozen = false;
    }

    #renderMessage(user, content) {
        if (!this.messagesEl) return;
        const el = document.createElement('div');
        el.className = 'chat__message';
        let color = 'rgba(30,30,30,0.8)';
        if (user && Array.isArray(user.ui_color)) {
            const [r, g, b] = user.ui_color;
            color = `rgba(${r}, ${g}, ${b}, 0.8)`;
        }
        el.style.color = color;
        el.textContent = content;
        this.messagesEl.appendChild(el);
        // Auto-scroll to bottom
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
}

export default Chat;