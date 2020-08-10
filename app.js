const crypto = require('crypto');
const express = require('express');
const fs = require('fs')
const http = require('http');

var app = express();
var httpServer = http.createServer(app);
var io = require('socket.io').listen(httpServer);

httpServer.listen(8080, '0.0.0.0', () => {
	console.log('Chat is running... ');
});

app.use(express.static('public'));

// app.set('view engine', 'ejs');

// app.get('/', (req, res){
	// res.sendFile(__dirname + '/public/index.html');
// });

var rooms = new Map();
var sockets = new Map();
var users = new Map();

io.on('connection', (socket) => {
	socket.on('disconnect', () => {

	});

	socket.on('message', (encyptedMessage) => {
		
	});

	socket.on('name', (name) => {
		if (name.trim() && socket.publicKey && !socket.name) {
			if (!users[name]) {
				users[name] = [];
			}
			socket.name = name;
			users[name].push(socket.publicKey);
		}
	});

	socket.on('newChat', (publicKeys, secretKey, usernames) => {
		if (!socket.publicKey) {
			return;
		}

		for (publicKey of publicKeys) {
			if (sockets[publicKey].length === 1) {
				sockets[publicKey]
			}
		}
	});

	socket.on('publicKey', (publicKey) => {
		if (!socket.publicKey) {
			if (!sockets[publicKey]) {
				sockets[publicKey] = [];
			}

			socket.publicKey = publicKey;
			sockets[publicKey].push(socket);
		}
	});
});
