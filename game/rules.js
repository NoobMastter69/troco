const { VALUES } = require('./deck')

// Suit strength for manilhas: strongest to weakest
const MANILHA_SUIT_RANK = { clubs: 3, hearts: 2, spades: 1, diamonds: 0 }

function getManilhaValue(vira) {
  return VALUES[(VALUES.indexOf(vira.value) + 1) % VALUES.length]
}

function getCardStrength(card, manilhaValue) {
  if (card.value === manilhaValue) {
    return 10 + MANILHA_SUIT_RANK[card.suit]
  }
  return VALUES.indexOf(card.value)
}

// Returns winning team (0 or 1), or null for draw
function resolveSubHand(plays, manilhaValue) {
  let maxStr = -1
  const bestTeams = new Set()
  for (const p of plays) {
    const s = getCardStrength(p.card, manilhaValue)
    if (s > maxStr) { maxStr = s; bestTeams.clear(); bestTeams.add(p.team) }
    else if (s === maxStr) bestTeams.add(p.team)
  }
  return bestTeams.size === 1 ? [...bestTeams][0] : null
}

// Returns winning team (0 or 1), or undefined if round isn't over yet
function resolveRound(results, maoTeam) {
  const n = results.length
  if (n === 0) return undefined

  const [h0, h1, h2] = results

  if (n >= 2) {
    if (h0 !== null && h1 === null) return h0  // 2ª mela → quem fez a 1ª vence
    if (h0 === null && h1 !== null) return h1  // 1ª mela → 2ª decide
    if (h0 !== null && h0 === h1)  return h0  // mesmo time vence as duas primeiras
  }
  if (n < 3) return undefined

  // 3ª mão jogada
  if (h2 === null) {
    // 3ª mela → quem venceu primeiro vence
    if (h0 !== null) return h0
    if (h1 !== null) return h1
    return maoTeam
  }

  const w0 = results.filter(r => r === 0).length
  const w1 = results.filter(r => r === 1).length
  if (w0 > w1) return 0
  if (w1 > w0) return 1
  return maoTeam
}

module.exports = { getManilhaValue, getCardStrength, resolveSubHand, resolveRound, MANILHA_SUIT_RANK }
