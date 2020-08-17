var socket = io.connect();
var rooms = new Map();
var keysPressed = new Map();
var users = new Map();

document.onkeydown = handleKeyEvent;
document.onkeyup = handleKeyEvent;

if (window.location.pathname.includes('room')) {
	joinRoom(window.location.pathname.split('/')[2]);
}

loadName();
makeDraggable(document.getElementsByClassName('chat global')[0], document.getElementsByClassName('chatHeader global')[0]);

socket.on('connected', async () => {
	keys = await getKeys();

	socket.emit('publicRSAOAEPKey', (await exportRSAOAEPKeys(keys.publicRSAOAEPKey)).publicRSAOAEPKey);

	keyBox = document.getElementsByClassName('publicRSAOAEPKey')[0];
	keyBox.value = (await exportRSAOAEPKeys(keys.publicRSAOAEPKey)).publicRSAOAEPKey;
});

socket.on('invite', async (roomName, secretHKDFKey) => {
	roomName = JSON.parse(roomName);

//	console.log(roomName);

	var secretHKDFKeys = {
		encodedSecretHKDFKey: await RSAOAEPDecrypt(secretHKDFKey, (await getKeys()).privateRSAOAEPKey),
		secretHKDFKey: await importHKDFKey(await RSAOAEPDecrypt(secretHKDFKey, (await getKeys()).privateRSAOAEPKey)),
	}

//	window.history.pushState({room: 'Home'}, 'Chat', '/room/' + roomName.encryptedString);
//	console.log(secretHKDFKeys, await exportAESCBCKey((await HKDFDeriveAESCBCKey(secretHKDFKeys.secretHKDFKey, ASCIIStringToBuffer(base64URLEncode('0')))).secretAESCBCKey), roomName);

	rooms[roomName.encryptedString] = {
		name: await AESCBCDecrypt(base64URLDecode(roomName.encryptedString), (await HKDFDeriveAESCBCKey(secretHKDFKeys.secretHKDFKey, ASCIIStringToBuffer(base64URLEncode('0')))).secretAESCBCKey, base64URLDecode(roomName.iv)),
		encodedSecretHKDFKey: secretHKDFKeys.encodedSecretHKDFKey,
		messageCount: 0,
		secretHKDFKey: secretHKDFKeys.secretHKDFKey
	};

	joinRoom(roomName.encryptedString);

//	console.log(roomName, rooms[roomName.encryptedString], 'dsKey' + await RSAOAEPDecrypt(secretHKDFKey, (await getKeys()).privateRSAOAEPKey), 'sKey: ' + secretHKDFKey);
});

socket.on('joinedRoom', (roomName) => {
//	console.log('Joined room ' + roomName);
});

socket.on('message', async (roomName, message) => {
	message = JSON.parse(message);

//	console.log(message, rooms, roomName, rooms[roomName], message.encryptedString);

	derivedKeys = await HKDFDeriveAESCBCKey(rooms[roomName].secretHKDFKey, ASCIIStringToBuffer(base64URLEncode(parseInt(message.id - 1))));

	rooms[roomName].secretHKDFKey = derivedKeys.secretHKDFKey;
	rooms[roomName].encodedSecretHKDFKey = derivedKeys.encodedSecretHKDFKey;
	rooms[roomName].messageCount = parseInt(message.id);

	message = await AESCBCDecrypt(base64URLDecode(message.encryptedString), derivedKeys.secretAESCBCKey, base64URLDecode(message.iv));

//	console.log(message);

	chatHeader = document.getElementsByClassName('chatHeader ' + roomName)[0];
	chatHeader.style.backgroundColor = '#3355ff';

	showChatButton = document.getElementsByClassName('showChatButton ' + roomName)[0];
	showChatButton.style.backgroundColor = '#3355ff';

	hideChatButton = document.getElementsByClassName('hideChatButton ' + roomName)[0];
	hideChatButton.style.backgroundColor = '#3355ff';

	closeChatButton = document.getElementsByClassName('closeChatButton ' + roomName)[0];
	closeChatButton.style.backgroundColor = '#3355ff';

	messages = document.getElementsByClassName('messages ' + roomName)[0];
	autoScroll = messages.scrollHeight - messages.scrollTop < messages.clientHeight + 20;

	messageBox = document.createElement('P');
	messageBox.className = 'message ' + roomName;

	text = document.createTextNode(message);

	messageBox.appendChild(text);
	messages.appendChild(messageBox);

	if (autoScroll) {
		messages.scrollTop = messages.scrollHeight;
	}

//	socket.emit('updatePublicRSAOAEPKey', getNewKeys().publicRSAOAEPKey);
//	socket.emit('newHKDFKey', await generateHKDFKey().encodedHKDFKey);
});

