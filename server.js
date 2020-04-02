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
var blankBoard = [];
var blackBoard = [];
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1000;
const SNAKE_SIZE = 20;
const WIDTH = CANVAS_WIDTH / SNAKE_SIZE;
const HEIGHT = CANVAS_HEIGHT / SNAKE_SIZE;
const CLIENT_WIDTH = 13;
const CLIENT_HEIGHT = 13;
const CLIENT_XRANGE = (CLIENT_WIDTH - 1) / 2;
const CLIENT_YRANGE = (CLIENT_HEIGHT - 1) / 2;
const SNAKE_COLORS = ['#00FF00', '#0000FF', '#00FFFF', '#FF00FF', '#800000', '#800080', '#808000', '#8B4513'];
var curColorIndex = 0;
const SNAKE_COLORS_LENGTH = SNAKE_COLORS.length;
const NUM_APPLES = 3;
const APPLE_COLORS = ['#FF0000', '#FE0000'];
const BOARD_COLORS = ['#FFFFFF', '#F9F9F9'];
const P1 = [BOARD_COLORS[0], BOARD_COLORS[0], BOARD_COLORS[1], BOARD_COLORS[1], BOARD_COLORS[1]];
const P2 = [BOARD_COLORS[0], BOARD_COLORS[0], BOARD_COLORS[1], BOARD_COLORS[0], BOARD_COLORS[1]];
// Create large checkered board for reference later
for (let i = 0; i < HEIGHT; i++) {
  blankBoard[i] = [];
  if (i % 5 == 0 || i % 5 == 1) {
    for (let j = 0; j < WIDTH; j++)
      blankBoard[i][j] = BOARD_COLORS[0];
  }
  if (i % 5 == 2 || i % 5 == 4) {
    for (let j = 0; j < WIDTH; j++)
      blankBoard[i][j] = P1[j % 5];
  }
  if (i % 5 == 3) {
    for (let j = 0; j < WIDTH; j++)
      blankBoard[i][j] = P2[j % 5];
  }
}
// Create large checkered board as starting point of game board
for (let i = 0; i < HEIGHT; i++) {
  board[i] = [];
  if (i % 5 == 0 || i % 5 == 1) {
    for (let j = 0; j < WIDTH; j++)
      board[i][j] = BOARD_COLORS[0];
  }
  if (i % 5 == 2 || i % 5 == 4) {
    for (let j = 0; j < WIDTH; j++)
      board[i][j] = P1[j % 5];
  }
  if (i % 5 == 3) {
    for (let j = 0; j < WIDTH; j++)
      board[i][j] = P2[j % 5];
  }
}
// Create black board as base to send to clients
for (let i = 0; i < CLIENT_HEIGHT; i++) {
  blackBoard[i] = [];
  for (let j = 0; j < CLIENT_WIDTH; j++)
    blackBoard[i][j] = '#000000';
}
// Creates array of all possible positions on board
const baseOptions = [];
for (let i = 0; i < HEIGHT; i++)
  for (let j = 0; j < WIDTH; j++)
    baseOptions.push({x: j, y: i});
// Creates new apple positions w/ side effect of rendering them on board
var apples = [];
for (let i = 0; i < NUM_APPLES; i++)
  apples.push(newApple());
