'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const socketIO = require('socket.io');

const PORT = process.env.PORT || 3000;
const INDEX = '/index.html';

const app = express();
const http = require('http').Server(app);
const server = http.listen(PORT, () => console.log('server is running on port', server.address().port));
const io = socketIO(http);

// Setup bodyParser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}))

// Use ejs as template engine
app.set('view engine', 'ejs');

// Routing Handlers
app.get('/', (req, res) => res.render('pages/index'));

app.post('/', (req, res) => {
  res.render('pages/game', {
    username: req.body.username
  });
});

app.get('/test', (req, res) => res.send('Hello World!'));

// Player list
var players = {}; // {id: {username: 'username', x: 'x', y: 'y'}, id2: {}, ...}
var board = [];
const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 200;
const SNAKE_SIZE = 20;
const WIDTH = CANVAS_WIDTH / SNAKE_SIZE;
const HEIGHT = CANVAS_HEIGHT / SNAKE_SIZE;
for (let i = 0; i < HEIGHT; i++) {
  board[i] = [];
  for (let j = 0; j < WIDTH; j++) {
    board[i][j] = '#FFFFFF';
  }
}

// Socket.io Handlers
io.on('connection', (socket) => {

  console.log('Client connected');

  socket.on('disconnect', () => {
    if (socket.id in players)
      delete players[socket.id];
    console.log('Client disconnected');
    console.log('All connected players:');
    for (let id in players)
      console.log(players[id]);
    console.log();
  });

  socket.on('new player', username => {
    players[socket.id] = {
      username: username,
      x: 0,//change later to an array
      y: 0,//change later to an array
      dir: 'right'
    };
    console.log('New player: ' + socket.id);
    console.log(players[socket.id]);

    console.log('All connected players:');
    for (let id in players)
      console.log(players[id]);
    console.log();
  });

  socket.on('change direction', newDirection => {
    players[socket.id].dir = newDirection;
    console.log('Received direction change: ' + newDirection);
  });

});


function updatePlayers() {
  //code
  // simply update each player property
  // Make copy of players to lock in data but use original player's x and y pos
  var tempPlayers = JSON.parse(JSON.stringify(players));
  for (let id in tempPlayers) {
    let tempPlayer = tempPlayers[id];
    let player = players[id];
    board[player.y][player.x] = '#FFFFFF';
    switch (tempPlayer.dir) {
      case 'up':
        player.y--;
        break;
      case 'left':
        player.x--;
        break;
      case 'down':
        player.y++;
        break;
      case 'right':
        player.x++;
        break;
      default:
        break;
    }
    // Logic for wall collisions
    if (player.y >= 0 && player.y < HEIGHT && player.x >= 0 && player.x < WIDTH) {
      board[player.y][player.x] = '#00FF00';
    }
    else {
      console.log(tempPlayer.username + ' LOST (Hit Wall)');
      io.sockets.connected[id].disconnect(true);
    }
  }
}


function advanceBoard() {
  // maybe do this inside update player? make it a function that does an individual player
  //for each player, check if the next head pos already has a snake body, if so, player loses, if not advance snake

}


setInterval(() => {
  updatePlayers();
  //advanceBoard(); uncomment when I code the logic for collisions, wall-detection, apple eating get rid of and put inside updatePlayers()
  io.emit('new board', board)
}, 1000 / 1/*60*/);
