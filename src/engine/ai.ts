import type { Action, Card, GameState } from './types'
import { bestHandFrom } from './handEval'
import { minRaiseTo, toCall } from './game'

export function decideAiAction(state: GameState, playerIndex: number, rng: () => number = Math.random): Action {
  const ai = state.players[playerIndex]
  const need = toCall(state, playerIndex)
  const canCheck = need === 0

  // If already all-in/folded, no action.
  if (ai.status !== 'active') return { type: 'call' }

  if (state.stage === 'preflop') {
    const s = preflopScore(ai.holeCards)
    if (need > 0) {
      if (s < 0.25 && rng() < 0.45) return { type: 'fold' }
      if (s > 0.82 && ai.chips > need + state.bigBlind && rng() < 0.55) return { type: 'raise', raiseTo: minRaiseTo(state) }
      return { type: 'call' }
    }
    if (s > 0.9 && ai.chips > state.bigBlind * 3 && rng() < 0.7) return { type: 'raise', raiseTo: minRaiseTo(state) }
    return { type: 'call' }
  }

  // Postflop (including flop/turn/river): evaluate best made hand from available cards
  const available = [...ai.holeCards, ...state.communityCards]
  const rank = available.length >= 5 ? bestHandFrom(available) : null
  const cat = rank?.category ?? 0

  // crude aggression model
  const strong = cat >= 4 // straight or better
  const medium = cat >= 1 // pair+

  if (need > 0) {
    if (!medium && rng() < 0.25) return { type: 'fold' }
    if (strong && ai.chips > need + state.bigBlind && rng() < 0.45) return { type: 'raise', raiseTo: minRaiseTo(state) }
    return { type: 'call' }
  }

  if (strong && ai.chips > state.bigBlind * 2 && rng() < 0.55) return { type: 'raise', raiseTo: minRaiseTo(state) }
  if (medium && rng() < 0.12 && ai.chips > state.bigBlind * 2) return { type: 'raise', raiseTo: minRaiseTo(state) }
  return canCheck ? { type: 'call' } : { type: 'call' }
}

function preflopScore(hole: readonly Card[]): number {
  if (hole.length !== 2) return 0
  const [a, b] = hole[0].rank >= hole[1].rank ? [hole[0], hole[1]] : [hole[1], hole[0]]
  const high = a.rank
  const low = b.rank
  const pair = high === low
  const suited = a.suit === b.suit
  const gap = high - low

  // Base on high card
  let s = (high - 2) / 12 // 0..1
  s = Math.min(1, Math.max(0, s))

  if (pair) {
    // pairs are strong, scale quickly
    return Math.min(1, 0.55 + (high - 2) / 12 * 0.5)
  }

  if (suited) s += 0.08
  if (gap === 1) s += 0.06
  if (gap === 2) s += 0.03
  if (high >= 13 && low >= 10) s += 0.07 // broadways
  if (high === 14) s += 0.04
  if (high <= 9 && gap >= 4) s -= 0.12

  return Math.min(1, Math.max(0, s))
}

