import { useState, useEffect } from 'react'

const TOMBADO_INFO = {
  truco_mineiro: {
    icon: '🏔️',
    title: 'Truco Mineiro!',
    desc: 'O Zap 2 foi tombado. As regras do Troço estão suspensas — esta rodada é Truco Mineiro puro.',
    color: 'border-amber-500/50 bg-amber-950/80',
    text: 'text-amber-300',
  },
  dark: {
    icon: '🌑',
    title: 'Jogo no Escuro!',
    desc: 'O Coringa 1 foi tombado. Você não pode ver suas próprias cartas antes de jogá-las.',
    color: 'border-purple-500/50 bg-purple-950/80',
    text: 'text-purple-300',
  },
  no_variable_manilhas: {
    icon: '⚔️',
    title: 'Espada Espada tombada!',
    desc: 'Sem manilhas variáveis esta rodada — só valem Zap 2, Coringa 1 e o Ás de Espadas.',
    color: 'border-cyan-500/50 bg-cyan-950/80',
    text: 'text-cyan-300',
  },
  manilha_3: {
    icon: '♣️',
    title: '2 Preto tombado!',
    desc: 'A manilha desta rodada é o 3 (não o padrão do vira).',
    color: 'border-slate-500/50 bg-slate-950/80',
    text: 'text-slate-300',
  },
  manilha_4: {
    icon: '♥️',
    title: '2 Vermelho tombado!',
    desc: 'A manilha desta rodada é o 4 (não o padrão do vira).',
    color: 'border-rose-500/50 bg-rose-950/80',
    text: 'text-rose-300',
  },
  tuesday_reversed: {
    icon: '📅',
    title: 'É Terça-feira!',
    desc: 'Às terças, a manilha é a carta ANTERIOR ao vira, não a próxima.',
    color: 'border-green-500/50 bg-green-950/80',
    text: 'text-green-300',
  },
  q_copas_tombado: {
    icon: '♛',
    title: 'Q de Copas tombado!',
    desc: 'O Q de Espadas tem o valor do J de Copas esta rodada (2ª manilha mais forte).',
    color: 'border-rose-500/50 bg-rose-950/80',
    text: 'text-rose-300',
  },
}

