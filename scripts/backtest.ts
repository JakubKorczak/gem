import { runMomentumBacktest } from '../src/backtest.js'
import { prepareScenarioSeries } from '../src/backtest-series.js'
import { signalPeriod } from '../src/calendar.js'

type Scenario = {
  name: string
  note: string
  equities: string[]
  bond: string
  cash: string
  sessionAnchor: '^FTSE' | 'SPY'
}

const scenarios: Scenario[] = [
  {
    name: 'UCITS — obecny koszyk',
    note: 'Dokładne londyńskie ETF-y używane przez aplikację.',
    equities: ['EIMI.L', 'IWDA.L', 'CNDX.L'], bond: 'CBU0.L', cash: 'IB01.L', sessionAnchor: '^FTSE',
  },
  {
    name: 'UCITS — bez CNDX',
    note: 'Test wpływu usunięcia skoncentrowanej nogi Nasdaq 100.',
    equities: ['EIMI.L', 'IWDA.L'], bond: 'CBU0.L', cash: 'IB01.L', sessionAnchor: '^FTSE',
  },
  {
    name: 'Proxy — rozszerzona historia',
    note: 'Amerykańskie proxy EEM/URTH/QQQ/IEF/BIL; nie są identyczne z ETF-ami UCITS.',
    equities: ['EEM', 'URTH', 'QQQ'], bond: 'IEF', cash: 'BIL', sessionAnchor: 'SPY',
  },
  {
    name: 'Klasyczny punkt odniesienia GEM',
    note: 'SPY/VEU z AGG jako aktywem ochronnym i BIL jako progiem absolutnego momentum.',
    equities: ['SPY', 'VEU'], bond: 'AGG', cash: 'BIL', sessionAnchor: 'SPY',
  },
]

const buffers = [0, 1, 2, 3, 5]
const costs = [0, 10, 25]

