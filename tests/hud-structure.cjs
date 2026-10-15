const fs=require('fs'),assert=require('node:assert/strict');const {parseHTML}=require(process.env.PORTAL_DOM_MODULE||'/tmp/paths-qa/node_modules/linkedom');
const source=fs.readFileSync('userscripts/Paths-Monkey-GM.user.js','utf8');const template=source.split('root.innerHTML = `')[1].split('`;')[0];const {document}=parseHTML('<html><body>'+template+'</body></html>');
const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);assert.equal(new Set(ids).size,ids.length);
for(const m of source.matchAll(/\$\('([^']+)'\)/g)){assert.ok(document.getElementById('pm-'+m[1]),'missing HUD control: '+m[1]);}
for(const id of ['pm-kick-player','pm-kick-player-button','pm-end-session','pm-reset-session','pm-copy-invite-code'])assert.ok(document.getElementById(id));assert.equal(document.getElementById('pm-invite-kind'),null);
// Exercise actual Admin/chat routing and active-room filtering.
const vm=require('vm');const infoCode=source.slice(source.indexOf('  function resizeHudBody(){'),source.indexOf('  function openSettings()'));
document.getElementById('pm-compose').getBoundingClientRect=()=>({height:130});
const root={classList:document.body.classList,querySelector:()=>({getBoundingClientRect:()=>({height:55})}),style:{setProperty(){}}};
const context=vm.createContext({document,root,$:id=>document.getElementById('pm-'+id),showSidebar:false,showFeed:true,account:null,selectedRoom:null,rooms:[],runTask:fn=>fn(),loadRooms:()=>{},chooseRoom:()=>{}});
vm.runInContext(infoCode+`;setInfoVisible(false);`,context);
assert.ok(root.classList.contains('pm-admin'),'no room must show Admin');
assert.equal(document.getElementById('pm-sidebar').getAttribute('aria-hidden'),'false');
assert.ok(document.getElementById('pm-feed').classList.contains('pm-hide'));
vm.runInContext("account={};selectedRoom={id:'active',session_state:'active'};setInfoVisible(false);",context);
assert.ok(!root.classList.contains('pm-admin'),'active room must open chat');
assert.equal(document.getElementById('pm-sidebar').getAttribute('aria-hidden'),'true');
assert.ok(!document.getElementById('pm-feed').classList.contains('pm-hide'));
vm.runInContext('toggleSidebar();',context);assert.ok(root.classList.contains('pm-admin'),'symbol returns Admin');
vm.runInContext("selectedRoom.session_state='ended';setInfoVisible(false);",context);assert.ok(root.classList.contains('pm-admin'),'ended scene must hide composer');
const listCode=source.slice(source.indexOf('  function renderOngoingSessions(){'),source.indexOf('  function renderFeed()'));
vm.runInContext(listCode+`;rooms=[{id:'a',title:'Active room',session_state:'active'},{id:'e',title:'Ended room',session_state:'ended'}];renderOngoingSessions();`,context);
assert.equal(document.getElementById('pm-ongoing-list').querySelectorAll('button').length,1);assert.equal(document.getElementById('pm-ongoing-list').textContent,'Active room');
console.log('PASS: HUD controls, event targets, Admin/chat routing, composer gating, symbol return and ongoing-session filtering');
