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
	res.sendFile(__dirname + '/public/index.html');
});

var rooms = new Map();
var sockets = new Map();
var users = new Map();

io.on('connection', (socket) => {
	socket.emit('connected');

	socket.on('disconnect', () => {

	});

	socket.on('joinRoom', (roomName) => {
		socket.join(roomName);
	});

	socket.on('message', (roomName, encryptedMessage) => {
		io.to(roomName).emit('message', encryptedMessage);
	});

	socket.on('name', (name) => {
		if (name.trim() && socket.publicRSAOAEPKey && !socket.name) {
			if (!users[name]) {
				users[name] = [];
			}
			socket.name = name;
			users[name].push(socket.publicRSAOAEPKey);
		}
	});

	socket.on('newRoom', (roomName, publicRSAOAEPKeys, secretAESCBCKeys, usernames) => {
//		console.log(socket.publicRSAOAEPKey);

		if (!socket.publicRSAOAEPKey) {
			console.log('Error1', socket);
			socket.emit('checkPublicRSAOAEPKey');
			return;
		}

		if (rooms[roomName]) {
			console.log('Error2');
			socket.emit('checkName');
			return;
		}

		rooms[roomName] = {
			chat: [],
			name: roomName,
			publicRSAOAEPKeys: publicRSAOAEPKeys,
			secretAESCBCKeys: secretAESCBCKeys,
			usernames: usernames
		};

		for (i = 0; i < publicRSAOAEPKeys.length; i ++) {
			publicRSAOAEPKey = publicRSAOAEPKeys[i];

//			console.log(sockets, publicRSAOAEPKey);

			if (sockets[publicRSAOAEPKey] && sockets[publicRSAOAEPKey].length === 1) {
				socket = sockets[publicRSAOAEPKey][0];

			} else if (usernames) {
				for (socket of sockets[publicRSAOAEPKey]) {
					if (socket.name === usernames[i]) {
						break;
					}

					socket = null;
				}

			} else {
				console.log('Error3', publicRSAOAEPKey);
				io.to(publicRSAOAEPKey).emit('invite', roomName, secretAESCBCKeys[i]);
				socket.emit('userNotFound');
				return;
			}

			if (socket) {
				socket.join(roomName);
				socket.emit('invite', roomName, secretAESCBCKeys[i]);
			}
		}
	});

	socket.on('publicRSAOAEPKey', (publicRSAOAEPKey) => {
		console.log(publicRSAOAEPKey);
		if (!socket.publicRSAOAEPKey) {
			if (!sockets[publicRSAOAEPKey]) {
				sockets[publicRSAOAEPKey] = [];
			}

			socket.publicRSAOAEPKey = publicRSAOAEPKey;
			sockets[publicRSAOAEPKey].push(socket);
			socket.join(publicRSAOAEPKey, () => {
				const rooms = Object.keys(socket.rooms);
				console.log(rooms);
			});
		}
	});
});
