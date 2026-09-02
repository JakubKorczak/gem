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

function yahooPayloadWithMonthEndHoliday(missingDate?: string) {
  const start = Date.UTC(2024, 7, 1)
  const end = Date.UTC(2026, 7, 31)
  const timestamps: number[] = []
  const closes: number[] = []

  for (let time = start, index = 0; time <= end; time += DAY_MS) {
    const date = new Date(time)
    const isoDate = date.toISOString().slice(0, 10)
    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6
    const isMonthEndHoliday = isoDate === '2026-08-31'

    if (!isWeekend && !isMonthEndHoliday && isoDate !== missingDate) {
      timestamps.push(time / 1000)
      closes.push(100 + index * 0.1)
      index += 1
    }
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

function yahooPayloadForDates(dates: string[]) {
  return {
    chart: {
      result: [{
        meta: { currency: 'USD', exchangeName: 'LSE', longName: 'Test ETF' },
        timestamp: dates.map((date) => Date.parse(`${date}T12:00:00Z`) / 1000),
        indicators: { adjclose: [{ adjclose: dates.map((_date, index) => 100 + index * 10) }] },
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

    expect(result.assets).toHaveLength(5)
    expect(fetchMock).toHaveBeenCalledTimes(10)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('query1.finance.yahoo.com'))).toHaveLength(5)
  })

  it('anchors the 12-month window to calendar month-end when the final session is earlier', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T12:00:00Z'))
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(yahooPayloadWithMonthEndHoliday())))

    const { getMarketData } = await import('./market')
    const result = await getMarketData()

    expect(result.signalDate).toBe('2026-08-28')
    expect(result.signalStartDate).toBe('2025-08-29')
    expect(result.assets.every((asset) => asset.signalStartDate === '2025-08-29')).toBe(true)
  })

  it('rejects the signal when a single asset is missing the expected final session', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T12:00:00Z'))
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const missingDate = String(input).includes('CNDX.L') ? '2026-08-28' : undefined
      return Response.json(yahooPayloadWithMonthEndHoliday(missingDate))
    }))

    const { getMarketData } = await import('./market')
    await expect(getMarketData()).rejects.toMatchObject({ code: 'INCOMPLETE_MONTH_END' })
  })

  it('uses the previous February month-end for a leap-day signal', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-03-01T12:00:00Z'))
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(yahooPayloadForDates([
      '2023-02-28',
      '2023-03-01',
      '2024-02-29',
    ]))))

    const { getMarketData } = await import('./market')
    const result = await getMarketData()

    expect(result.signalStartDate).toBe('2023-02-28')
    expect(result.signalDate).toBe('2024-02-29')
  })

  it('keeps the sequential Yahoo fallback within the Vercel function limit', async () => {
    const { YAHOO_MAX_UPSTREAM_WAIT_MS } = await import('./market')
    expect(YAHOO_MAX_UPSTREAM_WAIT_MS).toBeLessThan(20_000)
  })

  it('rejects unexpected exchange metadata instead of fabricating LSE data', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T12:00:00Z'))
    const payload = yahooPayloadWithMonthEndHoliday()
    payload.chart.result[0].meta.exchangeName = 'GER'
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(payload)))

    const { getMarketData } = await import('./market')
    await expect(getMarketData()).rejects.toMatchObject({ code: 'INVALID_UPSTREAM_DATA' })
  })

  it('returns quality metadata for the exact verified signal period', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T12:00:00Z'))
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(yahooPayloadWithMonthEndHoliday())))

    const { getMarketData } = await import('./market')
    const result = await getMarketData()

    expect(result.signalMonth).toBe('2026-09')
    expect(result.quality).toEqual({
      status: 'verified',
      expectedSignalDate: '2026-08-28',
      expectedSignalStartDate: '2025-08-29',
      calendarVerifiedThroughYear: 2026,
    })
  })

  it('refuses to publish a signal for an unverified future LSE calendar', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-02-02T12:00:00Z'))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { getMarketData } = await import('./market')
    await expect(getMarketData()).rejects.toMatchObject({ code: 'UNVERIFIED_CALENDAR' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
