// server.js
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
  const answersCount = r.roundData && r.roundData.answers ? Object.keys(r.roundData.answers).length : 0;
  const votesCount = r.roundData && r.roundData.votes ? Object.keys(r.roundData.votes).length : 0;
  const totalPlayers = r.players ? Object.keys(r.players).length : 0;
  return {
    code,
    host: r.host,
    players: Object.entries(r.players || {}).map(([id,p]) => ({ id, name: p.name, score: p.score })),
    round: r.round,
    state: r.state,
    roundData: r.roundData ? { id: r.roundData.id } : null,
    counts: { answers: answersCount, votes: votesCount, totalPlayers }
  };
}

io.on('connection', socket => {
  console.log('socket connected', socket.id);

  // create room
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
    rooms[code].players[socket.id] = { name: name || 'Player', score: { group:0, impostor:0 } };
    rooms[code].order.push(socket.id);
    socket.roomCode = code;
    cb && cb({ ok:true, code, room: getRoomPublic(code) });
    io.to(code).emit('roomUpdate', getRoomPublic(code));
  });

  // join room (checks duplicate names)
  socket.on('joinRoom', ({code, name}, cb) => {
    if(!rooms[code]) return cb && cb({ ok:false, error:'Room not found' });
    // duplicate name check (case-insensitive)
    const existingNames = Object.values(rooms[code].players || {}).map(p => p.name.toLowerCase());
    if(existingNames.includes((name||'').toLowerCase())){
      return cb && cb({ ok:false, error:'Name already taken in this room. Choose another.' });
    }
    socket.join(code);
    rooms[code].players[socket.id] = { name: name || 'Player', score: { group:0, impostor:0 } };
    rooms[code].order.push(socket.id);
    socket.roomCode = code;
    cb && cb({ ok:true, room: getRoomPublic(code) });
    io.to(code).emit('roomUpdate', getRoomPublic(code));
  });

  socket.on('leaveRoom', () => {
    leave(socket);
  });

  socket.on('startRound', ({questionPair}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code]) return cb && cb({ ok:false, error:'Room not found' });
    const room = rooms[code];
    if(room.host !== socket.id) return cb && cb({ ok:false, error:'not host' });
    if(room.state !== 'lobby') return cb && cb({ ok:false, error:'Round already in progress' });

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

    // send role-specific question to each player
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
    // ignore if already answered
    if(room.roundData.answers[socket.id]) return cb && cb({ ok:false, error:'Already submitted' });

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
    // ignore if already voted
    if(room.roundData.votes[socket.id]) return cb && cb({ ok:false, error:'Already voted' });

    room.roundData.votes[socket.id] = targetSocketId;
    room.state = 'voting';
    io.to(code).emit('roomUpdate', getRoomPublic(code));

    // if all players voted -> tally and emit result (host ends round afterwards)
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
      // DO NOT clear room.roundData - host must call endRound
    }

    cb && cb({ ok:true });
  });

  // host ends round (Next round) - only allowed after votingResult
  socket.on('endRound', (cb) => {
    const code = socket.roomCode;
    if(!rooms[code]) return cb && cb({ ok:false, error:'Room not found' });
    const room = rooms[code];
    if(room.host !== socket.id) return cb && cb({ ok:false, error:'not host' });
    if(room.state !== 'votingResult') return cb && cb({ ok:false, error:'Cannot end round yet; voting not complete' });

    room.roundData = null;
    room.state = 'lobby';
    io.to(code).emit('roundEnded');
    io.to(code).emit('roomUpdate', getRoomPublic(code));
    cb && cb({ ok:true });
  });

  // host kicks a player
  socket.on('kickPlayer', ({ targetId }, cb) => {
    const code = socket.roomCode;
    if(!rooms[code]) return cb && cb({ ok:false, error:'Room not found' });
    const room = rooms[code];
    if(room.host !== socket.id) return cb && cb({ ok:false, error:'not host' });
    if(!room.players[targetId]) return cb && cb({ ok:false, error:'Player not found' });

    // notify the target, then remove them
    const targetSocket = io.sockets.sockets.get(targetId);
    try {
      if(targetSocket){
        targetSocket.emit('kicked', { message: 'You were removed from the room by the host.' });
        setTimeout(() => {
          try { targetSocket.disconnect(true); } catch(e){ /* ignore */ }
        }, 250);
      }
    } catch(e){ /* ignore */ }

    // remove player from room data
    delete room.players[targetId];
    room.order = room.order.filter(id => id !== targetId);

    // If a round was active, end it to keep state consistent
    if(room.state !== 'lobby'){
      room.roundData = null;
      room.state = 'lobby';
      io.to(code).emit('roundEnded');
      io.to(code).emit('showError', 'Round ended because a player was removed.');
    }

    io.to(code).emit('roomUpdate', getRoomPublic(code));
    cb && cb({ ok:true });
  });

  // rename (check duplicates)
  socket.on('rename', ({name}, cb) => {
    const code = socket.roomCode;
    if(!rooms[code] || !rooms[code].players[socket.id]) return cb && cb({ ok:false, error:'Room or player not found' });
    const existingNames = Object.entries(rooms[code].players || {}).filter(([id]) => id !== socket.id).map(([id, p]) => p.name.toLowerCase());
    if(existingNames.includes((name||'').toLowerCase())){
      return cb && cb({ ok:false, error:'Name already taken in this room.' });
    }
    rooms[code].players[socket.id].name = name;
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

    // If a round is active, remove this player's answers & votes then check if remaining players have completed actions.
    if(room.roundData){
      delete room.roundData.answers[socket.id];
      delete room.roundData.votes[socket.id];

      const totalPlayers = Object.keys(room.players).length;
      const submitted = Object.keys(room.roundData.answers || {}).length;
      const votes = Object.keys(room.roundData.votes || {}).length;

      // if no players left, delete room
      if(totalPlayers === 0){
        delete rooms[code];
        return;
      }

      // If all remaining players have submitted => reveal
      if(submitted >= totalPlayers && room.state === 'inRound'){
        room.state = 'showing';
        io.to(code).emit('revealRound', {
          majorityQuestion: room.roundData.majorityQuestion,
          answers: mapAnswersToNames(room.roundData.answers, room.players)
        });
      }

      // If all remaining players have voted => tally
      if(votes >= totalPlayers && (room.state === 'voting' || room.state === 'showing')){
        const tally = {};
        for(const v of Object.values(room.roundData.votes || {})){
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
      }
    }

    io.to(code).emit('roomUpdate', getRoomPublic(code));
    if(Object.keys(room.players).length === 0) delete rooms[code];
  }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('listening on', PORT));
