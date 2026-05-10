const { createDeck, shuffle } = require('./deck')
const { getManilhaValue, getCardStrength, resolveSubHand, resolveRound } = require('./rules')
const {
  createTrocoDeck,
  getTrocoManilhaValue,
  getTombadoEffect,
  getTrocoCardStrength,
  trocoResolveSubHand,
  detectTrincas,
  detectQuadra,
  getTrincaEffect,
  detectSequencia,
  isSequenciaReal,
} = require('./troco')

const TRUCO_VALUES = [1, 3, 6, 9, 12]
const WIN_LIMIT = { truco: 12, troco: 24 }

class GameEngine {
  constructor(players, mode = 'truco') {
    this.players  = players   // [{ id, name, team, isBot }]
    this.mode     = mode
    this.scores   = [0, 0]
    this.maoIndex = 0
    this.roundNum = 0
    this.g        = null
  }

  get isTroco() { return this.mode === 'troco' }
  get limit()   { return WIN_LIMIT[this.mode] }

  // ─── Public API ─────────────────────────────────────────────────────────

  startRound() {
    const deck = shuffle(this.isTroco ? createTrocoDeck() : createDeck())
    const vira = deck.pop()

    const manilhaValue = this.isTroco
      ? getTrocoManilhaValue(vira)
      : getManilhaValue(vira)

    const tombadoEffect = this.isTroco ? getTombadoEffect(vira, new Date().getDay() === 2) : null

    const turnOrder = Array.from({ length: 4 }, (_, i) =>
      this.players[(this.maoIndex + i) % 4].id
    )

    const hands = {}
    for (const pid of turnOrder) {
      hands[pid] = [deck.pop(), deck.pop(), deck.pop()]
    }

    this.g = {
      phase: 'playing',
      vira,
      manilhaValue,
      tombadoEffect,
      deck,
      hands,
      table: [],
      lastResolvedTable: [],
      history: [],
      subHandResults: [],
      turnOrder,
      turnIdx: 0,
      trucoLevel: 0,
      pendingTruco: null,
      roundValue: TRUCO_VALUES[0],
      maoTeam: this.players[this.maoIndex].team,
      trincas: [],
      sequencias: [],
      royalSequencia: [],
      sixAndSeven: {},     // { [playerId]: true } — private, never broadcast raw
      partnerSignaled: {}, // { [signalerId]: partnerId } — who signaled whom
    }

    // ── Troço: detect trincas, sequências, 6+7 after dealing ──
    const extraEvents = []
    if (this.isTroco) {
      // Rule VIII: Tombo de manilha do TM → each hand passes to next player counter-clockwise
      const TM_MANILHAS = [
        { value: '7', suit: 'diamonds' },
        { value: 'A', suit: 'spades' },
        { value: '7', suit: 'hearts' },
        { value: '4', suit: 'clubs' },
      ]
      if (TM_MANILHAS.some(m => m.value === vira.value && m.suit === vira.suit)) {
        const [p0, p1, p2, p3] = turnOrder
        const old = { ...this.g.hands }
        this.g.hands[p0] = old[p1]
        this.g.hands[p1] = old[p2]
        this.g.hands[p2] = old[p3]
        this.g.hands[p3] = old[p0]
        extraEvents.push({
          type: 'hands_rotated',
          message: '🔄 Manilha do TM tombada! As mãos foram passadas pro próximo jogador.',
          scores: [...this.scores],
        })
      }

      extraEvents.push(...this._detectAndApplyTrincas())
      extraEvents.push(...this._detectAsVermelho3())
      this._detectSequencias()
      this._detectSixAndSeven()

      // Rule I — Quadra: todos os 4 jogadores têm a mesma carta → rodada vale (24 - max_score)
      const quadraValue = detectQuadra(this.g.hands)
      if (quadraValue) {
        const maxScore = Math.max(this.scores[0], this.scores[1])
        const quadraPoints = Math.max(1, 24 - maxScore)
        this.g.roundValue = quadraPoints
        this.g.trucoLevel = 4 // bloqueia truco
        this.g.quadra = quadraValue
        extraEvents.unshift({
          type: 'quadra',
          value: quadraValue,
          points: quadraPoints,
          message: `🃏 QUADRA de ${quadraValue}! Todos têm essa carta — rodada vale ${quadraPoints} pontos!`,
          scores: [...this.scores],
        })
      }

      // Rule XIV: Mão de 23 — se algum time tem exatamente 23pts, rodada vale 5 fixo
      this.g.maoVinte3 = this.scores[0] === 23 || this.scores[1] === 23
      if (this.g.maoVinte3) {
        this.g.roundValue = 5
        this.g.trucoLevel = 4 // bloqueia chamada de truco
        extraEvents.unshift({
          type: 'mao_vinte3',
          message: '🔥 Mão de 23! Rodada vale 5 pontos fixos.',
          scores: [...this.scores],
        })
      }

      // Rule XI: time com >12pts pode trocar o tombo (antes de ver as cartas)
      const qualifyingTeam = this.scores[0] > 12 ? 0 : this.scores[1] > 12 ? 1 : null
      this.g.tombadoSwapTeam = qualifyingTeam

      // Rule XIII: Ambos os times com 11pts → rodada no escuro
      this.g.maoEscura = this.scores[0] === 11 && this.scores[1] === 11
      if (this.g.maoEscura) {
        extraEvents.unshift({
          type: 'mao_escura',
          message: '🌑 Mão Escura! Ambos os times com 11pts — joguem sem ver as cartas!',
          scores: [...this.scores],
        })
      }
    }

    return this._ok('round_started', {
      vira,
      manilhaValue,
      tombadoEffect,
      turnOrder,
      trincas: this.g.trincas,
      extraEvents,
      maoVinte3: !!this.g.maoVinte3,
      maoEscura: !!this.g.maoEscura,
      blackjackRound: !!this.g.blackjackRound,
    })
  }

