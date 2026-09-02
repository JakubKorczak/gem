import { describe, expect, it } from 'vitest'
import { prepareScenarioSeries, type PriceSeries } from './backtest-series'

const series = (entries: Array<[string, number]>): PriceSeries => new Map(entries)

function monthlySeries(missing?: string) {
  const entries: Array<[string, number]> = []
  for (let month = 0; month < 15; month += 1) {
    const date = new Date(Date.UTC(2024, month + 1, 0)).toISOString().slice(0, 10)
    if (date !== missing) entries.push([date, 100 + month])
  }
  return series(entries)
}

describe('przygotowanie osi sesji backtestu', () => {
  it('nie przesuwa month-endu na wcześniejszą wspólną datę', () => {
    const anchor = monthlySeries()
    const missingDate = [...anchor.keys()][13]
    const incomplete = monthlySeries(missingDate)
    incomplete.set('2025-02-27', 112.5)

    expect(() => prepareScenarioSeries({
      scenarioName: 'Test LSE',
      tickers: ['A', 'B'],
      prices: new Map([['A', monthlySeries()], ['B', incomplete]]),
      sessionAnchor: anchor,
      currentSignalMonth: '2025-04',
    })).toThrow(`Scenariusz "Test LSE": brak notowania B w oczekiwanym month-end ${missingDate}`)
  })

  it('zwraca dokładne month-endy z serii referencyjnej', () => {
    const anchor = monthlySeries()
    const prepared = prepareScenarioSeries({
      scenarioName: 'Test USA',
      tickers: ['A', 'B'],
      prices: new Map([['A', monthlySeries()], ['B', monthlySeries()]]),
      sessionAnchor: anchor,
      currentSignalMonth: '2025-04',
    })

    expect(prepared.expectedMonthEndDates).toEqual([...anchor.keys()])
    expect(prepared.rows.map((row) => row.date)).toEqual([...anchor.keys()])
  })
})