async function fetchPrices(ticker: string) {
  const hosts = ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']
  const period2 = Math.floor(Date.now() / 1000)
  let lastError: unknown
  for (const host of hosts) {
    try {
      const response = await fetch(
        `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?period1=0&period2=${period2}&interval=1d&events=div%2Csplits`,
        { signal: AbortSignal.timeout(15_000) },
      )
      if (!response.ok) throw new Error(`${ticker}: HTTP ${response.status}`)
      const payload = await response.json() as {
        chart?: { result?: Array<{
          meta?: { dataGranularity?: string }
          timestamp?: number[]
          indicators?: { adjclose?: Array<{ adjclose?: Array<number | null> }> }
        }> }
      }
      const result = payload.chart?.result?.[0]
      if (result?.meta?.dataGranularity !== '1d') {
        throw new Error(`${ticker}: Yahoo zwróciło częstotliwość ${result?.meta?.dataGranularity ?? 'nieznaną'} zamiast 1d`)
      }
      const timestamps = result?.timestamp
      const closes = result?.indicators?.adjclose?.[0]?.adjclose
      if (!timestamps || !closes) throw new Error(`${ticker}: brak danych`)
      const observations = new Map(timestamps.flatMap((timestamp, index) => {
        const close = closes[index]
        return Number.isFinite(close) && close !== null && close > 0
          ? [[new Date(timestamp * 1000).toISOString().slice(0, 10), close] as const]
          : []
      }))
      if (observations.size < 250) throw new Error(`${ticker}: zbyt krótka seria dzienna (${observations.size} obserwacji)`)
      return observations
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

function format(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/d'
}

async function main() {
  const allTickers = [...new Set(scenarios.flatMap((scenario) => [
    ...scenario.equities, scenario.bond, scenario.cash, scenario.sessionAnchor,
  ]))]
  const priceEntries = await Promise.all(allTickers.map(async (ticker) => [ticker, await fetchPrices(ticker)] as const))
  const prices = new Map(priceEntries)
  const currentSignalMonth = signalPeriod().signalMonth
  const results = scenarios.map((scenario) => {
    const tickers = [...new Set([...scenario.equities, scenario.bond, scenario.cash])]
    const { rows, expectedMonthEndDates } = prepareScenarioSeries({
      scenarioName: scenario.name,
      tickers,
      prices,
      sessionAnchor: prices.get(scenario.sessionAnchor)!,
      currentSignalMonth,
    })
    return {
      scenario: scenario.name,
      note: scenario.note,
      variants: buffers.flatMap((buffer) => costs.map((cost) => ({
        bufferPercentagePoints: buffer,
        transactionCostBps: cost,
        result: runMomentumBacktest(rows, {
          equities: scenario.equities,
          bond: scenario.bond,
          cash: scenario.cash,
          switchBufferPercentagePoints: buffer,
          transactionCostBps: cost,
          expectedMonthEndDates,
        }),
      }))),
    }
  })
  const report = {
    generatedAt: new Date().toISOString(),
    source: 'Yahoo Finance adjusted close',
    methodology: [
      'Źródło musi jawnie potwierdzić dane dzienne; raport przerywa pracę, jeśli Yahoo zwróci serię o innej częstotliwości.',
      'Sygnał powstaje na końcu miesiąca i jest stosowany dopiero w następnym okresie.',
      'Decyzja jest wykonywana po cenie zamknięcia następnej wspólnej sesji; wcześniejszy ruch nowego aktywa nie trafia do wyniku.',
      'Month-endy pochodzą z osi sesji ^FTSE dla LSE i SPY dla USA. Brak notowania któregokolwiek aktywa w oczekiwanej dacie przerywa raport.',
      'Bufor jest asymetryczny: ogranicza zwykłe rotacje i powrót do akcji, ale nigdy nie opóźnia wyjścia z akcji do ochrony.',
      'Wyniki nie obejmują podatku; liczba zmian jest przybliżeniem potencjalnych zdarzeń podatkowych.',
      'Koszt jest odejmowany przy każdej zmianie aktywa. Wyniki historyczne nie gwarantują przyszłych rezultatów.',
    ],
    results,
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log('# Walidacja strategii GEM Kompas\n')
  console.log(`Wygenerowano: ${report.generatedAt}\n`)
  report.methodology.forEach((line) => console.log(`- ${line}`))
  for (const scenario of results) {
    console.log(`\n## ${scenario.scenario}\n\n${scenario.note}\n`)
    console.log('| Bufor | Koszt | Okres | CAGR | Zmienność dzienna | Zmienność miesięczna | Max DD dzienny | Max DD miesięczny | Zmiany | Obrót roczny | Zdarzenia podatkowe* |')
    console.log('|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|')
    for (const variant of scenario.variants) {
      const result = variant.result
      console.log(`| ${variant.bufferPercentagePoints} p.p. | ${variant.transactionCostBps} pb | ${result.from}–${result.to} | ${format(result.cagrPercent)}% | ${format(result.dailyVolatilityPercent)}% | ${format(result.monthlyVolatilityPercent)}% | ${format(result.dailyMaxDrawdownPercent)}% | ${format(result.monthlyMaxDrawdownPercent)}% | ${result.switches} | ${format(result.annualTurnoverPercent)}% | ${result.potentialTaxEvents} |`)
    }
    const representative = scenario.variants.find((variant) => variant.bufferPercentagePoints === 3 && variant.transactionCostBps === 10)!
    console.log('\nCzas w aktywach dla obecnego bufora 3 p.p. i kosztu 10 pb:')
    for (const [ticker, months] of Object.entries(representative.result.timeInAssets)) {
      if (months === undefined) continue
      console.log(`- ${ticker}: ${months} mies. (${format((months / representative.result.months) * 100)}%)`)
    }
    console.log('\nUwaga: jedna pełna zmiana pozycji jest liczona jako jedno potencjalne zdarzenie podatkowe; raport nie przypisuje mu stawki podatku.')
  }
}

await main()
