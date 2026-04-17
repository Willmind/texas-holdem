import { describe, expect, test } from 'vitest'
import type { Card, Suit } from '../types'
import { estimateHeadsUpEquity } from '../equity'

function c(rank: number, suit: Suit): Card {
  return { rank, suit, code: `${rank}${suit}` }
}

describe('equity', () => {
  test('river exact: board makes unbeatable A-high flush for hero', () => {
    const heroHole = [c(14, 'H'), c(12, 'H')] // Ah Qh
    const community = [c(2, 'H'), c(5, 'H'), c(9, 'H'), c(13, 'S'), c(12, 'D')] // 3 hearts, no pair on board

    const r = estimateHeadsUpEquity({ heroHole, community })
    expect(r.mode).toBe('exact')
    expect(r.win).toBe(1)
    expect(r.tie).toBe(0)
    expect(r.lose).toBe(0)
    expect(r.equity).toBe(1)
  })

  test('river exact: board makes broadway straight tie always', () => {
    const heroHole = [c(2, 'C'), c(3, 'D')]
    const community = [c(10, 'S'), c(11, 'H'), c(12, 'D'), c(13, 'C'), c(14, 'S')] // TJQKA

    const r = estimateHeadsUpEquity({ heroHole, community })
    expect(r.mode).toBe('exact')
    expect(r.win).toBe(0)
    expect(r.tie).toBe(1)
    expect(r.lose).toBe(0)
    expect(r.equity).toBe(0.5)
  })
})

