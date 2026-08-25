import { afterEach, describe, expect, it, vi } from 'vitest'

const DAY_MS = 24 * 60 * 60 * 1000

function yahooPayload() {
  const start = Date.UTC(2024, 7, 1)
  const end = Date.UTC(2026, 7, 24)
  const timestamps: number[] = []
  const closes: number[] = []

  for (let time = start, index = 0; time <= end; time += DAY_MS, index += 1) {
    timestamps.push(time / 1000)
    closes.push(100 + index * 0.1)
  }

  return {
    chart: {
      result: [{
        meta: { currency: 'USD', exchangeName: 'LSE', longName: 'Test ETF' },
        timestamp: timestamps,
        indicators: { adjclose: [{ adjclose: closes }] },
      }],
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('getMarketData', () => {
  it('uses the alternate Yahoo host when the primary host returns text instead of JSON', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-25T12:00:00Z'))
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('query2.finance.yahoo.com')) {
        return new Response('A server error has occurred', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }

      return Response.json(yahooPayload())
    })
    vi.stubGlobal('fetch', fetchMock)

    const { getMarketData } = await import('./market')
    const result = await getMarketData()

    expect(result.assets).toHaveLength(4)
    expect(fetchMock).toHaveBeenCalledTimes(8)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('query1.finance.yahoo.com'))).toHaveLength(4)
  })
})
