const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const crypto = require('crypto');
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {}; // in-memory rooms

function makeCode(len = 4){
  return crypto.randomBytes(len).toString('base64').replace(/[+/=]/g,'').substr(0,len).toUpperCase();
}
function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function mapAnswersToNames(answers, players){
  const out = [];
  for(const [sid, answer] of Object.entries(answers || {})){
    const pname = players[sid] ? players[sid].name : 'Unknown';
    out.push({ fromId: sid, fromName: pname, answer });
  }
  return out;
}

function getRoomPublic(code){
  const r = rooms[code];
  if(!r) return null;
  return {
    code,
    host: r.host,
    players: Object.entries(r.players || {}).map(([id,p]) => ({ id, name: p.name, score: p.score })),
    round: r.round,
    state: r.state,
    roundData: r.roundData ? { id: r.roundData.id } : null
  };
}

io.on('connection', socket => {
  console.log('socket connected', socket.id);

  socket.on('createRoom', ({name}, cb) => {
    const code = makeCode(4);
    rooms[code] = {
      host: socket.id,
      players: {},
      order: [],
      round: 0,
      state: 'lobby', // lobby, inRound, showing, voting, votingResult
      roundData: null
    };
    socket.join(code);
    const nm = (name || 'Player').trim() || 'Player';
    rooms[code].players[socket.id] = { name: nm, score: { group:0, impostor:0 } };
    rooms[code].order.push(socket.id);
    socket.roomCode = code;
    cb && cb({ ok:true, code, room: getRoomPublic(code) });
    io.to(code).emit('roomUpdate', getRoomPublic(code));
  });

  socket.on('joinRoom', ({code, name}, cb) => {
    if(!rooms[code]) return cb && cb({ ok:false, error:'Room not found' });
    const nmRaw = (name || 'Player').trim() || 'Player';
    const exists = Object.values(rooms[code].players).some(p => p.name.toLowerCase() === nmRaw.toLowerCase());
    if(exists) return cb && cb({ ok:false, error:'Name already taken in this room. Choose another.' });

    socket.join(code);
    rooms[code].players[socket.id] = { name: nmRaw, score: { group:0, impostor:0 } };
    rooms[code].order.push(socket.id);
    socket.roomCode = code;
    cb && cb({ ok:true, room: getRoomPublic(code) });
    io.to(code).emit('roomUpdate', getRoomPublic(code));
  });

  socket.on('leaveRoom', () => {
    leave(socket);
    socket.emit('leftRoom');
  });

  socket.on('startRound', ({questionPair}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code]) return cb && cb({ ok:false, error:'Room not found' });
    const room = rooms[code];
    if(room.host !== socket.id) return cb && cb({ ok:false, error:'Only the host can start a round' });
    if(room.state !== 'lobby') return cb && cb({ ok:false, error:'Cannot start: round already in progress' });

    const playerCount = Object.keys(room.players).length;
    if(playerCount < 3) return cb && cb({ ok:false, error:'Need 3+ players to start' });

    room.round++;
    room.state = 'inRound';
    room.roundData = {
      id: room.round,
      majorityQuestion: questionPair.majority,
      imposterQuestion: questionPair.imposter,
      imposter: pickRandom(Object.keys(room.players)),
      answers: {},
      votes: {}
    };

    for(const sid of Object.keys(room.players)){
      const roleQuestion = (sid === room.roundData.imposter) ? room.roundData.imposterQuestion : room.roundData.majorityQuestion;
      io.to(sid).emit('roundStarted', {
        yourQuestion: roleQuestion,
        isImposter: sid === room.roundData.imposter,
        roundId: room.round
      });
    }

    io.to(code).emit('roomUpdate', getRoomPublic(code));
    cb && cb({ ok:true });
  });

  socket.on('nextRound', ({questionPair}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code]) return cb && cb({ ok:false, error:'Room not found' });
    const room = rooms[code];
    if(room.host !== socket.id) return cb && cb({ ok:false, error:'Only host can start next round' });

    if(!['votingResult','lobby'].includes(room.state)) {
      return cb && cb({ ok:false, error:'Cannot start next round right now' });
    }

    room.round++;
    room.state = 'inRound';
    room.roundData = {
      id: room.round,
      majorityQuestion: questionPair.majority,
      imposterQuestion: questionPair.imposter,
      imposter: pickRandom(Object.keys(room.players)),
      answers: {},
      votes: {}
    };

    for(const sid of Object.keys(room.players)){
      const roleQuestion = (sid === room.roundData.imposter) ? room.roundData.imposterQuestion : room.roundData.majorityQuestion;
      io.to(sid).emit('roundStarted', {
        yourQuestion: roleQuestion,
        isImposter: sid === room.roundData.imposter,
        roundId: room.round
      });
    }

    io.to(code).emit('roomUpdate', getRoomPublic(code));
    cb && cb({ ok:true });
  });

  socket.on('submitAnswer', ({answer}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code] || !rooms[code].roundData) return cb && cb({ ok:false, error:'No active round' });
    const room = rooms[code];
    if(room.state !== 'inRound') return cb && cb({ ok:false, error:'Not accepting answers now' });

    room.roundData.answers[socket.id] = answer;
    io.to(code).emit('roomUpdate', getRoomPublic(code));

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
    cb && cb({ ok:true });
  });

  socket.on('castVote', ({targetSocketId}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code] || !rooms[code].roundData) return cb && cb({ ok:false, error:'No active round' });
    const room = rooms[code];
    if(room.state !== 'showing' && room.state !== 'voting' && room.state !== 'votingResult') {
      return cb && cb({ ok:false, error:'Cannot vote right now' });
    }
    if(!room.players[targetSocketId]) return cb && cb({ ok:false, error:'Invalid vote target' });

    room.roundData.votes[socket.id] = targetSocketId;
    room.state = 'voting';
    io.to(code).emit('roomUpdate', getRoomPublic(code));

    if(Object.keys(room.roundData.votes).length >= Object.keys(room.players).length){
      const tally = {};
      for(const v of Object.values(room.roundData.votes)){
        tally[v] = (tally[v]||0) + 1;
      }
      let maxVotes = -1;
      let chosen = null;
      for(const [k,v] of Object.entries(tally)){
        if(v > maxVotes){ maxVotes = v; chosen = k; }
      }
      const impostorId = room.roundData.imposter;
      const impostorCaught = (chosen === impostorId);

      if(impostorCaught){
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
    }

    cb && cb({ ok:true });
  });

  socket.on('endRound', (cb) => {
    const code = socket.roomCode;
    if(!rooms[code]) return cb && cb({ ok:false, error:'Room not found' });
    const room = rooms[code];
    if(room.host !== socket.id) return cb && cb({ ok:false, error:'not host' });

    room.roundData = null;
    room.state = 'lobby';
    io.to(code).emit('roundEnded');
    io.to(code).emit('roomUpdate', getRoomPublic(code));
    cb && cb({ ok:true });
  });

  socket.on('rename', ({name}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code] || !rooms[code].players[socket.id]) return cb && cb({ ok:false, error:'Not in room' });
    const nm = (name || '').trim() || 'Player';
    const exists = Object.entries(rooms[code].players).some(([sid,p]) => sid !== socket.id && p.name.toLowerCase() === nm.toLowerCase());
    if(exists) return cb && cb({ ok:false, error:'Name already taken in room' });

    rooms[code].players[socket.id].name = nm;
    io.to(code).emit('roomUpdate', getRoomPublic(code));
    cb && cb({ ok:true });
  });

  socket.on('kickPlayer', ({targetId}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code]) return cb && cb({ ok:false, error:'Room not found' });
    const room = rooms[code];
    if(room.host !== socket.id) return cb && cb({ ok:false, error:'Only host can kick' });
    if(!room.players[targetId]) return cb && cb({ ok:false, error:'Player not found' });
    if(targetId === socket.id) return cb && cb({ ok:false, error:'Cannot kick yourself' });

    delete room.players[targetId];
    room.order = room.order.filter(id => id !== targetId);

    const targetSocket = io.sockets.sockets.get(targetId);
    if(targetSocket){
      targetSocket.leave(code);
      targetSocket.roomCode = null;
      targetSocket.emit('kicked', { reason: 'Kicked by host' });
    }

    if(room.host === targetId){
      room.host = room.order[0] || null;
    }

    io.to(code).emit('roomUpdate', getRoomPublic(code));
    cb && cb({ ok:true });
  });

  socket.on('disconnect', () => {
    leave(socket);
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
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('listening on', PORT));
