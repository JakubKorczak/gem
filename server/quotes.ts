import { ASSETS } from '../src/shared/assets.js'
import type { AssetTicker } from '../src/shared/assets.js'
import { isPositiveNumber, isRecord } from '../src/shared/quotes.js'
import type { Quote, QuoteEntry, QuotesResponse } from '../src/shared/quotes.js'
import { fetchYahooChart } from './yahoo.js'

const cache = new Map<AssetTicker, { expires: number; quote: Quote }>()
let pending: Promise<QuotesResponse> | null = null

function timestamp(value: unknown): string | null {
  if (!isPositiveNumber(value)) return null
  const date = new Date(value * 1000)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export function parseYahooQuote(payload: unknown, ticker: AssetTicker, now = Date.now()): Quote {
  const chart = isRecord(payload) && isRecord(payload.chart) ? payload.chart : null
  const result: unknown = Array.isArray(chart?.result) ? chart.result[0] : null
  const meta = isRecord(result) && isRecord(result.meta) ? result.meta : null
  if (!meta || chart?.error || meta.symbol !== ticker || meta.currency !== 'USD' || meta.exchangeName !== 'LSE'
    || !isPositiveNumber(meta.regularMarketPrice) || !isPositiveNumber(meta.previousClose)) {
    throw new Error(`Brak poprawnej ceny LSE w USD dla ${ticker}`)
  }
  const quotedAt = timestamp(meta.regularMarketTime)
  if (!quotedAt || Date.parse(quotedAt) > now + 60_000) throw new Error(`Nieprawidłowy czas notowania ${ticker}`)
  const period = isRecord(meta.currentTradingPeriod) && isRecord(meta.currentTradingPeriod.regular)
    ? meta.currentTradingPeriod.regular : null
  const start = timestamp(period?.start)
  const end = timestamp(period?.end)
  const hasSession = start !== null && end !== null && Date.parse(start) < Date.parse(end)
  return {
    price: meta.regularMarketPrice,
    // chartPreviousClose is the start of the requested range, not necessarily yesterday.
    previousClose: meta.previousClose,
    quotedAt,
    sessionStart: hasSession ? start : null,
    sessionEnd: hasSession ? end : null,
  }
}

async function getQuote(ticker: AssetTicker): Promise<QuoteEntry> {
  const cached = cache.get(ticker)
  if (cached && cached.expires > Date.now()) return { ticker, quote: cached.quote }
  try {
    const quote = parseYahooQuote(await fetchYahooChart(ticker, '1d', '5m'), ticker)
    cache.set(ticker, { expires: Date.now() + 60_000, quote })
    return { ticker, quote }
  } catch {
    return { ticker, quote: null }
  }
}

export async function getQuotes(): Promise<QuotesResponse> {
  if (pending) return pending
  pending = Promise.all(ASSETS.map(({ ticker }) => getQuote(ticker)))
    .then((quotes) => ({ generatedAt: new Date().toISOString(), quotes }))
  try {
    return await pending
  } finally {
    pending = null
  }
}
