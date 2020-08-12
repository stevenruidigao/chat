var socket = io.connect();
var rooms = new Map();
var keysPressed = new Map();
var users = new Map();

document.onkeydown = handleKeyEvent;
document.onkeyup = handleKeyEvent;

if (window.location.pathname.includes('room')) {
	socket.emit('joinRoom', window.location.pathname.split('/')[2]);
}

socket.on('connected', async () => {
	keys = await getKeys();

//	console.log(keys);
//	console.log((await exportRSAOAEPKeys(RSAOAEPKeys.privateRSAOAEPKey, RSAOAEPKeys.publicRSAOAEPKey)).publicRSAOAEPKey);
	socket.emit('publicRSAOAEPKey', (await exportRSAOAEPKeys(keys.publicRSAOAEPKey)).publicRSAOAEPKey);
});

socket.on('invite', async (roomName, secretAESCBCKey) => {
	rooms[roomName] = await importAESCBCKey(await RSAOAEPDecrypt(secretAESCBCKey, (await getKeys()).privateRSAOAEPKey));

	console.log(roomName, rooms[roomName], 'dsKey' + await RSAOAEPDecrypt(secretAESCBCKey, (await getKeys()).privateRSAOAEPKey), 'sKey: ' + secretAESCBCKey);
});

socket.on('message', async (message, publicKey) => {
	message = await AESDecrypt(message, rooms[roomName]);

	messages = document.getElementsByClassName('messages')[0];
	autoScroll = messages.scrollHeight - messages.scrollTop < messages.clientHeight + 20;
	messageBox = document.createElement('P');
	text = document.createTextNode(message);

	messageBox.appendChild(text);
	messages.appendChild(messageBox);

	if (autoScroll) {
		messages.scrollTop = messages.scrollHeight;
	}
});

async function generateAESCBCKey() {
	secretAESCBCKey = await crypto.subtle.generateKey({
		name: 'AES-CBC',
		length: 256
	}, true, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);

	return secretAESCBCKey;
}

async function generateECDHKeys() {
	ECDHKeys = await crypto.subtle.generateKey({
		name: 'ECDH',
		namedCurve: 'P-521'
	}, true, ['deriveBits', 'deriveKey']);

	return {
		publicECDHKey: ECDHKeys.publicKey,
		privateECDHKey: ECDHKeys.privateKey,
	}
}

async function generateHMACKey() {
	secretHMACKey = await crypto.subtle.generateKey({
		name: 'HMAC',
		hash: 'SHA-512'
	}, true, ['sign', 'verify']);

	return secretHMACKey;
}

async function generateRSAOAEPKeys() {
	RSAOAEPKeys = await crypto.subtle.generateKey({
		name: 'RSA-OAEP',
		modulusLength: 4096,
		publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
		hash: 'SHA-512'
	}, true, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);

	return {
		publicRSAOAEPKey: RSAOAEPKeys.publicKey,
		privateRSAOAEPKey: RSAOAEPKeys.privateKey
	}
}

async function AESEncrypt(string, secretAESCBCKey) {
	var buffer = new ArrayBuffer(16);
	var view = new Uint16Array(buffer);
	crypto.getRandomValues(view);

	return bufferToString(await crypto.subtle.encrypt({
		name: 'AES-CBC',
		iv: buffer
	}, secretAESCBCKey, stringToBuffer(string)));
}

async function HMACSign(string, secretHMACKey) {
	return bufferToString(await crypto.subtle.sign({
		name: 'HMAC'
	}, secretHMACKey, stringToBuffer(string)));
}

async function RSAOAEPEncrypt(string, publicRSAOAEPKey) {
	return bufferToString(await crypto.subtle.encrypt({
		name: 'RSA-OAEP'
	}, publicRSAOAEPKey, stringToBuffer(string)));
}

async function AESDecrypt(string, secretAESCBCKey) {
	return bufferToString(await crypto.subtle.decrypt({
		name: 'AES-CBC'
	}, secretAESCBCKey, stringToBuffer(string)));
}

async function ECDHDeriveHKDFKey(publicECDHKey, privateECDHKey) {
	return bufferToString(await crypto.subtle.deriveBits({
		name: 'ECDH',
		public: publicECDHKey
	}, privateECDHKey, 256));
}

