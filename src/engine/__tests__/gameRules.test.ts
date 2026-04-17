import { describe, expect, test } from 'vitest'
import type { Card, GameState, Suit } from '../types'
import { applyAction, createInitialGameState, startNewHand } from '../game'

function c(rank: number, suit: Suit): Card {
  return { rank, suit, code: `${rank}${suit}` }
}

describe('game rules (engine)', () => {
  test('createInitialGameState supports 2-6 players', () => {
    for (let n = 2; n <= 6; n += 1) {
      const s = createInitialGameState(n)
      expect(s.players).toHaveLength(n)
      expect(s.handContributions).toHaveLength(n)
      expect(s.actedThisStreet).toHaveLength(n)
      expect(s.raiseLockedThisStreet).toHaveLength(n)
      expect(s.players[0].id).toBe('you')
    }
  })

  test('heads-up: dealer posts small blind and acts first preflop', () => {
    const state = createInitialGameState(2)
    state.dealerIndex = 0
    const r = startNewHand(state, () => 0.123)
    const s = r.state as GameState

    // Heads-up: dealer is small blind (button), other is big blind.
    expect(s.players[0].bet).toBe(s.smallBlind)
    expect(s.players[1].bet).toBe(s.bigBlind)

    // Preflop: dealer (SB) acts first heads-up.
    expect(s.currentPlayerIndex).toBe(0)
  })

  test('heads-up: non-dealer acts first postflop', () => {
    const state = createInitialGameState(2)
    state.dealerIndex = 0
    const r = startNewHand(state, () => 0.123)
    const s = r.state as GameState

    // Preflop: dealer completes SB, then BB checks.
    applyAction(s, r.deck, 0, { type: 'call' })
    applyAction(s, r.deck, 1, { type: 'call' })

    expect(s.stage).toBe('flop')
    // Postflop: first to act is left of button (non-dealer in HU).
    expect(s.currentPlayerIndex).toBe(1)
  })

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

  test('showdown distributes side pots to correct eligible winners', () => {
    const state = createInitialGameState(3)
    const s = state as GameState

    // Force a showdown directly from river via "check" actions.
    s.stage = 'river'
    s.communityCards = [c(2, 'H'), c(2, 'D'), c(2, 'S'), c(7, 'C'), c(9, 'D')]

    // Contributions create 2 pots:
    // main: 100*3=300 eligible 0,1,2; side: (250-100)*2=300 eligible 1,2
    s.handContributions = [100, 250, 250]
    s.pot = 600
    s.players.forEach((p) => {
      p.bet = 0
      p.status = 'active'
      p.chips = 0
    })

    // Ranks: AA > KK > QQ on trips-2 board
    s.players[0].holeCards = [c(14, 'S'), c(14, 'C')]
    s.players[1].holeCards = [c(13, 'S'), c(13, 'C')]
    s.players[2].holeCards = [c(12, 'S'), c(12, 'C')]

    s.currentPlayerIndex = 2
    s.actedThisStreet = [true, true, false]
    s.raiseLockedThisStreet = [false, false, false]

    // Player2 checks -> round completes -> advance to showdown -> settle.
    applyAction(s, [], 2, { type: 'call' })

    expect(s.stage).toBe('end')
    expect(s.players[0].chips).toBe(300)
    expect(s.players[1].chips).toBe(300)
    expect(s.players[2].chips).toBe(0)
  })
})

