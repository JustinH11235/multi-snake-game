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
var players = {};
var numPlayers = 0;
var board = [];
const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 200;
const SNAKE_SIZE = 20;
const WIDTH = CANVAS_WIDTH / SNAKE_SIZE;
const HEIGHT = CANVAS_HEIGHT / SNAKE_SIZE;
const SNAKE_COLOR = '#00FF00';// CHANGE!!!
const APPLE_COLOR = '#FF0000';
const BOARD_COLOR = '#FFFFFF';
for (let i = 0; i < HEIGHT; i++) {
  board[i] = [];
  for (let j = 0; j < WIDTH; j++)
    board[i][j] = BOARD_COLOR;
}
// Creates array of all possible positions on board
const options = [];
for (let i = 0; i < HEIGHT; i++)
  for (let j = 0; j < WIDTH; j++)
    options.push({x: j, y: i});
// Creates new apple position w/ side effect of rendering it on board
var apple = newApple(options); /// {x: _, y: _}
var needNewApple = false;

const opposite = {'up': 'down', 'left': 'right', 'down': 'up', 'right': 'left'};

// Socket.io Handlers
io.on('connection', (socket) => {

  console.log('Client connected');

  socket.on('disconnect', () => {
    // If user manually disconnected
    if (socket.id in players) {
      let body = players[socket.id].body;
      for (let part = 0, length = players[socket.id].length; part < length; part++) {
        board[body[part].y][body[part].x] = BOARD_COLOR;
      }
      console.log(players[socket.id].username + ' LOST (Manual Disconnect)');
      delete players[socket.id];
      numPlayers--;
    }
    console.log('Client disconnected');
    console.log('All connected players:');
    for (let id in players)
      console.log(players[id]);
    console.log();
  });

  socket.on('new player', username => {
    // Get random starting position that isn't occupied
    let initialPos = newPlayerPos(options);
    // Find best starting direction, if no best, set to right
    if (initialPos.x < WIDTH - 1 && board[initialPos.y][initialPos.x + 1] in [BOARD_COLOR, APPLE_COLOR]) {
      var initialDir = 'right';
    } else if (initialPos.y > 0 && board[initialPos.y - 1][initialPos.x] in [BOARD_COLOR, APPLE_COLOR]) {
      var initialDir = 'up';
    } else if (initialPos.y < HEIGHT - 1 && board[initialPos.y + 1][initialPos.x] in [BOARD_COLOR, APPLE_COLOR]) {
      var initialDir = 'down';
    } else if (initialPos.x > 0 && board[initialPos.y][initialPos.x - 1] in [BOARD_COLOR, APPLE_COLOR]) {
      var initialDir = 'left';
    } else {
      var initialDir = 'right';
    }
    players[socket.id] = {
      username: username,
      length: 1,
      body: [initialPos],
      dir: initialDir
    };
    socket.emit('initial position', initialPos);
    numPlayers++;
    console.log('New player: ' + socket.id);
    console.log(players[socket.id]);

    console.log('All connected players:');
    for (let id in players)
      console.log(players[id]);
    console.log();
  });

  socket.on('change direction', newDirection => {
    console.log('Received direction change: ' + newDirection);
    // console.log('Test: ' + (players[socket.id].length == 1).toString() + ' ' + (players[socket.id].dir != newDirection).toString());
    // console.log(players[socket.id].dir);
    if (players[socket.id].length == 1 || (players[socket.id].dir != newDirection && players[socket.id].dir != opposite[newDirection])) {
      players[socket.id].dir = newDirection;
    } else {
      console.log('Direction change denied: ' + newDirection);
    }
  });

});


function endGame() {
  for (let id in io.sockets.connected)
    io.sockets.connected[id].disconnect(true);
  console.log('GAME OVER - All positions occupied');
}


function randInt(start, end) {
  return start + Math.floor(Math.random() * (end - start));
}


