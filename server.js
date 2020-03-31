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
app.use(bodyParser.urlencoded({extended: true}))

// Use ejs as template engine
app.set('view engine', 'ejs');
// Use static folder for .js files
app.use('/static', express.static(__dirname + '/static'));

// Routing Handlers
app.get('/', (req, res) => res.render('pages/index'));

app.post('/', (req, res) => {
  res.render('pages/game', {
    username: req.body.username
  });
});

// Player list
var players = {};
var numPlayers = 0;
var board = [];
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const SNAKE_SIZE = 20;
const WIDTH = CANVAS_WIDTH / SNAKE_SIZE;
const HEIGHT = CANVAS_HEIGHT / SNAKE_SIZE;
const SNAKE_COLORS = ['#00FF00', '#0000FF', '#00FFFF', '#FF00FF', '#C0C0C0', '#800000', '#800080', '#808000', '#8B4513'];
var curColorIndex = 0;
const SNAKE_COLORS_LENGTH = SNAKE_COLORS.length;
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
var updateScoreboard = false;

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
    // console.log('All connected players:');
    // for (let id in players)
    //   console.log(players[id]);
    // console.log();
  });

  socket.on('new player', username => {
    let nextColor = SNAKE_COLORS[curColorIndex++ % SNAKE_COLORS_LENGTH];
    // Get random starting position that isn't occupied
    let initialPos = newPlayerPos(options, nextColor);
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
      nextDir: initialDir,
      curDir: initialDir,
      color: nextColor
    };
    socket.emit('initial position', {pos: initialPos, color: nextColor});
    numPlayers++;
    console.log('New player: ' + socket.id);
    // console.log(players[socket.id]);

    // console.log('All connected players:');
    // for (let id in players)
    //   console.log(players[id]);
    // console.log();
  });

  socket.on('change direction', nextDirection => {
    // console.log('Received direction change: ' + nextDirection);
    if (players[socket.id].length == 1 || (players[socket.id].curDir != nextDirection && players[socket.id].curDir != opposite[nextDirection])) {
      players[socket.id].nextDir = nextDirection;
    } else {
      console.log('Direction change denied: ' + nextDirection);
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
  for (let len = options.length; len > 0; len--) {
    let ind = randInt(0, len);
    let pos = options[ind];
    if (board[pos.y][pos.x] == BOARD_COLOR) {
      console.log('Apple:');
      console.log(pos);
      board[pos.y][pos.x] = APPLE_COLOR;
      return pos;
    }
    options.splice(ind, 1);
  }
  endGame();
}


function newPlayerPos(options, color) {
  for (let len = options.length; len > 0; len--) {
    let ind = randInt(0, len);
    let pos = options[ind];
    if (board[pos.y][pos.x] == BOARD_COLOR) {
      board[pos.y][pos.x] = color;
      return pos;
    }
    options.splice(ind, 1);
  }
  endGame();
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
      switch (tempPlayer.nextDir) {
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
  // set tail of each remaining array in board to board color, delete last element
  for (let id in players) {
    let headPos = players[id].body[players[id].length];
    if (board[headPos.y][headPos.x] == APPLE_COLOR) {
      players[id].length++;
      needNewApple = true;
      updateScoreboard = true;
    } else {
      let tailPos = players[id].body[0];
      board[tailPos.y][tailPos.x] = BOARD_COLOR;
      players[id].body.shift();
    }
  }
  // set head of each array in board to snake color AND update their direction
  for (let id in players) {
    let headPos = players[id].body[players[id].length - 1];
    board[headPos.y][headPos.x] = players[id].color;
    players[id].curDir = tempPlayers[id].nextDir;
  }
  // If an apple was just eaten, generate a new apple
  if (needNewApple)
    apple = newApple(options);
    needNewApple = false;

}


setInterval(() => {
  updateBoard();
  io.emit('new board', board);
  if (updateScoreboard) {
    let scoreboard = [];
    let counter = 0;
    for (let id in players) {
      scoreboard.push({username: players[id].username, score: players[id].length})
      counter++;
      if (counter >= 6)
        break;
    }
    io.emit('scoreboard update', scoreboard.sort((a, b) => {
      return b.score - a.score;
    }))
    updateScoreboard = false;
  }
}, 1000 / 5);
