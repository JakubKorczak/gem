import { calculateMomentumSelection } from './strategy'

export type PriceRow<Ticker extends string> = {
  date: string
  prices: Record<Ticker, number>
}

export type BacktestConfig<Ticker extends string> = {
  equities: readonly Ticker[]
  bond: Ticker
  cash: Ticker
  switchBufferPercentagePoints: number
  transactionCostBps: number
  expectedMonthEndDates: readonly string[]
}

export type BacktestDecision<Ticker extends string> = {
  date: string
  executionDate: string
  selected: Ticker
  candidate: Ticker
  riskOn: boolean
  buffered: boolean
  forcedRiskOff: boolean
}

export type BacktestResult<Ticker extends string> = {
  from: string
  to: string
  months: number
  cagrPercent: number
  dailyVolatilityPercent: number
  monthlyVolatilityPercent: number
  dailyMaxDrawdownPercent: number
  monthlyMaxDrawdownPercent: number
  switches: number
  annualTurnoverPercent: number
  potentialTaxEvents: number
  bufferedChanges: number
  riskOnMonths: number
  timeInAssets: Partial<Record<Ticker, number>>
  decisions: BacktestDecision<Ticker>[]
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1))
}

function maxDrawdown(values: number[]) {
  let peak = values[0] ?? 1
  let drawdown = 0
  for (const value of values) {
    peak = Math.max(peak, value)
    drawdown = Math.min(drawdown, (value / peak) - 1)
  }
  return drawdown
}

function validateRows<Ticker extends string>(rows: PriceRow<Ticker>[], tickers: readonly Ticker[]) {
  if (rows.length < 14) throw new Error('Backtest wymaga co najmniej 14 miesięcy danych')
  for (let index = 0; index < rows.length; index += 1) {
    if (index > 0 && rows[index - 1].date >= rows[index].date) {
      throw new Error('Daty backtestu muszą być unikalne i rosnące')
    }
    if (tickers.some((ticker) => !Number.isFinite(rows[index].prices[ticker]) || rows[index].prices[ticker] <= 0)) {
      throw new Error(`Brak poprawnej ceny w dniu ${rows[index].date}`)
    }
  }
}

function resolveMonthEndIndexes<Ticker extends string>(
  rows: PriceRow<Ticker>[],
  expectedMonthEndDates: readonly string[],
) {
  if (expectedMonthEndDates.length < 14) {
    throw new Error('Backtest wymaga co najmniej 14 zweryfikowanych month-endów')
  }

  const uniqueDates = new Set(expectedMonthEndDates)
  if (uniqueDates.size !== expectedMonthEndDates.length) {
    throw new Error('Daty month-endów muszą być unikalne')
  }
  for (let index = 1; index < expectedMonthEndDates.length; index += 1) {
    if (expectedMonthEndDates[index - 1] >= expectedMonthEndDates[index]) {
      throw new Error('Daty month-endów muszą być rosnące')
    }
  }

  const indexesByDate = new Map(rows.map((row, index) => [row.date, index]))
  return expectedMonthEndDates.map((date) => {
    const index = indexesByDate.get(date)
    if (index === undefined) throw new Error(`Brak oczekiwanego month-endu ${date} w danych backtestu`)
    return index
  })
}

