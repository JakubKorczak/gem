import type { PriceRow } from './backtest'

export type PriceSeries = Map<string, number>

type PrepareScenarioInput = {
  scenarioName: string
  tickers: readonly string[]
  prices: ReadonlyMap<string, PriceSeries>
  sessionAnchor: PriceSeries
  currentSignalMonth: string
}

function nextMonth(month: string) {
  const date = new Date(`${month}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return date.toISOString().slice(0, 7)
}

function firstDate(series: PriceSeries, label: string) {
  const date = [...series.keys()].sort()[0]
  if (!date) throw new Error(`Brak danych dla ${label}`)
  return date
}

function expectedMonthEnds(anchor: PriceSeries, availabilityStart: string, currentSignalMonth: string) {
  const lastAnchorByMonth = new Map<string, string>()
  for (const date of [...anchor.keys()].sort()) {
    if (date >= availabilityStart && date.slice(0, 7) < currentSignalMonth) {
      lastAnchorByMonth.set(date.slice(0, 7), date)
    }
  }

  const dates: string[] = []
  for (let month = availabilityStart.slice(0, 7); month < currentSignalMonth; month = nextMonth(month)) {
    const date = lastAnchorByMonth.get(month)
    if (!date) throw new Error(`Brak osi sesji dla zakończonego miesiąca ${month}`)
    dates.push(date)
  }
  return dates
}

export function prepareScenarioSeries({
  scenarioName,
  tickers,
  prices,
  sessionAnchor,
  currentSignalMonth,
}: PrepareScenarioInput): { rows: PriceRow<string>[]; expectedMonthEndDates: string[] } {
  if (tickers.length === 0) throw new Error(`Scenariusz "${scenarioName}" nie zawiera aktywów`)

  const scenarioSeries = tickers.map((ticker) => {
    const series = prices.get(ticker)
    if (!series) throw new Error(`Scenariusz "${scenarioName}": brak serii dla ${ticker}`)
    return [ticker, series] as const
  })
  const availabilityStart = scenarioSeries
    .map(([ticker, series]) => firstDate(series, `${scenarioName}/${ticker}`))
    .sort()
    .at(-1)!
  const expectedMonthEndDates = expectedMonthEnds(sessionAnchor, availabilityStart, currentSignalMonth)

  if (expectedMonthEndDates.length < 14) {
    throw new Error(
      `Scenariusz "${scenarioName}": backtest wymaga co najmniej 14 zweryfikowanych month-endów`,
    )
  }

  for (const date of expectedMonthEndDates) {
    for (const [ticker, series] of scenarioSeries) {
      if (!series.has(date)) {
        throw new Error(`Scenariusz "${scenarioName}": brak notowania ${ticker} w oczekiwanym month-end ${date}`)
      }
    }
  }

  const firstMonthEnd = expectedMonthEndDates[0]
  const dates = [...scenarioSeries[0][1].keys()]
    .filter((date) => date >= firstMonthEnd && date.slice(0, 7) < currentSignalMonth)
    .filter((date) => scenarioSeries.every(([, series]) => series.has(date)))
    .sort()
  const rows = dates.map((date) => ({
    date,
    prices: Object.fromEntries(scenarioSeries.map(([ticker, series]) => [ticker, series.get(date)!])),
  }))

  return { rows, expectedMonthEndDates }
}