async function HMACVerify(string, signature, secretHMACKey) {
	return bufferToString(await crypto.subtle.verify({
		name: 'HMAC'
	}, secretHMACKey, stringToBuffer(signature), stringToBuffer(string)));
}

async function RSAOAEPDecrypt(string, privateRSAOAEPKey) {
	return bufferToString(await crypto.subtle.decrypt({
		name: 'RSA-OAEP'
	}, privateRSAOAEPKey, stringToBuffer(string)));
}

async function importAESCBCKey(secretAESCBCKey) {
	return await crypto.subtle.importKey('raw', stringToBuffer(secretAESCBCKey), {
		name: 'AES-CBC'
	}, true, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
}

async function importHKDFKey(secretHKDFKey) {
	return await crypto.subtle.importKey('raw', stringToBuffer(secretHKDFKey), {
		name: 'HKDF'
	}, false, ['deriveBits', 'deriveKey']);
}

async function importHMACKey(secretHMACKey) {
		return await crypto.subtle.importKey('raw', stringToBuffer(secretHMACKey), {
			name: 'HMAC',
			hash: 'SHA-512'
		}, true, ['sign', 'verify']);
}

async function importRSAOAEPKeys(publicRSAOAEPKey, privateRSAOAEPKey) {
	return {
		publicRSAOAEPKey: await crypto.subtle.importKey('spki', stringToBuffer(publicRSAOAEPKey), {
			name: 'RSA-OAEP',
			hash: 'SHA-512'
		}, true, ['encrypt', 'wrapKey']),
		privateRSAOAEPKey: privateRSAOAEPKey ? await crypto.subtle.importKey('pkcs8', stringToBuffer(privateRSAOAEPKey), {
			name: 'RSA-OAEP',
			hash: 'SHA-512'
		}, true, ['decrypt', 'unwrapKey']) : null
	};
}

async function exportAESCBCKey(secretAESCBCKey) {
	return bufferToString(await crypto.subtle.exportKey('raw', secretAESCBCKey));
}

async function exportHMACKey(secretAESCBCKey) {
	return bufferToString(await crypto.subtle.exportKey('raw', secretAESCBCKey));
}

async function exportRSAOAEPKeys(publicRSAOAEPKey, privateRSAOAEPKey) {
	return {
		publicRSAOAEPKey: bufferToString(await crypto.subtle.exportKey('spki', publicRSAOAEPKey)),
		privateRSAOAEPKey: privateRSAOAEPKey ? bufferToString(await crypto.subtle.exportKey('pkcs8', privateRSAOAEPKey)) : null
	}
}

async function getKeys() {
	if (!localStorage.secretAESCBCKey) {
		secretAESCBCKey = await generateAESCBCKey();
		localStorage.secretAESCBCKey = await exportAESCBCKey(secretAESCBCKey);

	} else {
		secretAESCBCKey = await importAESCBCKey(localStorage.secretAESCBCKey);
	}

	if (!localStorage.secretHMACKey) {
		secretHMACKey = await generateHMACKey();
		localStorage.secretHMACKey = await exportHMACKey(secretHMACKey);

	} else {
		secretHMACKey = await importHMACKey(localStorage.secretHMACKey);
	}

	if (!localStorage.privateRSAOAEPKey || !localStorage.publicRSAOAEPKey) {
		RSAOAEPKeys = await generateRSAOAEPKeys();
//		console.log(RSAOAEPKeys);
		exportedKeys = await exportRSAOAEPKeys(RSAOAEPKeys.publicRSAOAEPKey, RSAOAEPKeys.privateRSAOAEPKey);
		localStorage.privateRSAOAEPKey = exportedKeys.privateRSAOAEPKey;
		localStorage.publicRSAOAEPKey = exportedKeys.publicRSAOAEPKey;

	} else {
		RSAOAEPKeys = await importRSAOAEPKeys(localStorage.publicRSAOAEPKey, localStorage.privateRSAOAEPKey);
	}

	return {
		secretAESCBCKey: secretAESCBCKey,
		secretHMACKey: secretHMACKey,
		privateRSAOAEPKey: RSAOAEPKeys.privateRSAOAEPKey,
		publicRSAOAEPKey: RSAOAEPKeys.publicRSAOAEPKey
	};
}

async function createNewRoom(roomName, publicRSAOAEPKeys, usernames) {
	var secretAESCBCKey = await generateAESCBCKey();
	var secretAESCBCKeys = [];

	console.log('*********************' + exportAESCBCKey(secretAESCBCKey));

	for (publicRSAOAEPKey of publicRSAOAEPKeys) {
		secretAESCBCKeys.push(await RSAOAEPEncrypt(await exportAESCBCKey(secretAESCBCKey), (await importRSAOAEPKeys(publicRSAOAEPKey)).publicRSAOAEPKey));
	}

	roomName = await AESEncrypt(roomName, secretAESCBCKey);
	rooms[roomName] = secretAESCBCKey;

	console.log(secretAESCBCKeys);

	socket.emit('newRoom', roomName, publicRSAOAEPKeys, secretAESCBCKeys, usernames);
}

function loadCookies() {
	if (document.cookie != '' && document.cookie.split('username=').length >= 2) {
		name(document.cookie.split('username=')[1].split(';')[0]);
		hideNamer();
	}
}

function makeDraggable(element, draggable) {
	var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

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
}

function hideNamer() {
	var username = document.getElementsByClassName('username')[0];
	var usernameSelector = document.getElementsByClassName('usernameSelector')[0];
	username.hidden = 'true';
	usernameSelector.hidden = 'true';
	showChat();
}

function submitName(event) {
	if (event === 0 || (!keysPressed['Shift'] && !keysPressed[16] && (event.key === 'Enter' || event.keyCode === 13))) {
		var username = document.getElementsByClassName('username')[0];
		name(username.value);
		hideNamer();
	}
}

function stringToBuffer(string) {
	try {
		string = atob(string);
	} catch {}

//	console.log(string + '************************************************&^%&%$' + string.length);

	var buffer = new ArrayBuffer(string.length);
	var view = new Uint8Array(buffer);

	for (i = 0; i < string.length; i ++) {
		view[i] = string.charCodeAt(i);
	}

	return buffer;
}

function bufferToString(buffer) {
	var view = new Uint8Array(buffer);
	var string = '';

//	console.log(view);

	for (i = 0; i < view.length; i ++) {
		string += String.fromCharCode(view[i]);
	}

	string = btoa(string);
	return string;
}

function sendMessage(message, roomName) {
//	console.log(rooms);

	if (!rooms[roomName]) {
		window.history.pushState({room: 'Home'}, 'Chat', '/');
		return;
	}

	if (message.replace(/\s/g, '') != '') {
		socket.emit('message', window.location.pathname.split('/')[1], AESEncrypt(message, rooms[roomName]));
	}

	socket.emit('newKey', roomName);
}

function submitChat(event) {
	var message = document.getElementsByClassName('chatInput')[0];

	if (event === 0 || (!keysPressed['Shift'] && !keysPressed[16] && ((keysPressed['Enter'] && event.key === 'Enter') || (keysPressed[13] && event.keyCode === 13)))) {
		roomName = window.location.pathname.split('/')[2];
		sendMessage(message.value, roomName, rooms[roomName]);
		message.value = '';

	        if (event.preventDefault) {
			event.preventDefault();
		}

	        return false;
	}
}

function handleKeyEvent(event) {
	if (event.key) {
		keysPressed[event.key] = event.type === 'keydown';

	} else if (event.keyCode) {
		keysPressed[event.keyCode] = event.type === 'keydown';
	}
}

function hideChat() {
	var chat = document.getElementsByClassName('chat')[0];
	var chatMain = document.getElementsByClassName('chatMain')[0];
	var hideChat = document.getElementsByClassName('hideChat')[0];
	var showChat = document.getElementsByClassName('showChat')[0];
	chat.style.prevHeight = chat.style.height;
	chat.style.prevWidth = chat.style.width;
	chat.style['min-height'] = '4vh';
	chat.style.height = '4vh';
	chat.style.resize = 'none';
	chat.style.width = '150px';
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
	chat.style['min-height'] = '150px';
	chat.style.height = chat.style.prevHeight;
	chat.style.resize = 'both';
	chat.style.width = chat.style.prevWidth;
	chatMain.style.display = 'block';
	hideChat.removeAttribute('hidden');
	showChat.setAttributeNode(document.createAttribute('hidden'));
}
