// ==UserScript==
// @name         Paths of Immortality HUD
// @namespace    paths-to-immortality.monkey
// @version      0.7.2
// @description  Separate Cloudveil GM HUD around ChatGPT; post Xiao Lan's actions to Supabase, review room messages and prepare a short narrator command.
// @author       Paths to Immortality
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      fhjsoldgtqfizkwpehud.supabase.co
// @updateURL    https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js
// @downloadURL  https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js
// ==/UserScript==

(() => {
  'use strict';

  if (window.top !== window.self || document.getElementById('paths-monkey-root')) return;

  const VERSION = '0.7.2';
  const SUPABASE = 'https://fhjsoldgtqfizkwpehud.supabase.co';
  // This is a publishable browser key, NOT a secret/service-role credential.
  const PUBLIC_KEY = 'sb_publishable_hWZGWQyF7xNe90x8kSFESw_2k4AHU5t';
  const GAME_URL = 'https://denoden3.github.io/Paths-to-Immortality/';
  const GM_RULES_URL = 'https://app.notion.com/p/3fab0ac52efe810caecfdf5da0270caf';
  const CODEX_URL = 'https://app.notion.com/p/3f7b0ac52efe81258310c96057391e18';
  const SAVE_PREFIX = 'paths.monkey.gm.v1.';
  const get = (k, fallback = null) => GM_getValue(SAVE_PREFIX + k, fallback);
  const put = (k, v) => GM_setValue(SAVE_PREFIX + k, v);
  const remove = (k) => GM_deleteValue(SAVE_PREFIX + k);
  const $ = (id) => document.getElementById('pm-' + id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let account = get('account', null);
  let paired=false;
  let selectedRoom = get('room', null);
  let rooms = [];
  let members = [];
  let messages = [];
  let busy = false;
  let refreshPromise = null;
  let refreshTimer = null;
  let pendingRequestId = null;
  let pendingRequestBody = null;
  let pendingRequestKind = null;
  let speakAsCharacter = get('speakAsCharacter',true);
  let lastNativeInset = 95;
  let previousFocus = null;
  let showFeed = false;
  let showSidebar = true;
  let hudExpanded = get('hudExpanded', true);
  let hudMode = get('hudMode', 'paths');
  let pickerHoldTimer = null;
  let pickerStart = null;
  let suppressPickerClick = false;

  GM_addStyle(`
    #paths-monkey-root{position:fixed;inset:0;z-index:1500;pointer-events:none;
      --pm-ink:#fff3e6;--pm-muted:#ddc3b5;--pm-bg:#17141a;--pm-panel:#2b222c;--pm-red:#bb3642;
      --pm-gold:#f6c280;--pm-stroke:#876c74;--pm-green:#9ce5cd;
      color:var(--pm-ink);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
    #paths-monkey-root *{box-sizing:border-box}
    #paths-monkey-root button,#paths-monkey-root input,#paths-monkey-root textarea{font:inherit}
    #paths-monkey-root button{cursor:pointer}
    #paths-monkey-root button:disabled{opacity:.55;cursor:wait}
    #paths-monkey-root button:focus-visible,#paths-monkey-root a:focus-visible,
    #paths-monkey-root textarea:focus-visible,#paths-monkey-root input:focus-visible{
      outline:3px solid var(--pm-gold);outline-offset:2px}
    #paths-monkey-root .pm-hbar{position:absolute;inset:0 0 auto;min-height:53px;padding:6px 10px;
      background:linear-gradient(100deg,#211922,#3c252e);border-bottom:1px solid var(--pm-stroke);
      pointer-events:auto;display:flex;align-items:center;gap:9px;box-shadow:0 2px 12px #07040888}
    #paths-monkey-root .pm-logo{background:#632732;border:1px solid #98505d;border-radius:10px;
      height:34px;width:34px;display:grid;place-items:center;font-size:21px;flex-shrink:0}
    #paths-monkey-root .pm-title{font-size:14px;font-weight:800;line-height:1.12;letter-spacing:.01em;flex:1}
    #paths-monkey-root .pm-compact-version{font-size:10px;color:var(--pm-gold)}
    #paths-monkey-root .pm-btn{min-height:32px;border:1px solid var(--pm-stroke);border-radius:9px;
      padding:6px 10px;background:#3e303a;color:var(--pm-ink);font-weight:700}
    #paths-monkey-root .pm-btn.pm-primary{background:var(--pm-red);border-color:#eb7777;color:#fff}
    #paths-monkey-root .pm-btn.pm-mini{padding:5px 8px;font-size:12px}
    #paths-monkey-root .pm-text{border:1px solid #a28a91;border-radius:10px;background:#17131b;
      color:var(--pm-ink);padding:10px 11px;width:100%;outline:none}
    #paths-monkey-root .pm-text::placeholder{color:#baa9ae}
    #paths-monkey-root .pm-left{display:none;position:absolute;left:0;right:0;
      top:var(--pm-header-height,53px);bottom:calc(var(--pm-native,95px) + var(--pm-compose-height,120px));
      background:var(--pm-bg);overflow-y:auto;overscroll-behavior:contain;
      pointer-events:auto;padding:18px clamp(12px,3vw,32px) 24px}
    #paths-monkey-root .pm-left.pm-open{display:block}
    #paths-monkey-root.pm-admin .pm-left{bottom:var(--pm-native,95px)}
    #paths-monkey-root.pm-admin .pm-compose{display:none}
    #paths-monkey-root .pm-session-list summary{cursor:pointer;min-height:42px;font-weight:800;color:var(--pm-gold);padding:9px 0}
    #paths-monkey-root .pm-session-list .pm-btn{display:block;width:100%;text-align:left;margin:7px 0}
    #paths-monkey-root.pm-creating #pm-room-section{display:none}
    #paths-monkey-root:not(.pm-creating) #pm-room-management-content > #pm-pair-new-room{display:none}
    #paths-monkey-root .pm-logo[aria-expanded="true"]{background:#7b3646;border-color:var(--pm-gold)}
    #paths-monkey-root .pm-h{font-weight:850;color:var(--pm-gold);font-size:12px;letter-spacing:.065em;
      text-transform:uppercase;margin:8px 0}
    #paths-monkey-root .pm-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    #paths-monkey-root .pm-mute{color:var(--pm-muted);font-size:12px}
    #paths-monkey-root .pm-name{font-size:16px;font-weight:800;margin:4px 0;overflow-wrap:anywhere}
    #paths-monkey-root .pm-divider{height:1px;background:#6c525d;margin:15px 0}
    #paths-monkey-root .pm-link{color:var(--pm-gold);display:block;text-decoration:underline;
      padding:7px 0;font-size:12px}
    #paths-monkey-root .pm-compose{position:absolute;bottom:var(--pm-native,95px);
      left:0;right:0;max-width:100%;padding:8px 12px 9px;border-top:1px solid var(--pm-stroke);
      background:linear-gradient(110deg,#271d28,#39262e);box-shadow:0 -4px 14px #0b080caa;
      pointer-events:auto}
    #paths-monkey-root .pm-composer-line{display:flex;gap:10px;align-items:flex-start}
    #paths-monkey-root .pm-compose .pm-editor{display:block;resize:none;overflow-y:hidden;
      flex:1;min-width:0;height:40px;min-height:40px;max-height:124px;font-size:14px;line-height:20px;padding:9px 11px}
    #paths-monkey-root .pm-composer-line #pm-send{height:40px;min-height:40px;align-self:flex-start;
      padding:8px 14px;flex-shrink:0;font-size:13px}
    #paths-monkey-root .pm-actions #pm-narrate{background:#2479ea;border-color:#78b5ff;color:#fff;
      box-shadow:0 1px 8px #1155bb55}
    #paths-monkey-root .pm-actions #pm-narrate:hover{background:#176bde}
    #paths-monkey-root .pm-pair-code{overflow-wrap:anywhere;font:12px ui-monospace,monospace;user-select:text;color:var(--pm-gold);background:#211b24;border:1px solid var(--pm-gold);padding:10px;border-radius:9px}
    #paths-monkey-root .pm-pair-block{border:1px solid var(--pm-stroke);border-radius:10px;margin:12px 0;padding:10px;background:#302631}
    #paths-monkey-root .pm-pair-block .pm-btn{margin-top:8px}
    #paths-monkey-root .pm-mode-btn{min-height:40px;min-width:86px;background:#b73543;
      border:1px solid #f09b8b;color:#fff5e8;border-radius:10px;padding:7px 10px;
      font-weight:800;box-shadow:0 0 0 1px #f4c9a633}
    #paths-monkey-root .pm-mode-btn.pm-dim{background:#322a33;color:#deccd1;
      border-color:#806a7c;box-shadow:none;opacity:.72}
    #paths-monkey-root .pm-oocBubble{border-style:dashed;background:#3a3444}
    #paths-monkey-root .pm-oocBubble .pm-by{color:#d7bce5}
    #paths-monkey-root .pm-actions{margin-top:12px;display:flex;column-gap:16px;row-gap:10px;align-items:center;flex-wrap:wrap}
    #paths-monkey-root .pm-actions #pm-identity-toggle{margin-left:auto;
      margin-right:clamp(0px, calc(100vw - 310px), 76px)}
    /* Desktop: give the full HUD a legible title while preserving mobile controls. */
    @media(min-width:900px){
      #paths-monkey-root .pm-hbar .pm-title{font-size:20px;line-height:1.15;letter-spacing:.018em}
    }
    #paths-monkey-root .pm-feedback{color:var(--pm-gold);font-size:11px;overflow-wrap:anywhere;margin-top:4px}
    #paths-monkey-root .pm-feedback:empty{display:none}
    #paths-monkey-root .pm-feed{position:absolute;left:0;right:0;top:var(--pm-header-height,53px);
      bottom:calc(var(--pm-native,95px) + var(--pm-compose-height,120px));overflow-y:auto;
      overscroll-behavior:contain;background:var(--pm-bg);pointer-events:auto;padding:14px}
    #paths-monkey-root .pm-bubble{background:#382a34;border:1px solid #775b63;border-radius:9px;
      margin:7px 0;padding:8px;font-size:12px;overflow-wrap:anywhere;white-space:pre-wrap}
    #paths-monkey-root .pm-bubble.pm-narrator{background:#363021;border-color:var(--pm-gold)}
    #paths-monkey-root .pm-by{font-weight:800;font-size:11px;color:var(--pm-gold);margin-bottom:4px}
    #paths-monkey-root .pm-backdrop{position:absolute;inset:0;background:#08060ac9;
      pointer-events:auto;display:grid;place-items:center;padding:14px}
    #paths-monkey-root .pm-panel{width:min(500px,100%);max-height:92vh;overflow-y:auto;
      border-radius:17px;padding:17px;border:1px solid #a47c81;background:#29212b;
      box-shadow:0 14px 50px #000b}
    #paths-monkey-root .pm-panel h2{font-size:19px;font-weight:800;margin:4px 0}
    #paths-monkey-root .pm-logo{cursor:pointer;color:var(--pm-ink)}
    #paths-monkey-root .pm-logo:focus-visible{outline:3px solid var(--pm-gold);outline-offset:2px}
    #paths-monkey-root .pm-sidebar-action{width:100%;text-align:left;margin:4px 0 8px}
    #paths-monkey-root .pm-room-page{max-height:85vh}
    #paths-monkey-root .pm-room-page #pm-room-section{display:block}
    #paths-monkey-root .pm-room-page .pm-pair-block{margin:8px 0}

    #paths-monkey-root .pm-label{display:block;font-size:12px;color:var(--pm-muted);font-weight:700;margin:11px 0 5px}
    #paths-monkey-root .pm-panel .pm-text{margin-bottom:5px}
    #paths-monkey-root .pm-panel p{color:var(--pm-muted);font-size:12px;margin:8px 0}
    #paths-monkey-root .pm-panel .pm-btn{margin:5px 4px 5px 0}
    #paths-monkey-root .pm-hide{display:none!important}
    #paths-monkey-root .pm-pill{font-size:11px;border-radius:30px;background:#4e343d;color:var(--pm-gold);
      padding:4px 9px;border:1px solid #855663}

    /* Shared-style HUD picker: a single capsule only while Paths is collapsed. */
    html.pm-paths-selected #mizu-hud-switcher,
    html.pm-paths-selected #mizuhana-launcher {display:none !important;}
    /* Mizuhana remains mounted but cannot cover Paths when Paths is selected. */
    html.pm-paths-selected #mizuhana-hud {visibility:hidden !important;pointer-events:none !important;}
    #paths-monkey-root.pm-collapsed .pm-hbar,
    #paths-monkey-root.pm-collapsed .pm-left,
    #paths-monkey-root.pm-collapsed .pm-compose,
    #paths-monkey-root.pm-collapsed .pm-feed,
    #paths-monkey-root.pm-collapsed .pm-backdrop{display:none!important;}
    #paths-monkey-root.pm-inactive{display:none!important;}
    #paths-monkey-root .pm-picker{position:fixed;top:max(8px,env(safe-area-inset-top,0px));
      left:50%;transform:translateX(-50%);pointer-events:auto;
      z-index:3;display:flex;align-items:center;border:1px solid #b2787d;
      background:#281d27;color:#fff3e6;border-radius:999px;box-shadow:0 7px 22px #0008;
      max-width:calc(100vw - 24px)}
    #paths-monkey-root .pm-picker .pm-picker-main{border:0;background:none;color:#fff3e6;
      font-size:14px;font-weight:800;cursor:pointer;min-height:43px;white-space:nowrap;
      padding:9px 17px;max-width:calc(100vw - 32px);overflow:hidden;text-overflow:ellipsis;touch-action:pan-y;}
    #paths-monkey-root .pm-picker .pm-picker-main:focus-visible{outline:2px solid #ffd39c;outline-offset:2px}
    #paths-monkey-root .pm-picker-menu{position:absolute;top:calc(100% + 7px);left:50%;
      transform:translateX(-50%);background:#302431;border:1px solid #ad8085;border-radius:13px;
      padding:7px;min-width:min(285px,calc(100vw - 24px));box-shadow:0 8px 25px #000b;
      display:grid;gap:5px}
    #paths-monkey-root .pm-picker-option{display:block;width:100%;padding:11px 12px;
      background:#40313e;border:1px solid #81616c;border-radius:9px;
      color:#fff3e6;text-align:left;font-size:13px;font-weight:700}
    #paths-monkey-root .pm-picker-option:disabled{opacity:.5}
    #paths-monkey-root .pm-title-collapse{background:none;border:0;color:inherit;
      font:inherit;display:flex;flex-direction:column;text-align:left;cursor:pointer;
      min-width:0;flex:1;padding:1px 0}
    #paths-monkey-root .pm-title-collapse .pm-title{flex:unset}
    #paths-monkey-root.pm-expanded{box-shadow:inset 0 0 0 2px #472a39}
    @media(min-width:1180px){
      #paths-monkey-root .pm-compose{right:0;left:0;padding-left:calc(12px + max(0px,(100vw - 1200px)/4));}
    }
    @media(max-width:790px){
      #paths-monkey-root .pm-hbar{padding:6px 8px;gap:6px}
      #paths-monkey-root .pm-title{font-size:13px}
      #paths-monkey-root .pm-logo{cursor:pointer;touch-action:manipulation}
      #paths-monkey-root .pm-compose{left:0;right:0;padding:7px 8px 8px}
      #paths-monkey-root .pm-compose .pm-editor{height:40px;min-height:40px;max-height:112px}
      #paths-monkey-root .pm-actions{column-gap:13px;row-gap:10px}
      #paths-monkey-root .pm-btn.pm-mini{padding:5px 7px}
    }
  `);

  const root = document.createElement('div');
  root.id = 'paths-monkey-root';
  root.innerHTML = `
    <div id="pm-picker" class="pm-picker pm-hide" aria-label="HUD picker">
      <button id="pm-picker-main" class="pm-picker-main" type="button" aria-expanded="false" aria-haspopup="menu" title="Tap to open Paths HUD; long-press to switch HUDs.">☯ Paths of Immortality</button>
      <div id="pm-picker-menu" class="pm-picker-menu pm-hide" role="menu">
        <button id="pm-select-paths" type="button" class="pm-picker-option" role="menuitem">☯ Paths of Immortality</button>
        <button id="pm-select-mizuhana" type="button" class="pm-picker-option" role="menuitem">🌺 Mizuhana</button>
      </div>
    </div>
    <div class="pm-hbar">
      <button id="pm-logo-toggle" class="pm-logo" type="button" aria-label="Return to Admin page" aria-expanded="false" aria-controls="pm-sidebar" title="Return to Admin page">☯</button>
      <button id="pm-collapse-title" class="pm-title-collapse" type="button" title="Collapse the full Paths HUD"><span class="pm-title">Paths to Immortality</span></button>
      <span class="pm-compact-version">v${VERSION}</span>
      <button id="pm-settings-toggle" type="button" class="pm-btn pm-mini" title="Connections and settings">⚙</button>
      <button id="pm-minimize" type="button" class="pm-btn pm-mini" title="Collapse the entire Paths HUD" aria-label="Collapse Paths HUD">▁</button>
    </div>
    <section id="pm-sidebar" class="pm-left" aria-label="Admin page" aria-hidden="true" tabindex="-1">
      <h2 class="pm-name">Administration</h2>
      <button id="pm-manage-rooms" class="pm-btn pm-sidebar-action" type="button">📂 Create a New Room</button>
      <details id="pm-ongoing-sessions" class="pm-session-list" open><summary>Ongoing Sessions</summary><button id="pm-refresh-ongoing" class="pm-btn pm-mini" type="button">Refresh sessions</button><div id="pm-ongoing-list" class="pm-mute">Connect your HUD to load ongoing rooms.</div></details>
      <div id="pm-admin-feedback" class="pm-feedback" role="status" aria-live="polite"></div>
      <div class="pm-h">Current session</div>
      <div id="pm-room-title" class="pm-name">Not connected</div>
      <div id="pm-connection" class="pm-mute">Connect Monkey to Supabase</div>
      <div class="pm-divider"></div>
      <div class="pm-h">Characters</div>
      <div class="pm-mute">Your character: <strong>Xiao Lan</strong></div>
      <div id="pm-people" class="pm-mute">Participants not loaded</div>
      <div class="pm-divider"></div>
      <div class="pm-h">Heavenly calendar</div>
      <div class="pm-mute">Use confirmed scene date only.</div>
      <div class="pm-divider"></div>
      <div class="pm-h">Reference shelves</div>
      <a class="pm-link" href="${CODEX_URL}" target="_blank" rel="noopener noreferrer">☁ Cloudveil World Codex ↗</a>
      <a class="pm-link" href="${GM_RULES_URL}" target="_blank" rel="noopener noreferrer">📜 Narration Rules ↗</a>
      <a class="pm-link" href="${GAME_URL}" target="_blank" rel="noopener noreferrer">✦ Paths Web ↗</a>
      <div class="pm-divider"></div>
      <div class="pm-mute">Monkey only controls this HUD. ChatGPT still owns the actual narration and its blue Send button.</div>
    </section>
    <section id="pm-feed" class="pm-feed pm-hide" aria-label="Recent shared messages">
      <div class="pm-row"><strong id="pm-chat-title">☁ Chatroom</strong><button id="pm-feed-refresh" class="pm-btn pm-mini" type="button">↻</button><button id="pm-feed-close" class="pm-btn pm-mini" type="button">← Admin</button></div>
      <div id="pm-feed-messages" class="pm-mute">Connect a room to view messages.</div>
    </section>
    <section id="pm-compose" class="pm-compose" aria-label="Xiao Lan action composer">
      <div id="pm-compose-inner">
        <div class="pm-composer-line">
          <textarea id="pm-action" class="pm-text pm-editor" rows="1" maxlength="8000" placeholder="What does Xiao Lan do?" aria-label="Compose character or player message"></textarea>
          <button id="pm-send" type="button" class="pm-btn pm-primary pm-mini" title="Send this message to Paths Web">Send</button>
        </div>
        <div class="pm-actions">
          <button id="pm-narrate" type="button" class="pm-btn pm-mini" title="Prepare a GM instruction in ChatGPT">Narrate</button>
          <button id="pm-feed-toggle" type="button" class="pm-btn pm-mini" title="Scene introduction, invitations and session controls">Session tools</button>
          <button id="pm-identity-toggle" class="pm-mode-btn" type="button" aria-pressed="true" title="Bright: character action. Dim: out-of-character player chat.">Xiao Lan</button>
        </div>
        <div id="pm-feedback" class="pm-feedback" role="status" aria-live="polite"></div>
      </div>
    </section>
    <div id="pm-rooms-page" class="pm-backdrop pm-hide" role="presentation">
      <section class="pm-panel pm-room-page" role="dialog" aria-modal="true" aria-labelledby="pm-rooms-page-title">
        <div class="pm-row"><h2 id="pm-rooms-page-title">📂 Rooms & sessions</h2><button id="pm-rooms-page-close" class="pm-btn pm-mini" type="button">✕</button></div>
        <p id="pm-rooms-page-status">Create private rooms, choose a current session, or refresh your list.</p>
        <div id="pm-room-management-content"></div>
        <button id="pm-rooms-page-done" class="pm-btn" type="button">Done</button>
      </section>
    </div>
    <div id="pm-settings" class="pm-backdrop pm-hide" role="presentation">
      <section class="pm-panel" role="dialog" aria-modal="true" aria-labelledby="pm-settings-title">
        <div class="pm-row"><h2 id="pm-settings-title">☯ Monkey's briefcase</h2><button id="pm-settings-close" class="pm-btn pm-mini" type="button">✕</button></div>
        <div id="pm-pair-section" class="pm-hide">
          <div class="pm-pair-block">
            <div class="pm-h">🐒 Pairing & recovery</div>
            <p id="pm-pair-state" class="pm-mute">Not paired</p>
            <button id="pm-pair-request" class="pm-btn pm-primary" type="button">Request pairing code</button>
            <div id="pm-pair-code-area" class="pm-hide">
              <div id="pm-pair-code" class="pm-pair-code" aria-label="Private one-time pairing code"></div>
              <button id="pm-pair-copy" type="button" class="pm-btn">Copy pairing code</button>
              <p>In Paths Web, open one of your owner rooms, then ☯ Tools → Approve Paths HUD. Return here and refresh.</p>
            </div>
            <button id="pm-pair-refresh" class="pm-btn" type="button">Refresh authorization</button>
          </div>
          <div id="pm-pair-new-room" class="pm-pair-block pm-hide">
            <div class="pm-h">Create a new private room</div>
            <label class="pm-label" for="pm-pair-room-name">Room title</label>
            <input id="pm-pair-room-name" class="pm-text" maxlength="80" value="New Jianghu Session">
            <label class="pm-label" for="pm-pair-character-name">Your character</label>
            <input id="pm-pair-character-name" class="pm-text" maxlength="40" value="Xiao Lan">
            <button id="pm-pair-create-room" class="pm-btn pm-primary" type="button">Create owner room</button>
          </div>
        </div>
        <div id="pm-signin-section">
          <p>ChatGPT cannot reuse your Paths Web Google login. Create the Monkey's private anonymous identity and pair it to your owner account below.</p>
          <button id="pm-connect" class="pm-btn pm-primary" type="button">Create Monkey guest identity</button>
        </div>
        <div id="pm-room-section">
          <div id="pm-legacy-invite"><p class="pm-mute">Legacy option: joins as a separate player instead of pairing.</p>
          <label class="pm-label" for="pm-join-code">Private room invitation code (from the owner's website)</label>
          <input id="pm-join-code" class="pm-text" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Paste single-use invitation code">
          <label class="pm-label" for="pm-character-name">Monkey's character name</label>
          <input id="pm-character-name" class="pm-text" maxlength="40" value="Xiao Lan">
          <button id="pm-join" type="button" class="pm-btn pm-primary">Join invited room</button></div>
          <button id="pm-reload-rooms" type="button" class="pm-btn">Refresh room list</button>
          <div class="pm-h">My rooms</div>
          <div id="pm-room-list" class="pm-mute">No room selected</div>
          <div id="pm-session-tools" class="pm-pair-block pm-hide">
            <div class="pm-h">☯ Session control</div><p id="pm-session-status" class="pm-mute"></p>
            <label class="pm-label" for="pm-kick-player">Player in this room</label><select id="pm-kick-player" class="pm-text"><option value="">Select a player</option></select><button id="pm-kick-player-button" class="pm-btn" type="button">Kick player from the room</button>
            <div class="pm-row"><button id="pm-end-session" class="pm-btn" type="button">End session</button><button id="pm-reset-session" class="pm-btn" type="button">Reset session</button></div><div class="pm-divider"></div>
            <div class="pm-h">📜 Scene introduction</div>
            <p>One room = one session. These details appear on each player's private invitation.</p>
            <label class="pm-label" for="pm-scene-date">In-world date</label>
            <input id="pm-scene-date" class="pm-text" maxlength="90" placeholder="Year 312 · Early Spring, 2nd">
            <label class="pm-label" for="pm-scene-place">Current location</label>
            <input id="pm-scene-place" class="pm-text" maxlength="150" placeholder="Cloudveil Sect · Examination Grounds">
            <label class="pm-label" for="pm-scene-intro">Opening situation (up to 2500 characters)</label>
            <textarea id="pm-scene-intro" class="pm-text" maxlength="2500" rows="3" placeholder="Describe where the invited players begin. Keep unplayed events provisional."></textarea>
            <button id="pm-save-scene" class="pm-btn" type="button">Save scene introduction</button>
            <div class="pm-divider"></div>
            <div class="pm-h">✉ Invite a registered player</div>
            <p>Enter a nickname you've approved, then offer their available characters. Every invitation is private, single-use, and valid for 48 hours.</p>
            <label class="pm-label" for="pm-invite-player">Player nickname</label>
            <input id="pm-invite-player" class="pm-text" maxlength="45" placeholder="Puuchan">
            <label class="pm-label" id="pm-invite-list-label" for="pm-invite-list">Characters: Name | Description | Objective (one per line)</label>
            <textarea id="pm-invite-list" class="pm-text" maxlength="400" rows="3" placeholder="Xu Yi"></textarea>
            <button id="pm-make-invite" class="pm-btn pm-primary" type="button">Generate private invitation</button>
            <div id="pm-invite-output" class="pm-hide">
              <label class="pm-label" for="pm-invite-code">Private one-use invitation code</label><input id="pm-invite-code" class="pm-text" readonly><button id="pm-copy-invite-code" class="pm-btn" type="button">Copy invitation code</button>
              <label class="pm-label" for="pm-invite-link">Private one-use invitation link</label>
              <textarea id="pm-invite-link" class="pm-text" rows="3" readonly></textarea>
              <button id="pm-copy-invite" class="pm-btn" type="button">Copy invitation link</button>
            </div>
          </div>
        </div>
        <div class="pm-divider"></div>
        <button id="pm-close-panel" class="pm-btn">Done</button>
        <button id="pm-forget" type="button" class="pm-btn" title="Only reset Paths Monkey's separate guest identity, not your Cloudveil Google account">Forget Monkey guest identity</button>
        <p>Guest identity persists only while this script's private storage remains. Never share authentication tokens. The website owner account is separate.</p>
      </section>
    </div>
  `;
  document.documentElement.appendChild(root);
  // Move live room controls into their own panel without duplicating IDs or state.
  $('room-management-content').append($('pair-new-room'),$('room-section'));

  function feedback(message, bad = false) {
    $('feedback').textContent = message;
    $('feedback').style.color = bad ? '#ffbbb2' : '';
    $('admin-feedback').textContent=message;$('admin-feedback').style.color=bad?'#ffbbb2':'';
  }
  function setBusy(value) {
    busy = value;
    for (const name of ['send', 'connect', 'join', 'reload-rooms', 'narrate', 'feed-refresh','kick-player-button','end-session','reset-session','make-invite']) {
      const el = $(name);
      if (el) el.disabled = value;
    }
  }
  async function runTask(task) {
    if (busy) return;
    setBusy(true);
    try { await task(); }
    catch (err) { feedback(err.message || String(err), true); console.warn('[Paths Monkey]', err); }
    finally { setBusy(false);setConnectedState(); }
  }
  function setConnectedState() {
    const isInRoom = !!(account && selectedRoom&&selectedRoom.session_state!=='ended');
    if(!isInRoom&&!showSidebar)setInfoVisible(true);
    $('room-title').textContent = selectedRoom?.title || 'No room selected';
    $('connection').textContent = !account ? 'Monkey not connected' : paired ? (selectedRoom?'Trusted HUD · linked to owner':'Trusted HUD · select a room') : (!selectedRoom?'Monkey identity ready · pairing needed':'Guest access · pairing recommended');
    $('send').disabled = busy || !isInRoom;
    $('narrate').disabled = busy || !isInRoom;
    $('signin-section').classList.toggle('pm-hide', !!account);
    $('room-section').classList.toggle('pm-hide', !account);
    $('pair-section').classList.toggle('pm-hide',!account&&!paired);
    $('pair-request').classList.toggle('pm-hide',paired);
    $('pair-new-room').classList.toggle('pm-hide',!paired);
    $('session-tools').classList.toggle('pm-hide',!paired||!selectedRoom);
    $('legacy-invite').classList.toggle('pm-hide',paired);
    $('pair-state').textContent=paired?'✓ Owner has authorized this HUD':'Awaiting owner approval · get a temporary code';
    $('session-status').textContent=selectedRoom?.session_state==='ended'?'Session ended · reset it to start afresh.':'Ongoing session · no story time limit';
    for(const id of ['make-invite','save-scene','end-session'])$(id).disabled=busy||!selectedRoom||selectedRoom.session_state==='ended';
    $('people').textContent = members.length ? members.map((x) => x.character_name).join(' · ') : 'Participants not loaded';
  }
  function updateSpeakerToggle(){
    const element=$('identity-toggle');
    element.classList.toggle('pm-dim',!speakAsCharacter);
    element.setAttribute('aria-pressed',String(speakAsCharacter));
    element.title=speakAsCharacter?'Xiao Lan is acting. Tap for OOC player chat.':'OOC player is speaking. Tap for Xiao Lan actions.';
    $('action').placeholder=speakAsCharacter?'What does Xiao Lan do?':'The Jade Emperor has spoken!';
  }
  function setSpeaker(value){
    speakAsCharacter=Boolean(value);
    put('speakAsCharacter',speakAsCharacter);
    pendingRequestId=null;pendingRequestBody=null;pendingRequestKind=null;
    updateSpeakerToggle();
  }
  function draftKey() { return 'draft.' + (selectedRoom?.id || 'unbound'); }
  function autoGrowAction() {
    const field=$('action');
    // Start at exactly one line, expanding only as text wraps or has newlines.
    field.style.height='40px';
    const maxHeight=window.matchMedia('(max-width:790px)').matches?112:124;
    const desired=Math.max(40,Math.min(maxHeight,field.scrollHeight));
    field.style.height=desired+'px';
    field.style.overflowY=field.scrollHeight>maxHeight?'auto':'hidden';
  }
  function saveDraft() { put(draftKey(), $('action').value); }
  function restoreDraft() {
    $('action').value = get(draftKey(), '');
    autoGrowAction();
    pendingRequestId = null;
    pendingRequestBody = null;
    pendingRequestKind = null;
  }
  function authHeaders(token) {
    const h = { apikey: PUBLIC_KEY, Accept: 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return h;
  }
  function http(method, path, { body = null, token = null, prefer = null, timeout = 18000 } = {}) {
    return new Promise((resolve, reject) => {
      let url = SUPABASE + path;
      const headers = authHeaders(token);
      if (body !== null) headers['Content-Type'] = 'application/json';
      if (prefer) headers.Prefer = prefer;
      GM_xmlhttpRequest({
        method, url, headers, data: body === null ? undefined : JSON.stringify(body),
        responseType: 'text', timeout,
        onload: (r) => {
          let data = null;
          try { data = r.responseText ? JSON.parse(r.responseText) : null; }
          catch { data = r.responseText || null; }
          if (r.status >= 200 && r.status < 300) return resolve(data);
          const msg = (data && (data.message || data.msg || data.error_description || data.error)) || ('HTTP ' + r.status);
          const e = new Error(String(msg)); e.status = r.status; e.code = data?.code; reject(e);
        },
        onerror: () => reject(new Error('Network error contacting Supabase')),
        ontimeout: () => reject(new Error('Supabase connection timed out. Your draft is preserved.'))
      });
    });
  }
  async function refreshAuth() {
    if (!account?.refresh_token) throw new Error('Monkey needs to reconnect.');
    if (!refreshPromise) refreshPromise = (async () => {
      const r = await http('POST', '/auth/v1/token?grant_type=refresh_token', {body:{refresh_token:account.refresh_token}});
      if (!r.access_token || !r.refresh_token) throw new Error('Could not renew Monkey session.');
      account = {access_token:r.access_token, refresh_token:r.refresh_token, expires_at:Date.now() + (r.expires_in || 3600) * 1000, user_id:r.user?.id || account.user_id};
      put('account', account);
      return account.access_token;
    })().finally(() => { refreshPromise = null; });
    return refreshPromise;
  }
  async function validToken() {
    if (!account) throw new Error('Open ⚙ and create a Monkey guest identity first.');
    if (!account.expires_at || Date.now() > account.expires_at - 90000) return refreshAuth();
    return account.access_token;
  }
  async function authed(method, path, options = {}) {
    let token = await validToken();
    try { return await http(method, path, {...options, token}); }
    catch (e) {
      if (e.status !== 401) throw e;
      token = await refreshAuth();
      return http(method, path, {...options, token});
    }
  }
  async function refreshPairing(){
    if(!account){paired=false;setConnectedState();return;}
    const ok=await authed('POST','/rest/v1/rpc/monkey_pair_status',{body:{}});
    paired=ok===true;
    if(paired){$('pair-code').textContent='';$('pair-code-area').classList.add('pm-hide');}
    setConnectedState();
  }
  async function requestPairing(){
    if(!account)throw new Error('Create a Monkey identity first.');
    await refreshPairing();
    if(paired)throw new Error('Already paired. Revoke it from Paths Web if you need to replace this identity.');
    const code=await authed('POST','/rest/v1/rpc/request_monkey_pair_code',{body:{}});
    if(typeof code!=='string'||!/^[0-9a-f]{48}$/.test(code))throw new Error('No valid pairing code received.');
    $('pair-code').textContent=code;$('pair-code-area').classList.remove('pm-hide');
    feedback('One-time code ready; expires in 10 minutes.');
  }
  async function refreshPairedRooms(){
    await loadRooms();feedback(paired?'✓ Trusted HUD authorized! Select a room.':'Still unpaired. Approve the code under Paths Web → ☯ Tools.');
  }
  async function createOwnerRoom(){
    if(!paired)throw new Error('Pair the HUD first.');
    const title=$('pair-room-name').value.trim(),character=$('pair-character-name').value.trim();
    if(!title||title.length>80||!character||character.length>40)throw new Error('Enter a room title and character name.');
    const id=await authed('POST','/rest/v1/rpc/create_room_as_owner',{body:{p_title:title,p_character_name:character}});
    if(typeof id!=='string')throw new Error('Could not confirm new room creation.');
    await loadRooms();
    const item=rooms.find(x=>x.id===id);if(!item)throw new Error('Room created; refresh the list.');
    await chooseRoom(item);feedback('Room created under your owner account.');closeRoomPage();
  }
  async function saveSceneIntroduction(){
    if(!paired||!selectedRoom)throw new Error('Select an owner room first.');
    const sceneDate=$('scene-date').value.trim(),place=$('scene-place').value.trim(),intro=$('scene-intro').value.trim();
    if(!sceneDate||!place||!intro)throw new Error('Provide the scene date, location, and opening description first.');
    const success=await authed('POST','/rest/v1/rpc/set_scene_introduction_as_owner',{
      body:{p_room_id:selectedRoom.id,p_date:sceneDate,p_location:place,p_opening:intro}
    });
    if(success!==true)throw new Error('Saving scene introduction could not be confirmed.');
    feedback('✓ Scene introduction saved for '+selectedRoom.title);
  }
  async function createSessionInvitation(){
    if(!paired||!selectedRoom)throw new Error('Choose an owner room first.');
    const saved=await authed('POST','/rest/v1/rpc/get_scene_introduction_as_owner',
      {body:{p_room_id:selectedRoom.id}});
    if(!saved||!saved.scene_date||!saved.location||!saved.opening)
      throw new Error('Save the scene date, location, and opening description before inviting a player.');
    const player=$('invite-player').value.trim();
    const details=$('invite-list').value.split(/\n+/).map(x=>x.trim()).filter(Boolean).map(line=>{const parts=line.split('|').map(x=>x.trim());return {name:parts[0]||'',description:parts[1]||'',goal:parts[2]||''};});
    if(!player||!details.length||details.length>8)throw new Error('Enter a player nickname and 1–8 character options.');
    const token=await authed('POST','/rest/v1/rpc/create_player_invitation',{body:{p_room_id:selectedRoom.id,p_player_alias:player,p_character_details:details}});
    if(typeof token!=='string'||!/^[0-9a-f]{48}$/.test(token))
      throw new Error('Supabase did not generate a valid invitation.');
    const link='https://denoden3.github.io/Paths-to-Immortality/?invite='+encodeURIComponent(token);
    $('invite-code').value=token;$('invite-link').value=link;$('invite-output').classList.remove('pm-hide');
    feedback('Private invitation created for '+player+'. Send the link securely; it is one-use.');
  }
  function renderKickPlayers(){
    const select=$('kick-player'),previous=select.value;select.replaceChildren();const first=document.createElement('option');first.value='';first.textContent='Select a player';select.append(first);
    for(const m of members.filter(x=>x.role!=='owner')){const option=document.createElement('option');option.value=m.user_id;option.textContent=(m.player_alias||m.character_name)+' · '+m.character_name;select.append(option);}
    if([...select.options].some(x=>x.value===previous))select.value=previous;
  }
  async function controlSession(action){
    if(!paired||!selectedRoom)throw new Error('Select an owner room first.');
    const target=action==='kick'?$('kick-player').value:null;if(action==='kick'&&!target)throw new Error('Select a player to remove.');
    const prompt=action==='reset'?'Reset this session? This erases its chat messages and scene introduction, removes all players and invalidates all invitations. Character reminders are kept.':action==='end'?'End this session? Players lose access and all invitations stop working. Messages are kept.':'Remove the selected player from this room and invalidate their pending invitations?';
    if(!confirm(prompt))return;
    const ok=await authed('POST','/rest/v1/rpc/control_session',{body:{p_room_id:selectedRoom.id,p_action:action,p_user_id:target}});if(ok!==true)throw new Error('The server did not confirm this action.');
    if(action==='reset'){messages=[];$('scene-date').value='';$('scene-place').value='';$('scene-intro').value='';}
    $('invite-output').classList.add('pm-hide');$('invite-link').value='';$('invite-code').value='';
    await loadRooms();await refreshScene();feedback(action==='reset'?'Session reset. Save a new introduction and issue fresh invitations.':action==='end'?'Session ended. Players return to the starting page.':'Player removed.');
  }
  async function makeIdentity() {
    if (account) throw new Error('Monkey already has an identity. Use it or reset explicitly.');
    const r = await http('POST','/auth/v1/signup',{body:{data:{app:'Paths Monkey'},gotrue_meta_security:{}}});
    if (!r.access_token || !r.refresh_token || !r.user?.id) throw new Error('Supabase did not return an anonymous session. Enable Anonymous Sign-Ins first.');
    account = {access_token:r.access_token,refresh_token:r.refresh_token,expires_at:Date.now()+(r.expires_in||3600)*1000,user_id:r.user.id};
    put('account',account);
    feedback('Monkey identity created. Request a pairing code for approval on Paths Web.');
    await loadRooms();
    setConnectedState();
  }
  async function loadSceneIntro(){
    if(!paired||!selectedRoom)return;
    // Only the invite preview exposes these fields to recipients; owner data is loaded via a secure RPC below.
    const data=await authed('POST','/rest/v1/rpc/get_scene_introduction_as_owner',{body:{p_room_id:selectedRoom.id}});
    if(data&&typeof data==='object'){
      $('scene-date').value=data.scene_date||'';
      $('scene-place').value=data.location||'';
      $('scene-intro').value=data.opening||'';
    }
  }
  async function loadRooms() {
    if (!account) return;
    await refreshPairing();
    const data = await authed('GET','/rest/v1/rooms?select=id,title,created_at,session_state,session_generation&order=created_at.desc');
    rooms = Array.isArray(data) ? data : [];
    const box = $('room-list');box.replaceChildren();
    if (!rooms.length) { box.textContent='No rooms yet. Pair the HUD or use a legacy invitation.'; }
    for (const item of rooms) {
      const b=document.createElement('button');
      b.type='button';b.className='pm-btn';b.style.cssText='display:block;width:100%;margin:5px 0;text-align:left';
      b.textContent='☁ '+item.title+(item.session_state==='ended'?' · Ended':'');
      b.onclick=()=>runTask(()=>chooseRoom(item));
      box.appendChild(b);
    }
    if (selectedRoom) {
      const found=rooms.find(x=>x.id===selectedRoom.id);
      if (found) selectedRoom=found;
      else { saveDraft(); selectedRoom=null; members=[]; messages=[]; put('room',null); }
    }
    renderOngoingSessions();setConnectedState();
  }
  async function join() {
    if (!account) throw new Error('Connect Monkey guest first.');
    const code=$('join-code').value.trim().toLowerCase();
    const character=$('character-name').value.trim();
    if (!/^[0-9a-f]{48}$/.test(code)) throw new Error('Paste the full 48-character one-use invitation code.');
    if (!character || character.length>40) throw new Error('Choose a character name up to 40 characters.');
    const roomId=await authed('POST','/rest/v1/rpc/join_room',{
      body:{p_invite_code:code,p_character_name:character}
    });
    if (!roomId || typeof roomId!=='string') throw new Error('Supabase did not return the joined room.');
    $('join-code').value='';
    await loadRooms();
    const joined=rooms.find(x=>x.id===roomId);
    if (!joined) throw new Error('Joined, but the new room was not found in the list. Tap Refresh.');
    await chooseRoom(joined);
    feedback('Monkey joined '+joined.title+'. Xiao Lan may now post to your friend.');
    closeRoomPage();
  }
  async function chooseRoom(info) {
    if(info.session_state==='ended'){feedback('This scene has ended.');setInfoVisible(true);return;}
    saveDraft();
    selectedRoom={...info};
    put('room',selectedRoom);
    members=[]; messages=[];
    restoreDraft();
    setConnectedState();
    $('session-tools').classList.toggle('pm-hide',!paired);
    $('invite-output').classList.add('pm-hide');$('invite-link').value='';
    await refreshScene();
    if(paired)await loadSceneIntro();
    feedback('Connected to '+info.title);
    setInfoVisible(false);
    if(!$('rooms-page').classList.contains('pm-hide'))closeRoomPage();
  }
  async function refreshScene() {
    if (!selectedRoom || !account) return;
    const id=selectedRoom.id;
    const [p,m,r]=await Promise.all([
      authed('GET','/rest/v1/room_members?select=user_id,character_name,player_alias,role&room_id=eq.'+encodeURIComponent(id)),
      authed('GET','/rest/v1/messages?select=id,sender_id,kind,body,created_at,character_name&room_id=eq.'+encodeURIComponent(id)+'&order=created_at.desc&limit=24'),
      authed('GET','/rest/v1/rooms?select=id,session_state,session_generation&id=eq.'+encodeURIComponent(id))
    ]);
    if (!selectedRoom || selectedRoom.id!==id) return;
    if(!r?.[0]){saveDraft();selectedRoom=null;members=[];messages=[];put('room',null);setInfoVisible(true);setConnectedState();renderFeed();return;}
    selectedRoom={...selectedRoom,...r[0]};put('room',selectedRoom);rooms=rooms.map(x=>x.id===id?{...x,...r[0]}:x);renderOngoingSessions();
    members=Array.isArray(p)?p:[];
    renderKickPlayers();
    messages=Array.isArray(m)?m.reverse():[];
    setConnectedState();
    renderFeed();
  }
  function renderOngoingSessions(){
    const list=$('ongoing-list');list.replaceChildren();
    const active=rooms.filter(x=>x.session_state==='active');
    if(!active.length){list.textContent=account?'No ongoing sessions. Create a new room to begin.':'Connect your HUD in Settings to load sessions.';return;}
    for(const item of active){const button=document.createElement('button');button.type='button';button.className='pm-btn';button.textContent=item.title;button.onclick=()=>runTask(()=>chooseRoom(item));list.append(button);}
  }
  function renderFeed() {
    $('chat-title').textContent=selectedRoom?.title||'Chatroom';
    const el=$('feed-messages');el.replaceChildren();
    if (!selectedRoom) {el.textContent='Connect to a room to see its messages.';return;}
    if (!messages.length) {el.textContent='The hall is quiet. Nothing posted yet.';return;}
    for (const msg of messages) {
      const bubble=document.createElement('div');
      bubble.className='pm-bubble'+(msg.kind==='narrator'?' pm-narrator':'')+(msg.kind==='ooc'?' pm-oocBubble':'');
      const by=document.createElement('div');by.className='pm-by';
      const character=msg.character_name||members.find(x=>x.user_id===msg.sender_id)?.character_name || 'Player';
      by.textContent=msg.kind==='narrator'?'✦ Heavenly Voice':msg.kind==='ooc'?'💬 Player ('+character+') · OOC':character;
      const content=document.createElement('div');content.textContent=msg.body;
      bubble.append(by,content);el.append(bubble);
    }
    el.scrollTop=el.scrollHeight;
  }
  async function postAction() {
    if (!selectedRoom || !account) throw new Error('Join your existing Cloudveil room first.');
    const text=$('action').value.trim();
    if (!text) throw new Error('Write Xiao Lan\'s action first.');
    if (text.length>8000) throw new Error('Action is too long.');
    const kind=speakAsCharacter?'player':'ooc';
    if (!pendingRequestId || pendingRequestBody!==text || pendingRequestKind!==kind) {
      pendingRequestId=(crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+'-'+Math.random());
      pendingRequestBody=text;
      pendingRequestKind=kind;
    }
    try {
      if(paired){
        await authed('POST','/rest/v1/rpc/post_as_owner',{
          body:{p_room_id:selectedRoom.id,p_body:text,p_kind:kind,p_client_message_id:pendingRequestId}
        });
      }else{
        await authed('POST','/rest/v1/messages',{
          body:{room_id:selectedRoom.id,sender_id:account.user_id,body:text,kind,client_message_id:pendingRequestId},
          prefer:'return=minimal'
        });
      }
    } catch(e) {
      if (e.code!=='23505') throw e;
      // The same message ID was already accepted. Do not post a second copy.
    }
    $('action').value='';autoGrowAction();saveDraft();pendingRequestId=null;pendingRequestBody=null;pendingRequestKind=null;
    feedback(kind==='player'?'✓ Xiao Lan\'s action posted to Paths Web.':'✓ OOC chat posted to Paths Web.');
    await refreshScene();
  }
  function makeNarrateInstruction() {
    return 'Cloudveil GM: In Supabase Paths to Immortality, room '+selectedRoom.id+
      ', FIRST fetch and read the current Narration Rules at '+GM_RULES_URL+
      ' (Sections A Universal and C Shared; Section D only when ending a scene). Fetch relevant world canon and chronology where available. If retrieval fails, disclose it and ask for the rules; do not claim compliance. Then fetch pending CHARACTER actions (kind=player) since the last narration and IGNORE OOC chat (kind=ooc). Resolve one fair combined narration, and publish only via an actually authorized, verified Supabase write. If publishing fails, say so. Test only; no Notion edits.';
  }
  function copyText(value) {
    GM_setClipboard(value,'text');
  }
  function nativeComposer() {
    const selectors=['#prompt-textarea','[data-testid="composer-rich-text-input"]',
      'form [contenteditable="true"][role="textbox"]','form [contenteditable="true"]','form textarea'];
    for (const sel of selectors) {
      const els=document.querySelectorAll(sel);
      for(const el of els) {
        if(root.contains(el)) continue;
        const rect=el.getBoundingClientRect();
        if(rect.width>80 && rect.height>12 && rect.bottom>0 && rect.top<window.innerHeight) return el;
      }
    }
    return null;
  }
  function fillNativeComposer(text) {
    const el=nativeComposer();
    if(!el) return false;
    if((el.innerText||el.value||'').trim() && !confirm('ChatGPT already has text in its composer. Replace it with the short GM request?'))return false;
    el.focus();
    if(el.isContentEditable) {
      const sel=window.getSelection(),range=document.createRange();
      range.selectNodeContents(el);sel.removeAllRanges();sel.addRange(range);
      const worked=document.execCommand('insertText',false,text);
      if(!worked)return false;
      el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));
    } else {
      const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;
      if(setter)setter.call(el,text);else el.value=text;
      el.dispatchEvent(new Event('input',{bubbles:true}));
    }
    return (el.innerText||el.value||'').includes(text.slice(0,28));
  }
  function prepareNarrate() {
    if(!selectedRoom) { feedback('Connect Monkey to a room first.',true);return; }
    const instruction=makeNarrateInstruction();
    copyText(instruction);
    const filled=fillNativeComposer(instruction);
    feedback(filled?'GM instruction prepared below. Press ChatGPT\'s blue Send yourself.':'GM instruction copied! Paste into ChatGPT\'s native composer, then press blue Send.');
  }
  function resizeNativeInset() {
    const el=nativeComposer();
    if(!el)return;
    // The browser retains the ChatGPT composer; the Monkey action box floats ABOVE it.
    const r=el.getBoundingClientRect();
    if(r.width<100)return;
    const bottomSpace=window.innerHeight-r.top+14;
    const height=Math.round(Math.max(82,Math.min(235,bottomSpace)));
    if(Math.abs(height-lastNativeInset)>7) {
      lastNativeInset=height;
      root.style.setProperty('--pm-native',height+'px');
    }
  }
  function openRoomPage(mode='manage'){
    if(!account){openSettings();feedback('Connect your HUD in Settings first.');return;}
    root.classList.toggle('pm-creating',mode==='create');
    $('rooms-page-title').textContent=mode==='create'?'Create a New Room':'Session tools';
    previousFocus=window.matchMedia('(max-width:790px)').matches?$('logo-toggle'):document.activeElement;
    $('settings').classList.add('pm-hide');
    $('rooms-page').classList.remove('pm-hide');
    $('rooms-page-status').textContent=paired?'Trusted HUD · room ownership authorized':account?'Monkey connected · owner pairing not complete':'Connect the Monkey under ⚙ Settings first';
    $('session-tools').classList.toggle('pm-hide',!paired||!selectedRoom);
    setConnectedState();
    $('rooms-page-close').focus();
    if(account)runTask(loadRooms);
  }
  function closeRoomPage(){
    $('rooms-page').classList.add('pm-hide');
    if(previousFocus?.focus)previousFocus.focus();
  }
  function resizeHudBody(){
    const header=root.querySelector('.pm-hbar').getBoundingClientRect().height;
    const composer=$('compose').getBoundingClientRect().height;
    if(header>0)root.style.setProperty('--pm-header-height',Math.ceil(header)+'px');
    if(composer>0)root.style.setProperty('--pm-compose-height',Math.ceil(composer)+'px');
  }
  function setInfoVisible(visible){
    visible=visible||!account||!selectedRoom||selectedRoom.session_state!=='active';
    showSidebar=visible;
    root.classList.toggle('pm-admin',visible);
    $('sidebar').classList.toggle('pm-open',visible);
    $('sidebar').setAttribute('aria-hidden',String(!visible));
    $('logo-toggle').setAttribute('aria-expanded',String(visible));
    $('logo-toggle').setAttribute('aria-label','Return to Admin page');
    showFeed=!visible;$('feed').classList.toggle('pm-hide',visible);
    resizeHudBody();
  }
  function toggleSidebar(){setInfoVisible(true);if(account)runTask(loadRooms);}
  function openSettings() {
    previousFocus=document.activeElement;
    $('settings').classList.remove('pm-hide');setConnectedState();$('settings-close').focus();
    if(account)runTask(loadRooms);
  }
  function closeSettings() {
    $('settings').classList.add('pm-hide');
    if(previousFocus?.focus)previousFocus.focus();
  }
  function resetIdentity() {
    if(!confirm('Forget ONLY the temporary Paths Monkey identity and its room links? Your Google login on the Paths website and all existing messages will remain.'))return;
    saveDraft();
    account=null;paired=false;rooms=[];members=[];messages=[];selectedRoom=null;
    remove('account');remove('room');$('room-list').textContent='No rooms loaded';renderOngoingSessions();renderFeed();
    restoreDraft();setConnectedState();feedback('Monkey guest reset. Existing shared room data is untouched.');
  }

  function closePickerMenu() {
    $('picker-menu').classList.add('pm-hide');
    $('picker-main').setAttribute('aria-expanded','false');
  }
  function openPickerMenu() {
    const hasMizuhana=!!document.querySelector('#mizuhana-hud, #mizuhana-launcher, #mizu-hud-switcher');
    $('select-mizuhana').disabled=!hasMizuhana;
    $('select-mizuhana').title=hasMizuhana?'Switch to your Mizuhana HUD':'Mizuhana is not loaded on this page';
    $('picker-menu').classList.remove('pm-hide');
    $('picker-main').setAttribute('aria-expanded','true');
  }
  function closeAllPanels() {
    $('settings').classList.add('pm-hide');
    $('rooms-page').classList.add('pm-hide');
    $('feed').classList.add('pm-hide');
    setInfoVisible(true);showFeed=false;
    closePickerMenu();
  }
  function setHudMode(mode,expand=false) {
    hudMode=mode;
    hudExpanded=!!expand && mode==='paths';
    put('hudMode',hudMode);
    put('hudExpanded',hudExpanded);
    document.documentElement.classList.toggle('pm-paths-selected',mode==='paths');
    root.classList.toggle('pm-inactive',mode!=='paths');
    root.classList.toggle('pm-expanded',mode==='paths'&&hudExpanded);
    root.classList.toggle('pm-collapsed',mode==='paths'&&!hudExpanded);
    $('picker').classList.toggle('pm-hide',mode!=='paths'||hudExpanded);
    if(!hudExpanded)closeAllPanels();
    // The real Mizuhana script owns all its own saves and interface state.
    // We only yield display control or hide its launcher while Paths is selected.
    if(mode==='paths'&&hudExpanded){
      const activeMizuhana=document.querySelector('#mizuhana-hud #mizu-brand-collapse');
      if(activeMizuhana)activeMizuhana.click();
      setInfoVisible(showSidebar);resizeNativeInset();
    }
  }
  function switchToMizuhana(){
    const other=document.querySelector('#mizuhana-hud, #mizuhana-launcher, #mizu-hud-switcher');
    if(!other){feedback('Mizuhana is not active on this page.',true);return;}
    setHudMode('mizuhana',false);
    const control=document.querySelector('#mizuhana-launcher, #mizu-hud-pill');
    if(control)control.click();
  }
  function extendMizuhanaPicker(){
    // Mizuhana v0.7.29+ has its own native HUD picker. Add a route back
    // without changing its repository, saved world, or script internals.
    if(hudMode!=='mizuhana')return;
    const m=document.querySelector('#mizu-hud-menu');
    if(!m||m.querySelector('[data-paths-hud-option]'))return;
    const b=document.createElement('button');
    b.type='button';
    b.setAttribute('role','menuitem');
    b.setAttribute('data-paths-hud-option','true');
    b.textContent='☯ Paths of Immortality';
    b.onclick=(e)=>{e.stopPropagation();setHudMode('paths',true);};
    m.appendChild(b);
  }
  function showPaths(){setHudMode('paths',true);}

  $('picker-main').addEventListener('pointerdown',(e)=>{
    if(e.button!==0)return;
    clearTimeout(pickerHoldTimer);
    suppressPickerClick=false;
    pickerStart={x:e.clientX,y:e.clientY};
    pickerHoldTimer=setTimeout(()=>{pickerHoldTimer=null;suppressPickerClick=true;openPickerMenu();},480);
  });
  $('picker-main').addEventListener('pointermove',(e)=>{
    if(!pickerHoldTimer||!pickerStart)return;
    if(Math.abs(e.clientX-pickerStart.x)>18||Math.abs(e.clientY-pickerStart.y)>18){
      clearTimeout(pickerHoldTimer);pickerHoldTimer=null;
    }
  });
  for(const event of ['pointerup','pointercancel','pointerleave']){
    $('picker-main').addEventListener(event,()=>{clearTimeout(pickerHoldTimer);pickerHoldTimer=null;pickerStart=null;});
  }
  $('picker-main').addEventListener('click',e=>{
    if(suppressPickerClick){suppressPickerClick=false;e.preventDefault();return;}
    showPaths();
  });
  $('picker-main').addEventListener('contextmenu',e=>{e.preventDefault();openPickerMenu();});
  $('select-paths').onclick=showPaths;
  $('select-mizuhana').onclick=switchToMizuhana;
  $('collapse-title').onclick=()=>setHudMode('paths',false);

  $('settings-toggle').onclick=openSettings;
  $('logo-toggle').onclick=toggleSidebar;
  $('manage-rooms').onclick=()=>openRoomPage('create');
  $('refresh-ongoing').onclick=()=>runTask(loadRooms);
  $('rooms-page-close').onclick=closeRoomPage;
  $('rooms-page-done').onclick=closeRoomPage;
  $('rooms-page').addEventListener('click',e=>{if(e.target===$('rooms-page'))closeRoomPage();});
  $('settings-close').onclick=closeSettings;
  $('close-panel').onclick=closeSettings;
  $('connect').onclick=()=>runTask(makeIdentity);
  $('pair-request').onclick=()=>runTask(requestPairing);
  $('pair-copy').onclick=()=>{
    const code=$('pair-code').textContent;
    if(code)GM_setClipboard(code,'text');
    feedback('Code copied. Approve it in your Google-signed-in Paths Web → ☯ Tools.');
  };
  $('pair-refresh').onclick=()=>runTask(refreshPairedRooms);
  $('pair-create-room').onclick=()=>runTask(createOwnerRoom);
  $('save-scene').onclick=()=>runTask(saveSceneIntroduction);
  $('kick-player-button').onclick=()=>runTask(()=>controlSession('kick'));
  $('end-session').onclick=()=>runTask(()=>controlSession('end'));
  $('reset-session').onclick=()=>runTask(()=>controlSession('reset'));
  $('make-invite').onclick=()=>runTask(createSessionInvitation);
  $('copy-invite-code').addEventListener('click',()=>{const code=$('invite-code').value;if(code){GM_setClipboard(code);feedback('Private invitation code copied.');}});
  $('copy-invite').onclick=()=>{
    const link=$('invite-link').value;
    if(link){GM_setClipboard(link,'text');feedback('Invitation copied. Send it privately to the intended player.');}
  };
  $('reload-rooms').onclick=()=>runTask(loadRooms);
  $('join').onclick=()=>runTask(join);
  $('forget').onclick=resetIdentity;
  $('send').onclick=()=>runTask(postAction);
  $('narrate').onclick=prepareNarrate;
  $('feed-toggle').onclick=()=>openRoomPage('manage');
  $('feed-close').onclick=toggleSidebar;
  $('feed-refresh').onclick=()=>runTask(refreshScene);
  $('minimize').onclick=()=>setHudMode('paths',false);
  $('identity-toggle').onclick=()=>setSpeaker(!speakAsCharacter);
  $('action').addEventListener('input',()=>{autoGrowAction();saveDraft();if(pendingRequestBody!==$('action').value.trim()){pendingRequestBody=null;pendingRequestId=null;pendingRequestKind=null;}});
  $('action').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();runTask(postAction);}});
  $('settings').addEventListener('click',e=>{if(e.target===$('settings'))closeSettings();});
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(!$('rooms-page').classList.contains('pm-hide'))closeRoomPage();
    else if(!$('settings').classList.contains('pm-hide'))closeSettings();
    else if(!showSidebar)toggleSidebar();
    else if(!$('picker-menu').classList.contains('pm-hide'))closePickerMenu();
  });
  window.addEventListener('resize',()=>{resizeNativeInset();autoGrowAction();resizeHudBody();});
  const bodyLayoutObserver=new ResizeObserver(resizeHudBody);
  bodyLayoutObserver.observe(root.querySelector('.pm-hbar'));
  bodyLayoutObserver.observe($('compose'));
  window.addEventListener('beforeunload',saveDraft);
  if(typeof GM_registerMenuCommand==='function') {
    GM_registerMenuCommand('Open Paths of Immortality HUD',showPaths);
    GM_registerMenuCommand('Collapse Paths HUD',()=>setHudMode('paths',false));
    GM_registerMenuCommand('Paths HUD: Connections',()=>{showPaths();openSettings();});
    GM_registerMenuCommand('Paths HUD: Rooms & sessions',()=>{showPaths();openRoomPage();});
  }
  setInfoVisible(true);renderOngoingSessions();setConnectedState();restoreDraft();renderFeed();updateSpeakerToggle();
  setHudMode(hudMode,hudExpanded);
  // If Mizuhana is the selected script, allow a dropdown option to return here.
  const hudSwitcherObserver=new MutationObserver(extendMizuhanaPicker);
  hudSwitcherObserver.observe(document.body,{childList:true,subtree:true});
  setTimeout(resizeNativeInset,350);
  setTimeout(resizeNativeInset,1250);
  const layoutChecker=setInterval(()=>{if(hudMode==='paths'&&hudExpanded)resizeNativeInset();},1800);
  const checker=setInterval(()=>{
    if(account&&showSidebar&&document.visibilityState==='visible'&&!busy){runTask(loadRooms);return;}
    if(account && selectedRoom && document.visibilityState==='visible' && !busy) {
      refreshScene().catch((e)=>{ $('connection').textContent='⚠ '+e.message; });
    }
  },12000);
  window.addEventListener('pagehide',()=>{clearInterval(checker);clearInterval(layoutChecker);hudSwitcherObserver.disconnect();},{once:true});
  if(account) runTask(async()=>{
    try{await loadRooms();if(selectedRoom)await refreshScene();}
    catch(err){feedback('Saved guest session needs attention: '+err.message,true);}
  });
  // The setup panel opens only on demand; collapsed mode never forces a popup.
  // Do not read or scrape ChatGPT narration. The user's explicit blue Send remains sovereign.
  // Note: This is a separate Supabase guest, not the owner's Google account.
})();
