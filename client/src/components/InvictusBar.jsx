import { useState, useEffect } from 'react'
import socket from '../socket.js'

export default function InvictusBar({ state, myTeam, onLog }) {
  const [resolved, setResolved] = useState(null)
  const [partnerSignaled, setPartnerSignaled] = useState(false)
  const [seqSignaledByPartner, setSeqSignaledByPartner] = useState(false)
  const [signaling, setSignaling] = useState(false)
  const [signalSent, setSignalSent] = useState(false)
  const [seqSignaling, setSeqSignaling] = useState(false)
  const [seqSignalSent, setSeqSignalSent] = useState(false)

  const isActive = state.mode === 'troco' && state.phase === 'playing'
  const hasSixSeven = state.hasSixAndSeven
  const hasSequencia = state.hasSequencia
  const receivedSignal = state.partnerSignaledMe
  const receivedSeqSignal = state.seqSignaledMe

  useEffect(() => {
    socket.on('partner_signal_received', () => {
      setPartnerSignaled(true)
      setTimeout(() => setPartnerSignaled(false), 8000)
    })

    socket.on('seq_signal_received', () => {
      setSeqSignaledByPartner(true)
      setTimeout(() => setSeqSignaledByPartner(false), 8000)
    })

    socket.on('invictus_resolved', (data) => {
      setResolved(data)
      onLog?.(data.message)
      setTimeout(() => setResolved(null), 4000)
    })

    return () => {
      socket.off('partner_signal_received')
      socket.off('seq_signal_received')
      socket.off('invictus_resolved')
    }
  }, [])

  function signal() {
    setSignaling(true)
    socket.emit('signal_partner', {}, res => {
      setSignaling(false)
      if (res?.error) {
        onLog?.(`⚠ ${res.error}`)
      } else {
        setSignalSent(true)
        setTimeout(() => setSignalSent(false), 3000)
        onLog?.('🤫 Sinal 6+7 enviado ao parceiro!')
      }
    })
  }

  function signalSeq() {
    setSeqSignaling(true)
    socket.emit('signal_partner_seq', {}, res => {
      setSeqSignaling(false)
      if (res?.error) {
        onLog?.(`⚠ ${res.error}`)
      } else {
        setSeqSignalSent(true)
        setTimeout(() => setSeqSignalSent(false), 3000)
        onLog?.('🤫 Sinal de sequência enviado ao parceiro!')
      }
    })
  }

  function callInvictus() {
    socket.emit('call_invictus', {}, res => {
      if (res?.error) onLog?.(`⚠ ${res.error}`)
    })
  }

  if (!isActive) return null

  return (
    <>
      {/* 6+7 partner signal received */}
      {partnerSignaled && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-30 fade-in">
          <div className="bg-green-900/90 border border-green-500/50 text-green-300 text-xs font-bold px-4 py-2 rounded-full shadow-lg animate-pulse">
            🤫 Parceiro tem 6+7 — joguem pra perder!
          </div>
        </div>
      )}

      {/* Sequência partner signal received */}
      {seqSignaledByPartner && (
        <div className="absolute bottom-44 left-1/2 -translate-x-1/2 z-30 fade-in">
          <div className="bg-blue-900/90 border border-blue-500/50 text-blue-200 text-xs font-bold px-4 py-2 rounded-full shadow-lg animate-pulse">
            🎯 Parceiro tem sequência — rodada vale 12pts!
          </div>
        </div>
      )}

      {/* Invictus resolved toast */}
      {resolved && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 fade-in pointer-events-none">
          <div className={`rounded-2xl px-8 py-5 text-center shadow-2xl border ${
            resolved.reason === 'invictus_confirmed'
              ? 'bg-green-950/95 border-green-500/60'
              : 'bg-red-950/95 border-red-500/60'
          }`}>
            <div className="text-3xl mb-2">{resolved.reason === 'invictus_confirmed' ? '✅' : '❌'}</div>
            <div className={`font-display font-bold text-xl ${
              resolved.reason === 'invictus_confirmed' ? 'text-green-300' : 'text-red-300'
            }`}>
              {resolved.reason === 'invictus_confirmed' ? 'Invictus Confirmado!' : 'Invictus Errado!'}
            </div>
            <div className="text-white/60 text-sm mt-1">{resolved.message}</div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 items-center flex-wrap justify-center">
        {/* 6+7 holder: signal button */}
        {hasSixSeven && (
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] bg-green-900/60 border border-green-700/40 text-green-300 px-2 py-0.5 rounded-full font-semibold">
              6+7 🎯
            </div>
            <button
              onClick={signal}
              disabled={signaling || signalSent}
              className={`px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-all active:scale-95 ${
                signalSent
                  ? 'bg-green-600 opacity-70 cursor-default'
                  : 'bg-green-800 hover:bg-green-700 disabled:opacity-50'
              }`}
              title="Sinalizar parceiro secretamente que vocês têm 6+7"
            >
              {signalSent ? '✓ Enviado' : '🤫 Sinalizar'}
            </button>
          </div>
        )}

        {/* Sequência holder: signal button */}
        {hasSequencia && (
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] bg-blue-900/60 border border-blue-700/40 text-blue-300 px-2 py-0.5 rounded-full font-semibold">
              Seq 🎯
            </div>
            <button
              onClick={signalSeq}
              disabled={seqSignaling || seqSignalSent}
              className={`px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-all active:scale-95 ${
                seqSignalSent
                  ? 'bg-blue-600 opacity-70 cursor-default'
                  : 'bg-blue-800 hover:bg-blue-700 disabled:opacity-50'
              }`}
              title="Sinalizar parceiro secretamente que você tem sequência"
            >
              {seqSignalSent ? '✓ Enviado' : '🤫 Sinalizar'}
            </button>
          </div>
        )}

        {/* Invictus button — always available for all (opponents will use it) */}
        <button
          onClick={callInvictus}
          className="px-4 py-1.5 bg-purple-900 hover:bg-purple-800 border border-purple-600/40 text-purple-200 text-xs font-bold rounded-lg transition-all active:scale-95 shadow"
          title="Chamar Invictus: você suspeita que o adversário tem 6+7 e está jogando pra perder"
        >
          ⚔️ Invictus!
        </button>
      </div>
    </>
  )
}