socket.on('globalMessage', async (message) => {
	chatHeader = document.getElementsByClassName('chatHeader global')[0];
	chatHeader.style.backgroundColor = '#3355ff';

	showChatButton = document.getElementsByClassName('showChatButton global')[0];
	showChatButton.style.backgroundColor = '#3355ff';

	hideChatButton = document.getElementsByClassName('hideChatButton global')[0];
	hideChatButton.style.backgroundColor = '#3355ff';

	closeChatButton = document.getElementsByClassName('closeChatButton global')[0];
	closeChatButton.style.backgroundColor = '#3355ff';

	messages = document.getElementsByClassName('messages global')[0];
	autoScroll = messages.scrollHeight - messages.scrollTop < messages.clientHeight + 20;

	messageBox = document.createElement('P');
	messageBox.className = 'message global';

	text = document.createTextNode(message);

	messageBox.appendChild(text);
	messages.appendChild(messageBox);

	if (autoScroll) {
		messages.scrollTop = messages.scrollHeight;
	}
});

function markFocused(roomName) {
	chat = document.getElementsByClassName('chat ' + roomName)[0];
	chat.style.zIndex = ((chat.style.zIndex ? parseInt(chat.style.zIndex) : 0) + 1).toString();

	chatHeader = document.getElementsByClassName('chatHeader ' + roomName)[0];
	chatHeader.style.backgroundColor = '#252525';

	showChatButton = document.getElementsByClassName('showChatButton ' + roomName)[0];
	showChatButton.style.backgroundColor = '#252525';

	hideChatButton = document.getElementsByClassName('hideChatButton ' + roomName)[0];
	hideChatButton.style.backgroundColor = '#252525';

	closeChatButton = document.getElementsByClassName('closeChatButton ' + roomName)[0];
	closeChatButton.style.backgroundColor = '#252525';

}

