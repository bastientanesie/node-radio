var express = require('express'),
	http = require('http'),
	path = require('path'),
	socket_io = require('socket.io');

// Instanciating stuff
var app = express(),
	server = http.createServer(app),
	io = socket_io.listen(server);


// all environments
app.set('port', 5555);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
// app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('dafuqtrololosmurf'));
app.use(express.session());
app.use(app.router);
// app.use(require('less-middleware')({ src: __dirname + '/public' }));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}


// Socket.IO config
// https://github.com/LearnBoost/Socket.IO/wiki/Configuring-Socket.IO
/**
 * Log Level
 * 0 = error
 * 1 = warn
 * 2 = info
 * 3 = debug
 */
io.set('log level', 2);
/**
 * Authorizing & Handshaking
 * https://github.com/LearnBoost/socket.io/wiki/Authorizing
 */

/**
 * ROUTES
 */
app.get("/", function(req, res) {
	res.render("index");
});
app.get("/master", function(req, res) {
	res.render("master");
});

/**
 * SERVER STARTING
 */
server.listen(app.get('port'), function() {
	console.log("Express server listening on port " + app.get("port"));
});

var users = [],
	master = null,
	tracklist = [
		"https://soundcloud.com/chromeo/over-your-shoulder"
	],
	currentTrack = 0,
	currentPosition = 0,
	master = null;

/**
 * SOCKET.IO EVENTS
 */
io.sockets.on("connection", function(socket) {
	try {
		// Si c'est le premier auditeur
		if (users.length == 0) {
			registerMaster(socket.id);
		}

		// On enregistre l'auditeur
		users.push(socket.id);

		// On envoie le nombre d'auditeurs
		broadcastAudience(socket);

		// On lui envoie la tracklist et la piste actuellement à l'antenne
		sendTracklist(socket);

		// Déconnexion de l'autideur
		socket.on('disconnect', function() {
			// On supprime l'utilisateur de la liste
			var pos = users.indexOf(socket.id);
			users.splice(pos, 1);

			console.log("Goodbye " + socket.id);

			// Si c'est le master qui se déconnecte
			if (socket.id == master) {
				// On enregistre le plus vieil utilisateur en tant que Master
				registerMaster(users[0]);
			}
		});

		// ------------------------------
		// Events en provenance de Master
		// ------------------------------

		// On reçoit la progression de Master, on la renvoie à tout le monde
		socket.on("master:play_progress", function(data) {
			currentPosition = data.progress;

			// On envoie à tous les autres
			socket.broadcast.emit("track:seek_to", {
				position: currentPosition
			});

			broadcastAudience(socket);
		});

		socket.on("master:seek_to", function(data) {
			currentPosition = data.progress;

			// On envoie à tous les autres
			socket.broadcast.emit("track:force_seek_to", {
				position: currentPosition
			});
		});

		socket.on("master:next", function() {
			// On passe à la piste suivante
			var track = tracklist[currentTrack + 1];

			// Si la piste existe
			if (typeof track != "undefined") {
				currentTrack++;
			}
			// Sinon, il y a de fortes chances pour qu'on soit au bout
			// Alors on reprend depuis le début !
			else {
				currentTrack = 0;
			}

			currentPosition = 0;

			io.sockets.emit("track:next", {
				tracklist: tracklist,
				currentTrack: currentTrack
			});
		});

		socket.on("master:prev", function() {
			// On passe à la piste précédente
			var track = tracklist[currentTrack - 1];

			// Si la piste existe
			if (typeof track != "undefined") {
				currentTrack--;
			}
			// Sinon, il y a de fortes chances pour qu'on soit au bout
			// Alors on reprend depuis la fin !
			else {
				currentTrack = tracklist.length - 1;
			}

			currentPosition = 0;

			io.sockets.emit("track:prev", {
				tracklist: tracklist,
				currentTrack: currentTrack
			});
		});

		// ----------------------------------
		// Events en provenance d'un auditeur
		// ----------------------------------

		// Un auditeur a besoin de la position de la piste actuelle
		socket.on("audience:get_play_progress", function() {
		});

		// Un auditeur propose d'ajouter une piste à la playlist
		socket.on("audience:add_track", function(data) {
			// http://gskinner.com/RegExr/
			var regex = new RegExp(/https?:\/\/soundcloud.com\/(.+)\/(?!set)(.+)/);

			// On check si c'est bien une piste SoundCloud (et pas un set ou autre)
			if (data.url.match(regex)) {
				tracklist.push(data.url);
			}
		});
	}
	catch(error) {
		console.error(error);
	}

});

/**
 * Enregistre un nouveau Master
 * @param user_id - L'ID de l'utilisateur ayant le rôle de Master
 */
function registerMaster(user_id) {
	// On récupère le socket avec l'ID
	var socket = io.sockets.sockets[user_id];

	if (typeof socket != "undefined") {
		console.log("NEW MASTER: " + user_id);
		master = user_id;
		socket.emit("level_up");
	}
}

/**
 * Envoie le nombre d'auditeurs à tous les autres auditeurs
 * @param socket - Le socket de l'utilisateur
 */
function broadcastAudience(socket) {
	// socket.broadcast.emit("audience", {
	// 	audience: users.length
	// });
	io.sockets.emit("audience", {
		audience: users.length,
		tracklist: tracklist.length
	});
}

/**
 * Envoie la tracklist et la piste actuellement à l'antenne
 * @param socket - Le socket de l'utilisateur
 */
function sendTracklist(socket) {
	socket.emit("tracklist", {
		tracklist: tracklist,
		currentTrack: currentTrack,
		currentPosition: currentPosition
	});
}