import type { Action, Card, GameState, Player, Stage } from './types'
import { createDeck, deal, shuffle } from './cards'
import { bestHandFrom, compareHandRank } from './handEval'
import { buildPots } from './sidePot.js'

export interface NewHandResult {
  state: GameState
  deck: Card[]
}

export function createInitialGameState(): GameState {
  const players: Player[] = [
    { id: 'you', name: '你', chips: 1000, bet: 0, holeCards: [], status: 'active', action: null },
    { id: 'ai1', name: 'AI-1', chips: 1000, bet: 0, holeCards: [], status: 'active', action: null },
    { id: 'ai2', name: 'AI-2', chips: 1000, bet: 0, holeCards: [], status: 'active', action: null },
    { id: 'ai3', name: 'AI-3', chips: 1000, bet: 0, holeCards: [], status: 'active', action: null },
    { id: 'ai4', name: 'AI-4', chips: 1000, bet: 0, holeCards: [], status: 'active', action: null },
    { id: 'ai5', name: 'AI-5', chips: 1000, bet: 0, holeCards: [], status: 'active', action: null },
  ]

  return {
    stage: 'end',
    players,
    communityCards: [],
    pot: 0,
    pots: [],
    handContributions: Array(players.length).fill(0),
    currentPlayerIndex: 0,
    dealerIndex: 0,
    smallBlind: 10,
    bigBlind: 20,
    lastRaise: 20,
    actedThisStreet: Array(players.length).fill(false),
    raiseLockedThisStreet: Array(players.length).fill(false),
  }
}

export function startNewHand(prev: GameState, rng: () => number = Math.random): NewHandResult {
  // IMPORTANT: `prev` may be a reactive Proxy from Pinia/Vue;
  // `structuredClone(prev)` will throw. We mutate in-place to reset hand state.
  const state: GameState = prev
  const n = state.players.length
  state.stage = 'preflop'
  state.communityCards = []
  state.pot = 0
  state.pots = []
  state.handContributions = Array(n).fill(0)
  state.lastRaise = state.bigBlind
  state.actedThisStreet = Array(n).fill(false)
  state.raiseLockedThisStreet = Array(n).fill(false)

  for (const p of state.players) {
    p.bet = 0
    p.holeCards = []
    p.status = p.chips <= 0 ? 'fold' : 'active'
    p.action = null
  }

  const button = state.dealerIndex % n
  const sbIndex = nextActiveIndex(state, button)
  const bbIndex = nextActiveIndex(state, sbIndex)

  let deck = shuffle(createDeck(), rng)

  // Deal hole cards: 2 each, starting from SB and going around
  let cursor = sbIndex
  for (let round = 0; round < 2; round += 1) {
    for (let dealt = 0; dealt < n; dealt += 1) {
      const p = state.players[cursor]
      if (p.status !== 'fold') {
        const r = deal(deck, 1)
        p.holeCards.push(r.cards[0])
        deck = r.deck
      }
      cursor = nextIndex(n, cursor)
    }
  }

  // Post blinds
  postBlind(state, sbIndex, state.smallBlind)
  postBlind(state, bbIndex, state.bigBlind)

  // Preflop: first to act is left of BB (UTG)
  state.currentPlayerIndex = nextActiveIndex(state, bbIndex)
  return { state, deck }
}

export function toCall(state: GameState, playerIndex: number): number {
  const currentBet = Math.max(...state.players.map((p) => p.bet))
  return Math.max(0, currentBet - state.players[playerIndex].bet)
}

export function minRaiseTo(state: GameState): number {
  const currentBet = Math.max(...state.players.map((p) => p.bet))
  return currentBet + Math.max(state.lastRaise, state.bigBlind)
}

