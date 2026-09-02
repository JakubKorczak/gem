import { describe, expect, it } from 'vitest'
import { formatPercentagePoints, formatPercent } from './format'

describe('formatowanie wyników finansowych', () => {
  it('odróżnia stopę zwrotu od różnicy w punktach procentowych', () => {
    expect(formatPercent(36.17)).toBe('+36,17%')
    expect(formatPercentagePoints(32.4)).toBe('+32,40 p.p.')
  })
})
