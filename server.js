// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const crypto = require('crypto');

app.use(express.static('public'));

const rooms = {}; // in-memory room state

function makeCode(len = 4){
  return crypto.randomBytes(len).toString('base64').replace(/[+/=]/g,'').substr(0,len).toUpperCase();
}

function pickRandom(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

function mapAnswersToNames(answers, players){
  const out = [];
  for(const [sid, answer] of Object.entries(answers)){
    const pname = players[sid] ? players[sid].name : 'Unknown';
    out.push({fromId: sid, fromName: pname, answer});
  }
  return out;
}

function getRoomPublic(code){
  const r = rooms[code];
  if(!r) return null;
  return {
    code,
    host: r.host,
    players: Object.entries(r.players).map(([id, p]) => ({id, name:p.name, score:p.score})),
    round: r.round,
    state: r.state,
    roundData: r.roundData ? { id: r.roundData.id } : null
  };
}

io.on('connection', socket => {
  // create a room
  socket.on('createRoom', ({name}, cb) => {
    const code = makeCode(4);
    rooms[code] = {
      host: socket.id,
      players: {}, // socketId -> {name, score, ready}
      order: [], // socketId order
      round: 0,
      state: 'lobby', // lobby, inRound, showing, voting, votingResult
      roundData: null
    };
    socket.join(code);
    rooms[code].players[socket.id] = { name: name || 'Player', score: {group:0, impostor:0} , ready:false };
    rooms[code].order.push(socket.id);
    socket.roomCode = code;
    cb && cb({ok:true, code, room: getRoomPublic(code)});
    io.to(code).emit('roomUpdate', getRoomPublic(code));
  });

  // join existing room
  socket.on('joinRoom', ({code, name}, cb) => {
    if(!rooms[code]) return cb && cb({ok:false, error:'Room not found'});
    socket.join(code);
    rooms[code].players[socket.id] = { name: name || 'Player', score: {group:0, impostor:0}, ready:false };
    rooms[code].order.push(socket.id);
    socket.roomCode = code;
    cb && cb({ok:true, room: getRoomPublic(code)});
    io.to(code).emit('roomUpdate', getRoomPublic(code));
  });

  socket.on('leaveRoom', () => {
    leave(socket);
  });

  // start a new round (only when room state is 'lobby')
  socket.on('startRound', ({questionPair}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code]) return cb && cb({ok:false, error:'Room not found'});
    const room = rooms[code];
    if(room.host !== socket.id) return cb && cb({ok:false, error:'not host'});
    if(room.state !== 'lobby') return cb && cb({ok:false, error:'Round already in progress'});

    if(Object.keys(room.players).length < 3) {
      return cb && cb({ok:false, error:'Need 3+ players to start'});
    }

    room.round++;
    room.state = 'inRound';
    room.roundData = {
      id: room.round,
      majorityQuestion: questionPair.majority,
      imposterQuestion: questionPair.imposter,
      imposter: pickRandom(Object.keys(room.players)),
      answers: {}, // socketId -> chosen playerName
      votes: {},   // socketId -> voted target socketId
    };

    // send secret (role-specific question) to each player
    for(const sid of Object.keys(room.players)){
      const roleQuestion = sid === room.roundData.imposter ? room.roundData.imposterQuestion : room.roundData.majorityQuestion;
      io.to(sid).emit('roundStarted', {
        yourQuestion: roleQuestion,
        isImposter: sid === room.roundData.imposter,
        roundId: room.round
      });
    }

    io.to(code).emit('roomUpdate', getRoomPublic(code));
    cb && cb({ok:true});
  });

  // player submits their answer (a chosen player name)
  socket.on('submitAnswer', ({answer}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code] || !rooms[code].roundData) return cb && cb({ok:false, error:'No active round'});
    const room = rooms[code];
    // record answer
    room.roundData.answers[socket.id] = answer;
    io.to(code).emit('roomUpdate', getRoomPublic(code));

    // if all players have answered -> reveal majority question and answers to everyone
    const totalPlayers = Object.keys(room.players).length;
    const submitted = Object.keys(room.roundData.answers).length;
    if(submitted >= totalPlayers){
      room.state = 'showing';
      io.to(code).emit('revealRound', {
        majorityQuestion: room.roundData.majorityQuestion,
        answers: mapAnswersToNames(room.roundData.answers, room.players)
      });
      io.to(code).emit('roomUpdate', getRoomPublic(code));
    }
    cb && cb({ok:true});
  });

  // cast vote for who is the imposter (send target socketId)
  socket.on('castVote', ({targetSocketId}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code] || !rooms[code].roundData) return cb && cb({ok:false, error:'No active round'});
    const room = rooms[code];
    if(room.state !== 'showing' && room.state !== 'voting') {
      // allow voting once reveal happened
      // but still accept votes if state is showing (we'll move to voting when someone casts)
    }
    room.roundData.votes[socket.id] = targetSocketId;
    // mark state as voting once votes start
    room.state = 'voting';
    io.to(code).emit('roomUpdate', getRoomPublic(code));

    // if all players voted -> tally and emit result (but do not auto-reset; host must end round)
    if(Object.keys(room.roundData.votes).length >= Object.keys(room.players).length){
      const tally = {};
      for(const v of Object.values(room.roundData.votes)){
        tally[v] = (tally[v]||0) + 1;
      }
      let maxVotes = -1;
      let chosen = null;
      // choose the player with highest votes (simple plurality)
      for(const [k,v] of Object.entries(tally)){
        if(v>maxVotes){ maxVotes=v; chosen=k; }
      }

      const impostorId = room.roundData.imposter;
      const impostorCaught = (chosen === impostorId);

      // update scores (group point to the guessed player if correct, otherwise imposter gets point)
      if(impostorCaught){
        // group gets a point (we'll increment group's score on the caught player for display purposes)
        // choose to increment a central counter? We'll increment group score for the player chosen so scoreboard shows group wins
        // More meaningful: increment a room-wide tallies; for now increment group score on chosen player
        if(room.players[chosen]) room.players[chosen].score.group += 1;
      } else {
        if(room.players[impostorId]) room.players[impostorId].score.impostor += 1;
      }

      room.state = 'votingResult';
      io.to(code).emit('votingResult', {
        chosen,
        chosenName: room.players[chosen] ? room.players[chosen].name : 'Unknown',
        impostorId,
        impostorName: room.players[impostorId] ? room.players[impostorId].name : 'Unknown',
        impostorCaught
      });
      io.to(code).emit('roomUpdate', getRoomPublic(code));
      // NOTE: do NOT auto-reset roundData here. Host must call 'endRound' to clear and return to lobby.
    }

    cb && cb({ok:true});
  });

  // Host ends the round (clears round data, returns to lobby so next round can start)
  socket.on('endRound', (cb) => {
    const code = socket.roomCode;
    if(!rooms[code]) return cb && cb({ok:false, error:'Room not found'});
    const room = rooms[code];
    if(room.host !== socket.id) return cb && cb({ok:false, error:'not host'});
    // clear answers/votes and return to lobby
    room.roundData = null;
    room.state = 'lobby';
    io.to(code).emit('roundEnded'); // notify clients to clear UI
    io.to(code).emit('roomUpdate', getRoomPublic(code));
    cb && cb({ok:true});
  });

  // rename player
  socket.on('rename', ({name}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code] || !rooms[code].players[socket.id]) return cb && cb({ok:false});
    rooms[code].players[socket.id].name = name;
    io.to(code).emit('roomUpdate', getRoomPublic(code));
    cb && cb({ok:true});
  });

  socket.on('disconnect', () => {
    leave(socket);
  });
});

function leave(socket){
  const code = socket.roomCode;
  if(!code || !rooms[code]) return;
  const room = rooms[code];
  delete room.players[socket.id];
  room.order = room.order.filter(id => id !== socket.id);
  if(room.host === socket.id){
    room.host = room.order[0] || null;
  }
  io.to(code).emit('roomUpdate', getRoomPublic(code));
  if(Object.keys(room.players).length === 0) delete rooms[code];
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('listening on', PORT));