  // Rule XVIII: resolve blackjack — individual totals, closest to 21 wins
  resolveBlackjack() {
    const { g } = this
    if (!g || !g.blackjackRound) return this._err('Não é uma rodada blackjack')

    const cardValue = (card) => {
      if (!card || card.special) return 0
      if (['J', 'Q', 'K'].includes(card.value)) return 10
      if (card.value === 'A') return 1
      const n = parseInt(card.value)
      return isNaN(n) ? 0 : n
    }

    const playerTotals = {}
    for (const player of this.players) {
      const hand = g.hands[player.id] || []
      playerTotals[player.id] = hand.reduce((sum, c) => sum + cardValue(c), 0)
    }

    // Individual: melhor jogador ≤21 vence; todos passaram → menor total vence
    const nonBust = Object.entries(playerTotals).filter(([, t]) => t <= 21)
    let winner = null
    if (nonBust.length > 0) {
      const bestVal = Math.max(...nonBust.map(([, t]) => t))
      const best = nonBust.filter(([, t]) => t === bestVal)
      const teams = new Set(best.map(([pid]) => this._teamOf(pid)))
      winner = teams.size === 1 ? [...teams][0] : null
    } else {
      const bestVal = Math.min(...Object.values(playerTotals))
      const best = Object.entries(playerTotals).filter(([, t]) => t === bestVal)
      const teams = new Set(best.map(([pid]) => this._teamOf(pid)))
      winner = teams.size === 1 ? [...teams][0] : null
    }

    const teamTotals = [0, 0]
    for (const player of this.players) teamTotals[player.team] += playerTotals[player.id]

    const pts = g.roundValue
    if (winner !== null) this.scores[winner] += pts
    g.phase = 'round_end'
    this.maoIndex = (this.maoIndex + 1) % 4
    this.roundNum++

    const gameWinner = this.scores[0] >= this.limit ? 0
      : this.scores[1] >= this.limit ? 1 : null
    if (gameWinner !== null) g.phase = 'game_end'

    return this._ok('round_end', {
      winnerTeam: winner,
      points: pts,
      blackjack: true,
      teamTotals,
      playerTotals,
      scores: [...this.scores],
      gameWinner,
    })
  }

  runMao23(playerId) {
    const { g } = this
    if (!g?.maoVinte3) return this._err('Não é mão de 23')
    if (g.phase !== 'playing') return this._err('Não é possível correr agora')
    const runnerTeam = this._teamOf(playerId)
    const winnerTeam = runnerTeam === 0 ? 1 : 0
    return this._forfeitRound(winnerTeam, g.roundValue, 'run')
  }

