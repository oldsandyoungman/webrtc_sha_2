'use strict'

var localVideo = document.querySelector('video#localvideo');
// var remoteVideo = document.querySelector('video#remotevideo');
// var remoteVideo2 = document.querySelector('video#remotevideo2');
// var remoteVideo3 = document.querySelector('video#remotevideo3');

var btnConn =  document.querySelector('button#connserver');
var btnLeave = document.querySelector('button#leave');

// var optBw = document.querySelector('select#bandwidth');

var chat = document.querySelector('textarea#chat');
var send_txt = document.querySelector('textarea#sendtxt');
var btnSend = document.querySelector('button#send');


var pcConfig = {
	'iceServers': [{
		'urls': 'turn:rustling.xyz:3478',
		'credential': "Shage@119cloud",
		'username': "ubuntu"
	}]
};


var localStream = null;
var remoteStream = null;
var remoteStream2 = null;
var remoteStream3 = null;

var remoteStreamMap = new Map();
remoteStreamMap.set(0, remoteStream);
remoteStreamMap.set(1, remoteStream2);
remoteStreamMap.set(2, remoteStream3);

var remoteVideoMap = new Map();
remoteVideoMap.set(0, document.querySelector('video#remotevideo'));
remoteVideoMap.set(1, document.querySelector('video#remotevideo2'));
remoteVideoMap.set(2, document.querySelector('video#remotevideo3'));

var pcMap = new Map();

var roomid;

var myid;

var socket = null;

var offerdesc = null;
var state = 'init';

var now_number_of_users = 0;


function sendMessage(roomid, data){

	console.log('send message to other end', roomid, data);
	if(!socket){
		console.log('socket is null');
	}
	socket.emit('message', roomid, data);
}









function getRemoteStream(e){

	remoteStreamMap.set(now_number_of_users, e.streams[0]);

	remoteVideoMap.get(now_number_of_users).srcObject = e.streams[0];

}




function createPeerConnection(roomid, id){

	//如果是多人的话，在这里要创建一个新的连接.
	//新创建好的要放到一个map表中。
	//key=userid, value=peerconnection
	console.log('create RTCPeerConnection!');

	myMap.set(id, new RTCPeerConnection(pcConfig));

	var pc = myMap.get(id);

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

	// pc.ondatachannel = e=> {
	// 	if(!dc){
	// 		dc = e.channel;
	// 		dc.onmessage = receivemsg;
	// 		dc.onopen = dataChannelStateChange;
	// 		dc.onclose = dataChannelStateChange;
	// 	}
	//
	// }

	pc.ontrack = getRemoteStream;

	now_number_of_users++;


}


function bindTracks(){

	console.log('bind tracks into RTCPeerConnection!');

	if( pc === null && localStream === undefined) {
		console.error('pc is null or undefined!');
		return;
	}

	if(localStream === null && localStream === undefined) {
		console.error('localstream is null or undefined!');
		return;
	}

	//add all track into peer connection
	localStream.getTracks().forEach((track)=>{
		pc.addTrack(track, localStream);
	});

}


function getOffer(desc){

	var pc = myMap.get(id);

	pc.setLocalDescription(desc);
	offerdesc = desc;

	//send offer sdp
	sendMessage(roomid, offerdesc);

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
		createPeerConnection(roomid, id);
		bindTracks();

		btnConn.disabled = true;
		btnLeave.disabled = false;

		console.log('receive joined message, state=', state);
	});

	socket.on('otherjoin', (roomid, id) => {
		console.log('receive joined message:', roomid, state);

		//如果是多人的话，每上来一个人都要创建一个新的 peerConnection
		//
		if(state === 'joined_unbind'){
			createPeerConnection();
			bindTracks();
		}

		// //create data channel for transporting non-audio/video data
		// dc = pc.createDataChannel('chatchannel');
		// dc.onmessage = receivemsg;
		// dc.onopen = dataChannelStateChange;
		// dc.onclose = dataChannelStateChange;

		state = 'joined_conn';
		call();

		console.log('receive other_join message, state=', state);
	});

	socket.on('full', (roomid, id) => {
		console.log('receive full message', roomid, id);
		socket.disconnect();
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
		optBw.disabled = true;
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
		console.log('receive bye message, state=', state);
	});

	socket.on('disconnect', (socket) => {
		console.log('receive disconnect message!', roomid);
		if(!(state === 'leaved')){
			hangup();
			closeLocalMedia();

		}
		state = 'leaved';

		btnConn.disabled = false;
		btnLeave.disabled = true;
		optBw.disabled = true;

	});

	socket.on('message', (roomid, data) => {
		console.log('receive message!', roomid, data);

		if(data === null || data === undefined){
			console.error('the message is invalid!');
			return;
		}

		if(data.hasOwnProperty('type') && data.type === 'offer') {

			pc.setRemoteDescription(new RTCSessionDescription(data));
			//create answer
			pc.createAnswer()
				.then(getAnswer)
				.catch(handleAnswerError);

		}else if(data.hasOwnProperty('type') && data.type === 'answer'){
			optBw.disabled = false
			pc.setRemoteDescription(new RTCSessionDescription(data));

		}else if (data.hasOwnProperty('type') && data.type === 'candidate'){
			var candidate = new RTCIceCandidate({
				sdpMLineIndex: data.label,
				candidate: data.candidate
			});
			pc.addIceCandidate(candidate)
				.then(()=>{
					console.log('Successed to add ice candidate');
				})
				.catch(err=>{
					console.error(err);
				});

		}else{
			console.log('the message is invalid!', data);

		}

	});


	roomid = '111111';
	socket.emit('join', roomid);

	return true;
}








function getMediaStream(stream){

	localStream = stream;
	localVideo.srcObject = localStream;

	//这个函数的位置特别重要，
	//一定要放到getMediaStream之后再调用
	//否则就会出现绑定失败的情况

	//setup connection
	conn();

}


function handleError(err){
	console.error('Failed to get Media Stream!', err);
}


function start(){

	if(!navigator.mediaDevices ||
		!navigator.mediaDevices.getUserMedia){
		console.error('the getUserMedia is not supported!');
	}else {

		var constraints = {
			video: true,
			audio: true
		}

		navigator.mediaDevices.getUserMedia(constraints)
			.then(getMediaStream)
			.catch(handleError);
	}

}



function connSignalServer(){

	//开启本地视频
	start();

	return true;
}



btnConn.onclick = connSignalServer
btnLeave.onclick = leave;













