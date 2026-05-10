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
    if (h0 === null && h1 !== null) return h1  // first draw -> second decides
    if (h0 !== null && h0 === h1) return h0    // same team wins first two
  }
  if (n < 3) return undefined

  // All 3 played
  const w0 = results.filter(r => r === 0).length
  const w1 = results.filter(r => r === 1).length
  if (w0 > w1) return 0
  if (w1 > w0) return 1
  return maoTeam // all draws or equal -> mão wins
}

module.exports = { getManilhaValue, getCardStrength, resolveSubHand, resolveRound, MANILHA_SUIT_RANK }
