var socket = io();
const USERNAME = document.getElementById('username').innerHTML;
const CANVAS_WIDTH = 260;
const CANVAS_HEIGHT = 260;
const SNAKE_SIZE = 20;
const WIDTH = CANVAS_WIDTH / SNAKE_SIZE;
const HEIGHT = CANVAS_HEIGHT / SNAKE_SIZE;
var oldBoard;
const canvas = document.getElementById('canvas');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const ctx = canvas.getContext('2d');

var notJoined = true;

var lastTime = Date.now();

// Input Handler
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


// Start of Mobile Swipe Handler
document.addEventListener('touchstart', handleTouchStart, false);
document.addEventListener('touchmove', handleTouchMove, false);

var xDown = null;
var yDown = null;
function getTouches(evt) {
  return evt.touches ||             // browser API
    evt.originalEvent.touches; // jQuery
}

function handleTouchStart(evt) {
  const firstTouch = getTouches(evt)[0];
  xDown = firstTouch.clientX;
  yDown = firstTouch.clientY;
};

function handleTouchMove(evt) {
  if (!xDown || !yDown) {
    return;
  }

  var xUp = evt.touches[0].clientX;
  var yUp = evt.touches[0].clientY;

  var xDiff = xDown - xUp;
  var yDiff = yDown - yUp;

  if (Math.abs(xDiff) > Math.abs(yDiff)) {
    if (xDiff > 0) {
      /* left swipe */
      socket.emit('change direction', 'left');
    } else {
      /* right swipe */
      socket.emit('change direction', 'right');
    }
  } else {
    if (yDiff > 0) {
      /* up swipe */
      socket.emit('change direction', 'up');
    } else {
      /* down swipe */
      socket.emit('change direction', 'down');
    }
  }
  /* reset values */
  xDown = null;
  yDown = null;
};
// End Mobile Swipe Handler


// Renders unique values according to hex values in board
var curRender = (board) => {
  for (let row = 0; row < HEIGHT; row++) {
    for (let col = 0; col < WIDTH; col++) {
      if (board[row][col] != oldBoard[row][col]) {
        ctx.fillStyle = board[row][col];
        ctx.fillRect(SNAKE_SIZE * col, SNAKE_SIZE * row, SNAKE_SIZE, SNAKE_SIZE);
      }
    }
  }
}

socket.on('new board', newBoard => {
  console.log('Tick took ' + (Date.now() - lastTime).toString() + ' milliseconds.');
  lastTime = Date.now();
  curRender(newBoard);
  console.log('render() took ' + (Date.now() - lastTime).toString() + ' milliseconds.');
  oldBoard = newBoard;
});

socket.on('board sent', () => {
  if (notJoined) {
    socket.emit('new player', USERNAME);
    notJoined = false;
  }
});

socket.on('initial board', newBoard => {
  for (let row = 0, height = HEIGHT; row < height; row++) {
    for (let col = 0, width = WIDTH; col < width; col++) {
      ctx.fillStyle = newBoard[row][col];
      ctx.fillRect(SNAKE_SIZE * col, SNAKE_SIZE * row, SNAKE_SIZE, SNAKE_SIZE);
    }
  }
  oldBoard = newBoard;
  console.log('Initial board received');
});

socket.on('scoreboard update', data => {
  let scoreboard = document.getElementById('scoreboard');
  scoreboard.innerHTML = '';
  for (let player = 0, len = data.length; player < len; player++) {
    let score = document.createElement("li");
    score.classList.add("list-group-item");
    score.style.color = data[player].color;
    score.innerHTML = '<h5>' + data[player].username.toString() + '&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp' + data[player].score.toString() + '</h5>';
    scoreboard.appendChild(score);
  }
});

socket.on('disconnect', () => {
  console.log('Player Lost...Redirecting');
  setTimeout(() => { window.location.replace('/') }, 2000);
});
