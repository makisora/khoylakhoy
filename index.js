// ------------------- index.js (SERVER) -------------------
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const path = require("path");

// Serve static files from /public folder
app.use(express.static(path.join(__dirname, "public")));

const rooms = {}; // Structure: { roomId: { players: [socketId, socketId], board: [], turn: 0 } }

// Helper to create empty board
const createBoard = () => Array.from({ length: 30 }, () => Array(30).fill(""));

// Check win
function checkWin(board, x, y, symbol) {
  const directions = [
    [1, 0], // Horizontal
    [0, 1], // Vertical
    [1, 1], // Diagonal down-right
    [1, -1], // Diagonal up-right
  ];

  for (let [dx, dy] of directions) {
    let count = 1;

    for (let dir of [-1, 1]) {
      let i = 1;
      while (true) {
        const nx = x + dx * i * dir;
        const ny = y + dy * i * dir;
        if (nx < 0 || ny < 0 || nx >= 30 || ny >= 30 || board[nx][ny] !== symbol) break;
        count++;
        i++;
      }
    }

    if (count >= 5) return true;
  }
  return false;
}

io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id);

  socket.on("create_room", ({mode}) => {
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();
    rooms[roomId] = {
      players: [socket.id],
      board: createBoard(),
      turn: 'X',
      mode: mode
    };
    socket.join(roomId);
    socket.emit("room_created", { roomId });
    socket.emit("game_update", { board: rooms[roomId].board, turn: rooms[roomId].turn });
  });

  socket.on("join_room", ({roomId}) => {
    const room = rooms[roomId];
    if (room && room.players.length === 1) {
      room.players.push(socket.id);
      socket.join(roomId);
      io.to(roomId).emit("game_update", { board: room.board, turn: room.turn });
    } else {
      socket.emit("error_message", "Phòng không tồn tại hoặc đã đầy");
    }
  });

  socket.on("make_move", ({ roomId, row, col }) => {
    const room = rooms[roomId];
    if (!room) return;

    // For single player mode, allow any move
    if (room.mode === 'single' || (room.players.length === 2 && room.players.includes(socket.id))) {
      if (room.board[row][col] !== "") return; // Cell already taken

      const symbol = room.turn;
      room.board[row][col] = symbol;

      if (checkWin(room.board, row, col, symbol)) {
        io.to(roomId).emit("game_over", { winner: symbol });
        delete rooms[roomId];
      } else {
        room.turn = room.turn === 'X' ? 'O' : 'X';
        io.to(roomId).emit("game_update", { board: room.board, turn: room.turn });
      }
    }
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.players.indexOf(socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomId).emit("playerLeft");
        if (room.players.length === 0) delete rooms[roomId];
      }
    }
    console.log("❌ Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
