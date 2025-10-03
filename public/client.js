const socket = io();

let currentRoom = "";
let playerName = "";

// Create game
document.getElementById("createBtn").addEventListener("click", () => {
  const room = document.getElementById("roomInput").value;
  if (!room) return alert("Enter room code");
  socket.emit("createGame", room);
});

// Join game
document.getElementById("joinBtn").addEventListener("click", () => {
  const room = document.getElementById("roomInput").value;
  const name = document.getElementById("nameInput").value;
  if (!room || !name) return alert("Enter name and room");
  currentRoom = room;
  playerName = name;
  socket.emit("joinGame", { room, name });
});

// Start round (host only)
document.getElementById("startBtn").addEventListener("click", () => {
  socket.emit("startRound", currentRoom);
});

// Submit answer
document.getElementById("submitBtn").addEventListener("click", () => {
  const answer = document.getElementById("answerInput").value;
  if (!answer) return alert("Enter an answer");
  socket.emit("submitAnswer", { room: currentRoom, player: playerName, answer });
  document.getElementById("secret").style.display = "none";
});

// --- SOCKET EVENTS ---
socket.on("gameCreated", (room) => {
  currentRoom = room;
  document.getElementById("lobby").style.display = "block";
});

socket.on("updatePlayers", (players) => {
  document.getElementById("players").innerText = "Players: " + players.join(", ");
});

socket.on("roundStart", ({ question }) => {
  document.getElementById("results").style.display = "none";
  document.getElementById("results").innerHTML = "";

  document.getElementById("secret").style.display = "block";
  document.getElementById("secretQuestion").innerText = question;
  document.getElementById("answerInput").value = "";
});

socket.on("revealRound", ({ majorityQuestion, answers }) => {
  document.getElementById("secret").style.display = "none";

  let resultsDiv = document.getElementById("results");
  resultsDiv.style.display = "block";
  resultsDiv.innerHTML = `
    <h3>Majority Question:</h3>
    <p>${majorityQuestion}</p>
    <h3>Answers:</h3>
    <ul>
      ${Object.entries(answers)
        .map(([p, a]) => `<li><b>${p}:</b> ${a}</li>`)
        .join("")}
    </ul>
    <p>Discuss and vote who the Imposter is! Host can now start next round.</p>
  `;
});

socket.on("errorMessage", (msg) => {
  alert(msg);
});
