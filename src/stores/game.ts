import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Card, GameState } from '../engine/types'
import { applyAction, createInitialGameState, minRaiseTo, startNewHand, toCall } from '../engine/game'
import { decideAiAction } from '../engine/ai'
import { estimateMultiwayEquity } from '../engine/equity'
import { bestHandFrom } from '../engine/handEval'
import { determineWinnersAmong } from '../engine/game'

export const useGameStore = defineStore('game', () => {
  const deck = ref<Card[]>([])
  const state = ref<GameState>(createInitialGameState())

  const lastShowdown = ref<
    | null
    | {
        kind: 'fold' | 'showdown'
        winners: number[]
        perPlayer: { index: number; name: string; status: string; handName?: string }[]
        pots?: { amount: number; eligible: number[]; winners: number[]; share: number; remainder: number }[]
      }
  >(null)
  const equity = ref<null | { equity: number; win: number; tie: number; lose: number; samples: number; mode: 'exact' | 'montecarlo' }>(
    null,
  )
  const equityComputing = ref(false)
  let equityToken = 0
  let aiToken = 0

  const meIndex = 0
  const me = computed(() => state.value.players[meIndex])

  const currentBet = computed(() => Math.max(...state.value.players.map((p) => p.bet)))
  const meToCall = computed(() => toCall(state.value, meIndex))
  const minRaise = computed(() => minRaiseTo(state.value))

  const canAct = computed(() => state.value.stage !== 'end' && state.value.currentPlayerIndex === meIndex && me.value.status === 'active')

  function start() {
    if (state.value.stage !== 'end') return
    aiToken += 1
    // rotate dealer each hand
    state.value.dealerIndex = (state.value.dealerIndex + 1) % state.value.players.length
    const r = startNewHand(state.value)
    state.value = r.state
    deck.value = r.deck
    lastShowdown.value = null
    equity.value = null
    void maybeRunAi()
    void recalcEquity()
  }

  function resetMatch() {
    aiToken += 1
    state.value = createInitialGameState()
    deck.value = []
    lastShowdown.value = null
    equity.value = null
  }

  function fold() {
    if (!canAct.value) return
    const r = applyAction(state.value, deck.value, meIndex, { type: 'fold' })
    state.value = r.state
    deck.value = r.deck
    onAfterAction()
  }

  function call() {
    if (!canAct.value) return
    const r = applyAction(state.value, deck.value, meIndex, { type: 'call' })
    state.value = r.state
    deck.value = r.deck
    onAfterAction()
  }

  function allin() {
    if (!canAct.value) return
    const r = applyAction(state.value, deck.value, meIndex, { type: 'allin' })
    state.value = r.state
    deck.value = r.deck
    onAfterAction()
  }

  function raiseTo(to: number) {
    if (!canAct.value) return
    const r = applyAction(state.value, deck.value, meIndex, { type: 'raise', raiseTo: to })
    state.value = r.state
    deck.value = r.deck
    onAfterAction()
  }

  function onAfterAction() {
    if (state.value.stage === 'end') {
      buildShowdownSummary()
      void recalcEquity()
      return
    }
    void recalcEquity()
    void maybeRunAi()
  }

  function buildShowdownSummary() {
    const s = state.value
    const perPlayer = s.players.map((p, index) => ({
      index,
      name: p.name,
      status: p.status,
      handName: s.communityCards.length === 5 && p.status !== 'fold' && p.holeCards.length === 2 ? bestHandFrom([...p.holeCards, ...s.communityCards]).name : undefined,
    }))

    const alive = s.players.map((p, i) => (p.status !== 'fold' ? i : -1)).filter((i) => i >= 0)
    if (s.communityCards.length < 5 || alive.length <= 1 || s.pots.length === 0) {
      // either ended by fold, or board not complete, or pots not built (folded win)
      lastShowdown.value = { kind: 'fold', winners: alive.length === 1 ? alive : [], perPlayer }
      return
    }

    const pots = s.pots.map((pot) => {
      const { winnerIndexes } = determineWinnersAmong(s, pot.eligible)
      const share = Math.floor(pot.amount / winnerIndexes.length)
      const remainder = pot.amount - share * winnerIndexes.length
      return { amount: pot.amount, eligible: pot.eligible, winners: winnerIndexes, share, remainder }
    })

    const topWinners = pots.length > 0 ? pots[0].winners : []
    lastShowdown.value = { kind: 'showdown', winners: topWinners, perPlayer, pots }
  }

  async function recalcEquity() {
    // Only meaningful when we have our hole cards.
    if (me.value.holeCards.length !== 2) {
      equity.value = null
      return
    }

    const token = ++equityToken
    equityComputing.value = true

    try {
      // Let UI paint first.
      await new Promise((r) => setTimeout(r, 0))
      if (token !== equityToken) return

      const community = state.value.communityCards
      const trials =
        community.length === 0 ? 7000 : community.length === 3 ? 5000 : community.length === 4 ? 3500 : community.length === 5 ? 0 : 3000

      const opponents = state.value.players.filter((p, idx) => idx !== meIndex && p.status !== 'fold').length
      const r = estimateMultiwayEquity({ heroHole: me.value.holeCards, community, trials, opponents })
      if (token !== equityToken) return
      equity.value = { equity: r.equity, win: r.win, tie: r.tie, lose: r.lose, samples: r.samples, mode: r.mode }
    } finally {
      if (token === equityToken) equityComputing.value = false
    }
  }

  async function maybeRunAi() {
    const token = aiToken
    while (state.value.stage !== 'end' && state.value.currentPlayerIndex !== meIndex) {
      if (token !== aiToken) return
      const i = state.value.currentPlayerIndex
      const p = state.value.players[i]
      if (p.status !== 'active') return
      await new Promise((r) => setTimeout(r, 450))
      if (token !== aiToken) return
      const action = decideAiAction(state.value, i)
      const res = applyAction(state.value, deck.value, i, action)
      state.value = res.state
      deck.value = res.deck
    }
  }

  return {
    deck,
    state,
    lastShowdown,
    equity,
    equityComputing,
    me,
    currentBet,
    meToCall,
    minRaise,
    canAct,
    start,
    resetMatch,
    fold,
    call,
    raiseTo,
    allin,
  }
})

