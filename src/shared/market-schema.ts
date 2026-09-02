import { ASSETS, type AssetTicker } from './assets'
import type { AssetMarketData, MarketResponse, PricePoint } from '../types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Nieprawidłowe pole ${field}`)
  return value
}

function requireDate(value: unknown, field: string) {
  const date = requireString(value, field)
  if (!ISO_DATE.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
    throw new Error(`Nieprawidłowa data ${field}`)
  }
  return date
}

function requireTimestamp(value: unknown, field: string) {
  const timestamp = requireString(value, field)
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`Nieprawidłowy czas ${field}`)
  return timestamp
}

function requireNumber(value: unknown, field: string, positive = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive && value <= 0)) {
    throw new Error(`Nieprawidłowa liczba ${field}`)
  }
  return value
}

function requireTicker(value: unknown): AssetTicker {
  if (typeof value !== 'string' || !ASSETS.some((asset) => asset.ticker === value)) {
    throw new Error('Nieznany ticker w danych rynkowych')
  }
  return value as AssetTicker
}

function parsePoint(value: unknown, index: number): PricePoint {
  if (!isRecord(value)) throw new Error(`Nieprawidłowy punkt notowań ${index}`)
  return {
    date: requireDate(value.date, `points[${index}].date`),
    close: requireNumber(value.close, `points[${index}].close`, true),
    normalized: requireNumber(value.normalized, `points[${index}].normalized`),
  }
}

function parseAsset(value: unknown, index: number): AssetMarketData {
  if (!isRecord(value)) throw new Error(`Nieprawidłowe aktywo ${index}`)
  if (!Array.isArray(value.points) || value.points.length < 2) {
    throw new Error(`Za mało punktów notowań dla aktywa ${index}`)
  }

  const points = value.points.map((point, pointIndex) => parsePoint(point, pointIndex))
  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    if (points[pointIndex - 1].date >= points[pointIndex].date) {
      throw new Error(`Nieuporządkowane punkty notowań dla aktywa ${index}`)
    }
  }

  const asset: AssetMarketData = {
    ticker: requireTicker(value.ticker),
    currency: requireString(value.currency, `assets[${index}].currency`),
    exchange: requireString(value.exchange, `assets[${index}].exchange`),
    longName: requireString(value.longName, `assets[${index}].longName`),
    lastPrice: requireNumber(value.lastPrice, `assets[${index}].lastPrice`, true),
    signalPrice: requireNumber(value.signalPrice, `assets[${index}].signalPrice`, true),
    signalStartPrice: requireNumber(value.signalStartPrice, `assets[${index}].signalStartPrice`, true),
    return12m: requireNumber(value.return12m, `assets[${index}].return12m`),
    lastTradingDay: requireDate(value.lastTradingDay, `assets[${index}].lastTradingDay`),
    signalDate: requireDate(value.signalDate, `assets[${index}].signalDate`),
    signalStartDate: requireDate(value.signalStartDate, `assets[${index}].signalStartDate`),
    points,
  }

  if (asset.signalStartDate >= asset.signalDate || asset.lastTradingDay < asset.signalDate) {
    throw new Error(`Niespójny okres notowań dla ${asset.ticker}`)
  }
  if (points[0].date !== asset.signalStartDate || points.at(-1)?.date !== asset.signalDate) {
    throw new Error(`Punkty nie obejmują pełnego okresu dla ${asset.ticker}`)
  }

  const expectedReturn = ((asset.signalPrice / asset.signalStartPrice) - 1) * 100
  if (Math.abs(expectedReturn - asset.return12m) > 0.000001) {
    throw new Error(`Niespójna stopa zwrotu dla ${asset.ticker}`)
  }
  if (asset.currency !== 'USD' || asset.exchange !== 'LSE') {
    throw new Error(`Nieoczekiwany rynek lub waluta dla ${asset.ticker}`)
  }
  if (points.some((point) => Math.abs(
    (((point.close / asset.signalStartPrice) - 1) * 100) - point.normalized,
  ) > 0.000001)) {
    throw new Error(`Niespójna normalizacja notowań dla ${asset.ticker}`)
  }

  return asset
}

export function parseMarketResponse(value: unknown): MarketResponse {
  if (!isRecord(value) || !Array.isArray(value.assets)) {
    throw new Error('Serwer notowań zwrócił nieprawidłowe dane')
  }

  const signalDate = requireDate(value.signalDate, 'signalDate')
  const signalStartDate = requireDate(value.signalStartDate, 'signalStartDate')
  const signalMonth = requireString(value.signalMonth, 'signalMonth')
  if (!ISO_MONTH.test(signalMonth)) throw new Error('Nieprawidłowy miesiąc sygnału')
  const monthAfterSignal = new Date(`${signalDate.slice(0, 7)}-01T12:00:00Z`)
  monthAfterSignal.setUTCMonth(monthAfterSignal.getUTCMonth() + 1)
  if (monthAfterSignal.toISOString().slice(0, 7) !== signalMonth) {
    throw new Error('Miesiąc sygnału nie odpowiada dacie końcowej')
  }
  if (!isRecord(value.quality) || value.quality.status !== 'verified') {
    throw new Error('Brak potwierdzenia jakości danych')
  }
  const expectedSignalDate = requireDate(value.quality.expectedSignalDate, 'quality.expectedSignalDate')
  const expectedSignalStartDate = requireDate(value.quality.expectedSignalStartDate, 'quality.expectedSignalStartDate')
  const calendarVerifiedThroughYear = requireNumber(
    value.quality.calendarVerifiedThroughYear,
    'quality.calendarVerifiedThroughYear',
    true,
  )
  const assets = value.assets.map(parseAsset)
  const tickers = new Set(assets.map((asset) => asset.ticker))

  if (assets.length !== ASSETS.length || tickers.size !== ASSETS.length
    || !ASSETS.every((asset) => tickers.has(asset.ticker))) {
    throw new Error('Odpowiedź nie zawiera kompletnego zestawu aktywów')
  }
  if (assets.some((asset) => asset.signalDate !== signalDate || asset.signalStartDate !== signalStartDate)) {
    throw new Error('Aktywa mają niespójne daty sygnału')
  }
  if (expectedSignalDate !== signalDate || expectedSignalStartDate !== signalStartDate) {
    throw new Error('Dane nie odpowiadają oczekiwanemu okresowi sygnału')
  }

  return {
    generatedAt: requireTimestamp(value.generatedAt, 'generatedAt'),
    source: requireString(value.source, 'source'),
    signalMonth,
    signalDate,
    signalStartDate,
    quality: {
      status: 'verified',
      expectedSignalDate,
      expectedSignalStartDate,
      calendarVerifiedThroughYear,
    },
    assets,
  }
}
