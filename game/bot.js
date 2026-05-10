const { getCardStrength } = require('./rules')

// Simple bot AI — plays weakest winning card, otherwise weakest card overall
function chooseBotCard(hand, table, manilhaValue, myTeam) {
  if (hand.length === 0) return null

  const strengths = hand.map(c => ({ card: c, str: getCardStrength(c, manilhaValue) }))

  // Find highest card already on table from opponent
  const opponentPlays = table.filter(p => p.team !== myTeam)
  const bestOpponent = opponentPlays.reduce((max, p) => {
    const s = getCardStrength(p.card, manilhaValue)
    return s > max ? s : max
  }, -1)

  // Try to win with the weakest card that beats the opponent
  const winners = strengths.filter(({ str }) => str > bestOpponent).sort((a, b) => a.str - b.str)
  if (winners.length > 0) return winners[0].card

  // Can't win: play weakest card
  return strengths.sort((a, b) => a.str - b.str)[0].card
}

function decideTrucoResponse(hand, manilhaValue) {
  const hasManilha = hand.some(c => getCardStrength(c, manilhaValue) >= 10)
  const strongCards = hand.filter(c => getCardStrength(c, manilhaValue) >= 7).length
  if (hasManilha || strongCards >= 2) return 'accept'
  return 'run'
}

function shouldCallTruco(hand, manilhaValue) {
  const manilhas = hand.filter(c => getCardStrength(c, manilhaValue) >= 10).length
  const strong = hand.filter(c => getCardStrength(c, manilhaValue) >= 8).length
  return manilhas >= 1 || strong >= 2
}

module.exports = { chooseBotCard, decideTrucoResponse, shouldCallTruco }
