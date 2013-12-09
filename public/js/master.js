var socket = io.connect(),
	widget = null;

SC.initialize({
	client_id: "4212d80bda8bc46e52087af6b7a464d9"
});

socket.on("track_url", function(data) {
	// console.log(data.track_url, data.seek_at);
	
	$("#container").html("");

	SC.oEmbed(data.track_url, {
		auto_play: true,
		show_comments: false
	}, function(oembed) {
		$("#container").append(oembed.html);

		widget = SC.Widget($("#container iframe")[0]);
		widget.bind(SC.Widget.Events.READY, function() {
			console.log("widget ready");
		});

		widget.bind(SC.Widget.Events.PLAY_PROGRESS, function(event) {
			// event.relativePosition, event.loadProgress
			socket.emit("play_progress", {
				progress: event.currentPosition
			});
		});
	});
});

$("#mute").bind("click", function() {
	if ($(this).attr("data-muted") == 1) {
		widget.setVolume(100);
		$(this).attr("data-muted", 0);
		$(this).html("Mute");
	}
	else {
		widget.setVolume(0);
		$(this).attr("data-muted", 1);
		$(this).html("Unmute");
	}
});