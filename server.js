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

io.on('connection', socket => {
  socket.on('createRoom', ({name}, cb) => {
    const code = makeCode(4);
    rooms[code] = {
      host: socket.id,
      players: {}, // socketId -> {name, score, ready}
      order: [], // socketId order
      round: 0,
      state: 'lobby', // lobby, inRound, showing, voting
      roundData: null
    };
    socket.join(code);
    rooms[code].players[socket.id] = { name: name || 'Player', score: {group:0, impostor:0} , ready:false };
    rooms[code].order.push(socket.id);
    socket.roomCode = code;
    cb({ok:true, code, room: getRoomPublic(code)});
    io.to(code).emit('roomUpdate', getRoomPublic(code));
  });

  socket.on('joinRoom', ({code, name}, cb) => {
    if(!rooms[code]) return cb({ok:false, error:'Room not found'});
    socket.join(code);
    rooms[code].players[socket.id] = { name: name || 'Player', score: {group:0, impostor:0}, ready:false };
    rooms[code].order.push(socket.id);
    socket.roomCode = code;
    cb({ok:true, room: getRoomPublic(code)});
    io.to(code).emit('roomUpdate', getRoomPublic(code));
  });

  socket.on('leaveRoom', () => {
    leave(socket);
  });

  socket.on('startRound', ({questionPair}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code]) return;
    // only host can start
    if(rooms[code].host !== socket.id) return cb && cb({ok:false, error:'not host'});
    const room = rooms[code];
    if(Object.keys(room.players).length < 3) { // recommended 4-8 but 3 minimum
      return cb && cb({ok:false, error:'Need 3+ players to start'});
    }
    // setup round
    room.round++;
    room.state = 'inRound';
    room.roundData = {
      id: room.round,
      majorityQuestion: questionPair.majority,
      imposterQuestion: questionPair.imposter,
      imposter: pickRandom(Object.keys(room.players)),
      answers: {}, // socketId -> chosen playerName
      revealed: false,
      votes: {} // socketId -> voted target socketId
    };
    // send secret assignment
    for(const sid of Object.keys(room.players)){
      const roleQuestion = sid === room.roundData.imposter ? room.roundData.imposterQuestion : room.roundData.majorityQuestion;
      io.to(sid).emit('roundStarted', {yourQuestion: roleQuestion, isImposter: sid === room.roundData.imposter, roundId: room.round});
    }
    io.to(code).emit('roomUpdate', getRoomPublic(code));
    cb && cb({ok:true});
  });

  socket.on('submitAnswer', ({answer}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code] || !rooms[code].roundData) return;
    rooms[code].roundData.answers[socket.id] = answer;
    io.to(code).emit('roomUpdate', getRoomPublic(code));
    // check if all submitted
    const room = rooms[code];
    const totalPlayers = Object.keys(room.players).length;
    const submitted = Object.keys(room.roundData.answers).length;
    if(submitted >= totalPlayers){
      // reveal majority question and answers to everyone
      room.state = 'showing';
      io.to(code).emit('revealRound', {
        majorityQuestion: room.roundData.majorityQuestion,
        answers: mapAnswersToNames(room.roundData.answers, room.players)
      });
    }
    cb && cb({ok:true});
  });

  socket.on('castVote', ({targetSocketId}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code] || !rooms[code].roundData) return;
    rooms[code].roundData.votes[socket.id] = targetSocketId;
    io.to(code).emit('roomUpdate', getRoomPublic(code));
    // check if all voted
    const room = rooms[code];
    if(Object.keys(room.roundData.votes).length >= Object.keys(room.players).length){
      // tally
      const tally = {};
      for(const v of Object.values(room.roundData.votes)){
        tally[v] = (tally[v]||0) + 1;
      }
      let maxVotes = -1;
      let chosen = null;
      for(const [k,v] of Object.entries(tally)){
        if(v>maxVotes){ maxVotes=v; chosen=k; }
      }
      // determine win
      const impostorId = room.roundData.imposter;
      let impostorCaught = (chosen === impostorId);
      // update scores
      if(impostorCaught){
        room.players[chosen].score.group += 1;
      } else {
        room.players[impostorId].score.impostor += 1;
      }
      room.state = 'votingResult';
      io.to(code).emit('votingResult', {
        chosen,
        chosenName: room.players[chosen] ? room.players[chosen].name : 'Unknown',
        impostorId,
        impostorName: room.players[impostorId].name,
        impostorCaught
      });
      // small delay then reset to lobby for next round (but keep players)
      setTimeout(() => {
        room.roundData = null;
        room.state = 'lobby';
        io.to(code).emit('roomUpdate', getRoomPublic(code));
      }, 1200);
    }
    cb && cb({ok:true});
  });

  socket.on('rename', ({name}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code] || !rooms[code].players[socket.id]) return;
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
  // remove player
  const room = rooms[code];
  delete room.players[socket.id];
  room.order = room.order.filter(id => id !== socket.id);
  // if host left, assign a new host
  if(room.host === socket.id){
    room.host = room.order[0] || null;
  }
  io.to(code).emit('roomUpdate', getRoomPublic(code));
  // if room empty, delete
  if(Object.keys(room.players).length === 0) delete rooms[code];
}

function pickRandom(arr){
  return arr[Math.floor(Math.random()*arr.length)];
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

function mapAnswersToNames(answers, players){
  // answers are player names chosen (client sends chosen name) - keep them as is but also attach who answered
  const out = [];
  for(const [sid, answer] of Object.entries(answers)){
    const pname = players[sid] ? players[sid].name : 'Unknown';
    out.push({fromId: sid, fromName: pname, answer});
  }
  return out;
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('listening on', PORT));