function createNewRoomWindow(roomName) {
	var newChat = document.createElement('div');
	newChat.className = 'chat ' + roomName;

	newChat.onclick = () => {
		markFocused(roomName);
	}

	var newChatHeader = document.createElement('div');
	newChatHeader.className = 'chatHeader ' + roomName;

	var newChatTitle = document.createElement('h');
	newChatTitle.className = 'chatTitle ' + roomName;
	var newChatTitleText = document.createTextNode((rooms[roomName] && rooms[roomName].name) ? rooms[roomName].name : roomName);
	newChatTitle.appendChild(newChatTitleText);

	var newShowChatButton = document.createElement('button');
	newShowChatButton.className = 'showChatButton ' + roomName;
	newShowChatButton.setAttributeNode(document.createAttribute('hidden'));

	newShowChatButton.onclick = () => {
		showChat(roomName);
	};

	var newShowChatButtonText = document.createTextNode('+');
	newShowChatButton.appendChild(newShowChatButtonText);

	var newHideChatButton = document.createElement('button');
	newHideChatButton.className = 'hideChatButton ' + roomName;

	newHideChatButton.onclick = () => {
		hideChat(roomName);
	};

	var newHideChatButtonText = document.createTextNode('–');
	newHideChatButton.appendChild(newHideChatButtonText);

	var newCloseChatButton = document.createElement('button');
	newCloseChatButton.className = 'closeChatButton ' + roomName;

	newCloseChatButton.onclick = () => {
		closeChat(roomName);
	};

	var newCloseChatButtonText = document.createTextNode('X');
	newCloseChatButton.appendChild(newCloseChatButtonText);

	newChatHeader.appendChild(newChatTitle);
	newChatHeader.appendChild(newShowChatButton);
	newChatHeader.appendChild(newHideChatButton);
	newChatHeader.appendChild(newCloseChatButton);

	var newUsernameSelector = document.createElement('div');
	newUsernameSelector.className = 'usernameSelector ' + roomName;
	newUsernameSelector.onkeypress = submitName;

	var newUsernameSelectorText = document.createTextNode('What is your nickname?');

	var newUsernameSelectorLineBreak = document.createElement('br');

	var newUsernameLabel = document.createElement('label');
	newUsernameLabel.className = 'usernameLabel ' + roomName;
	newUsernameLabel.htmlFor = 'usernameInput ' + roomName;

	var newUsernameLabelText = document.createTextNode('Username: ');

	var newUsernameInput = document.createElement('input');
	newUsernameInput.className = 'usernameInput ' + roomName;
	newUsernameInput.placeholder = 'Type your name here...';

	newUsernameLabel.appendChild(newUsernameLabelText);
	newUsernameLabel.appendChild(newUsernameInput);

	var newUsernameButton = document.createElement('button');
	newUsernameButton.className = 'usernameButton ' + roomName;
	newUsernameButton.onclick = () => {
		submitName(0);
	}

	var newUsernameButtonText = document.createTextNode('Submit');

	newUsernameButton.appendChild(newUsernameButtonText);

	newUsernameSelector.appendChild(newUsernameSelectorText);
	newUsernameSelector.appendChild(newUsernameSelectorLineBreak);
	newUsernameSelector.appendChild(newUsernameLabel);
	newUsernameSelector.appendChild(newUsernameButton);

	var newChatMain = document.createElement('div');
	newChatMain.className = 'chatMain ' + roomName;
	if (!getName()) newChatMain.setAttributeNode(document.createAttribute('hidden'));

	var newMessages = document.createElement('div');
	newMessages.className = 'messages ' + roomName;

	var newMessageInput = document.createElement('div');
	newMessageInput.className = 'messageInput ' + roomName;

	newMessageInput.onkeypress = (event) => {
		submitChat(event, roomName);
	}

	var newChatInputLabel = document.createElement('label');
	newChatInputLabel.className = 'chatInputLabel ' + roomName;
	newChatInputLabel.htmlFor = 'chatInput ' + roomName;

	var newChatInputLabelText = document.createTextNode('Message: ');

	var newChatInput = document.createElement('textarea');
	newChatInput.className = 'chatInput ' + roomName;
	newChatInput.rows = 3;
	newChatInput.placeholder = 'Type your message here...';

	newChatInputLabel.appendChild(newChatInputLabelText);
	newChatInputLabel.appendChild(newChatInput);

	newMessageInput.appendChild(newChatInputLabel);

	newChatMain.appendChild(newMessages);
	newChatMain.appendChild(newMessageInput);

	newChat.appendChild(newChatHeader);
	if (!getName()) newChat.appendChild(newUsernameSelector);
	newChat.appendChild(newChatMain);

	document.body.appendChild(newChat);
	makeDraggable(newChat, newChatHeader)
}

function joinRoom(roomName) {
	socket.emit('joinRoom', roomName);
//	window.history.pushState({room: roomName}, 'Chat', '/room/' + roomName);

	if (!rooms[roomName]) {
		rooms[roomName] = {
			messageCount: 0
		};
	}

	createNewRoomWindow(roomName);
}

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
	};
}

async function ECDHDeriveHKDFKey(publicECDHKey, privateECDHKey) {
	encodedSecretHKDFKey = base64URLEncode(bufferToASCIIString(await crypto.subtle.deriveBits({
		name: 'ECDH',
		public: ECDHKeys.publicECDHKey,
	}, privateECDHKey, 256)));

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

	secretAESCBCKey = await importAESCBCKey(base64URLEncode(bufferToASCIIString(buffer.slice(0, 32))));
	encodedSecretHKDFKey = base64URLEncode(bufferToASCIIString(buffer.slice(32, 64)));
	secretHKDFKey = await importHKDFKey(encodedSecretHKDFKey);


	return {
		secretAESCBCKey: secretAESCBCKey,
		encodedSecretHKDFKey: encodedSecretHKDFKey,
		secretHKDFKey: secretHKDFKey
	};
}

async function HKDFDeriveAESCBCKeys(secretHKDFKey, start, end) {
	var info = new ArrayBuffer(0);
	var secretAESCBCKeys = [];
	var encodedSecretHKDFKey = null;

	for (i = start; i <= end; i ++) {
		newKeys = HKDFDeriveAESCBCKey(secretHKDFKey, ASCIIStringToBuffer(base64URLEncode(i.toString())));
		secretAESCBCKeys.push(newKeys.secretAESCBCKeys);
		secretHKDFKey = newKeys.secretHKDFKey;
		encodedSecretHKDFKey = newKeys.encodedSecretHKDFKey;
	}

	return {
		secretAESCBCKeys: secretAESCBCKeys,
		encodedSecretHKDFKey: encodedSecretHKDFKey,
		secretHKDFKey: secretHKDFKey
	};
}

