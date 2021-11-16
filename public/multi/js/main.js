/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';


const audioInputSelect = document.querySelector('select#audioSource');
const audioOutputSelect = document.querySelector('select#audioOutput');
const videoSelect = document.querySelector('select#videoSource');
const selectors = [audioInputSelect, audioOutputSelect, videoSelect];



var btnRefresh =  document.querySelector('button#refresh_device');

var localVideo = document.querySelector('video#localvideo');
var remoteVideo = document.querySelector('video#remotevideo');

var btnConn =  document.querySelector('button#connserver');
var btnLeave = document.querySelector('button#leave');


var shareDeskBox  = document.querySelector('input#shareDesk');




var pcConfig = {
  'iceServers': [{
    'urls': 'turn:rustling.xyz:3478',
    'credential': "Shage@119cloud",
    'username': "ubuntu"
  }]
};

var localStream = null;
var remoteStream = null;

var pc = null;

var roomid;
var socket = null;

var offerdesc = null;
var state = 'init';










//如果返回的是false说明当前操作系统是手机端，如果返回的是true则说明当前的操作系统是电脑端
function IsPC() {
  var userAgentInfo = navigator.userAgent;
  var Agents = ["Android", "iPhone","SymbianOS", "Windows Phone","iPad", "iPod"];
  var flag = true;

  for (var v = 0; v < Agents.length; v++) {
    if (userAgentInfo.indexOf(Agents[v]) > 0) {
      flag = false;
      break;
    }
  }

  return flag;
}

//如果返回true 则说明是Android  false是ios
function is_android() {
  var u = navigator.userAgent, app = navigator.appVersion;
  var isAndroid = u.indexOf('Android') > -1 || u.indexOf('Linux') > -1; //g
  var isIOS = !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/); //ios终端
  if (isAndroid) {
    //这个是安卓操作系统
    return true;
  }

  if (isIOS) {
    //这个是ios操作系统
    return false;
  }
}

//获取url参数
function getQueryVariable(variable)
{
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
    if(pair[0] == variable){return pair[1];}
  }
  return(false);
}















function sendMessage(roomid, data){

  console.log('send message to other end', roomid, data);
  if(!socket){
    console.log('socket is null');
  }
  socket.emit('message', roomid, data);
}

function conn(){

  socket = io.connect();

  socket.on('joined', (roomid, id) => {
    console.log('receive joined message!', roomid, id);
    state = 'joined'

    //如果是多人的话，第一个人不该在这里创建peerConnection
    //都等到收到一个otherjoin时再创建
    //所以，在这个消息里应该带当前房间的用户数
    //
    //create conn and bind media track
    createPeerConnection();
    bindTracks();

    btnConn.disabled = true;
    btnLeave.disabled = false;

    console.log('receive joined message, state=', state);
  });

  socket.on('otherjoin', (roomid) => {
    console.log('receive joined message:', roomid, state);

    //如果是多人的话，每上来一个人都要创建一个新的 peerConnection
    //
    if(state === 'joined_unbind'){
      createPeerConnection();
      bindTracks();
    }

    state = 'joined_conn';
    call();

    console.log('receive other_join message, state=', state);
  });

  socket.on('full', (roomid, id) => {
    console.log('receive full message', roomid, id);
    hangup();
    closeLocalMedia();
    state = 'leaved';
    console.log('receive full message, state=', state);
    alert('the room is full!');
  });

  socket.on('leaved', (roomid, id) => {
    console.log('receive leaved message', roomid, id);
    state='leaved'
    socket.disconnect();
    console.log('receive leaved message, state=', state);

    btnConn.disabled = false;
    btnLeave.disabled = true;
  });

  socket.on('bye', (room, id) => {
    console.log('receive bye message', roomid, id);
    //state = 'created';
    //当是多人通话时，应该带上当前房间的用户数
    //如果当前房间用户不小于 2, 则不用修改状态
    //并且，关闭的应该是对应用户的peerconnection
    //在客户端应该维护一张peerconnection表，它是
    //一个key:value的格式，key=userid, value=peerconnection
    state = 'joined_unbind';
    hangup();
    offer.value = '';
    answer.value = '';
    console.log('receive bye message, state=', state);
  });

  socket.on('disconnect', (socket) => {
    console.log('receive disconnect message!', roomid);
    if(!(state === 'leaved')){
      hangup();
      closeLocalMedia();

    }
    state = 'leaved';

  });

  socket.on('message', (roomid, data) => {
    console.log('receive message!', roomid, data);

    if(data === null || data === undefined){
      console.error('the message is invalid!');
      return;
    }

    if(data.hasOwnProperty('type') && data.type === 'offer') {

      offer.value = data.sdp;

      pc.setRemoteDescription(new RTCSessionDescription(data));

      //create answer
      pc.createAnswer()
          .then(getAnswer)
          .catch(handleAnswerError);

    }else if(data.hasOwnProperty('type') && data.type == 'answer'){
      answer.value = data.sdp;
      pc.setRemoteDescription(new RTCSessionDescription(data));

    }else if (data.hasOwnProperty('type') && data.type === 'candidate'){
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: data.label,
        candidate: data.candidate
      });
      pc.addIceCandidate(candidate);

    }else{
      console.log('the message is invalid!', data);

    }

  });


  roomid = getQueryVariable('room');
  socket.emit('join', roomid);

  return true;
}





