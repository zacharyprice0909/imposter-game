// public/client.js
const socket = io();
let myId = null;
let currentRoom = null;
let players = [];
let myName = '';
let lastRoomPublic = null;
let selectedAnswer = null;
let selectedVote = null;

/* ---------- DOM refs ---------- */
const nameInput = document.getElementById('nameInput');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const codeInput = document.getElementById('codeInput');

const joinSection = document.getElementById('join');
const lobby = document.getElementById('lobby');
const roomCodeEl = document.getElementById('roomCode');
const playersList = document.getElementById('playersList');
const startRoundBtn = document.getElementById('startRoundBtn');
const leaveBtn = document.getElementById('leaveBtn');
const roundNum = document.getElementById('roundNum');

const playArea = document.getElementById('playArea');
const yourQuestionText = document.getElementById('yourQuestionText');
const answerButtons = document.getElementById('answerButtons');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const submittedMsg = document.getElementById('submittedMsg');
const submissionCounter = document.getElementById('submissionCounter');

const revealArea = document.getElementById('revealArea');
const majorityQuestion = document.getElementById('majorityQuestion');
const answersList = document.getElementById('answersList');
const votingArea = document.getElementById('votingArea');
const voteButtons = document.getElementById('voteButtons');
const submitVoteBtn = document.getElementById('submitVoteBtn');
const voteCounter = document.getElementById('voteCounter');
const votingResult = document.getElementById('votingResult');
const endRoundBtn = document.getElementById('endRoundBtn');

const howBtn = document.getElementById('howBtn');
const modalOverlay = document.getElementById('modalOverlay');
const closeModal = document.getElementById('closeModal');

const errorBox = document.getElementById('errorBox');

/* ---------- Question bank ---------- */
const qBank = [
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
  "Who is the most likely to date two people at once?",
  "Who would be the first to fall asleep at a party?",
  "Who is the freakiest in bed?",
  "Who is most likely to cheat in a game?",
  "Who is most likely to forget their best friend’s birthday?",
  "Who is most likely to be arrested for something stupid?",
  "Who is the most competitive when drunk?",
  "Who would you least want to share a room with?",
  "Who is most likely to hook up with someone in this group?",
  "Who would be the worst person to introduce to your parents?",
  "Who would be the most likely to survive on a deserted island?",
  "Who is the biggest sweetheart?",
  "Who would most likely win a karaoke contest?",
  "Who would most likely travel the world alone?",
  "Who is most likely to get sunburnt on holiday?",
  "Who would dance on a table at a wedding?",
  "Who would be most likely to get a tattoo they regret?",
  "Who would most likely win an argument?",
  "Who would be most likely to become famous?",
  "Who tells the juiciest gossip?",
  "Who is most likely to be late to their own event?",
  "Who would most likely adopt an unusual pet?",
  "Who is most likely to eat something off the ground?",
  "Who would most likely go bungee jumping?",
  "Who would be the best to call in an emergency?",
  "Who would most likely move to another country tomorrow?",
  "Who would most likely become a cult leader?",
  "Who is the biggest neat freak?",
  "Who would most likely forget where they parked?",
  "Who would most likely get embarrassed by a text?",
  "Who would most likely fail at a DIY project?",
  "Who is most likely to laugh at the wrong moment?",
  "Who would most likely survive a horror movie?",
  "Who would be most likely to say 'I told you so'?",
  "Who would most likely lie to get out of trouble?",
  "Who is most likely to eat fast food at 3am?",
  "Who would most likely be on a reality TV show?",
  "Who would most likely launch a startup?",
  "Who is most likely to fall asleep in the cinema?",
  "Who is most likely to faint at the sight of blood?",
  "Who would most likely win a scavenger hunt?",
  "Who would most likely become a teacher?",
  "Who would most likely get lost on a hike?",
  "Who is most likely to prank another friend?",
  "Who would most likely start a dance-off?",
  "Who would most likely be the best parent?",
  "Who would most likely break a world record?",
  "Who would most likely get arrested for something hilarious?",
  "Who would most likely shoplift (but get caught)?",
  "Who is most likely to befriend an ex?",
  "Who would most likely binge-watch a whole series overnight?",
  "Who would most likely pull a risky stunt for a dare?",
  "Who would most likely survive a week without their phone?",
  "Who would most likely donate all their money to charity?",
  "Who is the most likely to fall for a scam?",
  "Who would be most likely to run a marathon?",
  "Who would most likely become a chef?",
  "Who is the biggest gossip?",
  "Who would most likely ditch plans at the last minute?",
  "Who would most likely pass out from drinking?",
  "Who is most likely to own a million-dollar idea?",
  "Who would be the most unreliable babysitter?",
  "Who would most likely go viral online?",
  "Who is the most likely to win a dating show?",
  "Who would most likely survive a bear attack?",
  "Who would most likely get a dramatic haircut?",
  "Who would most likely become a conspiracy theorist?"
];

