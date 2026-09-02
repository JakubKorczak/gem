import { ASSETS } from '../src/shared/assets.js'
import { LSE_CALENDAR_VERIFIED_THROUGH_YEAR, signalPeriod } from '../src/calendar.js'
import type { MarketErrorCode, MarketResponse, PricePoint } from '../src/types.js'

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
export const YAHOO_MAX_UPSTREAM_WAIT_MS = 16_000
const YAHOO_HOST_TIMEOUT_MS = YAHOO_MAX_UPSTREAM_WAIT_MS / YAHOO_HOSTS.length

export class MarketDataError extends Error {
  constructor(public readonly code: MarketErrorCode, message: string) {
    super(message)
    this.name = 'MarketDataError'
  }
}

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
        signal: AbortSignal.timeout(YAHOO_HOST_TIMEOUT_MS),
      })
      const body = await response.text()

      if (!response.ok) {
        throw new MarketDataError('UPSTREAM_UNAVAILABLE', `Źródło danych zwróciło ${response.status} dla ${ticker}`)
      }

      try {
        return JSON.parse(body) as YahooResponse
      } catch {
        throw new MarketDataError('INVALID_UPSTREAM_DATA', `Źródło danych zwróciło nieprawidłową odpowiedź dla ${ticker}`)
      }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof MarketDataError) throw lastError
  throw new MarketDataError(
    'UPSTREAM_UNAVAILABLE',
    lastError instanceof Error ? lastError.message : `Nie udało się pobrać notowań dla ${ticker}`,
  )
}

function normalizePoints(timestamps: number[], closes: Array<number | null>): PricePoint[] {
  if (timestamps.length !== closes.length) {
    throw new MarketDataError('INVALID_UPSTREAM_DATA', 'Niespójna liczba dat i cen w źródle danych')
  }
  const raw = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      close: closes[index],
    }))
    .filter((point) => point.close === null || Number.isFinite(point.close))
    .filter((point): point is { date: string; close: number } => point.close !== null)

  if (raw.length < 2 || raw.some((point) => point.close <= 0)) {
    throw new MarketDataError('INVALID_UPSTREAM_DATA', 'Za mało poprawnych danych do policzenia 12 miesięcy')
  }
  for (let index = 1; index < raw.length; index += 1) {
    if (raw[index - 1].date >= raw[index].date) {
      throw new MarketDataError('INVALID_UPSTREAM_DATA', 'Daty notowań są nieuporządkowane lub zduplikowane')
    }
  }
  return raw.map((point) => ({ ...point, normalized: 0 }))
}

type AssetHistory = {
  ticker: (typeof ASSETS)[number]['ticker']
  currency: string
  exchange: string
  longName: string
  points: PricePoint[]
}

function pointAt(history: AssetHistory, isoDate: string) {
  return history.points.find((point) => point.date === isoDate)
}

async function fetchAssetHistory(ticker: (typeof ASSETS)[number]['ticker']): Promise<AssetHistory> {
  const payload = await fetchYahooChart(ticker)
  const result = payload.chart?.result?.[0]
  const timestamps = result?.timestamp
  const closes = result?.indicators?.adjclose?.[0]?.adjclose
  if (!result || !timestamps || !closes) {
    throw new MarketDataError('INVALID_UPSTREAM_DATA', `Brak notowań dla ${ticker}`)
  }
  if (result.meta.currency !== 'USD' || result.meta.exchangeName !== 'LSE') {
    throw new MarketDataError(
      'INVALID_UPSTREAM_DATA',
      `Nieoczekiwany rynek lub waluta dla ${ticker}`,
    )
  }

  return {
    ticker,
    currency: result.meta.currency,
    exchange: result.meta.exchangeName,
    longName: result.meta.longName ?? ticker,
    points: normalizePoints(timestamps, closes),
  }
}

function buildAsset(history: AssetHistory, signalStartDate: string, signalDate: string) {
  const signalStart = pointAt(history, signalStartDate)
  const signalEnd = pointAt(history, signalDate)
  if (!signalStart || !signalEnd) {
    throw new MarketDataError(
      'INCOMPLETE_MONTH_END',
      `Brak oczekiwanego notowania dla ${history.ticker}: ${!signalStart ? signalStartDate : signalDate}`,
    )
  }

  const points = history.points
    .filter((point) => point.date >= signalStart.date && point.date <= signalEnd.date)
    .map((point) => ({ ...point, normalized: ((point.close / signalStart.close) - 1) * 100 }))
  const last = history.points.at(-1)!

  return {
    ticker: history.ticker,
    currency: history.currency,
    exchange: history.exchange,
    longName: history.longName,
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
  const period = signalPeriod()
  if (!period.calendarVerified) {
    throw new MarketDataError(
      'UNVERIFIED_CALENDAR',
      `Kalendarz LSE nie został jeszcze zweryfikowany dla sygnału ${period.signalMonth}`,
    )
  }

  const cached = cache.get(period.signalMonth)
  if (cached && cached.expires > Date.now()) return cached.data

  const histories = await Promise.all(ASSETS.map((asset) => fetchAssetHistory(asset.ticker)))
  const assets = histories.map((history) => buildAsset(history, period.signalStartDate, period.signalDate))
  const data: MarketResponse = {
    generatedAt: new Date().toISOString(),
    source: 'Yahoo Finance — notowania LSE, ceny skorygowane',
    signalMonth: period.signalMonth,
    signalDate: period.signalDate,
    signalStartDate: period.signalStartDate,
    quality: {
      status: 'verified',
      expectedSignalDate: period.signalDate,
      expectedSignalStartDate: period.signalStartDate,
      calendarVerifiedThroughYear: LSE_CALENDAR_VERIFIED_THROUGH_YEAR,
    },
    assets,
  }

  cache.set(period.signalMonth, { expires: Date.now() + 15 * 60 * 1000, data })
  return data
}
