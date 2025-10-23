const socket = io();
let myId = null;
let currentRoom = null;
let players = [];
let myName = '';
let lastRoomPublic = null;
let selectedAnswer = null;

const qBank = [
  // (keep your same bank of questions)
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

createBtn.onclick = () => {
  myName = (nameInput.value || 'Player').trim();
  socket.emit('createRoom', { name: myName }, (res) => {
    if(res && res.ok){
      currentRoom = res.code;
      lastRoomPublic = res.room;
      showLobby(res.room);
      const link = `${location.origin}${location.pathname}?room=${res.code}`;
      showNotify('Room created. Share code: ' + res.code + ' — or this link copied to clipboard.', 6000);
      // try copy link
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
  // endRound acts like "back to lobby" (existing)
  endRoundBtn.onclick = () => {
    // call endRound then show lobby (server will emit roundEnded)
    socket.emit('endRound', (res) => {
      if(!res || !res.ok) showNotify((res && res.error) || 'end round failed', 4000, true);
    });
  };
}

// Next Round: host can immediately start next, using client's qBank to generate questions
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
  // insert instructions button near header
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

  updateEndRoundButtonVisibility();
});

socket.on('roundEnded', () => {
  // after host ends, return to lobby
  resetToJoin();
});

socket.on('kicked', ({reason}) => {
  showNotify(reason || 'You were kicked from the room', 4000, true);
  resetToJoin();
});

socket.on('votingResult', () => {
  // ensure End Round visibility updated
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

    // if host, add Kick button for each other player
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

  // show start only to host and only in lobby
  startRoundBtn.style.display = (room.host === socket.id && state === 'lobby') ? 'inline-block' : 'none';

  // show Next Round button when votingResult visible (host)
  // We'll use the existing endRoundBtn area for host actions; show Next if votingResult
  const isVotingResult = room.state === 'votingResult';
  // create or replace a Next button
  const nextBtn = document.getElementById('nextRoundBtn');
  if(nextBtn) nextBtn.remove();
  if(isVotingResult && room.host === socket.id){
    const b = document.createElement('button');
    b.id = 'nextRoundBtn';
    b.textContent = 'Next Round';
    b.onclick = () => hostNextRound();
    b.className = 'accent';
    // put near controls
    const controls = document.querySelector('.controls');
    if(controls) controls.insertBefore(b, controls.firstChild);
  }

  updateEndRoundButtonVisibility();
}

function populateAnswerButtons(){
  answerButtons.innerHTML = '';
  selectedAnswer = null;
  submitAnswerBtn.style.display = 'none';
  const finalNames = (players || []).map(p => p.name);
  finalNames.forEach(nm => {
    const b = document.createElement('button');
    b.className = 'answerBtn';
    b.textContent = nm;
    b.onclick = () => {
      // visually mark selected
      answerButtons.querySelectorAll('button').forEach(bt => bt.classList.remove('selected'));
      b.classList.add('selected');
      selectedAnswer = nm;
      // reveal submit button
      submitAnswerBtn.style.display = 'inline-block';
    };
    answerButtons.appendChild(b);
  });
  submittedMsg.classList.add('hidden');

  // submit handler
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
  (players || []).forEach(p => {
    const b = document.createElement('button');
    b.className = 'voteBtn';
    b.textContent = p.name;
    b.onclick = () => {
      socket.emit('castVote', { targetSocketId: p.id }, (res) => {
        if(res && res.ok){
          voteButtons.querySelectorAll('button').forEach(x => x.disabled = true);
        } else {
          showNotify((res && res.error) || 'Vote failed', 3000, true);
        }
      });
    };
    voteButtons.appendChild(b);
  });
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

  // remove next button if exists
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