  playCard(playerId, cardId) {
    const { g } = this
    if (g?.phase !== 'playing') return this._err('Not in playing phase')
    if (g.blackjackRound) return this._err('Rodada blackjack — aguarde a resolução automática')
    if (this.currentPlayerId() !== playerId) return this._err('Not your turn')

    const hand = g.hands[playerId]
    const idx = hand.findIndex(c => c.id === cardId)
    if (idx === -1) return this._err('Card not in hand')

    // Quando a 1ª mão mela, obrigatório jogar a mais forte
    if (g.subHandResults.length === 1 && g.subHandResults[0] === null) {
      const strongest = hand.reduce((best, c) => this._cardStrength(c) > this._cardStrength(best) ? c : best)
      if (cardId !== strongest.id) return this._err('Primeira mão melou — jogue sua carta mais forte!')
    }

    const [card] = hand.splice(idx, 1)
    g.trucoCalledBy = null
    const team = this._teamOf(playerId)

    // Rule V: Coringa 2 → revela a próxima carta do baralho
    let effectiveCard = card
    let coringa2Drawn = null
    if (this.isTroco && card.special === 'coringa2') {
      const drawn = g.deck.pop()
      if (drawn) {
        effectiveCard = { ...drawn, drawnByCoringa2: true }
        coringa2Drawn = effectiveCard
      }
    }

    g.table.push({ playerId, card: effectiveCard, team })
    g.turnIdx++

    if (g.table.length === 4) return this._resolveSubHand()

    return this._ok('card_played', { playerId, card: effectiveCard, coringa2Drawn, nextPlayer: this.currentPlayerId() })
  }

  // ── Rule XIX: Invictus ────────────────────────────────────────────────

  signalPartner(playerId) {
    const { g } = this
    if (!g || g.phase !== 'playing') return this._err('Not in playing phase')
    if (!g.sixAndSeven[playerId]) return this._err('Você não tem 6 e 7 na mão')

    const myTeam = this._teamOf(playerId)
    const partner = this.players.find(p => p.team === myTeam && p.id !== playerId)
    if (!partner) return this._err('Sem parceiro')

    g.partnerSignaled[playerId] = partner.id
    return { ok: true, type: 'partner_signaled', partnerId: partner.id, signalerId: playerId }
  }

  callInvictus(playerId) {
    const { g } = this
    if (!g || !['playing', 'truco_call'].includes(g.phase)) return this._err('Não é possível chamar Invictus agora')

    const callerTeam = this._teamOf(playerId)
    const opponentTeam = callerTeam === 0 ? 1 : 0

    // Check if ANY player on the opposing team has 6+7
    const opponentHas67 = this.players
      .filter(p => p.team === opponentTeam)
      .some(p => g.sixAndSeven[p.id])

    const pts = g.roundValue

    if (opponentHas67) {
      // Confirmed: points go to Invictus caller's team
      const msg = `✅ Invictus confirmado! Time ${callerTeam + 1} leva ${pts}pt(s).`
      return this._forfeitRound(callerTeam, pts, 'invictus_confirmed', msg)
    } else {
      // Wrong call: points go to opponent
      const msg = `❌ Invictus errado! Time ${opponentTeam + 1} leva ${pts}pt(s).`
      return this._forfeitRound(opponentTeam, pts, 'invictus_wrong', msg)
    }
  }

  hasSixAndSeven(playerId) {
    return !!this.g?.sixAndSeven[playerId]
  }

  callTruco(playerId) {
    const { g } = this
    if (g?.phase !== 'playing') return this._err('Cannot call truco now')
    if (g.pendingTruco) return this._err('Truco already pending')
    if (this.currentPlayerId() !== playerId) return this._err('Só pode pedir truco na sua vez')
    if (g.trucoCalledBy === playerId) return this._err('Já pediu truco nesta vez — jogue uma carta primeiro')

    const callerTeam = this._teamOf(playerId)
    const targetLevel = g.trucoLevel + 1
    if (targetLevel >= TRUCO_VALUES.length) return this._err('Already at maximum')

    g.trucoCalledBy = playerId
    g.pendingTruco = { calledBy: playerId, calledByTeam: callerTeam, targetLevel, firstCaller: playerId }
    g.phase = 'truco_call'

    return this._ok('truco_called', {
      calledBy: playerId,
      calledByTeam: callerTeam,
      targetLevel,
      targetValue: TRUCO_VALUES[targetLevel],
    })
  }

