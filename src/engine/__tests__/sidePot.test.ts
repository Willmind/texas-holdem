import { describe, expect, test } from 'vitest'
import { buildPots } from '../sidePot.js'

describe('sidePot', () => {
  test('buildPots splits contributions into layered pots', () => {
    // Player0: 100, Player1: 250, Player2: 250
    const contrib = [100, 250, 250]
    const alive = [true, true, true]
    const pots = buildPots(contrib, alive)
    expect(pots).toEqual([
      { amount: 300, eligible: [0, 1, 2] }, // 100*3
      { amount: 300, eligible: [1, 2] }, // (250-100)*2
    ])
  })

  test('folded players are not eligible but still contribute to pot size', () => {
    const contrib = [100, 250, 250]
    const alive = [true, false, true]
    const pots = buildPots(contrib, alive)
    expect(pots).toEqual([
      { amount: 300, eligible: [0, 2] },
      { amount: 300, eligible: [2] },
    ])
  })
})

