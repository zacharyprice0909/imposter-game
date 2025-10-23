const socket = io();
let myId = null;
let currentRoom = null;
let players = [];
let myName = '';
let lastRoomPublic = null;
let selectedAnswer = null;
let selectedVote = null;

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
  "Who would be most likely to become a teacher?",
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

const nameInput = document.getElementById('nameInput');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const codeInput = document.getElementById('codeInput');

const lobby = document.getElementById('lobby');
const joinSection = document.getElementById('join');
const roomCodeEl = document.getElementById('roomCode');
const playersList = document.getElementById('playersList');
const startRoundBtn = document.getElementById('startRoundBtn');
const leaveBtn = document.getElementById('leaveBtn');
const roundNum = document.getElementById('roundNum');

const playArea = document.getElementById('playArea');
const yourQuestionText = document.getElementById('yourQuestionText');
const answerButtons = document.getElementById('answerButtons');
const submittedMsg = document.getElementById('submittedMsg');
const submitAnswerBtn = document.createElement('button');
submitAnswerBtn.id = 'submitAnswerBtn';
submitAnswerBtn.textContent = 'Submit Answer';
submitAnswerBtn.style.display = 'none';

const revealArea = document.getElementById('revealArea');
const majorityQuestion = document.getElementById('majorityQuestion');
const answersList = document.getElementById('answersList');
const votingArea = document.getElementById('votingArea');
const voteButtons = document.getElementById('voteButtons');
const votingResult = document.getElementById('votingResult');
const endRoundBtn = document.getElementById('endRoundBtn');

// new elements for voting submit & message
const submitVoteBtn = document.createElement('button');
submitVoteBtn.id = 'submitVoteBtn';
submitVoteBtn.textContent = 'Submit Guess';
submitVoteBtn.style.display = 'none';
const submittedVoteMsg = document.createElement('div');
submittedVoteMsg.id = 'submittedVoteMsg';
submittedVoteMsg.className = 'muted small hidden';
submittedVoteMsg.textContent = '✅ Answer Submitted — waiting for others...';

const howtoSection = document.getElementById('howto');
const howtoBtn = document.createElement('button');
howtoBtn.id = 'howtoBtn';
howtoBtn.textContent = 'Instructions';
howtoBtn.style.marginLeft = '8px';

const notifyEl = document.createElement('div');
notifyEl.id = 'notify';
document.body.appendChild(notifyEl);

// insert submit button under answerButtons container
answerButtons.parentNode.insertBefore(submitAnswerBtn, answerButtons.nextSibling);
// insert submitVoteBtn & message under voteButtons
voteButtons.parentNode.insertBefore(submitVoteBtn, voteButtons.nextSibling);
voteButtons.parentNode.insertBefore(submittedVoteMsg, submitVoteBtn.nextSibling);

createBtn.onclick = () => {
  myName = (nameInput.value || 'Player').trim();
  socket.emit('createRoom', { name: myName }, (res) => {
    if(res && res.ok){
      currentRoom = res.code;
      lastRoomPublic = res.room;
      showLobby(res.room);
      const link = `${location.origin}${location.pathname}?room=${res.code}`;
      showNotify('Room created. Share code: ' + res.code + ' — link copied to clipboard.', 6000);
      try { navigator.clipboard?.writeText(link); } catch(e){}
    } else {
      showNotify((res && res.error) || 'Error creating room', 4000, true);
    }
  });
};

joinBtn.onclick = () => {
  myName = (nameInput.value || 'Player').trim();
  const code = (codeInput.value || '').trim().toUpperCase();
  if(!code){ showNotify('Enter a room code', 2500, true); return; }
  socket.emit('joinRoom', { code, name: myName }, (res) => {
    if(res && res.ok){
      currentRoom = code;
      lastRoomPublic = res.room;
      showLobby(res.room);
    } else {
      showNotify((res && res.error) || 'Join failed', 4000, true);
    }
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
    if(!res || !res.ok) showNotify((res && res.error) || 'start failed', 4000, true);
  });
};