function connSignalServer(){

  //开启本地视频
  start();



  return true;
}

function getMediaStream(stream){

  if(localStream){
    stream.getAudioTracks().forEach((track)=>{
      localStream.addTrack(track);
      stream.removeTrack(track);
    });
  }else{
    localStream = stream;
  }

  localVideo.srcObject = localStream;

  //这个函数的位置特别重要，
  //一定要放到getMediaStream之后再调用
  //否则就会出现绑定失败的情况
  //
  //setup connection
  conn();

  //btnStart.disabled = true;
  //btnCall.disabled = true;
  //btnHangup.disabled = true;
}

function getDeskStream(stream){
  localStream = stream;
}

// function handleError(err){
//   console.error('Failed to get Media Stream!', err);
// }

function shareDesk(){

  if(IsPC()){
    navigator.mediaDevices.getDisplayMedia({video: true})
        .then(getDeskStream)
        .catch(handleError);

    return true;
  }

  return false;

}

function start(){

  if (localStream) {
    localStream.getTracks().forEach(track => {
      track.stop();
    });
  }

  if(!navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia){
    console.error('the getUserMedia is not supported!');

  }else {

    const audioSource = audioInputSelect.value;
    const videoSource = videoSelect.value;

    var constraints;

    if( shareDeskBox.checked && shareDesk()){

      constraints = {
        video: false,
        audio:  {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          deviceId: audioSource ? {exact: audioSource} : undefined
        }
      }

    }else{
      constraints = {
        video: {
          deviceId: videoSource ? {exact: videoSource} : undefined
        },
        audio:  {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          deviceId: audioSource ? {exact: audioSource} : undefined
        }
      }
    }

    navigator.mediaDevices.getUserMedia(constraints)
        .then(getMediaStream)
        .catch(handleError111);
  }

}

function getRemoteStream(e){
  remoteStream = e.streams[0];
  remoteVideo.srcObject = e.streams[0];
}

function handleOfferError(err){
  console.error('Failed to create offer:', err);
}

function handleAnswerError(err){
  console.error('Failed to create answer:', err);
}

function getAnswer(desc){
  pc.setLocalDescription(desc);
  answer.value = desc.sdp;

  //send answer sdp
  sendMessage(roomid, desc);
}

function getOffer(desc){
  pc.setLocalDescription(desc);
  offer.value = desc.sdp;
  offerdesc = desc;

  //send offer sdp
  sendMessage(roomid, offerdesc);

}

function createPeerConnection(){

  //如果是多人的话，在这里要创建一个新的连接.
  //新创建好的要放到一个map表中。
  //key=userid, value=peerconnection
  console.log('create RTCPeerConnection!');
  if(!pc){
    pc = new RTCPeerConnection(pcConfig);

    pc.onicecandidate = (e)=>{

      if(e.candidate) {
        sendMessage(roomid, {
          type: 'candidate',
          label:event.candidate.sdpMLineIndex,
          id:event.candidate.sdpMid,
          candidate: event.candidate.candidate
        });
      }else{
        console.log('this is the end candidate');
      }
    }

    pc.ontrack = getRemoteStream;
  }else {
    console.warning('the pc have be created!');
  }


}

