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

const pq = require('./custom_modules/PriorityQueue.js')

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
var bots = {};
var board = [];
var blankBoard = [];
var blackBoard = [];
var apples = [];
const NUM_BOTS = 2;
const BOT_USERNAMES = ['j', 'yellow', 'jacket', 'Johnathan', 'jery', 'wow'];
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
const NUM_APPLES = 10;
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
for (let i = 0; i < NUM_APPLES; i++)
  apples.push(newApple());
var updateScoreboard = false;

// Bot setup
for (let i = NUM_BOTS; i > 0; i--) {
  let botID = 'bot' + i;
  let nextColor = SNAKE_COLORS[randInt(0, SNAKE_COLORS_LENGTH)];
  // Get random starting position that isn't occupied
  let initialPos = newBotPos(nextColor);
  let initialDir = 'right'
  bots[botID] = {
    username: BOT_USERNAMES[randInt(0, BOT_USERNAMES.length)],
    length: 1,
    body: [initialPos],
    dir: initialDir,
    color: nextColor
  };
  console.log('New bot: ' + botID);
}

const opposite = {'up': 'down', 'left': 'right', 'down': 'up', 'right': 'left'};

// Socket.io Handlers
io.on('connection', (socket) => {

  console.log('Client connected');

  // Ensuring socket id is unique (not a bot id)
  if (socket.id in bots) {
    io.sockets.connected[socket.id].disconnect(true);
    console.log('Socket id mirrored bot id');
  }

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
    let nextColor = SNAKE_COLORS[0, randInt(0, SNAKE_COLORS_LENGTH)];
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


function killBot(id, msg) {
  let body = bots[id].body;
  for (let part = 0; part < bots[id].length; part++) {
    if (part % 4 == 3)
      board[body[part].y][body[part].x] = APPLE_COLORS[1];
    else
      board[body[part].y][body[part].x] = blankBoard[body[part].y][body[part].x];
  }
  console.log(bots[id].username + ' LOST (' + msg + ')');
  delete bots[id];
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


function myIndexOf(arr, pos) {
  for (let i = 0; i < arr.length; i++) {
    if (pos.x == arr[i].x && pos.y == arr[i].y) {
      return i;
    }
  }
  return -1;
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


function newBotPos(color) {
  var options = JSON.parse(JSON.stringify(baseOptions));
  for (let len = options.length; len > 0; len--) {
    let ind = randInt(0, len);
    let pos = options[ind];
    if (BOARD_COLORS.indexOf(board[pos.y][pos.x]) != -1) {
      console.log('Bot Pos:');
      console.log(pos);
      board[pos.y][pos.x] = color;
      return pos;
    }
    options.splice(ind, 1);
  }
  console.log('No room for new bot. No bot added.');
}


function botWouldHitSnake(botID, botPos) {
  var botX = botPos.x;
  var botY = botPos.y;

  for (let id in players) {
    for (let pos = 0; pos < players[id].length; pos++) {
      if (botX == players[id].body[pos].x && botY == players[id].body[pos].y) {
          return true;
      }
    }
  }
  for (let id in bots) {
    for (let pos = 0; pos < bots[id].body.length; pos++) {
      // Don't need to check if it "hit" its own head because a new head hasn't been pushed yet
      if (botX == bots[id].body[pos].x && botY == bots[id].body[pos].y) {
          return true;
      }
    }
  }
  return false;
}


function manhattanDistance(pos1, pos2) {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}


function neighbors(botID, pos, banned) {
  if (banned === undefined)
    banned = [];
  var neighbors = []
  if (pos.x + 1 < WIDTH && myIndexOf(banned, {x: pos.x + 1, y: pos.y}) == -1 && !botWouldHitSnake(botID, {x: pos.x + 1, y: pos.y})) {
    neighbors.push({pos: {x: pos.x + 1, y: pos.y}, dir: 'right'});
  }
  if (pos.x - 1 >= 0 && myIndexOf(banned, {x: pos.x - 1, y: pos.y}) == -1 && !botWouldHitSnake(botID, {x: pos.x - 1, y: pos.y})) {
    neighbors.push({pos: {x: pos.x - 1, y: pos.y}, dir: 'left'});
  }
  if (pos.y + 1 < HEIGHT && myIndexOf(banned, {x: pos.x, y: pos.y + 1}) == -1 && !botWouldHitSnake(botID, {x: pos.x, y: pos.y + 1})) {
    neighbors.push({pos: {x: pos.x, y: pos.y + 1}, dir: 'down'});
  }
  if (pos.y - 1 >= 0 && myIndexOf(banned, {x: pos.x, y: pos.y - 1}) == -1 && !botWouldHitSnake(botID, {x: pos.x, y: pos.y - 1})) {
    neighbors.push({pos: {x: pos.x, y: pos.y - 1}, dir: 'up'});
  }
  return neighbors;
}


function findNextDirection(id, startPos, goalPos) {
  var queue = new pq.PriorityQueue(WIDTH * HEIGHT);
  var prevSeen = [];
  if (bots[id].length != 1) {
    switch (bots[id].dir) {
      case 'right':
        queue.enqueue(new pq.Node(startPos, null, null, [{x: startPos.x - 1, y: startPos.y}]), 0);
        break;
      case 'left':
        queue.enqueue(new pq.Node(startPos, null, null, [{x: startPos.x + 1, y: startPos.y}]), 0);
        break;
      case 'down':
        queue.enqueue(new pq.Node(startPos, null, null, [{x: startPos.x, y: startPos.y - 1}]), 0);
        break;
      case 'up':
        queue.enqueue(new pq.Node(startPos, null, null, [{x: startPos.x, y: startPos.y + 1}]), 0);
        break;
      default:
        break;
    }
  } else {
    queue.enqueue(new pq.Node(startPos, null, null, []), 0);
  }

  var curNode;
  while (!queue.isEmpty()) {
    let curElem = queue.dequeue();
    curNode = curElem.data;
    let curPriority = curElem.priority;
    // If we haven't already seen this position
    if (myIndexOf(prevSeen, curNode.position) == -1) {
      // Is closestApplePos
      if (curNode.position.x == goalPos.x && curNode.position.y == goalPos.y) {
        if (curNode.parent == null) {
          return curNode.direction
        }
        while (curNode.parent.parent != null) {
          curNode = curNode.parent;
        }
        // This is first move (2nd node)
        return curNode.direction;
      }
      // Is not closestApplePos, add pos to prevSeen and add neighbors to queue
      prevSeen.push(curNode.position);
      var nodeNeighbors = neighbors(id, curNode.position, curNode.banned);
      for (let i in nodeNeighbors) {
        queue.enqueue(new pq.Node(nodeNeighbors[i].pos, nodeNeighbors[i].dir, curNode, []), curPriority + 1 + manhattanDistance(nodeNeighbors[i].pos, goalPos));
      }
    }
  }
  // No path found
  return;
}


function updateBots() {
  for (let id in bots) {

    let body = bots[id].body;
    let head = bots[id].length - 1;
    // Find closest apple
    let closestApplePos;
    let closestAppleDistance = WIDTH + HEIGHT + 1;
    for (let appleInd = 0; appleInd < apples.length; appleInd++) {
      let appleDist = manhattanDistance(body[head], apples[appleInd]);
      if (appleDist < closestAppleDistance) {
        closestAppleDistance = appleDist;
        closestApplePos = apples[appleInd];
      }
    }

    // A* pathfinding
    let initialPos = body[head];
    let nextDir = findNextDirection(id, initialPos, closestApplePos);
    if (nextDir == undefined) {
      killBot(id, 'no available paths')
      break;
    }
    else {
      switch (nextDir) {
        case 'right':
          body.push({x: body[head].x + 1, y: body[head].y});
          bots[id].dir = nextDir;
          break;
        case 'left':
          body.push({x: body[head].x - 1, y: body[head].y});
          bots[id].dir = nextDir;
          break;
        case 'down':
          body.push({x: body[head].x, y: body[head].y + 1});
          bots[id].dir = nextDir;
          break;
        case 'up':
          body.push({x: body[head].x, y: body[head].y - 1});
          bots[id].dir = nextDir;
          break;
        default:
          break;
      }
    }


    // Temp pathfinding algorithm
    // if (body[head].x < closestApplePos.x) {
    //   body.push({x: body[head].x + 1, y: body[head].y});
    // } else if (body[head].x > closestApplePos.x) {
    //   body.push({x: body[head].x - 1, y: body[head].y});
    // } else if (body[head].y < closestApplePos.y) {
    //   body.push({x: body[head].x, y: body[head].y + 1});
    // } else if (body[head].y > closestApplePos.y) {
    //   body.push({x: body[head].x, y: body[head].y - 1});
    // } else {
    //   body.push({x: body[head].x + 1, y: body[head].y});
    // }
    // end

    let headPos = body[bots[id].length];
    //Don't need other than apple eating!!!
    // if (headPos.x < 0 || headPos.x >= WIDTH || headPos.y < 0 || headPos.y >= HEIGHT) {
    //   killBot(id, 'hit wall');
    // } else if (SNAKE_COLORS.indexOf(board[headPos.y][headPos.x]) != -1) {//CHANGE
    //   killBot(id, 'hit snake');}
    if (BOARD_COLORS.indexOf(board[headPos.y][headPos.x]) != -1) {
      let tailPos = bots[id].body[0];
      board[tailPos.y][tailPos.x] = blankBoard[tailPos.y][tailPos.x];
      //board[headPos.y][headPos.x] = bots[id].color;
      bots[id].body.shift();
    } else if (headPos.x == closestApplePos.x && headPos.y == closestApplePos.y) {
      bots[id].length++;
      headPos = bots[id].body[bots[id].length - 1];
      apples.splice(myIndexOf(apples, headPos), 1);
      apples.push(newApple());
      updateScoreboard = true;
      //board[headPos.y][headPos.x] = bots[id].color;
    } else if (board[headPos.y][headPos.x] == APPLE_COLORS[1]) {
      bots[id].length++;
      headPos = body[bots[id].length - 1];
      updateScoreboard = true;
      //board[headPos.y][headPos.x] = bots[id].color;
    }

  }
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

  // Logic for snake-on-snake collisions
  // For head in heads, if collided w/ snake, delete player, ignore head
  for (let id in tempPlayers) {
    if (id in players) {
      let head = players[id].length;
      let headX = players[id].body[head].x;
      let headY = players[id].body[head].y;
      let doubleBreak = false;
      for (let otherID in tempPlayers) {
        if (otherID in players) {
          for (let pos = 0; pos < players[otherID].body.length; pos++) {
            if (headX == players[otherID].body[pos].x && headY == players[otherID].body[pos].y && (otherID != id || pos != head)) {
                killPlayer(id, 'Collided With Snake');
                doubleBreak = true;
                break;
            }
          }
          if (doubleBreak) {
            break;
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
      apples.splice(myIndexOf(apples, headPos), 1);
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

  // Logic and sets tail to board color
  updateBots();
  // Sets bot heads to snake color
  for (let id in bots) {
    let headPos = bots[id].body[bots[id].length - 1];
    board[headPos.y][headPos.x] = bots[id].color;
  }

  // set head of each array in board to snake color AND update their curDir
  for (let id in players) {
    let headPos = players[id].body[players[id].length - 1];
    board[headPos.y][headPos.x] = players[id].color;
    players[id].curDir = tempPlayers[id].nextDir;
  }

  // Check if players hit bots
  for (let id in players) {//CHANGE
    let head = players[id].length - 1;
    let headX = players[id].body[head].x;
    let headY = players[id].body[head].y;
    let doubleBreak = false;
    for (let otherID in bots) {
        for (let pos = 0; pos < bots[otherID].length; pos++) {
          if (headX == bots[otherID].body[pos].x && headY == bots[otherID].body[pos].y) {
              killPlayer(id, 'Collided With Bot');
              doubleBreak = true;
              break;
          }
        }
        if (doubleBreak) {
          break;
        }
    }
  }

  // If at least one original apple was just eaten, generate new apples
  for (let numApplesNeeded = NUM_APPLES - apples.length; numApplesNeeded > 0; numApplesNeeded--)
    apples.push(newApple());

  // Add bots if necessary
  if (Object.keys(bots).length < NUM_BOTS) {
    for (let i = NUM_BOTS; i > 0; i--) {
      if (!('bot' + i in bots)) {
        let botID = 'bot' + i;
        let nextColor = SNAKE_COLORS[randInt(0, SNAKE_COLORS_LENGTH)];
        // Get random starting position that isn't occupied
        let initialPos = newBotPos(nextColor);
        var initialDir = 'right';
        bots[botID] = {
          username: BOT_USERNAMES[randInt(0, BOT_USERNAMES.length)],
          length: 1,
          body: [initialPos],
          dir: initialDir,
          color: nextColor
        };
        console.log('New bot: ' + botID);
      }
    }
  }

}


setInterval(() => {
  updateBoard();

  // Send individualized boards
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
      if (counter >= 5)
        break;
      scoreboard.push({username: players[id].username, score: players[id].length, color: players[id].color})
      counter++;
    }
    for (let id in bots) {
      if (counter >= 5)
        break;
      scoreboard.push({username: bots[id].username, score: bots[id].length, color: bots[id].color})
      counter++;
    }
    io.emit('scoreboard update', scoreboard.sort((a, b) => {
      return b.score - a.score;
    }))
    updateScoreboard = false;
  }
}, 1000 / 7);
