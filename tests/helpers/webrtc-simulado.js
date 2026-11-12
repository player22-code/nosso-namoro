// Synthetic media and peer transport for UI/signaling tests only.
// Does not access hardware, change browser policy or claim end-to-end network coverage.
(()=>{
 let mediaRequests=0;
 function media(video=true){const ctx=new AudioContext(),dest=ctx.createMediaStreamDestination(),tracks=[...dest.stream.getAudioTracks()];if(video){const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const g=canvas.getContext('2d');let frame=0;const paint=()=>{g.fillStyle='#00cc22';g.fillRect(0,0,640,480);g.fillStyle='#fff';g.font='24px sans-serif';g.fillText('Vídeo sintético · teste '+frame++,30,50)};paint();const stream=canvas.captureStream(10),track=stream.getVideoTracks()[0];const timer=setInterval(()=>{if(track.readyState==='ended'){clearInterval(timer);return}paint()},100);tracks.push(track);}return new MediaStream(tracks)}
 Object.defineProperty(window,'mediaRequests',{get:()=>mediaRequests});navigator.mediaDevices.getUserMedia=async args=>{mediaRequests++;return media(!!args.video)};
 class Peer{
 constructor(){this.connectionState='new';this.iceConnectionState='new';this.signalingState='stable';this.localDescription=null;this.remoteDescription=null;this.senders=[];this.remote=null;}
 addTrack(track){const s={track,replaceTrack:async replacement=>{s.track=replacement}};this.senders.push(s);return s}
 getSenders(){return this.senders}async createOffer(){return {type:'offer',sdp:'v=0\r\ns=synthetic-ui-test\r\n'}}async createAnswer(){return {type:'answer',sdp:'v=0\r\ns=synthetic-ui-test\r\n'}}
 async setLocalDescription(d){this.localDescription=new RTCSessionDescription(d);this.signalingState=d.type==='offer'?'have-local-offer':'stable';setTimeout(()=>this.onicecandidate?.({candidate:{toJSON:()=>({candidate:'candidate:1 1 udp 2130706431 127.0.0.1 12345 typ host',sdpMid:'0',sdpMLineIndex:0})}}),0);if(d.type==='answer')this.connected()}
 async setRemoteDescription(d){this.remoteDescription=d;this.signalingState=d.type==='offer'?'have-remote-offer':'stable';if(!this.remote){this.remote=media(this.senders.some(s=>s.track.kind==='video'));for(const track of this.remote.getTracks())this.ontrack?.({track,streams:[this.remote]})}if(d.type==='answer')this.connected()}
 async addIceCandidate(){}connected(){this.connectionState='connected';this.iceConnectionState='connected';setTimeout(()=>this.onconnectionstatechange?.(),0)}close(){this.connectionState='closed';this.remote?.getTracks().forEach(t=>t.stop())}
 }
 window.RTCPeerConnection=Peer;
})();
