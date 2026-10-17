const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{JSDOM}=require('/tmp/paths-qa/node_modules/jsdom');
const {document}=new JSDOM('<button id="mic"></button><button id="status"></button><div id="audio"></div>').window;
class PC{constructor(){this.connectionState='new';}addTrack(){}async createOffer(){return {type:'offer',sdp:'offer'};}async setLocalDescription(d){this.localDescription=d;}async setRemoteDescription(d){this.remoteDescription=d;}async createAnswer(){return {type:'answer',sdp:'answer'};}async addIceCandidate(){}close(){this.closed=true;}}
const ctx=vm.createContext({document,console,setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){}});vm.runInContext(fs.readFileSync('voice.js','utf8'),ctx);
const track={enabled:true,stop(){this.stopped=true;}},stream={getTracks:()=>[track],getAudioTracks:()=>[track]};let room='room',fail=false;
const rpc=async(_,p)=>{if(fail)return {error:{message:'Active room membership required'}};return {data:p.p_operation==='join'?{peer:'a'}:p.p_operation==='poll'?{peers:[{id:'b',name:'Friend'}],signals:[]}:{}};};
const create=media=>new ctx.PathsVoice({rpc,getRoom:()=>room,button:document.getElementById('mic'),status:document.getElementById('status'),host:document.getElementById('audio'),rtc:PC,media});
(async()=>{
 const voice=create({getUserMedia:async()=>stream});await voice.toggle();assert.equal(track.enabled,false,'transmitted before recipient connected');assert.equal(voice.button.dataset.state,'connecting');
 const remote=voice.links.get('b');remote.pc.connectionState='connected';voice.update();assert.equal(track.enabled,true);assert.equal(voice.button.dataset.state,'live');assert.equal(voice.button.getAttribute('aria-pressed'),'true');
 await voice.toggle();assert.equal(track.enabled,false);assert.equal(voice.button.dataset.state,'muted');assert.equal(remote.pc.closed,undefined,'mute stopped incoming audio');await voice.toggle();assert.equal(track.enabled,true);
 room='new-room';await voice.poll();assert.equal(track.stopped,true);assert.equal(voice.peer,null);assert.equal(remote.pc.closed,true);
 const denied=create({getUserMedia:async()=>{throw Object.assign(Error('denied'),{name:'NotAllowedError'});}});await denied.toggle();assert.equal(denied.button.dataset.state,'error');assert.equal(denied.peer,null);
 let grant;const pending=create({getUserMedia:()=>new Promise(r=>grant=r)});const starting=pending.toggle();pending.leave();track.stopped=false;grant(stream);await starting;assert.equal(track.stopped,true,'late microphone permission leaked after leaving');
 fail=true;const kicked=create({getUserMedia:async()=>stream});await kicked.toggle();assert.equal(kicked.peer,null);assert.equal(kicked.button.dataset.state,'error');assert.equal(track.stopped,true);
 console.log('PASS: no transmit before connection, click mute/unmute, listening retained, room-change cleanup, permission denial, late permission cleanup and membership failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