/* ---------- UI events ---------- */

createBtn.onclick = () => {
  myName = (nameInput.value || 'Player').trim();
  if(!myName) return showError('Enter a name before creating a room.');
  socket.emit('createRoom', { name: myName }, (res) => {
    if(res && res.ok){
      currentRoom = res.code;
      lastRoomPublic = res.room;
      showLobby(res.room);
      const link = `${location.origin}${location.pathname}?room=${res.code}`;
      showInfo('Room created. Share code: ' + res.code);
    } else showError((res && res.error) || 'Error creating room');
  });
};

joinBtn.onclick = () => {
  myName = (nameInput.value || 'Player').trim();
  const code = (codeInput.value || '').trim().toUpperCase();
  if(!code) return showError('Enter a room code to join.');
  if(!myName) return showError('Enter your name to join.');
  socket.emit('joinRoom', { code, name: myName }, (res) => {
    if(res && res.ok){
      currentRoom = code;
      lastRoomPublic = res.room;
      showLobby(res.room);
    } else showError((res && res.error) || 'Join failed');
  });
};

leaveBtn.onclick = () => {
  socket.emit('leaveRoom');
  resetToJoin();
};

startRoundBtn.onclick = () => {
  const majority = pickRandom(qBank);
  let impQ = pickRandom(qBank);
  let attempts = 0;
  while(impQ === majority && attempts < 25){ impQ = pickRandom(qBank); attempts++; }
  socket.emit('startRound', { questionPair: { majority, imposter: impQ } }, (res) => {
    if(!res || !res.ok) showError((res && res.error) || 'Start round failed');
  });
};

submitAnswerBtn.onclick = () => {
  if(!selectedAnswer) return showError('Pick someone to answer first.');
  socket.emit('submitAnswer', { answer: selectedAnswer }, (res) => {
    if(res && res.ok){
      submittedMsg.classList.remove('hidden');
      submitAnswerBtn.disabled = true;
      submitAnswerBtn.classList.add('disabled');
      // disable selection buttons
      answerButtons.querySelectorAll('button').forEach((b) => b.disabled = true);
    } else showError((res && res.error) || 'Submit failed');
  });
};

submitVoteBtn && (submitVoteBtn.onclick = () => {
  if(!selectedVote) return showError('Select someone to vote for first.');
  socket.emit('castVote', { targetSocketId: selectedVote }, (res) => {
    if(res && res.ok){
      submitVoteBtn.disabled = true;
      submitVoteBtn.classList.add('disabled');
      voteButtons.querySelectorAll('button').forEach(b => b.disabled = true);
    } else showError((res && res.error) || 'Vote failed');
  });
});

if(endRoundBtn){
  endRoundBtn.onclick = () => {
    socket.emit('endRound', (res) => {
      if(!res || !res.ok) showError((res && res.error) || 'End round failed. Maybe voting not complete?');
    });
  };
}

/* Modal open/close */
howBtn.onclick = () => modalOverlay.classList.remove('hidden');
closeModal.onclick = () => modalOverlay.classList.add('hidden');
modalOverlay.onclick = (e) => { if(e.target === modalOverlay) modalOverlay.classList.add('hidden'); };

/* ---------- Socket handlers ---------- */

