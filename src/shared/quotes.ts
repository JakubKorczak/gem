import { ASSETS } from './assets.js'
import type { AssetTicker } from './assets.js'

export type Quote = {
  price: number
  previousClose: number
  quotedAt: string
  sessionStart: string | null
  sessionEnd: string | null
}

export type QuoteEntry = { ticker: AssetTicker; quote: Quote | null }
export type QuotesResponse = { generatedAt: string; quotes: QuoteEntry[] }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

const isDateTime = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))

export function parseQuotesResponse(value: unknown): QuotesResponse {
  if (!isRecord(value) || !isDateTime(value.generatedAt) || !Array.isArray(value.quotes)) {
    throw new Error('Nieprawidłowa odpowiedź serwera notowań')
  }
  const entries = value.quotes
  const quotes = ASSETS.map(({ ticker }): QuoteEntry => {
    const matches = entries.filter((entry: unknown) => isRecord(entry) && entry.ticker === ticker)
    if (matches.length !== 1 || !isRecord(matches[0])) throw new Error(`Brak danych dla ${ticker}`)
    const quote: unknown = matches[0].quote
    if (quote === null) return { ticker, quote: null }
    if (!isRecord(quote) || !isPositiveNumber(quote.price) || !isPositiveNumber(quote.previousClose)
      || !isDateTime(quote.quotedAt)
      || !(quote.sessionStart === null && quote.sessionEnd === null
        || isDateTime(quote.sessionStart) && isDateTime(quote.sessionEnd) && Date.parse(quote.sessionStart) < Date.parse(quote.sessionEnd))) {
      throw new Error(`Nieprawidłowe notowanie dla ${ticker}`)
    }
    return { ticker, quote: quote as Quote }
  })
  return { generatedAt: value.generatedAt, quotes }
}