export function runMomentumBacktest<Ticker extends string>(
  rows: PriceRow<Ticker>[],
  config: BacktestConfig<Ticker>,
): BacktestResult<Ticker> {
  const tickers = [...new Set([...config.equities, config.bond, config.cash])]
  validateRows(rows, tickers)

  const monthEndIndexes = resolveMonthEndIndexes(rows, config.expectedMonthEndDates)

  let wealth = 1
  let holding: Ticker | undefined
  let switches = 0
  let bufferedChanges = 0
  let riskOnMonths = 0
  const dailyReturns: number[] = []
  const monthlyReturns: number[] = []
  const dailyWealth = [wealth]
  const monthlyWealth = [wealth]
  const decisions: BacktestDecision<Ticker>[] = []
  const timeInAssets: Partial<Record<Ticker, number>> = {}

  for (let monthIndex = 12; monthIndex < monthEndIndexes.length - 1; monthIndex += 1) {
    const startIndex = monthEndIndexes[monthIndex - 12]
    const signalIndex = monthEndIndexes[monthIndex]
    const nextSignalIndex = monthEndIndexes[monthIndex + 1]
    const returns = Object.fromEntries(tickers.map((ticker) => [
      ticker,
      ((rows[signalIndex].prices[ticker] / rows[startIndex].prices[ticker]) - 1) * 100,
    ])) as Record<Ticker, number>
    const selection = calculateMomentumSelection(returns, {
      equities: config.equities,
      bond: config.bond,
      cash: config.cash,
      currentHolding: holding,
      switchBufferPercentagePoints: config.switchBufferPercentagePoints,
    })
    const previousHolding = holding
    const changed = previousHolding !== undefined && previousHolding !== selection.selected
    const executionIndex = signalIndex + 1
    if (executionIndex > nextSignalIndex) {
      throw new Error(`Brak sesji wykonania po sygnale ${rows[signalIndex].date}`)
    }
    if (changed) switches += 1
    if (selection.switchBuffered) bufferedChanges += 1
    if (selection.riskOn) riskOnMonths += 1
    const selected = selection.selected
    timeInAssets[selected] = (timeInAssets[selected] ?? 0) + 1
    decisions.push({
      date: rows[signalIndex].date,
      executionDate: rows[executionIndex].date,
      selected,
      candidate: selection.candidate,
      riskOn: selection.riskOn,
      buffered: selection.switchBuffered,
      forcedRiskOff: selection.forcedRiskOff,
    })

    const monthStartWealth = wealth
    const executionReturn = previousHolding
      ? (rows[executionIndex].prices[previousHolding] / rows[signalIndex].prices[previousHolding]) - 1
      : 0
    const executionCostMultiplier = changed ? 1 - (config.transactionCostBps / 10_000) : 1
    const wealthBeforeExecution = wealth
    wealth *= (1 + executionReturn) * executionCostMultiplier
    dailyReturns.push((wealth / wealthBeforeExecution) - 1)
    dailyWealth.push(wealth)
    holding = selected

    for (let rowIndex = executionIndex + 1; rowIndex <= nextSignalIndex; rowIndex += 1) {
      const priceReturn = (rows[rowIndex].prices[holding] / rows[rowIndex - 1].prices[holding]) - 1
      const previousWealth = wealth
      wealth *= 1 + priceReturn
      dailyReturns.push((wealth / previousWealth) - 1)
      dailyWealth.push(wealth)
    }
    monthlyReturns.push((wealth / monthStartWealth) - 1)
    monthlyWealth.push(wealth)
  }

  const firstDate = rows[monthEndIndexes[12]].date
  const lastDate = rows[monthEndIndexes.at(-1)!].date
  const elapsedYears = (Date.parse(`${lastDate}T12:00:00Z`) - Date.parse(`${firstDate}T12:00:00Z`))
    / (365.2425 * 24 * 60 * 60 * 1000)

  return {
    from: firstDate,
    to: lastDate,
    months: monthlyReturns.length,
    cagrPercent: ((wealth ** (1 / elapsedYears)) - 1) * 100,
    dailyVolatilityPercent: standardDeviation(dailyReturns) * Math.sqrt(252) * 100,
    monthlyVolatilityPercent: standardDeviation(monthlyReturns) * Math.sqrt(12) * 100,
    dailyMaxDrawdownPercent: maxDrawdown(dailyWealth) * 100,
    monthlyMaxDrawdownPercent: maxDrawdown(monthlyWealth) * 100,
    switches,
    annualTurnoverPercent: monthlyReturns.length > 0 ? (switches / (monthlyReturns.length / 12)) * 100 : 0,
    potentialTaxEvents: switches,
    bufferedChanges,
    riskOnMonths,
    timeInAssets,
    decisions,
  }
}
