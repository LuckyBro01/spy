const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'spy.html'));
});

const lobbies = new Map();

io.on('connection', (socket) => {
    console.log('👤 Подключен:', socket.id);

    socket.on('createLobby', (data) => {
        const roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
        
        const lobby = {
            id: roomId,
            category: data.category,
            word: data.word,
            maxPlayers: data.maxPlayers,
            maxSpies: data.maxSpies,
            currentPlayers: 1,
            players: [socket.id],
            host: socket.id,
            gameStarted: false
        };
        
        lobbies.set(roomId, lobby);
        socket.join(roomId);
        
        console.log(`🆕 Лобби ${roomId} создано`);
        socket.emit('lobbyCreated', { roomId, lobby });
    });

    socket.on('joinLobby', (data) => {
        const roomId = data.code.toUpperCase();
        const lobby = lobbies.get(roomId);
        
        if (!lobby) {
            socket.emit('lobbyNotFound', { code: roomId });
            return;
        }
        
        if (lobby.currentPlayers >= lobby.maxPlayers) {
            socket.emit('lobbyFull', { code: roomId });
            return;
        }
        
        if (lobby.gameStarted) {
            socket.emit('error', { message: 'Игра уже началась!' });
            return;
        }

        socket.join(roomId);
        lobby.players.push(socket.id);
        lobby.currentPlayers++;
        
        io.to(roomId).emit('playerUpdate', {
            players: lobby.currentPlayers,
            maxPlayers: lobby.maxPlayers
        });
        
        socket.emit('joinedLobby', { roomId, lobby });
        console.log(`✅ ${socket.id} в ${roomId}`);
    });

    socket.on('startGame', (roomId) => {
        const lobby = lobbies.get(roomId);
        if (!lobby || socket.id !== lobby.host) return;

        lobby.gameStarted = true;
        
        const spiesCount = Math.min(lobby.maxSpies, lobby.currentPlayers);
        const spyIndexes = [];
        while (spyIndexes.length < spiesCount) {
            const r = Math.floor(Math.random() * lobby.currentPlayers);
            if (!spyIndexes.includes(r)) spyIndexes.push(r);
        }

        lobby.players.forEach((playerId, index) => {
            const isSpy = spyIndexes.includes(index);
            io.to(playerId).emit('yourRole', {
                isSpy,
                word: isSpy ? null : lobby.word,
                category: lobby.category
            });
        });

        io.to(roomId).emit('gameStarted', { category: lobby.category });
        console.log(`🎮 Игра началась в ${roomId}`);
    });

    socket.on('disconnect', () => {
        for (let [roomId, lobby] of lobbies) {
            const index = lobby.players.indexOf(socket.id);
            if (index > -1) {
                lobby.players.splice(index, 1);
                lobby.currentPlayers--;
                io.to(roomId).emit('playerUpdate', {
                    players: lobby.currentPlayers,
                    maxPlayers: lobby.maxPlayers
                });
                break;
            }
        }
    });
});

server.listen(3001, () => {
    console.log('🚀 Spy Pro: http://localhost:3001');
});
