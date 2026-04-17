import { describe, expect, test } from 'vitest'
import type { Card, Suit } from '../types'
import { bestHandFrom7, compareHandRank } from '../handEval'

function c(rank: number, suit: Suit): Card {
  const code = `${rank}${suit}`
  return { rank, suit, code }
}

describe('handEval', () => {
  test('detects wheel straight (A-2-3-4-5) with high=5', () => {
    const seven = [c(14, 'S'), c(2, 'H'), c(3, 'D'), c(4, 'C'), c(5, 'S'), c(9, 'H'), c(13, 'D')]
    const r = bestHandFrom7(seven)
    expect(r.category).toBe(4)
    expect(r.tiebreakers[0]).toBe(5)
  })

  test('straight flush beats four of a kind', () => {
    const sf = bestHandFrom7([c(14, 'S'), c(13, 'S'), c(12, 'S'), c(11, 'S'), c(10, 'S'), c(2, 'D'), c(3, 'H')])
    const quads = bestHandFrom7([c(9, 'S'), c(9, 'H'), c(9, 'D'), c(9, 'C'), c(14, 'S'), c(2, 'D'), c(3, 'H')])
    expect(sf.category).toBe(8)
    expect(quads.category).toBe(7)
    expect(compareHandRank(sf, quads)).toBe(1)
  })

  test('two pair compares kicker correctly', () => {
    const a = bestHandFrom7([c(14, 'S'), c(14, 'H'), c(13, 'D'), c(13, 'C'), c(12, 'S'), c(2, 'D'), c(3, 'H')])
    const b = bestHandFrom7([c(14, 'D'), c(14, 'C'), c(13, 'S'), c(13, 'H'), c(11, 'S'), c(2, 'H'), c(3, 'D')])
    expect(a.category).toBe(2)
    expect(b.category).toBe(2)
    expect(compareHandRank(a, b)).toBe(1) // kicker Q beats J
  })

  test('full house compares trips first then pair', () => {
    const a = bestHandFrom7([c(10, 'S'), c(10, 'H'), c(10, 'D'), c(2, 'C'), c(2, 'S'), c(14, 'H'), c(9, 'D')])
    const b = bestHandFrom7([c(9, 'S'), c(9, 'H'), c(9, 'D'), c(14, 'C'), c(14, 'S'), c(2, 'H'), c(3, 'D')])
    expect(a.category).toBe(6)
    expect(b.category).toBe(6)
    expect(compareHandRank(a, b)).toBe(1) // trips T beats trips 9
  })
})

