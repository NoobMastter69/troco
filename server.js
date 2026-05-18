const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')
const { GameEngine } = require('./game/engine')
const { chooseBotCard, decideTrucoResponse, shouldCallTruco } = require('./game/bot')

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

// Serve built client in production
app.use(express.static(path.join(__dirname, 'client', 'dist')))
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html')))

// ─── Room Management ────────────────────────────────────────────────────────

const rooms = new Map()    // roomId -> RoomState
const socketToRoom = new Map() // socketId -> roomId

function generateRoomId() {
  return Math.random().toString(36).slice(2, 7).toUpperCase()
}

function createRoom(hostSocket, playerName, mode) {
  const roomId = generateRoomId()
  const room = {
    id: roomId,
    mode,
    host: hostSocket.id,
    players: [{
      id: hostSocket.id,
      name: playerName,
      team: 0,
      seat: 0,
      isBot: false,
      connected: true,
    }],
    engine: null,
    status: 'lobby', // lobby | playing | ended
  }
  rooms.set(roomId, room)
  socketToRoom.set(hostSocket.id, roomId)
  hostSocket.join(roomId)
  return room
}

function getSeatTeam(seat) {
  // seats 0 & 2 = team 0, seats 1 & 3 = team 1
  return seat % 2
}

function addBotToRoom(room) {
  const takenSeats = room.players.map(p => p.seat)
  const freeSeat = [0, 1, 2, 3].find(s => !takenSeats.includes(s))
  if (freeSeat === undefined) return null

  const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
  const bot = {
    id: botId,
    name: `Bot ${freeSeat + 1}`,
    team: getSeatTeam(freeSeat),
    seat: freeSeat,
    isBot: true,
    connected: true,
  }
  room.players.push(bot)
  return bot
}

function getRoomPublic(room) {
  return {
    id: room.id,
    mode: room.mode,
    status: room.status,
    players: room.players.map(({ id, name, team, seat, isBot, connected }) =>
      ({ id, name, team, seat, isBot, connected })
    ),
  }
}

// ─── Game Lifecycle ─────────────────────────────────────────────────────────

function startGame(room) {
  const sorted = [...room.players].sort((a, b) => a.seat - b.seat)
  room.engine = new GameEngine(sorted, room.mode)
  room.status = 'playing'
  io.to(room.id).emit('game_started', { players: sorted.map(({ id, name, team, seat, isBot }) => ({ id, name, team, seat, isBot })) })
  beginRound(room)
}

function beginRound(room) {
  const { engine } = room
  const result = engine.startRound()

  broadcastGameState(room, result)

  // Broadcast any trinca/tombado events that happened at deal time
  if (result.extraEvents?.length > 0) {
    for (const evt of result.extraEvents) {
      io.to(room.id).emit('troco_event', evt)
    }
  }

  if (result.tombadoEffect) {
    io.to(room.id).emit('tombado_effect', {
      effect: result.tombadoEffect,
      vira: result.vira,
    })
  }

  // Rule XVIII: blackjack round — auto-resolve after showing hands
  if (result.blackjackRound) {
    io.to(room.id).emit('troco_event', {
      type: 'blackjack_round',
      message: '🃏 Sequência Real! A rodada vira Blackjack — soma das cartas de cada time!',
      scores: result.scores,
    })
    setTimeout(() => {
      if (!rooms.has(room.id)) return
      const bjResult = engine.resolveBlackjack()
      if (!bjResult.ok) return
      broadcastGameState(room, bjResult)
      if (bjResult.type === 'round_end') handleRoundEnd(room, bjResult)
    }, 4000)
    return
  }

  scheduleBotTurn(room)
}

function broadcastGameState(room, event = null) {
  const { engine } = room
  for (const player of room.players) {
    if (player.isBot) continue
    const socket = io.sockets.sockets.get(player.id)
    if (!socket) continue
    const state = engine.getStateFor(player.id)
    socket.emit('game_state', { state, event })
  }
}

function scheduleBotTurn(room, delay = 3000) {
  const { engine } = room
  if (!engine || engine.isGameOver()) return

  const currentId = engine.currentPlayerId()
  if (!currentId) return

  const player = room.players.find(p => p.id === currentId)
  if (!player?.isBot) return

  setTimeout(() => {
    if (!rooms.has(room.id)) return
    executeBotTurn(room, player)
  }, delay)
}

function executeBotTurn(room, botPlayer) {
  const { engine } = room
  if (engine.getPhase() !== 'playing') return
  if (engine.currentPlayerId() !== botPlayer.id) return

  const state = engine.getStateFor(botPlayer.id)

  // Occasionally call truco before playing
  if (shouldCallTruco(state.hand, state.manilhaValue) && Math.random() < 0.25 && !state.pendingTruco) {
    const result = engine.callTruco(botPlayer.id)
    if (result.ok) {
      broadcastGameState(room, result)
      // Trigger opposing team response
      scheduleOpposingBotTrucoResponse(room, result.calledByTeam)
      return
    }
  }

  const card = chooseBotCard(state.hand, state.table, state.manilhaValue, botPlayer.team)
  if (!card) return

  const result = engine.playCard(botPlayer.id, card.id)
  if (!result.ok) return

  broadcastGameState(room, result)

  if (result.type === 'round_end') {
    handleRoundEnd(room, result)
  } else {
    scheduleBotTurn(room)
  }
}

