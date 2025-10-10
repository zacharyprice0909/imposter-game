const socket = io();

let roomCode = null;
let isHost = false;

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const playersList = document.getElementById("playersList");
const hostControls = document.getElementById("hostControls");
const startRoundBtn = document.getElementById("startRound");
const nextRoundBtn = document.getElementById("nextRound");
const questionBox = document.getElementById("questionBox");
const voteSection = document.getElementById("voteSection");
const submitVoteBtn = document.getElementById("submitVote");
const howToPlayBtn = document.getElementById("howToPlayBtn");
const popup = document.getElementById("howToPlayPopup");
const closePopupBtn = document.getElementById("closePopup");
const voteSelect = document.getElementById("voteSelect");
const voteProgress = document.getElementById("voteProgress");

popup.style.display = "none";

howToPlayBtn.addEventListener("click", () => {
  popup.style.display = "block";
});

closePopupBtn.addEventListener("click", () => {
  popup.style.display = "none";
});

createBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Enter a name!");
  socket.emit("createRoom", name, (data) => {
    roomCode = data.roomCode;
    isHost = true;
    showLobby();
  });
};

joinBtn.onclick = () => {
  const name = nameInput.value.trim();
  const code = roomInput.value.trim().toUpperCase();
  if (!name || !code) return alert("Enter name and room code!");
  socket.emit("joinRoom", { roomCode: code, playerName: name }, (res) => {
    if (res.error) return alert(res.error);
    roomCode = code;
    showLobby();
  });
};

function showLobby() {
  document.getElementById("menu").style.display = "none";
  document.getElementById("lobby").style.display = "block";
  if (isHost) hostControls.style.display = "block";
}

socket.on("updatePlayers", (players) => {
  playersList.innerHTML = "";
  voteSelect.innerHTML = '<option value="">--Select a player--</option>';
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.name;
    if (isHost && p.id !== socket.id) {
      const kickBtn = document.createElement("button");
      kickBtn.textContent = "Kick";
      kickBtn.onclick = () =>
        socket.emit("kickPlayer", { roomCode, playerId: p.id });
      li.appendChild(kickBtn);
    }
    playersList.appendChild(li);
    voteSelect.innerHTML += `<option value="${p.name}">${p.name}</option>`;
  });
});

startRoundBtn.onclick = () => socket.emit("startRound", roomCode);
nextRoundBtn.onclick = () => socket.emit("nextRound", roomCode);

socket.on("roundStarted", ({ secret }) => {
  questionBox.textContent = secret;
  questionBox.style.display = "block";
  voteSection.style.display = "none";
  nextRoundBtn.style.display = "none";
});

socket.on("roundEnded", ({ eliminated }) => {
  questionBox.textContent = `Eliminated: ${eliminated}`;
  voteSection.style.display = "none";
  if (isHost) nextRoundBtn.style.display = "block";
});

socket.on("nextRoundReady", () => {
  questionBox.style.display = "none";
  voteSection.style.display = "none";
});

submitVoteBtn.onclick = () => {
  const voted = voteSelect.value;
  if (!voted) return alert("You must select someone to vote for!");
  socket.emit("submitVote", { roomCode, votedName: voted });
  voteSection.style.display = "none";
};

socket.on("voteSubmitted", ({ totalVotes, neededVotes }) => {
  voteProgress.textContent = `Votes: ${totalVotes}/${neededVotes}`;
  if (totalVotes === neededVotes) {
    voteSection.style.display = "none";
  }
});

socket.on("roundStatus", ({ active }) => {
  if (active) voteSection.style.display = "block";
});

socket.on("kicked", () => {
  alert("You were kicked from the game.");
  window.location.reload();
});

socket.on("errorMessage", (msg) => {
  alert(msg);
  window.location.reload();
});
