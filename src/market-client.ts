import { parseMarketResponse } from './shared/market-schema'
import { signalPeriod } from './calendar'
import type { MarketResponse } from './types'

const SNAPSHOT_VERSION = 3
const SNAPSHOT_STORAGE_KEY = 'gem-last-market-signal-v3'
const LEGACY_SNAPSHOT_STORAGE_KEYS = ['gem-last-market-signal-v2', 'gem-last-market-signal-v1']

export const MARKET_QUERY_DEFAULTS = {
  staleTime: 15 * 60 * 1000,
  retry: 1,
  refetchOnWindowFocus: 'always',
  refetchOnReconnect: 'always',
} as const

export function marketQueryKey(lseDay: string) {
  return ['market', lseDay.slice(0, 7)] as const
}

export type MarketDataMode = 'live' | 'cached-current' | 'stale'

export type ClientMarketData = MarketResponse & {
  dataMode: MarketDataMode
  isActionable: boolean
  isOfflineSnapshot: boolean
  snapshotSavedAt: string
}

type StoredSnapshot = {
  version: typeof SNAPSHOT_VERSION
  savedAt: string
  market: MarketResponse
}

function isStoredSnapshot(value: unknown): value is StoredSnapshot {
  return typeof value === 'object' && value !== null
    && 'version' in value && value.version === SNAPSHOT_VERSION
    && 'savedAt' in value && typeof value.savedAt === 'string'
    && !Number.isNaN(Date.parse(value.savedAt))
    && 'market' in value
}

export function parseStoredSnapshot(raw: string): StoredSnapshot {
  const value: unknown = JSON.parse(raw)
  if (!isStoredSnapshot(value)) throw new Error('Nieobsługiwana wersja zapisanego sygnału')
  return { ...value, market: parseMarketResponse(value.market) }
}

function saveSnapshot(snapshot: StoredSnapshot) {
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot))
    LEGACY_SNAPSHOT_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
  } catch {
    // Brak localStorage nie powinien blokować bieżącego sygnału online.
  }
}

function readSnapshot(): StoredSnapshot | null {
  try {
    const current = localStorage.getItem(SNAPSHOT_STORAGE_KEY)
    if (current) return parseStoredSnapshot(current)

    LEGACY_SNAPSHOT_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
    return null
  } catch {
    try {
      localStorage.removeItem(SNAPSHOT_STORAGE_KEY)
      LEGACY_SNAPSHOT_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
    } catch {
      // Pamięć przeglądarki może być całkowicie niedostępna.
    }
    return null
  }
}

function snapshotMode(market: MarketResponse, preferred: Exclude<MarketDataMode, 'stale'>): MarketDataMode {
  const expected = signalPeriod()
  const isCurrent = expected.calendarVerified
    && market.signalMonth === expected.signalMonth
    && market.signalDate === expected.signalDate
    && market.signalStartDate === expected.signalStartDate
    && market.quality.expectedSignalDate === expected.signalDate
    && market.quality.expectedSignalStartDate === expected.signalStartDate
  return isCurrent ? preferred : 'stale'
}

function withClientState(snapshot: StoredSnapshot, dataMode: MarketDataMode): ClientMarketData {
  return {
    ...snapshot.market,
    dataMode,
    isActionable: dataMode !== 'stale',
    isOfflineSnapshot: dataMode !== 'live',
    snapshotSavedAt: snapshot.savedAt,
  }
}

function errorMessage(value: unknown) {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
        ? value.error
    : 'Nie udało się pobrać notowań'
}

export async function getMarketData(): Promise<ClientMarketData> {
  const stored = readSnapshot()

  try {
    const response = await fetch('/api/market', { cache: 'no-store' })
    const rawBody = await response.text()
    let body: unknown

    try {
      body = JSON.parse(rawBody) as unknown
    } catch {
      throw new Error(response.ok
        ? 'Serwer notowań zwrócił nieprawidłowe dane.'
        : 'Serwer notowań jest chwilowo niedostępny.')
    }

    if (!response.ok) throw new Error(errorMessage(body))
    const market = parseMarketResponse(body)
    const fromCache = response.headers.get('X-GEM-Cache') === 'true'

    if (fromCache) {
      const snapshot = {
        version: SNAPSHOT_VERSION,
        savedAt: stored?.market.generatedAt === market.generatedAt ? stored.savedAt : market.generatedAt,
        market,
      } as const
      return withClientState(snapshot, snapshotMode(market, 'cached-current'))
    }

    const snapshot = { version: SNAPSHOT_VERSION, savedAt: new Date().toISOString(), market } as const
    const mode = snapshotMode(market, 'live')
    if (mode === 'live') saveSnapshot(snapshot)
    return withClientState(snapshot, mode)
  } catch (error) {
    if (stored) return withClientState(stored, snapshotMode(stored.market, 'cached-current'))
    throw error
  }
}
