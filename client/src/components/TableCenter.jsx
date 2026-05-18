import Card from './Card.jsx'

const EFFECT_LABEL = {
  truco_mineiro: '⚡ TM',
  dark: '🌑 Escuro',
  no_variable_manilhas: '⚔️ Sem manilhas var.',
  manilha_3: '→ Manilha: 3',
  manilha_4: '→ Manilha: 4',
  tuesday_reversed: '📅 Terça',
}

export default function TableCenter({ vira, manilhaValue, tombadoEffect, table, history, subHandResults, players, roundValue }) {
  const currentSubHand = subHandResults.length

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Sub-hand result indicators */}
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <SubHandDot key={i} result={subHandResults[i]} active={i === currentSubHand} />
        ))}
      </div>

      {/* Round value badge */}
      {roundValue > 1 && (
        <div className="text-yellow-400 text-xs font-bold bg-yellow-400/10 border border-yellow-400/30 px-3 py-1 rounded-full">
          Vale {roundValue} {roundValue === 1 ? 'ponto' : 'pontos'}
        </div>
      )}

      {/* Cards on table this sub-hand */}
      <div className="flex gap-3 flex-wrap justify-center min-h-[60px] items-center">
        {table.map(play => {
          const player = players.find(p => p.id === play.playerId)
          const isDown = !!play.card?.faceDown
          return (
            <div key={play.playerId} className="flex flex-col items-center gap-1">
              <Card card={isDown ? null : play.card} isBack={isDown} small />
              <div className="text-[9px] text-white/40">{player?.name}{isDown ? ' 🔲' : ''}</div>
            </div>
          )
        })}
      </div>

      {/* Vira */}
      <div className="flex flex-col items-center gap-1">
        <div className="text-[10px] text-white/30">Vira</div>
        {vira && <Card card={vira} small />}

        {tombadoEffect && EFFECT_LABEL[tombadoEffect] ? (
          <div className="text-[10px] text-orange-300/80 font-bold">
            {EFFECT_LABEL[tombadoEffect]}
          </div>
        ) : manilhaValue ? (
          <div className="text-[10px] text-yellow-300/70">
            Manilha: <span className="font-bold">{manilhaValue}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SubHandDot({ result, active }) {
  const color = result === 0
    ? 'bg-blue-400'
    : result === 1
    ? 'bg-red-400'
    : result === null
    ? 'bg-gray-400'
    : active
    ? 'bg-white/40 border border-white/40'
    : 'bg-white/10'

  return <div className={`w-3 h-3 rounded-full transition-all duration-300 ${color}`} />
}
