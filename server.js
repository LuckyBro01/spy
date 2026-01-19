const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const lobbies = {};

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('👤 Подключился:', socket.id);

  socket.on('createLobby', ({ category, word, maxPlayers, maxSpies }) => {
    const code = generateCode();
    lobbies[code] = {
      host: socket.id,
      category,
      word,
      maxPlayers,
      maxSpies,
      players: []
    };

    socket.join(code);
    lobbies[code].players.push(socket.id);

    socket.emit('lobbyCreated', {
      roomId: code,
      lobby: {
        currentPlayers: 1,
        maxPlayers
      }
    });
  });

  socket.on('joinLobby', ({ code }) => {
    const lobby = lobbies[code];
    if (!lobby) {
      socket.emit('lobbyNotFound', { code });
      return;
    }

    if (lobby.players.length >= lobby.maxPlayers) return;

    socket.join(code);
    lobby.players.push(socket.id);

    io.to(code).emit('playerUpdate', {
      players: lobby.players.length,
      maxPlayers: lobby.maxPlayers
    });

    socket.emit('joinedLobby', {
      roomId: code,
      lobby: {
        currentPlayers: lobby.players.length,
        maxPlayers: lobby.maxPlayers
      }
    });
  });

  socket.on('startGame', (code) => {
    const lobby = lobbies[code];
    if (!lobby) return;

    const players = [...lobby.players];
    const spies = new Set();

    while (spies.size < lobby.maxSpies) {
      spies.add(Math.floor(Math.random() * players.length));
    }

    players.forEach((id, i) => {
      io.to(id).emit('yourRole', {
        isSpy: spies.has(i),
        category: lobby.category,
        word: lobby.word
      });
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ Отключился:', socket.id);
  });
});

server.listen(3001, () => {
  console.log('🚀 Сервер запущен на http://localhost:3001');
app.get('/healthz', (req, res) => {
  res.send('OK');
});

});
