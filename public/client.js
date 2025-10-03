// public/client.js
const socket = io();
let myId = null;
let currentRoom = null;
let players = []; // array of {id, name, score}
let myName = '';

/* ---------- Question bank (same as before) ---------- */
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

/* ---------- UI references ---------- */
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
const endRoundBtn = document.getElementById('endRoundBtn'); // new button added to index.html

/* ---------- Button handlers ---------- */
createBtn.onclick = () => {
  myName = (nameInput.value || 'Player').trim();
  socket.emit('createRoom', {name: myName}, (res) => {
    if(res && res.ok){
      currentRoom = res.code;
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
  socket.emit('joinRoom', {code, name: myName}, (res) => {
    if(res && res.ok){
      currentRoom = code;
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

/* Host ends the round (clears server round state and returns to lobby) */
if(endRoundBtn){
  endRoundBtn.onclick = () => {
    socket.emit('endRound', (res) => {
      if(res && res.ok){
        // Server will emit roundEnded and roomUpdate; UI will update from those events.
      } else {
        alert((res && res.error) || 'Failed to end round');
      }
    });
  };
}

/* Start round (select pair of questions and ask server to start) */
startRoundBtn.onclick = () => {
  // pick majority + imposter Q
  const majority = pickRandom(qBank);
  let impQ = pickRandom(qBank);
  let attempts=0;
  while(impQ === majority && attempts < 25){ impQ = pickRandom(qBank); attempts++; }
  socket.emit('startRound', {questionPair: {majority, imposter: impQ}}, (res) => {
    if(!res || !res.ok) alert((res && res.error) || 'start failed');
  });
};

/* ---------- Socket events ---------- */
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
  players = room.players || [];
  // update UI lists and controls depending on state
  showLobby(room);
});

socket.on('roundStarted', ({yourQuestion, isImposter, roundId}) => {
  // show play area with your secret question and keep it visible until reveal
  joinSection.classList.add('hidden');
  lobby.classList.add('hidden');
  playArea.classList.remove('hidden');

  // hide reveal/voting/result panels
  revealArea.classList.add('hidden');
  votingArea.classList.add('hidden');
  votingResult.classList.add('hidden');

  // show secret
  yourQuestionText.textContent = yourQuestion;
  submittedMsg.classList.add('hidden');
  populateAnswerButtons(); // build answer buttons from current players
});

socket.on('revealRound', ({majorityQuestion: mq, answers}) => {
  // hide secret panel (answers are now revealed)
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

socket.on('votingResult', ({chosen, chosenName, impostorId, impostorName, impostorCaught}) => {
  votingResult.classList.remove('hidden');
  votingResult.innerHTML = `<strong>Vote result:</strong> ${escapeHtml(chosenName)} was chosen. <br/>
    <strong>Imposter:</strong> ${escapeHtml(impostorName)}. <br/>
    ${impostorCaught ? '<strong>Group wins this round!</strong>' : '<strong>Imposter wins this round!</strong>'}`;

  // show End Round (Next Round) button to host
  updateEndRoundButtonVisibility();
});

socket.on('roundEnded', () => {
  // Host ended the round: clear UI and go back to lobby
  resetToJoin(); // this will show the join/create screen; host can re-open lobby via join/create flow
});

/* ---------- UI helper functions ---------- */

function showLobby(room){
  // If there's an active round in the server, show playArea; otherwise show lobby UI
  const state = room.state || 'lobby';
  if(state === 'lobby'){
    // show lobby view
    joinSection.classList.add('hidden');
    lobby.classList.remove('hidden');
    playArea.classList.add('hidden');
  } else {
    // show play area (an active round is happening or showing votes)
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

  // show start button only to host and only when in lobby
  startRoundBtn.style.display = (room.host === socket.id && state === 'lobby') ? 'inline-block' : 'none';

  // show endRoundBtn only to host when the game is in votingResult or showing state
  updateEndRoundButtonVisibility();
}

/* Build the list of answer buttons (player names) */
function populateAnswerButtons(){
  answerButtons.innerHTML = '';
  const finalNames = (players || []).map(p => p.name);
  finalNames.forEach(nm => {
    const b = document.createElement('button');
    b.className = 'answerBtn';
    b.textContent = nm;
    b.onclick = () => {
      socket.emit('submitAnswer', {answer: nm}, (res) => {
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

/* Build vote buttons (uses latest players array which includes ids) */
function populateVoteButtons(){
  voteButtons.innerHTML = '';
  (players || []).forEach(p => {
    const b = document.createElement('button');
    b.className = 'voteBtn';
    b.textContent = p.name;
    b.onclick = () => {
      socket.emit('castVote', {targetSocketId: p.id}, (res) => {
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

/* Update whether the End Round button is visible (only host can use it) */
function updateEndRoundButtonVisibility(){
  // Show if current room state is votingResult or showing (server will have provided latest roomUpdate)
  // We rely on 'players' and 'currentRoom' being set via roomUpdate events.
  // Find the last known state by asking server? We rely on UI being updated on 'roomUpdate' earlier.
  // Simpler: check if endRoundBtn exists and show it only if current user is host and playArea is visible and votingResult is visible
  if(!endRoundBtn) return;
  // if votingResult is visible and user is host -> show
  if(!votingResult.classList.contains('hidden') && (players.find(p => p.id === socket.id) || true)){
    // need to verify host: get latest room from currentRoom variable by reading DOM roomCode and comparing to cached players
    // We'll check startRoundBtn visibility; better to rely on last roomUpdate stored in DOM: fetch host from server via roomUpdate event
    // As a fallback, show the button to the host by checking the startRoundBtn display/ownership: invisible when not host in lobby.
  }
  // We'll toggle visibility by comparing host id from the last room update stored in a hidden variable:
  // For simplicity, fetch host by reading the room UI (we can request a fresh update from server but that's unnecessary)
  // Show the button only if user is the host and votingResult is visible
  const isHost = (() => {
    // find host by scanning player list and seeing which player entry has no indicator — we don't store host locally easily.
    // Instead rely on startRoundBtn display in lobby: if user is host, startRoundBtn is visible when lobby shown.
    // But here, lobby hidden. We'll ask server for a fresh roomUpdate by emitting a noop to trigger server's current state.
    return false; // keep hidden unless explicit roomUpdate sets startRoundBtn visible in lobby.
  })();
  // Simpler: always show endRoundBtn to the host by setting the button to display when votingResult is shown and the host (server-side) will ignore if not host.
  // So we'll show the button when votingResult visible, and server will validate host on 'endRound'.
  if(!votingResult.classList.contains('hidden')){
    endRoundBtn.style.display = 'inline-block';
  } else {
    endRoundBtn.style.display = 'none';
  }
}

/* Reset UI back to join screen (called after server emits roundEnded) */
function resetToJoin(){
  joinSection.classList.remove('hidden');
  lobby.classList.add('hidden');
  playArea.classList.add('hidden');
  currentRoom = null;
  // clear any panels
  revealArea.classList.add('hidden');
  votingArea.classList.add('hidden');
  votingResult.classList.add('hidden');
  submittedMsg.classList.add('hidden');
}

/* Utilities */
function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

/* keep listening for roomUpdate once more to ensure players list is fresh */
socket.on('roomUpdate', (room) => {
  if(!room) return;
  currentRoom = room.code;
  players = room.players || [];
  // update lobby / controls based on the current room state
  showLobby(room);
});
