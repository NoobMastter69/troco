import { useEffect, useState, useRef, useCallback } from 'react'
import socket from '../socket.js'
import PlayerHand from './PlayerHand.jsx'
import OtherPlayer from './OtherPlayer.jsx'
import TableCenter from './TableCenter.jsx'
import Scoreboard from './Scoreboard.jsx'
import TrucoDialog from './TrucoDialog.jsx'
import GameLog from './GameLog.jsx'
import { cardLabel } from './GameLog.jsx'
import Card from './Card.jsx'
import { TombadoEffectBanner, TrocoEventToast, TrocoInfoBadges } from './TrocoEffects.jsx'
import InvictusBar from './InvictusBar.jsx'

const LEVEL_NAMES = ['—', 'Truco', 'Seis', 'Nove', 'Doze']

function bjCardValue(card) {
  if (!card || card.special) return 0
  if (['J', 'Q', 'K'].includes(card.value)) return 10
  if (card.value === 'A') return 1
  const n = parseInt(card.value)
  return isNaN(n) ? 0 : n
}

function BlackjackHandPreview({ hand, myTeam }) {
  if (!hand?.length) return null
  const total = hand.reduce((s, c) => s + bjCardValue(c), 0)
  return (
    <div className="mt-2">
      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Sua mão</div>
      <div className="flex justify-center gap-2 mb-2">
        {hand.map((c, i) => (
          <div key={i} className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-center min-w-[36px]">
            <div className="text-white text-sm font-bold">{c.value}</div>
            <div className="text-white/40 text-[9px]">{bjCardValue(c)}</div>
          </div>
        ))}
      </div>
      <div className={`text-lg font-bold font-mono ${total > 21 ? 'text-red-400' : total >= 18 ? 'text-green-300' : 'text-white/70'}`}>
        Sua soma: {total}
      </div>
    </div>
  )
}

const CANVAS_W = 900
const CANVAS_H = 620