if(endRoundBtn){
  endRoundBtn.onclick = () => {
    socket.emit('endRound', (res) => {
      if(!res || !res.ok) showNotify((res && res.error) || 'end round failed', 4000, true);
    });
  };
}

function hostNextRound(){
  const majority = pickRandom(qBank);
  let impQ = pickRandom(qBank);
  let attempts = 0;
  while(impQ === majority && attempts < 25){ impQ = pickRandom(qBank); attempts++; }
  socket.emit('nextRound', { questionPair: { majority, imposter: impQ } }, (res) => {
    if(!res || !res.ok) showNotify((res && res.error) || 'next round failed', 4000, true);
  });
}

/* Socket handlers */
socket.on('connect', () => {
  myId = socket.id;
  const header = document.querySelector('header');
  if(header && !document.getElementById('howtoBtn')) header.appendChild(howtoBtn);

  const params = new URLSearchParams(location.search);
  if(params.get('room') && !currentRoom){
    codeInput.value = params.get('room').toUpperCase();
  }
});

socket.on('roomUpdate', (room) => {
  if(!room) return;
  currentRoom = room.code;
  lastRoomPublic = room;
  players = room.players || [];
  showLobby(room);
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
  submittedVoteMsg.classList.add('hidden');
  populateAnswerButtons();
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
});

socket.on('votingResult', ({ chosen, chosenName, impostorId, impostorName, impostorCaught }) => {
  votingResult.classList.remove('hidden');
  votingResult.innerHTML = `<strong>Vote result:</strong> ${escapeHtml(chosenName)} was chosen. <br/>
    <strong>Imposter:</strong> ${escapeHtml(impostorName)}. <br/>
    ${impostorCaught ? '<strong>Group wins this round!</strong>' : '<strong>Imposter wins this round!</strong>'}`;

  // show Next Round for host reliably when server says votingResult
  if(lastRoomPublic && lastRoomPublic.host === socket.id){
    // remove existing if present
    const existing = document.getElementById('nextRoundBtn');
    if(existing) existing.remove();
    const controls = document.querySelector('.controls');
    if(controls){
      const b = document.createElement('button');
      b.id = 'nextRoundBtn';
      b.textContent = 'Next Round';
      b.onclick = () => hostNextRound();
      b.className = 'accent';
      controls.insertBefore(b, controls.firstChild || controls);
    }
  }

  updateEndRoundButtonVisibility();
});

socket.on('roundEnded', () => {
  resetToJoin();
});

socket.on('kicked', ({reason}) => {
  showNotify(reason || 'You were kicked from the room', 4000, true);
  resetToJoin();
});

socket.on('votingResult', () => {
  updateEndRoundButtonVisibility();
});

/* UI helpers */
function showLobby(room){
  const state = room.state || 'lobby';
  if(state === 'lobby'){
    joinSection.classList.add('hidden');
    lobby.classList.remove('hidden');
    playArea.classList.add('hidden');
  } else {
    joinSection.classList.add('hidden');
    lobby.classList.add('hidden');
    playArea.classList.remove('hidden');
  }

  roomCodeEl.textContent = room.code || '';
  roundNum.textContent = room.round || 0;

  playersList.innerHTML = '';
  (room.players || []).forEach(p => {
    const div = document.createElement('div');
    div.className = 'playerRow';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'playerName';
    nameDiv.textContent = p.name;
    const rightDiv = document.createElement('div');
    rightDiv.className = 'playerRight';
    rightDiv.innerHTML = `<div class="score">Group:${p.score.group} Imp:${p.score.impostor}</div>`;

    if(room.host === socket.id && p.id !== socket.id){
      const kickBtn = document.createElement('button');
      kickBtn.className = 'mini red kickBtn';
      kickBtn.textContent = 'Kick';
      kickBtn.onclick = () => {
        if(!confirm(`Kick ${p.name}?`)) return;
        socket.emit('kickPlayer', { targetId: p.id }, (res) => {
          if(!res || !res.ok) showNotify((res && res.error) || 'Kick failed', 3000, true);
          else showNotify(`${p.name} kicked`, 2500);
        });
      };
      rightDiv.appendChild(kickBtn);
    }

    div.appendChild(nameDiv);
    div.appendChild(rightDiv);
    playersList.appendChild(div);
  });

  // start only visible to host and only when in lobby
  startRoundBtn.style.display = (room.host === socket.id && state === 'lobby') ? 'inline-block' : 'none';

  // ensure Next Round button presence removed if not appropriate
  const nextBtn = document.getElementById('nextRoundBtn');
  if(nextBtn && room.state !== 'votingResult') nextBtn.remove();

  updateEndRoundButtonVisibility();
}

