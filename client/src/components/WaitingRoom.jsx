import socket from '../socket.js'

const SEAT_LABELS = ['Baixo', 'Esq', 'Cima', 'Dir']
const SEAT_TEAMS  = [0, 1, 0, 1]

export default function WaitingRoom({ room, myName, onGameStarted, onLeave }) {
  const isHost = room.players.find(p => p.name === myName && !p.isBot)?.id === room.host ||
    room.players[0]?.name === myName

  function addBot() {
    socket.emit('add_bot')
  }

  function startGame() {
    socket.emit('start_game', {}, res => {
      if (res?.error) alert(res.error)
    })
  }

  const filled = room.players.length
  const canStart = filled === 4

  return (
    <div className="min-h-screen felt overflow-y-auto flex items-start sm:items-center justify-center p-4 py-8">
      <div className="bg-gray-900/90 backdrop-blur border border-white/10 rounded-2xl p-5 sm:p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-display font-bold text-white text-center mb-1">Sala</h2>

        <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
          <span className="text-white/40 text-sm">Código:</span>
          <span className="text-white font-mono font-bold text-xl tracking-widest bg-white/5 px-3 py-1 rounded-lg break-all">
            {room.id}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(room.id)}
            className="text-white/30 hover:text-white/60 text-xs transition-colors flex-none"
            title="Copiar código"
          >
            📋
          </button>
        </div>

        <div className="space-y-2 mb-6">
          {[0, 1, 2, 3].map(seat => {
            const player = room.players.find(p => p.seat === seat)
            const team = SEAT_TEAMS[seat]
            return (
              <div key={seat} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                player
                  ? team === 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'
                  : 'bg-white/5 border-white/5'
              }`}>
                <div className={`text-xs font-semibold px-2 py-0.5 rounded ${team === 0 ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'}`}>
                  T{team + 1}
                </div>
                <div className="flex-1">
                  {player ? (
                    <span className="text-white font-medium">
                      {player.name} {player.isBot ? '🤖' : ''} {player.name === myName ? '(você)' : ''}
                    </span>
                  ) : (
                    <span className="text-white/20">Vazio</span>
                  )}
                </div>
                <div className="text-white/20 text-xs">{SEAT_LABELS[seat]}</div>
              </div>
            )
          })}
        </div>

        <div className="space-y-3">
          {filled < 4 && (
            <button
              onClick={addBot}
              className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white/70 font-semibold rounded-xl transition-colors text-sm"
            >
              + Adicionar Bot 🤖
            </button>
          )}
          <button
            onClick={startGame}
            disabled={!canStart}
            className="w-full py-3 bg-green-700 hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
          >
            {canStart ? '▶ Começar Jogo' : `Esperando jogadores (${filled}/4)`}
          </button>
          <button
            onClick={onLeave}
            className="w-full py-2 text-white/30 hover:text-white/60 text-sm transition-colors"
          >
            Sair
          </button>
        </div>

        <div className="mt-4 text-center text-white/30 text-xs">
          Modo: <span className="text-white/50 font-semibold">{room.mode === 'troco' ? '🔥 Troço' : '🃏 Truco'}</span>
        </div>
      </div>
    </div>
  )
}