function scheduleOpposingBotTrucoResponse(room, callerTeam) {
  const { engine } = room
  const opposingPlayers = room.players.filter(p => p.team !== callerTeam)

  // Se há humano no time adversário, ele quem responde — bot parceiro não interfere
  if (opposingPlayers.some(p => !p.isBot && p.connected)) return

  const opposingBots = opposingPlayers.filter(p => p.isBot)
  if (opposingBots.length === 0) return

  setTimeout(() => {
    if (!rooms.has(room.id)) return
    if (engine.getPhase() !== 'truco_call') return

    const responder = opposingBots[0]
    const state = engine.getStateFor(responder.id)
    const response = decideTrucoResponse(state.hand, state.manilhaValue)

    const result = engine.respondTruco(responder.id, response)
    if (!result.ok) return

    broadcastGameState(room, result)

    if (result.type === 'round_end') {
      handleRoundEnd(room, result)
    } else if (result.type === 'truco_raised') {
      // Now the original caller's team needs to respond
      scheduleOpposingBotTrucoResponse(room, responder.team)
    } else {
      scheduleBotTurn(room)
    }
  }, 2500)
}

function handleRoundEnd(room, event) {
  if (event.gameWinner !== null) {
    room.status = 'ended'
    io.to(room.id).emit('game_over', { winner: event.gameWinner, scores: event.scores })
    return
  }
  setTimeout(() => {
    if (!rooms.has(room.id)) return
    beginRound(room)
  }, 2500)
}

// ─── Socket Events ──────────────────────────────────────────────────────────

