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

	socket.emit('publicRSAOAEPKey', (await exportRSAOAEPKeys(keys.publicRSAOAEPKey)).publicRSAOAEPKey);
});

socket.on('invite', async (roomName, secretHKDFKey) => {
	roomName = JSON.parse(roomName);

	var secretHKDFKeys = {
		encodedSecretHKDFKey: await RSAOAEPDecrypt(secretHKDFKey, (await getKeys()).privateRSAOAEPKey),
		secretHKDFKey: await importHKDFKey(await RSAOAEPDecrypt(secretHKDFKey, (await getKeys()).privateRSAOAEPKey)),
	}

//	console.log(secretHKDFKeys, await exportAESCBCKey((await HKDFDeriveAESCBCKey(secretHKDFKeys.secretHKDFKey, base64StringToBuffer(base64URLEncode('0')))).secretAESCBCKey), roomName);

	rooms[roomName.encryptedString] = {
		name: base64URLDecode(await AESCBCDecrypt(roomName.encryptedString, (await HKDFDeriveAESCBCKey(secretHKDFKeys.secretHKDFKey, base64StringToBuffer(base64URLEncode('0')))).secretAESCBCKey, roomName.iv)),
		encodedSecretHKDFKey: secretHKDFKeys.encodedSecretHKDFKey,
		messageCount: 0,
		secretHKDFKey: secretHKDFKeys.secretHKDFKey
	};

	console.log(roomName, rooms[roomName.encryptedString], 'dsKey' + await RSAOAEPDecrypt(secretHKDFKey, (await getKeys()).privateRSAOAEPKey), 'sKey: ' + secretHKDFKey);
});

socket.on('message', async (roomName, message) => {
	message = JSON.parse(message);

	console.log(message, rooms, roomName, rooms[roomName]);

	derivedKeys = await HKDFDeriveAESCBCKey(rooms[roomName].secretHKDFKey, base64StringToBuffer(base64URLEncode(parseInt(message.id - 1))));

	rooms[roomName].secretHKDFKey = derivedKeys.secretHKDFKey;
	rooms[roomName].encodedSecretHKDFKey = derivedKeys.encodedSecretHKDFKey;
	rooms[roomName].messageCount = parseInt(message.id);

	message = base64URLDecode(await AESCBCDecrypt(message.message.encryptedString, derivedKeys.secretAESCBCKey, message.message.iv));

	console.log(message);

	messages = document.getElementsByClassName('messages')[0];
	autoScroll = messages.scrollHeight - messages.scrollTop < messages.clientHeight + 20;
	messageBox = document.createElement('P');
	text = document.createTextNode(message);

	messageBox.appendChild(text);
	messages.appendChild(messageBox);

	if (autoScroll) {
		messages.scrollTop = messages.scrollHeight;
	}

	socket.emit('updatePublicRSAOAEPKey', getNewKeys().publicRSAOAEPKey);
	socket.emit('newHKDFKey', await generateHKDFKey().encodedHKDFKey);
});