  respondTruco(playerId, response) {
    const { g } = this
    if (g?.phase !== 'truco_call') return this._err('No pending truco call')

    const responderTeam = this._teamOf(playerId)
    if (responderTeam === g.pendingTruco.calledByTeam) return this._err('Your team called truco')

    const { targetLevel, calledByTeam } = g.pendingTruco

    if (response === 'run') {
      // ── Troço Rule II: sequência holders get 3 pts if opponent runs ──
      if (this.isTroco) {
        const seqCheck = this._checkSequenciaOnRun(calledByTeam)
        if (seqCheck) return seqCheck
      }
      return this._forfeitRound(calledByTeam, g.roundValue, 'run')
    }

    if (response === 'accept') {
      g.trucoLevel = targetLevel
      g.roundValue = TRUCO_VALUES[targetLevel]
      g.pendingTruco = null
      g.phase = 'playing'
      return this._ok('truco_accepted', { level: targetLevel, value: g.roundValue, nextPlayer: this.currentPlayerId() })
    }

    if (response === 'raise') {
      if (playerId === g.pendingTruco.firstCaller) return this._err('Você pediu truco — não pode pedir novamente')
      const nextLevel = targetLevel + 1
      if (nextLevel >= TRUCO_VALUES.length) return this._err('Cannot raise further')
      g.trucoLevel = targetLevel
      g.roundValue = TRUCO_VALUES[targetLevel]
      g.pendingTruco = { calledBy: playerId, calledByTeam: responderTeam, targetLevel: nextLevel, firstCaller: g.pendingTruco.firstCaller }
      return this._ok('truco_raised', {
        calledBy: playerId,
        calledByTeam: responderTeam,
        acceptedLevel: targetLevel,
        targetLevel: nextLevel,
        targetValue: TRUCO_VALUES[nextLevel],
      })
    }

    return this._err('Invalid response')
  }

  getStateFor(playerId) {
    const { g } = this
    if (!g) return { phase: 'idle', scores: this.scores }

    const hand = g.hands[playerId] || []
    const isDark = g.tombadoEffect === 'dark' || !!g.maoEscura
    const myTeam = this._teamOf(playerId)

    // Sequência is secret — only the holding team sees it
    const seqTeams = new Set(g.sequencias.map(pid => this._teamOf(pid)))
    const myTeamHasSeq = seqTeams.has(myTeam)
    const visibleSequencias = g.sequencias.filter(pid => this._teamOf(pid) === myTeam)
    const visibleRoyalSeq  = g.royalSequencia.filter(pid => this._teamOf(pid) === myTeam)
    // Hide the boosted round value from opponents (they just see 1 until scoring)
    const visibleRoundValue = (g.sequencias.length > 0 && !myTeamHasSeq) ? 1 : g.roundValue

    return {
      phase: g.phase,
      vira: g.vira,
      manilhaValue: g.manilhaValue,
      tombadoEffect: g.tombadoEffect,
      hand: isDark ? hand.map(c => ({ ...c, hidden: true })) : hand,
      isDark,
      maoEscura: !!g.maoEscura,
      maoVinte3: !!g.maoVinte3,
      handCounts: Object.fromEntries(Object.entries(g.hands).map(([pid, h]) => [pid, h.length])),
      table: g.table.length > 0 ? g.table : (g.lastResolvedTable ?? []),
      tombadoSwapTeam: g.tombadoSwapTeam ?? null,
      tombadoSwapped: !!g.tombadoSwapped,
      quadra: g.quadra ?? null,
      history: g.history,
      subHandResults: g.subHandResults,
      currentPlayer: this.currentPlayerId(),
      turnOrder: g.turnOrder,
      trucoLevel: g.trucoLevel,
      pendingTruco: g.pendingTruco,
      roundValue: visibleRoundValue,
      scores: [...this.scores],
      maoTeam: g.maoTeam,
      roundNum: this.roundNum,
      trincas: g.trincas,
      sequencias: visibleSequencias,
      royalSequencia: visibleRoyalSeq,
      hasSequencia: g.sequencias.includes(playerId),
      hasSixAndSeven: !!g.sixAndSeven[playerId],
      partnerSignaledMe: Object.values(g.partnerSignaled).includes(playerId),
      sixAndSevenActive: Object.keys(g.sixAndSeven).length > 0,
      blackjackRound: !!g.blackjackRound,
      mode: this.mode,
      limit: this.limit,
    }
  }

