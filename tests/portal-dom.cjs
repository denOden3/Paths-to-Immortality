const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {parseHTML}=require(process.env.PORTAL_DOM_MODULE||'/tmp/paths-qa/node_modules/linkedom');
const html=fs.readFileSync('index.html','utf8'),{document}=parseHTML(html);
const storage=new Map(),location={search:'',pathname:'/Paths-to-Immortality/',hash:'',origin:'https://denoden3.github.io'};
const code=html.split('<script type="module">')[1].split('</script>')[0].replace(/\nboot\(\);\s*$/,'');
const memory={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const sandbox={document,location,history:{replaceState(){}},window:{addEventListener(){}},localStorage:memory,sessionStorage:memory,navigator:{onLine:true},URL,URLSearchParams,console,crypto:require('crypto').webcrypto,confirm:()=>false,setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,assert};
const context=vm.createContext(sandbox);vm.runInContext(code,context);
vm.runInContext(`(async()=>{
 const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);assert.equal(new Set(ids).size,ids.length,'duplicate IDs');
 for(const m of ${JSON.stringify(code)}.matchAll(/\$\('([^']+)'\)/g))assert.ok($(m[1]),'missing element '+m[1]);
 applyPresentation();show('welcome');assert.equal($('guest').parentElement.lastElementChild.id,'guest');assert.equal($('welcome').children.length,1);assert.equal($('accountAccess'),null);assert.ok(!$('toolsOpen').classList.contains('hidden'));
 db={};await enterPortal();assert.equal(currentView,'identityGate');assert.equal(document.querySelectorAll('.identityChoice').length,2);
 show('intro');assert.equal(currentView,'welcome','Intro opened without invitation');
 openCodeDialog();assert.ok(!$('codeOverlay').classList.contains('hidden'));
 assert.equal(parseInvitation('A'.repeat(48)),'a'.repeat(48));assert.equal(parseInvitation('https://denoden3.github.io/Paths-to-Immortality/?invite='+'b'.repeat(48)),'b'.repeat(48));
 db={rpc:async()=>({data:null})};$('sessionCode').value='expired';await generateSession();assert.equal(currentView,'welcome');assert.ok($('notice').classList.contains('hidden'),'invalid code exposed reason');
 let payload={player_alias:'Puuchan',characters:['Xu Yi','Second PC'],character_details:[{name:'Xu Yi',description:'A thoughtful cultivator',goal:'Learn'}],previous_characters:[{name:'Xu Yi',scene_title:'The trial',scene_date:'Early Spring, 2nd'},{name:'Old PC',description:'An old friend'}],title:'Cloudveil trial',scene_date:'Early Spring, 3rd',location:'Courtyard',opening:'A new trial.'};
 db={rpc:async()=>({data:payload,error:null})};$('sessionCode').value='a'.repeat(48);await generateSession();assert.equal(currentView,'intro');assert.equal($('playerWelcome').textContent,'Welcome, Puuchan!');assert.equal($('characterChoices').querySelectorAll('input[type=checkbox]').length,3);assert.equal($('characterChoices').querySelectorAll('input[type=radio]').length,0);assert.ok($('codeOverlay').classList.contains('hidden'));
 $('characterChoices').querySelector('input').checked=true;renderCharacterReminders();assert.equal($('characterReminders').children.length,1);$('characterReminders').firstChild.onclick();assert.ok($('characterReminderInfo').textContent.includes('A thoughtful cultivator'));assert.ok($('characterReminderInfo').textContent.includes('The trial'));
 assert.equal($('navCharacters'),null);assert.equal($('registerKind'),null);
 portalIdentity={is_admin:true};user={id:'owner'};await openAdministration();assert.equal(currentView,'administration');assert.ok($('administration').contains($('monkeyApproval')));assert.equal($('adminConnections'),null);for(const id of ['adminSceneRoom','adminSceneDate','adminSceneLocation','adminSceneOpening','saveAdminScene','ownerRoomRecovery','create','join'])assert.equal($(id),null,'removed Web editor or recovery form remains: '+id);assert.ok(!document.body.textContent.includes('Shared roleplay test'));
 let approvalArgs=null;db={from:()=>({select(){return this;},eq(){return this;},order(){return this;},limit:async()=>({data:[{id:'pair-room'}]})}),rpc:async(name,args)=>{if(name==='approve_monkey_pair_code')approvalArgs=args;return {data:true,error:null};}};room=null;await openAdministration();assert.equal(currentView,'administration');assert.ok($('monkeyApprovalStatus').textContent.includes('paired'));
 $('monkeyApprovalCode').value='a'.repeat(48);confirm=()=>true;await $('monkeyApprove').onclick();assert.equal(approvalArgs.p_owner_room,'pair-room');assert.equal(currentView,'administration');assert.equal(room,null,'inline pairing navigated into a room');confirm=()=>false;
 assert.equal($('adminGreeting').nextElementSibling.id,'portalNav','welcome must precede tabs');
 assert.equal([...$('portalNav').children].map(x=>x.id).join(','),'navAdmin,navSessions,navPlayers','tab order');
 assert.ok($('adminPlayers').contains($('registeredPlayers')),'roster is outside Players panel');assert.equal($('registerAlias'),null);assert.equal($('registerPlayer'),null);
 for(const [view,selected] of [['administration','navAdmin'],['lobby','navSessions'],['adminPlayers','navPlayers']]){show(view);assert.ok(!$('adminGreeting').classList.contains('hidden'));assert.equal($(selected).getAttribute('aria-selected'),'true');for(const panel of ['administration','lobby','adminPlayers'])assert.equal($(panel).classList.contains('hidden'),panel!==view,'panel isolation');}
 show('administration');
 assert.equal($('navSessions').textContent,'Rooms');
 renderRoomLog([{id:'ongoing',title:'Mock Room',session_state:'active'},{id:'finished',title:'Finished scene',session_state:'ended',notion_url:'https://www.notion.so/example'}]);assert.equal($('roomList').querySelectorAll('button').length,2);assert.ok($('roomList').textContent.includes('Ongoing'));assert.ok($('roomList').textContent.includes('Concluded'));assert.ok($('roomList').textContent.includes('Notion link saved'));
 renderConcludedRoom({id:'finished',title:'Finished scene',session_generation:'generation',opening:'The gate closes.'});assert.equal(currentView,'concludedRoom');assert.equal($('archiveStatus').textContent,'No Notion link recorded');assert.ok($('composer').classList.contains('hidden'));assert.equal($('navSessions').getAttribute('aria-selected'),'true');
 renderConcludedRoom({id:'finished',title:'Finished scene',session_generation:'generation',notion_url:'https://www.notion.so/example'});assert.equal($('archiveStatus').textContent,'Notion link saved');assert.ok(!$('archiveLink').classList.contains('hidden'));
 show('administration');
 renderPlayerRoster([{alias:'Puuchan',in_session:true,sessions:[{title:'Mock Room',characters:['Xu Yi']}]},{alias:'Guest friend',in_session:false,sessions:[]}]);
 assert.equal($('registeredPlayers').querySelectorAll('article').length,2);assert.ok($('registeredPlayers').textContent.includes('In a session'));assert.ok($('registeredPlayers').textContent.includes('Not in a session'));assert.ok($('registeredPlayers').textContent.includes('Mock Room'));assert.ok($('registeredPlayers').textContent.includes('Xu Yi'));assert.ok($('rosterSummary').textContent.includes('1 in a session'));
 renderPlayerRoster([{alias:'<img src=x>',in_session:false,sessions:[]}]);assert.equal($('registeredPlayers').querySelectorAll('img').length,0,'roster HTML injection');
 renderPlayerRoster([]);assert.ok($('registeredPlayers').textContent.includes('No players registered yet'));
 for(const id of ['tabStarting','tabIntro','tabChat','savePresentation','playerPreview','pageEditor','navSignout','signout'])assert.equal($(id),null,'removed editor or inline signout remains: '+id);
 assert.ok($('headerMenuOverlay').contains($('menuSignout')));openHeaderMenu();assert.equal($('toolsOpen').getAttribute('aria-expanded'),'true');assert.ok(!$('headerMenuOverlay').classList.contains('hidden'));assert.equal($('headerMenu').querySelectorAll('button').length,2);
 closeHeaderMenu();assert.equal($('toolsOpen').getAttribute('aria-expanded'),'false');assert.ok($('headerMenuOverlay').classList.contains('hidden'));
 portalIdentity={is_admin:false};user={id:'player'};room='room';activeGeneration='saved';localStorage.setItem('paths.activeSession','ongoing-session');show('chat');openHeaderMenu();await returnFromPage();assert.equal(currentView,'welcome');assert.equal(localStorage.getItem('paths.activeSession'),'ongoing-session','back navigation forgot ongoing room');
 let signedOut=false;portalIdentity={is_admin:false};user={id:'wrong-google-account'};db={auth:{signOut:async()=>{signedOut=true;}}};await finishAdministratorSignIn();assert.ok(signedOut);assert.equal(user,null);assert.equal(currentView,'welcome');
 // A kicked, ended, or reset participant must lose the visible chat and its composer.
 for(const record of [null,{id:'room',session_state:'ended',session_generation:'old'},{id:'room',session_state:'active',session_generation:'new'}]){
 room='room';activeGeneration='old';user={id:'player'};portalIdentity={is_admin:false};show('chat');db={from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:record,error:null})})};await checkOngoingSession();assert.equal(currentView,'welcome');assert.ok($('composer').classList.contains('hidden'));assert.equal(room,null);
 }
 room='room';activeGeneration='same';db={from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:'room',session_state:'active',session_generation:'same'}})})};assert.equal(await checkOngoingSession(),true);
 console.log('PASS: identity gate, no header login, restored symbol, code-only Intro, silent invalid code return, unified checkboxes/reminders, no categories/log, removed editors, ordered admin tabs and isolated read-only Players roster/status, room lifecycle log and truthful Notion-link status, popup navigation/signout, resumable back navigation, wrong-account signout, and kicked/ended/reset room eviction');
})()`,context).catch(e=>{console.error(e);process.exitCode=1;});
