const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;
const BOARD_SIZE = 30;

app.use(express.static('public'));

const rooms = {};

function createEmptyBoard() {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(''));
}

function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function checkWin(board, row, col, mark) {
  const directions = [
    [0,1], [1,0], [1,1], [1,-1]
  ];

  for (const [dx, dy] of directions) {
    let count = 1;
    let x = row + dx, y = col + dy;
    while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && board[x][y] === mark) {
      count++; x += dx; y += dy;
    }
    x = row - dx; y = col - dy;
    while (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && board[x][y] === mark) {
      count++; x -= dx; y -= dy;
    }
    if (count >= 5) return true;
  }
  return false;
}

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('create_room', ({mode}) => {
    let roomId;
    do {
      roomId = generateRoomId();
    } while (rooms[roomId]);

    rooms[roomId] = {
      board: createEmptyBoard(),
      mode,  // 'single' or 'multi'
      players: [socket.id],
      turn: 'X',
      winner: null,
    };
    socket.join(roomId);
    socket.emit('room_created', {roomId});
    io.to(roomId).emit('game_update', {board: rooms[roomId].board, turn: 'X'});
  });

  socket.on('join_room', ({roomId}) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('error_message', 'Phòng không tồn tại');
      return;
    }
    if (room.mode === 'multi' && room.players.length >= 2) {
      socket.emit('error_message', 'Phòng đã đầy');
      return;
    }
    socket.join(roomId);
    if (!room.players.includes(socket.id)) {
      room.players.push(socket.id);
    }
    io.to(roomId).emit('game_update', {board: room.board, turn: room.turn});
  });

  socket.on('make_move', ({roomId, row, col}) => {
    const room = rooms[roomId];
    if (!room) return;
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;
    if (room.board[row][col] !== '') return;
    if (room.winner) return;  // game đã kết thúc

    let mark;
    if (room.mode === 'multi') {
      // Kiểm tra lượt người chơi
      const playerIndex = room.players.indexOf(socket.id);
      if (playerIndex === -1) return;
      mark = playerIndex === 0 ? 'X' : 'O';
      if (mark !== room.turn) return; // chưa đến lượt
    } else {
      // chế độ 1 người: tự đánh X rồi O
      mark = room.turn;
    }

    room.board[row][col] = mark;

    // Kiểm tra thắng
    if (checkWin(room.board, row, col, mark)) {
      room.winner = mark;
      io.to(roomId).emit('game_over', {winner: mark});
      io.to(roomId).emit('game_update', {board: room.board, turn: null});
      return;
    }

    // Chuyển lượt
    room.turn = room.turn === 'X' ? 'O' : 'X';

    io.to(roomId).emit('game_update', {board: room.board, turn: room.turn});
  });

  socket.on('disconnecting', () => {
    // Xử lý khi người chơi rời phòng
    const roomsJoined = Array.from(socket.rooms).filter(r => r !== socket.id);
    roomsJoined.forEach(roomId => {
      const room = rooms[roomId];
      if (room) {
        room.players = room.players.filter(p => p !== socket.id);
        // Nếu phòng trống thì xóa luôn
        if (room.players.length === 0) {
          delete rooms[roomId];
        }
      }
    });
  });
});

http.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});