io.on('connection', socket => {
  console.log('connect', socket.id)

  socket.on('create_room', ({ name, mode = 'truco' }, cb) => {
    if (socketToRoom.has(socket.id)) return cb({ error: 'Already in a room' })
    const room = createRoom(socket, name, mode)
    cb({ ok: true, roomId: room.id, room: getRoomPublic(room) })
    console.log(`Room ${room.id} created by ${name}`)
  })

  socket.on('join_room', ({ name, roomId }, cb) => {
    const room = rooms.get(roomId?.toUpperCase())
    if (!room) return cb({ error: 'Room not found' })
    if (room.status !== 'lobby') return cb({ error: 'Game already started' })
    if (room.players.length >= 4) return cb({ error: 'Room is full' })

    const takenSeats = room.players.map(p => p.seat)
    const seat = [0, 1, 2, 3].find(s => !takenSeats.includes(s))
    room.players.push({
      id: socket.id, name, team: getSeatTeam(seat), seat,
      isBot: false, connected: true,
    })
    socketToRoom.set(socket.id, roomId.toUpperCase())
    socket.join(roomId.toUpperCase())

    io.to(room.id).emit('room_updated', { room: getRoomPublic(room) })
    cb({ ok: true, room: getRoomPublic(room) })
  })

  socket.on('add_bot', (_, cb) => {
    const roomId = socketToRoom.get(socket.id)
    const room = rooms.get(roomId)
    if (!room) return cb?.({ error: 'Not in a room' })
    if (room.host !== socket.id) return cb?.({ error: 'Only host can add bots' })
    if (room.players.length >= 4) return cb?.({ error: 'Room is full' })

    const bot = addBotToRoom(room)
    if (!bot) return cb?.({ error: 'No seat available' })

    io.to(room.id).emit('room_updated', { room: getRoomPublic(room) })
    cb?.({ ok: true })
  })

  socket.on('start_game', (_, cb) => {
    const roomId = socketToRoom.get(socket.id)
    const room = rooms.get(roomId)
    if (!room) return cb?.({ error: 'Not in a room' })
    if (room.host !== socket.id) return cb?.({ error: 'Only host can start' })
    if (room.players.length !== 4) return cb?.({ error: 'Need exactly 4 players' })
    if (room.status !== 'lobby') return cb?.({ error: 'Game already started' })

    startGame(room)
    cb?.({ ok: true })
  })

  socket.on('play_card', ({ cardId }, cb) => {
    const roomId = socketToRoom.get(socket.id)
    const room = rooms.get(roomId)
    if (!room?.engine) return cb?.({ error: 'No active game' })

    const result = room.engine.playCard(socket.id, cardId)
    if (!result.ok) return cb?.({ error: result.message })

    broadcastGameState(room, result)

    if (result.type === 'round_end') {
      handleRoundEnd(room, result)
    } else {
      scheduleBotTurn(room)
    }
    cb?.({ ok: true })
  })

  socket.on('call_truco', (_, cb) => {
    const roomId = socketToRoom.get(socket.id)
    const room = rooms.get(roomId)
    if (!room?.engine) return cb?.({ error: 'No active game' })

    const result = room.engine.callTruco(socket.id)
    if (!result.ok) return cb?.({ error: result.message })

    broadcastGameState(room, result)
    scheduleOpposingBotTrucoResponse(room, result.calledByTeam)
    cb?.({ ok: true })
  })

  socket.on('respond_truco', ({ response }, cb) => {
    const roomId = socketToRoom.get(socket.id)
    const room = rooms.get(roomId)
    if (!room?.engine) return cb?.({ error: 'No active game' })

    const result = room.engine.respondTruco(socket.id, response)
    if (!result.ok) return cb?.({ error: result.message })

    broadcastGameState(room, result)

    if (result.type === 'round_end') {
      handleRoundEnd(room, result)
    } else if (result.type === 'truco_raised') {
      scheduleOpposingBotTrucoResponse(room, result.calledByTeam)
    } else {
      scheduleBotTurn(room)
    }
    cb?.({ ok: true })
  })

  // ── Rule XIX: Invictus ──────────────────────────────────────────────────

  socket.on('signal_partner', (_, cb) => {
    const roomId = socketToRoom.get(socket.id)
    const room = rooms.get(roomId)
    if (!room?.engine) return cb?.({ error: 'No active game' })

    const result = room.engine.signalPartner(socket.id)
    if (!result.ok) return cb?.({ error: result.message })

    // Send signal ONLY to the partner (private)
    const partnerSocket = io.sockets.sockets.get(result.partnerId)
    if (partnerSocket) {
      partnerSocket.emit('partner_signal_received', { from: socket.id })
    }
    cb?.({ ok: true })
  })

  socket.on('signal_partner_seq', (_, cb) => {
    const roomId = socketToRoom.get(socket.id)
    const room = rooms.get(roomId)
    if (!room?.engine) return cb?.({ error: 'No active game' })

    const result = room.engine.signalPartnerSeq(socket.id)
    if (!result.ok) return cb?.({ error: result.message })

    // Send signal ONLY to the partner (private)
    const partnerSocket = io.sockets.sockets.get(result.partnerId)
    if (partnerSocket) {
      partnerSocket.emit('seq_signal_received', { from: socket.id })
    }
    cb?.({ ok: true })
  })

  socket.on('swap_tombado', (_, cb) => {
    const roomId = socketToRoom.get(socket.id)
    const room = rooms.get(roomId)
    if (!room?.engine) return cb?.({ error: 'No active game' })

    const result = room.engine.swapTombado(socket.id)
    if (!result.ok) return cb?.({ error: result.message })

    io.to(room.id).emit('troco_event', {
      type: result.curtinho ? 'curtinho' : 'tombado_swapped',
      message: result.message,
      scores: result.scores,
      curtinhoWinner: result.curtinhoWinner,
    })
    broadcastGameState(room, result)
    cb?.({ ok: true })
  })

  socket.on('run_mao23', (_, cb) => {
    const roomId = socketToRoom.get(socket.id)
    const room = rooms.get(roomId)
    if (!room?.engine) return cb?.({ error: 'No active game' })

    const result = room.engine.runMao23(socket.id)
    if (!result.ok) return cb?.({ error: result.message })

    broadcastGameState(room, result)
    if (result.type === 'round_end') handleRoundEnd(room, result)
    cb?.({ ok: true })
  })

  socket.on('call_invictus', (_, cb) => {
    const roomId = socketToRoom.get(socket.id)
    const room = rooms.get(roomId)
    if (!room?.engine) return cb?.({ error: 'No active game' })

    const result = room.engine.callInvictus(socket.id)
    if (!result.ok) return cb?.({ error: result.message })

    // Broadcast to all: the result with message
    io.to(room.id).emit('invictus_resolved', {
      calledBy: socket.id,
      reason: result.reason,
      message: result.message,
      winnerTeam: result.winnerTeam,
      scores: result.scores,
    })

    broadcastGameState(room, result)

    if (result.type === 'round_end') {
      handleRoundEnd(room, result)
    }
    cb?.({ ok: true })
  })

  socket.on('change_mode', ({ mode }, cb) => {
    const roomId = socketToRoom.get(socket.id)
    const room = rooms.get(roomId)
    if (!room) return cb?.({ error: 'Not in a room' })
    if (room.host !== socket.id) return cb?.({ error: 'Only host can change mode' })
    if (room.status !== 'lobby') return cb?.({ error: 'Game already started' })

    room.mode = mode
    io.to(room.id).emit('room_updated', { room: getRoomPublic(room) })
    cb?.({ ok: true })
  })

  socket.on('disconnect', () => {
    const roomId = socketToRoom.get(socket.id)
    if (!roomId) return

    const room = rooms.get(roomId)
    if (!room) return

    const player = room.players.find(p => p.id === socket.id)
    if (player) player.connected = false

    socketToRoom.delete(socket.id)

    if (room.status === 'lobby') {
      room.players = room.players.filter(p => p.id !== socket.id)
      io.to(roomId).emit('room_updated', { room: getRoomPublic(room) })
    } else {
      io.to(roomId).emit('player_disconnected', { playerId: socket.id, name: player?.name })
    }

    console.log(`${player?.name ?? socket.id} disconnected from room ${roomId}`)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => console.log(`Troço server running on :${PORT}`))
