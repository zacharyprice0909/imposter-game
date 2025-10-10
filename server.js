const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const rooms = {};

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  socket.on("createRoom", (playerName, callback) => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    rooms[roomCode] = {
      host: socket.id,
      players: {},
      roundActive: false,
      votes: {},
    };

    rooms[roomCode].players[socket.id] = { name: playerName, score: 0 };
    socket.join(roomCode);
    callback({ roomCode });
    io.to(roomCode).emit("updatePlayers", getPlayerList(roomCode));
  });

  socket.on("joinRoom", ({ roomCode, playerName }, callback) => {
    const room = rooms[roomCode];
    if (!room) return callback({ error: "Room not found" });

    const nameTaken = Object.values(room.players).some(
      (p) => p.name.toLowerCase() === playerName.toLowerCase()
    );
    if (nameTaken) return callback({ error: "Name already taken" });

    room.players[socket.id] = { name: playerName, score: 0 };
    socket.join(roomCode);
    callback({ success: true });
    io.to(roomCode).emit("updatePlayers", getPlayerList(roomCode));
  });

  socket.on("startRound", (roomCode) => {
    const room = rooms[roomCode];
    if (!room || room.roundActive) return;
    room.roundActive = true;
    room.votes = {};

    const question = getRandomQuestion();
    const playerIds = Object.keys(room.players);
    const imposterId =
      playerIds[Math.floor(Math.random() * playerIds.length)];

    playerIds.forEach((id) => {
      const secret =
        id === imposterId
          ? "You are the IMPOSTER! Blend in!"
          : `Question: ${question}`;
      io.to(id).emit("roundStarted", { secret });
    });

    io.to(roomCode).emit("roundStatus", { active: true });
  });

  socket.on("submitVote", ({ roomCode, votedName }) => {
    const room = rooms[roomCode];
    if (!room || !room.roundActive) return;

    const player = room.players[socket.id];
    if (!player || room.votes[player.name]) return;

    room.votes[player.name] = votedName;
    io.to(roomCode).emit("voteSubmitted", {
      player: player.name,
      totalVotes: Object.keys(room.votes).length,
      neededVotes: Object.keys(room.players).length,
    });

    if (Object.keys(room.votes).length === Object.keys(room.players).length) {
      endRound(roomCode);
    }
  });

  socket.on("nextRound", (roomCode) => {
    const room = rooms[roomCode];
    if (room) {
      room.roundActive = false;
      io.to(roomCode).emit("nextRoundReady");
    }
  });

  socket.on("kickPlayer", ({ roomCode, playerId }) => {
    const room = rooms[roomCode];
    if (!room || socket.id !== room.host) return;

    if (room.players[playerId]) {
      io.to(playerId).emit("kicked");
      io.sockets.sockets.get(playerId)?.leave(roomCode);
      delete room.players[playerId];
      io.to(roomCode).emit("updatePlayers", getPlayerList(roomCode));
    }
  });

  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(roomCode).emit("updatePlayers", getPlayerList(roomCode));
        if (socket.id === room.host) {
          io.to(roomCode).emit("errorMessage", "Host disconnected. Game ended.");
          delete rooms[roomCode];
        }
        break;
      }
    }
  });
});

function endRound(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.roundActive = false;

  const voteCounts = {};
  Object.values(room.votes).forEach((v) => {
    voteCounts[v] = (voteCounts[v] || 0) + 1;
  });
  const eliminated = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0][0];
  io.to(roomCode).emit("roundEnded", { eliminated });
}

function getPlayerList(roomCode) {
  const room = rooms[roomCode];
  return Object.entries(room.players).map(([id, p]) => ({
    id,
    name: p.name,
  }));
}

function getRandomQuestion() {
  const questions = [
    "What's your favorite type of holiday?",
    "What's your go-to comfort food?",
    "What kind of movies do you enjoy most?",
    "What's a hobby you could talk about for hours?",
    "Would you rather live by the beach or in the city?",
  ];
  return questions[Math.floor(Math.random() * questions.length)];
}

server.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);
