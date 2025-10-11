const socket = io();

const howBtn = document.getElementById("howBtn");
const modalOverlay = document.getElementById("modalOverlay");
const closeModal = document.getElementById("closeModal");

const nameInput = document.getElementById("nameInput");
const codeInput = document.getElementById("codeInput");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");

const joinSection = document.getElementById("join");
const lobbySection = document.getElementById("lobby");
const playArea = document.getElementById("playArea");

const roomCodeDisplay = document.getElementById("roomCode");
const playersList = document.getElementById("playersList");
const startRoundBtn = document.getElementById("startRoundBtn");
const leaveBtn = document.getElementById("leaveBtn");
const endRoundBtn = document.getElementById("endRoundBtn");

const yourQuestionText = document.getElementById("yourQuestionText");
const answerButtons = document.getElementById("answerButtons");
const submitAnswerBtn = document.getElementById("submitAnswerBtn");
const submittedMsg = document.getElementById("submittedMsg");

const revealArea = document.getElementById("revealArea");
const majorityQuestion = document.getElementById("majorityQuestion");
const answersList = document.getElementById("answersList");
const votingArea = document.getElementById("votingArea");
const voteButtons = document.getElementById("voteButtons");
const submitVoteBtn = document.getElementById("submitVoteBtn");
const votingResult = document.getElementById("votingResult");

let currentRoom = "";
let myName = "";
let selectedPlayer = "";
let selectedVote = "";

/* ------------------ Modal Controls ------------------ */
howBtn.addEventListener("click", () => {
  modalOverlay.classList.remove("hidden");
});

closeModal.addEventListener("click", () => {
  modalOverlay.classList.add("hidden");
});

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.add("hidden");
  }
});

/* ------------------ Room Logic ------------------ */
createBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Enter your name");
  socket.emit("createRoom", name);
});

joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  const code = codeInput.value.trim().toUpperCase();
  if (!name || !code) return alert("Enter both name and room code");
  socket.emit("joinRoom", { name, code });
});

startRoundBtn.addEventListener("click", () => {
  socket.emit("startRound", currentRoom);
});

leaveBtn.addEventListener("click", () => {
  location.reload();
});

endRoundBtn.addEventListener("click", () => {
  socket.emit("endRound", currentRoom);
});

submitAnswerBtn.addEventListener("click", () => {
  if (!selectedPlayer) return;
  socket.emit("submitAnswer", { room: currentRoom, name: myName, answer: selectedPlayer });
  submitAnswerBtn.disabled = true;
  submitAnswerBtn.classList.add("disabled");
  submittedMsg.classList.remove("hidden");
});

submitVoteBtn.addEventListener("click", () => {
  if (!selectedVote) return;
  socket.emit("submitVote", { room: currentRoom, name: myName, vote: selectedVote });
  submitVoteBtn.disabled = true;
  submitVoteBtn.classList.add("disabled");
});

/* ------------------ Socket Events ------------------ */
socket.on("roomCreated", (data) => {
  myName = data.name;
  currentRoom = data.room;
  roomCodeDisplay.textContent = currentRoom;
  joinSection.classList.add("hidden");
  lobbySection.classList.remove("hidden");
});

socket.on("roomJoined", (data) => {
  myName = data.name;
  currentRoom = data.room;
  roomCodeDisplay.textContent = currentRoom;
  joinSection.classList.add("hidden");
  lobbySection.classList.remove("hidden");
});

socket.on("updatePlayers", (players) => {
  playersList.innerHTML = players.map(p => `<div>${p}</div>`).join("");
});

socket.on("roundStarted", (data) => {
  lobbySection.classList.add("hidden");
  playArea.classList.remove("hidden");
  yourQuestionText.textContent = data.question;
  answerButtons.innerHTML = data.players
    .filter(p => p !== myName)
    .map(p => `<button class="choiceBtn">${p}</button>`)
    .join("");

  document.querySelectorAll(".choiceBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedPlayer = btn.textContent;
      document.querySelectorAll(".choiceBtn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      submitAnswerBtn.disabled = false;
      submitAnswerBtn.classList.remove("disabled");
    });
  });
});

socket.on("showAnswers", (data) => {
  revealArea.classList.remove("hidden");
  majorityQuestion.textContent = data.majorityQuestion;
  answersList.innerHTML = data.answers.map(a => `<div><b>${a.name}:</b> ${a.answer}</div>`).join("");
  votingArea.classList.remove("hidden");

  voteButtons.innerHTML = data.players
    .filter(p => p !== myName)
    .map(p => `<button class="voteBtn">${p}</button>`)
    .join("");

  document.querySelectorAll(".voteBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedVote = btn.textContent;
      document.querySelectorAll(".voteBtn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      submitVoteBtn.disabled = false;
      submitVoteBtn.classList.remove("disabled");
    });
  });
});

socket.on("voteResults", (data) => {
  votingArea.classList.add("hidden");
  votingResult.classList.remove("hidden");
  votingResult.innerHTML = `<p><b>${data.imposter}</b> was the imposter!</p>`;
  endRoundBtn.classList.remove("hidden");
});
