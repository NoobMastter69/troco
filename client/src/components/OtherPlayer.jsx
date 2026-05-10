import Card from './Card.jsx'

export default function OtherPlayer({ player, handCount = 0, isCurrentTurn, position }) {
  const cards = Array.from({ length: handCount })

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`flex flex-col items-center gap-0.5 ${isCurrentTurn ? 'text-yellow-300' : 'text-white/70'}`}>
        <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          isCurrentTurn ? 'bg-yellow-400/20 text-yellow-300 animate-pulse' : 'bg-black/20'
        }`}>
          {player.name} {player.isBot ? '🤖' : ''}
        </div>
        <div className={`text-[10px] px-1.5 py-0.5 rounded ${player.team === 0 ? 'bg-blue-500/30 text-blue-300' : 'bg-red-500/30 text-red-300'}`}>
          Time {player.team + 1}
        </div>
      </div>

      <div className="flex gap-1 flex-row">
        {cards.map((_, i) => (
          <Card key={i} isBack small />
        ))}
        {handCount === 0 && (
          <div className="w-9 h-14 rounded-lg border border-white/10 opacity-20" />
        )}
      </div>
    </div>
  )
}
