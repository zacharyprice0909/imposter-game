// public/client.js
const socket = io();
let myId = null;
let currentRoom = null;
let players = [];
let myName = '';
let lastRoomPublic = null;

const qBank = [
"Who is most likely to cheat in a game?",
"Who is most likely to forget their best friend’s birthday?",
"Who is most likely to laugh at the wrong moment?",
"Who is most likely to eat dessert before dinner?",
"Who is most likely to trip while walking?",
"Who is most likely to take the longest to get ready?",
"Who is most likely to win a karaoke contest?",
"Who is most likely to start a dance party?",
"Who is most likely to fall asleep during a movie?",
"Who is most likely to tell the funniest jokes?",
"Who is most likely to get scared in a haunted house?",
"Who is most likely to forget where they put their phone?",
"Who is most likely to take the most selfies?",
"Who is most likely to talk during a movie?",
"Who is most likely to spill their drink?",
"Who is most likely to sing in the shower?",
"Who is most likely to survive on a deserted island?",
"Who is most likely to be late to everything?",
"Who is most likely to adopt a stray animal?",
"Who is most likely to be the family chef?",
"Who is most likely to binge-watch a whole show in one day?",
"Who is most likely to tell a secret accidentally?",
"Who is most likely to laugh until they cry?",
"Who is most likely to plan a surprise party?",
"Who is most likely to win a board game?",
"Who is most likely to forget people’s names?",
"Who is most likely to talk to strangers?",
"Who is most likely to sing out loud in public?",
"Who is most likely to make everyone smile?",
"Who is most likely to keep calm in a crisis?",
"Who is most likely to say something silly?",
"Who is most likely to be found reading a book?",
"Who is most likely to start a new hobby?",
"Who is most likely to spend too much time on their phone?",
"Who is most likely to give the best advice?",
"Who is most likely to be the best storyteller?",
"Who is most likely to take charge in a group?",
"Who is most likely to dance in the rain?",
"Who is most likely to forget what day it is?",
"Who is most likely to accidentally spoil a surprise?",
"Who is most likely to stay up too late?",
"Who is most likely to be the early riser?",
"Who is most likely to win a talent show?",
"Who is most likely to make a funny face in photos?",
"Who is most likely to forget to reply to messages?",
"Who is most likely to make everyone laugh?",
"Who is most likely to be the peacemaker?",
"Who is most likely to spend the most time shopping?",
"Who is most likely to organize a family outing?",
"Who is most likely to make the best prankster?",
"Who is most likely to tell a dad joke?",
"Who is most likely to bring snacks everywhere?",
"Who is most likely to say ‘just five more minutes’?",
"Who is most likely to know the lyrics to every song?",
"Who is most likely to talk to pets like people?",
"Who is most likely to lose at hide and seek?",
"Who is most likely to help others with homework?",
"Who is most likely to love camping?",
"Who is most likely to take the best photos?",
"Who is most likely to have a messy room?",
"Who is most likely to keep a secret?",
"Who is most likely to start a funny argument?",
"Who is most likely to stay calm under pressure?",
"Who is most likely to remember everyone’s birthday?",
"Who is most likely to forget what they were saying?",
"Who is most likely to tell ghost stories at night?",
"Who is most likely to make a new friend anywhere?",
"Who is most likely to cry during a movie?",
"Who is most likely to overpack for a trip?",
"Who is most likely to sleep through their alarm?",
"Who is most likely to finish a puzzle first?",
"Who is most likely to bake cookies for fun?",
"Who is most likely to decorate for every holiday?",
"Who is most likely to take the last piece of cake?",
"Who is most likely to say ‘I’m not hungry’ and then eat your food?",
"Who is most likely to quote movie lines?",
"Who is most likely to take charge in an emergency?",
"Who is most likely to accidentally break something?",
"Who is most likely to hum a song all day?",
"Who is most likely to be the best secret keeper?",
"Who is most likely to laugh at their own jokes?",
"Who is most likely to get lost even with GPS?",
"Who is most likely to tell a white lie to make someone feel better?",
"Who is most likely to forget their password?",
"Who is most likely to get the giggles at the wrong time?",
"Who is most likely to try something new on the menu?",
"Who is most likely to talk too much when nervous?",
"Who is most likely to start singing randomly?",
"Who is most likely to double-text someone?",
"Who is most likely to be the teacher’s favorite?",
"Who is most likely to start a pillow fight?",
"Who is most likely to take forever to choose a movie?",
"Who is most likely to notice small details?",
"Who is most likely to make a weird face in photos?",
"Who is most likely to stay friends with everyone?",
"Who is most likely to bring extra napkins or tissues?",
"Who is most likely to laugh in a serious moment?",
"Who is most likely to plan a big family trip?",
"Who is most likely to cheer everyone up?",
"Who is most likely to take the best group selfies?",
"Who is most likely to make up a silly song?",
"Who is most likely to tell the truth even when it’s awkward?",
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

const revealArea = document.getElementById('revealArea');
const majorityQuestion = document.getElementById('majorityQuestion');
const answersList = document.getElementById('answersList');
const votingArea = document.getElementById('votingArea');
const voteButtons = document.getElementById('voteButtons');
const votingResult = document.getElementById('votingResult');
const endRoundBtn = document.getElementById('endRoundBtn');

createBtn.onclick = () => {
  myName = (nameInput.value || 'Player').trim();
  socket.emit('createRoom', { name: myName }, (res) => {
    if(res && res.ok){
      currentRoom = res.code;
      lastRoomPublic = res.room;
      showLobby(res.room);
      const link = `${location.origin}${location.pathname}?room=${res.code}`;
      alert('Room created. Share code: ' + res.code + '\nOr share this link: ' + link);
    } else {
      alert((res && res.error) || 'Error creating room');
    }
  });
};

joinBtn.onclick = () => {
  myName = (nameInput.value || 'Player').trim();
  const code = (codeInput.value || '').trim().toUpperCase();
  if(!code){ alert('Enter a room code'); return; }
  socket.emit('joinRoom', { code, name: myName }, (res) => {
    if(res && res.ok){
      currentRoom = code;
      lastRoomPublic = res.room;
      showLobby(res.room);
    } else {
      alert((res && res.error) || 'Join failed');
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
    if(!res || !res.ok) alert((res && res.error) || 'start failed');
  });
};

if(endRoundBtn){
  endRoundBtn.onclick = () => {
    socket.emit('endRound', (res) => {
      if(!res || !res.ok) alert((res && res.error) || 'end round failed');
    });
  };
}

/* Socket handlers */
socket.on('connect', () => {
  myId = socket.id;
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
    div.innerHTML = `<div class="playerName">${escapeHtml(p.name)}</div><div class="score">Group:${p.score.group} Imp:${p.score.impostor}</div>`;
    playersList.appendChild(div);
  });

  // start only visible to host and only when in lobby
  startRoundBtn.style.display = (room.host === socket.id && state === 'lobby') ? 'inline-block' : 'none';
  // end round visible only when votingResult shown and host
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
      socket.emit('submitAnswer', { answer: nm }, (res) => {
        if(res && res.ok){
          submittedMsg.classList.remove('hidden');
          answerButtons.querySelectorAll('button').forEach(bt => bt.disabled = true);
        } else {
          alert((res && res.error) || 'Submit failed');
        }
      });
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
      socket.emit('castVote', { targetSocketId: p.id }, (res) => {
        if(res && res.ok){
          voteButtons.querySelectorAll('button').forEach(x => x.disabled = true);
        } else {
          alert((res && res.error) || 'Vote failed');
        }
      });
    };
    voteButtons.appendChild(b);
  });
}

function updateEndRoundButtonVisibility(){
  if(!endRoundBtn) return;
  // show only if votingResult is visible AND current user is host
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

  // refresh last room public by requesting one via joining? easiest is to leave UI as simple lobby—server will send roomUpdate for remaining players
}

/* Utilities */
function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }
