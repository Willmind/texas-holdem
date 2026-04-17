import type { Card } from './types'

export type HandCategory =
  | 0 // high card
  | 1 // one pair
  | 2 // two pair
  | 3 // three of a kind
  | 4 // straight
  | 5 // flush
  | 6 // full house
  | 7 // four of a kind
  | 8 // straight flush

export interface HandRank {
  category: HandCategory
  tiebreakers: number[] // higher is better, compared lexicographically
  name: string
  bestFive: Card[]
}

export function compareHandRank(a: HandRank, b: HandRank): -1 | 0 | 1 {
  if (a.category !== b.category) return a.category > b.category ? 1 : -1
  const n = Math.max(a.tiebreakers.length, b.tiebreakers.length)
  for (let i = 0; i < n; i += 1) {
    const av = a.tiebreakers[i] ?? 0
    const bv = b.tiebreakers[i] ?? 0
    if (av !== bv) return av > bv ? 1 : -1
  }
  return 0
}

export function bestHandFrom7(seven: readonly Card[]): HandRank {
  if (seven.length !== 7) throw new Error('bestHandFrom7: requires exactly 7 cards')
  let best: HandRank | null = null
  for (const idx of combinations(7, 5)) {
    const five = idx.map((i) => seven[i])
    const r = rank5(five)
    if (!best || compareHandRank(r, best) === 1) best = r
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return best!
}

export function bestHandFrom(cards: readonly Card[]): HandRank {
  if (cards.length < 5 || cards.length > 7) throw new Error('bestHandFrom: requires 5-7 cards')
  if (cards.length === 5) return rank5(cards)
  if (cards.length === 6) {
    let best: HandRank | null = null
    for (const idx of combinations(6, 5)) {
      const five = idx.map((i) => cards[i])
      const r = rank5(five)
      if (!best || compareHandRank(r, best) === 1) best = r
    }
    return best!
  }
  return bestHandFrom7(cards)
}

function rank5(five: readonly Card[]): HandRank {
  if (five.length !== 5) throw new Error('rank5: requires exactly 5 cards')

  const ranksDesc = five
    .map((c) => c.rank)
    .slice()
    .sort((a, b) => b - a)

  const isFlush = five.every((c) => c.suit === five[0].suit)
  const straightHigh = straightHighRank(ranksDesc)
  const isStraight = straightHigh !== null

  const counts = new Map<number, number>()
  for (const r of ranksDesc) counts.set(r, (counts.get(r) ?? 0) + 1)

  // groups sorted by: count desc, rank desc
  const groups = [...counts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank)

  if (isStraight && isFlush) {
    return { category: 8, tiebreakers: [straightHigh], name: '同花顺', bestFive: five.slice() as Card[] }
  }

  if (groups[0].count === 4) {
    const quad = groups[0].rank
    const kicker = groups.find((g) => g.count === 1)!.rank
    return { category: 7, tiebreakers: [quad, kicker], name: '四条', bestFive: five.slice() as Card[] }
  }

  if (groups[0].count === 3 && groups[1]?.count === 2) {
    return {
      category: 6,
      tiebreakers: [groups[0].rank, groups[1].rank],
      name: '葫芦',
      bestFive: five.slice() as Card[],
    }
  }

  if (isFlush) {
    return { category: 5, tiebreakers: ranksDesc, name: '同花', bestFive: five.slice() as Card[] }
  }

  if (isStraight) {
    return { category: 4, tiebreakers: [straightHigh], name: '顺子', bestFive: five.slice() as Card[] }
  }

  if (groups[0].count === 3) {
    const trip = groups[0].rank
    const kickers = groups
      .filter((g) => g.count === 1)
      .map((g) => g.rank)
      .sort((a, b) => b - a)
    return { category: 3, tiebreakers: [trip, ...kickers], name: '三条', bestFive: five.slice() as Card[] }
  }

  if (groups[0].count === 2 && groups[1]?.count === 2) {
    const pairHigh = Math.max(groups[0].rank, groups[1].rank)
    const pairLow = Math.min(groups[0].rank, groups[1].rank)
    const kicker = groups.find((g) => g.count === 1)!.rank
    return { category: 2, tiebreakers: [pairHigh, pairLow, kicker], name: '两对', bestFive: five.slice() as Card[] }
  }

  if (groups[0].count === 2) {
    const pair = groups[0].rank
    const kickers = groups
      .filter((g) => g.count === 1)
      .map((g) => g.rank)
      .sort((a, b) => b - a)
    return { category: 1, tiebreakers: [pair, ...kickers], name: '一对', bestFive: five.slice() as Card[] }
  }

  return { category: 0, tiebreakers: ranksDesc, name: '高牌', bestFive: five.slice() as Card[] }
}

function straightHighRank(ranksDesc: readonly number[]): number | null {
  const uniq = [...new Set(ranksDesc)].sort((a, b) => b - a)
  if (uniq.length !== 5) return null
  const max = uniq[0]
  const min = uniq[4]

  // Wheel: A-5 straight (A,5,4,3,2)
  if (uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2) return 5

  if (max - min !== 4) return null
  for (let i = 0; i < 4; i += 1) {
    if (uniq[i] - uniq[i + 1] !== 1) return null
  }
  return max
}

function combinations(n: number, k: number): number[][] {
  const out: number[][] = []
  const cur: number[] = []
  const rec = (start: number, left: number) => {
    if (left === 0) {
      out.push(cur.slice())
      return
    }
    for (let i = start; i <= n - left; i += 1) {
      cur.push(i)
      rec(i + 1, left - 1)
      cur.pop()
    }
  }
  rec(0, k)
  return out
}