//绑定永远与 peerconnection在一起，
//所以没必要再单独做成一个函数
function bindTracks(){

  console.log('bind tracks into RTCPeerConnection!');

  if( pc === null || pc === undefined) {
    console.error('pc is null or undefined!');
    return;
  }

  if(localStream === null || localStream === undefined) {
    console.error('localstream is null or undefined!');
    return;
  }

  //add all track into peer connection
  localStream.getTracks().forEach((track)=>{
    pc.addTrack(track, localStream);
  });

}

function call(){

  if(state === 'joined_conn'){

    var offerOptions = {
      offerToRecieveAudio: 1,
      offerToRecieveVideo: 1
    }

    pc.createOffer(offerOptions)
        .then(getOffer)
        .catch(handleOfferError);
  }
}

function hangup(){

  if(pc) {

    offerdesc = null;

    pc.close();
    pc = null;
  }

}

function closeLocalMedia(){

  if(localStream && localStream.getTracks()){
    localStream.getTracks().forEach((track)=>{
      track.stop();
    });
  }
  localStream = null;
}

function leave() {

  if(socket){
    socket.emit('leave', roomid); //notify server
  }

  hangup();
  closeLocalMedia();

  offer.value = '';
  answer.value = '';
  btnConn.disabled = false;
  btnLeave.disabled = true;
}





function refresh(){

  navigator.mediaDevices.enumerateDevices()
      .then(gotDevices)
      .catch(handleError);

}



function change_device(){

  if (localStream) {
    leave();
    connSignalServer();
  }


}


























// const gumAudio = document.querySelector('audio.gum');
// gumAudio.addEventListener('play', () => {
//   gumAudio.volume = 0.1;
//   console.log('Audio lowered to reduce feedback from local gUM stream');
// });
// const gumVideo = document.querySelector('video.gum');
// gumVideo.addEventListener('play', () => {
//   gumVideo.volume = 0.1;
//   console.log('Audio lowered to reduce feedback from local gUM stream');
// });


function gotDevices(deviceInfos) {
  const masterOutputSelector = document.createElement('select');

  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'audiooutput') {
      console.info('Found audio output device: ', deviceInfo.label);
      option.text = deviceInfo.label || `speaker ${masterOutputSelector.length + 1}`;
      masterOutputSelector.appendChild(option);
    } else if (deviceInfo.kind === 'audioinput') {
      option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }

  }


  const newOutputSelector = masterOutputSelector.cloneNode(true);
  newOutputSelector.addEventListener('change', changeAudioDestination);
  audioOutputSelect.parentNode.replaceChild(newOutputSelector,
      audioOutputSelect);

}

// navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);

// Attach audio output device to the provided media element using the deviceId.
function attachSinkId(element, sinkId, outputSelector) {
  if (typeof element.sinkId !== 'undefined') {
    element.setSinkId(sinkId)
        .then(() => {
          console.log(`Success, audio output device attached: ${sinkId} to element with ${element.title} as source.`);
        })
        .catch(error => {
          let errorMessage = error;
          if (error.name === 'SecurityError') {
            errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
          }
          console.error(errorMessage);
          // Jump back to first output device in the list as it's the default.
          outputSelector.selectedIndex = 0;
        });
  } else {
    console.warn('Browser does not support output device selection.');
  }
}

function changeAudioDestination(event) {
  const deviceId = event.target.value;
  const outputSelector = event.target;
  // FIXME: Make the media element lookup dynamic.
  const element = event.path[2].childNodes[1];
  attachSinkId(element, deviceId, outputSelector);
}

// function gotStream(stream) {
//   localStream = stream; // make stream available to console
//
//
// }

// function start() {
//   if (localStream) {
//     localStream.getTracks().forEach(track => {
//       track.stop();
//     });
//   }
//   const constraints = {
//     audio: true,
//     video: true
//   };
//   navigator.mediaDevices.getUserMedia(constraints).then(gotStream).catch(handleError);
// }

// start();

function handleError(error) {
  console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

function handleError111(error) {
  console.log('navigator.MediaDevices.getUserMedia error111: ', error.message, error.name);
}






audioInputSelect.onchange = change_device;
// audioOutputSelect.onchange = changeAudioDestination;

videoSelect.onchange = change_device;



btnRefresh.onclick = refresh;

btnConn.onclick = connSignalServer;
btnLeave.onclick = leave;

refresh();
