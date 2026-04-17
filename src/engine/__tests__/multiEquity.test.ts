import { describe, expect, test } from 'vitest'
import type { Card, Suit } from '../types'
import { estimateMultiwayEquity } from '../equity'

function c(rank: number, suit: Suit): Card {
  return { rank, suit, code: `${rank}${suit}` }
}

describe('multiway equity', () => {
  test('royal-straight board: hero never scoops, equity equals 1/(players)', () => {
    const heroHole = [c(2, 'C'), c(3, 'D')]
    const community = [c(10, 'S'), c(11, 'H'), c(12, 'D'), c(13, 'C'), c(14, 'S')] // TJQKA on board

    const r = estimateMultiwayEquity({ heroHole, community, opponents: 5, trials: 5000, rng: () => 0.42 })
    expect(r.mode).toBe('montecarlo')
    expect(r.win).toBe(0)
    expect(r.tie).toBe(1)
    // equity should be very close to 1/6, but allow tolerance due to MC + rng usage
    expect(r.equity).toBeGreaterThan(0.155)
    expect(r.equity).toBeLessThan(0.178)
  })
})

