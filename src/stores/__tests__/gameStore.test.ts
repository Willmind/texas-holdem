import { beforeEach, describe, expect, test } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useGameStore } from '../game'

describe('game store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  test('start() shows no-chips modal when hero has 0 chips', () => {
    const game = useGameStore()
    game.resetMatch()
    game.state.players[0].chips = 0
    game.state.stage = 'end'
    const dealerBefore = game.state.dealerIndex

    game.start()

    expect(game.noChipsModal).toBe(true)
    expect(game.state.stage).toBe('end')
    expect(game.state.dealerIndex).toBe(dealerBefore)
  })

  test('resetMatch() clears no-chips modal', () => {
    const game = useGameStore()
    game.resetMatch()
    game.state.players[0].chips = 0
    game.state.stage = 'end'

    game.start()
    expect(game.noChipsModal).toBe(true)

    game.resetMatch()
    expect(game.noChipsModal).toBe(false)
  })

  test('start() shows match-won modal when hero is only player with chips', () => {
    const game = useGameStore()
    game.resetMatch()
    game.state.stage = 'end'
    game.state.players[0].chips = 10
    for (let i = 1; i < game.state.players.length; i += 1) game.state.players[i].chips = 0

    game.start()

    expect(game.matchWonModal).toBe(true)
    expect(game.state.stage).toBe('end')
  })

  test('resetMatch() clears match-won modal', () => {
    const game = useGameStore()
    game.resetMatch()
    game.state.stage = 'end'
    game.state.players[0].chips = 10
    for (let i = 1; i < game.state.players.length; i += 1) game.state.players[i].chips = 0

    game.start()
    expect(game.matchWonModal).toBe(true)

    game.resetMatch()
    expect(game.matchWonModal).toBe(false)
  })

  test('auto shows no-chips modal at end when hero chips drop to 0', async () => {
    const game = useGameStore()
    game.resetMatch()
    game.state.stage = 'end'
    expect(game.noChipsModal).toBe(false)
    expect(game.noChipsBanner).toBe(false)

    game.state.players[0].chips = 0
    await nextTick()

    expect(game.noChipsModal).toBe(false)
    expect(game.noChipsBanner).toBe(true)
  })
})

