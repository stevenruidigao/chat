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

app.get('/room/:ID', (req, res) => {
	res.sendFile(__dirname + '/public/chat.html');
});

var rooms = new Map();
var sockets = new Map();
var users = new Map();

io.on('connection', (socket) => {
	socket.on('disconnect', () => {

	});

	socket.on('message', (roomName, encyptedMessage) => {
		io.to(roomName).emit('message', encryptedMessage);
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

	socket.on('newRoom', (roomName, publicKeys, secretKeys, usernames) => {
		if (rooms[roomName] || !socket.publicKey) {
			socket.emit('error');
			return;
		}

		rooms[roomName] = {
			chat: chat,
			name: roomName,
			publicKeys: publicKeys,
			secretKeys: secretKeys,
			usernames: usernames
		};

		for (i = 0; i < publicKeys.length; i ++) {
			publicKey = publicKeys[i];

			if (sockets[publicKey].length === 1) {
				socket = sockets[publicKey];

			} else if (usernames) {
				for (socket of sockets[publicKey]) {
					if (socket.name === usernames[i]) {
						break;
					}

					socket = null;
				}

			} else {
				socket.emit('error');
			}

			if (socket) {
				socket.join(roomName);
				socket.emit('invite', roomName, secretKey[i]);
			}
		}
	});

	socket.on('joinRoom', (roomName) => {
		socket.join(roomName);
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
