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

  socket.on("playAlone", () => {
    socket.emit("startSinglePlayer");
  });

  socket.on("createRoom", (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [socket.id],
        board: createBoard(),
        turn: 0,
      };
      socket.join(roomId);
      socket.emit("roomJoined", { symbol: "X", roomId });
    } else {
      socket.emit("roomExists");
    }
  });

  socket.on("joinRoom", (roomId) => {
    const room = rooms[roomId];
    if (room && room.players.length === 1) {
      room.players.push(socket.id);
      socket.join(roomId);
      socket.emit("roomJoined", { symbol: "O", roomId });
      io.to(roomId).emit("startGame");
    } else {
      socket.emit("roomFullOrInvalid");
    }
  });

  socket.on("makeMove", ({ roomId, x, y }) => {
    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;

    const currentPlayer = room.players[room.turn % 2];
    if (socket.id !== currentPlayer) return;

    if (room.board[x][y] !== "") return; // Ô đã đánh

    const symbol = room.turn % 2 === 0 ? "X" : "O";
    room.board[x][y] = symbol;
    io.to(roomId).emit("moveMade", { x, y, symbol });

    if (checkWin(room.board, x, y, symbol)) {
      io.to(roomId).emit("gameOver", symbol);
      delete rooms[roomId];
    } else {
      room.turn++;
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