  _cardStrength(card) {
    const { g } = this
    if (this.isTroco) return getTrocoCardStrength(card, g.manilhaValue, g.tombadoEffect)
    return getCardStrength(card, g.manilhaValue)
  }

  currentPlayerId() {
    const { g } = this
    if (!g || g.phase !== 'playing') return null
    return g.turnOrder[g.turnIdx % 4]
  }

  isBot(playerId)  { return this.players.find(p => p.id === playerId)?.isBot ?? false }
  getPlayers()     { return this.players }
  getScores()      { return [...this.scores] }
  getPhase()       { return this.g?.phase ?? 'idle' }
  isGameOver()     { return this.g?.phase === 'game_end' }

  // ─── Internal ────────────────────────────────────────────────────────────

  _resolveSubHand() {
    const { g } = this

    const winner = this.isTroco
      ? trocoResolveSubHand(g.table, g.manilhaValue, g.tombadoEffect)
      : resolveSubHand(g.table, g.manilhaValue)

    const plays = [...g.table]
    g.subHandResults.push(winner)
    g.history.push({ plays, winner, subHandIdx: g.subHandResults.length - 1 })
    g.lastResolvedTable = plays
    g.table = []

    if (winner !== null) {
      const winnerPlays = plays.filter(p => p.team === winner)
      const strongest = winnerPlays.reduce((best, p) =>
        this._cardStrength(p.card) > this._cardStrength(best.card) ? p : best
      )
      const rotIdx = g.turnOrder.indexOf(strongest.playerId)
      g.turnOrder = [...g.turnOrder.slice(rotIdx), ...g.turnOrder.slice(0, rotIdx)]
    }
    g.turnIdx = 0

    const roundWinner = resolveRound(g.subHandResults, g.maoTeam)
    if (roundWinner !== undefined) return this._endRound(roundWinner, plays, winner)

    return this._ok('sub_hand_result', {
      subHandIdx: g.subHandResults.length - 1,
      winner,
      plays,
      nextPlayer: this.currentPlayerId(),
    })
  }

  _endRound(winnerTeam, lastPlays, lastSubHandWinner) {
    const { g } = this
    const pts = g.roundValue

    // ── Rule XIX: 6+7 → loser gets the points ────────────────────────────
    const sixSevenTeam = this._getSixAndSevenTeam()
    let reversed67 = false
    let effectiveWinner = winnerTeam

    if (this.isTroco && sixSevenTeam !== null && winnerTeam !== null && winnerTeam !== sixSevenTeam) {
      // 6+7 team PERDEU a rodada → "perde e leva" — eles ficam com os pontos
      effectiveWinner = sixSevenTeam
      reversed67 = true
    }

    // ── Rule X: first sub-hand draw → winner steals from opponent ────────
    let reversed = false
    if (this.isTroco && g.subHandResults[0] === null && effectiveWinner !== null && !reversed67) {
      reversed = true
    }

    if (reversed) {
      const losingTeam = effectiveWinner === 0 ? 1 : 0
      this.scores[losingTeam] = Math.max(-99, this.scores[losingTeam] - pts)
    } else if (effectiveWinner !== null) {
      this.scores[effectiveWinner] += pts
    }

    g.phase = 'round_end'
    this.maoIndex = (this.maoIndex + 1) % 4
    this.roundNum++

    const gameWinner = this.scores[0] >= this.limit ? 0
      : this.scores[1] >= this.limit ? 1 : null
    if (gameWinner !== null) g.phase = 'game_end'

    return this._ok('round_end', {
      winnerTeam: effectiveWinner,
      originalWinner: winnerTeam,
      points: pts,
      reversed,
      reversed67,
      scores: [...this.scores],
      gameWinner,
      lastSubHand: { plays: lastPlays, winner: lastSubHandWinner },
    })
  }

