import { isLseTradingDay, lseDate, lseDateKey } from './calendar'
import { parseQuotesResponse } from './shared/quotes'
import type { Quote } from './shared/quotes'

export async function getQuotes({ signal }: { signal: AbortSignal }) {
  const response = await fetch('/api/quotes', { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(18_000)]) })
  if (!response.ok) throw new Error('Nie udało się odświeżyć cen')
  return parseQuotesResponse(await response.json())
}

export type QuoteStatus = 'trading' | 'closed' | 'stale' | 'offline' | 'unknown'

export function quoteStatus(quote: Quote, generatedAt: string, now: Date, online: boolean, refreshFailed: boolean): QuoteStatus {
  if (!online) return 'offline'
  if (refreshFailed || now.getTime() - Date.parse(generatedAt) > 5 * 60_000) return 'stale'
  if (!quote.sessionStart || !quote.sessionEnd) return 'unknown'
  const start = Date.parse(quote.sessionStart)
  const end = Date.parse(quote.sessionEnd)
  const quotedAt = Date.parse(quote.quotedAt)
  if (now.getTime() >= start && now.getTime() < end) {
    return quotedAt < start || now.getTime() - quotedAt > 30 * 60_000 ? 'stale' : 'trading'
  }

  // Before the opening bell, Friday's price is still the latest session on Monday.
  const expected = now.getTime() < start ? lseDate(new Date(start)) : lseDate(now)
  const londonHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(now))
  if (now.getTime() < start || londonHour < 8) expected.setUTCDate(expected.getUTCDate() - 1)
  while (!isLseTradingDay(expected)) expected.setUTCDate(expected.getUTCDate() - 1)
  return lseDateKey(new Date(quotedAt)) < expected.toISOString().slice(0, 10) ? 'stale' : 'closed'
}
