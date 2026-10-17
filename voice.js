/* Room voice trial: opt-in microphone, mute keeps receiving, no recording. */
(() => {
 'use strict';
 class PathsVoice {
  constructor({rpc,getRoom,button,status,host,rtc=globalThis.RTCPeerConnection,media=globalThis.navigator?.mediaDevices,iceServers=[{urls:'stun:stun.l.google.com:19302'}]}){
   Object.assign(this,{rpc,getRoom,button,status,host,rtc,media,iceServers});this.links=new Map();this.epoch=0;this.muted=true;this.button.onclick=()=>this.toggle();this.paint('off');
  }
  paint(state,message=''){
   this.button.dataset.state=state;this.button.setAttribute('aria-pressed',String(state==='live'));this.button.setAttribute('aria-busy',String(state==='connecting'));
   const labels={off:'Microphone off. Click to join room voice.',muted:'Microphone muted. Click to transmit; you can still hear others.',connecting:'Connecting room voice; microphone not transmitting yet.',live:'Microphone on. Click to mute.',waiting:'Microphone armed; waiting for another voice participant.',error:'Voice connection failed. Click to retry.'};
   this.button.setAttribute('aria-label',labels[state]);this.button.title=message||labels[state];this.status.textContent=message||((state==='waiting')?'Voice: waiting for others':state==='connecting'?'Voice: connecting…':state==='live'?'Voice: microphone on':state==='muted'?'Voice: muted':'');this.status.classList.toggle('hidden',!this.status.textContent);
  }
  update(){
   if(!this.peer)return;
   const connected=[...this.links.values()].filter(x=>x.pc.connectionState==='connected').length;
   const failed=[...this.links.values()].some(x=>x.pc.connectionState==='failed');
   if(failed&&!connected){this.leave('Voice could not connect. This network may need a relay service.');return;}
   // Audio is enabled only once at least one recipient is actually connected.
   for(const track of this.stream?.getAudioTracks()||[])track.enabled=!this.muted&&connected>0;
   this.paint(this.muted?'muted':connected?'live':failed?'error':this.links.size?'connecting':'waiting',failed?'Voice could not reach one or more players. This network may need a relay service.':'');
  }
  async call(operation,extra={},session=this){
   const {data,error}=await this.rpc('voice_exchange',{p_room:session.room,p_operation:operation,p_peer:session.peer||null,...extra});if(error)throw error;return data;
  }
  async toggle(){
   if(this.starting)return;
   if(this.peer){this.muted=!this.muted;this.update();return;}
   const room=this.getRoom();if(!room){this.paint('error','Enter an ongoing room first.');return;}
   if(!this.rtc||!this.media?.getUserMedia){this.paint('error','Voice is unavailable in this browser.');return;}
   const epoch=++this.epoch;this.starting=true;this.paint('connecting');let acquired=null;
   try{
    acquired=await this.media.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    for(const track of acquired.getAudioTracks())track.enabled=false;
    if(epoch!==this.epoch||this.getRoom()!==room){acquired.getTracks().forEach(t=>t.stop());return;}
    this.room=room;this.stream=acquired;const joined=await this.call('join');
    if(epoch!==this.epoch||this.getRoom()!==room){acquired.getTracks().forEach(t=>t.stop());if(joined?.peer)this.call('leave',{}, {room,peer:joined.peer}).catch(()=>{});return;}
    this.peer=joined.peer;this.muted=false;this.stream.getAudioTracks().forEach(t=>t.onended=()=>this.leave('Microphone disconnected.'));await this.poll();if(epoch!==this.epoch)return;
    this.timer=setInterval(()=>this.poll(),3000);this.update();
   }catch(error){if(epoch===this.epoch)this.leave(error.name==='NotAllowedError'?'Microphone permission was denied.':error.message||'Could not connect voice.');else acquired?.getTracks().forEach(t=>t.stop());}
   finally{if(epoch===this.epoch)this.starting=false;}
  }
  async signal(target,payload){if(!this.peer)return;await this.call('signal',{p_target:target,p_payload:payload});}
  link(id){
   if(this.links.has(id))return this.links.get(id);
   const pc=new this.rtc({iceServers:this.iceServers}),entry={pc,candidates:[],audio:null};this.links.set(id,entry);
   for(const track of this.stream.getAudioTracks())pc.addTrack(track,this.stream);
   pc.onicecandidate=event=>{if(event.candidate)this.signal(id,{type:'ice',candidate:event.candidate.toJSON()}).catch(e=>this.leave(e.message));};
   entry.timeout=setTimeout(()=>{if(this.links.get(id)===entry&&pc.connectionState!=='connected')this.leave('Voice connection timed out. This network may need a relay service.');},35000);
   pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected')clearTimeout(entry.timeout);this.update();};
   pc.ontrack=event=>{if(!event.streams[0])return;if(!entry.audio){entry.audio=document.createElement('audio');entry.audio.autoplay=true;entry.audio.setAttribute('playsinline','');this.host.append(entry.audio);}entry.audio.srcObject=event.streams[0];entry.audio.play().catch(()=>{this.status.textContent='Tap here to allow voice playback.';this.status.classList.remove('hidden');this.status.onclick=()=>{for(const e of this.links.values())e.audio?.play().catch(()=>{});this.status.onclick=null;this.update();};});};
   return entry;
  }
  async poll(){
   if(this.polling||!this.peer)return;const epoch=this.epoch;this.polling=true;
   try{
    if(this.getRoom()!==this.room){this.leave();return;}
    const result=await this.call('poll');if(epoch!==this.epoch)return;
    const active=new Set(result.peers.map(p=>p.id));
    for(const [id,e]of this.links)if(!active.has(id)){clearTimeout(e.timeout);e.pc.close();e.audio?.remove();this.links.delete(id);}
    for(const p of result.peers)if(this.peer<p.id&&!this.links.has(p.id)){const {pc}=this.link(p.id);await pc.setLocalDescription(await pc.createOffer());if(epoch!==this.epoch)return;await this.signal(p.id,{type:'offer',sdp:pc.localDescription.sdp});}
    for(const signal of result.signals){if(epoch!==this.epoch)return;if(!active.has(signal.sender))continue;const entry=this.link(signal.sender),{pc}=entry,payload=signal.payload;
     if(payload.type==='ice'){if(pc.remoteDescription)await pc.addIceCandidate(payload.candidate);else entry.candidates.push(payload.candidate);continue;}
     await pc.setRemoteDescription({type:payload.type,sdp:payload.sdp});for(const candidate of entry.candidates.splice(0))await pc.addIceCandidate(candidate);
     if(payload.type==='offer'){await pc.setLocalDescription(await pc.createAnswer());if(epoch!==this.epoch)return;await this.signal(signal.sender,{type:'answer',sdp:pc.localDescription.sdp});}
    }
    this.update();
   }catch(error){if(epoch===this.epoch)this.leave(error.message||'Voice connection lost.');}
   finally{this.polling=false;}
  }
  leave(message=''){
   const previous={peer:this.peer,room:this.room};++this.epoch;clearInterval(this.timer);this.timer=null;this.peer=null;this.starting=false;this.muted=true;
   for(const track of this.stream?.getTracks()||[]){track.onended=null;track.stop();}this.stream=null;
   for(const entry of this.links.values()){clearTimeout(entry.timeout);entry.pc.onicecandidate=null;entry.pc.onconnectionstatechange=null;entry.pc.close();entry.audio?.remove();}this.links.clear();this.status.onclick=null;
   if(previous.peer)this.call('leave',{},previous).catch(()=>{});this.paint(message?'error':'off',message);
  }
 }
 globalThis.PathsVoice=PathsVoice;
})();
