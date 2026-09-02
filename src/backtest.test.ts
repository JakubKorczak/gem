import { describe, expect, it } from 'vitest'
import { runMomentumBacktest, type PriceRow } from './backtest'

type Ticker = 'A' | 'B' | 'D' | 'C'

function rows(): PriceRow<Ticker>[] {
  const result: PriceRow<Ticker>[] = []
  for (let month = 0; month < 16; month += 1) {
    result.push({
      date: new Date(Date.UTC(2024, month, 28)).toISOString().slice(0, 10),
      prices: {
        A: 100 + month * 2,
        B: 100 + month,
        D: 100 + month * 0.4,
        C: 100 + month * 0.2,
      },
    })
  }
  return result
}

function switchingRows() {
  const data = rows()
  data[13].prices.A = 90
  data[13].prices.B = 130
  data[14].prices.B = 135
  data[15].prices.B = 140
  return data
}

const monthEnds = (data: PriceRow<Ticker>[]) => data.filter((row) => row.date.endsWith('-28')).map((row) => row.date)

function config(data: PriceRow<Ticker>[], transactionCostBps = 0) {
  return {
    equities: ['A', 'B'] as const,
    bond: 'D' as const,
    cash: 'C' as const,
    switchBufferPercentagePoints: 0,
    transactionCostBps,
    expectedMonthEndDates: monthEnds(data),
  }
}

function executionRows(options: {
  oldHoldingAtExecution?: number
  newHoldingAtExecution?: number
  newHoldingAfterExecution?: number
} = {}) {
  const oldHoldingAtExecution = options.oldHoldingAtExecution ?? 90
  const newHoldingAtExecution = options.newHoldingAtExecution ?? 160
  const newHoldingAfterExecution = options.newHoldingAfterExecution ?? newHoldingAtExecution
  const data = rows()
  data[13].prices.A = 90
  data[13].prices.B = 160
  data[14].prices.A = oldHoldingAtExecution
  data[14].prices.B = newHoldingAfterExecution
  data[15].prices.A = oldHoldingAtExecution
  data[15].prices.B = newHoldingAfterExecution
  data.push(
    {
      date: '2025-01-29',
      prices: { ...data[12].prices },
    },
    {
      date: '2025-03-03',
      prices: { ...data[13].prices, A: oldHoldingAtExecution, B: newHoldingAtExecution },
    },
    {
      date: '2025-03-04',
      prices: { ...data[13].prices, A: oldHoldingAtExecution, B: newHoldingAfterExecution },
    },
  )
  return data.sort((a, b) => a.date.localeCompare(b.date))
}

describe('silnik backtestu', () => {
  it('używa sygnału z końca miesiąca dopiero dla następnego okresu', () => {
    const data = rows()
    data.at(-1)!.prices.B = 10_000

    const result = runMomentumBacktest(data, config(data))

    expect(result.decisions[0].selected).toBe('A')
  })

  it('odejmuje jawny koszt przy zmianie pozycji i raportuje zdarzenia', () => {
    const withoutCostsData = switchingRows()
    const withCostsData = switchingRows()
    const withoutCosts = runMomentumBacktest(withoutCostsData, config(withoutCostsData))
    const withCosts = runMomentumBacktest(withCostsData, config(withCostsData, 25))

    expect(withCosts.switches).toBeGreaterThan(0)
    expect(withCosts.cagrPercent).toBeLessThan(withoutCosts.cagrPercent)
    expect(withCosts.potentialTaxEvents).toBe(withCosts.switches)
    expect(withCosts.annualTurnoverPercent).toBeGreaterThan(0)
    expect(withCosts.dailyMaxDrawdownPercent).toBeLessThanOrEqual(0)
    expect(withCosts.monthlyMaxDrawdownPercent).toBeLessThanOrEqual(0)
  })

  it('wymaga dokładnej, rosnącej osi zweryfikowanych month-endów', () => {
    const data = rows()
    const expectedMonthEndDates = monthEnds(data)
    expectedMonthEndDates[13] = '2025-02-27'

    expect(() => runMomentumBacktest(data, {
      ...config(data),
      expectedMonthEndDates,
    })).toThrow('Brak oczekiwanego month-endu 2025-02-27')
  })

  it('wykonuje zmianę na następnym zamknięciu bez zaliczania wcześniejszej luki nowego aktywa', () => {
    const regularGap = executionRows({ newHoldingAtExecution: 160, newHoldingAfterExecution: 160 })
    const largeGap = executionRows({ newHoldingAtExecution: 1_600, newHoldingAfterExecution: 1_600 })
    const regular = runMomentumBacktest(regularGap, config(regularGap))
    const large = runMomentumBacktest(largeGap, config(largeGap))

    expect(regular.decisions[1]).toMatchObject({
      date: '2025-02-28',
      executionDate: '2025-03-03',
      selected: 'B',
    })
    expect(large.cagrPercent).toBeCloseTo(regular.cagrPercent)
  })

  it('utrzymuje starą pozycję do zamknięcia dnia wykonania', () => {
    const flatOldHolding = executionRows({ oldHoldingAtExecution: 90 })
    const risingOldHolding = executionRows({ oldHoldingAtExecution: 99 })

    expect(runMomentumBacktest(risingOldHolding, config(risingOldHolding)).cagrPercent)
      .toBeGreaterThan(runMomentumBacktest(flatOldHolding, config(flatOldHolding)).cagrPercent)
  })

  it('nalicza zwrot nowej pozycji dopiero po dniu wykonania', () => {
    const flatNewHolding = executionRows({ newHoldingAtExecution: 160, newHoldingAfterExecution: 160 })
    const risingNewHolding = executionRows({ newHoldingAtExecution: 160, newHoldingAfterExecution: 176 })

    expect(runMomentumBacktest(risingNewHolding, config(risingNewHolding)).cagrPercent)
      .toBeGreaterThan(runMomentumBacktest(flatNewHolding, config(flatNewHolding)).cagrPercent)
  })
})