  _forfeitRound(winnerTeam, pts, reason, message = null) {
    const { g } = this
    this.scores[winnerTeam] += pts
    g.phase = 'round_end'
    this.maoIndex = (this.maoIndex + 1) % 4
    this.roundNum++

    const gameWinner = this.scores[0] >= this.limit ? 0 : this.scores[1] >= this.limit ? 1 : null
    if (gameWinner !== null) g.phase = 'game_end'

    return this._ok('round_end', { winnerTeam, points: pts, scores: [...this.scores], gameWinner, reason, message })
  }

  // ── Troço-specific helpers ───────────────────────────────────────────────

  _detectAndApplyTrincas() {
    const { g } = this
    const found = detectTrincas(g.hands)
    const events = []

    for (const trinca of found) {
      const playerTeam = this._teamOf(trinca.playerId)
      const opponentTeam = playerTeam === 0 ? 1 : 0
      const effect = getTrincaEffect(trinca.value)

      // Apply score effects immediately
      if (effect.scoreChange) {
        const [own, opp] = effect.scoreChange
        this.scores[playerTeam]  = Math.max(-99, this.scores[playerTeam]  + own)
        this.scores[opponentTeam] = Math.max(-99, this.scores[opponentTeam] + opp)
      }

      // Auto-swap hand (for Ás and others that would let player choose)
      if (effect.swap) {
        const newHand = [g.deck.pop(), g.deck.pop(), g.deck.pop()].filter(Boolean)
        if (newHand.length === 3) g.hands[trinca.playerId] = newHand
      }

      g.trincas.push({ ...trinca, effect: effect.message })
      events.push({
        type: 'trinca',
        playerId: trinca.playerId,
        value: trinca.value,
        completedByCoringa: trinca.completedByCoringa,
        message: effect.message,
        scores: [...this.scores],
      })
    }

    // Check: both players of same team have a trinca → score goes to 23
    const teamTrincaCounts = {}
    for (const t of found) {
      const team = this._teamOf(t.playerId)
      teamTrincaCounts[team] = (teamTrincaCounts[team] || new Set())
      teamTrincaCounts[team].add(t.playerId)
    }
    for (const [team, players] of Object.entries(teamTrincaCounts)) {
      if (players.size >= 2) {
        this.scores[team] = 23
        events.push({
          type: 'double_trinca',
          team: parseInt(team),
          message: 'Dupla trinca no mesmo time! Pontuação vai pra 23!',
          scores: [...this.scores],
        })
      }
    }

    return events
  }

  // Rule XV: Ás + 3 Vermelho na mesma mão → rouba 3pts do adversário e troca a mão
  _detectAsVermelho3() {
    const { g } = this
    const events = []
    for (const [pid, hand] of Object.entries(g.hands)) {
      const hasAs   = hand.some(c => c.value === 'A' && !c.special)
      const hasRed3 = hand.some(c => c.value === '3' && (c.suit === 'hearts' || c.suit === 'diamonds'))
      if (!hasAs || !hasRed3) continue

      const playerTeam = this._teamOf(pid)
      const oppTeam    = playerTeam === 0 ? 1 : 0
      this.scores[oppTeam] = Math.max(-99, this.scores[oppTeam] - 3)

      const newHand = [g.deck.pop(), g.deck.pop(), g.deck.pop()].filter(Boolean)
      if (newHand.length === 3) g.hands[pid] = newHand

      events.push({
        type: 'as_vermelho3',
        playerId: pid,
        message: `Ás + 3 Vermelho! Time ${playerTeam + 1} tirou 3pts do adversário e recebeu nova mão.`,
        scores: [...this.scores],
      })
    }
    return events
  }

  _detectSixAndSeven() {
    const { g } = this
    for (const [pid, hand] of Object.entries(g.hands)) {
      const hasSix  = hand.some(c => c.value === '6' && !c.special)
      const hasSeven = hand.some(c => c.value === '7' && !c.special)
      if (hasSix && hasSeven) g.sixAndSeven[pid] = true
    }
  }

  _getSixAndSevenTeam() {
    const { g } = this
    const pid = Object.keys(g.sixAndSeven)[0]
    return pid ? this._teamOf(pid) : null
  }

