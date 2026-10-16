// ==UserScript==
// @name         Paths of Immortality HUD
// @namespace    paths-to-immortality.monkey
// @version      0.8.10
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

  const VERSION = '0.8.10';
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
  let roomsLoaded=false;
  let roomSetup={locations:[],players:[]},currentIntro={};
  let preparedRequest=get('prepareRequest',null);
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
  let hudHistory=[],restoringHudPage=false;
  let hudExpanded = get('hudExpanded', true);
  let hudMode = get('hudMode', 'paths');
  let pickerHoldTimer = null;
  let pickerStart = null;
  let suppressPickerClick = false;

  GM_addStyle(`
    #paths-monkey-root input,#paths-monkey-root textarea,#paths-monkey-root [contenteditable="true"]{caret-color:#ffd483 !important;}

    #paths-monkey-root .pm-date-fields{border:0;padding:0;margin:16px 0;min-width:0;}
    #paths-monkey-root .pm-date-fields legend{font-weight:600;margin-bottom:8px;}
    #paths-monkey-root .pm-date-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}
    #paths-monkey-root .pm-time-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0;}
    #paths-monkey-root .pm-date-grid label,#paths-monkey-root .pm-time-grid label{display:flex;flex-direction:column;gap:8px;min-width:0;}
    @media(max-width:600px){#paths-monkey-root .pm-date-grid{grid-template-columns:repeat(2,minmax(0,1fr));}#paths-monkey-root .pm-time-grid{grid-template-columns:minmax(0,1fr);}}

    #paths-monkey-root{position:fixed;inset:0;z-index:1500;pointer-events:none;
      --pm-ink:#fff3e6;--pm-muted:#ddc3b5;--pm-bg:#17141a;--pm-panel:#2b222c;--pm-red:#a82d3b;
      --pm-gold:#f6c280;--pm-stroke:#876c74;--pm-green:#9ce5cd;
      --pm-space-1:8px;--pm-space-2:16px;--pm-space-3:24px;--pm-content:1000px;
      color:var(--pm-ink);font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;text-align:left;text-shadow:none}
    #paths-monkey-root *{box-sizing:border-box;text-shadow:none}
    #paths-monkey-root h2,#paths-monkey-root h3,#paths-monkey-root p{margin:0}
    #paths-monkey-root strong{font-weight:700}
    #paths-monkey-root button,#paths-monkey-root input,#paths-monkey-root textarea,#paths-monkey-root select{font:inherit;letter-spacing:normal}
    #paths-monkey-root button{cursor:pointer}
    #paths-monkey-root button:disabled{opacity:.55;cursor:wait}
    #paths-monkey-root button:focus-visible,#paths-monkey-root a:focus-visible,
    #paths-monkey-root textarea:focus-visible,#paths-monkey-root input:focus-visible,
    #paths-monkey-root select:focus-visible,#paths-monkey-root summary:focus-visible{
      outline:3px solid var(--pm-gold);outline-offset:2px}
    #paths-monkey-root .pm-hbar{position:absolute;inset:0 0 auto;min-height:72px;padding:12px 16px;
      background:linear-gradient(100deg,#211922,#3c252e);border-bottom:1px solid var(--pm-stroke);
      pointer-events:auto;display:flex;align-items:center;gap:12px;box-shadow:0 2px 12px #07040888}
    #paths-monkey-root .pm-logo{background:#632732;border:1px solid #98505d;border-radius:10px;
      height:44px;width:44px;display:grid;place-items:center;font-size:21px;flex-shrink:0}
    #paths-monkey-root .pm-title{font-size:18px;font-weight:700;line-height:1.3;letter-spacing:.01em;flex:1}
    #paths-monkey-root .pm-compact-version{font-size:14px;color:var(--pm-gold)}
    #paths-monkey-root .pm-btn{min-height:44px;min-width:44px;font-size:16px;line-height:1.4;border:1px solid var(--pm-stroke);border-radius:9px;
      padding:10px 16px;background:#3e303a;color:var(--pm-ink);font-weight:700}
    #paths-monkey-root .pm-btn.pm-nav-active{background:#632732;border-color:var(--pm-gold);color:var(--pm-ink);box-shadow:inset 3px 0 var(--pm-gold)}
    #paths-monkey-root .pm-btn.pm-primary{background:var(--pm-red);border-color:#eb7777;color:#fff}
    #paths-monkey-root .pm-btn.pm-mini{padding:10px 12px;font-size:16px}
    #paths-monkey-root .pm-text{border:1px solid #a28a91;border-radius:10px;background:#17131b;
      color:var(--pm-ink);padding:10px 12px;min-height:48px;width:100%;outline:none}
    #paths-monkey-root .pm-text::placeholder{color:#baa9ae}
    #paths-monkey-root .pm-left{display:none;position:absolute;left:0;right:0;
      top:var(--pm-header-height,53px);bottom:calc(var(--pm-native,95px) + var(--pm-compose-height,120px));
      background:var(--pm-bg);overflow-y:auto;overscroll-behavior:contain;
      pointer-events:auto;padding:18px clamp(12px,3vw,32px) 24px}
    #paths-monkey-root .pm-left.pm-open{display:block}
    /* Information toggle leaves the underlying HUD page mounted. */
    #paths-monkey-root.pm-info-overlay .pm-left{display:block!important;bottom:var(--pm-native,95px);z-index:2}
    #paths-monkey-root.pm-info-overlay .pm-feed,
    #paths-monkey-root.pm-info-overlay .pm-compose,
    #paths-monkey-root.pm-info-overlay .pm-registry,
    #paths-monkey-root.pm-info-overlay .pm-roomlogs,
    #paths-monkey-root.pm-info-overlay .pm-backdrop{visibility:hidden}
    #paths-monkey-root.pm-info-dismissed .pm-left{display:none!important}

    #paths-monkey-root.pm-admin .pm-left{bottom:var(--pm-native,95px)}
    #paths-monkey-root.pm-admin .pm-compose{display:none}
    #paths-monkey-root .pm-session-list summary{cursor:pointer;min-height:44px;font-weight:700;color:var(--pm-gold);padding:10px 0}
    #paths-monkey-root #pm-people{font-size:16px;line-height:1.65;color:var(--pm-ink)}
    #paths-monkey-root #pm-people > div{padding:8px 0;border-bottom:1px solid var(--pm-stroke);overflow-wrap:anywhere}
    #paths-monkey-root #pm-character-session{margin:8px 0 12px}
    #paths-monkey-root #pm-open-picked-room{width:100%;text-align:left}
    #paths-monkey-root .pm-admin-group > summary{font-size:18px;font-weight:700;cursor:pointer;min-height:44px;padding:8px 0;margin-bottom:12px}
    #paths-monkey-root .pm-admin-group + .pm-admin-group{border-top:1px solid var(--pm-stroke);margin-top:16px;padding-top:12px}
    #paths-monkey-root .pm-roomlogs,
    #paths-monkey-root .pm-registry{display:none;position:absolute;inset:var(--pm-header-height,53px) 0 var(--pm-native,95px);overflow-y:auto;background:var(--pm-bg);pointer-events:auto;padding:24px clamp(16px,3vw,40px) 32px}
    #paths-monkey-root.pm-roomlogs-open .pm-roomlogs{display:block}
    #paths-monkey-root.pm-roomlogs-open .pm-left{display:none}
    #paths-monkey-root.pm-registry-open .pm-registry{display:block}
    #paths-monkey-root.pm-registry-open .pm-left{display:none}
    #paths-monkey-root .pm-player-card{border:1px solid var(--pm-stroke);border-radius:16px;padding:20px;margin:0;background:#211b24}
    #paths-monkey-root .pm-player-card input{margin:0}
    #paths-monkey-root #pm-registry-toggle{background:transparent}
    #paths-monkey-root .pm-input-row{display:flex;gap:12px;align-items:center;margin:0}
    #paths-monkey-root .pm-input-row > .pm-text{flex:1;min-width:0}
    #paths-monkey-root .pm-input-row>.pm-field{flex:1;min-width:0;margin:0}
    #paths-monkey-root .pm-labeled-input-row{align-items:flex-end}
    #paths-monkey-root .pm-player-option{display:flex;gap:9px;align-items:center;min-height:44px;margin:8px 0}
    #paths-monkey-root .pm-player-option input{width:18px;height:18px;flex-shrink:0}
    #paths-monkey-root .pm-player-heading{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px;font-size:18px;line-height:1.5;margin-bottom:12px;overflow-wrap:anywhere}
    #paths-monkey-root .pm-player-heading .pm-mute{font-size:14px;font-weight:400}
    #paths-monkey-root .pm-btn.pm-registry-active{background:#632732;border-color:var(--pm-gold);color:var(--pm-ink)}
    #paths-monkey-root .pm-character-card{border:1px solid var(--pm-stroke);border-radius:12px;padding:16px;margin-top:16px}
    #paths-monkey-root .pm-saved-character>summary{cursor:pointer;font-weight:700;font-size:18px;line-height:1.5;padding:8px;min-height:44px;overflow-wrap:anywhere}
    #paths-monkey-root .pm-character-description{white-space:pre-wrap;overflow-wrap:anywhere;max-width:70ch;line-height:1.7;margin:16px 0}
    #paths-monkey-root .pm-character-editor{border-top:1px solid var(--pm-stroke);margin-top:20px;padding-top:20px}
    #paths-monkey-root a.pm-btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
    #paths-monkey-root a.pm-btn[aria-disabled=true]{opacity:.55;cursor:default}
    #paths-monkey-root .pm-character-card textarea{resize:vertical;min-height:112px}
    #paths-monkey-root .pm-session-list .pm-btn{display:block;width:100%;text-align:left;margin:7px 0}
    #paths-monkey-root.pm-creating #pm-room-section,#paths-monkey-root.pm-creating #pm-prepared-invites{display:none!important}
    #paths-monkey-root:not(.pm-creating) #pm-room-management-content > #pm-pair-new-room{display:none}
    #paths-monkey-root .pm-logo[aria-expanded="true"]{background:#7b3646;border-color:var(--pm-gold)}
    #paths-monkey-root .pm-h{font-weight:700;color:var(--pm-gold);font-size:14px;letter-spacing:.015em;
      text-transform:none;margin:16px 0 8px}
    #paths-monkey-root .pm-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
    #paths-monkey-root .pm-mute{color:var(--pm-muted);font-size:14px;line-height:1.6}
    #paths-monkey-root .pm-name{font-size:20px;font-weight:700;line-height:1.35;margin:0;overflow-wrap:anywhere}
    #paths-monkey-root .pm-divider{height:1px;background:#6c525d;margin:24px 0}
    #paths-monkey-root .pm-link{color:var(--pm-gold);display:block;text-decoration:underline;
      padding:10px 0;font-size:16px;min-height:44px}
    #paths-monkey-root .pm-compose{position:absolute;bottom:var(--pm-native,95px);
      left:0;right:0;max-width:100%;padding:8px 12px 9px;border-top:1px solid var(--pm-stroke);
      background:linear-gradient(110deg,#271d28,#39262e);box-shadow:0 -4px 14px #0b080caa;
      pointer-events:auto}
    #paths-monkey-root .pm-composer-line{display:flex;gap:10px;align-items:flex-start}
    #paths-monkey-root .pm-compose .pm-editor{display:block;resize:none;overflow-y:hidden;
      flex:1;min-width:0;height:48px;min-height:48px;max-height:144px;font-size:16px;line-height:24px;padding:11px 12px}
    #paths-monkey-root .pm-composer-line #pm-send{min-height:48px;align-self:flex-start;
      padding:11px 16px;flex-shrink:0;font-size:16px}
    #paths-monkey-root .pm-actions #pm-narrate{background:#1458aa;border-color:#78b5ff;color:#fff;
      box-shadow:0 1px 8px #1155bb55}
    #paths-monkey-root .pm-actions #pm-narrate:hover{background:#104b94}
    #paths-monkey-root .pm-pair-code{overflow-wrap:anywhere;font:14px/1.6 ui-monospace,monospace;user-select:text;color:var(--pm-gold);background:#211b24;border:1px solid var(--pm-gold);padding:10px;border-radius:9px}
    #paths-monkey-root .pm-pair-block{border:1px solid var(--pm-stroke);border-radius:12px;margin:16px 0;padding:20px;background:#302631}
    #paths-monkey-root .pm-pair-block .pm-btn{margin-top:8px}
    #paths-monkey-root .pm-mode-btn{min-height:48px;min-width:86px;background:#b73543;
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
    #paths-monkey-root .pm-feedback{color:var(--pm-gold);font-size:14px;line-height:1.6;overflow-wrap:anywhere;margin-top:8px}
    #paths-monkey-root .pm-feedback:empty{display:none}
    #paths-monkey-root .pm-feed{position:absolute;left:0;right:0;top:var(--pm-header-height,53px);
      bottom:calc(var(--pm-native,95px) + var(--pm-compose-height,120px));overflow-y:auto;
      overscroll-behavior:contain;background:var(--pm-bg);pointer-events:auto;padding:24px}
    #paths-monkey-root .pm-bubble{background:#382a34;border:1px solid #775b63;border-radius:9px;
      margin:16px 0;padding:16px;font-size:16px;line-height:1.7;overflow-wrap:anywhere;white-space:pre-wrap}
    #paths-monkey-root .pm-bubble.pm-narrator{background:#363021;border-color:var(--pm-gold)}
    #paths-monkey-root .pm-by{font-weight:700;font-size:14px;color:var(--pm-gold);margin-bottom:8px}
    #paths-monkey-root .pm-backdrop{position:absolute;inset:0;background:#08060ac9;
      pointer-events:auto;display:grid;place-items:center;padding:14px}
    #paths-monkey-root .pm-panel{width:min(500px,100%);max-height:92vh;overflow-y:auto;
      border-radius:17px;padding:17px;border:1px solid #a47c81;background:#29212b;
      box-shadow:0 14px 50px #000b}
    #paths-monkey-root .pm-panel h2{font-size:24px;line-height:1.35;font-weight:700;margin:0}
    #paths-monkey-root .pm-logo{cursor:pointer;color:var(--pm-ink)}
    #paths-monkey-root .pm-logo:focus-visible{outline:3px solid var(--pm-gold);outline-offset:2px}
    #paths-monkey-root .pm-sidebar-action{width:100%;text-align:left;margin:0 0 12px}
    #paths-monkey-root .pm-room-page{max-height:85vh}
    #paths-monkey-root .pm-room-page #pm-room-section{display:block}
    #paths-monkey-root .pm-room-page .pm-pair-block{margin:8px 0}

    #paths-monkey-root .pm-label{display:block;font-size:14px;line-height:1.5;color:var(--pm-muted);font-weight:600;margin:16px 0 8px}
    #paths-monkey-root .pm-panel .pm-text{margin-bottom:5px}
    #paths-monkey-root .pm-panel p{color:var(--pm-muted);font-size:14px;line-height:1.6;margin:12px 0}
    #paths-monkey-root .pm-panel .pm-btn{margin:8px 8px 0 0}
    #paths-monkey-root .pm-panel .pm-row .pm-btn{margin:0}
    #paths-monkey-root .pm-hide{display:none!important}
    #paths-monkey-root .pm-pill{font-size:14px;border-radius:30px;background:#4e343d;color:var(--pm-gold);
      padding:4px 9px;border:1px solid #855663}

    /* Shared typography and spacing rhythm across all HUD pages. */
    #paths-monkey-root .pm-registry>*,#paths-monkey-root .pm-roomlogs>*{max-width:var(--pm-content);margin-left:auto;margin-right:auto}
    #paths-monkey-root .pm-registry>.pm-row,#paths-monkey-root .pm-roomlogs>.pm-row{margin-bottom:16px}
    #paths-monkey-root .pm-registry>.pm-row .pm-name,#paths-monkey-root .pm-roomlogs>.pm-row .pm-name{font-size:24px;margin-right:auto}
    #paths-monkey-root .pm-registry>p{margin-top:12px;margin-bottom:16px;max-width:var(--pm-content)}
    #paths-monkey-root #pm-registry-list{display:grid;gap:16px}
    #paths-monkey-root #pm-registry-toggle{display:block;margin-top:16px;margin-bottom:12px;margin-left:max(0px,calc((100% - var(--pm-content))/2))}
    #paths-monkey-root #pm-registry-create{padding:16px 0}
    #paths-monkey-root #pm-registry-status:empty,#paths-monkey-root #pm-roomlogs-detail:empty{display:none}
    #paths-monkey-root .pm-player-card>.pm-row{margin-bottom:12px}
    #paths-monkey-root .pm-player-card>.pm-hide+p{margin-top:12px}
    #paths-monkey-root .pm-character-card{background:#19151d}
    #paths-monkey-root .pm-character-note{margin-bottom:12px}
    #paths-monkey-root .pm-character-card p[role=status]:not(:empty){margin:12px 0}
    #paths-monkey-root .pm-character-card.pm-saved-character{padding:0}
    #paths-monkey-root .pm-saved-character>summary{padding:16px 20px;background:#302631;border-radius:11px}
    #paths-monkey-root .pm-saved-character[open]>summary{border-bottom:1px solid var(--pm-stroke);border-radius:11px 11px 0 0}
    #paths-monkey-root .pm-character-body{display:grid;grid-template-columns:minmax(0,1fr) 144px;padding:0}
    #paths-monkey-root .pm-character-body>.pm-character-description{min-width:0;margin:0;padding:20px}
    #paths-monkey-root .pm-character-actions{flex-direction:column;align-items:stretch;justify-content:flex-start;border-left:1px solid var(--pm-stroke);padding:20px 16px;gap:12px}
    #paths-monkey-root .pm-character-actions>.pm-btn{width:100%}
    #paths-monkey-root .pm-character-body>.pm-character-editor{grid-column:1/-1;margin:0;padding:20px;border-top:1px solid var(--pm-stroke)}
    @media(max-width:600px){
      #paths-monkey-root .pm-character-body{grid-template-columns:minmax(0,1fr)}
      #paths-monkey-root .pm-character-actions{border-left:0;border-top:1px solid var(--pm-stroke);flex-direction:row;flex-wrap:wrap;padding:16px 20px}
      #paths-monkey-root .pm-character-actions>.pm-btn{width:auto;min-width:96px}
    }
    #paths-monkey-root .pm-character-editor>.pm-text,#paths-monkey-root .pm-character-card>.pm-text{margin:12px 0}
    #paths-monkey-root .pm-character-editor>.pm-row{margin-top:16px}
    #paths-monkey-root .pm-character-card p[role=status]:empty{display:none}
    #paths-monkey-root .pm-character-card .pm-link{margin:8px 0}
    #paths-monkey-root .pm-field{display:block;margin:16px 0}
    #paths-monkey-root .pm-field>span{display:block;font-size:14px;font-weight:600;color:var(--pm-muted);margin-bottom:8px}
    #paths-monkey-root .pm-field>.pm-text{display:block}
    #paths-monkey-root .pm-btn:not(:disabled):hover{border-color:var(--pm-gold);filter:brightness(1.08)}
    #paths-monkey-root summary:hover{color:var(--pm-gold)}
    #paths-monkey-root #pm-feed>.pm-row,#paths-monkey-root #pm-feed-messages{max-width:var(--pm-content);margin-inline:auto}
    #paths-monkey-root .pm-bubble{max-width:76ch}
    #paths-monkey-root #pm-feed>.pm-row{margin-bottom:24px}
    #paths-monkey-root #pm-chat-title{font-size:20px;margin-right:auto}
    #paths-monkey-root .pm-panel{padding:24px}
    #paths-monkey-root .pm-panel>.pm-row:first-child{gap:16px;margin-bottom:20px;justify-content:space-between}
    #paths-monkey-root #pm-settings-toggle,#paths-monkey-root #pm-minimize{width:44px;height:44px;min-width:44px;padding:4px;font-size:24px;line-height:1}
    #paths-monkey-root select{max-width:100%}
    #paths-monkey-root .pm-session-facts{display:grid;grid-template-columns:minmax(120px,160px) minmax(0,1fr);gap:12px 24px;margin:20px 0 0}
    #paths-monkey-root .pm-session-facts dt{color:var(--pm-muted);font-size:14px;font-weight:600}
    #paths-monkey-root .pm-session-facts dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
    #paths-monkey-root #pm-session-details-editor>summary{cursor:pointer;min-height:44px;padding:10px 0;font-weight:700;color:var(--pm-gold)}
    @media(max-width:600px){#paths-monkey-root .pm-session-facts{grid-template-columns:minmax(0,1fr);gap:4px}#paths-monkey-root .pm-session-facts dd{margin-bottom:12px}}
    @media(max-width:790px){
      #paths-monkey-root .pm-registry,#paths-monkey-root .pm-roomlogs,#paths-monkey-root .pm-feed{padding:20px 16px 28px}
      #paths-monkey-root .pm-player-card{padding:16px}
      #paths-monkey-root .pm-character-card{padding:12px}
      #paths-monkey-root .pm-panel{padding:20px 16px}
      #paths-monkey-root .pm-compact-version{font-size:14px}
      #paths-monkey-root .pm-input-row{flex-wrap:wrap}
      #paths-monkey-root .pm-input-row>.pm-text,#paths-monkey-root .pm-input-row>.pm-field{flex-basis:180px}
      #paths-monkey-root .pm-input-row>.pm-btn{flex-shrink:0}
    }
    @media(prefers-reduced-motion:reduce){#paths-monkey-root *,#paths-monkey-root *::before,#paths-monkey-root *::after{scroll-behavior:auto;transition:none;animation:none}}

    /* Shared-style HUD picker: a single capsule only while Paths is collapsed. */
    html.pm-paths-selected #mizu-hud-switcher,
    html.pm-paths-selected #mizuhana-launcher {display:none !important;}
    /* Mizuhana remains mounted but cannot cover Paths when Paths is selected. */
    html.pm-paths-selected #mizuhana-hud {visibility:hidden !important;pointer-events:none !important;}
    #paths-monkey-root.pm-collapsed .pm-hbar,
    #paths-monkey-root.pm-collapsed .pm-roomlogs,
    #paths-monkey-root.pm-collapsed .pm-registry,
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
      color:#fff3e6;text-align:left;font-size:16px;font-weight:700}
    #paths-monkey-root .pm-picker-option:disabled{opacity:.5}
    #paths-monkey-root .pm-title-collapse{background:none;border:0;color:inherit;
      font:inherit;display:flex;flex-direction:column;text-align:left;cursor:pointer;
      min-width:0;flex:1;padding:1px 0}
    #paths-monkey-root .pm-title-collapse .pm-title{flex:unset}
    #paths-monkey-root.pm-expanded{box-shadow:inset 0 0 0 2px #472a39}
    @media(min-width:791px){
      #paths-monkey-root #pm-settings-toggle,#paths-monkey-root #pm-minimize{width:44px;height:44px;min-width:44px;padding:4px;font-size:24px;line-height:1}
      #paths-monkey-root{--pm-sidebar-width:clamp(260px,25vw,330px)}
      #paths-monkey-root.pm-info-dismissed{--pm-sidebar-width:0px}
      #paths-monkey-root .pm-left{display:block!important;right:auto;width:var(--pm-sidebar-width);bottom:var(--pm-native,95px);padding:20px 16px;border-right:1px solid var(--pm-stroke)}
      #paths-monkey-root .pm-feed,#paths-monkey-root .pm-registry,#paths-monkey-root .pm-roomlogs{left:var(--pm-sidebar-width)}
      #paths-monkey-root .pm-compose{left:var(--pm-sidebar-width);padding:8px 12px 9px}
      #paths-monkey-root .pm-backdrop{left:var(--pm-sidebar-width);top:var(--pm-header-height,53px);bottom:var(--pm-native,95px);padding:18px;background:var(--pm-bg);place-items:stretch}
      #paths-monkey-root .pm-panel{width:100%;max-width:var(--pm-content);margin-inline:auto;max-height:100%;height:100%;border:0;border-radius:0;box-shadow:none}
      #paths-monkey-root.pm-info-overlay .pm-feed,#paths-monkey-root.pm-info-overlay .pm-compose,
      #paths-monkey-root.pm-info-overlay .pm-registry,#paths-monkey-root.pm-info-overlay .pm-roomlogs,
      #paths-monkey-root.pm-info-overlay .pm-backdrop{visibility:visible}
    }
    @media(max-width:790px){
      #paths-monkey-root .pm-hbar{padding:10px 12px;gap:8px}
      #paths-monkey-root .pm-title{font-size:16px}
      #paths-monkey-root .pm-logo{cursor:pointer;touch-action:manipulation}
      #paths-monkey-root .pm-compose{left:0;right:0;padding:7px 8px 8px}
      #paths-monkey-root .pm-compose .pm-editor{height:48px;min-height:48px;max-height:144px}
      #paths-monkey-root .pm-actions{column-gap:13px;row-gap:10px}
      #paths-monkey-root .pm-btn.pm-mini{padding:10px 12px}
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
      <button id="pm-logo-toggle" class="pm-logo" type="button" aria-label="Toggle information panel" aria-expanded="false" aria-controls="pm-sidebar" title="Open or close information panel">☯</button>
      <button id="pm-collapse-title" class="pm-title-collapse" type="button" title="Collapse the full Paths HUD"><span class="pm-title">Paths to Immortality</span></button>
      <span class="pm-compact-version">v${VERSION}</span>
      <button id="pm-settings-toggle" aria-label="Settings" type="button" class="pm-btn pm-mini" title="Connections and settings">⚙</button>
      <button id="pm-minimize" type="button" class="pm-btn pm-mini" title="Collapse the entire Paths HUD" aria-label="Collapse Paths HUD">▁</button>
    </div>
    <section id="pm-sidebar" class="pm-left" aria-label="Admin page" aria-hidden="true" tabindex="-1">
<details id="pm-administration-group" class="pm-admin-group" open><summary>Administration</summary>
      <button id="pm-manage-rooms" class="pm-btn pm-sidebar-action" type="button">＋ Create a New Room</button>
      <button id="pm-open-roomlogs" class="pm-btn pm-sidebar-action" type="button">Room Logs</button>
<button id="pm-open-registry" class="pm-btn pm-sidebar-action" type="button">Players Registry</button></details>
      <div id="pm-admin-feedback" class="pm-feedback" role="status" aria-live="polite"></div>
      <details id="pm-current-session-group" class="pm-admin-group" open><summary>Current Session</summary>
      <select id="pm-character-session" class="pm-text" aria-label="Active session"><option value="">Choose a session</option></select>
      <button id="pm-open-picked-room" class="pm-btn pm-hide" type="button"></button>
      <div class="pm-divider"></div><div class="pm-h">Characters</div>
      <div id="pm-people" class="pm-mute">Participants not loaded</div>
      <div class="pm-divider"></div>
      <div class="pm-h">Heavenly calendar</div>
      <div id="pm-calendar" class="pm-mute">No confirmed scene date loaded.</div></details>
      <div class="pm-divider"></div>
      <div class="pm-h">Reference shelves</div>
      <a class="pm-link" href="${CODEX_URL}" target="_blank" rel="noopener noreferrer">☁ Cloudveil World Codex ↗</a>
      <a class="pm-link" href="${GM_RULES_URL}" target="_blank" rel="noopener noreferrer">📜 Narration Rules ↗</a>
      <a class="pm-link" href="${GAME_URL}" target="_blank" rel="noopener noreferrer">✦ Paths Web ↗</a>
    </section>
    <section id="pm-roomlogs" class="pm-roomlogs" aria-label="Room Logs" aria-hidden="true"><div class="pm-row"><h2 class="pm-name">Room Logs</h2><button id="pm-roomlogs-back" class="pm-btn pm-mini" type="button">← Admin</button><button id="pm-roomlogs-refresh" class="pm-btn pm-mini" type="button" aria-label="Refresh room logs">↻</button></div><div id="pm-roomlogs-detail" role="status"></div><div id="pm-roomlogs-list"></div></section>
    <section id="pm-registry" class="pm-registry" aria-label="Players Registry" aria-hidden="true">
    <div class="pm-row"><h2 class="pm-name">Players Registry</h2><button id="pm-registry-back" class="pm-btn pm-mini" type="button">← Admin</button><button id="pm-registry-refresh" class="pm-btn pm-mini" type="button" aria-label="Refresh players">↻</button></div>
    <p class="pm-mute">Manage players, their characters, and current sessions.</p>
    <button id="pm-registry-toggle" class="pm-btn" type="button" aria-expanded="false" aria-controls="pm-registry-create">Register Player</button>
    <div id="pm-registry-create" class="pm-hide"><label for="pm-registry-name" class="pm-label">New player name</label><div class="pm-input-row"><input id="pm-registry-name" class="pm-text" maxlength="45" placeholder="e.g. Puuchan"><button id="pm-registry-add" class="pm-btn pm-primary" type="button">Register</button></div></div>
    <p id="pm-registry-status" class="pm-mute" role="status" aria-live="polite"></p><div id="pm-registry-list"></div></section>
    <section id="pm-feed" class="pm-feed pm-hide" aria-label="Recent shared messages">
      <div class="pm-row"><strong id="pm-chat-title">☁ Chatroom</strong><button id="pm-feed-refresh" aria-label="Refresh chatroom" class="pm-btn pm-mini" type="button">↻</button><button id="pm-feed-close" class="pm-btn pm-mini" type="button">← Admin</button></div>
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
          <button id="pm-feed-toggle" type="button" class="pm-btn pm-mini" title="Information, invitations and controls for this chatroom">Session tools</button>
          <button id="pm-identity-toggle" class="pm-mode-btn" type="button" aria-pressed="true" title="Bright: character action. Dim: out-of-character player chat.">Xiao Lan</button>
        </div>
        <div id="pm-feedback" class="pm-feedback" role="status" aria-live="polite"></div>
      </div>
    </section>
    <div id="pm-rooms-page" class="pm-backdrop pm-hide" role="presentation">
      <section class="pm-panel pm-room-page" role="dialog" aria-modal="true" aria-labelledby="pm-rooms-page-title">
        <div class="pm-row"><h2 id="pm-rooms-page-title">📂 Rooms & sessions</h2><button id="pm-rooms-page-close" aria-label="Close session tools" class="pm-btn pm-mini" type="button">✕</button></div>
        <p id="pm-rooms-page-status">Create private rooms, choose a current session, or refresh your list.</p>
        <button id="pm-room-setup-settings" class="pm-btn pm-hide" type="button">Open Settings</button><div id="pm-room-management-content"></div>
        <button id="pm-rooms-page-done" class="pm-btn" type="button">Done</button>
      </section>
    </div>
    <div id="pm-settings" class="pm-backdrop pm-hide" role="presentation">
      <section class="pm-panel" role="dialog" aria-modal="true" aria-labelledby="pm-settings-title">
        <div class="pm-row"><h2 id="pm-settings-title">Settings</h2><button id="pm-settings-close" aria-label="Close settings" class="pm-btn pm-mini" type="button">✕</button></div>
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
<fieldset class="pm-date-fields"><legend>In-world date</legend><input id="pm-new-date" type="hidden"><p id="pm-new-date-existing" class="pm-mute pm-hide"></p><div class="pm-date-grid">
<label>Year<input id="pm-new-year" class="pm-text" maxlength="24" placeholder="312"></label>
<label>Stage<select id="pm-new-stage" class="pm-text"><option value="">Choose…</option><option>Early</option><option>Mid</option><option>End</option></select></label>
<label>Season<select id="pm-new-season" class="pm-text"><option value="">Choose…</option><option>Spring</option><option>Summer</option><option>Autumn</option><option>Winter</option></select></label>
<label>Day<input id="pm-new-day" class="pm-text" maxlength="24" placeholder="2nd"></label></div></fieldset>
 <div class="pm-time-grid"><label>Time of day (optional)<select id="pm-new-time" class="pm-text"><option value="">Unspecified</option><option>Morning</option><option>Midday</option><option>Afternoon</option><option>Evening</option><option>Night</option></select></label><label>Custom time<input id="pm-new-time-custom" class="pm-text" maxlength="90" placeholder="Optional — overrides the picker"></label></div>
 <label class="pm-label" for="pm-new-place">Beginning location</label><select id="pm-new-place" class="pm-text"><option value="">Load the Codex locations…</option></select>
 <a id="pm-new-location-source" class="pm-link pm-hide" target="_blank" rel="noopener noreferrer">Open location in Notion ↗</a>
 <div id="pm-new-custom-row" class="pm-hide"><label class="pm-label" for="pm-new-custom">Custom location (this session only)</label><input id="pm-new-custom" class="pm-text" maxlength="100" placeholder="Name a place for this scene"></div>
 <label class="pm-label" for="pm-new-spot">Starting spot (optional)</label><input id="pm-new-spot" class="pm-text" maxlength="90" placeholder="Beneath the old pine tree">
 <label class="pm-label" for="pm-new-intro">Opening situation</label><textarea id="pm-new-intro" class="pm-text" maxlength="2500" rows="3" placeholder="What is happening when the scene begins?"></textarea>
 <label class="pm-label" for="pm-new-goals">Session goals (optional)</label><textarea id="pm-new-goals" class="pm-text" maxlength="1200" rows="2" placeholder="What would you like to explore or attempt? Outcomes remain open."></textarea><p class="pm-mute">Established Notion locations · checked 16 October 2026. Custom places are saved only with this session.</p><div class="pm-h">Invited players (optional)</div><p class="pm-mute">Choose players; they choose established or temporary characters on their invitation page.</p><div id="pm-new-players" class="pm-player-options">Loading registered players…</div><button id="pm-setup-refresh" class="pm-btn pm-mini" type="button">↻ Refresh saved lists</button><p id="pm-new-status" class="pm-mute" role="status"></p>
            <button id="pm-pair-create-room" class="pm-btn pm-primary" type="button">Create Room</button>
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
          <div id="pm-session-tools" class="pm-pair-block pm-hide">
            <div class="pm-h">Current session</div><div id="pm-current-session-info" aria-live="polite"></div><div class="pm-divider"></div>
            <div class="pm-h">☯ Session control</div><p id="pm-session-status" class="pm-mute"></p>
            <label class="pm-label" for="pm-kick-player">Player in this room</label><select id="pm-kick-player" class="pm-text"><option value="">Select a player</option></select><button id="pm-kick-player-button" class="pm-btn" type="button">Kick player from the room</button>
            <div class="pm-row"><button id="pm-end-session" class="pm-btn" type="button">End session</button><button id="pm-reset-session" class="pm-btn" type="button">Reset session</button></div><div class="pm-divider"></div>
            <details id="pm-session-details-editor"><summary>Edit session details</summary>
            <p>Update the details prepared when this room was created. Changes also appear on its invitations.</p><label class="pm-label" for="pm-scene-title">Room name</label><input id="pm-scene-title" class="pm-text" maxlength="80">
<fieldset class="pm-date-fields"><legend>In-world date</legend><input id="pm-scene-date" type="hidden"><p id="pm-scene-date-existing" class="pm-mute pm-hide"></p><div class="pm-date-grid">
<label>Year<input id="pm-scene-year" class="pm-text" maxlength="24" placeholder="312"></label>
<label>Stage<select id="pm-scene-stage" class="pm-text"><option value="">Choose…</option><option>Early</option><option>Mid</option><option>End</option></select></label>
<label>Season<select id="pm-scene-season" class="pm-text"><option value="">Choose…</option><option>Spring</option><option>Summer</option><option>Autumn</option><option>Winter</option></select></label>
<label>Day<input id="pm-scene-day" class="pm-text" maxlength="24" placeholder="2nd"></label></div></fieldset>
 <div class="pm-time-grid"><label>Time of day (optional)<select id="pm-scene-time" class="pm-text"><option value="">Unspecified</option><option>Morning</option><option>Midday</option><option>Afternoon</option><option>Evening</option><option>Night</option></select></label><label>Custom time<input id="pm-scene-time-custom" class="pm-text" maxlength="90" placeholder="Optional — overrides the picker"></label></div>
 <label class="pm-label" for="pm-scene-place">Beginning location</label><select id="pm-scene-place" class="pm-text"><option value="">Load the Codex locations…</option></select>
 <a id="pm-scene-location-source" class="pm-link pm-hide" target="_blank" rel="noopener noreferrer">Open location in Notion ↗</a>
 <div id="pm-scene-custom-row" class="pm-hide"><label class="pm-label" for="pm-scene-custom">Custom location (this session only)</label><input id="pm-scene-custom" class="pm-text" maxlength="100" placeholder="Name a place for this scene"></div>
 <label class="pm-label" for="pm-scene-spot">Starting spot (optional)</label><input id="pm-scene-spot" class="pm-text" maxlength="90" placeholder="Beneath the old pine tree">
 <label class="pm-label" for="pm-scene-intro">Opening situation</label><textarea id="pm-scene-intro" class="pm-text" maxlength="2500" rows="3" placeholder="What is happening when the scene begins?"></textarea>
 <label class="pm-label" for="pm-scene-goals">Session goals (optional)</label><textarea id="pm-scene-goals" class="pm-text" maxlength="1200" rows="2" placeholder="What would you like to explore or attempt? Outcomes remain open."></textarea>
            <button id="pm-save-scene" class="pm-btn" type="button">Save session details</button>
            </details>
            <div class="pm-divider"></div>
            <div class="pm-h">Invite a registered player</div><p class="pm-mute">The player chooses established or temporary characters. Each code is private, single-use and valid for 48 hours.</p><label class="pm-label" for="pm-invite-player">Player</label><select id="pm-invite-player" class="pm-text"><option value="">Choose a player</option></select>
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
<div id="pm-prepared-invites" class="pm-pair-block pm-hide" aria-label="Prepared invitations"></div>
        <button id="pm-close-panel" class="pm-btn">Done</button>
        <button id="pm-forget" type="button" class="pm-btn" title="Only reset Paths Monkey's separate guest identity, not your Cloudveil Google account">Forget Monkey guest identity</button>
        <p>Guest identity persists only while this script's private storage remains. Never share authentication tokens. The website owner account is separate.</p>
      </section>
    </div>
  `;
  document.documentElement.appendChild(root);
  // Move live room controls into their own panel without duplicating IDs or state.
  $('room-management-content').append($('pair-new-room'),$('room-section'),$('prepared-invites'));
  $('forget').before($('legacy-invite')); // Legacy joining belongs in Settings, not a current room’s tools.

  function feedback(message, bad = false) {
    $('feedback').textContent = message;
    $('feedback').style.color = bad ? '#ffbbb2' : '';
    $('admin-feedback').textContent=message;$('admin-feedback').style.color=bad?'#ffbbb2':'';
  }
  function setBusy(value) {
    busy = value;
    for (const name of ['send', 'connect', 'join', 'narrate', 'feed-refresh','kick-player-button','end-session','reset-session','make-invite','registry-add','registry-refresh','pair-create-room','save-scene','setup-refresh']) {
      const el = $(name);
      if (el) el.disabled = value;
    }
  }
  async function runTask(task) {
    if (busy) return;
    setBusy(true);
    try { await task(); }
    catch (err) { if(root.classList.contains('pm-registry-open'))$('registry-status').textContent=err.message||String(err);if(root.classList.contains('pm-roomlogs-open'))$('roomlogs-detail').textContent=err.message||String(err);if(root.classList.contains('pm-creating'))$('new-status').textContent=err.message||String(err);else if(!$('rooms-page').classList.contains('pm-hide'))$('rooms-page-status').textContent=err.message||String(err);feedback(err.message || String(err), true); console.warn('[Paths Monkey]', err); }
    finally { setBusy(false);setConnectedState(); }
  }
  function setConnectedState() {
    const isInRoom = !!(account && selectedRoom&&selectedRoom.session_state!=='ended');
    if(!isInRoom&&!showSidebar)setInfoVisible(true);
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
    field.style.height='48px';
    const maxHeight=144;
    const desired=Math.max(48,Math.min(maxHeight,field.scrollHeight));
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
  function populateLocationPicker(prefix){
    const select=$(prefix+'-place'),previous=select.value;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Choose an established location';select.append(empty);
    const tree={children:new Map()};
    for(const location of roomSetup.locations){const ancestry=location.ancestry?.length?location.ancestry:[location.region,...location.parent.split(' → ')];let node=tree;for(const name of [...ancestry,location.name]){if(!node.children.has(name))node.children.set(name,{name,children:new Map()});node=node.children.get(name);}node.location=location;}
    function appendNodes(node,depth,path){for(const child of [...node.children.values()].sort((a,b)=>a.name.localeCompare(b.name))){const option=document.createElement('option');option.value=child.location?.id||'__branch__'+[...path,child.name].join('/');option.disabled=!child.location;option.textContent='　'.repeat(depth)+(depth?'› ':'')+child.name;option.setAttribute('aria-label',[...path,child.name].join(' → '));select.append(option);appendNodes(child,depth+1,[...path,child.name]);}}
    appendNodes(tree,0,[]);
    if(prefix==='scene'&&currentIntro.location&&!currentIntro.location_slug){const option=document.createElement('option');option.value='__legacy__';option.textContent='Keep existing: '+currentIntro.location;select.append(option);}
    const custom=document.createElement('option');custom.value='__custom__';custom.textContent='Custom location — this session only';select.append(custom);
    select.value=[...select.options].some(x=>x.value===previous)?previous:'';updateLocationChoice(prefix);
  }
  function updateLocationChoice(prefix){const value=$(prefix+'-place').value;$(prefix+'-custom-row').classList.toggle('pm-hide',value!=='__custom__');const place=roomSetup.locations.find(x=>x.id===value),link=$(prefix+'-location-source');link.classList.toggle('pm-hide',!place);if(place)link.href=place.source_url;else link.removeAttribute('href');}
  async function loadRoomSetup(){
    if(!paired||!account)return;const data=await authed('POST','/rest/v1/rpc/hud_room_setup',{body:{}});roomSetup={locations:data.locations||[],players:data.players||[]};
    populateLocationPicker('new');populateLocationPicker('scene');
    const checked=new Set([...$('new-players').querySelectorAll('input:checked')].map(x=>x.value));const host=$('new-players');host.replaceChildren();
    for(const player of roomSetup.players){const label=document.createElement('label');label.className='pm-player-option';const box=document.createElement('input');box.type='checkbox';box.value=player.id;box.checked=checked.has(player.id);const text=document.createElement('span');text.textContent=player.alias+(!player.character_count?' · Temporary characters available':'');label.append(box,text);host.append(label);}if(!roomSetup.players.length)host.textContent='No registered players yet. You can create a solo room or add players in Players Registry.';
    const select=$('invite-player'),previous=select.value;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Choose a player';select.append(empty);for(const player of roomSetup.players){const option=document.createElement('option');option.value=player.id;option.textContent=player.alias+(!player.character_count?' · Temporary characters available':'');select.append(option);}select.value=previous;
  }
  function readSetupDate(prefix){
    const parts=['year','stage','season','day'].map(key=>$(prefix+'-'+key).value.trim());
    if(parts.every(value=>!value))return $(prefix+'-date').value.trim();
    if(parts.some(value=>!value))throw new Error('Complete the in-world year, stage, season and day.');
    return 'Year '+parts[0]+' · '+parts[1]+' '+parts[2]+', '+parts[3];
  }
  function fillSetupDate(prefix,value){
    $(prefix+'-date').value=value;const match=/^Year (.+?) · (Early|Mid|End) (Spring|Summer|Autumn|Winter), (.+)$/.exec(value);
    ['year','stage','season','day'].forEach((key,index)=>{$(prefix+'-'+key).value=match?match[index+1]:'';});
    const note=$(prefix+'-date-existing');note.textContent=value&&!match?'Existing date: '+value+'. Fill all four fields to replace it.':'';note.classList.toggle('pm-hide',!value||!!match);
  }
  function fillSetupTime(prefix,value){
    const picker=$(prefix+'-time'),known=[...picker.options].some(option=>option.value===value);picker.value=known?value:'';$(prefix+'-time-custom').value=known?'':value;
  }
  function setupPayload(prefix){
    const fields={p_date:readSetupDate(prefix),p_time:$(prefix+'-time-custom').value.trim()||$(prefix+'-time').value,p_location:$(prefix+'-place').value,p_custom:$(prefix+'-custom').value.trim(),p_spot:$(prefix+'-spot').value.trim(),p_opening:$(prefix+'-intro').value.trim(),p_goals:$(prefix+'-goals').value.trim()};
    if(!fields.p_date||!fields.p_location||!fields.p_opening)throw new Error('Provide the scene date, beginning location and opening situation.');if(fields.p_location==='__custom__'&&!fields.p_custom)throw new Error('Name the custom location.');return fields;
  }
  async function createOwnerRoom(){
    if(!paired)throw new Error('Pair the HUD first.');
    const body={p_title:$('pair-room-name').value.trim(),p_character:$('pair-character-name').value.trim(),...setupPayload('new'),p_players:[...$('new-players').querySelectorAll('input:checked')].map(x=>x.value)};
    if(!body.p_title||!body.p_character)throw new Error('Enter a room title and your character name.');
    const fingerprint=JSON.stringify(body);if(preparedRequest?.fingerprint!==fingerprint){preparedRequest={id:crypto.randomUUID(),fingerprint};put('prepareRequest',preparedRequest);}
    $('new-status').textContent='Preparing room and invitations…';
    const data=await authed('POST','/rest/v1/rpc/create_prepared_room',{body:{p_request:preparedRequest.id,...body}});
    if(!data||typeof data.id!=='string')throw new Error('Could not confirm room creation.');
    if(data.invitations?.length)put('preparedInvites.'+data.id,data.invitations);
    await loadRooms();const item=rooms.find(x=>x.id===data.id);if(!item)throw new Error('Room prepared. Refresh Room Logs to open it.');
    await chooseRoom(item);openRoomPage('manage');renderPreparedInvites();$('new-status').textContent='Room prepared.';preparedRequest=null;put('prepareRequest',null);
    feedback(data.recovered?'Existing room recovered. Use saved codes below or issue fresh invitations.':'Room and introduction prepared. Copy each private invitation below.');
  }
  async function saveSceneIntroduction(){
    if(!paired||!selectedRoom)throw new Error('Select an owner room first.');
    const roomId=selectedRoom.id,title=$('scene-title').value.trim();if(!title)throw new Error('Enter a room name.');
    const body=setupPayload('scene'),success=await authed('POST','/rest/v1/rpc/save_room_details',{body:{p_room:roomId,p_title:title,...body}});if(success!==true)throw new Error('Saving session details could not be confirmed.');
    rooms=rooms.map(room=>room.id===roomId?{...room,title}:room);if(selectedRoom?.id!==roomId)return;selectedRoom={...selectedRoom,title};put('room',selectedRoom);$('rooms-page-status').textContent='Tools for '+title;renderOngoingSessions();renderRoomLogs();await loadSceneIntro();$('session-details-editor').open=false;feedback('Session details saved for '+title);
  }
  function renderPreparedInvites(){
    const host=$('prepared-invites');host.replaceChildren();const items=selectedRoom?.session_state==='active'?get('preparedInvites.'+selectedRoom.id,[]):[];host.classList.toggle('pm-hide',!items.length);if(!items.length)return;const title=document.createElement('h3');title.textContent='Prepared invitations';host.append(title);
    const note=document.createElement('p');note.className='pm-mute';note.textContent='Send each code privately. Players choose established or temporary characters. Codes stop working after use, expiry, End or Reset.';host.append(note);
    for(const item of items){const card=document.createElement('div');card.className='pm-pair-block';const name=document.createElement('strong');name.textContent=item.alias;const code=registryField('Invitation code for '+item.alias,item.code,48);code.readOnly=true;const buttons=document.createElement('div');buttons.className='pm-row';buttons.append(registryButton('Copy code',()=>copyText(item.code)),registryButton('Copy link',()=>copyText(GAME_URL+'?invite='+encodeURIComponent(item.code))));card.append(name,code,buttons);host.append(card);}
  }
  async function createSessionInvitation(){
    if(!paired||!selectedRoom)throw new Error('Choose an owner room first.');const player=$('invite-player').value;if(!player)throw new Error('Choose a registered player.');
    const saved=await authed('POST','/rest/v1/rpc/get_scene_introduction_as_owner',{body:{p_room_id:selectedRoom.id}});if(!saved?.scene_date||!saved.location||!saved.opening)throw new Error('Save the scene introduction first.');
    const token=await authed('POST','/rest/v1/rpc/invite_registered_player',{body:{p_room:selectedRoom.id,p_player:player}});if(typeof token!=='string'||!/^[0-9a-f]{48}$/.test(token))throw new Error('No valid invitation received.');
    $('invite-code').value=token;$('invite-link').value=GAME_URL+'?invite='+encodeURIComponent(token);$('invite-output').classList.remove('pm-hide');feedback('Private invitation ready. The player chooses their characters.');
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
    if(action==='reset'){messages=[];currentIntro={};renderSessionInformation();$('session-details-editor').open=true;fillSetupDate('scene','');fillSetupTime('scene','');for(const key of ['place','custom','spot','intro','goals'])$('scene-'+key).value='';}if(action==='reset'||action==='end'){put('preparedInvites.'+selectedRoom.id,[]);renderPreparedInvites();}
    $('invite-output').classList.add('pm-hide');$('invite-link').value='';$('invite-code').value='';
    await loadRooms();await refreshScene();feedback(action==='reset'?'Session reset. Open Edit session details to prepare it again, then issue fresh invitations.':action==='end'?'Session ended. Players return to the starting page.':'Player removed.');
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
  function renderSessionInformation(){
    const host=$('current-session-info');host.replaceChildren();if(!selectedRoom){host.textContent='No chatroom selected.';return;}
    const heading=document.createElement('h3');heading.className='pm-name';heading.textContent=selectedRoom.title;host.append(heading);
    const list=document.createElement('dl');list.className='pm-session-facts';
    const participants=members.map(m=>(m.player_alias||(m.role==='owner'?'Jade Emperor':'Player'))+' · '+(m.allowed_characters?.length?m.allowed_characters:[m.character_name]).filter(Boolean).join(', ')).join('\n');
    for(const [label,value] of [['Status',selectedRoom.session_state==='ended'?'Concluded':'Ongoing'],['In-world date',currentIntro.scene_date],['Time of day',currentIntro.time_of_day],['Location',currentIntro.location],['Opening situation',currentIntro.opening],['Session goals',currentIntro.session_goals],['Participants',participants]]){
      const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label;detail.textContent=value||'Not recorded';list.append(term,detail);
    }host.append(list);
  }
  async function loadSceneIntro(){
    if(!paired||!selectedRoom)return;const roomId=selectedRoom.id,generation=selectedRoom.session_generation;
    const data=await authed('POST','/rest/v1/rpc/get_scene_introduction_as_owner',{body:{p_room_id:roomId}});
    if(selectedRoom?.id!==roomId||selectedRoom.session_generation!==generation)return;
    currentIntro=data&&typeof data==='object'?data:{};populateLocationPicker('scene');
    $('scene-title').value=selectedRoom.title;fillSetupDate('scene',currentIntro.scene_date||'');fillSetupTime('scene',currentIntro.time_of_day||'');$('scene-place').value=currentIntro.location_slug||(currentIntro.location?'__legacy__':'');$('scene-custom').value=currentIntro.custom_location||'';$('scene-spot').value=currentIntro.starting_spot||'';$('scene-intro').value=currentIntro.opening||'';$('scene-goals').value=currentIntro.session_goals||'';updateLocationChoice('scene');
    if($('character-session').value===roomId)$('calendar').textContent=[currentIntro.scene_date,currentIntro.time_of_day].filter(Boolean).join(' · ')||'No confirmed scene date saved for this session.';
    renderSessionInformation();
  }

  async function loadRooms() {
    if (!account) return;
    await refreshPairing();
    const data = await authed('GET','/rest/v1/rooms?select=id,title,created_at,ended_at,session_state,session_generation&order=created_at.desc');
    rooms = Array.isArray(data) ? data : [];roomsLoaded=true;
    if (selectedRoom) {
      const found=rooms.find(x=>x.id===selectedRoom.id);
      if (found){if(selectedRoom.session_generation&&selectedRoom.session_generation!==found.session_generation)put('preparedInvites.'+found.id,[]);selectedRoom=found;}
      else { saveDraft(); selectedRoom=null; members=[]; messages=[]; put('room',null); }
    }
    renderOngoingSessions();renderRoomLogs();renderPreparedInvites();setConnectedState();
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
    const previousPage=captureHudPage();
    if(info.session_state==='ended'){feedback('This scene has ended.');setInfoVisible(true);return;}
    saveDraft();
    selectedRoom={...info};currentIntro={};
    put('room',selectedRoom);
    members=[]; messages=[];
    restoreDraft();
    setConnectedState();
    $('session-tools').classList.toggle('pm-hide',!paired);
    $('invite-output').classList.add('pm-hide');$('invite-link').value='';
    await refreshScene();
    if(paired){if(!roomSetup.locations.length)await loadRoomSetup();await loadSceneIntro();}renderPreparedInvites();
    feedback('');
    rememberHudPage(previousPage);setInfoVisible(false);
    if(!$('rooms-page').classList.contains('pm-hide'))closeRoomPage();
  }
  async function refreshScene() {
    if (!selectedRoom || !account) return;
    const id=selectedRoom.id;
    const [p,m,r]=await Promise.all([
      authed('GET','/rest/v1/room_members?select=user_id,character_name,player_alias,role,allowed_characters&room_id=eq.'+encodeURIComponent(id)),
      authed('GET','/rest/v1/messages?select=id,sender_id,kind,body,created_at,character_name&room_id=eq.'+encodeURIComponent(id)+'&order=created_at.desc&limit=24'),
      authed('GET','/rest/v1/rooms?select=id,session_state,session_generation&id=eq.'+encodeURIComponent(id))
    ]);
    if (!selectedRoom || selectedRoom.id!==id) return;
    if(!r?.[0]){saveDraft();selectedRoom=null;members=[];messages=[];put('room',null);setInfoVisible(true);setConnectedState();renderFeed();return;}
    if(selectedRoom.session_generation&&selectedRoom.session_generation!==r[0].session_generation)put('preparedInvites.'+id,[]);
    selectedRoom={...selectedRoom,...r[0]};put('room',selectedRoom);rooms=rooms.map(x=>x.id===id?{...x,...r[0]}:x);renderOngoingSessions();renderRoomLogs();
    members=Array.isArray(p)?p:[];
    if($('character-session').value===id)renderCharacterParticipants(members);
    renderKickPlayers();renderSessionInformation();
    messages=Array.isArray(m)?m.reverse():[];
    setConnectedState();
    renderFeed();
  }
  function renderOngoingSessions(){updateCharacterSessionPicker(rooms.filter(x=>x.session_state==='active'));}
  let participantRequest=0;
  function updateCharacterSessionPicker(active){
    const select=$('character-session'),previous=select.value;
    const target=active.some(x=>x.id===previous)?previous:active.some(x=>x.id===selectedRoom?.id)?selectedRoom.id:active[0]?.id||'';
    select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=active.length?'Choose a session':!account?'Connect HUD in Settings':!roomsLoaded?'Loading active sessions…':'No active sessions available';select.append(empty);
    for(const item of active){const option=document.createElement('option');option.value=item.id;option.textContent=item.title;select.append(option);}select.value=target;
    for(const option of select.options)option.selected=option.value===target;
    renderPickedRoomButton();
    if(target)loadCharacterParticipants(target).catch(e=>{$('people').textContent=e.message;});
    if(!target){participantRequest++;const message=!account?'Connect your HUD in Settings.':!roomsLoaded?'Loading active sessions…':'No active sessions available to this HUD.';$('people').textContent=message;$('calendar').textContent=message;}
  }
  function renderPickedRoomButton(){
    const room=rooms.find(x=>x.id===$('character-session').value&&x.session_state==='active');
    const button=$('open-picked-room');button.classList.toggle('pm-hide',!room);button.disabled=!room;
    button.textContent=room?.title||'';button.setAttribute('aria-label',room?'Open room: '+room.title:'Open selected room');
  }
  async function openPickedRoom(){
    const room=rooms.find(x=>x.id===$('character-session').value&&x.session_state==='active');
    if(room)await chooseRoom(room);
  }
  function renderCharacterParticipants(items){
    const host=$('people');host.replaceChildren();
    if(!items.length){host.textContent='No participants loaded for this session.';return;}
    for(const member of items){const line=document.createElement('div');const chars=member.allowed_characters?.length?member.allowed_characters:[member.character_name];line.textContent=(member.player_alias||(member.role==='owner'?'Jade Emperor':'Player'))+' · '+chars.filter(Boolean).join(', ');host.append(line);}
  }
  async function loadCharacterParticipants(sessionId=$('character-session').value){
    const id=sessionId,request=++participantRequest;if(!id||!account){$('people').textContent='No active session selected.';$('calendar').textContent='No active session selected.';return;}
    $('people').textContent='Loading participants…';$('calendar').textContent='Loading scene date…';
    const [participants,scene]=await Promise.allSettled([
      authed('GET','/rest/v1/room_members?select=user_id,character_name,player_alias,role,allowed_characters&room_id=eq.'+encodeURIComponent(id)),
      paired?authed('POST','/rest/v1/rpc/get_scene_introduction_as_owner',{body:{p_room_id:id}}):Promise.resolve(null)
    ]);
    if(request!==participantRequest||$('character-session').value!==id)return;
    if(participants.status==='fulfilled')renderCharacterParticipants(Array.isArray(participants.value)?participants.value:[]);else $('people').textContent=participants.reason.message;
    $('calendar').textContent=scene.status==='fulfilled'?([scene.value?.scene_date,scene.value?.time_of_day].filter(Boolean).join(' · ')||'No confirmed scene date saved for this session.'):'Could not load this session’s date.';
  }

  function renderRoomLogs(){
    const host=$('roomlogs-list');host.replaceChildren();
    if(!rooms.length){host.textContent=account?'No rooms recorded yet.':'Connect your HUD in Settings to load room logs.';return;}
    for(const [state,title] of [['active','Ongoing'],['ended','Concluded']]){
      const group=rooms.filter(x=>x.session_state===state);if(!group.length)continue;const heading=document.createElement('h3');heading.className='pm-h';heading.textContent=title;host.append(heading);
      for(const item of group){const button=document.createElement('button');button.className='pm-btn pm-sidebar-action';button.type='button';button.textContent=item.title+' · '+title;button.onclick=()=>runTask(()=>openLoggedRoom(item.id));host.append(button);}
    }
  }
  function closeRoomLogs(){root.classList.remove('pm-roomlogs-open');$('roomlogs').setAttribute('aria-hidden','true');syncActiveNavigation();}
  async function openRoomLogs(){rememberHudPage();setInfoVisible(true);root.classList.add('pm-roomlogs-open');$('roomlogs').setAttribute('aria-hidden','false');syncActiveNavigation();$('roomlogs-back').focus();$('roomlogs-detail').replaceChildren();if(account)await loadRooms();else renderRoomLogs();}
  async function openLoggedRoom(id){
    await loadRooms();const item=rooms.find(x=>x.id===id);if(!item){$('roomlogs-detail').textContent='This room is no longer available.';return;}
    if(item.session_state==='active'){await chooseRoom(item);return;}
    const host=$('roomlogs-detail');host.replaceChildren();const heading=document.createElement('h3');heading.textContent='Scene ended';const name=document.createElement('p');name.textContent=item.title;host.append(heading,name);
    if(item.ended_at){const date=document.createElement('p');date.className='pm-mute';date.textContent='Concluded: '+new Date(item.ended_at).toLocaleString();host.append(date);}host.scrollIntoView?.({block:'nearest'});
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
      ' (Sections A Universal and C Shared; Section D only when ending a scene). Fetch relevant world canon and chronology where available. If retrieval fails, disclose it and ask for the rules; do not claim compliance. Read the saved scene introduction, date/time, location and session goals; goals are directions to explore, not guaranteed outcomes. Then fetch pending CHARACTER actions (kind=player) since the last narration and IGNORE OOC chat (kind=ooc). Resolve one fair combined narration, and publish only via an actually authorized, verified Supabase write. If publishing fails, say so. Test only; no Notion edits.';
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
    if(mode!=='create'&&!selectedRoom){feedback('Open a chatroom before opening Session Tools.');return;}
    rememberHudPage();setInfoVisible(true);root.classList.toggle('pm-creating',mode==='create');
    $('rooms-page-title').textContent=mode==='create'?'Create a New Room':'Session Tools';
    previousFocus=window.matchMedia('(max-width:790px)').matches?$('logo-toggle'):document.activeElement;
    $('settings').classList.add('pm-hide');$('rooms-page').classList.remove('pm-hide');
    $('rooms-page-status').textContent=!paired?'Connect and pair your HUD in Settings before creating or managing rooms.':mode==='create'?'Prepare the starting details and choose invited players.':'Tools for '+selectedRoom.title;
    $('room-setup-settings').classList.toggle('pm-hide',paired);
    $('session-tools').classList.toggle('pm-hide',!paired||!selectedRoom);
    $('session-details-editor').open=false;
    renderSessionInformation();setConnectedState();syncActiveNavigation();$('rooms-page-close').focus();
    renderPreparedInvites();if(account)runTask(async()=>{
      if(mode==='create'){await loadRooms();if(paired)await loadRoomSetup();}
      else{const roomId=selectedRoom.id;await refreshScene();if(selectedRoom?.id!==roomId)return;if(paired){await loadSceneIntro();await loadRoomSetup();}renderSessionInformation();}
    });
  }
  function closeRoomPage(){
    const creation=root.classList.contains('pm-creating');$('rooms-page').classList.add('pm-hide');
    setInfoVisible(creation||!selectedRoom||selectedRoom.session_state==='ended');syncActiveNavigation();
    if(!creation&&selectedRoom?.session_state==='active')$('feed-toggle').focus();else if(previousFocus?.focus)previousFocus.focus();
  }
  function resizeHudBody(){
    const header=root.querySelector('.pm-hbar').getBoundingClientRect().height;
    const composer=$('compose').getBoundingClientRect().height;
    if(header>0)root.style.setProperty('--pm-header-height',Math.ceil(header)+'px');
    if(composer>0)root.style.setProperty('--pm-compose-height',Math.ceil(composer)+'px');
  }
  function isDesktopLayout(){return typeof window!=='undefined'&&window.matchMedia('(min-width:791px)').matches;}
  function syncDesktopLayout(){
    const desktop=isDesktopLayout();if(desktop)root.classList.remove('pm-info-overlay');
    for(const id of ['settings','rooms-page']){const panel=$(id).querySelector('.pm-panel');panel.setAttribute('role',desktop?'region':'dialog');if(desktop)panel.removeAttribute('aria-modal');else panel.setAttribute('aria-modal','true');}
    const open=desktop?!root.classList.contains('pm-info-dismissed'):root.classList.contains('pm-info-overlay')||(captureHudPage().view==='admin'&&!root.classList.contains('pm-info-dismissed'));
    $('sidebar').setAttribute('aria-hidden',String(!open));$('logo-toggle').setAttribute('aria-expanded',String(open));
  }
  function setInfoVisible(visible){
    root.classList.remove('pm-info-overlay','pm-info-dismissed');
    $('settings').classList.add('pm-hide');$('rooms-page').classList.add('pm-hide');
    visible=visible||!account||!selectedRoom||selectedRoom.session_state!=='active';
    closeRegistry();closeRoomLogs();
    showSidebar=visible;
    root.classList.toggle('pm-admin',visible);
    $('sidebar').classList.toggle('pm-open',visible);
    $('sidebar').setAttribute('aria-hidden',String(!visible&&!isDesktopLayout()));
    $('logo-toggle').setAttribute('aria-expanded',String(visible||isDesktopLayout()));
    $('logo-toggle').setAttribute('aria-label',visible?'Close information panel':'Open information panel');
    showFeed=!visible;$('feed').classList.toggle('pm-hide',visible);
    resizeHudBody();syncActiveNavigation();
  }
  function toggleInformation(){
    if(isDesktopLayout()){root.classList.remove('pm-info-overlay');root.classList.toggle('pm-info-dismissed');syncDesktopLayout();resizeHudBody();return;}
    const baseAdmin=captureHudPage().view==='admin';
    const open=root.classList.contains('pm-info-overlay')||(baseAdmin&&!root.classList.contains('pm-info-dismissed'));
    root.classList.toggle('pm-info-overlay',!open&&!baseAdmin);
    root.classList.toggle('pm-info-dismissed',open&&baseAdmin);
    $('sidebar').setAttribute('aria-hidden',String(open));
    $('logo-toggle').setAttribute('aria-expanded',String(!open));
    $('logo-toggle').setAttribute('aria-label',open?'Open information panel':'Close information panel');
    if(!open)resizeHudBody();
  }
  function syncActiveNavigation(){
    const page=captureHudPage();const active=page.view==='settings'?'settings-toggle':page.view==='registry'?'open-registry':page.view==='roomlogs'?'open-roomlogs':page.view==='roomtools'?(page.mode==='create'?'manage-rooms':'feed-toggle'):null;
    for(const id of ['manage-rooms','open-roomlogs','open-registry','settings-toggle','feed-toggle']){const button=$(id),selected=id===active;button.classList.toggle('pm-nav-active',selected);if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  }
  function captureHudPage(){
    const view=!$('settings').classList.contains('pm-hide')?'settings':!$('rooms-page').classList.contains('pm-hide')?'roomtools':root.classList.contains('pm-registry-open')?'registry':root.classList.contains('pm-roomlogs-open')?'roomlogs':showSidebar?'admin':'chat';
    return {view,roomId:selectedRoom?.id,mode:root.classList.contains('pm-creating')?'create':'manage',scroll:$(({admin:'sidebar',chat:'feed',registry:'registry',roomlogs:'roomlogs'})[view]||'sidebar').scrollTop};
  }
  function rememberHudPage(page=captureHudPage()){
    root.classList.remove('pm-info-overlay','pm-info-dismissed');
    if(restoringHudPage)return;const last=hudHistory[hudHistory.length-1];if(!last||last.view!==page.view||last.roomId!==page.roomId||last.mode!==page.mode)hudHistory.push(page);if(hudHistory.length>40)hudHistory.shift();
  }
  async function toggleSidebar(){
    const current=captureHudPage();let target;
    while(hudHistory.length){const next=hudHistory.pop();if(next.view!==current.view||next.roomId!==current.roomId||next.mode!==current.mode){target=next;break;}}
    target=target||{view:'admin'};restoringHudPage=true;
    try{
      $('settings').classList.add('pm-hide');$('rooms-page').classList.add('pm-hide');setInfoVisible(true);
      if(['chat','roomtools'].includes(target.view)&&target.roomId){
        const room=rooms.find(x=>x.id===target.roomId&&x.session_state==='active');if(!room){if(account)await loadRooms();return;}
        if(selectedRoom?.id!==room.id)await chooseRoom(room);
        if(target.view==='chat')setInfoVisible(false);else {setInfoVisible(false);openRoomPage(target.mode);}
      }else if(target.view==='registry')await openRegistry();else if(target.view==='roomlogs')await openRoomLogs();else if(target.view==='settings')openSettings();else if(account)await loadRooms();
      const host=$(({admin:'sidebar',chat:'feed',registry:'registry',roomlogs:'roomlogs'})[target.view]||'sidebar');host.scrollTop=target.scroll||0;
    }finally{restoringHudPage=false;}
  }
  function closeRegistry(){root.classList.remove('pm-registry-open');$('registry').setAttribute('aria-hidden','true');syncActiveNavigation();}
  async function openRegistry(){
    rememberHudPage();setInfoVisible(true);root.classList.add('pm-registry-open');$('registry').setAttribute('aria-hidden','false');syncActiveNavigation();$('registry-back').focus();await refreshRegistry();
  }
  async function refreshRegistry(){
    if(!account||!paired){$('registry-list').replaceChildren();$('registry-status').textContent='Pair your HUD in Settings to manage players.';return;}
    $('registry-status').textContent='Loading players…';
    const data=await authed('POST','/rest/v1/rpc/hud_player_registry',{body:{p_id:null,p_alias:null}});
    if(!account||!paired)return;renderRegistry(data||[]);$('registry-status').textContent=(data||[]).length+' players registered.';
  }
  function registryFieldGroup(field){const group=document.createElement('label');group.className='pm-field';const text=document.createElement('span');text.textContent=field.getAttribute('aria-label');group.append(text,field);return group;}
  function registryButton(text,handler,primary=false){const button=document.createElement('button');button.className='pm-btn pm-mini'+(primary?' pm-primary':'');button.type='button';button.textContent=text;button.onclick=handler;return button;}
  function registryField(label,value,max,multiline=false){const field=document.createElement(multiline?'textarea':'input');field.className='pm-text';field.value=value||'';field.maxLength=max;field.setAttribute('aria-label',label);field.placeholder=label;return field;}
  function renderRegistry(items){
    const list=$('registry-list');list.replaceChildren();if(!items.length){list.textContent='No players registered yet.';return;}
    for(const player of items){
      const card=document.createElement('article');card.className='pm-player-card';
      const heading=document.createElement('div');heading.className='pm-player-heading';const name=document.createElement('strong');name.textContent=player.alias;
      const status=document.createElement('span');status.className='pm-mute';status.textContent=' · '+(player.in_session?'In a session':'Not in a session');heading.append(name,status);
      const sessions=document.createElement('div');sessions.className='pm-mute';for(const scene of player.sessions||[]){const line=document.createElement('div');line.textContent=scene.title+' · '+(scene.characters||[]).join(', ');sessions.append(line);}
      const renameForm=document.createElement('div');renameForm.className='pm-input-row pm-hide';const field=registryField('Player name for '+player.alias,player.alias,45);
      const save=registryButton('Save',()=>runTask(()=>saveRegistryPlayer(player.id,field.value)));renameForm.append(field,save);
      const actions=document.createElement('div');actions.className='pm-row';
      const characterPanel=document.createElement('div');characterPanel.className='pm-hide';
      function showPlayerPanel(panel){
        for(const [button,body,key] of [[rename,renameForm,'rename'],[characters,characterPanel,'characters']]){const active=panel===key;body.classList.toggle('pm-hide',!active);button.classList.toggle('pm-registry-active',active);button.setAttribute('aria-expanded',String(active));button.setAttribute('aria-pressed',String(active));}
      }
      const rename=registryButton('Rename',()=>{if(busy)return;const open=renameForm.classList.contains('pm-hide');showPlayerPanel(open?'rename':null);if(open)field.focus();});rename.setAttribute('aria-expanded','false');rename.setAttribute('aria-pressed','false');
      const characters=registryButton('Characters',()=>{if(busy)return;const open=characterPanel.classList.contains('pm-hide');showPlayerPanel(open?'characters':null);if(open)runTask(()=>loadRegistryCharacters(player,characterPanel));});characters.setAttribute('aria-expanded','false');characters.setAttribute('aria-pressed','false');
      actions.append(rename,characters);card.append(heading,sessions,actions,renameForm,characterPanel);list.append(card);
    }
  }
  async function loadRegistryCharacters(player,host){
    host.textContent='Loading characters…';const data=await authed('POST','/rest/v1/rpc/hud_player_characters',{body:{p_player:player.id}});renderRegistryCharacters(player,host,data||[]);
  }
  function renderRegistryCharacters(player,host,items){
    host.replaceChildren();const note=document.createElement('p');note.className='pm-mute pm-character-note';note.textContent='Manage this player’s saved characters.';host.append(note);
    const newForm=document.createElement('div');newForm.className='pm-character-card pm-hide';const newName=registryField('Character name','',40),newDescription=registryField('Description','',350,true);
    const addToggle=registryButton('Add Character',()=>{const open=newForm.classList.contains('pm-hide');newForm.classList.toggle('pm-hide',!open);addToggle.setAttribute('aria-expanded',String(open));if(open)newName.focus();});addToggle.setAttribute('aria-expanded','false');
    const newSource=attachNotionImporter(player,newForm,newName,newDescription,'');
    const add=registryButton('Register Character',()=>runTask(()=>changeRegistryCharacter(player,host,'save',null,newName.value,newDescription.value,'',newSource())),true);
    newForm.append(registryFieldGroup(newName),registryFieldGroup(newDescription),add);host.append(addToggle,newForm);
    if(!items.length){const empty=document.createElement('p');empty.className='pm-mute';empty.textContent='No saved characters yet.';host.append(empty);}
    for(const character of items){
      const card=document.createElement('details');card.className='pm-character-card pm-saved-character';
      const heading=document.createElement('summary');heading.textContent=character.name;
      const body=document.createElement('div');body.className='pm-character-body';
      const descriptionText=document.createElement('p');descriptionText.className='pm-character-description';descriptionText.textContent=character.description||'No description saved yet.';
      const editor=document.createElement('div');editor.className='pm-character-editor pm-hide';
      const name=registryField('Character name',character.name,40),description=registryField('Description',character.description,350,true);
      const source=attachNotionImporter(player,editor,name,description,character.source_url||'');
      const notion=document.createElement('a');notion.className='pm-btn';notion.textContent='Notion';notion.target='_blank';notion.rel='noopener noreferrer';
      if(/^https:\/\/www\.notion\.so\/[a-f0-9]{32}$/.test(character.source_url||''))notion.href=character.source_url;
      else{notion.setAttribute('aria-disabled','true');notion.title='Add a Notion link through Edit → Check Page.';}
      const edit=registryButton('Edit',()=>{const open=editor.classList.contains('pm-hide');editor.classList.toggle('pm-hide',!open);edit.setAttribute('aria-expanded',String(open));edit.classList.toggle('pm-registry-active',open);if(open)name.focus();});edit.setAttribute('aria-expanded','false');
      const actions=document.createElement('div');actions.className='pm-row pm-character-actions';actions.append(notion,edit);
      const save=registryButton('Save',()=>runTask(()=>changeRegistryCharacter(player,host,'save',character.id,name.value,description.value,character.goal||'',source())),true);
      const cancel=registryButton('Cancel',()=>{name.value=character.name;description.value=character.description||'';source.reset();editor.classList.add('pm-hide');edit.setAttribute('aria-expanded','false');edit.classList.remove('pm-registry-active');});
      const remove=registryButton('Remove',()=>runTask(()=>changeRegistryCharacter(player,host,'remove',character.id)));
      const editorActions=document.createElement('div');editorActions.className='pm-row';editorActions.append(save,cancel,remove);editor.append(registryFieldGroup(name),registryFieldGroup(description),editorActions);
      body.append(descriptionText,actions,editor);card.append(heading,body);host.append(card);
    }
  }
  function attachNotionImporter(player,form,name,description,initialSource){
    let sourceUrl=initialSource;const link=registryField('Notion character page link',initialSource,2000);link.placeholder='Paste the character’s Notion page link';link.type='url';
    const status=document.createElement('p');status.className='pm-mute';status.setAttribute('role','status');
    const source=document.createElement('a');source.className='pm-link';source.target='_blank';source.rel='noopener noreferrer';source.textContent='Open character in Notion ↗';
    function showSource(){source.classList.toggle('pm-hide',!sourceUrl);if(sourceUrl)source.href=sourceUrl;else source.removeAttribute('href');}showSource();
    const check=registryButton('Check Page',()=>runTask(async()=>{
      const input=link.value.trim(),snapshot=[name.value,description.value];
      if(!input)throw new Error('Paste a Notion character page link first.');
      status.textContent='Checking Notion page…';
      try{
        const data=await authed('POST','/functions/v1/notion-character-preview',{body:{player_id:player.id,url:input},timeout:90000});
        if(!form.isConnected||link.value.trim()!==input||snapshot.some((v,i)=>v!==[name.value,description.value][i])){status.textContent='The form changed while checking. Check again to fill it.';return;}
        name.value=data.name;description.value=data.description;sourceUrl=data.source_url;link.value=sourceUrl;showSource();
        status.textContent='Draft ready. Review and edit it before saving. '+(data.warnings||[]).join(' ');
      }catch(e){status.textContent=e.message;throw e;}
    }));
    link.oninput=()=>{sourceUrl='';showSource();status.textContent='Check the new link before saving its source.';};
    const inputRow=document.createElement('div');inputRow.className='pm-input-row pm-labeled-input-row';inputRow.append(registryFieldGroup(link),check);form.append(inputRow,status,source);
    const readSource=()=>sourceUrl;readSource.reset=()=>{sourceUrl=initialSource;link.value=initialSource;status.textContent='';showSource();};return readSource;
  }
  async function changeRegistryCharacter(player,host,action,id,name=null,description='',goal='',sourceUrl=''){
    if(!paired||!account)throw new Error('Pair your HUD before managing characters.');
    const body={p_player:player.id,p_character:id,p_name:name?.trim()||null,p_description:description,p_objective:goal};
    if(action==='save')body.p_source_url=sourceUrl;else body.p_action=action;
    const data=await authed('POST','/rest/v1/rpc/'+(action==='save'?'hud_save_character_source':'hud_player_characters'),{body});
    renderRegistryCharacters(player,host,data||[]);$('registry-status').textContent=action==='remove'?'Character removed from saved choices. Past scenes kept.':'Character saved.';
  }
  async function saveRegistryPlayer(id,alias){
    if(!account||!paired)throw new Error('Pair your HUD before managing players.');alias=alias.trim();if(!alias||alias.length>45)throw new Error('Enter a player name (1–45 characters).');
    const data=await authed('POST','/rest/v1/rpc/hud_player_registry',{body:{p_id:id,p_alias:alias}});
    renderRegistry(data||[]);$('registry-status').textContent=id?'Player name saved.':'Player registered.';if(!id){$('registry-name').value='';$('registry-create').classList.add('pm-hide');$('registry-toggle').setAttribute('aria-expanded','false');}
  }
  function openSettings() {
    rememberHudPage();previousFocus=document.activeElement;setInfoVisible(true);
    $('settings').classList.remove('pm-hide');setConnectedState();syncActiveNavigation();$('settings-close').focus();
    if(account)runTask(loadRooms);
  }
  function closeSettings() {
    $('settings').classList.add('pm-hide');syncActiveNavigation();
    if(previousFocus?.focus)previousFocus.focus();
  }
  function resetIdentity() {
    if(!confirm('Forget ONLY the temporary Paths Monkey identity and its room links? Your Google login on the Paths website and all existing messages will remain.'))return;
    saveDraft();
    account=null;paired=false;rooms=[];roomsLoaded=false;members=[];messages=[];selectedRoom=null;
    $('registry-list').replaceChildren();$('registry-status').textContent='';hudHistory=[];closeRegistry();$('roomlogs-list').replaceChildren();$('roomlogs-detail').replaceChildren();closeRoomLogs();
    remove('account');remove('room');renderOngoingSessions();renderFeed();
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
    closePickerMenu(); // Minimize only hides the shell; retain page DOM, forms and scroll positions.
    // The real Mizuhana script owns all its own saves and interface state.
    // We only yield display control or hide its launcher while Paths is selected.
    if(mode==='paths'&&hudExpanded){
      const activeMizuhana=document.querySelector('#mizuhana-hud #mizu-brand-collapse');
      if(activeMizuhana)activeMizuhana.click();
      syncDesktopLayout();resizeHudBody();resizeNativeInset();
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
    // Mizuhana v0.8.09+ has its own native HUD picker. Add a route back
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
  $('room-setup-settings').onclick=openSettings;
  $('logo-toggle').onclick=toggleInformation;
  $('manage-rooms').onclick=()=>openRoomPage('create');
  $('open-roomlogs').onclick=()=>runTask(openRoomLogs);
  $('roomlogs-back').textContent='← Back';$('roomlogs-back').onclick=()=>runTask(toggleSidebar);
  $('roomlogs-refresh').onclick=()=>runTask(async()=>{$('roomlogs-detail').replaceChildren();await loadRooms();});
  $('character-session').onchange=()=>{renderPickedRoomButton();loadCharacterParticipants().catch(e=>{$('people').textContent=e.message;});};
  $('open-picked-room').onclick=()=>runTask(openPickedRoom);
  $('open-registry').onclick=()=>runTask(openRegistry);
  $('registry-back').textContent='← Back';$('registry-back').onclick=()=>runTask(toggleSidebar);
  $('registry-refresh').onclick=()=>runTask(refreshRegistry);
  $('registry-add').onclick=()=>runTask(()=>saveRegistryPlayer(null,$('registry-name').value));
  $('registry-toggle').onclick=()=>{const open=$('registry-create').classList.contains('pm-hide');$('registry-create').classList.toggle('pm-hide',!open);$('registry-toggle').setAttribute('aria-expanded',String(open));if(open)$('registry-name').focus();};
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
  $('setup-refresh').onclick=()=>runTask(loadRoomSetup);
  $('new-place').onchange=()=>updateLocationChoice('new');$('scene-place').onchange=()=>updateLocationChoice('scene');
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
  $('join').onclick=()=>runTask(join);
  $('forget').onclick=resetIdentity;
  $('send').onclick=()=>runTask(postAction);
  $('narrate').onclick=prepareNarrate;
  $('feed-toggle').onclick=()=>openRoomPage('manage');
  $('feed-close').textContent='← Back';$('feed-close').onclick=()=>runTask(toggleSidebar);
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
    else if(root.classList.contains('pm-roomlogs-open'))closeRoomLogs();
    else if(root.classList.contains('pm-registry-open'))closeRegistry();
    else if(!showSidebar)toggleSidebar();
    else if(!$('picker-menu').classList.contains('pm-hide'))closePickerMenu();
  });
  window.addEventListener('resize',()=>{resizeNativeInset();autoGrowAction();resizeHudBody();syncDesktopLayout();});
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
  setHudMode(hudMode,hudExpanded);syncDesktopLayout();
  // If Mizuhana is the selected script, allow a dropdown option to return here.
  const hudSwitcherObserver=new MutationObserver(extendMizuhanaPicker);
  hudSwitcherObserver.observe(document.body,{childList:true,subtree:true});
  setTimeout(resizeNativeInset,350);
  setTimeout(resizeNativeInset,1250);
  const layoutChecker=setInterval(()=>{if(hudMode==='paths'&&hudExpanded)resizeNativeInset();},1800);
  const checker=setInterval(()=>{
    if(account&&showSidebar&&document.visibilityState==='visible'&&!busy){runTask(loadRooms);return;}
    if(account && selectedRoom && document.visibilityState==='visible' && !busy) {
      refreshScene().catch((e)=>feedback(e.message,true));
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