export function TombadoEffectBanner({ effect }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(t)
  }, [effect])

  if (!visible || !effect || !TOMBADO_INFO[effect]) return null

  const info = TOMBADO_INFO[effect]

  return (
    <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-40 border rounded-xl px-5 py-3 shadow-2xl backdrop-blur slide-up max-w-xs text-center ${info.color}`}>
      <div className="text-2xl mb-1">{info.icon}</div>
      <div className={`font-bold font-display text-lg ${info.text}`}>{info.title}</div>
      <div className="text-white/60 text-xs mt-1">{info.desc}</div>
    </div>
  )
}

export function TrocoEventToast({ events }) {
  const [shown, setShown] = useState([])

  useEffect(() => {
    if (events.length === 0) return
    const last = events[events.length - 1]
    setShown(prev => [...prev.slice(-4), { ...last, key: Date.now() }])
    const t = setTimeout(() => setShown(prev => prev.slice(1)), 4000)
    return () => clearTimeout(t)
  }, [events.length])

  return (
    <div className="absolute top-16 right-4 z-50 flex flex-col gap-2 items-end">
      {shown.map(evt => (
        <div key={evt.key} className="slide-up bg-gray-900/95 border border-yellow-500/40 rounded-xl px-4 py-2 shadow-xl max-w-[220px]">
          {evt.type === 'trinca' && (
            <div>
              <span className="text-yellow-300 font-bold text-sm">Trinca!</span>
              <p className="text-white/70 text-xs mt-0.5">{evt.message}</p>
            </div>
          )}
          {evt.type === 'double_trinca' && (
            <div>
              <span className="text-orange-300 font-bold text-sm">Dupla Trinca!</span>
              <p className="text-white/70 text-xs mt-0.5">{evt.message}</p>
            </div>
          )}
          {evt.type === 'mao_vinte3' && (
            <div>
              <span className="text-orange-400 font-bold text-sm">Mão de 23!</span>
              <p className="text-white/70 text-xs mt-0.5">{evt.message}</p>
            </div>
          )}
          {evt.type === 'mao_escura' && (
            <div>
              <span className="text-purple-300 font-bold text-sm">Mão Escura!</span>
              <p className="text-white/70 text-xs mt-0.5">{evt.message}</p>
            </div>
          )}
          {evt.type === 'as_vermelho3' && (
            <div>
              <span className="text-red-400 font-bold text-sm">Ás + 3 Vermelho!</span>
              <p className="text-white/70 text-xs mt-0.5">{evt.message}</p>
            </div>
          )}
          {evt.type === 'quadra' && (
            <div>
              <span className="text-yellow-300 font-bold text-sm">🃏 QUADRA!</span>
              <p className="text-white/70 text-xs mt-0.5">{evt.message}</p>
            </div>
          )}
          {evt.type === 'hands_rotated' && (
            <div>
              <span className="text-cyan-300 font-bold text-sm">🔄 Mãos Rotacionadas!</span>
              <p className="text-white/70 text-xs mt-0.5">{evt.message}</p>
            </div>
          )}
          {evt.type === 'tombado_swapped' && (
            <div>
              <span className="text-lime-300 font-bold text-sm">🔄 Tombo Trocado!</span>
              <p className="text-white/70 text-xs mt-0.5">{evt.message}</p>
            </div>
          )}
          {evt.type === 'curtinho' && (
            <div>
              <span className="text-pink-300 font-bold text-sm">🎯 O Curtinho!</span>
              <p className="text-white/70 text-xs mt-0.5">{evt.message}</p>
            </div>
          )}
          {evt.type === 'blackjack_round' && (
            <div>
              <span className="text-yellow-300 font-bold text-sm">🃏 Rodada Blackjack!</span>
              <p className="text-white/70 text-xs mt-0.5">{evt.message}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function TrocoInfoBadges({ state }) {
  if (state.mode !== 'troco') return null

  const isTuesday = new Date().getDay() === 2

  return (
    <div className="flex gap-1.5 flex-wrap">
      {isTuesday && (
        <span className="text-[9px] bg-green-800/60 text-green-300 border border-green-700/40 px-1.5 py-0.5 rounded">
          📅 Terça
        </span>
      )}
      {state.tombadoEffect && TOMBADO_INFO[state.tombadoEffect] && (
        <span className={`text-[9px] border px-1.5 py-0.5 rounded ${TOMBADO_INFO[state.tombadoEffect].color} ${TOMBADO_INFO[state.tombadoEffect].text}`}>
          {TOMBADO_INFO[state.tombadoEffect].icon} {TOMBADO_INFO[state.tombadoEffect].title}
        </span>
      )}
      {state.hasSequencia && (
        <span className="text-[9px] bg-blue-800/60 text-blue-300 border border-blue-700/40 px-1.5 py-0.5 rounded">
          🎯 Seq (12pts) — sinalize!
        </span>
      )}
      {state.seqSignaledMe && (
        <span className="text-[9px] bg-blue-900/60 text-blue-200 border border-blue-700/40 px-1.5 py-0.5 rounded">
          🎯 Parceiro tem seq (12pts)
        </span>
      )}
      {state.royalSequencia?.length > 0 && (
        <span className="text-[9px] bg-yellow-800/60 text-yellow-300 border border-yellow-700/40 px-1.5 py-0.5 rounded">
          👑 Seq. Real → Blackjack!
        </span>
      )}
      {state.maoVinte3 && (
        <span className="text-[9px] bg-orange-900/60 text-orange-300 border border-orange-700/40 px-1.5 py-0.5 rounded">
          🔥 Mão de 23 (5pts fixo)
        </span>
      )}
      {state.maoEscura && (
        <span className="text-[9px] bg-purple-900/60 text-purple-300 border border-purple-700/40 px-1.5 py-0.5 rounded">
          🌑 Mão Escura (11×11)
        </span>
      )}
      {state.quadra && (
        <span className="text-[9px] bg-yellow-900/60 text-yellow-300 border border-yellow-600/40 px-1.5 py-0.5 rounded font-bold">
          🃏 QUADRA de {state.quadra}
        </span>
      )}
    </div>
  )
}
