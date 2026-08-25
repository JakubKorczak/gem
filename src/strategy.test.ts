import { describe, expect, it } from 'vitest'
import { calculateGemSignal } from './strategy'
import type { AssetMarketData } from './types'

function asset(ticker: AssetMarketData['ticker'], return12m: number): AssetMarketData {
  return {
    ticker, return12m, currency: 'USD', exchange: 'LSE', longName: ticker,
    lastPrice: 100, signalPrice: 99, signalStartPrice: 90,
    lastTradingDay: '2026-08-25', signalDate: '2026-07-31', signalStartDate: '2025-07-31', points: [],
  }
}

describe('adaptowany sygnał GEM', () => {
  it('wybiera silniejszy rynek akcji, gdy pokonuje gotówkę', () => {
    const signal = calculateGemSignal([
      asset('EIMI.L', 18), asset('IWDA.L', 12), asset('CNDX.L', 16), asset('CBU0.L', 5), asset('IB01.L', 4),
    ])
    expect(signal.riskOn).toBe(true)
    expect(signal.selected.ticker).toBe('EIMI.L')
  })

  it('przechodzi do silniejszego aktywa obronnego, gdy akcje nie pokonują gotówki', () => {
    const signal = calculateGemSignal([
      asset('EIMI.L', -4), asset('IWDA.L', 2), asset('CNDX.L', 1), asset('CBU0.L', 6), asset('IB01.L', 4),
    ])
    expect(signal.riskOn).toBe(false)
    expect(signal.selected.ticker).toBe('CBU0.L')
  })

  it('pozostaje w IB01, gdy w trybie obronnym długie obligacje są słabsze', () => {
    const signal = calculateGemSignal([
      asset('EIMI.L', -4), asset('IWDA.L', 2), asset('CNDX.L', 1), asset('CBU0.L', -1), asset('IB01.L', 4),
    ])
    expect(signal.selected.ticker).toBe('IB01.L')
  })

  it('uwzględnia Nasdaq 100 w rankingu części akcyjnej', () => {
    const signal = calculateGemSignal([
      asset('EIMI.L', 10), asset('IWDA.L', 14), asset('CNDX.L', 19), asset('CBU0.L', 5), asset('IB01.L', 4),
    ])
    expect(signal.equityWinner.ticker).toBe('CNDX.L')
    expect(signal.selected.ticker).toBe('CNDX.L')
  })

  it('utrzymuje obecną pozycję, gdy kandydat ma mniej niż 3 p.p. przewagi', () => {
    const signal = calculateGemSignal([
      asset('EIMI.L', 12), asset('IWDA.L', 16), asset('CNDX.L', 18.9), asset('CBU0.L', 5), asset('IB01.L', 4),
    ], 'IWDA.L')
    expect(signal.candidate.ticker).toBe('CNDX.L')
    expect(signal.selected.ticker).toBe('IWDA.L')
    expect(signal.switchBuffered).toBe(true)
    expect(signal.switchAdvantage).toBeCloseTo(2.9)
  })

  it('zmienia pozycję, gdy kandydat osiąga co najmniej 3 p.p. przewagi', () => {
    const signal = calculateGemSignal([
      asset('EIMI.L', 12), asset('IWDA.L', 16), asset('CNDX.L', 19), asset('CBU0.L', 5), asset('IB01.L', 4),
    ], 'IWDA.L')
    expect(signal.selected.ticker).toBe('CNDX.L')
    expect(signal.switchBuffered).toBe(false)
  })
})
