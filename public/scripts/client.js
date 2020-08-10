var socket = io.connect();
var rooms = new Map();

if (window.location.pathname.includes('room') socket.emit('joinRoom', );

socket.on('connected', (uuid) => {
	var id = uuid;
	console.log('Connected successfully to the socket.io server. My server side ID is ' + id);
});

socket.on('invite', (roomName, secretKey) => {
	rooms[roomName] = crypto.subtle.decrypt({
		name: 'RSA-OAEP'
	}, getKeys().privateKey, secretKey);
}

socket.on('message', (message, roomName) => {
	message = crypto.subtle.decrypt({
		name: 'AES-CBC'
	}, rooms[roomName], meessage);

	var messages = document.getElementsByClassName('messages')[0];
	var autoScroll = messages.scrollHeight - messages.scrollTop < messages.clientHeight + 20;
	var messageBox = document.createElement('P');
	var text = document.createTextNode(message);
	messageBox.appendChild(text);
	messages.appendChild(messageBox);

	if (autoScroll) {
		messages.scrollTop = messages.scrollHeight;
	}
});

function createNewChat() {
	
}

function loadCookies() {
	if (document.cookie != '' && document.cookie.split('username=').length >= 2) {
		console.log(document.cookie);
		name(document.cookie.split('username=')[1].split(';')[0]);
		hideNamer();
	}
}

function generateNewRSAKeys() {
	RSAKeys = crypto.subtle.generateKey({
		name: 'RSA-OAEP',
		modulusLength: 4096,
		publicExponent: [0x01, 0x00, 0x01],
		hash: 'SHA-512'
	});

	socket.emit('updatePublicKey', crypto.subtle.sign({
		name: 'RSASSA-PKCS1-v1_5'
	}, getKeys().privateKey, stringToBuffer(RSAKeys.publicKey));

	localStorage.privateKey = RSAKeys.privateKey;
	localStorage.publicKey = RSAKeys.publicKey;
}

function getKeys() {
	if (!localStorage.privateKey) {
		RSAKeys = crypto.subtle.generateKey({
			name: 'RSA-OAEP',
			modulusLength: 4096,
			publicExponent: [0x01, 0x00, 0x01],
			hash: 'SHA-512'
		});

		localStorage.privateKey = RSAKeys.privateKey;
		localStorage.publicKey = RSAKeys.publicKey;
	}

	if (!localStorage.secretKey) {
		localStorage.secretKey = crypto.subtle.generateKey({
			name: 'AES-CBC',
			length: 256
		});
	}

	return {
		secretKey: localStorage.secretKey,
		privateKey: localStorage.privateKey,
		publicKey: localStorage.publicKey
	};
}

function makeDraggable(element, draggable) {
	var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
	console.log(draggable);
	draggable.onmousedown = startDraggingElement;

	function startDraggingElement(element, event) {
		event = event || window.event;
		event.preventDefault();
		pos3 = event.clientX;
		pos4 = event.clientY;
		document.onmouseup = stopDraggingElement;
		document.onmousemove = dragElement;
	}

	function dragElement(event) {
		event = event || window.event;
		event.preventDefault();
		pos1 = pos3 - event.clientX;
		pos2 = pos4 - event.clientY;
		pos3 = event.clientX;
		pos4 = event.clientY;
		element.style.top = (element.offsetTop - pos2) + "px";
		element.style.left = (element.offsetLeft - pos1) + "px";
	}

	function stopDraggingElement() {
		document.onmouseup = null;
		document.onmousemove = null;
	}
}

function name(name) {
	socket.emit('name', name);
	document.cookie = 'username=' + name;
	console.log(document.cookie);
}

function hideNamer() {
	var username = document.getElementsByClassName('username')[0];
	var usernameSelector = document.getElementsByClassName('usernameSelector')[0];
	username.hidden = 'true';
	usernameSelector.hidden = 'true';
	showChat();
}

function submitName(e) {
	if (e === 0 || e.keyCode === 13) {
		var username = document.getElementsByClassName('username')[0];
		name(username.value);
		hideNamer();
	}
}
function stringToBuffer(string) {
	var buffer = new ArrayBuffer(string.length * 2);
	var view = new Uint16Array(buffer);

	for (i = 0; i < message.length; i ++) {
		view[i] = message.charCodeAt(i);
	}

	return buffer;
}

function sendMessage(message, roomName, key) {
	if (message.replace(/\s/g, '') != '') {
		socket.emit('message', window.location.pathname.split('/')[1], crypto.subtle.encrypt({
			name: 'AES-CBC'
		}, key, stringToBuffer(message)));
	}

	socket.emit('newKey', roomName);
}

function submitChat(e) {
	var message = document.getElementsByClassName('chatInput')[0];
	console.log(message);
	if (e.keyCode == 13 || e == 0) {
		sendMessage(message.value);
		message.value = '';
	}
}

function hideChat() {
	var chat = document.getElementsByClassName('chat')[0];
	var chatMain = document.getElementsByClassName('chatMain')[0];
	var hideChat = document.getElementsByClassName('hideChat')[0];
	var showChat = document.getElementsByClassName('showChat')[0];
	chat.style.height = '4vh';
	chatMain.style.display = '';
	hideChat.setAttributeNode(document.createAttribute('hidden'));
	showChat.removeAttribute('hidden');
}

function closeChat() {
	var chatBar = document.getElementsByClassName('chat')[0];
	chatBar.style.display = 'none';
}

function showChat() {
	var chat = document.getElementsByClassName('chat')[0];
	var chatMain = document.getElementsByClassName('chatMain')[0];
	var hideChat = document.getElementsByClassName('hideChat')[0];
	var showChat = document.getElementsByClassName('showChat')[0];
	chat.style.height = '75%';
	chatMain.style.display = 'block';
	hideChat.removeAttribute('hidden');
	showChat.setAttributeNode(document.createAttribute('hidden'));
}
