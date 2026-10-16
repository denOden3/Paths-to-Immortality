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
assert.equal(document.getElementById('pm-character-session').previousElementSibling.tagName,'SUMMARY');assert.equal(document.getElementById('pm-character-session').getAttribute('aria-label'),'Active session');
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
// Saved characters are collapsed bordered names; fields live behind Edit, with no Objective input.
context.characterHost.innerHTML='';
vm.runInContext(`renderRegistryCharacters({id:'player'},characterHost,[{id:'char',name:'Xu Yi',description:'A disciple',goal:'Keep old objective',source_url:'https://www.notion.so/3fbb0ac52efe806e9fbeee8ce2b760a9'}]);`,context);
const savedCard=context.characterHost.querySelector('details.pm-saved-character');assert.ok(savedCard);assert.equal(savedCard.open,false);assert.equal(savedCard.querySelector('summary').textContent,'Xu Yi');
assert.equal(savedCard.querySelector('.pm-character-description').textContent,'A disciple');
const publicButtons=savedCard.querySelector('.pm-character-body>.pm-row');assert.ok(publicButtons.classList.contains('pm-character-actions'));assert.equal(publicButtons.children.length,2);assert.equal(publicButtons.children[0].textContent,'Notion');assert.ok(publicButtons.children[0].href.endsWith('3fbb0ac52efe806e9fbeee8ce2b760a9'));
const editCharacter=publicButtons.children[1],characterEditor=savedCard.querySelector('.pm-character-editor');assert.ok(characterEditor.classList.contains('pm-hide'));editCharacter.onclick();assert.ok(!characterEditor.classList.contains('pm-hide'));assert.equal(editCharacter.getAttribute('aria-expanded'),'true');
assert.equal(context.characterHost.querySelector('[aria-label=Objective]'),null);
const originalAuthed=context.authed;let characterSave;
context.authed=async(method,path,opts)=>{characterSave=opts.body;return [];};context.paired=true;context.account={};
await [...characterEditor.querySelectorAll('button')].find(x=>x.textContent==='Save').onclick();assert.equal(characterSave.p_objective,'Keep old objective');assert.equal(characterSave.p_description,'A disciple');context.authed=originalAuthed;
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
// The room shortcut follows the picker and never opens an ended room.
assert.equal(document.getElementById('pm-open-picked-room').textContent,'New Jianghu Session');
context.chooseRoom=async room=>{context.openedRoom=room.id;};
await vm.runInContext('openPickedRoom();',context);assert.equal(context.openedRoom,'native-room');
await vm.runInContext("rooms.push({id:'second',title:'Second room',session_state:'active'});renderOngoingSessions();$('character-session').value='second';renderPickedRoomButton();openPickedRoom();",context);
assert.equal(document.getElementById('pm-open-picked-room').textContent,'Second room');assert.equal(context.openedRoom,'second');
await vm.runInContext("rooms.find(x=>x.id==='second').session_state='ended';renderPickedRoomButton();openPickedRoom();",context);
assert.ok(document.getElementById('pm-open-picked-room').classList.contains('pm-hide'));assert.ok(document.getElementById('pm-open-picked-room').disabled);
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
vm.runInContext(source.slice(source.indexOf('  function renderSessionInformation(){'),source.indexOf('  async function loadSceneIntro(){'))+roomPageCode+settingsCode,context);
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
// Session Tools belongs to the current chat, not the independently inspected picker room.
assert.equal(document.getElementById('pm-reload-rooms'),null);assert.equal(document.getElementById('pm-room-list'),null);
let listReloads=0;context.loadRooms=async()=>{listReloads++;};context.refreshScene=async()=>{};context.loadSceneIntro=async()=>{};context.loadRoomSetup=async()=>{};context.runTask=fn=>{context.roomTask=fn();return context.roomTask;};
vm.runInContext("account={};paired=true;selectedRoom={id:'chat-room',title:'Actual chat',session_state:'active'};currentIntro={scene_date:'Early Spring, 2nd',location:'Mountain Gate',opening:'A quiet morning',session_goals:'Explore'};members=[{player_alias:'Puuchan',character_name:'Xu Yi'}];setInfoVisible(false);openRoomPage('manage');",context);await context.roomTask;
const sessionInfo=document.getElementById('pm-current-session-info');assert.ok(sessionInfo.textContent.includes('Actual chat'));assert.ok(sessionInfo.textContent.includes('Mountain Gate'));assert.ok(sessionInfo.textContent.includes('Puuchan'));assert.equal(listReloads,0,'Session Tools reloaded every room');assert.equal(document.getElementById('pm-session-details-editor').open,false);
vm.runInContext('closeRoomPage();',context);assert.equal(vm.runInContext('captureHudPage().view',context),'chat');assert.ok(!document.getElementById('pm-feed').classList.contains('pm-hide'));
context.runTask=fn=>fn();
// Minimize/restore retains the existing page and unsaved form DOM.
context.hudMode='paths';context.hudExpanded=true;context.resizeNativeInset=()=>{};
vm.runInContext(source.slice(source.indexOf('  function closePickerMenu() {'),source.indexOf('  function switchToMizuhana(){')),context);
for(const view of ['registry','roomlogs','settings','create','chat']){
 vm.runInContext("root.classList.remove('pm-registry-open','pm-roomlogs-open','pm-creating');$('settings').classList.add('pm-hide');$('rooms-page').classList.add('pm-hide');showSidebar=false;",context);
 if(view==='registry')root.classList.add('pm-registry-open');if(view==='roomlogs')root.classList.add('pm-roomlogs-open');
 if(view==='settings')document.getElementById('pm-settings').classList.remove('pm-hide');
 if(view==='create'){root.classList.add('pm-creating');document.getElementById('pm-rooms-page').classList.remove('pm-hide');}
 document.getElementById('pm-registry-name').value='Unsaved draft';document.getElementById('pm-registry').scrollTop=125;
 const before=vm.runInContext('JSON.stringify(captureHudPage())',context);
 vm.runInContext("setHudMode('paths',false);setHudMode('paths',true);",context);
 assert.equal(vm.runInContext('JSON.stringify(captureHudPage())',context),before,view+' lost on restore');
 assert.equal(document.getElementById('pm-registry-name').value,'Unsaved draft');assert.equal(document.getElementById('pm-registry').scrollTop,125);
}
// Import is an editable draft; Check Page never registers a character.
const importerHost=document.createElement('div');document.body.append(importerHost);context.importerHost=importerHost;context.paired=true;context.account={};
context.authed=async(method,path)=>{assert.equal(path,'/functions/v1/notion-character-preview');return {name:'Xu Yi',description:'From the editable Notion quote',goal:'',source_url:'https://www.notion.so/3fbb0ac52efe806e9fbeee8ce2b760a9',warnings:[]};};
vm.runInContext("renderRegistryCharacters({id:'player'},importerHost,[]);",context);
const importForm=importerHost.querySelector('.pm-character-card'),link=importForm.querySelector('input[type=url]');link.value='https://notion.so/3fbb0ac52efe806e9fbeee8ce2b760a9';
const check=[...importForm.querySelectorAll('button')].find(b=>b.textContent==='Check Page');await check.onclick();
assert.equal(importForm.querySelector('textarea').value,'From the editable Notion quote');assert.ok(importForm.textContent.includes('Draft ready'));
importForm.querySelector('textarea').value='My edited description';let saved;
context.authed=async(method,path,options)=>{saved={path,body:options.body};return [];};
await [...importForm.querySelectorAll('button')].find(b=>b.textContent==='Register Character').onclick();
assert.equal(saved.path,'/rest/v1/rpc/hud_save_character_source');assert.equal(saved.body.p_description,'My edited description');assert.ok(saved.body.p_source_url.endsWith('3fbb0ac52efe806e9fbeee8ce2b760a9'));
console.log('PASS: exclusive page routing, active navigation indicator, Create/Settings separation, native session selection, desktop/sidebar/mobile behavior and Registry controls');
})().catch(error=>{console.error(error);process.exitCode=1;});
