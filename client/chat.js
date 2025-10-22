import { sendMessage, ws, getApiBase } from "./network.js";
import { you, goblins } from "./index.js";

// HTML-based Chat overlay that sits atop the canvas (bottom-center)
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
        // Mobile-aware placeholder text
        const isMobileLike = (typeof navigator !== 'undefined' && (/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i).test(navigator.userAgent)) || (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
        const placeholder = isMobileLike ? 'Tap here to chat' : 'Press Enter or Click Here to Chat';
        container.innerHTML = `
            <div class="chat__messages" aria-live="polite" aria-label="Chat messages"></div>
            <input class="chat__input" type="text" placeholder="${placeholder}" maxlength="240" aria-label="Type a message" />
        `;
        document.body.appendChild(container);

        // Cache refs
        this.container = container;
    this.messagesEl = container.querySelector('.chat__messages');
    this.inputEl = container.querySelector('.chat__input');

        // Only stop events on the actual input element so typing doesn't start canvas interactions.
        // Allow events on the chat container to fall through to the canvas (so users can draw behind it).
        const stop = (e) => { e.stopPropagation(); };
        ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'pointerdown', 'pointerup'].forEach(evt => {
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

        // Chat is always visible; collapse toggle removed.
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
        // Keep container background/border neutral; style only the input element
        this.container.style.removeProperty('border-color');
        this.container.style.removeProperty('--chat-border');
        this.container.style.removeProperty('--chat-border-hover');
        this.container.style.setProperty('--chat-text', `rgba(${r}, ${g}, ${b}, 0.8)`);
        if (this.inputEl) {
            this.inputEl.style.borderColor = border;
            this.inputEl.style.color = `rgba(${r}, ${g}, ${b}, 0.8)`;
        }
    }

    #focusInput() {
        if (!this.inputEl) return;
        // Chat is always visible; focus simply gives keyboard input to the chat box
        this.inputEl.focus();
        // Freeze movement while typing
        if (you) you.frozen = true;
    }
    #blurInput() {
        if (!this.inputEl) return;
        this.inputEl.blur();
        if (you) you.frozen = false;
        // On mobile, when the input loses focus we should return focus to the
        // canvas so users can immediately resume drawing without an extra tap.
        // Use a short timeout to allow the virtual keyboard to dismiss first.
        try {
            setTimeout(() => {
                const cv = document.getElementById('drawblin-canvas');
                        if (cv) {
                    try { cv.focus && cv.focus(); } catch (e) {}
                    // On many mobile browsers focusing isn't enough to restore
                    // pointer/touch handling. Dispatch a synthetic pointerdown+
                    // pointerup at the canvas center to wake up input. We set a
                    // global suppression flag so the synthetic won't begin a
                    // real drawing stroke.
                    try {
                        if (typeof window.__isMobile !== 'undefined' && window.__isMobile) {
                            try { window.__suppressSyntheticWake = true; } catch (e) {}
                            const rect = cv.getBoundingClientRect();
                            const cx = rect.left + rect.width / 2;
                            const cy = rect.top + rect.height / 2;
                            const init = { bubbles: true, cancelable: true, composed: true, pointerId: 1, clientX: cx, clientY: cy };
                            const down = new PointerEvent('pointerdown', init);
                            const up = new PointerEvent('pointerup', init);
                            cv.dispatchEvent(down);
                            cv.dispatchEvent(up);
                            // If we're on iOS Safari (or other picky browsers) and the
                            // synthetic focus didn't restore interaction, show a tiny
                            // hint so the user can tap once to resume drawing.
                            try {
                                const ua = (navigator.userAgent || '').toLowerCase();
                                const isiOS = /iphone|ipad|ipod/.test(ua);
                                const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
                                if (isiOS && isSafari) {
                                    this.#showResumeHint();
                                }
                            } catch (e) {}
                        }
                    } catch (e) { /* ignore synthetic dispatch failures */ }
                }
            }, 120);
        } catch (e) { /* ignore */ }
    }

    // Show a small transient hint for iOS Safari users to tap to resume drawing
    #showResumeHint() {
        try {
            // Do nothing if already present
            if (document.getElementById('chat-resume-hint')) return;
            const hint = document.createElement('div');
            hint.id = 'chat-resume-hint';
            hint.textContent = 'Tap to continue drawing';
            hint.style.position = 'fixed';
            hint.style.left = '50%';
            hint.style.top = '50%';
            hint.style.transform = 'translate(-50%, -50%)';
            hint.style.zIndex = '10001';
            hint.style.padding = '8px 12px';
            hint.style.borderRadius = '8px';
            hint.style.background = 'rgba(0,0,0,0.75)';
            hint.style.color = '#fff';
            hint.style.fontFamily = 'Neucha, sans-serif';
            hint.style.fontSize = '16px';
            hint.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            hint.style.cursor = 'pointer';
            hint.addEventListener('click', () => {
                try { const cv = document.getElementById('drawblin-canvas'); if (cv && typeof cv.focus === 'function') cv.focus(); } catch (e) {}
                hint.remove();
            });
            document.body.appendChild(hint);
            // Auto-remove after 4s
            setTimeout(() => { try { hint.remove(); } catch (e) {} }, 4000);
        } catch (e) { /* ignore */ }
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
        // Append the message. Because messages are flex-column and justified to
        // the bottom, new messages will appear just above the input. We only
        // force-scroll when the messages overflow the container or when the
        // user was already at the bottom (so we don't yank them while reading).
        const wasAtBottom = (this.messagesEl.scrollHeight - this.messagesEl.scrollTop - this.messagesEl.clientHeight) <= 8;
        this.messagesEl.appendChild(el);

        // If content now overflows, or the user was already at bottom, scroll to show newest
        const isOverflowing = this.messagesEl.scrollHeight > this.messagesEl.clientHeight + 2;
        if (isOverflowing || wasAtBottom) {
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        }
    }
}

export default Chat;