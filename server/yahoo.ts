import { MarketDataError } from './market-error.js'

const YAHOO_HOSTS = ['query2.finance.yahoo.com', 'query1.finance.yahoo.com'] as const
export const YAHOO_MAX_UPSTREAM_WAIT_MS = 16_000

export async function fetchYahooChart(ticker: string, range = '2y', interval = '1d'): Promise<unknown> {
  let lastError: unknown
  for (const host of YAHOO_HOSTS) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&events=div%2Csplits`
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 GEM-Kompas/0.1' },
        signal: AbortSignal.timeout(YAHOO_MAX_UPSTREAM_WAIT_MS / YAHOO_HOSTS.length),
      })
      if (!response.ok) {
        throw new MarketDataError('UPSTREAM_UNAVAILABLE', `Źródło danych zwróciło ${response.status} dla ${ticker}`)
      }
      try {
        return JSON.parse(await response.text()) as unknown
      } catch {
        throw new MarketDataError('INVALID_UPSTREAM_DATA', `Źródło danych zwróciło nieprawidłową odpowiedź dla ${ticker}`)
      }
    } catch (error) {
      lastError = error
    }
  }
  if (lastError instanceof MarketDataError) throw lastError
  throw new MarketDataError('UPSTREAM_UNAVAILABLE', `Nie udało się pobrać notowań dla ${ticker}`)
}
