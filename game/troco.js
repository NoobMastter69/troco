const { VALUES, createDeck, shuffle } = require('./deck')
const { getCardStrength, MANILHA_SUIT_RANK } = require('./rules')

// ── Special Troço cards ───────────────────────────────────────────────────

const ZAP2          = { id: 'zap2',          value: '8',  suit: 'clubs',  special: 'zap2' }
const CORINGA1      = { id: 'coringa1',      value: 'C1', suit: 'joker',  special: 'coringa1' }
const CORINGA2      = { id: 'coringa2',      value: 'C2', suit: 'joker2', special: 'coringa2' }
const ESPADA_ESPADA = { id: 'espada_espada', value: 'A',  suit: 'spades', special: 'espada_espada' }

// Troço deck: 40 base + 4 special = 44 cards
function createTrocoDeck() {
  return [...createDeck(), ZAP2, CORINGA1, CORINGA2, ESPADA_ESPADA]
}

// ── Manilha determination ─────────────────────────────────────────────────

function getTrocoManilhaValue(vira) {
  if (vira.special) return null // tombado effect handles this

  // Rule XII: black 2 → manilha is 3; red 2 → manilha is 4
  if (vira.value === '2') {
    const isBlack = vira.suit === 'spades' || vira.suit === 'clubs'
    return isBlack ? '3' : '4'
  }

  const idx = VALUES.indexOf(vira.value)
  if (idx === -1) return null

  // Rule XVII: on Tuesdays, manilha is the PREVIOUS card
  const isTuesday = new Date().getDay() === 2
  const offset = isTuesday ? -1 : 1
  return VALUES[(idx + offset + VALUES.length) % VALUES.length]
}

// ── Tombado (vira) effects ────────────────────────────────────────────────

function getTombadoEffect(vira, isTuesday = false) {
  if (vira.special === 'zap2')          return 'truco_mineiro'
  if (vira.special === 'coringa1')      return 'dark'
  if (vira.special === 'espada_espada') return 'no_variable_manilhas'
  if (vira.value === '2') {
    const isBlack = vira.suit === 'spades' || vira.suit === 'clubs'
    return isBlack ? 'manilha_3' : 'manilha_4'
  }
  // Rule XVI: Q de Copas tombado → Q de Espadas vira equivalente ao J de Copas
  if (vira.value === 'Q' && vira.suit === 'hearts') return 'q_copas_tombado'
  if (isTuesday) return 'tuesday_reversed'
  return null
}

// ── Truco Mineiro manilhas (for when Zap 2 is tombado) ───────────────────

const TM_MANILHAS = [
  { value: '7', suit: 'diamonds', strength: 10 },  // Sete de Ouro (weakest)
  { value: 'A', suit: 'spades',   strength: 11 },  // Ás de Espada
  { value: '7', suit: 'hearts',   strength: 12 },  // Sete de Copas
  { value: '4', suit: 'clubs',    strength: 13 },  // Quatro de Paus (strongest)
]

function getTMCardStrength(card) {
  if (card.special === 'zap2') return 100 // Zap 2 still beats everything in TM round too
  const tm = TM_MANILHAS.find(m => m.value === card.value && m.suit === card.suit)
  if (tm) return tm.strength
  return VALUES.indexOf(card.value) // normal card strength (no variable manilha)
}

// ── Card strength ─────────────────────────────────────────────────────────

function getTrocoCardStrength(card, manilhaValue, tombadoEffect = null) {
  if (!card) return -1

  // In Truco Mineiro round: use TM strengths
  if (tombadoEffect === 'truco_mineiro') return getTMCardStrength(card)

  if (card.special === 'zap2')          return 100  // beats all except Coringa 1 tie
  if (card.special === 'coringa1')      return 14   // above manilhas, below normals (special handling)
  if (card.special === 'espada_espada') {
    // If no variable manilhas round: A♠ also behaves as spades manilha strength
    return 10 + MANILHA_SUIT_RANK['spades'] // = 11
  }

  // Rule XVI: Q de Copas tombado → Q de Espadas tem força do J de Copas (rank 2 = 12)
  if (tombadoEffect === 'q_copas_tombado' && card.value === 'Q' && card.suit === 'spades') {
    return 12 // mesmo que J de Copas (segundo manilha mais forte)
  }

  // In no_variable_manilhas round: only Zap2, Coringa1, A♠ have manilha-level strength
  if (tombadoEffect === 'no_variable_manilhas') {
    if (card.value === 'A' && card.suit === 'spades') return 11 // A♠ keeps its manilha rank
    return VALUES.indexOf(card.value) // everything else is just a normal card
  }

  return manilhaValue ? getCardStrength(card, manilhaValue) : VALUES.indexOf(card.value)
}

// ── Sub-hand resolution ───────────────────────────────────────────────────

