let deferredPrompt;
var installButton = document.getElementById('install');

window.addEventListener('beforeinstallprompt', (event) => {
	event.preventDefault();
	deferredPrompt = event;
	installButton.style.display = 'inline';
});

installButton.addEventListener('click', (event) => {
	installButton.style.display = 'none';
	deferredPrompt.prompt();

	deferredPrompt.userChoice.then((choiceResult) => {
		if (choiceResult.outcome === 'accepted') {
			console.log('User accepted the A2HS prompt');

		} else {
			console.log('User dismissed the A2HS prompt');
		}

		deferredPrompt = null;
	});
});

var socket = io.connect();

socket.on('connected', (uuid) => {
	var id = uuid;
	console.log('Connected successfully to the socket.io server. My server side ID is ' + id);
});

socket.on('chat', (message, id)) => {
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

function sendMessage(message) {
	if (message.replace(/\s/g, '') != '')  {
		socket.emit('chat', message);
	}
}

function name(name) {
	socket.emit('name', name);
	document.cookie = 'username=' + name;
	console.log(document.cookie);
}

function hideNamer() {
	var username = document.getElementsByClassName('username');
	var usernameSelector = document.getElementsByClassName('usernameSelector')[0];
	var chatMain = document.getElementsByClassName('chatMain');
	username.hidden = 'true';
	usernameSelector.hidden = 'true';
	chatMain.removeAttribute('hidden');
}

function submitName(e) {
	if (e.keyCode == 13 || e == 0) {
		var username = document.getElementsByClassName('username');
		name(username.value);
		hideNamer();
	}
}
function submitChat(e) {
	var message = document.getElementsByClassName('chatInput');
	if (e.keyCode == 13 || e == 0) {
		chat(message.value);
		message.value = '';
	}
}

function hideChat(index) {
	var chatMain = document.getElementsByClassName('chatMain ' + index);
	var showChat = document.getElementsByClassName('showChat ' + index);
	chatMain.style.display = '';
	showChat.removeAttribute('hidden');
}

function closeChat(index) {
	var chatBar = document.getElementsByClassName('chat ' + index);
	chatBar.style.display = 'none';
}

function showChat(index) {
	var chatMain = document.getElementsByClassName('chatMain ' + index);
	var showChat = document.getElementsByClassName('showChat ' + index);
	showChat.setAttributeNode(document.createAttribute('hidden'));
	chatMain.style.display = 'block';
}
