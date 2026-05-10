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
  return `${card.value}${SUIT_SYMBOL[card.suit]}`
}
