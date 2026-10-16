const fs=require('fs'),assert=require('node:assert/strict');const {JSDOM}=require(process.env.HUD_DOM_MODULE||'/tmp/paths-qa/node_modules/jsdom');
const source=fs.readFileSync('userscripts/Paths-Monkey-GM.user.js','utf8');const template=source.split('root.innerHTML = `')[1].split('`;')[0];const {document}=new JSDOM('<html><body>'+template+'</body></html>').window;
const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);assert.equal(new Set(ids).size,ids.length);
for(const m of source.matchAll(/\$\('([^']+)'\)/g)){assert.ok(document.getElementById('pm-'+m[1]),'missing HUD control: '+m[1]);}
for(const id of ['pm-kick-player','pm-kick-player-button','pm-end-session','pm-reset-session','pm-copy-invite-code'])assert.ok(document.getElementById(id));assert.equal(document.getElementById('pm-invite-kind'),null);
// Exercise actual Admin/chat routing and active-room filtering.
const vm=require('vm');const infoCode=source.slice(source.indexOf('  function resizeHudBody(){'),source.indexOf('  function openSettings()'));
document.getElementById('pm-compose').getBoundingClientRect=()=>({height:130});
const root={classList:document.body.classList,querySelector:()=>({getBoundingClientRect:()=>({height:55})}),style:{setProperty(){}}};
const sourceToggle=source.slice(source.indexOf('  function toggleInformation(){'),source.indexOf('  function captureHudPage(){'));
const context=vm.createContext({document,root,$:id=>document.getElementById('pm-'+id),showSidebar:false,showFeed:true,busy:false,account:null,paired:true,roomSetup:{locations:[],players:[]},currentIntro:{},get:(key,fallback)=>fallback,put:()=>{},hudHistory:[],restoringHudPage:false,selectedRoom:null,rooms:[],roomsLoaded:true,window:{matchMedia:()=>({matches:false})},runTask:fn=>fn(),loadRooms:()=>{},chooseRoom:()=>{},authed:async()=>[]});
const listCode=source.slice(source.indexOf('  function renderOngoingSessions(){'),source.indexOf('  function renderFeed()'));
(async()=>{
vm.runInContext(listCode,context);
vm.runInContext(source.slice(source.indexOf('  function populateLocationPicker('),source.indexOf('  function renderKickPlayers()')),context);
vm.runInContext(infoCode+`;setInfoVisible(false);`,context);
assert.ok(root.classList.contains('pm-admin'),'no room must show Admin');
assert.equal(document.getElementById('pm-sidebar').getAttribute('aria-hidden'),'false');
assert.ok(document.getElementById('pm-feed').classList.contains('pm-hide'));
vm.runInContext("account={};selectedRoom={id:'active',session_state:'active'};setInfoVisible(false);",context);
assert.ok(!root.classList.contains('pm-admin'),'active room must open chat');
assert.equal(document.getElementById('pm-sidebar').getAttribute('aria-hidden'),'true');
assert.ok(!document.getElementById('pm-feed').classList.contains('pm-hide'));
await vm.runInContext('toggleSidebar();',context);assert.ok(root.classList.contains('pm-admin'),'symbol returns Admin');
vm.runInContext("selectedRoom.session_state='ended';setInfoVisible(false);",context);assert.ok(root.classList.contains('pm-admin'),'ended scene must hide composer');
vm.runInContext(`rooms=[{id:'a',title:'Active room',session_state:'active'},{id:'e',title:'Ended room',session_state:'ended'}];renderOngoingSessions();`,context);
const admin=document.getElementById('pm-administration-group'),current=document.getElementById('pm-current-session-group');
assert.equal(admin.tagName,'DETAILS');assert.equal(current.tagName,'DETAILS');assert.equal(admin.parentElement,current.parentElement);
for(const id of ['pm-manage-rooms','pm-open-roomlogs','pm-open-registry'])assert.ok(admin.contains(document.getElementById(id)));
for(const id of ['pm-people','pm-calendar','pm-character-session'])assert.ok(current.contains(document.getElementById(id)));
assert.ok(document.getElementById('pm-manage-rooms').textContent.startsWith('＋'));
assert.ok(!template.includes('Monkey only controls this HUD.'));assert.ok(!source.includes("feedback('Connected to '+info.title)"));
vm.runInContext(`renderRegistry([{id:'one',alias:'<img src=x>',in_session:true,sessions:[{title:'Trial room',characters:['Xu Yi']}]},{id:'two',alias:'Friend',in_session:false,sessions:[]}]);`,context);
assert.equal(document.getElementById('pm-registry-list').querySelectorAll('img').length,0);
assert.equal(document.getElementById('pm-registry-list').querySelectorAll('article').length,2);
assert.ok(document.getElementById('pm-registry-list').textContent.includes('In a session'));assert.ok(document.getElementById('pm-registry-list').textContent.includes('Not in a session'));assert.ok(document.getElementById('pm-registry-list').textContent.includes('Xu Yi'));
await vm.runInContext("root.classList.add('pm-registry-open');toggleSidebar();",context);assert.ok(!root.classList.contains('pm-registry-open'),'symbol returns from Registry');
vm.runInContext('renderRoomLogs();',context);
assert.ok(document.getElementById('pm-roomlogs-list').textContent.includes('Ongoing'));assert.ok(document.getElementById('pm-roomlogs-list').textContent.includes('Concluded'));assert.equal(document.getElementById('pm-roomlogs-list').querySelectorAll('button').length,2);
assert.equal(document.getElementById('pm-connection'),null);
assert.equal(document.getElementById('pm-character-session').querySelectorAll('option').length,2);
vm.runInContext(`renderCharacterParticipants([{player_alias:'Puuchan',character_name:'Xu Yi',allowed_characters:['Xu Yi','Second PC'],role:'member'}]);`,context);
assert.ok(document.getElementById('pm-people').textContent.includes('Puuchan'));assert.ok(document.getElementById('pm-people').textContent.includes('Second PC'));
await vm.runInContext("root.classList.add('pm-roomlogs-open');toggleSidebar();",context);assert.ok(!root.classList.contains('pm-roomlogs-open'));
for(const id of ['pm-room-title','pm-ongoing-list','pm-refresh-ongoing'])assert.equal(document.getElementById(id),null);
assert.equal(document.getElementById('pm-character-session').previousElementSibling.tagName,'LABEL');assert.equal(document.getElementById('pm-character-session').previousElementSibling.previousElementSibling.tagName,'SUMMARY');
// Back from a chat opened via Room Logs returns to Room Logs, then Admin.
await vm.runInContext(`hudHistory=[];selectedRoom={id:'a',session_state:'active'};setInfoVisible(true);rememberHudPage();root.classList.add('pm-roomlogs-open');rememberHudPage();setInfoVisible(false);toggleSidebar();`,context);
assert.ok(root.classList.contains('pm-roomlogs-open'),'back from chat lost Room Logs');
await vm.runInContext('toggleSidebar();',context);assert.ok(!root.classList.contains('pm-roomlogs-open'));assert.ok(root.classList.contains('pm-admin'));
// Both participant data and calendar follow the picker, not the current chatroom.
context.authed=async(method,path,options)=>path.includes('get_scene_introduction')?{scene_date:'Early Spring, 8th'}:[{player_alias:'Puuchan',character_name:'Xu Yi'}];
await vm.runInContext('loadCharacterParticipants();',context);
assert.ok(document.getElementById('pm-people').textContent.includes('Puuchan'));assert.equal(document.getElementById('pm-calendar').textContent,'Early Spring, 8th');
const playerCard=document.getElementById('pm-registry-list').querySelector('article');
assert.ok(playerCard.querySelector('.pm-player-heading').textContent.includes(' · In a session'));
const renameButton=[...playerCard.querySelectorAll('button')].find(x=>x.textContent==='Rename');const charactersButton=[...playerCard.querySelectorAll('button')].find(x=>x.textContent==='Characters');assert.ok(renameButton&&charactersButton);
const renameRow=playerCard.querySelector('.pm-input-row');assert.ok(renameRow.classList.contains('pm-hide'));renameButton.onclick();assert.ok(!renameRow.classList.contains('pm-hide'));assert.equal(renameRow.querySelector('button').textContent,'Save');
charactersButton.onclick();assert.ok(renameRow.classList.contains('pm-hide'),'Characters left rename form visible');assert.equal(renameButton.getAttribute('aria-pressed'),'false');assert.equal(charactersButton.getAttribute('aria-pressed'),'true');assert.ok(charactersButton.classList.contains('pm-registry-active'));
renameButton.onclick();assert.ok(!renameRow.classList.contains('pm-hide'));assert.equal(charactersButton.getAttribute('aria-pressed'),'false');assert.ok(playerCard.lastElementChild.classList.contains('pm-hide'),'Rename left Characters visible');
renameButton.onclick();assert.ok(renameRow.classList.contains('pm-hide'));assert.equal(renameButton.getAttribute('aria-pressed'),'false');

assert.ok(document.getElementById('pm-registry-create').classList.contains('pm-hide'));assert.ok(!document.getElementById('pm-registry-toggle').classList.contains('pm-primary'));assert.equal(document.getElementById('pm-registry-add').textContent,'Register');assert.ok(document.getElementById('pm-registry-add').classList.contains('pm-primary'));assert.equal(document.getElementById('pm-registry-add').parentElement,document.getElementById('pm-registry-name').parentElement);
context.characterHost=document.createElement('div');
vm.runInContext(`renderRegistryCharacters({id:'player'},characterHost,[{id:'char',name:'Xu Yi',description:'A disciple',goal:'Learn'}]);`,context);
assert.equal(context.characterHost.querySelectorAll('.pm-character-card').length,2);assert.ok(context.characterHost.textContent.includes('Remove'));assert.ok(context.characterHost.textContent.includes('Save'));assert.ok(context.characterHost.textContent.includes('Add Character'));
// The symbol toggles information without changing its underlying page.
vm.runInContext(sourceToggle,context);
vm.runInContext("selectedRoom={id:'a',session_state:'active'};setInfoVisible(false);toggleInformation();",context);
assert.ok(root.classList.contains('pm-info-overlay'));
assert.equal(context.showSidebar,false,'opening information changed the chat view');
vm.runInContext('toggleInformation();',context);
assert.ok(!root.classList.contains('pm-info-overlay'));
assert.equal(context.showSidebar,false,'closing information did not restore chat');
vm.runInContext("setInfoVisible(true);root.classList.add('pm-registry-open');toggleInformation();toggleInformation();",context);
assert.ok(root.classList.contains('pm-registry-open'),'information toggle lost Registry page');
vm.runInContext("root.classList.remove('pm-registry-open');toggleInformation();",context);
assert.ok(root.classList.contains('pm-info-dismissed'),'Admin information did not close');
vm.runInContext('toggleInformation();',context);
assert.ok(!root.classList.contains('pm-info-dismissed'));

// Real select semantics: a loaded active room must be selected, including after periodic rebuilds.
await vm.runInContext(`rooms=[{id:'native-room',title:'New Jianghu Session',session_state:'active'}];selectedRoom=null;renderOngoingSessions();`,context);
assert.equal(document.getElementById('pm-character-session').value,'native-room');assert.equal(document.getElementById('pm-character-session').selectedIndex,1);
await vm.runInContext('renderOngoingSessions();',context);assert.equal(document.getElementById('pm-character-session').value,'native-room');
await vm.runInContext('loadCharacterParticipants();',context);assert.ok(document.getElementById('pm-people').textContent.includes('Puuchan'));assert.ok(!document.getElementById('pm-calendar').textContent.includes('No active'));
// Desktop sidebar toggles without changing the selected main page.
context.window.matchMedia=()=>({matches:true});
vm.runInContext("root.classList.remove('pm-info-dismissed');root.classList.add('pm-registry-open');syncDesktopLayout();toggleInformation();",context);
assert.ok(root.classList.contains('pm-info-dismissed'));assert.ok(root.classList.contains('pm-registry-open'));
vm.runInContext('toggleInformation();',context);assert.ok(!root.classList.contains('pm-info-dismissed'));assert.ok(root.classList.contains('pm-registry-open'));assert.equal(document.getElementById('pm-sidebar').getAttribute('aria-hidden'),'false');
assert.equal(document.getElementById('pm-settings').querySelector('.pm-panel').getAttribute('role'),'region');
context.window.matchMedia=()=>({matches:false});vm.runInContext('syncDesktopLayout();',context);assert.equal(document.getElementById('pm-settings').querySelector('.pm-panel').getAttribute('role'),'dialog');
// Exercise actual main-page routing, including an unconnected HUD.
const roomPageCode=source.slice(source.indexOf('  function openRoomPage('),source.indexOf('  function resizeHudBody(){'));
const settingsCode=source.slice(source.indexOf('  function openSettings()'),source.indexOf('  function resetIdentity()'));
context.setConnectedState=()=>{};context.previousFocus=null;
vm.runInContext(roomPageCode+settingsCode,context);
await vm.runInContext("account=null;paired=false;setInfoVisible(true);openRoomPage('create');",context);
assert.equal(document.getElementById('pm-rooms-page').classList.contains('pm-hide'),false);assert.ok(document.getElementById('pm-settings').classList.contains('pm-hide'),'Create redirected into Settings');
assert.equal(document.getElementById('pm-manage-rooms').getAttribute('aria-current'),'page');assert.ok(!document.getElementById('pm-room-setup-settings').classList.contains('pm-hide'));
vm.runInContext('openSettings();',context);
assert.ok(document.getElementById('pm-rooms-page').classList.contains('pm-hide'),'Settings left Create visible');assert.equal(document.getElementById('pm-settings').classList.contains('pm-hide'),false);assert.equal(document.getElementById('pm-settings-toggle').getAttribute('aria-current'),'page');
assert.equal(document.getElementById('pm-manage-rooms').getAttribute('aria-current'),null);
await vm.runInContext('openRoomLogs();',context);
assert.ok(document.getElementById('pm-settings').classList.contains('pm-hide'));assert.equal(document.getElementById('pm-open-roomlogs').getAttribute('aria-current'),'page');assert.equal(document.querySelectorAll('.pm-nav-active').length,1);
await vm.runInContext('openRegistry();',context);
assert.ok(!root.classList.contains('pm-roomlogs-open'));assert.equal(document.getElementById('pm-open-registry').getAttribute('aria-current'),'page');assert.equal(document.querySelectorAll('.pm-nav-active').length,1);
vm.runInContext("openRoomPage('create');openSettings();closeSettings();",context);assert.equal(document.querySelectorAll('.pm-nav-active').length,0);
console.log('PASS: exclusive page routing, active navigation indicator, Create/Settings separation, native session selection, desktop/sidebar/mobile behavior and Registry controls');
})().catch(error=>{console.error(error);process.exitCode=1;});
