const SUITS = ['clubs', 'hearts', 'spades', 'diamonds']
const VALUES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3']

function createDeck() {
  const cards = []
  for (const suit of SUITS) {
    for (const value of VALUES) {
      cards.push({ id: `${value}_${suit}`, value, suit })
    }
  }
  return cards
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

module.exports = { SUITS, VALUES, createDeck, shuffle }
