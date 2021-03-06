var CACHE_VERSION = 1
var CACHE_NAME = 'stvnrdg.me-cache-v' + CACHE_VERSION;
var urlsToCache = [
	'/',
	'/favicon.ico',
	'/images/logo-192x192.png',
	'/index.html',
	'/manifest.webmanifest',
	'/scripts/client.js',
	'/scripts/register.js',
	'/styles/main.css'
];

function updateCache(url) {
	var response = fetch(url).then(function(response) {
		caches.open(CACHE_NAME).then(function(cache) {
			cache.put(url, response.clone());
			return response;
		});
	}).catch(function(e) {
		console.log('You\'re offline.');
	})
	return response;
}

self.addEventListener('fetch', function(event) {
	event.respondWith(
		// caches.match(event.request).then(function(response) {
			// return response || fetch(event.request);
		// })
		caches.match(event.request).then(function(response) {
			setTimeout(function() {updateCache(event.request)}, 0);
			return response || updateCache(event.request);
		}).catch(function() {
			console.log('An error occurred.');
		})
	);
});

self.addEventListener('install', function(event) {
	// Perform install steps
	event.waitUntil(
		caches.open(CACHE_NAME).then(function(cache) {
			return cache.addAll(urlsToCache);
		})
	);
});
