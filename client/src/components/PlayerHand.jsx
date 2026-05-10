import Card from './Card.jsx'

export default function PlayerHand({ hand, isMyTurn, onPlay, isDark = false }) {
  return (
    <div className="flex items-end justify-center gap-2 px-4">
      {hand.map((card, i) => (
        <div
          key={card.id}
          className="card-deal"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Card
            card={card}
            isBack={isDark}
            isHighlighted={isMyTurn && !isDark}
            onClick={isMyTurn ? () => onPlay(card.id) : undefined}
          />
        </div>
      ))}
    </div>
  )
}
