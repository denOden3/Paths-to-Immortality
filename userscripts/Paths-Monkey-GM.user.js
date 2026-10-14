// ==UserScript==
// @name         Paths Monkey — GM HUD
// @namespace    paths-to-immortality.monkey
// @version      0.1.1
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

  const VERSION = '0.1.1';
  const SUPABASE = 'https://fhjsoldgtqfizkwpehud.supabase.co';
  // This is a publishable browser key, NOT a secret/service-role credential.
  const PUBLIC_KEY = 'sb_publishable_hWZGWQyF7xNe90x8kSFESw_2k4AHU5t';
  const GAME_URL = 'https://denoden3.github.io/Paths-to-Immortality/';
  const GM_RULES_URL = 'https://app.notion.com/p/3f9b0ac52efe817ba56ed1d5112268b7';
  const CODEX_URL = 'https://app.notion.com/p/3f7b0ac52efe81258310c96057391e18';
  const SAVE_PREFIX = 'paths.monkey.gm.v1.';
  const get = (k, fallback = null) => GM_getValue(SAVE_PREFIX + k, fallback);
  const put = (k, v) => GM_setValue(SAVE_PREFIX + k, v);
  const remove = (k) => GM_deleteValue(SAVE_PREFIX + k);
  const $ = (id) => document.getElementById('pm-' + id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let account = get('account', null);
  let selectedRoom = get('room', null);
  let rooms = [];
  let members = [];
  let messages = [];
  let busy = false;
  let refreshPromise = null;
  let refreshTimer = null;
  let pendingRequestId = null;
  let pendingRequestBody = null;
  let lastNativeInset = 95;
  let previousFocus = null;
  let showFeed = false;
  let showSidebar = false;

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
    #paths-monkey-root .pm-sub{display:block;font-size:10px;font-weight:500;color:var(--pm-gold);margin-top:3px}
    #paths-monkey-root .pm-compact-version{font-size:10px;color:var(--pm-gold)}
    #paths-monkey-root .pm-btn{min-height:32px;border:1px solid var(--pm-stroke);border-radius:9px;
      padding:6px 10px;background:#3e303a;color:var(--pm-ink);font-weight:700}
    #paths-monkey-root .pm-btn.pm-primary{background:var(--pm-red);border-color:#eb7777;color:#fff}
    #paths-monkey-root .pm-btn.pm-mini{padding:5px 8px;font-size:12px}
    #paths-monkey-root .pm-text{border:1px solid #a28a91;border-radius:10px;background:#17131b;
      color:var(--pm-ink);padding:10px 11px;width:100%;outline:none}
    #paths-monkey-root .pm-text::placeholder{color:#baa9ae}
    #paths-monkey-root .pm-left{position:absolute;left:0;top:53px;bottom:var(--pm-native,95px);
      width:220px;border-right:1px solid var(--pm-stroke);background:var(--pm-panel);
      overflow:auto;pointer-events:auto;padding:14px 11px 20px}
    #paths-monkey-root .pm-h{font-weight:850;color:var(--pm-gold);font-size:12px;letter-spacing:.065em;
      text-transform:uppercase;margin:8px 0}
    #paths-monkey-root .pm-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    #paths-monkey-root .pm-mute{color:var(--pm-muted);font-size:12px}
    #paths-monkey-root .pm-name{font-size:16px;font-weight:800;margin:4px 0;overflow-wrap:anywhere}
    #paths-monkey-root .pm-divider{height:1px;background:#6c525d;margin:15px 0}
    #paths-monkey-root .pm-link{color:var(--pm-gold);display:block;text-decoration:underline;
      padding:7px 0;font-size:12px}
    #paths-monkey-root .pm-compose{position:absolute;bottom:var(--pm-native,95px);
      left:220px;right:0;max-width:100%;padding:8px 12px 9px;border-top:1px solid var(--pm-stroke);
      background:linear-gradient(110deg,#271d28,#39262e);box-shadow:0 -4px 14px #0b080caa;
      pointer-events:auto}
    #paths-monkey-root .pm-compose .pm-editor{display:block;resize:vertical;max-height:100px;
      min-height:53px;font-size:14px}
    #paths-monkey-root .pm-composebar{display:flex;align-items:center;justify-content:space-between;
      gap:8px;margin-bottom:6px}
    #paths-monkey-root .pm-actions{margin-top:6px;display:flex;gap:7px;align-items:center;flex-wrap:wrap}
    #paths-monkey-root .pm-composestatus{font-size:10px;color:var(--pm-muted);flex:1}
    #paths-monkey-root .pm-tip{font-size:10px;color:var(--pm-muted);margin-top:5px}
    #paths-monkey-root .pm-feedback{color:var(--pm-gold);font-size:11px;min-height:15px;overflow-wrap:anywhere}
    #paths-monkey-root .pm-feed{position:absolute;right:10px;top:63px;width:min(320px,calc(100vw - 20px));
      max-height:45vh;overflow:auto;border:1px solid var(--pm-stroke);border-radius:12px;
      background:#261e28;box-shadow:0 10px 35px #000b;pointer-events:auto;padding:10px}
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
    #paths-monkey-root .pm-label{display:block;font-size:12px;color:var(--pm-muted);font-weight:700;margin:11px 0 5px}
    #paths-monkey-root .pm-panel .pm-text{margin-bottom:5px}
    #paths-monkey-root .pm-panel p{color:var(--pm-muted);font-size:12px;margin:8px 0}
    #paths-monkey-root .pm-panel .pm-btn{margin:5px 4px 5px 0}
    #paths-monkey-root .pm-drawer-toggle{display:none}
    #paths-monkey-root .pm-hide{display:none!important}
    #paths-monkey-root .pm-pill{font-size:11px;border-radius:30px;background:#4e343d;color:var(--pm-gold);
      padding:4px 9px;border:1px solid #855663}
    @media(min-width:1180px){
      #paths-monkey-root .pm-compose{right:0;left:220px;padding-left:calc(12px + max(0px,(100vw - 1200px)/4));}
    }
    @media(max-width:790px){
      #paths-monkey-root .pm-hbar{padding:6px 8px;gap:6px}
      #paths-monkey-root .pm-title{font-size:13px}
      #paths-monkey-root .pm-left{display:none;width:min(280px,90vw);z-index:2;bottom:var(--pm-native,95px);
        box-shadow:9px 0 32px #000a}
      #paths-monkey-root .pm-left.pm-open{display:block}
      #paths-monkey-root .pm-drawer-toggle{display:inline-block}
      #paths-monkey-root .pm-compose{left:0;right:0;padding:7px 8px 8px}
      #paths-monkey-root .pm-compose .pm-editor{min-height:46px;max-height:80px}
      #paths-monkey-root .pm-actions{gap:5px}
      #paths-monkey-root .pm-btn.pm-mini{padding:5px 7px}
      #paths-monkey-root .pm-tip{display:none}
      #paths-monkey-root .pm-feed{top:60px;max-height:44vh}
    }
  `);

  const root = document.createElement('div');
  root.id = 'paths-monkey-root';
  root.innerHTML = `
    <div class="pm-hbar">
      <button id="pm-sidebar-toggle" type="button" class="pm-btn pm-mini pm-drawer-toggle" aria-label="Open Paths panels">☰</button>
      <div class="pm-logo" aria-hidden="true">☯</div>
      <div class="pm-title">Paths to Immortality<span class="pm-sub">🐒 GM HUD · ChatGPT narration</span></div>
      <span class="pm-compact-version">v${VERSION}</span>
      <button id="pm-feed-toggle" type="button" class="pm-btn pm-mini" title="Peek at shared room">Scene</button>
      <button id="pm-settings-toggle" type="button" class="pm-btn pm-mini" title="Connections and settings">⚙</button>
      <button id="pm-minimize" type="button" class="pm-btn pm-mini" title="Collapse action composer">▁</button>
    </div>
    <aside id="pm-sidebar" class="pm-left" aria-label="Paths panel">
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
      <a class="pm-link" href="${GM_RULES_URL}" target="_blank" rel="noopener noreferrer">☯ Shared Narrator Protocol ↗</a>
      <a class="pm-link" href="${GAME_URL}" target="_blank" rel="noopener noreferrer">✦ Friend's shared website ↗</a>
      <div class="pm-divider"></div>
      <div class="pm-mute">Monkey only controls this HUD. ChatGPT still owns the actual narration and its blue Send button.</div>
    </aside>
    <section id="pm-feed" class="pm-feed pm-hide" aria-label="Recent shared messages">
      <div class="pm-row"><strong>☁ Shared scene feed</strong><button id="pm-feed-refresh" class="pm-btn pm-mini" type="button">↻</button><button id="pm-feed-close" class="pm-btn pm-mini" type="button">✕</button></div>
      <div id="pm-feed-messages" class="pm-mute">Connect a room to view messages.</div>
    </section>
    <section id="pm-compose" class="pm-compose" aria-label="Xiao Lan action composer">
      <div class="pm-composebar"><strong>✦ Xiao Lan's action</strong><span id="pm-composestatus" class="pm-pill">Offline</span></div>
      <div id="pm-compose-inner">
        <textarea id="pm-action" class="pm-text pm-editor" maxlength="8000" placeholder="What does Xiao Lan do?" aria-label="Compose Xiao Lan's action"></textarea>
        <div class="pm-actions">
          <button id="pm-send" type="button" class="pm-btn pm-primary pm-mini">Post to shared room</button>
          <button id="pm-narrate" type="button" class="pm-btn pm-mini">Prepare Narrate</button>
          <span class="pm-composestatus">Native ChatGPT composer stays below ↓</span>
        </div>
        <div id="pm-feedback" class="pm-feedback" role="status" aria-live="polite"></div>
        <div class="pm-tip">Actions go directly to Supabase. Narrate prepares a short command; you press ChatGPT's blue Send yourself.</div>
      </div>
    </section>
    <div id="pm-settings" class="pm-backdrop pm-hide" role="presentation">
      <section class="pm-panel" role="dialog" aria-modal="true" aria-labelledby="pm-settings-title">
        <div class="pm-row"><h2 id="pm-settings-title">☯ Monkey's briefcase</h2><button id="pm-settings-close" class="pm-btn pm-mini" type="button">✕</button></div>
        <p>This separate Paths userscript does not read or change Mizuhana's scripts, saves, or ChatGPT's story replies.</p>
        <div id="pm-auth-status" class="pm-pill">Not connected</div>
        <div id="pm-signin-section">
          <p>The ChatGPT domain cannot reuse your Google login from GitHub Pages. Connect a separate temporary Monkey identity, then invite it into your room from the main website.</p>
          <button id="pm-connect" class="pm-btn pm-primary" type="button">Create Monkey guest identity</button>
        </div>
        <div id="pm-room-section">
          <label class="pm-label" for="pm-join-code">Private room invitation code (from the owner's website)</label>
          <input id="pm-join-code" class="pm-text" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Paste single-use invitation code">
          <label class="pm-label" for="pm-character-name">Monkey's character name</label>
          <input id="pm-character-name" class="pm-text" maxlength="40" value="Xiao Lan">
          <button id="pm-join" type="button" class="pm-btn pm-primary">Join invited room</button>
          <button id="pm-reload-rooms" type="button" class="pm-btn">Refresh room list</button>
          <div class="pm-h">My rooms</div>
          <div id="pm-room-list" class="pm-mute">No room selected</div>
        </div>
        <div class="pm-divider"></div>
        <button id="pm-close-panel" class="pm-btn">Done</button>
        <button id="pm-forget" type="button" class="pm-btn" title="Only reset Paths Monkey's separate guest identity, not your Cloudveil Google account">Forget Monkey guest identity</button>
        <p>Guest identity persists only while this script's private storage remains. Never share authentication tokens. The website owner account is separate.</p>
      </section>
    </div>
  `;
  document.documentElement.appendChild(root);

  function feedback(message, bad = false) {
    $('feedback').textContent = message;
    $('feedback').style.color = bad ? '#ffbbb2' : '';
  }
  function setBusy(value) {
    busy = value;
    for (const name of ['send', 'connect', 'join', 'reload-rooms', 'narrate', 'feed-refresh']) {
      const el = $(name);
      if (el) el.disabled = value;
    }
  }
  async function runTask(task) {
    if (busy) return;
    setBusy(true);
    try { await task(); }
    catch (err) { feedback(err.message || String(err), true); console.warn('[Paths Monkey]', err); }
    finally { setBusy(false); }
  }
  function setConnectedState() {
    const isInRoom = !!(account && selectedRoom);
    $('room-title').textContent = selectedRoom?.title || 'Not connected';
    $('connection').textContent = !account ? 'Monkey guest not connected' : !selectedRoom ? 'Guest connected · invite needed' : 'Supabase linked · scene available';
    $('auth-status').textContent = account ? 'Monkey guest connected' : 'Not connected';
    $('composestatus').textContent = isInRoom ? '● Linked' : '○ Offline';
    $('send').disabled = busy || !isInRoom;
    $('narrate').disabled = busy || !isInRoom;
    $('signin-section').classList.toggle('pm-hide', !!account);
    $('room-section').classList.toggle('pm-hide', !account);
    $('people').textContent = members.length ? members.map((x) => x.character_name).join(' · ') : 'Participants not loaded';
  }
  function draftKey() { return 'draft.' + (selectedRoom?.id || 'unbound'); }
  function saveDraft() { put(draftKey(), $('action').value); }
  function restoreDraft() {
    $('action').value = get(draftKey(), '');
    pendingRequestId = null;
    pendingRequestBody = null;
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
  async function makeIdentity() {
    if (account) throw new Error('Monkey already has an identity. Use it or reset explicitly.');
    const r = await http('POST','/auth/v1/signup',{body:{data:{app:'Paths Monkey'},gotrue_meta_security:{}}});
    if (!r.access_token || !r.refresh_token || !r.user?.id) throw new Error('Supabase did not return an anonymous session. Enable Anonymous Sign-Ins first.');
    account = {access_token:r.access_token,refresh_token:r.refresh_token,expires_at:Date.now()+(r.expires_in||3600)*1000,user_id:r.user.id};
    put('account',account);
    feedback('Monkey guest created. Invite this guest from your owner account on the Paths website.');
    await loadRooms();
    setConnectedState();
  }
  async function loadRooms() {
    if (!account) return;
    const data = await authed('GET','/rest/v1/rooms?select=id,title,created_at&order=created_at.desc');
    rooms = Array.isArray(data) ? data : [];
    const box = $('room-list');box.replaceChildren();
    if (!rooms.length) { box.textContent='No rooms yet. Generate a fresh invite from the Paths website.'; }
    for (const item of rooms) {
      const b=document.createElement('button');
      b.type='button';b.className='pm-btn';b.style.cssText='display:block;width:100%;margin:5px 0;text-align:left';
      b.textContent='☁ '+item.title;
      b.onclick=()=>runTask(()=>chooseRoom(item));
      box.appendChild(b);
    }
    if (selectedRoom) {
      const found=rooms.find(x=>x.id===selectedRoom.id);
      if (found) selectedRoom=found;
      else { saveDraft(); selectedRoom=null; members=[]; messages=[]; put('room',null); }
    }
    setConnectedState();
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
    closeSettings();
  }
  async function chooseRoom(info) {
    saveDraft();
    selectedRoom={id:info.id,title:info.title};
    put('room',selectedRoom);
    members=[]; messages=[];
    restoreDraft();
    setConnectedState();
    await refreshScene();
    feedback('Connected to '+info.title);
    showSidebar=false;$('sidebar').classList.remove('pm-open');
  }
  async function refreshScene() {
    if (!selectedRoom || !account) return;
    const id=selectedRoom.id;
    const [p,m]=await Promise.all([
      authed('GET','/rest/v1/room_members?select=user_id,character_name,role&room_id=eq.'+encodeURIComponent(id)),
      authed('GET','/rest/v1/messages?select=id,sender_id,kind,body,created_at&room_id=eq.'+encodeURIComponent(id)+'&order=created_at.desc&limit=24')
    ]);
    if (!selectedRoom || selectedRoom.id!==id) return;
    members=Array.isArray(p)?p:[];
    messages=Array.isArray(m)?m.reverse():[];
    setConnectedState();
    renderFeed();
  }
  function renderFeed() {
    const el=$('feed-messages');el.replaceChildren();
    if (!selectedRoom) {el.textContent='Connect to a room to see its messages.';return;}
    if (!messages.length) {el.textContent='The hall is quiet. Nothing posted yet.';return;}
    for (const msg of messages.slice(-12)) {
      const bubble=document.createElement('div');
      bubble.className='pm-bubble'+(msg.kind==='narrator'?' pm-narrator':'');
      const by=document.createElement('div');by.className='pm-by';
      const character=members.find(x=>x.user_id===msg.sender_id)?.character_name || 'Player';
      by.textContent=msg.kind==='narrator'?'✦ Heavenly Voice':character;
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
    if (!pendingRequestId || pendingRequestBody!==text) {
      pendingRequestId=(crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+'-'+Math.random());
      pendingRequestBody=text;
    }
    try {
      await authed('POST','/rest/v1/messages',{
        body:{room_id:selectedRoom.id,sender_id:account.user_id,body:text,client_message_id:pendingRequestId},
        prefer:'return=minimal'
      });
    } catch(e) {
      if (e.code!=='23505') throw e;
      // The same message ID was already accepted. Do not post a second copy.
    }
    $('action').value='';saveDraft();pendingRequestId=null;pendingRequestBody=null;
    feedback('✓ Xiao Lan\'s action posted to the shared room.');
    await refreshScene();
  }
  function makeNarrateInstruction() {
    return 'Cloudveil GM: In Supabase Paths to Immortality, room '+selectedRoom.id+
      ', fetch pending actions. Follow Notion Shared Narrator Protocol GM-SHARED-01, narrate once and publish the result there. Test only; no Notion edits.';
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
    account=null;rooms=[];members=[];messages=[];selectedRoom=null;
    remove('account');remove('room');$('room-list').textContent='No rooms loaded';renderFeed();
    restoreDraft();setConnectedState();feedback('Monkey guest reset. Existing shared room data is untouched.');
  }
  $('settings-toggle').onclick=openSettings;
  $('settings-close').onclick=closeSettings;
  $('close-panel').onclick=closeSettings;
  $('connect').onclick=()=>runTask(makeIdentity);
  $('reload-rooms').onclick=()=>runTask(loadRooms);
  $('join').onclick=()=>runTask(join);
  $('forget').onclick=resetIdentity;
  $('send').onclick=()=>runTask(postAction);
  $('narrate').onclick=prepareNarrate;
  $('feed-toggle').onclick=()=>{showFeed=!showFeed;$('feed').classList.toggle('pm-hide',!showFeed);if(showFeed)runTask(refreshScene);};
  $('feed-close').onclick=()=>{showFeed=false;$('feed').classList.add('pm-hide');};
  $('feed-refresh').onclick=()=>runTask(refreshScene);
  $('sidebar-toggle').onclick=()=>{showSidebar=!showSidebar;$('sidebar').classList.toggle('pm-open',showSidebar);};
  $('minimize').onclick=()=>{const collapsed=$('compose-inner').classList.toggle('pm-hide');$('minimize').textContent=collapsed?'▣':'▁';};
  $('action').addEventListener('input',()=>{saveDraft();if(pendingRequestBody!==$('action').value.trim()){pendingRequestBody=null;pendingRequestId=null;}});
  $('action').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();runTask(postAction);}});
  $('settings').addEventListener('click',e=>{if(e.target===$('settings'))closeSettings();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('settings').classList.contains('pm-hide'))closeSettings();});
  window.addEventListener('resize',()=>{resizeNativeInset();});
  window.addEventListener('beforeunload',saveDraft);
  if(typeof GM_registerMenuCommand==='function') GM_registerMenuCommand('Open Paths Monkey Settings',openSettings);
  setConnectedState();restoreDraft();renderFeed();
  setTimeout(resizeNativeInset,350);
  setTimeout(resizeNativeInset,1250);
  const layoutChecker=setInterval(resizeNativeInset,1800);
  const checker=setInterval(()=>{
    if(account && selectedRoom && document.visibilityState==='visible' && !busy) {
      refreshScene().catch((e)=>{ $('connection').textContent='⚠ '+e.message; });
    }
  },12000);
  window.addEventListener('pagehide',()=>{clearInterval(checker);clearInterval(layoutChecker);},{once:true});
  if(account) runTask(async()=>{
    try{await loadRooms();if(selectedRoom)await refreshScene();}
    catch(err){feedback('Saved guest session needs attention: '+err.message,true);}
  });
  if(!account) setTimeout(()=>{if(!account)openSettings();},600);
  // Do not read or scrape ChatGPT narration. The user's explicit blue Send remains sovereign.
  // Note: This is a separate Supabase guest, not the owner's Google account.
})();