function escapeRegExp(string) {
	return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

function replaceAll(str, find, replace) {
	return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

function base64URLEncode(string) {
	return replaceAll(replaceAll(replaceAll(btoa(string), '+', '-'), '/', '_'), '=', '~');
}

function base64URLDecode(string) {
	return atob(replaceAll(replaceAll(replaceAll(string, '~', '='), '_', '/'), '-', '+'));
}

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

async function ECDHDeriveHKDFKey(publicECDHKey, privateECDHKey) {
	encodedSecretHKDFKey = bufferToBase64String(await crypto.subtle.deriveBits({
		name: 'ECDH',
		public: ECDHKeys.publicECDHKey,
	}, privateECDHKey, 256));

	secretHKDFKey = await importHKDFKey(encodedSecretHKDFKey);

	return {
		encodedSecretHKDFKey: encodedSecretHKDFKey,
		secretHKDFKey: secretHKDFKey
	};
}

async function generateHKDFKey() {
	ECDHKeys = await generateECDHKeys();
	HKDFKey = await ECDHDeriveHKDFKey(ECDHKeys.publicECDHKey, ECDHKeys.privateECDHKey);

	return {
		encodedSecretHKDFKey: HKDFKey.encodedSecretHKDFKey,
		secretHKDFKey: HKDFKey.secretHKDFKey
	};
}

async function HKDFDeriveAESCBCKey(secretHKDFKey, salt) {
	var info = new ArrayBuffer(0);

	buffer = await crypto.subtle.deriveBits({
		name: 'HKDF',
		hash: 'SHA-512',
		salt: salt,
		info: info
	}, secretHKDFKey, 512);

	secretAESCBCKey = await importAESCBCKey(bufferToBase64String(buffer.slice(0, 32)));
	encodedSecretHKDFKey = bufferToBase64String(buffer.slice(32, 64));
	secretHKDFKey = await importHKDFKey(encodedSecretHKDFKey);


	return {
		secretAESCBCKey: secretAESCBCKey,
		encodedSecretHKDFKey: encodedSecretHKDFKey,
		secretHKDFKey: secretHKDFKey
	};
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

async function generateRSAPSSKeys() {
	RSAPSSKeys = await crypto.subtle.generateKey({
		name: 'RSA-PSS',
		modulusLength: 4096,
		publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
		hash: 'SHA-512'
	}, true, ['sign', 'verify']);

	return {
		publicRSAPSSKey: RSAPSSKeys.publicKey,
		privateRSAPSSKey: RSAPSSKeys.privateKey
	}
}

async function AESCBCEncrypt(string, secretAESCBCKey) {
	string = base64URLEncode(string);

	var iv = new ArrayBuffer(16);
	var view = new Uint16Array(iv);
	crypto.getRandomValues(view);

	return {
		encryptedString: bufferToBase64String(await crypto.subtle.encrypt({
			name: 'AES-CBC',
			iv: iv
		}, secretAESCBCKey, base64StringToBuffer(string))),
		iv: bufferToBase64String(iv)
	};
}

async function HMACSign(string, secretHMACKey) {
	string = base64URLEncode(string);

	return bufferToBase64String(await crypto.subtle.sign({
		name: 'HMAC'
	}, secretHMACKey, base64StringToBuffer(string)));
}

async function RSAOAEPEncrypt(string, publicRSAOAEPKey) {
	string = base64URLEncode(string);

	return bufferToBase64String(await crypto.subtle.encrypt({
		name: 'RSA-OAEP'
	}, publicRSAOAEPKey, base64StringToBuffer(string)));
}

async function RSAPSSSign(string, privateRSAPSSKey) {
	string = base64URLEncode(string);

	return bufferToBase64String(await crypto.subtle.sign({
		name: 'RSA-PSS',
		saltLength: 64
	}, privateRSAPSSKey, base64StringToBuffer(string)));
}

async function AESCBCDecrypt(string, secretAESCBCKey, iv) {
	return base64URLDecode(bufferToBase64String(await crypto.subtle.decrypt({
		name: 'AES-CBC',
		iv: base64StringToBuffer(iv)
	}, secretAESCBCKey, base64StringToBuffer(string))));
}

async function HMACVerify(string, signature, secretHMACKey) {
	string = base64URLEncode(string);

	return await crypto.subtle.verify({
		name: 'HMAC'
	}, secretHMACKey, base64StringToBuffer(signature), base64StringToBuffer(string));
}

async function RSAOAEPDecrypt(string, privateRSAOAEPKey) {
	return base64URLDecode(bufferToBase64String(await crypto.subtle.decrypt({
		name: 'RSA-OAEP'
	}, privateRSAOAEPKey, base64StringToBuffer(string))));
}

async function RSAPSSVerify(string, signature, privateRSAPSSKey) {
	string = base64URLEncode(string);

	return await crypto.subtle.verify({
		name: 'RSA-PSS',
		saltLength: 64
	}, privateRSAPSSKey, base64StringToBuffer(signature), base64StringToBuffer(string));
}

async function importAESCBCKey(secretAESCBCKey) {
	return await crypto.subtle.importKey('raw', base64StringToBuffer(secretAESCBCKey), {
		name: 'AES-CBC'
	}, true, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
}

async function importECDHKeys(publicECDHKey, privateECDHKey) {
	return {
		publicECDHKey: await crypto.subtle.importKey('spki', base64StringToBuffer(publicECDHKey), {
			name: 'ECDH',
			namedCurve: 'P-521'
		}, true, ['deriveBits', 'deriveKey']),
		privateECDHKey: privateECDHKey ? await crypto.subtle.importKey('pkcs8', base64StringToBuffer(privateECDHKey), {
			name: 'ECDH',
			namedCurve: 'P-521'
		}, true, ['deriveBits', 'deriveKey']) : null
	};
}

async function importHKDFKey(secretHKDFKey) {
	return await crypto.subtle.importKey('raw', base64StringToBuffer(secretHKDFKey), {
		name: 'HKDF'
	}, false, ['deriveBits', 'deriveKey']);
}

async function importHMACKey(secretHMACKey) {
		return await crypto.subtle.importKey('raw', base64StringToBuffer(secretHMACKey), {
			name: 'HMAC',
			hash: 'SHA-512'
		}, true, ['sign', 'verify']);
}

async function importRSAOAEPKeys(publicRSAOAEPKey, privateRSAOAEPKey) {
	return {
		publicRSAOAEPKey: await crypto.subtle.importKey('spki', base64StringToBuffer(publicRSAOAEPKey), {
			name: 'RSA-OAEP',
			hash: 'SHA-512'
		}, true, ['encrypt', 'wrapKey']),
		privateRSAOAEPKey: privateRSAOAEPKey ? await crypto.subtle.importKey('pkcs8', base64StringToBuffer(privateRSAOAEPKey), {
			name: 'RSA-OAEP',
			hash: 'SHA-512'
		}, true, ['decrypt', 'unwrapKey']) : null
	};
}

async function importRSAPSSKeys(publicRSAPSSKey, privateRSAPSSKey) {
	return {
		publicRSAPSSKey: await crypto.subtle.importKey('spki', base64StringToBuffer(publicRSAPSSKey), {
			name: 'RSA-PSS',
			hash: 'SHA-512'
		}, true, ['verify']),
		privateRSAPSSKey: privateRSAPSSKey ? await crypto.subtle.importKey('pkcs8', base64StringToBuffer(privateRSAPSSKey), {
			name: 'RSA-PSS',
			hash: 'SHA-512'
		}, true, ['sign']) : null
	};
}

async function exportAESCBCKey(secretAESCBCKey) {
	return bufferToBase64String(await crypto.subtle.exportKey('raw', secretAESCBCKey));
}

async function exportECDHKeys(publicECDHKey, privateECDHKey) {
	return {
		publicECDHKey: bufferToBase64String(await crypto.subtle.exportKey('spki', publicECDHKey)),
		privateECDHKey: privateECDHKey ? bufferToBase64String(await crypto.subtle.exportKey('pkcs8', privateECDHKey)) : null
	}
}

async function exportHMACKey(secretAESCBCKey) {
	return bufferToBase64String(await crypto.subtle.exportKey('raw', secretAESCBCKey));
}

async function exportRSAOAEPKeys(publicRSAOAEPKey, privateRSAOAEPKey) {
	return {
		publicRSAOAEPKey: bufferToBase64String(await crypto.subtle.exportKey('spki', publicRSAOAEPKey)),
		privateRSAOAEPKey: privateRSAOAEPKey ? bufferToBase64String(await crypto.subtle.exportKey('pkcs8', privateRSAOAEPKey)) : null
	}
}

async function exportRSAPSSKeys(publicRSAPSSKey, privateRSAPSSKey) {
	return {
		publicRSAPSSKey: bufferToBase64String(await crypto.subtle.exportKey('spki', publicRSAPSSKey)),
		privateRSAPSSKey: privateRSAPSSKey ? bufferToBase64String(await crypto.subtle.exportKey('pkcs8', privateRSAPSSKey)) : null
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
		exportedKeys = await exportRSAOAEPKeys(RSAOAEPKeys.publicRSAOAEPKey, RSAOAEPKeys.privateRSAOAEPKey);
		localStorage.privateRSAOAEPKey = exportedKeys.privateRSAOAEPKey;
		localStorage.publicRSAOAEPKey = exportedKeys.publicRSAOAEPKey;

	} else {
		RSAOAEPKeys = await importRSAOAEPKeys(localStorage.publicRSAOAEPKey, localStorage.privateRSAOAEPKey);
	}

	if (!localStorage.privateRSAPSSKey || !localStorage.publicRSAPSSKey) {
		RSAPSSKeys = await generateRSAPSSKeys();
		exportedKeys = await exportRSAPSSKeys(RSAPSSKeys.publicRSAPSSKey, RSAPSSKeys.privateRSAPSSKey);
		localStorage.privateRSAPSSKey = exportedKeys.privateRSAPSSKey;
		localStorage.publicRSAPSSKey = exportedKeys.publicRSAPSSKey;

	} else {
		RSAPSSKeys = await importRSAPSSKeys(localStorage.publicRSAPSSKey, localStorage.privateRSAPSSKey);
	}

	return {
		secretAESCBCKey: secretAESCBCKey,
		secretHMACKey: secretHMACKey,
		privateRSAOAEPKey: RSAOAEPKeys.privateRSAOAEPKey,
		publicRSAOAEPKey: RSAOAEPKeys.publicRSAOAEPKey,
		privateRSAPSSKey: RSAPSSKeys.privateRSAPSSKey,
		publicRSAPSSKey: RSAPSSKeys.publicRSAPSSKey
	};
}

async function getNewKeys() {
	secretAESCBCKey = await generateAESCBCKey();
	localStorage.secretAESCBCKey = await exportAESCBCKey(secretAESCBCKey);

	secretHMACKey = await generateHMACKey();
	localStorage.secretHMACKey = await exportHMACKey(secretHMACKey);

	RSAOAEPKeys = await generateRSAOAEPKeys();
	exportedKeys = await exportRSAOAEPKeys(RSAOAEPKeys.publicRSAOAEPKey, RSAOAEPKeys.privateRSAOAEPKey);

	localStorage.privateRSAOAEPKey = exportedKeys.privateRSAOAEPKey;
	localStorage.publicRSAOAEPKey = exportedKeys.publicRSAOAEPKey;

	RSAPSSKeys = await generateRSAPSSKeys();
	exportedKeys = await exportRSAPSSKeys(RSAPSSKeys.publicRSAPSSKey, RSAPSSKeys.privateRSAPSSKey);
	localStorage.privateRSAPSSKey = exportedKeys.privateRSAPSSKey;
	localStorage.publicRSAPSSKey = exportedKeys.publicRSAPSSKey;


	return {
		secretAESCBCKey: secretAESCBCKey,
		secretHMACKey: secretHMACKey,
		privateRSAOAEPKey: RSAOAEPKeys.privateRSAOAEPKey,
		publicRSAOAEPKey: RSAOAEPKeys.publicRSAOAEPKey,
		privateRSAPSSKey: RSAPSSKeys.privateRSAPSSKey,
		publicRSAPSSKey: RSAPSSKeys.publicRSAPSSKey
	};
}

async function createNewRoom(roomName, publicRSAOAEPKeys, usernames) {
	var secretHKDFKey = await generateHKDFKey();
	var secretHKDFKeys = [];

	roomName = base64URLEncode(roomName);

	for (publicRSAOAEPKey of publicRSAOAEPKeys) {
//		console.log(publicRSAOAEPKey);
//		console.log('Yay?');
		secretHKDFKeys.push(await RSAOAEPEncrypt(secretHKDFKey.encodedSecretHKDFKey, (await importRSAOAEPKeys(publicRSAOAEPKey)).publicRSAOAEPKey));
	}

	derivedKey = await HKDFDeriveAESCBCKey(secretHKDFKey.secretHKDFKey, base64StringToBuffer(base64URLEncode('0')));
	secretAESCBCKey = derivedKey.secretAESCBCKey;

	roomName = await AESCBCEncrypt(roomName, secretAESCBCKey);
	socket.emit('newRoom', JSON.stringify(roomName), publicRSAOAEPKeys, secretHKDFKeys, usernames);

	window.history.pushState({room: 'Home'}, 'Chat', '/room/' + roomName.encryptedString);
	socket.emit('joinRoom', roomName.encryptedString);

	return roomName;
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
	username = document.getElementsByClassName('username')[0];
	usernameSelector = document.getElementsByClassName('usernameSelector')[0];
	username.hidden = 'true';
	usernameSelector.hidden = 'true';
	showChat();
}

function submitName(event) {
	if (event === 0 || (!keysPressed['Shift'] && !keysPressed[16] && (event.key === 'Enter' || event.keyCode === 13))) {
		username = document.getElementsByClassName('username')[0];
		name(username.value);
		hideNamer();
	}
}

function base64StringToBuffer(string) {
	string = base64URLDecode(string);

	var buffer = new ArrayBuffer(string.length);
	var view = new Uint8Array(buffer);

	for (i = 0; i < string.length; i ++) {
		view[i] = string.charCodeAt(i);
	}

	return buffer;
}

function bufferToBase64String(buffer) {
	var view = new Uint8Array(buffer);
	var string = '';

	for (i = 0; i < view.length; i ++) {
		string += String.fromCharCode(view[i]);
	}

	string = base64URLEncode(string);
	return string;
}

async function sendMessage(roomName, message) {
//	if (!rooms[roomName]) {
//		window.history.pushState({room: 'Home'}, 'Chat', '/');
//		return;
//	}

	if (message.replace(/\s/g, '') != '') {
		message = JSON.stringify({
			id: rooms[roomName].messageCount + 1,
			message: await AESCBCEncrypt(base64URLEncode(message), (await HKDFDeriveAESCBCKey(rooms[roomName].secretHKDFKey, base64StringToBuffer(base64URLEncode(rooms[roomName].messageCount.toString())))).secretAESCBCKey)
		});

		socket.emit('message', roomName, message);
	}

	socket.emit('newKey', roomName);
}

function submitChat(event) {
	message = document.getElementsByClassName('chatInput')[0];

	if (event === 0 || (!keysPressed['Shift'] && !keysPressed[16] && ((keysPressed['Enter'] && event.key === 'Enter') || (keysPressed[13] && event.keyCode === 13)))) {
		roomName = window.location.pathname.split('/')[2];
		sendMessage(roomName, message.value);
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
	chat = document.getElementsByClassName('chat')[0];
	chatMain = document.getElementsByClassName('chatMain')[0];
	hideChat = document.getElementsByClassName('hideChat')[0];
	showChat = document.getElementsByClassName('showChat')[0];
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
	chatBar = document.getElementsByClassName('chat')[0];
	chatBar.style.display = 'none';
}

function showChat() {
	chat = document.getElementsByClassName('chat')[0];
	chatMain = document.getElementsByClassName('chatMain')[0];
	hideChat = document.getElementsByClassName('hideChat')[0];
	showChat = document.getElementsByClassName('showChat')[0];
	chat.style['min-height'] = '150px';
	chat.style.height = chat.style.prevHeight;
	chat.style.resize = 'both';
	chat.style.width = chat.style.prevWidth;
	chatMain.style.display = 'block';
	hideChat.removeAttribute('hidden');
	showChat.setAttributeNode(document.createAttribute('hidden'));
}
