import Card from './Card.jsx'

export default function PlayerHand({ hand, isMyTurn, onPlay, isDark = false, isHidden = false }) {
  const showBack = isDark || isHidden
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
            isBack={showBack}
            isHighlighted={isMyTurn && !showBack}
            onClick={isMyTurn ? () => onPlay(card.id) : undefined}
          />
        </div>
      ))}
    </div>
  )
}
