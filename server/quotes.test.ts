import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseYahooQuote } from './quotes'

const now = new Date('2026-10-15T12:00:00Z')
function payload(ticker = 'CNDX.L') {
  return { chart: { error: null, result: [{ meta: {
    symbol: ticker, currency: 'USD', exchangeName: 'LSE', regularMarketPrice: 110,
    previousClose: 100, chartPreviousClose: 80, regularMarketTime: now.getTime() / 1000,
    currentTradingPeriod: { regular: { start: Date.parse('2026-10-15T07:00:00Z') / 1000, end: Date.parse('2026-10-15T15:30:00Z') / 1000 } },
  } }] } }
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules() })

describe('bieżące notowania Yahoo', () => {
  it('uses the previous session close, not the range baseline or adjusted price', () => {
    expect(parseYahooQuote(payload(), 'CNDX.L', now.getTime())).toEqual({
      price: 110, previousClose: 100, quotedAt: now.toISOString(),
      sessionStart: '2026-10-15T07:00:00.000Z', sessionEnd: '2026-10-15T15:30:00.000Z',
    })
  })

  it.each(['symbol', 'currency', 'exchangeName', 'previousClose', 'regularMarketPrice', 'regularMarketTime'] as const)('rejects invalid %s', (field) => {
    const data = payload()
    Object.assign(data.chart.result[0].meta, { [field]: field === 'regularMarketTime' ? now.getTime() / 1000 + 3600 : field === 'symbol' ? 'QQQ' : field === 'currency' ? 'GBP' : field === 'exchangeName' ? 'NMS' : 0 })
    expect(() => parseYahooQuote(data, 'CNDX.L', now.getTime())).toThrow()
  })

  it('keeps valid prices when session metadata is missing', () => {
    const data = payload()
    Object.assign(data.chart.result[0].meta, { currentTradingPeriod: null })
    expect(parseYahooQuote(data, 'CNDX.L', now.getTime())).toMatchObject({ price: 110, sessionStart: null, sessionEnd: null })
  })

  it('isolates one unavailable instrument, retries it, and caches valid quotes for only a minute', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const fetchMock = vi.fn(async (url: string) => {
      const ticker = decodeURIComponent(new URL(url).pathname.split('/').at(-1)!)
      return ticker === 'IWDA.L' ? new Response('rate limit', { status: 429 }) : Response.json(payload(ticker))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { getQuotes } = await import('./quotes')
    const [result, concurrent] = await Promise.all([getQuotes(), getQuotes()])
    expect(result).toEqual(concurrent)
    expect(result.quotes.filter((entry) => entry.quote)).toHaveLength(4)
    expect(result.quotes.find((entry) => entry.ticker === 'IWDA.L')?.quote).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(6)
    await getQuotes()
    expect(fetchMock).toHaveBeenCalledTimes(8)
    vi.setSystemTime(now.getTime() + 60_001)
    await getQuotes()
    expect(fetchMock).toHaveBeenCalledTimes(14)
  })
})