socket.on('connect', () => {
  myId = socket.id;
  const params = new URLSearchParams(location.search);
  if(params.get('room') && !currentRoom) codeInput.value = params.get('room').toUpperCase();
});

socket.on('roomUpdate', (room) => {
  if(!room) return;
  currentRoom = room.code;
  lastRoomPublic = room;
  players = room.players || [];
  showLobby(room);
  updateSubmissionCounter(room.counts);
  updateVoteCounter(room.counts);
});

socket.on('roundStarted', ({ yourQuestion, isImposter, roundId }) => {
  joinSection.classList.add('hidden');
  lobby.classList.add('hidden');
  playArea.classList.remove('hidden');

  revealArea.classList.add('hidden');
  votingArea.classList.add('hidden');
  votingResult.classList.add('hidden');

  yourQuestionText.textContent = yourQuestion;
  submittedMsg.classList.add('hidden');

  selectedAnswer = null;
  selectedVote = null;
  submitAnswerBtn.disabled = true;
  submitAnswerBtn.classList.add('disabled');
  if(submitVoteBtn){ submitVoteBtn.disabled = true; submitVoteBtn.classList.add('disabled'); }

  populateAnswerButtons();
  updateSubmissionCounter(lastRoomPublic && lastRoomPublic.counts);
});

socket.on('revealRound', ({ majorityQuestion: mq, answers }) => {
  revealArea.classList.remove('hidden');
  majorityQuestion.textContent = mq;
  answersList.innerHTML = '';
  answers.forEach(a => {
    const el = document.createElement('div');
    el.className = 'answerItem';
    el.innerHTML = `<div><strong>${escapeHtml(a.fromName)}</strong> answered</div><div>${escapeHtml(a.answer)}</div>`;
    answersList.appendChild(el);
  });

  votingArea.classList.remove('hidden');
  populateVoteButtons();
  updateVoteCounter(lastRoomPublic && lastRoomPublic.counts);
});

socket.on('votingResult', ({ chosen, chosenName, impostorId, impostorName, impostorCaught }) => {
  votingResult.classList.remove('hidden');
  votingResult.innerHTML = `<strong>Vote result:</strong> ${escapeHtml(chosenName)} was chosen. <br/>
    <strong>Imposter:</strong> ${escapeHtml(impostorName)}. <br/>
    ${impostorCaught ? '<strong>Group wins this round!</strong>' : '<strong>Imposter wins this round!</strong>'}`;
  updateEndRoundButtonVisibility();
});

socket.on('roundEnded', () => {
  resetToJoin();
  showInfo('Round ended. Host can start a new round.');
});

socket.on('showError', (msg) => showError(msg));

socket.on('kicked', ({ message }) => {
  showError(message || 'You were kicked from the room.');
  setTimeout(() => {
    try { socket.disconnect(); } catch(e){}
    resetToJoin();
  }, 700);
});

/* ---------- UI helpers ---------- */

function showLobby(room){
  const state = room.state || 'lobby';
  if(state === 'lobby'){
    joinSection.classList.remove('hidden');
    lobby.classList.remove('hidden');
    playArea.classList.add('hidden');
  } else {
    joinSection.classList.add('hidden');
    lobby.classList.add('hidden');
    playArea.classList.remove('hidden');
  }

  roomCodeEl.textContent = room.code || '';
  roundNum.textContent = room.round || 0;

  // players list (show kick button to host)
  playersList.innerHTML = '';
  (room.players || []).forEach(p => {
    const div = document.createElement('div');
    div.className = 'playerRow';
    const nameHtml = `<div class="playerName">${escapeHtml(p.name)}</div>`;
    const scoreHtml = `<div class="score">Group:${p.score.group} Imp:${p.score.impostor}</div>`;
    div.innerHTML = nameHtml + scoreHtml;

    // if current user is host, show a small kick button (not on themselves)
    if(room.host === socket.id && p.id !== socket.id){
      const kickBtn = document.createElement('button');
      kickBtn.className = 'small-kick';
      kickBtn.textContent = 'Kick';
      kickBtn.onclick = () => {
        if(!confirm(`Kick ${p.name}?`)) return;
        socket.emit('kickPlayer', { targetId: p.id }, (res) => {
          if(!res || !res.ok) showError((res && res.error) || 'Kick failed');
          else showInfo(`${p.name} was removed`);
        });
      };
      div.appendChild(kickBtn);
    }

    playersList.appendChild(div);
  });

  // start only visible to host and only when in lobby
  startRoundBtn.style.display = (room.host === socket.id && state === 'lobby') ? 'inline-block' : 'none';

  updateEndRoundButtonVisibility();
}

