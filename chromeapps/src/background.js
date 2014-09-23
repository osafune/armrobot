chrome.app.runtime.onLaunched.addListener(function() {
	var windowoption = {
		bounds :{
			width : 420,
			height : 430
		},
		resizable : true
	}

	chrome.app.window.create('main.html', windowoption, function() {
	});
});
