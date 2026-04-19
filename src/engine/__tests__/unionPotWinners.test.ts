import { describe, expect, test } from 'vitest'
import { unionPotWinnerIndexes } from '../game'

describe('unionPotWinnerIndexes', () => {
  test('merges winners across pots without duplicates', () => {
    expect(unionPotWinnerIndexes([{ winners: [0] }, { winners: [0, 1] }])).toEqual([0, 1])
  })

  test('empty pots', () => {
    expect(unionPotWinnerIndexes([])).toEqual([])
  })
})
