const fs=require('fs'),assert=require('node:assert/strict');const {parseHTML}=require(process.env.PORTAL_DOM_MODULE||'/tmp/paths-qa/node_modules/linkedom');
const source=fs.readFileSync('userscripts/Paths-Monkey-GM.user.js','utf8');const template=source.split('root.innerHTML = `')[1].split('`;')[0];const {document}=parseHTML('<html><body>'+template+'</body></html>');
const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);assert.equal(new Set(ids).size,ids.length);
for(const m of source.matchAll(/\$\('([^']+)'\)/g)){assert.ok(document.getElementById('pm-'+m[1]),'missing HUD control: '+m[1]);}
for(const id of ['pm-kick-player','pm-kick-player-button','pm-end-session','pm-reset-session','pm-copy-invite-code'])assert.ok(document.getElementById(id));assert.equal(document.getElementById('pm-invite-kind'),null);
// Exercise the actual information toggle without a mobile-only viewport stub.
const vm=require('vm');const infoCode=source.slice(source.indexOf('  function resizeHudBody(){'),source.indexOf('  function openSettings()'));
document.getElementById('pm-compose').getBoundingClientRect=()=>({height:130});
const root={querySelector:()=>({getBoundingClientRect:()=>({height:55})}),style:{setProperty(){}}};
const context=vm.createContext({root,$:id=>document.getElementById('pm-'+id),showSidebar:false,showFeed:true});
vm.runInContext(infoCode+`;toggleSidebar();`,context);
assert.equal(document.getElementById('pm-sidebar').getAttribute('aria-hidden'),'false');
assert.equal(document.getElementById('pm-logo-toggle').getAttribute('aria-expanded'),'true');
assert.ok(document.getElementById('pm-feed').classList.contains('pm-hide'));
vm.runInContext('toggleSidebar();',context);
assert.equal(document.getElementById('pm-sidebar').getAttribute('aria-hidden'),'true');
assert.equal(document.getElementById('pm-logo-toggle').getAttribute('aria-expanded'),'false');
console.log('PASS: HUD controls, unique IDs, all event targets present, and invitation category removed');