async function generateHMACKey() {
	var secretHMACKey = await crypto.subtle.generateKey({
		name: 'HMAC',
		hash: 'SHA-512'
	}, true, ['sign', 'verify']);

	return secretHMACKey;
}

async function generateRSAOAEPKeys() {
	var RSAOAEPKeys = await crypto.subtle.generateKey({
		name: 'RSA-OAEP',
		modulusLength: 4096,
		publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
		hash: 'SHA-512'
	}, true, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);

	return {
		publicRSAOAEPKey: RSAOAEPKeys.publicKey,
		privateRSAOAEPKey: RSAOAEPKeys.privateKey
	};
}

async function generateRSAPSSKeys() {
	var RSAPSSKeys = await crypto.subtle.generateKey({
		name: 'RSA-PSS',
		modulusLength: 4096,
		publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
		hash: 'SHA-512'
	}, true, ['sign', 'verify']);

	return {
		publicRSAPSSKey: RSAPSSKeys.publicKey,
		privateRSAPSSKey: RSAPSSKeys.privateKey
	};
}

async function AESCBCEncrypt(string, secretAESCBCKey) {
	var iv = new ArrayBuffer(16);
	var view = new Uint8Array(iv);
	crypto.getRandomValues(view);

	return {
		encryptedString: base64URLEncode(bufferToASCIIString(await crypto.subtle.encrypt({
			name: 'AES-CBC',
			iv: iv
		}, secretAESCBCKey, unicodeStringToBuffer(string)))),
		iv: base64URLEncode(bufferToASCIIString(iv))
	};
}

async function HMACSign(string, secretHMACKey) {
	return base64URLEncode(bufferToASCIIString(await crypto.subtle.sign({
		name: 'HMAC'
	}, secretHMACKey, unicodeStringToBuffer(string))));
}

async function RSAOAEPEncrypt(string, publicRSAOAEPKey) {
	return base64URLEncode(bufferToASCIIString(await crypto.subtle.encrypt({
		name: 'RSA-OAEP'
	}, publicRSAOAEPKey, unicodeStringToBuffer(string))));
}

async function RSAPSSSign(string, privateRSAPSSKey) {
	return base64URLEncode(bufferToASCIIString(await crypto.subtle.sign({
		name: 'RSA-PSS',
		saltLength: 64
	}, privateRSAPSSKey, unicodeStringToBuffer(string))));
}

async function AESCBCDecrypt(string, secretAESCBCKey, iv) {
	return bufferToUnicodeString(await crypto.subtle.decrypt({
		name: 'AES-CBC',
		iv: ASCIIStringToBuffer(base64URLDecode(iv))
	}, secretAESCBCKey, ASCIIStringToBuffer(base64URLDecode(string))));
}

async function HMACVerify(string, signature, secretHMACKey) {
	string = base64URLEncode(string);

	return await crypto.subtle.verify({
		name: 'HMAC'
	}, secretHMACKey, ASCIIStringToBuffer(signature), ASCIIStringToBuffer(string));
}

async function RSAOAEPDecrypt(string, privateRSAOAEPKey) {
	return bufferToUnicodeString(await crypto.subtle.decrypt({
		name: 'RSA-OAEP'
	}, privateRSAOAEPKey, ASCIIStringToBuffer(base64URLDecode(string))));
}

async function RSAPSSVerify(string, signature, privateRSAPSSKey) {
	string = base64URLEncode(string);

	return await crypto.subtle.verify({
		name: 'RSA-PSS',
		saltLength: 64
	}, privateRSAPSSKey, ASCIIStringToBuffer(signature), ASCIIStringToBuffer(string));
}

