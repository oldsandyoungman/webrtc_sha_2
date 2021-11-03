'use strict'



var http = require('http');
var https = require('https');
var fs = require('fs');

var express = require('express');
var serveIndex = require('serve-index');

var socketIo = require('socket.io');


var USERCOUNT = 3;











var app = express();
app.use(serveIndex('./public'));
app.use(express.static('./public'));

var http_server = http.createServer(app);
http_server.listen(8083, '0.0.0.0');


var options = {
	key  : fs.readFileSync('./cert/rustling.xyz.key'),
	cert : fs.readFileSync('./cert/rustling.xyz.pem'),
};


var https_server = https.createServer(options, app);
var io_sha = socketIo.listen(https_server);

io_sha.sockets.on('connection', (socket)=>{
	
	socket.on('join', (room)=>{
		socket.join(room);

		var myRoom = io_sha.sockets.adapter.rooms[room];
		
		var users = Object.keys(myRoom.sockets).length;
		
		if(users < USERCOUNT){

			socket.emit('joined', room, socket.id);	

			if(users > 1){
				
				socket.to(room).emit('otherjoin', room);

			}

		}else{
			socket.leave(room);
			socket.emit('full', room, socket.id);
		}


		//io_sha.in(room).emit('joined', room, socket.id);

		//socket.broadcast.emit('joined', room, socket.id);

		console.log('joined sha');
		
	});	

	socket.on('leave', (room)=>{
		var myRoom = io_sha.sockets.adapter.rooms[room];
		//var users = Object.keys(myRoom.sockets).length;
		
		//io.in(room).emit('leaved', room, socket.id);
		socket.emit('leaved', room, socket.id);
		socket.to(room).emit('bye', room, socket.id);
		//socket.broadcast.emit('leaved', room, socket.id);

		
		//socket.leave(room);
	});

	socket.on('message', (room, data)=>{
		//var myroom = io.sockets.adapter.rooms[room];

		//io_sha.in(room).emit('message', room, data);

		//socket.broadcast.emit('message', room, data);


		socket.to(room).emit('message', room, data);

		console.log(data);

		
	});




});

https_server.listen(4433, '0.0.0.0');













