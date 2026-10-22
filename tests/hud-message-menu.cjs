const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{JSDOM}=require('/tmp/paths-qa/node_modules/jsdom');
const source=fs.readFileSync('userscripts/Paths-Monkey-GM.user.js','utf8'),template=source.split('root.innerHTML = `')[1].split('`;')[0];
const dom=new JSDOM('<div id="paths-monkey-root">'+template+'</div>'),document=dom.window.document,$=id=>document.getElementById('pm-'+id),timers=new Map();let counter=0;
assert.equal($('message-mode'),null,'separate OOC control should be removed');
assert.equal($('message-speaker').textContent,'Speaker ▾');
assert.equal($('message-speaker').getAttribute('aria-haspopup'),'dialog');
const messages=[{id:'a',kind:'player',sender_id:'owner',character_name:'First',body:'One'},{id:'b',kind:'ooc',sender_id:'owner',body:'Two'},{id:'n',kind:'narrator',body:'A story. [PATHS_STATE]{"version":1,"inventory":[],"scenes":[]}[/PATHS_STATE]'}];
const ctx=vm.createContext({document,$,account:{user_id:'owner'},paired:true,busy:false,selectedRoom:{id:'room',title:'Room'},members:[{user_id:'owner',allowed_characters:['First','Second']},{user_id:'guest',allowed_characters:['Guest']}],messages:structuredClone(messages),selectedMessageIds:new Set(),messageSelectionRoom:null,lastDeletedMessages:null,setTimeout:fn=>{timers.set(++counter,fn);return counter;},clearTimeout:id=>timers.delete(id),visibleNarration:body=>body.replace(/\[PATHS_STATE\][\s\S]*?\[\/PATHS_STATE\]\s*$/,'').trim(),feedback(){},authed:async(method,path,options)=>{
 if(method==='POST'){const b=options.body;for(const m of ctx.messages.filter(m=>b.p_ids.includes(m.id))){if(b.p_action==='delete')m.deleted_at='now';else if(b.p_action==='restore')m.deleted_at=null;else {m.kind=b.p_kind;if(b.p_character)m.character_name=b.p_character;}}return b.p_ids.length;}
 const ids=path.match(/id=in\.\(([^)]*)\)/)[1].split(',');return ctx.messages.filter(m=>ids.includes(m.id));
},refreshScene:async()=>vm.runInContext('renderFeed()',ctx)});
vm.runInContext(source.slice(source.indexOf('  function renderFeed() {'),source.indexOf('  async function postAction()')),ctx);
function pointer(el,type,x=0,y=0){const event=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{button:0,clientX:x,clientY:y});el.dispatchEvent(event);}
function bubble(id){return $('feed-messages').querySelector('[data-message-id="'+id+'"]');}
function flush(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}
(async()=>{
 vm.runInContext('renderFeed()',ctx);assert.equal($('feed-messages').querySelectorAll('button').length,0);assert.ok($('message-selection').classList.contains('pm-hide'));
 pointer(bubble('a'),'pointerdown');pointer(bubble('a'),'pointermove',20,0);flush();assert.equal(ctx.selectedMessageIds.size,0,'scroll selected a bubble');
 pointer(bubble('a'),'pointerdown');pointer(bubble('a'),'pointercancel');flush();assert.equal(ctx.selectedMessageIds.size,0,'canceled pointer selected');
 pointer(bubble('a'),'pointerdown');flush();assert.equal(ctx.selectedMessageIds.size,1);assert.ok(!$('message-selection').classList.contains('pm-hide'));pointer(bubble('a'),'pointerup');bubble('a').click();assert.equal(ctx.selectedMessageIds.size,1,'release unselected long-pressed bubble');
 bubble('b').click();assert.equal(ctx.selectedMessageIds.size,2);assert.ok($('message-edit').disabled);assert.ok(!$('message-speaker').disabled);
 bubble('n').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter'}));assert.ok($('message-speaker').disabled);assert.ok(!$('message-delete').disabled);
 vm.runInContext('clearMessageSelection()',ctx);bubble('n').dispatchEvent(new dom.window.MouseEvent('contextmenu',{bubbles:true,cancelable:true}));assert.equal(ctx.selectedMessageIds.size,1);assert.ok(!$('message-edit').disabled);assert.ok($('message-speaker').disabled);
 await vm.runInContext("manageSelectedMessages('delete')",ctx);assert.equal(bubble('n'),null);assert.ok(!$('message-undo').classList.contains('pm-hide'));await vm.runInContext("manageSelectedMessages('restore')",ctx);assert.ok(bubble('n'));assert.ok($('message-undo').classList.contains('pm-hide'));
 bubble('a').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter'}));vm.runInContext('openMessageSpeakerPicker()',ctx);assert.deepEqual([...$('message-speaker-choice').options].map(x=>x.textContent),['First','Second','Guest','Player chat (OOC)']);
 await vm.runInContext("manageSelectedMessages('speaker','player','Second')",ctx);assert.ok(bubble('a').textContent.includes('Second'));assert.ok($('message-speaker-overlay').classList.contains('pm-hide'));
 bubble('a').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter'}));vm.runInContext('openMessageSpeakerPicker()',ctx);assert.equal($('message-speaker-choice').value,'Second');assert.equal($('message-speaker-choice').lastElementChild.value,'__paths_ooc__');
 await vm.runInContext("manageSelectedMessages('speaker','ooc',null)",ctx);assert.ok(bubble('a').textContent.includes('OOC'),'selected-message speaker picker must support OOC');
 ctx.paired=false;vm.runInContext('renderFeed()',ctx);assert.equal(bubble('n'),null,'ordinary player can select narrator');bubble('a').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter'}));vm.runInContext('openMessageSpeakerPicker()',ctx);assert.deepEqual([...$('message-speaker-choice').options].map(x=>x.textContent),['First','Second','Player chat (OOC)']);
 ctx.selectedRoom={id:'another'};vm.runInContext('updateMessageSelection()',ctx);assert.equal(ctx.selectedMessageIds.size,0,'selection followed another room');
 console.log('PASS: combined Speaker menu including OOC, scroll/cancel protection, multi-select, keyboard/right-click, narrator restrictions, verified Delete/Undo and character/OOC conversions');
})().catch(e=>{console.error(e);process.exitCode=1;});