function populateAnswerButtons(){
  answerButtons.innerHTML = '';
  const finalNames = (players || []).map(p => p.name);
  finalNames.forEach(nm => {
    const b = document.createElement('button');
    b.className = 'answerBtn';
    b.textContent = nm;
    b.onclick = () => {
      // select this answer visually
      answerButtons.querySelectorAll('button').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      selectedAnswer = nm;
      submitAnswerBtn.disabled = false;
      submitAnswerBtn.classList.remove('disabled');
    };
    answerButtons.appendChild(b);
  });
  submittedMsg.classList.add('hidden');
}

function populateVoteButtons(){
  voteButtons.innerHTML = '';
  (players || []).forEach(p => {
    const b = document.createElement('button');
    b.className = 'voteBtn';
    b.textContent = p.name;
    b.onclick = () => {
      // visually indicate selected vote
      voteButtons.querySelectorAll('button').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');

      selectedVote = p.id;
      submitVoteBtn.disabled = false;
      submitVoteBtn.classList.remove('disabled');
    };
    voteButtons.appendChild(b);
  });
  if(submitVoteBtn){ submitVoteBtn.disabled = true; submitVoteBtn.classList.add('disabled'); }
}

function updateEndRoundButtonVisibility(){
  if(!endRoundBtn) return;
  const isVotingResultVisible = !votingResult.classList.contains('hidden');
  const isHost = lastRoomPublic && lastRoomPublic.host === socket.id;
  if(isVotingResultVisible && isHost){
    endRoundBtn.classList.remove('hidden');
    endRoundBtn.style.display = 'inline-block';
  } else {
    endRoundBtn.classList.add('hidden');
    endRoundBtn.style.display = 'none';
  }
}

function resetToJoin(){
  joinSection.classList.remove('hidden');
  lobby.classList.add('hidden');
  playArea.classList.add('hidden');
  currentRoom = null;
  selectedAnswer = null;
  selectedVote = null;
  lastRoomPublic = null;

  revealArea.classList.add('hidden');
  votingArea.classList.add('hidden');
  votingResult.classList.add('hidden');
  submittedMsg.classList.add('hidden');

  answerButtons.innerHTML = '';
  answersList.innerHTML = '';
  voteButtons.innerHTML = '';
  submissionCounter.textContent = '';
  voteCounter.textContent = '';
}

/* submission/vote counter updates */
function updateSubmissionCounter(counts){
  if(!counts) { submissionCounter.textContent = ''; return; }
  submissionCounter.textContent = `Submitted: ${counts.answers} / ${counts.totalPlayers}`;
}
function updateVoteCounter(counts){
  if(!counts) { voteCounter.textContent = ''; return; }
  voteCounter.textContent = `Votes: ${counts.votes} / ${counts.totalPlayers}`;
}

/* error / info in-UI display */
let errorTimeout = null;
function showError(message){
  if(!errorBox) return alert(message);
  errorBox.classList.remove('hidden');
  errorBox.style.background = 'linear-gradient(180deg,#ffdddd,#ffecec)';
  errorBox.style.color = '#661111';
  errorBox.textContent = message;
  clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => {
    errorBox.classList.add('hidden');
  }, 6000);
}
function showInfo(message){
  if(!errorBox) return alert(message);
  errorBox.classList.remove('hidden');
  errorBox.style.background = 'linear-gradient(180deg,#eef6ff,#dff3ff)';
  errorBox.style.color = '#033649';
  errorBox.textContent = message;
  clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => {
    errorBox.classList.add('hidden');
  }, 4000);
}

/* Utilities */
function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }
