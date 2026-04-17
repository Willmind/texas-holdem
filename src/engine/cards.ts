import type { Card, Suit } from './types'

const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const RANKS: number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export function rankToChar(rank: number): string {
  if (rank >= 2 && rank <= 9) return String(rank)
  if (rank === 10) return 'T'
  if (rank === 11) return 'J'
  if (rank === 12) return 'Q'
  if (rank === 13) return 'K'
  if (rank === 14) return 'A'
  return '?'
}

export function suitToChar(suit: Suit): string {
  if (suit === 'S') return '♠'
  if (suit === 'H') return '♥'
  if (suit === 'D') return '♦'
  return '♣'
}

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const code = `${rankToChar(rank)}${suit}`
      deck.push({ suit, rank, code })
    }
  }
  return deck
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = items.slice() as T[]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function deal(deck: readonly Card[], n: number): { cards: Card[]; deck: Card[] } {
  if (n < 0) throw new Error('deal: n must be >= 0')
  if (deck.length < n) throw new Error('deal: not enough cards')
  return { cards: deck.slice(0, n), deck: deck.slice(n) }
}

