import { ASSETS } from '../src/shared/assets.ts'
import type { MarketResponse, PricePoint } from '../src/types.ts'

const cache = new Map<string, { expires: number; data: MarketResponse }>()

type YahooResponse = {
  chart?: {
    result?: Array<{
      meta: { currency?: string; exchangeName?: string; longName?: string }
      timestamp?: number[]
      indicators?: { adjclose?: Array<{ adjclose?: Array<number | null> }> }
    }>
    error?: unknown
  }
}

const YAHOO_HOSTS = ['query2.finance.yahoo.com', 'query1.finance.yahoo.com'] as const

function yahooChartUrl(host: (typeof YAHOO_HOSTS)[number], ticker: string) {
  return `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1d&events=div%2Csplits`
}

async function fetchYahooChart(ticker: (typeof ASSETS)[number]['ticker']): Promise<YahooResponse> {
  let lastError: unknown

  for (const host of YAHOO_HOSTS) {
    try {
      const response = await fetch(yahooChartUrl(host, ticker), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 GEM-Kompas/0.1',
        },
        signal: AbortSignal.timeout(12_000),
      })
      const body = await response.text()

      if (!response.ok) {
        throw new Error(`Źródło danych zwróciło ${response.status} dla ${ticker}`)
      }

      try {
        return JSON.parse(body) as YahooResponse
      } catch {
        throw new Error(`Źródło danych zwróciło nieprawidłową odpowiedź dla ${ticker}`)
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Nie udało się pobrać notowań dla ${ticker}`)
}

function normalizePoints(timestamps: number[], closes: Array<number | null>): PricePoint[] {
  const raw = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      close: closes[index],
    }))
    .filter((point): point is { date: string; close: number } => Number.isFinite(point.close))

  if (raw.length < 2) throw new Error('Za mało danych do policzenia 12 miesięcy')
  return raw.map((point) => ({ ...point, normalized: 0 }))
}

function previousMonthEnd(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10)
}

function oneYearEarlier(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCFullYear(date.getUTCFullYear() - 1)
  return date.toISOString().slice(0, 10)
}

function lastPointOnOrBefore(points: PricePoint[], isoDate: string) {
  return points.filter((point) => point.date <= isoDate).at(-1)
}

async function fetchAsset(ticker: (typeof ASSETS)[number]['ticker']) {
  const payload = await fetchYahooChart(ticker)
  const result = payload.chart?.result?.[0]
  const timestamps = result?.timestamp
  const closes = result?.indicators?.adjclose?.[0]?.adjclose
  if (!result || !timestamps || !closes) throw new Error(`Brak notowań dla ${ticker}`)

  const rawPoints = normalizePoints(timestamps, closes)
  const requestedSignalDate = previousMonthEnd()
  const signalEnd = lastPointOnOrBefore(rawPoints, requestedSignalDate)
  if (!signalEnd) throw new Error(`Brak ceny końcowej sygnału dla ${ticker}`)
  const requestedSignalStart = oneYearEarlier(signalEnd.date)
  const signalStart = lastPointOnOrBefore(rawPoints, requestedSignalStart)
  if (!signalStart) throw new Error(`Brak ceny początkowej sygnału dla ${ticker}`)

  const points = rawPoints
    .filter((point) => point.date >= signalStart.date && point.date <= signalEnd.date)
    .map((point) => ({ ...point, normalized: ((point.close / signalStart.close) - 1) * 100 }))
  const last = rawPoints.at(-1)!

  return {
    ticker,
    currency: result.meta.currency ?? 'USD',
    exchange: result.meta.exchangeName ?? 'LSE',
    longName: result.meta.longName ?? ticker,
    lastPrice: last.close,
    signalPrice: signalEnd.close,
    signalStartPrice: signalStart.close,
    return12m: ((signalEnd.close / signalStart.close) - 1) * 100,
    lastTradingDay: last.date,
    signalDate: signalEnd.date,
    signalStartDate: signalStart.date,
    points,
  }
}

export async function getMarketData(): Promise<MarketResponse> {
  const cached = cache.get('market')
  if (cached && cached.expires > Date.now()) return cached.data

  const assets = await Promise.all(ASSETS.map((asset) => fetchAsset(asset.ticker)))
  const data: MarketResponse = {
    generatedAt: new Date().toISOString(),
    source: 'Yahoo Finance — notowania LSE, ceny skorygowane',
    signalDate: assets.map((asset) => asset.signalDate).sort()[0],
    signalStartDate: assets.map((asset) => asset.signalStartDate).sort()[0],
    assets,
  }

  cache.set('market', { expires: Date.now() + 15 * 60 * 1000, data })
  return data
}
