const socket = io();

const boardDiv = document.getElementById('board');
const messageDiv = document.getElementById('message');
const turnDisplay = document.getElementById('turnDisplay');
const inputRoomId = document.getElementById('inputRoomId');

let roomId = null;
let board = [];
let currentTurn = null;
const BOARD_SIZE = 30;

function createBoardUI() {
  boardDiv.innerHTML = '';
  boardDiv.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 20px)`;
  boardDiv.style.gridTemplateRows = `repeat(${BOARD_SIZE}, 20px)`;

  for(let i = 0; i < BOARD_SIZE; i++) {
    for(let j = 0; j < BOARD_SIZE; j++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = i;
      cell.dataset.col = j;
      cell.addEventListener('click', () => {
        if (!roomId) {
          showMessage('Bạn chưa tham gia hoặc tạo phòng');
          return;
        }
        if (!currentTurn) {
          showMessage('Trò chơi đã kết thúc hoặc chưa bắt đầu');
          return;
        }
        if (board[i][j] !== '') return;
        socket.emit('make_move', {roomId, row: i, col: j});
      });
      boardDiv.appendChild(cell);
    }
  }
}

function updateBoardUI() {
  for(let i = 0; i < BOARD_SIZE; i++) {
    for(let j = 0; j < BOARD_SIZE; j++) {
      const idx = i * BOARD_SIZE + j;
      const cell = boardDiv.children[idx];
      cell.textContent = board[i][j];
      cell.classList.remove('X','O');
      if (board[i][j] === 'X') cell.classList.add('X');
      else if (board[i][j] === 'O') cell.classList.add('O');
    }
  }
  if (currentTurn) {
    turnDisplay.textContent = `Lượt đi: Quân ${currentTurn}`;
  } else {
    turnDisplay.textContent = 'Trò chơi kết thúc.';
  }
}

function showMessage(msg) {
  messageDiv.textContent = msg;
}

document.getElementById('btnCreateSingle').addEventListener('click', () => {
  socket.emit('create_room', {mode: 'single'});
  showMessage('Đang tạo phòng 1 người chơi...');
});

document.getElementById('btnCreateMulti').addEventListener('click', () => {
  socket.emit('create_room', {mode: 'multi'});
  showMessage('Đang tạo phòng 2 người chơi...');
});

document.getElementById('btnJoinRoom').addEventListener('click', () => {
  const r = inputRoomId.value.trim();
  if (r.length !== 6 || isNaN(Number(r))) {
    showMessage('Mã phòng phải là 6 chữ số.');
    return;
  }
  socket.emit('join_room', {roomId: r});
  showMessage('Đang tham gia phòng...');
});

socket.on('room_created', ({roomId: rId}) => {
  roomId = rId;
  showMessage(`Phòng đã tạo: ${roomId}`);
  board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(''));
  createBoardUI();
  updateBoardUI();
});

socket.on('game_update', ({board: newBoard, turn}) => {
  board = newBoard;
  currentTurn = turn;
  updateBoardUI();
});

socket.on('game_over', ({winner}) => {
  updateBoardUI();
  showMessage(`Quân ${winner} đã thắng!`);
  currentTurn = null;
  turnDisplay.textContent = `Game kết thúc - Quân ${winner} thắng!`;
});

socket.on('error_message', (msg) => {
  showMessage(msg);
});