async function importAESCBCKey(secretAESCBCKey) {
	return await crypto.subtle.importKey('raw', ASCIIStringToBuffer(base64URLDecode(secretAESCBCKey)), {
		name: 'AES-CBC'
	}, true, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
}

async function importECDHKeys(publicECDHKey, privateECDHKey) {
	return {
		publicECDHKey: await crypto.subtle.importKey('spki', ASCIIStringToBuffer(base64URLDecode(publicECDHKey)), {
			name: 'ECDH',
			namedCurve: 'P-521'
		}, true, ['deriveBits', 'deriveKey']),
		privateECDHKey: privateECDHKey ? await crypto.subtle.importKey('pkcs8', ASCIIStringToBuffer(base64URLDecode(privateECDHKey)), {
			name: 'ECDH',
			namedCurve: 'P-521'
		}, true, ['deriveBits', 'deriveKey']) : null
	};
}

async function importHKDFKey(secretHKDFKey) {
	return await crypto.subtle.importKey('raw', ASCIIStringToBuffer(base64URLDecode(secretHKDFKey)), {
		name: 'HKDF'
	}, false, ['deriveBits', 'deriveKey']);
}

async function importHMACKey(secretHMACKey) {
	return await crypto.subtle.importKey('raw', ASCIIStringToBuffer(base64URLDecode(secretHMACKey)), {
		name: 'HMAC',
		hash: 'SHA-512'
	}, true, ['sign', 'verify']);
}

async function importRSAOAEPKeys(publicRSAOAEPKey, privateRSAOAEPKey) {
	return {
		publicRSAOAEPKey: await crypto.subtle.importKey('spki', ASCIIStringToBuffer(base64URLDecode(publicRSAOAEPKey)), {
			name: 'RSA-OAEP',
			hash: 'SHA-512'
		}, true, ['encrypt', 'wrapKey']),
		privateRSAOAEPKey: privateRSAOAEPKey ? await crypto.subtle.importKey('pkcs8', ASCIIStringToBuffer(base64URLDecode(privateRSAOAEPKey)), {
			name: 'RSA-OAEP',
			hash: 'SHA-512'
		}, true, ['decrypt', 'unwrapKey']) : null
	};
}

async function importRSAPSSKeys(publicRSAPSSKey, privateRSAPSSKey) {
	return {
		publicRSAPSSKey: await crypto.subtle.importKey('spki', ASCIIStringToBuffer(base64URLDecode(publicRSAPSSKey)), {
			name: 'RSA-PSS',
			hash: 'SHA-512'
		}, true, ['verify']),
		privateRSAPSSKey: privateRSAPSSKey ? await crypto.subtle.importKey('pkcs8', ASCIIStringToBuffer(base64URLDecode(privateRSAPSSKey)), {
			name: 'RSA-PSS',
			hash: 'SHA-512'
		}, true, ['sign']) : null
	};
}

async function exportAESCBCKey(secretAESCBCKey) {
	return base64URLEncode(bufferToASCIIString(await crypto.subtle.exportKey('raw', secretAESCBCKey)));
}

async function exportECDHKeys(publicECDHKey, privateECDHKey) {
	return {
		publicECDHKey: base64URLEncode(bufferToASCIIString(await crypto.subtle.exportKey('spki', publicECDHKey))),
		privateECDHKey: privateECDHKey ? base64URLEncode(bufferToASCIIString(await crypto.subtle.exportKey('pkcs8', privateECDHKey))) : null
	};
}

async function exportHMACKey(secretAESCBCKey) {
	return base64URLEncode(bufferToASCIIString(await crypto.subtle.exportKey('raw', secretAESCBCKey)));
}

async function exportRSAOAEPKeys(publicRSAOAEPKey, privateRSAOAEPKey) {
	return {
		publicRSAOAEPKey: base64URLEncode(bufferToASCIIString(await crypto.subtle.exportKey('spki', publicRSAOAEPKey))),
		privateRSAOAEPKey: privateRSAOAEPKey ? base64URLEncode(bufferToASCIIString(await crypto.subtle.exportKey('pkcs8', privateRSAOAEPKey))) : null
	};
}

async function exportRSAPSSKeys(publicRSAPSSKey, privateRSAPSSKey) {
	return {
		publicRSAPSSKey: base64URLEncode(bufferToASCIIString(await crypto.subtle.exportKey('spki', publicRSAPSSKey))),
		privateRSAPSSKey: privateRSAPSSKey ? base64URLEncode(bufferToASCIIString(await crypto.subtle.exportKey('pkcs8', privateRSAPSSKey))) : null
	};
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

//	roomName = base64URLEncode(roomName);

	for (publicRSAOAEPKey of publicRSAOAEPKeys) {
//		console.log(publicRSAOAEPKey);
//		console.log('Yay?');
		secretHKDFKeys.push(await RSAOAEPEncrypt(secretHKDFKey.encodedSecretHKDFKey, (await importRSAOAEPKeys(publicRSAOAEPKey)).publicRSAOAEPKey));
	}

	derivedKey = await HKDFDeriveAESCBCKey(secretHKDFKey.secretHKDFKey, ASCIIStringToBuffer(base64URLEncode('0')));
	secretAESCBCKey = derivedKey.secretAESCBCKey;

	roomName = await AESCBCEncrypt(roomName, secretAESCBCKey);

//	console.log(roomName);

	roomName.encryptedString = base64URLEncode(roomName.encryptedString);
	roomName.iv = base64URLEncode(roomName.iv);

	socket.emit('newRoom', JSON.stringify(roomName), publicRSAOAEPKeys, secretHKDFKeys, usernames);

//	window.history.pushState({room: roomName.encryptedString}, 'Chat', '/room/' + roomName.encryptedString);

//	joinRoom(roomName.encryptedString);

	return roomName;
}

function loadName() {
	if (localStorage.username) {
		name(localStorage.username);

		for (usernameSelector of document.getElementsByClassName('usernameSelector')) {
			console.log(usernameSelector);
			hideNamer(usernameSelector, usernameSelector.className.split(' ')[1]);
		}
	}
}

function addContextMenu(element) {
	element.oncontextmenu = (event) => {
		contextMenu = document.getElementsByClassName('contextMenu')[0];
		contextMenu.style.left = event.clientX + 'px';
		contextMenu.style.top = event.clientY + 'px';
		contextMenu.removeAttribute('hidden');

		event.preventDefault();
		return false;
	};

	document.body.onclick = () => {
		contextMenu = document.getElementsByClassName('contextMenu')[0];
		contextMenu.setAttributeNode(document.createAttribute('hidden'));
	}
}

function makeDraggable(element, draggable) {
	var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

	draggable.onmousedown = (event) => {
		event = event || window.event;
		event.preventDefault();
		pos3 = event.clientX;
		pos4 = event.clientY;
//		console.log(event);

		document.onmouseup = () => {
			document.onmouseup = null;
			document.onmousemove = null;
		}

		document.ontouchend = document.onmouseup;

		document.onmousemove = (event) => {
			event = event || window.event;
			event.preventDefault();
			pos1 = pos3 - event.clientX;
			pos2 = pos4 - event.clientY;
			pos3 = event.clientX;
			pos4 = event.clientY;
			element.style.top = (element.offsetTop - pos2) + 'px';
			element.style.left = (element.offsetLeft - pos1) + 'px';
		}

		document.ontouchmove = document.onmousemove;
	}

	draggable.ontouchstart = draggable.onmousedown;
}

function name(name) {
	if (name.replace(/\s/g, '') === '') {
		name = 'Anonymous';
	}

	socket.emit('name', name);
	localStorage.username = name;
}

function getName() {
	return localStorage.username;
}

function hideNamer(usernameSelector, roomName) {
	usernameSelector.setAttributeNode(document.createAttribute('hidden'));
//	console.log('****' + roomName);
	showChat(roomName);
}

function submitName(event) {
	if (!getName() && (event === 0 || (!keysPressed['Shift'] && !keysPressed[16] && (event.key === 'Enter' || event.keyCode === 13)))) {
		for (var usernameSelector of document.getElementsByClassName('usernameSelector')) {
			var roomName = usernameSelector.className.split(' ')[1];
			name(document.getElementsByClassName('usernameInput ' + roomName)[0].value);
//			console.log(roomName);
			hideNamer(usernameSelector, roomName);
		}
	}
}

async function createRoom() {
	var roomName = document.getElementsByClassName('roomName')[0].value;
	var publicRSAOAEPKeys = replaceAll(document.getElementsByClassName('publicRSAOAEPKeys')[0].value, ' ', '').split(',');

	if (!publicRSAOAEPKeys[0]) {
		publicRSAOAEPKeys.shift();
	}

	publicRSAOAEPKeys.push((await exportRSAOAEPKeys((await getKeys()).publicRSAOAEPKey)).publicRSAOAEPKey);
	createNewRoom(roomName, publicRSAOAEPKeys);
}

function ASCIIStringToBuffer(string) {
	var buffer = new ArrayBuffer(string.length);
	var view = new Uint8Array(buffer);

	for (i = 0; i < string.length; i ++) {
		view[i] = string.charCodeAt(i);
	}

	return buffer;
}

function bufferToASCIIString(buffer) {
	var view = new Uint8Array(buffer);
	var string = '';

	for (i = 0; i < view.length; i ++) {
		string += String.fromCharCode(view[i]);
	}

	return string;
}

function unicodeStringToBuffer(string) {
	var buffer = new ArrayBuffer(string.length * 2);
	var view = new Uint16Array(buffer);

	for (i = 0; i < string.length; i ++) {
		view[i] = string.charCodeAt(i);
	}

	return buffer;
}

function bufferToUnicodeString(buffer) {
	var view = new Uint16Array(buffer);
	var string = '';

	for (i = 0; i < view.length; i ++) {
		string += String.fromCharCode(view[i]);
	}

	return string;
}

async function copyPublicRSAOAEPKey() {
	var publicRSAOAEPKey = document.getElementsByClassName('publicRSAOAEPKey')[0];
	publicRSAOAEPKey.select();
	publicRSAOAEPKey.setSelectionRange(0, 99999);
	document.execCommand('copy');
}

async function sendMessage(roomName, message) {
//	if (!rooms[roomName]) {
//		window.history.pushState({room: 'Home'}, 'Chat', '/');
//		return;
//	}


	if (message.replace(/\s/g, '') != '') {
//		console.log('Sending: ' + message + ' to: ' + roomName);
		encryptedMessage = await AESCBCEncrypt(getName() + ': ' + message, (await HKDFDeriveAESCBCKey(rooms[roomName].secretHKDFKey, ASCIIStringToBuffer(base64URLEncode(rooms[roomName].messageCount.toString())))).secretAESCBCKey)
//		console.log(encryptedMessage);

		message = JSON.stringify({
			id: rooms[roomName].messageCount + 1,
			encryptedString: base64URLEncode(encryptedMessage.encryptedString),
			iv: base64URLEncode(encryptedMessage.iv)
		});

		socket.emit('message', roomName, message);
	}

	socket.emit('newKey', roomName);
}

function submitGlobalChat(event) {
	message = document.getElementsByClassName('chatInput global')[0];

	if (event === 0 || (!keysPressed['Shift'] && !keysPressed[16] && ((keysPressed['Enter'] && event.key === 'Enter') || (keysPressed[13] && event.keyCode === 13)))) {
		socket.emit('globalMessage', getName() + ': ' + message.value);
		message.value = '';

		if (event.preventDefault) {
			event.preventDefault();
		}

		return false;
	}
}

function submitChat(event, roomName) {
	message = document.getElementsByClassName('chatInput ' + roomName)[0];

	if (event === 0 || (!keysPressed['Shift'] && !keysPressed[16] && ((keysPressed['Enter'] && event.key === 'Enter') || (keysPressed[13] && event.keyCode === 13)))) {
		// roomName = window.location.pathname.split('/')[2];
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

function hideChat(roomName) {
	var chat = document.getElementsByClassName('chat ' + roomName)[0];
	var chatMain = document.getElementsByClassName('chatMain ' + roomName)[0];
	var hideChatButton = document.getElementsByClassName('hideChatButton ' + roomName)[0];
	var showChatButton = document.getElementsByClassName('showChatButton ' + roomName)[0];
	chat.style.prevHeight = chat.style.height;
	chat.style.prevWidth = chat.style.width;
	chat.style.minHeight = '4vh';
	chat.style.height = '4vh';
	chat.style.resize = 'none';
	chat.style.width = '150px';
	chatMain.style.display = '';
	hideChatButton.setAttributeNode(document.createAttribute('hidden'));
	showChatButton.removeAttribute('hidden');
	chatMain.setAttributeNode(document.createAttribute('hidden'));
}

function closeChat(roomName) {
	var chatBar = document.getElementsByClassName('chat ' + roomName)[0];
	chatBar.style.display = 'none';
}

function showChat(roomName) {
	var chat = document.getElementsByClassName('chat ' + roomName)[0];
	var chatMain = document.getElementsByClassName('chatMain ' + roomName)[0];
	var hideChatButton = document.getElementsByClassName('hideChatButton ' + roomName)[0];
	var showChatButton = document.getElementsByClassName('showChatButton ' + roomName)[0];
	chat.style.minHeight = '150px';
	chat.style.height = chat.style.prevHeight;
	chat.style.resize = 'both';
	chat.style.width = chat.style.prevWidth;
	chatMain.style.display = 'block';
	hideChatButton.removeAttribute('hidden');
	showChatButton.setAttributeNode(document.createAttribute('hidden'));
	chatMain.removeAttribute('hidden');
}
