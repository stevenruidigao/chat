if ('serviceWorker' in navigator) {
	window.addEventListener('load', function() {
		navigator.serviceWorker.register('/sw.js').then(function(registration) {
			// Registration was successful
			console.log('ServiceWorker registration successful with scope: ', registration.scope);
		}, function(err) {
			// Registration Failed :(
			console.log('ServiceWorker registration failed: ', err);
		});
	});
}

