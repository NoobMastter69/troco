const SUIT_SYMBOL = { clubs: '♣', hearts: '♥', spades: '♠', diamonds: '♦', joker: '★' }
const SUIT_COLOR  = { clubs: '#1e293b', hearts: '#dc2626', spades: '#1e293b', diamonds: '#dc2626', joker: '#7c3aed' }
const SUIT_NAME   = { clubs: 'Paus', hearts: 'Copas', spades: 'Espadas', diamonds: 'Ouros', joker: 'Especial' }

// Special card definitions
const SPECIAL_META = {
  zap2: {
    label: 'ZAP', sublabel: '2', symbol: '⚡',
    bg: 'from-slate-900 to-slate-800', border: 'border-slate-400',
    textColor: '#94a3b8', badgeColor: 'bg-yellow-500',
    badge: 'ZAP 2', title: 'Zap 2 — mata tudo exceto Coringa 1',
  },
  coringa1: {
    label: 'C1', sublabel: '★', symbol: '🃏',
    bg: 'from-purple-900 to-purple-800', border: 'border-purple-400',
    textColor: '#c4b5fd', badgeColor: 'bg-purple-500',
    badge: 'C1', title: 'Coringa 1 — mata manilhas variáveis, empata com Zap 2, perde pras normais',
  },
  coringa2: {
    label: 'C2', sublabel: '?',  symbol: '?',
    bg: 'from-orange-900 to-amber-900', border: 'border-orange-400',
    textColor: '#fed7aa', badgeColor: 'bg-orange-500',
    badge: 'C2', title: 'Coringa 2 — ao jogar, revela a próxima carta do baralho no lugar desta',
  },
  espada_espada: {
    label: 'A★', sublabel: '♠', symbol: '♠',
    bg: 'from-gray-900 to-gray-800', border: 'border-cyan-400',
    textColor: '#67e8f9', badgeColor: 'bg-cyan-600',
    badge: 'E★', title: 'Espada Espada — mesmo valor que a manilha Espada',
  },
}

export default function Card({
  card,
  isBack = false,
  isHidden = false,
  isHighlighted = false,
  isPlayed = false,
  onClick,
  small = false,
  style = {},
}) {
  const W = small ? 'w-9'  : 'w-16'
  const H = small ? 'h-14' : 'h-24'

  if (isBack || isHidden) {
    return (
      <div
        onClick={!isHidden ? onClick : undefined}
        className={`${W} ${H} card-back rounded-lg border-2 shadow-lg flex-shrink-0 transition-all duration-150 ${
          isHidden
            ? 'opacity-40 cursor-default border-blue-400/30'
            : onClick
              ? 'cursor-pointer border-blue-400/30 hover:border-yellow-400/60 hover:-translate-y-2 hover:shadow-xl active:scale-95'
              : 'border-blue-400/30'
        }`}
        style={style}
      />
    )
  }

  if (!card) return null

  // ── Special Troço cards ──────────────────────────────────────────────────
  if (card.special && SPECIAL_META[card.special]) {
    const meta = SPECIAL_META[card.special]
    return (
      <div
        onClick={onClick}
        title={meta.title}
        className={[
          `${W} ${H} relative rounded-lg border-2 shadow-lg flex-shrink-0`,
          `bg-gradient-to-br ${meta.bg} ${meta.border}`,
          isHighlighted ? 'card-glow -translate-y-3 border-yellow-400' : '',
          onClick ? 'cursor-pointer hover:-translate-y-2 hover:shadow-xl active:scale-95 transition-all duration-150' : '',
        ].join(' ')}
        style={style}
      >
        {/* Top label */}
        <div className={`absolute top-1 left-1.5 leading-none font-bold ${small ? 'text-[9px]' : 'text-xs'}`} style={{ color: meta.textColor }}>
          <div>{meta.label}</div>
          <div style={{ color: meta.textColor }}>{meta.sublabel}</div>
        </div>

        {/* Center symbol */}
        {card.special === 'coringa1' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none">
            {!small && (
              <div style={{ fontSize: '9px', color: '#6d28d9', letterSpacing: '3px', marginBottom: '1px' }}>★★★</div>
            )}
            <div style={{
              fontSize: small ? '26px' : '50px',
              lineHeight: 1,
              color: '#c4b5fd',
              textShadow: '0 0 18px #a855f7, 0 0 36px #7c3aed60',
            }}>★</div>
            {!small && (
              <div style={{ fontSize: '8px', color: '#7c3aed', letterSpacing: '0.3em', fontWeight: 800, marginTop: '3px' }}>CORINGA</div>
            )}
          </div>
        ) : card.special === 'coringa2' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none">
            {!small && (
              <div style={{ fontSize: '9px', color: '#92400e', letterSpacing: '3px', marginBottom: '1px' }}>? ? ?</div>
            )}
            <div style={{
              fontSize: small ? '26px' : '50px',
              lineHeight: 1,
              fontWeight: 900,
              color: '#fed7aa',
              textShadow: '0 0 18px #f97316, 0 0 36px #ea580c60',
            }}>?</div>
            {!small && (
              <div style={{ fontSize: '8px', color: '#c2410c', letterSpacing: '0.2em', fontWeight: 800, marginTop: '3px' }}>CORINGA 2</div>
            )}
          </div>
        ) : (
          <div className={`absolute inset-0 flex items-center justify-center ${small ? 'text-xl' : 'text-3xl'}`}>
            {meta.symbol}
          </div>
        )}

        {/* Badge */}
        {!small && (
          <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 ${meta.badgeColor} text-white text-[8px] font-bold px-1 py-0.5 rounded`}>
            {meta.badge}
          </div>
        )}
      </div>
    )
  }

  // ── Regular card ─────────────────────────────────────────────────────────
  const color  = SUIT_COLOR[card.suit]
  const symbol = SUIT_SYMBOL[card.suit]

  return (
    <div
      onClick={onClick}
      title={`${card.value} de ${SUIT_NAME[card.suit]}`}
      className={[
        'relative bg-white rounded-lg border shadow-lg select-none flex-shrink-0 transition-all duration-150',
        `${W} ${H}`,
        isHighlighted ? 'border-yellow-400 border-2 card-glow -translate-y-3' : 'border-gray-300',
        isPlayed ? 'opacity-70' : '',
        onClick ? 'cursor-pointer hover:-translate-y-2 hover:shadow-xl active:scale-95' : '',
      ].join(' ')}
      style={style}
    >
      <div className={`absolute top-1 left-1.5 leading-none font-bold ${small ? 'text-xs' : 'text-sm'}`} style={{ color }}>
        <div>{card.value}</div>
        <div className={small ? 'text-[10px]' : 'text-xs'}>{symbol}</div>
      </div>

      <div className={`absolute inset-0 flex items-center justify-center font-bold ${small ? 'text-2xl' : 'text-4xl'}`} style={{ color }}>
        {symbol}
      </div>

      <div className={`absolute bottom-1 right-1.5 leading-none font-bold rotate-180 ${small ? 'text-xs' : 'text-sm'}`} style={{ color }}>
        <div>{card.value}</div>
        <div className={small ? 'text-[10px]' : 'text-xs'}>{symbol}</div>
      </div>
    </div>
  )
}
