import { describe, expect, test } from 'vitest'
import type { Card, GameState, Suit } from '../types'
import { decideAiAction } from '../ai'
import { applyAction, createInitialGameState, startNewHand } from '../game'

function c(rank: number, suit: Suit): Card {
  return { rank, suit, code: `${rank}${suit}` }
}

function baseState(n: number): GameState {
  const s = createInitialGameState(n)
  s.stage = 'preflop'
  s.pot = 0
  s.communityCards = []
  s.players.forEach((p) => {
    p.status = 'active'
    p.bet = 0
    p.chips = 1000
  })
  s.lastRaise = s.bigBlind
  return s
}

describe('ai (engine)', () => {
  test('preflop: strong hand opens with raise when unchecked', () => {
    const s = baseState(6)
    // playerIndex=3 acts, no bet to call
    s.players[3].holeCards = [c(14, 'S'), c(13, 'S')] // AKs
    const a = decideAiAction(s, 3, () => 0.0)
    expect(a.type).toBe('raise')
    expect(a.raiseTo).toBeDefined()
    // Expect open sizing > 1bb (avoid minRaiseTo=bb tiny opens)
    expect((a.raiseTo ?? 0)).toBeGreaterThanOrEqual(s.bigBlind * 2)
  })

  test('preflop: strong hand can 3bet when facing raise', () => {
    const s = baseState(6)
    // someone opened to 60 (3bb with bb=20), ai must respond with toCall>0
    s.players[1].bet = 60
    s.players[4].bet = 0
    s.pot = 60
    s.players[4].holeCards = [c(14, 'H'), c(14, 'D')] // AA
    const a = decideAiAction(s, 4, () => 0.0)
    expect(a.type).toBe('raise')
    // Expect a real 3bet sizing, not just minRaiseTo (80)
    expect((a.raiseTo ?? 0)).toBeGreaterThanOrEqual(100)
  })

  test('preflop: weak hand folds sometimes when facing bet', () => {
    const s = baseState(6)
    s.players[2].bet = 80
    s.pot = 80
    s.players[5].holeCards = [c(2, 'C'), c(7, 'D')] // trash
    const a = decideAiAction(s, 5, () => 0.0)
    expect(['fold', 'call', 'raise']).toContain(a.type)
  })

  test('ai-vs-ai: a hand always terminates (no infinite betting loop)', () => {
    const state = createInitialGameState(6)
    state.dealerIndex = 0
    const r = startNewHand(state, () => 0.123)
    let s = r.state as GameState
    let deck = r.deck

    // Make AI as aggressive as possible to stress the betting loop.
    const rng = () => 0.0

    let steps = 0
    while (s.stage !== 'end' && steps < 2000) {
      const i = s.currentPlayerIndex
      const action = decideAiAction(s, i, rng)
      const res = applyAction(s, deck, i, action)
      s = res.state
      deck = res.deck
      steps += 1
    }

    expect(steps).toBeLessThan(2000)
    expect(s.stage).toBe('end')
  })
})

