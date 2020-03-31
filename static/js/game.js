var socket = io();
const USERNAME = document.getElementById('username').innerHTML;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const SNAKE_SIZE = 20;
const BOARD_COLOR = '#FFFFFF';
// Maybe try keeping an old and new board and only updating differences? instead of wiping and replacing?
var oldBoard;
const canvas = document.getElementById('canvas');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const ctx = canvas.getContext('2d');

var initialPos;

var lastTime = Date.now();

document.addEventListener('keydown', event => {
  switch (event.keyCode) {
    case 87: // W
      socket.emit('change direction', 'up');
      break;
    case 65: // A
      socket.emit('change direction', 'left');
      break;
    case 83: // S
      socket.emit('change direction', 'down');
      break;
    case 68: // D
      socket.emit('change direction', 'right');
      break;
    default:
      break;
  }
});

// Renders unique values according to hex values in board
var render = function(board) {
  for (let row = 0, height = CANVAS_HEIGHT / SNAKE_SIZE; row < height; row++) {
    for (let col = 0, width = CANVAS_WIDTH / SNAKE_SIZE; col < width; col++) {
      if (board[row][col] != oldBoard[row][col]) {
        ctx.fillStyle = board[row][col];
        ctx.fillRect(SNAKE_SIZE * col, SNAKE_SIZE * row, SNAKE_SIZE, SNAKE_SIZE);
      }
    }
  }
}

// clears initialPos THEN renders unique values according to hex values in board
var secondRender = function(board) {
  ctx.fillStyle = BOARD_COLOR;
  ctx.fillRect(SNAKE_SIZE * initialPos.x, SNAKE_SIZE * initialPos.y, SNAKE_SIZE, SNAKE_SIZE);
  for (let row = 0, height = CANVAS_HEIGHT / SNAKE_SIZE; row < height; row++) {
    for (let col = 0, width = CANVAS_WIDTH / SNAKE_SIZE; col < width; col++) {
      if (board[row][col] != oldBoard[row][col]) {
        ctx.fillStyle = board[row][col];
        ctx.fillRect(SNAKE_SIZE * col, SNAKE_SIZE * row, SNAKE_SIZE, SNAKE_SIZE);
      }
    }
  }
  curRender = render;
}

// The 1st render fills all values, then 2nd render is called, then normal render
var curRender = (board) => {
  for (let row = 0, height = CANVAS_HEIGHT / SNAKE_SIZE; row < height; row++) {
    for (let col = 0, width = CANVAS_WIDTH / SNAKE_SIZE; col < width; col++) {
      ctx.fillStyle = board[row][col];
      ctx.fillRect(SNAKE_SIZE * col, SNAKE_SIZE * row, SNAKE_SIZE, SNAKE_SIZE);
    }
  }
  socket.emit('new player', USERNAME);
  curRender = secondRender;
};

socket.on('new board', newBoard => {
  console.log('Tick took ' + (Date.now() - lastTime).toString() + ' milliseconds.');
  lastTime = Date.now();
  curRender(newBoard);
  console.log('render() took ' + (Date.now() - lastTime).toString() + ' milliseconds.');
  oldBoard = newBoard;
});

socket.on('initial position', data => {
  ctx.fillStyle = data.color;
  ctx.fillRect(SNAKE_SIZE * data.pos.x, SNAKE_SIZE * data.pos.y, SNAKE_SIZE, SNAKE_SIZE);
  initialPos = data.pos;
  console.log('Initial position received');
});

socket.on('scoreboard update', data => {
  let scoreboard = document.getElementById('scoreboard');
  scoreboard.innerHTML = '';
  for (let player = 0, len = data.length; player < len; player++) {
    let score = document.createElement("li");
    score.classList.add("list-group-item");
    score.innerHTML = '<h5>' + data[player].username.toString() + '&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp' + data[player].score.toString() + '</h5>';
    scoreboard.appendChild(score);
  }
});

socket.on('disconnect', () => {
  console.log('Player Lost...Redirecting');
  //setTimeout(() => { window.location.replace('/') }, 2000);
});
