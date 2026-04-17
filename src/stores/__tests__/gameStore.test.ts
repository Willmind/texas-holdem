import { beforeEach, describe, expect, test } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
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
})

