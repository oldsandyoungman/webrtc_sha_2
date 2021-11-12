'use strict'

var audioSource  = document.querySelector("select#audioSource");
var audioOutput  = document.querySelector("select#audioOutput");
var videoSource  = document.querySelector("select#videoSource");

var localVideo = document.querySelector('video#localvideo');
var remoteVideo = document.querySelector('video#remotevideo');

var btnOpen =  document.querySelector('button#open_video_audio');
var btnConn =  document.querySelector('button#connserver');
var btnLeave = document.querySelector('button#leave');

var offer = document.querySelector('textarea#offer');
var answer = document.querySelector('textarea#answer');

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
	// conn();

	//btnStart.disabled = true;
	//btnCall.disabled = true;
	//btnHangup.disabled = true;

	btnConn.disabled = false;

}

function open_camera_audio(){

	if(!navigator.mediaDevices ||
		!navigator.mediaDevices.getUserMedia){
		console.error('the getUserMedia is not supported!');

	}else {

		var constraints;

		if( shareDeskBox.checked && shareDesk()){

			constraints = {
				video: false,
				audio:  {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			}

		}else{
			constraints = {
				video: {
					width: 640,
					height: 480,
					frameRate:15,
					facingMode: 'enviroment',
					deviceId : deviceId ? {exact:deviceId} : undefined
				},
				audio:  {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			}
		}

		navigator.mediaDevices.getUserMedia(constraints)
			.then(getMediaStream)
			.catch(handleError);
	}
}


function gotDevices(deviceInfos){

	audioSource.options.length = 0;
	audioOutput.options.length = 0;
	videoSource.options.length = 0;

	// var n0 = audioSource.children.length;
	// while (n0-->0){
	// 	audioSource.removeChild(0);
	// }
	// var n1 = audioOutput.children.length;
	// while (n1-->0){
	// 	audioOutput.removeChild(0);
	// }
	// var n2 = videoSource.children.length;
	// while (n2-->0){
	// 	videoSource.removeChild(0);
	// }

	deviceInfos.forEach( function(deviceInfo){
		console.log(deviceInfo.kind + ": label = "
			+ deviceInfo.label + ": id = "
			+ deviceInfo.deviceId + ": groupId = "
			+ deviceInfo.groupId);
		var option = document.createElement('option');
		option.text = deviceInfo.label;
		option.value = deviceInfo.deviceId;
		if(deviceInfo.kind === 'audioinput'){
			audioSource.appendChild(option);
		}else if(deviceInfo.kind === 'audiooutput'){
			audioOutput.appendChild(option);
		}else if(deviceInfo.kind === 'videoinput'){
			videoSource.appendChild(option);
		}
	});

}

function handleError(err){
	console.error('Failed to get Media Stream!', err);
}

function init_sha(){
	if(!navigator.mediaDevices ||
		!navigator.mediaDevices.enumerateDevices){
		console.log('enumerateDevices is not supported!');
	}else {
		navigator.mediaDevices.enumerateDevices()
			.then(gotDevices)
			.catch(handleError);
	}
}




init_sha()

videoSource.onchange = init_sha;

btnOpen.onclick = open_camera_audio
btnConn.onclick = conn
btnLeave.onclick = leave;



