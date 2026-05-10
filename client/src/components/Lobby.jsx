import { useState } from 'react'
import socket from '../socket.js'

export default function Lobby({ onGameStart, onRoomReady }) {
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [mode, setMode] = useState('truco')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('home') // home | waiting

  function connect(cb) {
    if (!name.trim()) return setError('Digite seu nome')
    setError('')
    setLoading(true)
    socket.connect()
    socket.once('connect', cb)
    socket.once('connect_error', () => {
      setError('Erro ao conectar ao servidor')
      setLoading(false)
    })
  }

  function createRoom() {
    connect(() => {
      socket.emit('create_room', { name: name.trim(), mode }, res => {
        setLoading(false)
        if (res.error) return setError(res.error)
        onRoomReady(res.room, name.trim())
        setStep('waiting')
      })
    })
  }

  function joinRoom() {
    if (!roomId.trim()) return setError('Digite o código da sala')
    connect(() => {
      socket.emit('join_room', { name: name.trim(), roomId: roomId.trim().toUpperCase() }, res => {
        setLoading(false)
        if (res.error) return setError(res.error)
        onRoomReady(res.room, name.trim())
        setStep('waiting')
      })
    })
  }

  if (step === 'waiting') return null // parent handles waiting state

  return (
    <div className="min-h-screen felt overflow-y-auto flex items-start sm:items-center justify-center p-4 py-8">
      <div className="bg-gray-900/90 backdrop-blur border border-white/10 rounded-2xl p-5 sm:p-8 w-full max-w-md shadow-2xl overflow-hidden">
        <h1 className="text-4xl font-display font-bold text-white text-center mb-1">Troço</h1>
        <p className="text-white/40 text-center text-sm mb-8">Truco do caos</p>

        <div className="space-y-4">
          <div>
            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Seu nome</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createRoom()}
              placeholder="Como quer ser chamado?"
              maxLength={20}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Mode selector */}
          <div>
            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Modo</label>
            <div className="flex gap-2 mt-1">
              {['truco', 'troco'].map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    mode === m
                      ? m === 'troco'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                        : 'bg-green-700 text-white shadow-lg shadow-green-700/20'
                      : 'bg-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >
                  {m === 'truco' ? '🃏 Truco' : '🔥 Troço'}
                </button>
              ))}
            </div>
            <p className="text-white/30 text-xs mt-1 text-center">
              {mode === 'troco' ? 'Com as regras caóticas e as cartas especiais' : 'Truco Paulista clássico'}
            </p>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            onClick={createRoom}
            disabled={loading}
            className="w-full py-3 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors shadow-lg"
          >
            {loading ? 'Conectando…' : '+ Criar Sala'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs">ou</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="flex gap-2">
            <input
              value={roomId}
              onChange={e => setRoomId(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
              placeholder="Código da sala"
              maxLength={5}
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors uppercase tracking-widest text-center"
            />
            <button
              onClick={joinRoom}
              disabled={loading}
              className="shrink-0 px-5 py-3 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