function trocoResolveSubHand(plays, manilhaValue, tombadoEffect = null) {
  const strOf = card => getTrocoCardStrength(card, manilhaValue, tombadoEffect)

  // In TM round: simple strength comparison (no special card tricks)
  if (tombadoEffect === 'truco_mineiro') {
    return resolveByStrength(plays, strOf)
  }

  const zap2Plays     = plays.filter(p => p.card.special === 'zap2')
  const coringa1Plays = plays.filter(p => p.card.special === 'coringa1')
  const restPlays     = plays.filter(p => !['zap2', 'coringa1'].includes(p.card.special))

  // Zap 2 + Coringa 1 both in play → they tie (Rule III/IV)
  if (zap2Plays.length > 0 && coringa1Plays.length > 0) {
    const topTeams = new Set([...zap2Plays, ...coringa1Plays].map(p => p.team))
    return topTeams.size === 1 ? [...topTeams][0] : null
  }

  // Only Zap 2
  if (zap2Plays.length > 0) {
    const teams = new Set(zap2Plays.map(p => p.team))
    return teams.size === 1 ? [...teams][0] : null
  }

  // Only Coringa 1: loses to normal cards (strength 0-9)
  if (coringa1Plays.length > 0) {
    const normalCards = restPlays.filter(p => strOf(p.card) <= 9)
    if (normalCards.length > 0) {
      return resolveByStrength(restPlays, strOf) // Coringa 1 excluded = irrelevant
    }
    // No normal cards → Coringa 1 beats variable manilhas
    const c1Teams = new Set(coringa1Plays.map(p => p.team))
    return c1Teams.size === 1 ? [...c1Teams][0] : null
  }

  return resolveByStrength(plays, strOf)
}

function resolveByStrength(plays, strFn) {
  let max = -Infinity
  const bestTeams = new Set()
  for (const p of plays) {
    const s = strFn(p.card)
    if (s > max) { max = s; bestTeams.clear(); bestTeams.add(p.team) }
    else if (s === max) bestTeams.add(p.team)
  }
  return bestTeams.size === 1 ? [...bestTeams][0] : null
}

// ── Trinca detection ──────────────────────────────────────────────────────

// A trinca is 3 cards of the same value in one hand.
// Coringa 1 can complete a pair into a trinca.
function detectTrincas(hands) {
  const found = []

  for (const [playerId, hand] of Object.entries(hands)) {
    const hasCoringa1 = hand.some(c => c.special === 'coringa1')
    const counts = {}

    for (const card of hand) {
      if (card.special === 'coringa1') continue
      counts[card.value] = (counts[card.value] || 0) + 1
    }

    for (const [value, count] of Object.entries(counts)) {
      if (count >= 3) {
        found.push({ playerId, value, completedByCoringa: false })
      } else if (count === 2 && hasCoringa1) {
        found.push({ playerId, value, completedByCoringa: true })
      }
    }
  }

  return found
}

// Applies the immediate score/hand effect of a trinca.
// Returns { scoreChange: [teamDelta, opponentDelta], swap: bool }
function getTrincaEffect(value) {
  switch (value) {
    case 'A': return { scoreChange: null, swap: true,  message: 'Trinca de Ás! Pode escolher nova mão.' }
    case '7': return { scoreChange: [1, 0],  swap: false, message: 'Trinca de 7! +1 ponto para o time.' }
    case 'J': return { scoreChange: [-2, 0], swap: false, message: 'Trinca de J! -2 pontos para o time.' }
    case '6': return { scoreChange: [0, 12], swap: false, message: 'Trinca de 6! +12 pontos para o adversário 😱' }
    default:  return { scoreChange: null,    swap: true,  message: `Trinca de ${value}! Trocando mão.` }
  }
}

// ── Quadra detection — all 4 players have the same card value ────────────
// Returns the value that forms the quadra, or null
function detectQuadra(hands) {
  const playerIds = Object.keys(hands)
  if (playerIds.length < 4) return null

  // Count occurrences of each value across all hands
  const valueCounts = {}
  for (const hand of Object.values(hands)) {
    for (const card of hand) {
      if (card.special) continue
      valueCounts[card.value] = (valueCounts[card.value] || 0) + 1
    }
  }

  // Quadra: any value appears exactly 4 times distributed across all players
  // (each player has exactly one of that value)
  for (const [value, count] of Object.entries(valueCounts)) {
    if (count === 4) {
      const allHaveIt = playerIds.every(pid =>
        hands[pid].some(c => c.value === value && !c.special)
      )
      if (allHaveIt) return value
    }
  }
  return null
}

// ── Sequência detection ───────────────────────────────────────────────────

const SEQ_VALUES = VALUES // 4,5,6,7,Q,J,K,A,2,3

function detectSequencia(hand, manilhaValue) {
  const normal = hand
    .filter(c => !c.special && c.value !== manilhaValue)
    .map(c => SEQ_VALUES.indexOf(c.value))
    .filter(i => i >= 0)
    .sort((a, b) => a - b)

  for (let i = 0; i + 1 < normal.length; i++) {
    if (normal[i + 1] - normal[i] === 1) {
      if (i + 2 < normal.length && normal[i + 2] - normal[i + 1] === 1) return true
    }
  }
  return false
}

// Royal sequence (Q, J, K) — Rule XVIII
function isSequenciaReal(hand) {
  const vals = new Set(hand.filter(c => !c.special).map(c => c.value))
  return vals.has('Q') && vals.has('J') && vals.has('K')
}

module.exports = {
  createTrocoDeck,
  getTrocoManilhaValue,
  getTombadoEffect,
  trocoResolveSubHand,
  detectTrincas,
  detectQuadra,
  getTrincaEffect,
  detectSequencia,
  isSequenciaReal,
  TM_MANILHAS,
  ZAP2, CORINGA1, CORINGA2, ESPADA_ESPADA,
}
