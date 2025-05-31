const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {}; // { roomId: { board, turn, players: [socket.id, ...] } }

function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('createRoom', () => {
    let id;
    do {
      id = generateRoomId();
    } while (rooms[id]);
    rooms[id] = {
      board: Array(30).fill(null).map(() => Array(30).fill('')),
      turn: 'X',
      players: [socket.id]
    };
    socket.join(id);
    socket.emit('roomCreated', id);
    console.log(`Room created: ${id} by ${socket.id}`);
  });

  socket.on('joinRoom', (roomId) => {
    if (!rooms[roomId]) {
      socket.emit('errorMsg', 'Phòng không tồn tại!');
      return;
    }
    if (rooms[roomId].players.length >= 2) {
      socket.emit('errorMsg', 'Phòng đã đầy!');
      return;
    }
    rooms[roomId].players.push(socket.id);
    socket.join(roomId);
    socket.emit('roomJoined', roomId);
    // Thông báo cho người tạo phòng rằng có người vào
    socket.to(roomId).emit('statusMsg', 'Đối thủ đã vào phòng, bắt đầu chơi!');
    console.log(`${socket.id} joined room ${roomId}`);
  });

  socket.on('play', ({ roomId, r, c }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('errorMsg', 'Phòng không tồn tại!');
      return;
    }
    if (!room.players.includes(socket.id)) {
      socket.emit('errorMsg', 'Bạn không trong phòng này!');
      return;
    }
    const playerIndex = room.players.indexOf(socket.id);
    const player = playerIndex === 0 ? 'X' : 'O';
    if (player !== room.turn) {
      socket.emit('errorMsg', 'Chưa tới lượt bạn!');
      return;
    }
    if (room.board[r][c] !== '') {
      socket.emit('errorMsg', 'Ô này đã được đánh!');
      return;
    }
    room.board[r][c] = player;
    io.to(roomId).emit('playMade', { r, c, player });

    // Kiểm tra thắng
    if (checkWin(room.board, r, c, player)) {
      io.to(roomId).emit('gameOver', player);
      // Có thể xóa phòng hoặc giữ để chơi tiếp
      delete rooms[roomId];
      return;
    }

    // Đổi lượt
    room.turn = room.turn === 'X' ? 'O' : 'X';
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    // Tìm phòng có socket.id này
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.players.includes(socket.id)) {
        // Thông báo cho đối thủ nếu có
        socket.to(roomId).emit('opponentLeft');
        // Xóa phòng
        delete rooms[roomId];
        console.log(`Room ${roomId} bị xóa do người chơi rời.`);
      }
    }
  });
});

function checkWin(board, r, c, player) {
  const boardSize = board.length;
  const winLength = 5;
  const directions = [
    [0,1], [1,0], [1,1], [1,-1]
  ];
  for (const [dr, dc] of directions) {
    let count = 1;
    for (let i = 1; i < winLength; i++) {
      const nr = r + dr*i, nc = c + dc*i;
      if (nr < 0 || nr >= boardSize || nc < 0 || nc >= boardSize) break;
      if (board[nr][nc] === player) count++;
      else break;
    }
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
