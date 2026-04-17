export type Suit = 'S' | 'H' | 'D' | 'C'

export interface Card {
  suit: Suit
  rank: number // 2-14 (A=14)
  code: string
}

export type PlayerStatus = 'active' | 'fold' | 'allin'
export type PlayerAction = null | 'fold' | 'call' | 'raise'

export interface Player {
  id: string
  name: string
  chips: number
  bet: number
  holeCards: Card[]
  status: PlayerStatus
  action: PlayerAction
}

export type Stage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'end'

export interface GameState {
  stage: Stage
  players: Player[]
  communityCards: Card[]
  pot: number
  pots: { amount: number; eligible: number[] }[]
  handContributions: number[]
  currentPlayerIndex: number
  dealerIndex: number
  smallBlind: number
  bigBlind: number
  lastRaise: number
  actedThisStreet: boolean[]
  raiseLockedThisStreet: boolean[]
}

export type ActionType = 'fold' | 'call' | 'raise' | 'allin'

export interface Action {
  type: ActionType
  raiseTo?: number
}

