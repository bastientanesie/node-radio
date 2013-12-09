var socket = io.connect(),
	widget = null,
	masterCurrentPosition = 0,
	debug = false,
	isMaster = false;

var muteTimer = setInterval(function() {
	// Unmute
	if ($("#mute").attr("data-muted") == 1) {
		widget.setVolume(0);
	}
	else {
		widget.setVolume(100);
	}
}, 1000);


SC.initialize({
	client_id: "4212d80bda8bc46e52087af6b7a464d9"
});

socket.on("level_up", function() {
	isMaster = true;
	$("#role").html("Master");
	document.title = "NodeRadio • Master";

	$("#mute").after(" | <button id=\"prev\" title=\"Previous\">&larr;</button><button id=\"next\" title=\"Next\">&rarr;</button>");

	$("#next").bind("click", function(event) {
		socket.emit("master:next");
		$(this).attr("disabled", "disabled");
	});
	$("#prev").bind("click", function(event) {
		socket.emit("master:prev");
		$(this).attr("disabled", "disabled");
	});
});

socket.on("audience", function(data) {
	$("#audience").html(data.audience);
	$("#tracklist_length").html(data.tracklist);
});

socket.on("tracklist", function(data) {
	// console.log(data.track_url, data.seek_at);

	SC.oEmbed(data.tracklist[data.currentTrack], {
		auto_play: false,
		show_comments: false
	}, function(oembed) {
		// On construit le lecteur dans le DOM
		$("#container").html("").append(oembed.html);

		widget = SC.Widget($("#container iframe")[0]);

		// Lorsque le player est prêt
		widget.bind(SC.Widget.Events.READY, function(event) {
			// On lance la lecture
			widget.play();
		});

		widget.bind(SC.Widget.Events.PLAY_PROGRESS, function(event) {
			if (isMaster) {
				onPlayProgress_Master(event);
			}
			else {
				onPlayProgress(event);
			}
		});

		widget.bind(SC.Widget.Events.SEEK, function(event) {
			// Quand le Master seek vers un endroit, il faut que tous les autres suivent
			if (isMaster) {
				socket.emit("master:seek_to", {
					progress: event.currentPosition
				});
			}
		});

		widget.bind(SC.Widget.Events.PLAY, function(event) {
			// On garde le mute si besoin
			if ($("#mute").attr("data-muted") == 1) {
				widget.setVolume(0);
			}
		});

		widget.bind(SC.Widget.Events.FINISH, function(event) {
			// Quand le Master seek vers un endroit, il faut que tous les autres suivent
			if (isMaster) {
				socket.emit("master:next");
			}
		});
	});
});

// On reçoit la position de la piste actuelle
socket.on("track:seek_to", function(data) {
	// Pour les auditeurs uniquement
	if (!isMaster) {
		masterCurrentPosition = data.position;
	}
});

// Le Master "seek" à un endroit précis, on le suit!
socket.on("track:force_seek_to", function(data) {
	// Pour les auditeurs uniquement
	if (!isMaster) {
		masterCurrentPosition = data.position;
		widget.seekTo(masterCurrentPosition);
	}
});

socket.on("track:next", function(data) {
	$("#next").removeAttr("disabled");

	// On charge la piste
	loadTrack(data.tracklist[data.currentTrack]);
});
socket.on("track:prev", function(data) {
	$("#prev").removeAttr("disabled");

	// On charge la piste
	loadTrack(data.tracklist[data.currentTrack]);
});

$("#mute").bind("click", function() {
	// Unmute
	if ($(this).attr("data-muted") == 1) {
		widget.setVolume(100);
		$(this).attr("data-muted", 0);
		$(this).html("Mute");
	}
	// Mute
	else {
		widget.setVolume(0);
		$(this).attr("data-muted", 1);
		$(this).html("Unmute");
	}
});

$("#url").bind("keyup", function(event) {
	var keycode = (event.keyCode ? event.keyCode : event.which);
	if (keycode == '13' && $(this).val() != "") {
		var regex = new RegExp(/https?:\/\/soundcloud.com\/(.+)\/(?!set)(.+)/);

		// On check si c'est bien une piste SoundCloud (et pas un set ou autre)
		if ($(this).val().match(regex)) {
			socket.emit("audience:add_track", {
				url: $("#url").val()
			});
			alert("Your track has been added to the playlist!")
			$(this).val("");
		}
	}
});



// --------------------------------------------


function loadTrack(track_url) {
	if (widget != null) {
		widget.load(track_url, {
			auto_play: true,
			show_comments: false
		});
	}
}

function onPlayProgress(event) {
	if(debug) console.log("master_seek_position", masterCurrentPosition);
	if(debug) console.log("event.currentPosition", event.currentPosition);
	if(debug) console.log("-", masterCurrentPosition - event.currentPosition);
	if(debug) console.log("+", masterCurrentPosition + event.currentPosition);
	if(debug) console.log("--------");

	var diff = masterCurrentPosition - event.currentPosition;

	// Si la lecture courrante a un décalage de plus de 5sec avec le master
	if (diff >= 5000 || diff <= -5000) {
		console.log("seek to master position");
		widget.seekTo(masterCurrentPosition);
	}
}

function onPlayProgress_Master(event) {
	socket.emit("master:play_progress", {
		progress: event.currentPosition
	});
}