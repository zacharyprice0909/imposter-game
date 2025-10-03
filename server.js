const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const path = require("path");

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

let games = {}; // { roomCode: { players: {}, host: socketId, imposter: "", majorityQuestion: "", answers: {}, roundInProgress: false } }

const questions = [
  "Who would most likely survive a zombie apocalypse?",
  "Who is the biggest flirt?",
  "Who is most likely to hook up with a stranger on a night out?",
  "Who is most likely to spend all their money in one weekend?",
  "Who would you call if you needed to hide a body?",
  "Who is most likely to get kicked out of a bar?",
  "Who is most likely to cry after a breakup?",
  "Who tells the worst jokes?",
  "Who is most likely to post something embarrassing on social media?",
  "Who is most likely to ghost someone they’re dating?",
  "Who is most likely to date two people at once?",
  "Who would be the first to fall asleep at a party?",
  "Who is the freakiest in bed?",
  "Who is most likely to cheat in a game?",
  "Who is most likely to forget their best friend’s birthday?",
  "Who is most likely to be arrested for something stupid?",
  "Who is the most competitive when drunk?",
  "Who would you least want to share a room with?",
  "Who is most likely to hook up with someone in this group?",
  "Who would be the worst person to introduce to your parents?",
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("createGame", (room) => {
    games[room] = { players: {}, host: socket.id, roundInProgress: false };
    socket.join(room);
    io.to(socket.id).emit("gameCreated", room);
  });

  socket.on("joinGame", ({ room, name }) => {
    if (!games[room]) return socket.emit("errorMessage", "Room not found.");
    games[room].players[socket.id] = name;
    socket.join(room);
    io.to(room).emit("updatePlayers", Object.values(games[room].players));
  });

  socket.on("startRound", (room) => {
    const game = games[room];
    if (!game || game.roundInProgress) return;

    game.roundInProgress = true;
    game.answers = {};

    // Pick imposter + question
    const playerIds = Object.keys(game.players);
    const imposterId = pickRandom(playerIds);
    const majorityQuestion = pickRandom(questions);
    const imposterQuestion = pickRandom(questions.filter(q => q !== majorityQuestion));

    game.imposter = imposterId;
    game.majorityQuestion = majorityQuestion;

    // Send secret questions
    playerIds.forEach(pid => {
      if (pid === imposterId) {
        io.to(pid).emit("roundStart", { question: imposterQuestion, isImposter: true });
      } else {
        io.to(pid).emit("roundStart", { question: majorityQuestion, isImposter: false });
      }
    });
  });

  socket.on("submitAnswer", ({ room, player, answer }) => {
    const game = games[room];
    if (!game) return;

    game.answers[player] = answer;

    // If everyone has answered → reveal
    if (Object.keys(game.answers).length === Object.keys(game.players).length) {
      io.to(room).emit("revealRound", {
        majorityQuestion: game.majorityQuestion,
        answers: game.answers,
      });
      game.roundInProgress = false; // ✅ mark round as finished
    }
  });

  socket.on("disconnect", () => {
    for (let room in games) {
      if (games[room].players[socket.id]) {
        delete games[room].players[socket.id];
        io.to(room).emit("updatePlayers", Object.values(games[room].players));
      }
    }
  });
});

http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
