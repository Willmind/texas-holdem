import { describe, expect, test } from 'vitest'
import type { Card, GameState, Suit } from '../types'
import { applyAction, createInitialGameState, startNewHand } from '../game'

function c(rank: number, suit: Suit): Card {
  return { rank, suit, code: `${rank}${suit}` }
}

describe('game rules (engine)', () => {
  test('incomplete all-in raise does not reduce min-raise size (lastRaise)', () => {
    const state = createInitialGameState()
    // keep 3 players for controlled test
    state.players = state.players.slice(0, 3)
    state.dealerIndex = 0
    const r = startNewHand(state, () => 0.123)
    const s = r.state as GameState

    // Force a situation: currentBet=100, lastRaise=20
    s.stage = 'flop'
    s.communityCards = [c(2, 'S'), c(7, 'H'), c(11, 'D')]
    s.lastRaise = 20
    s.players.forEach((p) => {
      p.bet = 100
      p.status = 'active'
    })
    s.actedThisStreet = [true, true, false]
    s.raiseLockedThisStreet = [false, false, false]

    // Player2 has only 10 chips left, so all-in to 110 is an incomplete raise (raiseAmount=10 < 20).
    s.players[2].chips = 10
    s.currentPlayerIndex = 2
    applyAction(s, r.deck, 2, { type: 'allin' })

    expect(s.players[2].bet).toBe(110)
    expect(s.lastRaise).toBe(20) // MUST NOT drop to 10
    expect(s.raiseLockedThisStreet[0]).toBe(true)
    expect(s.raiseLockedThisStreet[1]).toBe(true)
  })

  test('fold ends hand immediately when only one player remains', () => {
    const state = createInitialGameState()
    state.players = state.players.slice(0, 3)
    const r = startNewHand(state, () => 0.234)
    const s = r.state as GameState

    // Make player0 act and fold, leaving others active.
    s.stage = 'flop'
    s.communityCards = [c(2, 'S'), c(7, 'H'), c(11, 'D')]
    s.players[1].status = 'fold'
    s.players[2].status = 'active'
    s.players[0].status = 'active'
    s.currentPlayerIndex = 0

    const potBefore = s.pot
    applyAction(s, r.deck, 0, { type: 'fold' })

    // Now only player2 remains not-fold -> should win pot and end hand
    expect(s.stage).toBe('end')
    expect(s.players[2].chips).toBeGreaterThanOrEqual(0)
    expect(s.pot).toBe(potBefore)
  })
})

