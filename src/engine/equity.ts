import type { Card } from './types'
import { createDeck } from './cards'
import { bestHandFrom, compareHandRank } from './handEval'

export type EquityMode = 'exact' | 'montecarlo'

export interface EquityResult {
  mode: EquityMode
  samples: number
  win: number // 0..1
  tie: number // 0..1
  lose: number // 0..1
  equity: number // win + 0.5*tie
}

export interface EstimateEquityArgs {
  heroHole: readonly Card[]
  community: readonly Card[]
  trials?: number
  rng?: () => number
}

export interface EstimateMultiwayEquityArgs extends EstimateEquityArgs {
  opponents: number // number of unknown opponents (0..5)
}

export function estimateHeadsUpEquity(args: EstimateEquityArgs): EquityResult {
  const heroHole = args.heroHole
  const community = args.community
  if (heroHole.length !== 2) throw new Error('estimateHeadsUpEquity: heroHole must be 2 cards')
  if (community.length < 0 || community.length > 5) throw new Error('estimateHeadsUpEquity: community must be 0..5 cards')

  const known = [...heroHole, ...community]
  assertNoDuplicates(known)

  const remaining = remainingDeckExcluding(known)

  // River: exact enumeration over opponent hole cards.
  if (community.length === 5) {
    let wins = 0
    let ties = 0
    let losses = 0
    let total = 0

    for (let i = 0; i < remaining.length; i += 1) {
      for (let j = i + 1; j < remaining.length; j += 1) {
        const oppHole = [remaining[i], remaining[j]]
        const heroRank = bestHandFrom([...heroHole, ...community])
        const oppRank = bestHandFrom([...oppHole, ...community])
        const cmp = compareHandRank(heroRank, oppRank)
        total += 1
        if (cmp === 1) wins += 1
        else if (cmp === 0) ties += 1
        else losses += 1
      }
    }

    const win = wins / total
    const tie = ties / total
    const lose = losses / total
    return { mode: 'exact', samples: total, win, tie, lose, equity: win + 0.5 * tie }
  }

  const rng = args.rng ?? Math.random
  const trials = Math.max(200, Math.floor(args.trials ?? defaultTrials(community.length)))

  let wins = 0
  let ties = 0
  let losses = 0

  const needBoard = 5 - community.length

  for (let t = 0; t < trials; t += 1) {
    const bag = remaining.slice()
    const opp1 = draw(bag, rng)
    const opp2 = draw(bag, rng)
    const oppHole = [opp1, opp2]
    const board = community.slice() as Card[]
    for (let k = 0; k < needBoard; k += 1) board.push(draw(bag, rng))

    const heroRank = bestHandFrom([...heroHole, ...board])
    const oppRank = bestHandFrom([...oppHole, ...board])
    const cmp = compareHandRank(heroRank, oppRank)
    if (cmp === 1) wins += 1
    else if (cmp === 0) ties += 1
    else losses += 1
  }

  const win = wins / trials
  const tie = ties / trials
  const lose = losses / trials
  return { mode: 'montecarlo', samples: trials, win, tie, lose, equity: win + 0.5 * tie }
}

export function estimateMultiwayEquity(args: EstimateMultiwayEquityArgs): EquityResult {
  const heroHole = args.heroHole
  const community = args.community
  const opponents = Math.max(0, Math.min(5, Math.floor(args.opponents)))
  if (heroHole.length !== 2) throw new Error('estimateMultiwayEquity: heroHole must be 2 cards')
  if (community.length < 0 || community.length > 5) throw new Error('estimateMultiwayEquity: community must be 0..5 cards')

  // With 0 opponents, you always win.
  if (opponents === 0) return { mode: 'exact', samples: 1, win: 1, tie: 0, lose: 0, equity: 1 }

  const known = [...heroHole, ...community]
  assertNoDuplicates(known)
  const remaining = remainingDeckExcluding(known)

  const rng = args.rng ?? Math.random
  const trials = Math.max(300, Math.floor(args.trials ?? defaultMultiwayTrials(community.length, opponents)))
  const needBoard = 5 - community.length

  let wins = 0 // scoops entire pot
  let ties = 0 // hero is among winners but not sole winner
  let losses = 0
  let equitySum = 0

  for (let t = 0; t < trials; t += 1) {
    const bag = remaining.slice()

    const oppHoles: Card[][] = []
    for (let o = 0; o < opponents; o += 1) {
      const a = draw(bag, rng)
      const b = draw(bag, rng)
      oppHoles.push([a, b])
    }

    const board = community.slice() as Card[]
    for (let k = 0; k < needBoard; k += 1) board.push(draw(bag, rng))

    const heroRank = bestHandFrom([...heroHole, ...board])

    let bestRank = heroRank
    let winners = 1

    for (const hole of oppHoles) {
      const r = bestHandFrom([...hole, ...board])
      const cmp = compareHandRank(r, bestRank)
      if (cmp === 1) {
        bestRank = r
        winners = 0
      }
      if (compareHandRank(r, bestRank) === 0) winners += 1
    }

    if (compareHandRank(heroRank, bestRank) !== 0) {
      losses += 1
      continue
    }

    if (winners === 1) {
      wins += 1
      equitySum += 1
    } else {
      ties += 1
      equitySum += 1 / winners
    }
  }

  const win = wins / trials
  const tie = ties / trials
  const lose = losses / trials
  return { mode: 'montecarlo', samples: trials, win, tie, lose, equity: equitySum / trials }
}

function defaultTrials(communityLen: number): number {
  if (communityLen === 0) return 7000
  if (communityLen === 3) return 5000
  if (communityLen === 4) return 3500
  return 2500
}

function defaultMultiwayTrials(communityLen: number, opponents: number): number {
  // Scale up a bit with opponents since variance increases, but keep bounded.
  const base = communityLen === 0 ? 9000 : communityLen === 3 ? 6500 : communityLen === 4 ? 4500 : 3500
  const factor = 1 + (opponents - 1) * 0.25
  return Math.floor(Math.min(14000, base * factor))
}

function remainingDeckExcluding(known: readonly Card[]): Card[] {
  const set = new Set(known.map(cardKey))
  return createDeck().filter((c) => !set.has(cardKey(c)))
}

function assertNoDuplicates(cards: readonly Card[]) {
  const seen = new Set<string>()
  for (const c of cards) {
    const k = cardKey(c)
    if (seen.has(k)) throw new Error(`duplicate card: ${k}`)
    seen.add(k)
  }
}

function cardKey(c: Card): string {
  return `${c.rank}-${c.suit}`
}

function draw(bag: Card[], rng: () => number): Card {
  if (bag.length === 0) throw new Error('draw: empty bag')
  const idx = Math.floor(rng() * bag.length)
  return bag.splice(idx, 1)[0]
}