function newApple(options) {
  if (options.length == 0)
    endGame();
  var pos = options[randInt(0, options.length)];
  if (board[pos.y][pos.x] == BOARD_COLOR) {
    console.log(pos);
    board[pos.y][pos.x] = APPLE_COLOR;
    return pos;
  }
  return newApple(options.filter((value, index, arr) => value != pos));
}


function newPlayerPos(options) {
  if (options.length == 0)
    endGame();
  var pos = options[randInt(0, options.length)];
  if (board[pos.y][pos.x] == BOARD_COLOR) {
    board[pos.y][pos.x] = SNAKE_COLOR;
    return pos;
  }
  return newPlayerPos(options.filter((value, index, arr) => value != pos));
}


// push to add, shift to remove           tail --> x1 --> x2 --> head
function updateBoard() {

  // Make copy of players to lock in direction and to use as a fixed length player list later on
  var tempPlayers = JSON.parse(JSON.stringify(players));
  for (let id in tempPlayers) {
    if (id in players) {
      let tempPlayer = tempPlayers[id];
      let body = players[id].body;
      let head = players[id].length;
      switch (tempPlayer.dir) {
        case 'up':
          body.push({x: body[head - 1].x, y: body[head - 1].y - 1});
          break;
        case 'left':
          body.push({x: body[head - 1].x - 1, y: body[head - 1].y});
          break;
        case 'down':
          body.push({x: body[head - 1].x, y: body[head - 1].y + 1});
          break;
        case 'right':
          body.push({x: body[head - 1].x + 1, y: body[head - 1].y});
          break;
        default:
          break;
      }
      // Logic for wall collisions - If head hit a wall, remove player, ignore head
      if (body[head].x < 0 || body[head].x >= WIDTH || body[head].y < 0 || body[head].y >= HEIGHT) {
        for (let part = 0; part < head; part++) {
          board[body[part].y][body[part].x] = BOARD_COLOR;
        }
        console.log(players[id].username + ' LOST (Hit Wall)');
        delete players[id];
        numPlayers--;
        io.sockets.connected[id].disconnect(true);
      }
    }
  }

  // Logic for snake-on-snake collissions
  // For head in heads, if collided w/ snake, delete player, ignore head
  for (let id in tempPlayers) {
    if (id in players) {
      let head = players[id].length;
      let headX = players[id].body[head].x;
      let headY = players[id].body[head].y;
      for (let otherID in tempPlayers) {
        if (otherID in players) {
          for (let pos = 0; pos < players[otherID].body.length; pos++) {
            if (headX == players[otherID].body[pos].x && headY == players[otherID].body[pos].y && (otherID != id || pos != head)) {
                let body = players[id].body;
                for (let part = 0; part < head; part++) {
                  board[body[part].y][body[part].x] = BOARD_COLOR;
                }
                console.log(players[id].username + ' LOST (Collided With Snake)');
                delete players[id];
                numPlayers--;
                io.sockets.connected[id].disconnect(true);
                break;
            }
          }
        }
      }
    }
  }
  // At this point all players are legal---------------------------------------
  // This is updateBoard():
  // set tail of each remaining array in board to white, delete last element
  for (let id in players) {
    let headPos = players[id].body[players[id].length];
    if (board[headPos.y][headPos.x] == APPLE_COLOR) {
      players[id].length++;
      needNewApple = true;
    } else {
      let tailPos = players[id].body[0];
      board[tailPos.y][tailPos.x] = BOARD_COLOR;
      players[id].body.shift();
    }
  }
  // set head of each array in board to snake color
  for (let id in players) {
    let headPos = players[id].body[players[id].length - 1];
    board[headPos.y][headPos.x] = SNAKE_COLOR;
  }
  // If an apple was just eaten, generate a new apple
  if (needNewApple)
    apple = newApple(options);
    needNewApple = false;

}

setInterval(() => {
  updateBoard();
  io.emit('new board', board);
}, 1000 / 1/*60*/);
