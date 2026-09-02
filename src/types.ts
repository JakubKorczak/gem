import type { AssetTicker } from './shared/assets'

export type PricePoint = {
  date: string
  close: number
  normalized: number
}

export type AssetMarketData = {
  ticker: AssetTicker
  currency: string
  exchange: string
  longName: string
  lastPrice: number
  signalPrice: number
  signalStartPrice: number
  return12m: number
  lastTradingDay: string
  signalDate: string
  signalStartDate: string
  points: PricePoint[]
}

export type MarketResponse = {
  generatedAt: string
  source: string
  signalMonth: string
  signalDate: string
  signalStartDate: string
  quality: {
    status: 'verified'
    expectedSignalDate: string
    expectedSignalStartDate: string
    calendarVerifiedThroughYear: number
  }
  assets: AssetMarketData[]
}

export type MarketErrorCode =
  | 'INCOMPLETE_MONTH_END'
  | 'INVALID_UPSTREAM_DATA'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UNVERIFIED_CALENDAR'
