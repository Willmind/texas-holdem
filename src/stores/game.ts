import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Card, GameState } from '../engine/types'
import { applyAction, createInitialGameState, minRaiseTo, startNewHand, toCall } from '../engine/game'
import { decideAiAction } from '../engine/ai'
import { estimateMultiwayEquity } from '../engine/equity'
import { bestHandFrom } from '../engine/handEval'
import { determineWinnersAmong } from '../engine/game'

export type TableSize = 2 | 3 | 4 | 5 | 6

function clampTableSize(n: number): TableSize {
  const v = Math.max(2, Math.min(6, Math.floor(n)))
  return v as TableSize
}

export const useGameStore = defineStore('game', () => {
  const deck = ref<Card[]>([])
  const tableSize = ref<TableSize>(6)
  const state = ref<GameState>(createInitialGameState(tableSize.value))

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
  const noChipsModal = ref(false)
  const noChipsBanner = ref(false)
  const matchWonModal = ref(false)
  let equityToken = 0
  let aiToken = 0

  const meIndex = 0
  const me = computed(() => state.value.players[meIndex])

  const currentBet = computed(() => Math.max(...state.value.players.map((p) => p.bet)))
  const meToCall = computed(() => toCall(state.value, meIndex))
  const minRaise = computed(() => minRaiseTo(state.value))

  const canAct = computed(() => state.value.stage !== 'end' && state.value.currentPlayerIndex === meIndex && me.value.status === 'active')

  watch(
    () => [state.value.stage, me.value.chips] as const,
    ([stage, chips]) => {
      if (stage === 'end' && chips <= 0) {
        noChipsBanner.value = true
        matchWonModal.value = false
        return
      }
      noChipsBanner.value = false
    },
    { immediate: true },
  )

  watch(
    () => state.value.stage,
    (stage) => {
      if (stage !== 'end') return
      // Defensive: ensure UI always has a per-hand summary even if hand ended during AI loop.
      if (!lastShowdown.value) buildShowdownSummary()
    },
    { immediate: true },
  )

  function start() {
    if (state.value.stage !== 'end') return
    if (me.value.chips <= 0) {
      noChipsModal.value = true
      return
    }
    const othersHaveChips = state.value.players.some((p, idx) => idx !== meIndex && p.chips > 0)
    if (!othersHaveChips) {
      matchWonModal.value = true
      return
    }
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
    state.value = createInitialGameState(tableSize.value)
    deck.value = []
    lastShowdown.value = null
    equity.value = null
    noChipsModal.value = false
    noChipsBanner.value = false
    matchWonModal.value = false
  }

  function setTableSize(n: number) {
    tableSize.value = clampTableSize(n)
    resetMatch()
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
    if (me.value.status !== 'active' || me.value.holeCards.length !== 2) {
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
      if (p.status !== 'active') {
        // Defensive: skip folded/all-in players if state points at them.
        const n = state.value.players.length
        let next = -1
        for (let step = 1; step <= n; step += 1) {
          const j = (i + step) % n
          if (state.value.players[j].status === 'active') {
            next = j
            break
          }
        }
        if (next < 0) return
        state.value.currentPlayerIndex = next
        continue
      }
      const delay = me.value.status === 'fold' ? 40 : 450
      await new Promise((r) => setTimeout(r, delay))
      if (token !== aiToken) return
      const action = decideAiAction(state.value, i)
      const res = applyAction(state.value, deck.value, i, action)
      state.value = res.state
      deck.value = res.deck
      if (state.value.stage === 'end') {
        buildShowdownSummary()
        void recalcEquity()
      }
    }
  }

  return {
    deck,
    state,
    tableSize,
    lastShowdown,
    equity,
    equityComputing,
    noChipsModal,
    noChipsBanner,
    matchWonModal,
    me,
    currentBet,
    meToCall,
    minRaise,
    canAct,
    start,
    resetMatch,
    setTableSize,
    fold,
    call,
    raiseTo,
    allin,
  }
})

