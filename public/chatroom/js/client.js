'use strict'

var userName = document.querySelector('input#username');
var inputRoom = document.querySelector('input#room');
var btnConnect = document.querySelector('button#connect');
var btnLeave = document.querySelector('button#leave');
var outputArea = document.querySelector('textarea#output');
var inputArea = document.querySelector('textarea#input');
var btnSend = document.querySelector('button#send');


var socket;
var room;

btnConnect.onclick = ()=>{
	socket = io.connect();
	
	socket.on('joined', (room, id)=>{
		

		btnConnect.disabled = true;
		inputArea.disabled = false;
		btnSend.disabled = false;
		btnLeave.disabled = false;


	});	

	socket.on('leaved', (room, id)=>{
		

		btnConnect.disabled = false;
		inputArea.disabled = true;
		btnSend.disabled = true;
		btnLeave.disabled = true;

		socket.disconnect();


	});

	socket.on('message', (room, data)=>{
		
		console.log(data);
		outputArea.value = outputArea.value + data + '\r';
		outputArea.scrollTop = outputArea.scrollHeight;

	});

	room = inputRoom.value;
	socket.emit('join', room);

	
}



btnSend.onclick = ()=>{

	var data = inputArea.value;
	data = userName.value + ':' + data;

	socket.emit('message', room, data);

	inputArea.value = '';


}



btnLeave.onclick = ()=>{

	room = inputRoom.value;

	socket.emit('leave', room);

}







