import { useState, useEffect } from 'react'
import socket from './socket.js'
import Lobby from './components/Lobby.jsx'
import WaitingRoom from './components/WaitingRoom.jsx'
import GameTable from './components/GameTable.jsx'

export default function App() {
  const [screen, setScreen] = useState('lobby')   // lobby | waiting | game
  const [room, setRoom] = useState(null)
  const [myName, setMyName] = useState('')
  const [myId, setMyId] = useState(null)
  const [gamePlayers, setGamePlayers] = useState([])
  const [mode, setMode] = useState('truco')

  useEffect(() => {
    socket.on('connect', () => setMyId(socket.id))

    socket.on('room_updated', ({ room: r }) => {
      setRoom(r)
      setMode(r.mode)
    })

    socket.on('game_started', ({ players }) => {
      setGamePlayers(players)
      setScreen('game')
    })

    return () => {
      socket.off('connect')
      socket.off('room_updated')
      socket.off('game_started')
    }
  }, [])

  function handleRoomReady(r, name) {
    setRoom(r)
    setMyName(name)
    setMode(r.mode)
    setScreen('waiting')
    if (socket.connected) setMyId(socket.id)
  }

  function handleLeave() {
    socket.disconnect()
    setScreen('lobby')
    setRoom(null)
    setMyId(null)
    setGamePlayers([])
  }

  if (screen === 'lobby') {
    return <Lobby onRoomReady={handleRoomReady} />
  }

  if (screen === 'waiting') {
    return <WaitingRoom room={room} myName={myName} onLeave={handleLeave} />
  }

  return (
    <GameTable
      initialPlayers={gamePlayers}
      myId={myId ?? socket.id}
      mode={mode}
      onLeave={handleLeave}
    />
  )
}
