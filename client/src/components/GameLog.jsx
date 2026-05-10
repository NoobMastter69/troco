import { useEffect, useRef } from 'react'

const SUIT_SYMBOL = { clubs: '♣', hearts: '♥', spades: '♠', diamonds: '♦' }

export default function GameLog({ log }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [log])

  return (
    <div ref={ref} className="h-28 overflow-y-auto text-[11px] text-white/50 space-y-0.5 pr-1">
      {log.map((entry, i) => (
        <div key={i} className="leading-relaxed">{entry}</div>
      ))}
    </div>
  )
}

export function cardLabel(card) {
  if (!card) return '?'
  if (card.special === 'zap2')          return 'Zap 2 (8♣)'
  if (card.special === 'coringa1')      return 'Coringa 1'
  if (card.special === 'coringa2')      return 'Coringa 2'
  if (card.special === 'espada_espada') return 'Espada Espada'
  return `${card.value}${SUIT_SYMBOL[card.suit] ?? ''}`
}
