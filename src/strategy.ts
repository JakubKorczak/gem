import type { AssetMarketData } from './types'

export type GemSignal = {
  selected: AssetMarketData
  candidate: AssetMarketData
  equityWinner: AssetMarketData
  defensiveWinner: AssetMarketData
  cashProxy: AssetMarketData
  riskOn: boolean
  switchBuffered: boolean
  switchAdvantage: number | null
  switchBuffer: number
  equityMargin: number
  absoluteMargin: number
  defensiveMargin: number
}

export const SWITCH_BUFFER_PERCENTAGE_POINTS = 3

const EQUITY_TICKERS: AssetMarketData['ticker'][] = ['EIMI.L', 'IWDA.L', 'CNDX.L']

function requireAsset(assets: AssetMarketData[], ticker: AssetMarketData['ticker']) {
  const asset = assets.find((candidate) => candidate.ticker === ticker)
  if (!asset) throw new Error(`Brak danych dla ${ticker}`)
  return asset
}

export function calculateGemSignal(
  assets: AssetMarketData[],
  currentHoldingTicker?: AssetMarketData['ticker'] | '',
): GemSignal {
  const equities = EQUITY_TICKERS
    .map((ticker) => requireAsset(assets, ticker))
    .sort((a, b) => b.return12m - a.return12m)
  const bonds = requireAsset(assets, 'CBU0.L')
  const cash = requireAsset(assets, 'IB01.L')

  const equityWinner = equities[0]
  const equityRunnerUp = equities[1]
  const riskOn = equityWinner.return12m > cash.return12m
  const defensiveWinner = bonds.return12m >= cash.return12m ? bonds : cash
  const candidate = riskOn ? equityWinner : defensiveWinner
  const currentHolding = currentHoldingTicker
    ? assets.find((asset) => asset.ticker === currentHoldingTicker)
    : undefined
  const switchAdvantage = currentHolding && currentHolding.ticker !== candidate.ticker
    ? candidate.return12m - currentHolding.return12m
    : null
  const switchBuffered = switchAdvantage !== null
    && switchAdvantage < SWITCH_BUFFER_PERCENTAGE_POINTS
  const selected = switchBuffered && currentHolding ? currentHolding : candidate

  return {
    selected,
    candidate,
    equityWinner,
    defensiveWinner,
    cashProxy: cash,
    riskOn,
    switchBuffered,
    switchAdvantage,
    switchBuffer: SWITCH_BUFFER_PERCENTAGE_POINTS,
    equityMargin: equityWinner.return12m - equityRunnerUp.return12m,
    absoluteMargin: equityWinner.return12m - cash.return12m,
    defensiveMargin: Math.abs(bonds.return12m - cash.return12m),
  }
}