export function applyAction(state: GameState, deck: Card[], playerIndex: number, action: Action): { state: GameState; deck: Card[] } {
  if (state.stage === 'showdown' || state.stage === 'end') return { state, deck }
  if (state.currentPlayerIndex !== playerIndex) return { state, deck }

  const p = state.players[playerIndex]
  if (p.status !== 'active') return { state, deck }

  const beforeCurrentBet = Math.max(...state.players.map((pl) => pl.bet))
  const prevLastRaise = state.lastRaise
  const prevMinRaiseSize = Math.max(prevLastRaise, state.bigBlind)

  // If this player has already acted and action has NOT been reopened due to an
  // incomplete all-in raise, they are not allowed to raise again this street.
  if ((action.type === 'raise' || action.type === 'allin') && state.raiseLockedThisStreet[playerIndex]) {
    action = { type: 'call' }
  }

  if (action.type === 'fold') {
    p.status = 'fold'
    p.action = 'fold'
    state.actedThisStreet[playerIndex] = true
    const winner = soleRemainingNotFoldedIndex(state)
    if (winner !== null) {
      state.players[winner].chips += state.pot
      state.stage = 'end'
      return { state, deck }
    }
  }

  if (action.type === 'call') {
    const need = toCall(state, playerIndex)
    const pay = Math.min(p.chips, need)
    p.chips -= pay
    p.bet += pay
    state.pot += pay
    state.handContributions[playerIndex] += pay
    p.action = need > 0 ? 'call' : 'call'
    if (p.chips === 0) p.status = 'allin'
    state.actedThisStreet[playerIndex] = true
  }

  if (action.type === 'raise') {
    const target = action.raiseTo ?? minRaiseTo(state)
    const clamped = Math.max(target, beforeCurrentBet + state.lastRaise)
    raiseTo(state, playerIndex, clamped)
    p.action = 'raise'
  }

  if (action.type === 'allin') {
    raiseTo(state, playerIndex, p.bet + p.chips)
    p.action = Math.max(...state.players.map((pl) => pl.bet)) > beforeCurrentBet ? 'raise' : 'call'
  }

  const afterCurrentBet = Math.max(...state.players.map((pl) => pl.bet))
  if (afterCurrentBet > beforeCurrentBet) {
    const raiseAmount = afterCurrentBet - beforeCurrentBet
    const isFullRaise = raiseAmount >= prevMinRaiseSize

    // Only a full raise updates the minimum raise size and reopens action.
    if (isFullRaise) {
      state.lastRaise = raiseAmount
      state.actedThisStreet = Array(state.players.length).fill(false)
      state.raiseLockedThisStreet = Array(state.players.length).fill(false)
      state.actedThisStreet[playerIndex] = true
    } else {
      // Incomplete all-in raise: do NOT change min-raise size and do NOT reopen action.
      // Players who already acted before this incomplete raise are now locked from re-raising.
      for (let i = 0; i < state.players.length; i += 1) {
        if (i === playerIndex) continue
        if (state.actedThisStreet[i]) state.raiseLockedThisStreet[i] = true
      }
    }
  }

  if (isBettingRoundComplete(state)) {
    if (allRemainingAreAllIn(state)) {
      ;({ state, deck } = runoutToShowdown(state, deck))
      return { state, deck }
    }
    ;({ state, deck } = advanceStage(state, deck))
    return { state, deck }
  }

  state.currentPlayerIndex = nextActiveIndex(state, playerIndex)
  return { state, deck }
}

export function determineWinnersAmong(state: GameState, candidateIndexes: readonly number[]): { winnerIndexes: number[]; ranks: Map<number, ReturnType<typeof bestHandFrom>> } {
  const ranks = new Map<number, ReturnType<typeof bestHandFrom>>()
  for (const i of candidateIndexes) {
    ranks.set(i, bestHandFrom([...state.players[i].holeCards, ...state.communityCards]))
  }
  let winners: number[] = []
  let best: ReturnType<typeof bestHandFrom> | null = null
  for (const i of candidateIndexes) {
    const r = ranks.get(i)!
    if (!best) {
      best = r
      winners = [i]
      continue
    }
    const cmp = compareHandRank(r, best)
    if (cmp === 1) {
      best = r
      winners = [i]
    } else if (cmp === 0) {
      winners.push(i)
    }
  }
  return { winnerIndexes: winners, ranks }
}

function advanceStage(state: GameState, deck: Card[]): { state: GameState; deck: Card[] } {
  for (const p of state.players) p.bet = 0
  state.lastRaise = state.bigBlind
  state.actedThisStreet = Array(state.players.length).fill(false)
  state.raiseLockedThisStreet = Array(state.players.length).fill(false)

  const next = nextStage(state.stage)
  state.stage = next

  if (next === 'flop') {
    const r = deal(deck, 3)
    state.communityCards.push(...r.cards)
    deck = r.deck
  } else if (next === 'turn' || next === 'river') {
    const r = deal(deck, 1)
    state.communityCards.push(...r.cards)
    deck = r.deck
  } else if (next === 'showdown') {
    return settleShowdown(state, deck)
  }

  // Postflop: first to act is left of button
  state.currentPlayerIndex = nextActiveIndex(state, state.dealerIndex)
  return { state, deck }
}

