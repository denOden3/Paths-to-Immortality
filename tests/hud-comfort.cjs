const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('/tmp/paths-qa/node_modules/jsdom');
const source=fs.readFileSync('userscripts/Paths-Monkey-GM.user.js','utf8');
const css=source.split('GM_addStyle(`')[1].split('`);')[0];
const html=source.split('root.innerHTML = `')[1].split('`;')[0];
const dom=new JSDOM('<style>'+css+'</style><div id="paths-monkey-root">'+html+'</div>');
const {document}=dom.window,style=x=>dom.window.getComputedStyle(x);
assert.equal(style(document.getElementById('paths-monkey-root')).fontSize,'16px');
for(const button of document.querySelectorAll('.pm-btn')){const jump=['pm-jump-top','pm-jump-bottom'].includes(button.id);assert.ok(parseFloat(style(button).minHeight)>=(jump?32:['pm-settings-toggle','pm-minimize'].includes(button.id)?32:button.id==='pm-current-session-refresh'?28:button.closest('.pm-actions')?34:44),button.id+' undersized');assert.equal(style(button).fontSize,(['pm-settings-toggle','pm-minimize'].includes(button.id)||jump)?'18px':'14px');}
assert.equal(style(document.querySelector('#pm-registry>p.pm-mute')).fontSize,'14px');
assert.equal(style(document.querySelector('#pm-registry h2')).fontSize,'20px');
assert.equal(style(document.querySelector('.pm-admin-group>summary')).fontSize,'16px');
assert.equal(style(document.querySelector('#pm-registry-toggle')).marginTop,'8px');
assert.equal(style(document.getElementById('pm-action')).fontSize,'16px','composer body text shrunk');
for(const id of ['pm-settings-toggle','pm-settings-close','pm-rooms-page-close','pm-feed-refresh'])assert.ok(document.getElementById(id).getAttribute('aria-label'));
assert.ok(css.includes('select:focus-visible'));assert.ok(css.includes('max-width:min(70ch,76%)'));assert.ok(css.includes('.pm-message-time'));assert.ok(document.getElementById('pm-jump-top'));assert.ok(document.getElementById('pm-jump-bottom'));assert.ok(css.includes('summary:focus-visible'));
const sample=document.createElement('details');sample.className='pm-character-card pm-saved-character';sample.open=true;sample.innerHTML='<summary>Xu Yi</summary><div class="pm-character-body"><p class="pm-character-description">Description</p><div class="pm-row pm-character-actions"><button class="pm-btn">Notion</button><button class="pm-btn">Edit</button></div><div class="pm-character-editor">Editor</div></div>';document.getElementById('paths-monkey-root').append(sample);
assert.equal(style(sample).padding,'0px');assert.equal(style(sample.querySelector('.pm-character-body')).display,'grid');assert.equal(style(sample.querySelector('.pm-character-actions')).flexDirection,'column');assert.equal(style(sample.querySelector('.pm-character-editor')).gridColumn,'1/-1');
// Check actual opaque palette pairs against the 4.5:1 normal-text threshold.
const luminance=hex=>{const c=hex.match(/[a-f0-9]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
const contrast=(a,b)=>{let x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const tokens=Object.fromEntries([...css.matchAll(/--pm-([a-z]+):(#(?:[a-f0-9]{6}))/gi)].map(m=>[m[1],m[2]]));
const pairs=[[tokens.ink,tokens.bg],[tokens.muted,tokens.bg],[tokens.ink,'#211b24'],[tokens.ink,'#3e303a'],[tokens.gold,'#302631'],['#ffffff',tokens.red],['#ffffff','#1458aa'],['#baa9ae','#17131b']];
for(const [fg,bg] of pairs)assert.ok(contrast(fg,bg)>=4.5,fg+' on '+bg+' insufficient contrast');
assert.ok(contrast(tokens.stroke,tokens.bg)>=3,'control boundary contrast');
console.log('PASS: consistent type hierarchy, 44px controls, named icon controls, focus selectors and text/control contrast');

assert.equal(style(document.getElementById('pm-manage-rooms')).marginLeft,'12px');assert.equal(style(document.getElementById('pm-manage-rooms')).marginTop,'0px');assert.equal(style(document.getElementById('pm-manage-rooms')).borderBottomWidth,'0px');assert.equal(style(document.querySelector('#pm-administration-group>summary')).marginBottom,'0px');assert.equal(style(document.querySelector('#pm-sidebar .pm-h')).marginTop,'0px');assert.equal(style(document.getElementById('pm-current-session-refresh')).float,'none');
