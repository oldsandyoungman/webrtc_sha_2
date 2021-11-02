'use strict'



var http = require('http');
var https = require('https');
var fs = require('fs');

var express = require('express');
var serveIndex = require('serve-index');

var socketIo = require('socket.io');


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
var io = socketIo.listen(https_server);

io.sockets.on('connection', (socket)=>{
	
	socket.on('join', (room)=>{
		socket.join(room);
		var myroom = io.sockets.adapter.rooms[room];
		
		var users = Objects.keys(myRoom.sockets).length;

		//io.in(room).emit('joined', room, socket.id);

		socket.broadcast.emit('joined', room, socket.id);

		
	});	

	socket.on('leave', (room)=>{
		var myroom = io.sockets.adapter.rooms[room];
		var users = Objects.keys(myRoom.sockets).length;
		

		socket.leave(room);
		//io.in(room).emit('joined', room, socket.id);

		socket.broadcast.emit('leaved', room, socket.id);

		
	});



});

https_server.listen(4433, '0.0.0.0');













