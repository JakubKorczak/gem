import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ASSETS } from './shared/assets'
import { getMarketData, MARKET_QUERY_DEFAULTS, marketQueryKey, parseStoredSnapshot } from './market-client'

function storedSnapshot() {
  const start = 100
  const end = 110
  return JSON.stringify({
    version: 3,
    savedAt: '2026-09-02T10:05:00.000Z',
    market: {
      generatedAt: '2026-09-02T10:00:00.000Z',
      source: 'Test',
      signalMonth: '2026-09',
      signalDate: '2026-08-28',
      signalStartDate: '2025-08-29',
      quality: {
        status: 'verified',
        expectedSignalDate: '2026-08-28',
        expectedSignalStartDate: '2025-08-29',
        calendarVerifiedThroughYear: 2026,
      },
      assets: ASSETS.map((asset) => ({
        ticker: asset.ticker,
        currency: 'USD',
        exchange: 'LSE',
        longName: asset.fullName,
        lastPrice: end,
        signalPrice: end,
        signalStartPrice: start,
        return12m: ((end / start) - 1) * 100,
        lastTradingDay: '2026-08-28',
        signalDate: '2026-08-28',
        signalStartDate: '2025-08-29',
        points: [
          { date: '2025-08-29', close: start, normalized: 0 },
          { date: '2026-08-28', close: end, normalized: 10 },
        ],
      })),
    },
  })
}

describe('snapshot danych rynkowych', () => {
  const values = new Map<string, string>()

  beforeEach(() => {
    values.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts the current version with a complete market payload', () => {
    expect(parseStoredSnapshot(storedSnapshot()).version).toBe(3)
  })

  it('zmienia klucz zapytania wraz z londyńskim miesiącem i zawsze odświeża po wznowieniu', () => {
    expect(marketQueryKey('2026-08-31')).toEqual(['market', '2026-08'])
    expect(marketQueryKey('2026-09-01')).toEqual(['market', '2026-09'])
    expect(MARKET_QUERY_DEFAULTS.refetchOnWindowFocus).toBe('always')
    expect(MARKET_QUERY_DEFAULTS.refetchOnReconnect).toBe('always')
  })

  it('rejects a snapshot without an explicit current version', () => {
    const snapshot = JSON.parse(storedSnapshot()) as { version: number }
    snapshot.version = 2
    expect(() => parseStoredSnapshot(JSON.stringify(snapshot))).toThrow('wersja')
  })

  it('returns the last validated snapshot when the API becomes unavailable', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T10:00:00Z'))
    const market = (JSON.parse(storedSnapshot()) as { market: unknown }).market
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(market)))

    const online = await getMarketData()
    expect(online.isOfflineSnapshot).toBe(false)

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const offline = await getMarketData()
    expect(offline.isOfflineSnapshot).toBe(true)
    expect(offline.dataMode).toBe('cached-current')
    expect(offline.isActionable).toBe(true)
    expect(offline.signalDate).toBe(online.signalDate)
    vi.useRealTimers()
  })

  it('marks a snapshot from a previous month as stale and non-actionable', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-02T10:00:00Z'))
    values.set('gem-last-market-signal-v3', storedSnapshot())
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    const stale = await getMarketData()

    expect(stale.dataMode).toBe('stale')
    expect(stale.isActionable).toBe(false)
    vi.useRealTimers()
  })

  it('rejects transaction guidance when the month matches but exact LSE dates do not', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T10:00:00Z'))
    const snapshot = JSON.parse(storedSnapshot()) as {
      market: {
        signalDate: string
        signalStartDate: string
        quality: { expectedSignalDate: string; expectedSignalStartDate: string }
        assets: Array<{
          signalDate: string
          signalStartDate: string
          lastTradingDay: string
          points: Array<{ date: string }>
        }>
      }
    }
    snapshot.market.signalDate = '2026-08-27'
    snapshot.market.signalStartDate = '2025-08-28'
    snapshot.market.quality.expectedSignalDate = '2026-08-27'
    snapshot.market.quality.expectedSignalStartDate = '2025-08-28'
    snapshot.market.assets.forEach((asset) => {
      asset.signalDate = '2026-08-27'
      asset.signalStartDate = '2025-08-28'
      asset.lastTradingDay = '2026-08-27'
      asset.points[0].date = '2025-08-28'
      asset.points[1].date = '2026-08-27'
    })
    values.set('gem-last-market-signal-v3', JSON.stringify(snapshot))
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    const stale = await getMarketData()

    expect(stale.signalMonth).toBe('2026-09')
    expect(stale.dataMode).toBe('stale')
    expect(stale.isActionable).toBe(false)
    vi.useRealTimers()
  })

  it('recovers from an API failure when the network response returns', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T10:00:00Z'))
    values.set('gem-last-market-signal-v3', storedSnapshot())
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect((await getMarketData()).dataMode).toBe('cached-current')

    const market = (JSON.parse(storedSnapshot()) as { market: unknown }).market
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(market)))
    const recovered = await getMarketData()

    expect(recovered.dataMode).toBe('live')
    expect(recovered.isActionable).toBe(true)
    vi.useRealTimers()
  })
})
