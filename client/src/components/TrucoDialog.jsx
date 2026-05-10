import { useState, useEffect } from 'react'

const LEVEL_NAMES  = ['—', 'Truco', 'Seis', 'Nove', 'Doze']
const LEVEL_VALUES = [1, 3, 6, 9, 12]
const TIMER_SECS   = 10

export default function TrucoDialog({ pendingTruco, myTeam, onRespond, players }) {
  const [timeLeft, setTimeLeft] = useState(TIMER_SECS)
  const isResponder = pendingTruco?.calledByTeam !== myTeam

  // Reset e iniciar contagem quando um novo truco chegar
  useEffect(() => {
    if (!pendingTruco || !isResponder) return
    setTimeLeft(TIMER_SECS)
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [pendingTruco?.calledBy, pendingTruco?.targetLevel, isResponder])

  // Auto-aceitar quando o tempo acabar
  useEffect(() => {
    if (timeLeft === 0 && isResponder && pendingTruco) onRespond('accept')
  }, [timeLeft])

  if (!pendingTruco) return null

  const callerName = players.find(p => p.id === pendingTruco.calledBy)?.name ?? '?'
  const { targetLevel } = pendingTruco
  const canRaise = targetLevel + 1 < LEVEL_VALUES.length

  // Anel SVG
  const R    = 20
  const circ = 2 * Math.PI * R
  const fill = (timeLeft / TIMER_SECS) * circ
  const urgent = timeLeft <= 3
  const ringColor = urgent ? '#ef4444' : timeLeft <= 6 ? '#f59e0b' : '#22c55e'

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm fade-in">
      <div className="bg-gray-900 border border-yellow-500/50 rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4 slide-up">

        {/* Timer ring — só mostra para quem pode responder */}
        {isResponder && (
          <div className="flex justify-center mb-3">
            <div className="relative w-[50px] h-[50px]">
              <svg width="50" height="50">
                <circle cx="25" cy="25" r={R} fill="none" stroke="#374151" strokeWidth="3" />
                <circle
                  cx="25" cy="25" r={R} fill="none"
                  stroke={ringColor} strokeWidth="3"
                  strokeDasharray={circ}
                  strokeDashoffset={circ - fill}
                  strokeLinecap="round"
                  style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: '25px 25px',
                    transition: 'stroke-dashoffset 0.85s linear, stroke 0.3s',
                  }}
                />
              </svg>
              <div className={`absolute inset-0 flex items-center justify-center font-bold text-sm ${urgent ? 'text-red-400 animate-pulse' : 'text-white/80'}`}>
                {timeLeft}
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-4">
          <div className="text-yellow-400 font-display text-2xl font-bold">
            {LEVEL_NAMES[targetLevel]}!
          </div>
          <div className="text-white/70 text-sm mt-1">
            {callerName} pediu {LEVEL_NAMES[targetLevel]} — vale {LEVEL_VALUES[targetLevel]} ponto{LEVEL_VALUES[targetLevel] !== 1 ? 's' : ''}
          </div>
        </div>

        {isResponder ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onRespond('accept')}
              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-colors"
            >
              Aceitar ✓
            </button>
            {canRaise && (
              <button
                onClick={() => onRespond('raise')}
                className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-xl transition-colors"
              >
                Aumentar → {LEVEL_NAMES[targetLevel + 1]} ({LEVEL_VALUES[targetLevel + 1]}pts)
              </button>
            )}
            <button
              onClick={() => onRespond('run')}
              className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white/70 font-semibold rounded-xl transition-colors"
            >
              Correr (pagar {LEVEL_VALUES[targetLevel - 1] ?? 1}pt)
            </button>
          </div>
        ) : (
          <div className="text-center text-white/50 text-sm py-2">
            Aguardando resposta do adversário…
          </div>
        )}
      </div>
    </div>
  )
}