  _detectSequencias() {
    const { g } = this
    for (const [playerId, hand] of Object.entries(g.hands)) {
      if (detectSequencia(hand, g.manilhaValue)) {
        g.sequencias.push(playerId)
        // Rule II: round automatically worth 12, but not announced
        g.roundValue = 12
        g.trucoLevel = 4 // block further escalation
      }
      if (isSequenciaReal(hand)) {
        g.royalSequencia.push(playerId)
      }
    }
    // Rule XVIII: any player has sequência real → round becomes blackjack
    if (g.royalSequencia.length > 0) {
      g.blackjackRound = true
      g.trucoLevel = 4 // block truco escalation
    }
  }

  _checkSequenciaOnRun(callerTeam) {
    const { g } = this
    const seqTeams = g.sequencias.map(pid => this._teamOf(pid))
    // If the opposing team (the one that ran/sixed) is NOT the one with sequência,
    // the sequência team gets 3 points
    const seqTeam = seqTeams.find(t => t !== callerTeam)
    if (seqTeam !== undefined) {
      return this._forfeitRound(seqTeam, 3, 'sequencia_opponent_ran')
    }
    return null
  }

  // Rule XI: swap tombado — called by a player on the qualifying team
  swapTombado(playerId) {
    const { g } = this
    if (!g || g.phase !== 'playing') return this._err('Rodada não iniciada')
    if (g.tombadoSwapTeam === null) return this._err('Nenhum time qualifica para trocar o tombo')
    if (this._teamOf(playerId) !== g.tombadoSwapTeam) return this._err('Seu time não pode trocar o tombo')
    if (g.tombadoSwapped) return this._err('Tombo já trocado nesta rodada')

    const originalVira = g.vira
    const newVira = g.deck.pop()
    if (!newVira) return this._err('Baralho sem cartas para trocar')

    g.tombadoSwapped = true
    g.tombadoSwapTeam = null  // consume the offer
    g.vira = newVira
    g.manilhaValue = getTrocoManilhaValue(newVira)
    g.tombadoEffect = getTombadoEffect(newVira, new Date().getDay() === 2)

    const isCurtinho = (newVira.value === originalVira.value && newVira.suit === originalVira.suit)

    if (isCurtinho) {
      // O Curtinho: each team picks top card, show to opponent, auto-resolve for bots
      const teams = [0, 1]
      const curtinhoCards = {}
      for (const team of teams) {
        const teamPlayers = this.players.filter(p => p.team === team)
        const rep = teamPlayers[0] // first player represents the team
        const hand = g.hands[rep.id]
        if (hand && hand.length > 0) curtinhoCards[team] = hand[0]
      }
      // Resolve O Curtinho: compare strengths
      const getStrength = (card) => {
        if (!card) return 0
        const vals = { '3': 10, '2': 9, 'A': 8, 'K': 7, 'J': 6, 'Q': 5, '7': 4, '6': 3, '5': 2, '4': 1 }
        return vals[card.value] || 0
      }
      const s0 = getStrength(curtinhoCards[0])
      const s1 = getStrength(curtinhoCards[1])
      let curtinhoWinner = null
      if (s0 > s1) curtinhoWinner = 0
      else if (s1 > s0) curtinhoWinner = 1

      if (curtinhoWinner !== null) {
        this.scores[curtinhoWinner] += 2
      }

      return this._ok('tombado_swapped', {
        originalVira,
        newVira,
        newManilha: g.manilhaValue,
        newTombadoEffect: g.tombadoEffect,
        curtinho: true,
        curtinhoWinner,
        curtinhoCards,
        message: curtinhoWinner !== null
          ? `🎯 O Curtinho! Novo tombo igual! Time ${curtinhoWinner + 1} levou 2pts.`
          : `🤝 O Curtinho! Empate — nenhum ponto.`,
        scores: [...this.scores],
      })
    }

    return this._ok('tombado_swapped', {
      originalVira,
      newVira,
      newManilha: g.manilhaValue,
      newTombadoEffect: g.tombadoEffect,
      curtinho: false,
      message: `🔄 Tombo trocado! Novo vira: ${newVira.value} de ${newVira.suit}`,
      scores: [...this.scores],
    })
  }

  _teamOf(playerId) {
    return this.players.find(p => p.id === playerId)?.team
  }

  _ok(type, data = {}) {
    return { ok: true, type, scores: [...this.scores], phase: this.g?.phase, ...data }
  }

  _err(message) {
    return { ok: false, type: 'error', message }
  }
}

module.exports = { GameEngine, TRUCO_VALUES }
