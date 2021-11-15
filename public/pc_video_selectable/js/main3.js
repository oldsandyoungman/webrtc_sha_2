'use strict'

const audioInputSelect = document.querySelector('select#audioSource');
const audioOutputSelect = document.querySelector('select#audioOutput');
const videoSelect = document.querySelector('select#videoSource');
const selectors = [audioInputSelect, audioOutputSelect, videoSelect];

// audioOutputSelect.disabled = !('sinkId' in HTMLMediaElement.prototype);

var localVideo = document.querySelector('video#localvideo');
var remoteVideo = document.querySelector('video#remotevideo');

var btnRefresh =  document.querySelector('button#refresh_device');
var btnConn =  document.querySelector('button#connserver');
var btnLeave = document.querySelector('button#leave');


var pcConfig = {
	'iceServers': [{
		'urls': 'turn:rustling.xyz:3478',
		'credential': "Shage@119cloud",
		'username': "ubuntu"
	}]
};

var constraints = null;

var localStream = null;
var remoteStream = null;

var pc = null;

var roomid;
var socket = null;

var offerdesc = null;
var state = 'init';



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


function handleOfferError(err){
	console.error('Failed to create offer:', err);
}

function handleAnswerError(err){
	console.error('Failed to create answer:', err);
}


function sendMessage(roomid, data){

	console.log('send message to other end', roomid, data);
	if(!socket){
		console.log('socket is null');
	}
	socket.emit('message', roomid, data);
}







function connSignalServer(){

	if (localStream==null){
		start();
	}
	conn();

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
		createPeerConnection_bindTracks();
		// bindTracks();

		btnConn.disabled = true;
		btnLeave.disabled = false;
		console.log('receive joined message, state=', state);
	});

	socket.on('otherjoin', (roomid) => {
		console.log('receive joined message:', roomid, state);

		//如果是多人的话，每上来一个人都要创建一个新的 peerConnection
		//
		if(state === 'joined_unbind'){
			createPeerConnection_bindTracks();
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
		// offer.value = '';
		// answer.value = '';
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

			// offer.value = data.sdp;

			pc.setRemoteDescription(new RTCSessionDescription(data));

			//create answer
			pc.createAnswer()
				.then(getAnswer)
				.catch(handleAnswerError);

		}else if(data.hasOwnProperty('type') && data.type === 'answer'){
			// answer.value = data.sdp;
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


function createPeerConnection_bindTracks(){

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


		//add all track into peer connection
		localStream.getTracks().forEach((track)=>{
			pc.addTrack(track, localStream);
		});


	}else {
		console.warning('the pc have be created!');
	}

}

function getRemoteStream(e){
	remoteStream = e.streams[0];
	remoteVideo.srcObject = e.streams[0];
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

function getOffer(desc){
	pc.setLocalDescription(desc);
	// offer.value = desc.sdp;
	offerdesc = desc;

	//send offer sdp
	sendMessage(roomid, offerdesc);

}

function getAnswer(desc){
	pc.setLocalDescription(desc);
	// answer.value = desc.sdp;

	//send answer sdp
	sendMessage(roomid, desc);
}











function leave() {

	if(socket){
		socket.emit('leave', roomid); //notify server
	}

	hangup();
	closeLocalMedia();

	// offer.value = '';
	// answer.value = '';
	btnConn.disabled = false;
	btnLeave.disabled = true;
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















function handleError(err){
	console.error('Failed to get Media Stream!', err);
}

function gotDevices(deviceInfos) {
	// Handles being called several times to update labels. Preserve values.
	const values = selectors.map(select => select.value);
	selectors.forEach(select => {
		while (select.firstChild) {
			select.removeChild(select.firstChild);
		}
	});
	for (let i = 0; i !== deviceInfos.length; ++i) {
		const deviceInfo = deviceInfos[i];
		const option = document.createElement('option');
		option.value = deviceInfo.deviceId;
		if (deviceInfo.kind === 'audioinput') {
			option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
			audioInputSelect.appendChild(option);
		} else if (deviceInfo.kind === 'audiooutput') {
			option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
			audioOutputSelect.appendChild(option);
		} else if (deviceInfo.kind === 'videoinput') {
			option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
			videoSelect.appendChild(option);
		} else {
			console.log('Some other kind of source/device: ', deviceInfo);
		}
	}
	selectors.forEach((select, selectorIndex) => {
		if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
			select.value = values[selectorIndex];
		}
	});
}


function gotStream(stream) {
	localStream = stream; // make stream available to console
	localVideo.srcObject = stream;
	// Refresh button list in case labels have become available
	return navigator.mediaDevices.enumerateDevices();
}


function start() {

	// localStream = null;
	// localVideo.srcObject = null;

	// if (btnConn.disabled === true){
	// 	leave();
	// 	btnConn.disabled = true;
	// 	btnLeave.disabled = false;
	// }

	// if (localStream) {
	// 	localStream.getTracks().forEach(track => {
	// 		track.stop();
	// 	});
	// }

	const audioSource = audioInputSelect.value;
	const videoSource = videoSelect.value;
	constraints = {
		audio: {
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: true,
			deviceId: audioSource ? {exact: audioSource} : undefined
		},
		video: {
			deviceId: videoSource ? {exact: videoSource} : undefined
		}
	};

	if(!navigator.mediaDevices ||
		!navigator.mediaDevices.getUserMedia){
		console.error('the getUserMedia is not supported!');

	}else {

		navigator.mediaDevices.getUserMedia(constraints).then(gotStream).then(gotDevices).catch(handleError);

	}
	// if (btnConn.disabled === true){
	// 	conn();
	// }


}


// function init(deviceInfos) {
// 	gotDevices(deviceInfos);
// 	start();
// }


start();


// navigator.mediaDevices.enumerateDevices().then(init).catch(handleError);



// audioInputSelect.onchange = start;
// audioOutputSelect.onchange = changeAudioDestination;
// videoSelect.onchange = start;


// btnRefresh.onclick = func_refresh
btnConn.onclick = connSignalServer
btnLeave.onclick = leave;