function settleShowdown(state: GameState, deck: Card[]): { state: GameState; deck: Card[] } {
  state.stage = 'showdown'
  const aliveMask = state.players.map((p) => p.status !== 'fold')
  state.pots = buildPots(state.handContributions, aliveMask)

  for (const pot of state.pots) {
    if (pot.amount <= 0 || pot.eligible.length === 0) continue
    const { winnerIndexes } = determineWinnersAmong(state, pot.eligible)
    const share = Math.floor(pot.amount / winnerIndexes.length)
    let remainder = pot.amount - share * winnerIndexes.length
    for (const w of winnerIndexes) state.players[w].chips += share
    // deterministic remainder distribution
    for (const w of winnerIndexes) {
      if (remainder <= 0) break
      state.players[w].chips += 1
      remainder -= 1
    }
  }

  state.stage = 'end'
  return { state, deck }
}

function runoutToShowdown(state: GameState, deck: Card[]): { state: GameState; deck: Card[] } {
  const winner = soleRemainingNotFoldedIndex(state)
  if (winner !== null) {
    state.players[winner].chips += state.pot
    state.stage = 'end'
    return { state, deck }
  }
  // Deal remaining community to 5
  while (state.communityCards.length < 5) {
    const r = deal(deck, 1)
    state.communityCards.push(...r.cards)
    deck = r.deck
  }
  return settleShowdown(state, deck)
}

function nextStage(stage: Stage): Stage {
  if (stage === 'preflop') return 'flop'
  if (stage === 'flop') return 'turn'
  if (stage === 'turn') return 'river'
  if (stage === 'river') return 'showdown'
  return 'end'
}

function isBettingRoundComplete(state: GameState): boolean {
  const active = state.players.filter((p) => p.status === 'active')
  if (active.length <= 1) return true

  const currentBet = Math.max(...state.players.map((p) => p.bet))
  const betsEqual = state.players.every((p) => p.status !== 'active' || p.bet === currentBet)
  const bothActed = state.actedThisStreet.every((v, i) => state.players[i].status !== 'active' || v)

  if (currentBet === 0) return bothActed
  return betsEqual && bothActed
}

function raiseTo(state: GameState, playerIndex: number, targetTotalBet: number) {
  const p = state.players[playerIndex]
  const currentBet = Math.max(...state.players.map((pl) => pl.bet))
  const minTo = currentBet + Math.max(state.lastRaise, state.bigBlind)
  let target = Math.max(targetTotalBet, minTo)
  const maxTo = p.bet + p.chips
  if (target > maxTo) target = maxTo

  const pay = target - p.bet
  const actualPay = Math.min(p.chips, pay)
  p.chips -= actualPay
  p.bet += actualPay
  state.pot += actualPay
  state.handContributions[playerIndex] += actualPay
  if (p.chips === 0) p.status = 'allin'
}

function postBlind(state: GameState, playerIndex: number, blind: number) {
  const p = state.players[playerIndex]
  const pay = Math.min(p.chips, blind)
  p.chips -= pay
  p.bet += pay
  state.pot += pay
  state.handContributions[playerIndex] += pay
  if (p.chips === 0) p.status = 'allin'
}

function nextIndex(n: number, i: number): number {
  return (i + 1) % n
}

function nextActiveIndex(state: GameState, fromIndex: number): number {
  const n = state.players.length
  for (let step = 1; step <= n; step += 1) {
    const i = (fromIndex + step) % n
    const p = state.players[i]
    if (p.status === 'active') return i
  }
  return fromIndex
}

function soleRemainingNotFoldedIndex(state: GameState): number | null {
  let candidate: number | null = null
  for (let i = 0; i < state.players.length; i += 1) {
    if (state.players[i].status !== 'fold') {
      if (candidate !== null) return null
      candidate = i
    }
  }
  return candidate
}

function allRemainingAreAllIn(state: GameState): boolean {
  // true if no one left who can act (i.e. all not-fold are allin)
  for (const p of state.players) {
    if (p.status === 'active') return false
  }
  return state.players.some((p) => p.status === 'allin')
}

