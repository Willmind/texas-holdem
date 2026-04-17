import { describe, expect, test } from 'vitest'
import type { Card, Suit, GameState } from '../types'
import { createInitialGameState, determineWinnersAmong } from '../game'

function c(rank: number, suit: Suit): Card {
  return { rank, suit, code: `${rank}${suit}` }
}

function withBoard(state: GameState, board: Card[]) {
  state.communityCards = board
}

describe('determineWinnersAmong', () => {
  test('ties when board plays for everyone', () => {
    const state = createInitialGameState()
    // use only first 3 players for this test
    state.players = state.players.slice(0, 3)
    withBoard(state, [c(10, 'S'), c(11, 'H'), c(12, 'D'), c(13, 'C'), c(14, 'S')]) // TJQKA
    state.players[0].holeCards = [c(2, 'C'), c(3, 'D')]
    state.players[1].holeCards = [c(4, 'C'), c(5, 'D')]
    state.players[2].holeCards = [c(6, 'C'), c(7, 'D')]

    const r = determineWinnersAmong(state, [0, 1, 2])
    expect(r.winnerIndexes.sort()).toEqual([0, 1, 2])
  })
})

