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
  signalDate: string
  signalStartDate: string
  assets: AssetMarketData[]
}
