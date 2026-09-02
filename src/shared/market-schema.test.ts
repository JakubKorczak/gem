import { describe, expect, it } from 'vitest'
import { ASSETS } from './assets'
import { parseMarketResponse } from './market-schema'

function marketResponse() {
  const signalStartPrice = 100
  const signalPrice = 110
  return {
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
      lastPrice: 111,
      signalPrice,
      signalStartPrice,
      return12m: ((signalPrice / signalStartPrice) - 1) * 100,
      lastTradingDay: '2026-09-02',
      signalDate: '2026-08-28',
      signalStartDate: '2025-08-29',
      points: [
        { date: '2025-08-29', close: signalStartPrice, normalized: 0 },
        { date: '2026-08-28', close: signalPrice, normalized: 10 },
      ],
    })),
  }
}

describe('parseMarketResponse', () => {
  it('accepts a complete response with one common signal period', () => {
    expect(parseMarketResponse(marketResponse()).assets).toHaveLength(ASSETS.length)
  })

  it('rejects an old response that does not contain CNDX', () => {
    const response = marketResponse()
    response.assets = response.assets.filter((asset) => asset.ticker !== 'CNDX.L')
    expect(() => parseMarketResponse(response)).toThrow('kompletnego zestawu aktywów')
  })

  it('rejects assets calculated for different signal dates', () => {
    const response = marketResponse()
    response.assets[0] = {
      ...response.assets[0],
      signalDate: '2026-08-27',
      points: [response.assets[0].points[0], { ...response.assets[0].points[1], date: '2026-08-27' }],
    }
    expect(() => parseMarketResponse(response)).toThrow('niespójne daty sygnału')
  })

  it('rejects a response in the wrong currency', () => {
    const response = marketResponse()
    response.assets[0] = { ...response.assets[0], currency: 'GBP' }
    expect(() => parseMarketResponse(response)).toThrow('rynek lub waluta')
  })

  it('rejects points with a fabricated normalized return', () => {
    const response = marketResponse()
    response.assets[0] = {
      ...response.assets[0],
      points: [response.assets[0].points[0], { ...response.assets[0].points[1], normalized: 9 }],
    }
    expect(() => parseMarketResponse(response)).toThrow('normalizacja')
  })

  it('rejects duplicate quote dates', () => {
    const response = marketResponse()
    response.assets[0].points[1].date = response.assets[0].points[0].date
    expect(() => parseMarketResponse(response)).toThrow('Nieuporządkowane')
  })

  it('rejects an inconsistent 12-month return', () => {
    const response = marketResponse()
    response.assets[0].return12m = 99
    expect(() => parseMarketResponse(response)).toThrow('Niespójna stopa zwrotu')
  })

  it('rejects a signal month that does not follow the quote month', () => {
    const response = marketResponse()
    response.signalMonth = '2026-10'
    expect(() => parseMarketResponse(response)).toThrow('Miesiąc sygnału')
  })
})