function populateAnswerButtons(){
  answerButtons.innerHTML = '';
  selectedAnswer = null;
  submitAnswerBtn.style.display = 'none';
  const finalPlayers = (players || []);
  finalPlayers.forEach(p => {
    const b = document.createElement('button');
    b.className = 'answerBtn';
    b.textContent = p.name;
    b.onclick = () => {
      answerButtons.querySelectorAll('button').forEach(bt => bt.classList.remove('selected'));
      b.classList.add('selected');
      selectedAnswer = p.name;
      submitAnswerBtn.style.display = 'inline-block';
    };
    answerButtons.appendChild(b);
  });
  submittedMsg.classList.add('hidden');

  submitAnswerBtn.onclick = () => {
    if(!selectedAnswer){ showNotify('Select someone first', 2000, true); return; }
    socket.emit('submitAnswer', { answer: selectedAnswer }, (res) => {
      if(res && res.ok){
        submittedMsg.classList.remove('hidden');
        answerButtons.querySelectorAll('button').forEach(bt => bt.disabled = true);
        submitAnswerBtn.style.display = 'none';
      } else {
        showNotify((res && res.error) || 'Submit failed', 3000, true);
      }
    });
  };
}

function populateVoteButtons(){
  voteButtons.innerHTML = '';
  selectedVote = null;
  submitVoteBtn.style.display = 'none';
  submittedVoteMsg.classList.add('hidden');

  (players || []).forEach(p => {
    const b = document.createElement('button');
    b.className = 'voteBtn';
    b.textContent = p.name;
    b.onclick = () => {
      voteButtons.querySelectorAll('button').forEach(bt => bt.classList.remove('selected'));
      b.classList.add('selected');
      selectedVote = p.id;
      submitVoteBtn.style.display = 'inline-block';
    };
    voteButtons.appendChild(b);
  });

  submitVoteBtn.onclick = () => {
    if(!selectedVote){ showNotify('Select someone to guess', 2000, true); return; }
    socket.emit('castVote', { targetSocketId: selectedVote }, (res) => {
      if(res && res.ok){
        voteButtons.querySelectorAll('button').forEach(bt => bt.disabled = true);
        submitVoteBtn.style.display = 'none';
        submittedVoteMsg.classList.remove('hidden');
      } else {
        showNotify((res && res.error) || 'Vote submit failed', 3000, true);
      }
    });
  };
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

  revealArea.classList.add('hidden');
  votingArea.classList.add('hidden');
  votingResult.classList.add('hidden');
  submittedMsg.classList.add('hidden');
  submittedVoteMsg.classList.add('hidden');

  const nextBtn = document.getElementById('nextRoundBtn');
  if(nextBtn) nextBtn.remove();
}

/* Utilities */
function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

function showNotify(msg, timeout = 3500, isError = false){
  notifyEl.textContent = msg;
  notifyEl.className = isError ? 'notify error' : 'notify';
  notifyEl.style.opacity = '1';
  if(timeout > 0){
    setTimeout(()=> {
      notifyEl.style.opacity = '0';
    }, timeout);
  }
}

/* Instructions toggle */
howtoBtn.onclick = () => {
  if(!howtoSection) return;
  howtoSection.classList.toggle('hidden');
  if(!howtoSection.classList.contains('hidden')){
    howtoBtn.textContent = 'Hide Instructions';
  } else {
    howtoBtn.textContent = 'Instructions';
  }
};