var numApplesNeeded = 0;
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
        board[body[part].y][body[part].x] = blankBoard[body[part].y][body[part].x];
      }
      console.log(players[socket.id].username + ' LOST (Manual Disconnect)');
      delete players[socket.id];
      numPlayers--;
    }
    console.log('Client disconnected');
  });

  socket.on('new player', username => {
    let nextColor = SNAKE_COLORS[curColorIndex++ % SNAKE_COLORS_LENGTH];
    // Get random starting position that isn't occupied
    let initialPos = newPlayerPos(nextColor);
    // Find best starting direction, if no best, set to right
    if (initialPos.x < WIDTH - 1 && BOARD_COLORS.indexOf(board[initialPos.y][initialPos.x + 1]) != -1 || APPLE_COLORS.indexOf(board[initialPos.y][initialPos.x + 1]) != -1) {
      var initialDir = 'right';
    } else if (initialPos.y > 0 && BOARD_COLORS.indexOf(board[initialPos.y - 1][initialPos.x]) != -1 || APPLE_COLORS.indexOf(board[initialPos.y][initialPos.x + 1]) != -1) {
      var initialDir = 'up';
    } else if (initialPos.y < HEIGHT - 1 && BOARD_COLORS.indexOf(board[initialPos.y + 1][initialPos.x]) != -1 || APPLE_COLORS.indexOf(board[initialPos.y][initialPos.x + 1]) != -1) {
      var initialDir = 'down';
    } else if (initialPos.x > 0 && BOARD_COLORS.indexOf(board[initialPos.y][initialPos.x - 1]) != -1 || APPLE_COLORS.indexOf(board[initialPos.y][initialPos.x + 1]) != -1) {
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
    let newBoard = JSON.parse(JSON.stringify(blackBoard));
    for (let i = initialPos.y - CLIENT_YRANGE; i <= initialPos.y + CLIENT_YRANGE; i++) {
      for (let j = initialPos.x - CLIENT_XRANGE; j <= initialPos.x + CLIENT_XRANGE; j++) {
        if (j >= 0 && j < WIDTH && i >= 0 && i < HEIGHT) {
          newBoard[i + CLIENT_YRANGE - initialPos.y][j + CLIENT_XRANGE - initialPos.x] = board[i][j];
        }
      }
    }
    socket.emit('initial board', newBoard);
    numPlayers++;
    console.log('New player: ' + socket.id);
  });

  socket.on('change direction', nextDirection => {
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


function killPlayer(id, msg) {
  let body = players[id].body;
  for (let part = 0; part < players[id].length; part++) {
    if (part % 4 == 3)
      board[body[part].y][body[part].x] = APPLE_COLORS[1];
    else
      board[body[part].y][body[part].x] = blankBoard[body[part].y][body[part].x];
  }
  console.log(players[id].username + ' LOST (' + msg + ')');
  delete players[id];
  io.sockets.connected[id].disconnect(true);
  numPlayers--;
}


function randInt(start, end) {
  return start + Math.floor(Math.random() * (end - start));
}


function newApple() {
  var options = JSON.parse(JSON.stringify(baseOptions));
  for (let len = options.length; len > 0; len--) {
    let ind = randInt(0, len);
    let pos = options[ind];
    if (BOARD_COLORS.indexOf(board[pos.y][pos.x]) != -1) {
      console.log('New Apple:');
      console.log(pos);
      board[pos.y][pos.x] = APPLE_COLORS[0];
      return pos;
    }
    options.splice(ind, 1);
  }
  endGame();
}


function newPlayerPos(color) {
  var options = JSON.parse(JSON.stringify(baseOptions));
  for (let len = options.length; len > 0; len--) {
    let ind = randInt(0, len);
    let pos = options[ind];
    if (BOARD_COLORS.indexOf(board[pos.y][pos.x]) != -1) {
      console.log('Player Pos:');
      console.log(pos);
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
      if (body[head].x < 0 || body[head].x >= WIDTH || body[head].y < 0 || body[head].y >= HEIGHT)
        killPlayer(id, 'Hit Wall');
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
                killPlayer(id, 'Collided With Snake');
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
    if (board[headPos.y][headPos.x] == APPLE_COLORS[0]) {
      players[id].length++;
      apples.splice(apples.indexOf({x: headPos.x, y: headPos.y}), 1);
      numApplesNeeded++;
      updateScoreboard = true;
    } else if (board[headPos.y][headPos.x] == APPLE_COLORS[1]){
      players[id].length++;
      updateScoreboard = true;
    } else {
      let tailPos = players[id].body[0];
      board[tailPos.y][tailPos.x] = blankBoard[tailPos.y][tailPos.x];
      players[id].body.shift();
    }
  }
  // set head of each array in board to snake color AND update their direction
  for (let id in players) {
    let headPos = players[id].body[players[id].length - 1];
    board[headPos.y][headPos.x] = players[id].color;
    players[id].curDir = tempPlayers[id].nextDir;
  }
  // If at least one original apple was just eaten, generate new apples
  for (; numApplesNeeded > 0; numApplesNeeded--)
    apples.push(newApple());

}


setInterval(() => {
  updateBoard();

  for (let id in players) {
    let pos = players[id].body[players[id].length - 1];
    let newBoard = JSON.parse(JSON.stringify(blackBoard));
    for (let i = pos.y - CLIENT_YRANGE; i <= pos.y + CLIENT_YRANGE; i++) {
      for (let j = pos.x - CLIENT_XRANGE; j <= pos.x + CLIENT_XRANGE; j++) {
        if (j >= 0 && j < WIDTH && i >= 0 && i < HEIGHT) {
          newBoard[i + CLIENT_YRANGE - pos.y][j + CLIENT_XRANGE - pos.x] = board[i][j];
        }
      }
    }
    io.sockets.connected[id].emit('new board', newBoard);
  }
  io.emit('board sent');

  if (updateScoreboard) {
    let scoreboard = [];
    let counter = 0;
    for (let id in players) {
      scoreboard.push({username: players[id].username, score: players[id].length, color: players[id].color})
      counter++;
      if (counter >= 3)
        break;
    }
    io.emit('scoreboard update', scoreboard.sort((a, b) => {
      return b.score - a.score;
    }))
    updateScoreboard = false;
  }
}, 1000 / 7);
