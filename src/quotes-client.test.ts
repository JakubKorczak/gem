import { afterEach, describe, expect, it, vi } from 'vitest'
import { getQuotes, quoteStatus } from './quotes-client'
import { ASSETS } from './shared/assets'
import { parseQuotesResponse } from './shared/quotes'
import type { Quote } from './shared/quotes'

const quote: Quote = {
  price: 110, previousClose: 100, quotedAt: '2026-10-15T11:50:00Z',
  sessionStart: '2026-10-15T07:00:00Z', sessionEnd: '2026-10-15T15:30:00Z',
}
const response = () => ({ generatedAt: '2026-10-15T12:00:00Z', quotes: ASSETS.map(({ ticker }) => ({ ticker, quote: { ...quote } })) })
const status = (data: Quote, time: string, online = true, failed = false) => quoteStatus(data, time, new Date(time), online, failed)
afterEach(() => vi.unstubAllGlobals())

describe('status i odświeżanie cen', () => {
  it('marks current delayed quotes during a session and stale quotes during an open session', () => {
    expect(status(quote, '2026-10-15T12:00:00Z')).toBe('trading')
    expect(status(quote, '2026-10-15T12:30:00Z')).toBe('stale')
    expect(status({ ...quote, quotedAt: '2026-10-14T15:30:00Z' }, '2026-10-15T07:05:00Z')).toBe('stale')
  })

  it('shows the final session price after closing, but detects an older missing session', () => {
    expect(status({ ...quote, quotedAt: '2026-10-15T15:30:00Z' }, '2026-10-15T18:00:00Z')).toBe('closed')
    expect(status({ ...quote, quotedAt: '2026-10-14T15:30:00Z' }, '2026-10-15T18:00:00Z')).toBe('stale')
  })

  it('keeps Friday valid on weekends and before Monday opening, including UK daylight saving', () => {
    const friday = { ...quote, quotedAt: '2026-10-16T15:30:00Z', sessionStart: '2026-10-16T07:00:00Z', sessionEnd: '2026-10-16T15:30:00Z' }
    expect(status(friday, '2026-10-17T12:00:00Z')).toBe('closed')
    expect(status(friday, '2026-10-19T06:30:00Z')).toBe('closed')
    expect(status(friday, '2026-10-19T08:00:00Z')).toBe('stale')
    expect(status({ ...quote, quotedAt: '2026-10-23T15:30:00Z', sessionStart: '2026-10-26T08:00:00Z', sessionEnd: '2026-10-26T16:30:00Z' }, '2026-10-26T07:30:00Z')).toBe('closed')
  })

  it('accepts the last session during a bank holiday and handles shortened sessions', () => {
    expect(status({ ...quote, quotedAt: '2026-08-28T15:30:00Z', sessionStart: '2026-09-01T07:00:00Z', sessionEnd: '2026-09-01T15:30:00Z' }, '2026-08-31T12:00:00Z')).toBe('closed')
    expect(status({ ...quote, quotedAt: '2026-12-24T12:30:00Z', sessionStart: '2026-12-24T08:00:00Z', sessionEnd: '2026-12-24T12:30:00Z' }, '2026-12-24T14:00:00Z')).toBe('closed')
  })

  it('never labels offline, failed or old responses as current', () => {
    expect(status(quote, '2026-10-15T12:00:00Z', false)).toBe('offline')
    expect(status(quote, '2026-10-15T12:00:00Z', true, true)).toBe('stale')
    expect(quoteStatus(quote, '2026-10-15T11:50:00Z', new Date('2026-10-15T12:00:00Z'), true, false)).toBe('stale')
    expect(status({ ...quote, sessionStart: null, sessionEnd: null }, '2026-10-15T12:00:00Z')).toBe('unknown')
  })

  it('validates all tickers, finite prices, and missing session metadata at the client boundary', () => {
    expect(parseQuotesResponse(response()).quotes).toHaveLength(5)
    const missing = response()
    missing.quotes.pop()
    expect(() => parseQuotesResponse(missing)).toThrow()
    const bad = response()
    bad.quotes[0].quote.price = NaN
    expect(() => parseQuotesResponse(bad)).toThrow()
    const duplicate = response()
    duplicate.quotes.push(duplicate.quotes[0])
    expect(() => parseQuotesResponse(duplicate)).toThrow()
    const partial = response()
    Object.assign(partial.quotes[0], { quote: null })
    expect(parseQuotesResponse(partial).quotes[0].quote).toBeNull()
  })

  it('bypasses HTTP cache, supports cancellation and rejects upstream failures', async () => {
    const mock = vi.fn(async () => Response.json(response()))
    vi.stubGlobal('fetch', mock)
    await getQuotes({ signal: new AbortController().signal })
    expect(mock).toHaveBeenCalledWith('/api/quotes', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }))
    mock.mockResolvedValueOnce(new Response('Unavailable', { status: 502 }))
    await expect(getQuotes({ signal: new AbortController().signal })).rejects.toThrow('Nie udało się odświeżyć cen')
  })
})
