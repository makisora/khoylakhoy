const socket = io();

const boardSize = 30;
const winLength = 5;

let board = [];
let currentPlayer = 'X';
let gameMode = null; // "single" or "online"
let isMyTurn = false;
let roomId = null;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const btnSingle = document.getElementById('btn-single');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const roomInput = document.getElementById('room-input');

// Tạo bàn cờ trắng trống
function initBoard() {
  board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(''));
  boardEl.innerHTML = '';
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', onCellClick);
      boardEl.appendChild(cell);
    }
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

// Kiểm tra thắng
function checkWin(r, c, player) {
  const directions = [
    [0,1], [1,0], [1,1], [1,-1]
  ];
  for (const [dr, dc] of directions) {
    let count = 1;
    // Đếm về phía dương
    for (let i = 1; i < winLength; i++) {
      const nr = r + dr*i, nc = c + dc*i;
      if (nr < 0 || nr >= boardSize || nc < 0 || nc >= boardSize) break;
      if (board[nr][nc] === player) count++;
      else break;
    }
    // Đếm về phía âm
    for (let i = 1; i < winLength; i++) {
      const nr = r - dr*i, nc = c - dc*i;
      if (nr < 0 || nr >= boardSize || nc < 0 || nc >= boardSize) break;
      if (board[nr][nc] === player) count++;
      else break;
    }
    if (count >= winLength) return true;
  }
  return false;
}

// Cập nhật ô
function updateCell(r, c, player) {
  board[r][c] = player;
  const cells = boardEl.querySelectorAll('.cell');
  const index = r * boardSize + c;
  const cell = cells[index];
  cell.textContent = player;
  cell.classList.add(player);
  cell.style.cursor = 'default';
  cell.removeEventListener('click', onCellClick);
}

// Xử lý click ô
function onCellClick(e) {
  if (!isMyTurn) return;
  const r = +e.target.dataset.row;
  const c = +e.target.dataset.col;
  if (board[r][c] !== '') return;

  if (gameMode === 'single') {
    // 1 người đi cả X và O tự đối đầu
    updateCell(r, c, currentPlayer);
    if (checkWin(r, c, currentPlayer)) {
      setStatus(`Quân ${currentPlayer} thắng!`);
      isMyTurn = false;
      return;
    }
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    setStatus(`Lượt của quân ${currentPlayer}`);
  } else if (gameMode === 'online') {
    if (!isMyTurn) return;
    socket.emit('play', { roomId, r, c });
  }
}

// Khởi động chế độ 1 người
btnSingle.onclick = () => {
  gameMode = 'single';
  currentPlayer = 'X';
  isMyTurn = true;
  roomId = null;
  initBoard();
  setStatus('Chơi 1 người: Lượt của quân X');
};

// Tạo phòng
btnCreateRoom.onclick = () => {
  socket.emit('createRoom');
};

// Tham gia phòng
btnJoinRoom.onclick = () => {
  const id = roomInput.value.trim();
  if (!/^\d{6}$/.test(id)) {
    alert('Mã phòng phải gồm 6 chữ số!');
    return;
  }
  socket.emit('joinRoom', id);
};

// Xử lý sự kiện từ server

socket.on('roomCreated', (id) => {
  gameMode = 'online';
  roomId = id;
  currentPlayer = 'X';
  isMyTurn = true;
  initBoard();
  setStatus(`Đã tạo phòng: ${id}. Bạn là quân X, lượt của bạn.`);
});

socket.on('roomJoined', (id) => {
  gameMode = 'online';
  roomId = id;
  currentPlayer = 'O';
  isMyTurn = false;
  initBoard();
  setStatus(`Đã vào phòng: ${id}. Bạn là quân O, chờ lượt của đối thủ.`);
});

socket.on('playMade', ({r, c, player}) => {
  updateCell(r, c, player);
  if (checkWin(r, c, player)) {
    setStatus(`Quân ${player} thắng!`);
    isMyTurn = false;
    return;
  }
  if (player !== currentPlayer) {
    isMyTurn = true;
    setStatus(`Lượt của bạn (${currentPlayer})`);
  } else {
    isMyTurn = false;
    setStatus(`Lượt đối thủ (${player === 'X' ? 'O' : 'X'})`);
  }
});

socket.on('errorMsg', (msg) => {
  alert(msg);
});

socket.on('opponentLeft', () => {
  setStatus('Đối thủ đã rời phòng. Bạn thắng!');
  isMyTurn = false;
});
