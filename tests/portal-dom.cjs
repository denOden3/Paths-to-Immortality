const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {parseHTML}=require(process.env.PORTAL_DOM_MODULE||'/tmp/paths-qa/node_modules/linkedom');
const html=fs.readFileSync('index.html','utf8'),{document}=parseHTML(html);
const storage=new Map(),location={search:'',pathname:'/Paths-to-Immortality/',hash:'',origin:'https://denoden3.github.io'};
const code=html.split('<script type="module">')[1].split('</script>')[0].replace(/\nboot\(\);\s*$/,'');
const sandbox={document,location,history:{replaceState(){}},window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{onLine:true},URL,URLSearchParams,console,crypto:require('crypto').webcrypto,confirm:()=>false,setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,assert};
const context=vm.createContext(sandbox);vm.runInContext(code,context);
vm.runInContext(`(async()=>{
 const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);assert.equal(new Set(ids).size,ids.length,'duplicate IDs');
 for(const match of ${JSON.stringify(code)}.matchAll(/\$\('([^']+)'\)/g)){assert.ok($(match[1]),'missing element '+match[1]);}
 applyPresentation();show('welcome');
 assert.equal($('guest').parentElement.lastElementChild.id,'guest','text remains below Step forth');
 assert.equal($('welcome').children.length,1);
 assert.equal($('playerGreeting').textContent,DEFAULT_PRESENTATION.temporaryCopy);
 assert.equal(parseInvitation('A'.repeat(48)),'a'.repeat(48));
 assert.equal(parseInvitation('https://denoden3.github.io/Paths-to-Immortality/?invite='+'b'.repeat(48)),'b'.repeat(48));
 assert.throws(()=>parseInvitation('invalid'));
 let payload={player_alias:'Puuchan',player_kind:'established',characters:['Xu Yi','Second PC'],title:'Cloudveil trial',scene_date:'Early Spring, 2nd',location:'Courtyard',opening:'The trial begins.'};
 db={rpc:async name=>({data:payload,error:null})};$('sessionCode').value='a'.repeat(48);await generateSession();
 assert.equal(currentView,'intro');assert.equal($('playerWelcome').textContent,'Welcome back, Puuchan!');
 assert.equal($('playerGreeting').textContent,'Are you ready to continue your journey to the Jianghu?');
 assert.equal($('characterChoices').querySelectorAll('input[type=checkbox]').length,2);
 assert.equal($('characterChoices').querySelectorAll('input[type=radio]').length,0);
 assert.equal($('introTitle').textContent,'Cloudveil trial');
 payload={player_alias:'Guest friend',player_kind:'temporary',roles:['Applicant'],role_details:[{name:'Applicant',description:'A hopeful',goal:'Pass'}],previous_characters:[{name:'Old friend',description:'A returning character',goal:'Visit'}],title:'Guest scene',opening:'Welcome.'};
 await generateSession();assert.equal($('playerWelcome').textContent,'Welcome, Guest friend!');
 assert.equal($('characterChoices').querySelectorAll('input[type=radio]').length,2);
 assert.equal($('characterChoices').querySelectorAll('input[type=checkbox]').length,0);
 assert.ok($('characterChoices').textContent.includes('Previously played'));
 $('sessionCode').value='c'.repeat(48);invalidateScene();assert.ok($('sceneResult').classList.contains('hidden'));
 portalIdentity={is_admin:false};show('intro');assert.ok($('navAdmin').classList.contains('hidden'));assert.ok($('toolsOpen').classList.contains('hidden'));
 portalIdentity={is_admin:true};show('administration');assert.ok(!$('navAdmin').classList.contains('hidden'));
 for(const tab of ['starting','intro','chat']){adminTab=tab;renderEditor();assert.ok($('playerPreview').children.length>1,'preview empty: '+tab);}
 presentationDraft.startTitle='<img src=x onerror=alert(1)>';adminTab='starting';renderPreview();assert.equal($('playerPreview').querySelectorAll('img').length,0,'preview HTML injection');
 user={id:'qa-user'};portalIdentity={alias:'Puuchan',kind:'established'};db={rpc:async()=>({data:[{character:'Xu Yi',kind:'established',scene_title:'Scene A',scene_date:'Early Spring, 2nd',location:'Courtyard',room_id:null},{character:'Xu Yi',kind:'established',scene_title:'Scene B',scene_date:'Early Spring, 3rd',location:'Hall',room_id:null}]})};
 await showCharacterLog();assert.equal($('logEntries').querySelectorAll('article').length,1);assert.ok($('logEntries').textContent.includes('Scene A'));assert.ok($('logEntries').textContent.includes('Scene B'));
 console.log('PASS: entrance text, identity greetings, invitation parsing, established checkboxes, temporary radios/history, stale-code reset, admin visibility, three previews, injection safety, grouped Characters Log');
})()`,context).catch(e=>{console.error(e);process.exitCode=1;});