export default function GameTable({ initialPlayers, myId, mode, onLeave }) {
  const [state, setGameState] = useState(null)
  const [players] = useState(initialPlayers)
  const [log, setLog] = useState([])
  const [roundResult, setRoundResult] = useState(null)
  const [gameOver, setGameOver] = useState(null)
  const [tombadoEffect, setTombadoEffect] = useState(null)
  const [trocoEvents, setTrocoEvents] = useState([])
  const [turnTimer, setTurnTimer] = useState(null)
  const [trucoFeedback, setTrucoFeedback] = useState(null)
  const [blackjackResult, setBlackjackResult] = useState(null)
  const [asVermelho3Event, setAsVermelho3Event] = useState(null)
  const [faceDownMode, setFaceDownMode] = useState(false)
  const [clipboardToast, setClipboardToast] = useState(false)
  const [scale, setScale] = useState(1)
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < 600 && window.innerHeight > window.innerWidth
  )
  const [mobileVH, setMobileVH] = useState(() => window.innerHeight)
  const stateRef = useRef(null)

  const me = players.find(p => p.id === myId)

  // Precisa estar antes dos hooks — usa optional chaining porque state pode ser null
  const isMyTurn = state?.currentPlayer === myId && state?.phase === 'playing' && !state?.blackjackRound

  // Mantém ref atualizado com o state mais recente para uso em closures de timer
  useEffect(() => { stateRef.current = state }, [state])

  // Aviso de clipboard
  useEffect(() => {
    function handleCopy() {
      setClipboardToast(true)
      setTimeout(() => setClipboardToast(false), 2000)
    }
    document.addEventListener('copy', handleCopy)
    document.addEventListener('cut', handleCopy)
    return () => {
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('cut', handleCopy)
    }
  }, [])

  // Escala proporcional do canvas de jogo (desktop/landscape)
  useEffect(() => {
    function update() {
      const w = window.innerWidth
      const h = window.innerHeight
      setIsMobile(w < 600 && h > w)
      setMobileVH(h)
      setScale(Math.min(w / CANVAS_W, h / CANVAS_H))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Rotate so local player is always at bottom
  function getDisplayPlayers() {
    const myIdx = players.findIndex(p => p.id === myId)
    return Array.from({ length: 4 }, (_, i) => players[(myIdx + i) % 4])
  }
  const [bottom, left, top, right] = getDisplayPlayers()

  useEffect(() => {
    socket.on('game_state', ({ state: s, event }) => {
      setGameState(s)
      setRoundResult(null)
      if (event) handleEvent(event)
    })

    socket.on('tombado_effect', ({ effect, vira }) => {
      setTombadoEffect(effect)
    })

    socket.on('troco_event', evt => {
      setTrocoEvents(prev => [...prev, evt])
      if (evt.scores) setGameState(s => s ? { ...s, scores: evt.scores } : s)
      addLog(evt.message || `Evento Troço: ${evt.type}`)
      if (evt.type === 'as_vermelho3') {
        setAsVermelho3Event(evt)
        setTimeout(() => setAsVermelho3Event(null), 6000)
      }
    })

    socket.on('game_over', ({ winner, scores }) => {
      const winTeam = players.filter(p => p.team === winner).map(p => p.name).join(' & ')
      setGameOver({ winner, scores, winTeam })
      addLog(`🏆 Time ${winner + 1} (${winTeam}) venceu o jogo!`)
    })

    return () => {
      socket.off('game_state')
      socket.off('tombado_effect')
      socket.off('troco_event')
      socket.off('game_over')
    }
  }, [players])

  // Timer de turno — 15 segundos para jogar uma carta
  const TURN_SECS = 15
  useEffect(() => {
    if (!isMyTurn) { setTurnTimer(null); return }
    setTurnTimer(TURN_SECS)
    const id = setInterval(() => {
      setTurnTimer(t => {
        if (t <= 1) {
          clearInterval(id)
          const firstCard = stateRef.current?.hand?.find(c => !c.hidden)?.id
                         ?? stateRef.current?.hand?.[0]?.id
          if (firstCard) socket.emit('play_card', { cardId: firstCard }, res => {
            if (res?.error) addLog(`⚠ Auto-play: ${res.error}`)
          })
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isMyTurn])

  function handleEvent(e) {
    if (!e) return
    switch (e.type) {
      case 'round_started': {
        setTombadoEffect(e.tombadoEffect)
        const isTuesday = new Date().getDay() === 2
        let tag = `— Rodada ${(state?.roundNum ?? 0) + 1} —  Vira: ${cardLabel(e.vira)}  Manilha: ${e.manilhaValue ?? '(especial)'}`
        if (isTuesday) tag += ' 📅 (terça)'
        if (e.tombadoEffect) tag += ` ⚡ [${e.tombadoEffect}]`
        addLog(tag)
        if (e.maoVinte3) addLog('🔥 Mão de 23 — rodada vale 5pts fixo, sem truco.')
        if (e.maoEscura) addLog('🌑 Mão Escura — 11×11, joguem às cegas!')
        break
      }
      case 'card_played': {
        const p = players.find(x => x.id === e.playerId)
        const isMe = e.playerId === myId
        if (e.faceDown && !isMe) {
          addLog(`${p?.name} jogou virado 🔲`)
        } else if (e.coringa2Drawn) {
          addLog(`${p?.name} usou Coringa 2 → revelou ${cardLabel(e.coringa2Drawn)}`)
        } else {
          addLog(`${p?.name} jogou ${cardLabel(e.card)}`)
        }
        break
      }
      case 'sub_hand_result': {
        const label = e.winner !== null
          ? `Time ${e.winner + 1} venceu a ${['1ª', '2ª', '3ª'][e.subHandIdx] ?? ''} mão`
          : `Empate na ${['1ª', '2ª', '3ª'][e.subHandIdx] ?? ''} mão`
        addLog(label)
        break
      }
      case 'truco_called': {
        const p = players.find(x => x.id === e.calledBy)
        addLog(`${p?.name} pediu ${LEVEL_NAMES[e.targetLevel]}! (${e.targetValue}pts)`)
        break
      }
      case 'truco_accepted': {
        addLog(`Truco aceito — rodada vale ${e.value} pontos`)
        showTrucoFeedback(`✅ Aceito! Vale ${e.value}pts`, 'green')
        break
      }
      case 'truco_raised': {
        const p = players.find(x => x.id === e.calledBy)
        addLog(`${p?.name} aumentou para ${LEVEL_NAMES[e.targetLevel]}! (${e.targetValue}pts)`)
        showTrucoFeedback(`⬆️ ${p?.name} aumentou: ${LEVEL_NAMES[e.targetLevel]}! (${e.targetValue}pts)`, 'yellow')
        break
      }
      case 'round_end': {
        if (e.blackjack) {
          const summary = players.map(p => `${p.name}: ${e.playerTotals?.[p.id] ?? '?'}`).join('  ')
          const winner = e.winnerTeam !== null ? `Time ${e.winnerTeam + 1} venceu` : 'Empate'
          addLog(`🃏 Blackjack! ${summary}  → ${winner} (+${e.points}pts)`)
          setBlackjackResult(e)
          setTimeout(() => setBlackjackResult(null), 4000)
        } else if (e.reason === 'invictus_confirmed' || e.reason === 'invictus_wrong') {
          // handled by invictus_resolved event
        } else if (e.reason === 'run') {
          addLog(`Time ${e.winnerTeam + 1} ganhou ${e.points}pt — adversário correu`)
          showTrucoFeedback(`🏃 Adversário correu! +${e.points}pt`, 'green')
        } else if (e.reason === 'sequencia_opponent_ran') {
          addLog(`Sequência! Time ${e.winnerTeam + 1} ganhou 3pts — adversário correu`)
        } else if (e.reversed67) {
          addLog(`🎯 6+7 — Time ${e.winnerTeam + 1} perdeu e levou ${e.points}pt(s)! (regra 6+7)`)
        } else if (e.reversed) {
          addLog(`↩️ 1ª mão empatou — Time ${e.winnerTeam + 1} TIROU ${e.points}pts do adversário!`)
        } else if (e.winnerTeam !== null) {
          const why = e.explanation ? ` (${e.explanation})` : ''
          addLog(`✓ Time ${e.winnerTeam + 1} venceu (+${e.points}pts)${why} | ${e.scores[0]}×${e.scores[1]}`)
        }
        if (e.asVermelho3 && e.winnerTeam !== null) {
          const loser = e.winnerTeam === 0 ? 1 : 0
          addLog(`🃏 Ás+3 Vermelho: Time ${e.winnerTeam + 1} +3 extra | Time ${loser + 1} -3pts`)
        }
        if (!e.blackjack) setRoundResult(e)
        break
      }
    }
  }

  function addLog(msg) {
    setLog(prev => [...prev.slice(-60), msg])
  }

  function showTrucoFeedback(msg, color = 'yellow') {
    setTrucoFeedback({ msg, color })
    setTimeout(() => setTrucoFeedback(null), 2500)
  }

  function playCard(cardId) {
    socket.emit('play_card', { cardId, faceDown: faceDownMode }, res => {
      if (res?.error) addLog(`⚠ ${res.error}`)
      else setFaceDownMode(false)
    })
  }

  function callTruco() {
    socket.emit('call_truco', {}, res => {
      if (res?.error) addLog(`⚠ ${res.error}`)
    })
  }

  function respondTruco(response) {
    socket.emit('respond_truco', { response }, res => {
      if (res?.error) addLog(`⚠ ${res.error}`)
    })
  }

  if (!state) {
    return (
      <div className="fixed inset-0 felt flex items-center justify-center">
        <div className="text-white/50 text-lg animate-pulse">Distribuindo cartas…</div>
      </div>
    )
  }

  const hasTrucoPending = !!state.pendingTruco
  const canCallTruco = state.phase === 'playing' && !hasTrucoPending && state.trucoLevel < 4 && !state.blackjackRound

  // ── Shared JSX blocks ────────────────────────────────────────────────────

  const actionButtons = (
    <div className="flex gap-2 flex-wrap justify-center">
      {canCallTruco && (
        <button onClick={callTruco} className="px-5 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-yellow-600/20">
          {LEVEL_NAMES[(state.trucoLevel ?? 0) + 1] ?? 'Truco'}!
        </button>
      )}
      {state.maoVinte3 && state.phase === 'playing' && (
        <button
          onClick={() => socket.emit('run_mao23', {}, res => {
            if (res?.error) addLog(`⚠ ${res.error}`)
          })}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-500/40 text-white/70 text-xs font-bold rounded-lg transition-all active:scale-95"
        >
          Correr (pagar 5pts)
        </button>
      )}
      {state.mode === 'troco' && state.tombadoSwapTeam === me?.team && !state.tombadoSwapped && (
        <button
          onClick={() => socket.emit('swap_tombado', {}, res => {
            if (res?.error) addLog(`⚠ ${res.error}`)
          })}
          className="px-3 py-1.5 bg-lime-800 hover:bg-lime-700 border border-lime-600/40 text-lime-200 text-xs font-bold rounded-lg transition-all active:scale-95"
        >
          🔄 Trocar Tombo
        </button>
      )}
      {isMyTurn && (
        <button
          onClick={() => setFaceDownMode(f => !f)}
          disabled={!!state.hasSixAndSeven}
          title={state.hasSixAndSeven ? 'Com 6+7 não pode jogar virado' : 'Jogar próxima carta virada'}
          className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
            faceDownMode
              ? 'bg-gray-600 border-gray-400/60 text-white'
              : 'bg-transparent border-white/15 text-white/35 hover:text-white/60 hover:border-white/25'
          }`}
        >
          {faceDownMode ? '🔲 Virado ON' : '🔲 Virado'}
        </button>
      )}
      <InvictusBar state={state} myTeam={me?.team} onLog={addLog} />
    </div>
  )

  const overlays = (
    <>
      {hasTrucoPending && (
        <TrucoDialog pendingTruco={state.pendingTruco} myTeam={me?.team} onRespond={respondTruco} players={players} />
      )}
      {tombadoEffect && <TombadoEffectBanner effect={tombadoEffect} />}
      <TrocoEventToast events={trocoEvents} />

      {state.blackjackRound && !blackjackResult && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 fade-in pointer-events-none">
          <div className="bg-gray-900/95 border border-yellow-500/60 rounded-2xl px-8 py-6 text-center shadow-2xl max-w-xs w-[85vw]">
            <div className="text-4xl mb-2">🃏</div>
            <div className="text-2xl font-display font-bold text-yellow-300 mb-1">Rodada Blackjack!</div>
            <div className="text-white/60 text-sm mb-3">Sequência Real — time mais próximo de 21 vence</div>
            <div className="text-white/40 text-xs mb-4">A=1 · J/Q/K=10 · outros=face</div>
            <BlackjackHandPreview hand={state.hand} myTeam={me?.team} />
            <div className="text-white/30 text-xs mt-4 animate-pulse">Resolvendo em instantes…</div>
          </div>
        </div>
      )}
      {blackjackResult && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 fade-in pointer-events-none">
          <div className="bg-gray-900/95 border border-yellow-500/60 rounded-2xl px-6 py-5 text-center shadow-2xl max-w-xs w-[85vw]">
            <div className="text-4xl mb-1">🃏</div>
            <div className="text-2xl font-display font-bold text-yellow-300 mb-3">Blackjack!</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {players.map(p => {
                const total = blackjackResult.playerTotals?.[p.id] ?? '?'
                const bust = typeof total === 'number' && total > 21
                const isWinner = !bust && typeof total === 'number' &&
                  blackjackResult.winnerTeam === p.team &&
                  total === Math.max(...players
                    .filter(x => x.team === p.team)
                    .map(x => blackjackResult.playerTotals?.[x.id] ?? 0)
                    .filter(t => t <= 21))
                return (
                  <div key={p.id} className={`rounded-lg px-3 py-2 border ${p.team === 0 ? 'border-blue-500/30 bg-blue-950/40' : 'border-red-500/30 bg-red-950/40'}`}>
                    <div className="text-[10px] text-white/40 truncate">{p.name}</div>
                    <div className={`text-2xl font-bold font-mono ${bust ? 'text-red-400' : isWinner ? 'text-green-300' : 'text-white/70'}`}>
                      {total}
                    </div>
                    {bust && <div className="text-[9px] text-red-400">passou</div>}
                  </div>
                )
              })}
            </div>
            {blackjackResult.winnerTeam !== null
              ? <div className="text-green-300 font-bold text-sm">Time {blackjackResult.winnerTeam + 1} venceu! +{blackjackResult.points}pts</div>
              : <div className="text-white/60 font-bold text-sm">Empate</div>
            }
          </div>
        </div>
      )}
      {trucoFeedback && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none fade-in">
          <div className={`px-6 py-2.5 rounded-2xl text-sm font-bold shadow-2xl border backdrop-blur-sm ${
            trucoFeedback.color === 'green' ? 'bg-green-950/90 border-green-500/50 text-green-300'
              : trucoFeedback.color === 'red' ? 'bg-red-950/90 border-red-500/50 text-red-300'
              : 'bg-yellow-950/90 border-yellow-500/50 text-yellow-300'
          }`}>{trucoFeedback.msg}</div>
        </div>
      )}
      {roundResult && !hasTrucoPending && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none fade-in">
          <div className="bg-gray-900/95 border border-white/20 rounded-2xl px-8 py-4 text-center shadow-2xl">
            {roundResult.reversed ? (
              <div>
                <div className="text-xl font-display font-bold text-orange-300">Inversão!</div>
                <div className="text-white/50 text-sm mt-1">Time {roundResult.winnerTeam + 1} TIROU {roundResult.points}pts do adversário</div>
              </div>
            ) : roundResult.winnerTeam !== null ? (
              <div>
                <div className="text-2xl font-display font-bold text-white">Time {roundResult.winnerTeam + 1} venceu!</div>
                <div className="text-white/50 text-sm mt-1">+{roundResult.points} ponto{roundResult.points !== 1 ? 's' : ''}</div>
              </div>
            ) : (
              <div className="text-2xl font-display font-bold text-white/70">Empate</div>
            )}
          </div>
        </div>
      )}
      {asVermelho3Event && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 fade-in pointer-events-none">
          <div className="bg-gray-900/95 border border-red-500/50 rounded-2xl px-6 py-5 text-center shadow-2xl max-w-sm w-full mx-4">
            <div className="text-3xl mb-1">🃏</div>
            <div className="text-xl font-display font-bold text-red-300 mb-1">Ás + 3 Vermelho!</div>
            <div className="text-white/50 text-xs mb-3">Todas as mãos reveladas e reembaralhadas</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {players.map(p => (
                <div key={p.id} className={`rounded-lg p-2 border ${p.team === 0 ? 'border-blue-500/30 bg-blue-950/40' : 'border-red-500/30 bg-red-950/40'}`}>
                  <div className="text-[10px] text-white/40 truncate mb-1">{p.name}</div>
                  <div className="flex gap-0.5 justify-center flex-wrap">
                    {(asVermelho3Event.revealedHands?.[p.id] || []).map((c, i) => (
                      <Card key={i} card={c} small />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-orange-300 text-xs font-semibold">+3 para o vencedor · -3 para o perdedor</div>
          </div>
        </div>
      )}
      {clipboardToast && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none fade-in">
          <div className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-800/90 border border-white/20 text-white/70 backdrop-blur-sm shadow-xl">
            📋 Copiado para a área de transferência
          </div>
        </div>
      )}
      {gameOver && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 fade-in">
          <div className="bg-gray-900 border border-yellow-500/50 rounded-2xl p-8 text-center shadow-2xl max-w-sm w-full mx-4">
            <div className="text-5xl mb-3">🏆</div>
            <div className="text-3xl font-display font-bold text-yellow-300 mb-2">Time {gameOver.winner + 1} venceu!</div>
            <div className="text-white/50 mb-6">{gameOver.winTeam}</div>
            <div className="text-2xl font-bold text-white mb-6">{gameOver.scores[0]} × {gameOver.scores[1]}</div>
            <button onClick={() => window.location.reload()} className="w-full py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded-xl transition-colors">
              Jogar Novamente
            </button>
          </div>
        </div>
      )}
    </>
  )

  // ── Mobile portrait layout ───────────────────────────────────────────────

  if (isMobile) {
    // Fixed section heights — middle is capped so tall phones don't get huge empty gaps
    const mH = 48, tH = 82, myH = 158, logH = 36
    const midH = Math.max(190, Math.min(300, mobileVH - mH - tH - myH - logH))
    const totalH = mH + tH + midH + myH + logH

    return (
      <div className="fixed inset-0 felt flex flex-col justify-center relative overflow-hidden">
        <div className="flex flex-col" style={{ height: totalH }}>

          {/* Header */}
          <div className="relative flex items-center px-3 bg-black/30 backdrop-blur-sm" style={{ height: mH }}>
            <div className="text-white/40 text-[10px] font-display font-bold tracking-wider">
              {mode === 'troco' ? '🔥 TROÇO' : '🃏 TRUCO'}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2">
              <Scoreboard scores={state.scores} players={players} mode={mode} />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                isMyTurn ? 'bg-yellow-400/20 text-yellow-300 animate-pulse' : 'text-white/20 bg-black/20'
              }`}>
                {isMyTurn ? 'SUA VEZ' : state.phase === 'truco_call' ? 'TRUCO!' : ''}
              </div>
              <button onClick={onLeave} className="text-white/25 hover:text-white/60 text-[10px] transition-colors px-1">
                Sair
              </button>
            </div>
          </div>

          {/* Top opponent */}
          <div className="flex justify-center items-center" style={{ height: tH }}>
            <OtherPlayer player={top} handCount={state.handCounts?.[top.id] ?? 0}
              isCurrentTurn={state.currentPlayer === top.id} position="top" />
          </div>

          {/* Middle row */}
          <div className="flex items-center px-1 gap-1" style={{ height: midH }}>
            <div className="w-[76px] flex justify-center items-center h-full">
              <OtherPlayer player={left} handCount={state.handCounts?.[left.id] ?? 0}
                isCurrentTurn={state.currentPlayer === left.id} position="left" />
            </div>
            <div className="flex-1 flex justify-center items-center h-full">
              <TableCenter
                vira={state.vira}
                manilhaValue={state.manilhaValue}
                tombadoEffect={state.tombadoEffect}
                table={state.table}
                history={state.history}
                subHandResults={state.subHandResults}
                players={players}
                roundValue={state.roundValue}
              />
            </div>
            <div className="w-[76px] flex justify-center items-center h-full">
              <OtherPlayer player={right} handCount={state.handCounts?.[right.id] ?? 0}
                isCurrentTurn={state.currentPlayer === right.id} position="right" />
            </div>
          </div>

          {/* My section */}
          <div className="flex flex-col items-center justify-center gap-1.5 border-t border-white/10" style={{ height: myH }}>
            {state.isDark && (
              <div className="text-purple-400 text-xs bg-purple-900/30 border border-purple-500/30 px-2 py-0.5 rounded-full">
                🌑 Escuro
              </div>
            )}
            <PlayerHand hand={state.hand} isMyTurn={isMyTurn} onPlay={playCard} isDark={state.isDark} />
            {actionButtons}
          </div>

          {/* Log */}
          <div className="px-3 bg-black/20 border-t border-white/5" style={{ height: logH }}>
            <GameLog log={log} />
          </div>

        </div>
        {overlays}
      </div>
    )
  }

  // ── Desktop / landscape layout ───────────────────────────────────────────

  return (
    <div className="fixed inset-0 felt overflow-hidden flex items-center justify-center">
    <div
      className="relative flex flex-col overflow-hidden"
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }}
    >
      {/* Header: 50px */}
      <div className="relative flex items-center px-4 bg-black/30 backdrop-blur-sm" style={{ height: 50 }}>
        <div className="flex items-center gap-2 flex-none">
          <div className="text-white/40 text-xs font-display font-bold tracking-wider">
            {mode === 'troco' ? '🔥 TROÇO' : '🃏 TRUCO'}
          </div>
          {state && <TrocoInfoBadges state={state} />}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2">
          <Scoreboard scores={state.scores} players={players} mode={mode} />
        </div>
        <div className="ml-auto flex-none flex items-center gap-2">
          <div className={`text-xs px-3 py-1 rounded-full font-semibold ${
            isMyTurn ? 'bg-yellow-400/20 text-yellow-300 card-glow' : 'text-white/20 bg-black/20'
          }`}>
            {isMyTurn ? 'SUA VEZ' : state.phase === 'truco_call' ? 'TRUCO!' : ''}
          </div>
          <button onClick={onLeave} className="text-white/25 hover:text-white/60 text-xs transition-colors px-1">
            Sair
          </button>
        </div>
      </div>

      {/* Top player: 110px */}
      <div className="flex justify-center items-center" style={{ height: 110 }}>
        <OtherPlayer player={top} handCount={state.handCounts?.[top.id] ?? 0}
          isCurrentTurn={state.currentPlayer === top.id} position="top" />
      </div>

      {/* Middle row: 260px */}
      <div className="flex items-center px-3 gap-2" style={{ height: 260 }}>
        <div className="flex-none w-28 flex justify-center">
          <OtherPlayer player={left} handCount={state.handCounts?.[left.id] ?? 0}
            isCurrentTurn={state.currentPlayer === left.id} position="left" />
        </div>
        <div className="flex-1 flex justify-center">
          <TableCenter
            vira={state.vira}
            manilhaValue={state.manilhaValue}
            tombadoEffect={state.tombadoEffect}
            table={state.table}
            history={state.history}
            subHandResults={state.subHandResults}
            players={players}
            roundValue={state.roundValue}
          />
        </div>
        <div className="flex-none w-28 flex justify-center">
          <OtherPlayer player={right} handCount={state.handCounts?.[right.id] ?? 0}
            isCurrentTurn={state.currentPlayer === right.id} position="right" />
        </div>
      </div>

      {/* My section: 160px */}
      <div className="flex flex-col items-center justify-center gap-1 border-t border-white/10" style={{ height: 160 }}>
        {state.isDark && (
          <div className="text-purple-400 text-xs bg-purple-900/30 border border-purple-500/30 px-3 py-0.5 rounded-full">
            🌑 Escuro — clique para jogar sem ver
          </div>
        )}
        {isMyTurn && turnTimer !== null && (
          <div className="w-56 px-1">
            <div className="h-1.5 bg-gray-700/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${turnTimer <= 4 ? 'bg-red-500' : turnTimer <= 8 ? 'bg-yellow-400' : 'bg-green-500'}`}
                style={{ width: `${(turnTimer / TURN_SECS) * 100}%`, transition: 'width 0.9s linear, background-color 0.3s' }}
              />
            </div>
            <div className={`text-right text-[10px] mt-0.5 font-mono ${turnTimer <= 4 ? 'text-red-400 animate-pulse' : 'text-white/25'}`}>
              {turnTimer}s
            </div>
          </div>
        )}
        <PlayerHand hand={state.hand} isMyTurn={isMyTurn} onPlay={playCard} isDark={state.isDark} />
        {actionButtons}
      </div>

      {/* Log: 40px */}
      <div className="px-4 bg-black/20 backdrop-blur-sm border-t border-white/5" style={{ height: 40 }}>
        <GameLog log={log} />
      </div>

      {overlays}
    </div>
    </div>
  )
}
