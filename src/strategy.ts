import type { AssetMarketData } from './types'

export type GemSignal = {
  selected: AssetMarketData
  candidate: AssetMarketData
  equityWinner: AssetMarketData
  defensiveWinner: AssetMarketData
  cashProxy: AssetMarketData
  riskOn: boolean
  forcedRiskOff: boolean
  switchBuffered: boolean
  switchAdvantage: number | null
  switchBuffer: number
  equityMargin: number
  absoluteMargin: number
  defensiveMargin: number
}

export const SWITCH_BUFFER_PERCENTAGE_POINTS = 3

const EQUITY_TICKERS: AssetMarketData['ticker'][] = ['EIMI.L', 'IWDA.L', 'CNDX.L']

export type MomentumSelection<Ticker extends string> = {
  selected: Ticker
  candidate: Ticker
  equityWinner: Ticker
  defensiveWinner: Ticker
  cashProxy: Ticker
  riskOn: boolean
  forcedRiskOff: boolean
  switchBuffered: boolean
  switchAdvantage: number | null
  equityMargin: number
  absoluteMargin: number
  defensiveMargin: number
}

export function calculateMomentumSelection<Ticker extends string>(
  returns: Record<Ticker, number>,
  config: {
    equities: readonly Ticker[]
    bond: Ticker
    cash: Ticker
    currentHolding?: Ticker
    switchBufferPercentagePoints?: number
  },
): MomentumSelection<Ticker> {
  const buffer = config.switchBufferPercentagePoints ?? SWITCH_BUFFER_PERCENTAGE_POINTS
  const equities = [...config.equities].sort((a, b) => returns[b] - returns[a])
  if (equities.length < 2) throw new Error('Strategia wymaga co najmniej dwóch aktywów akcyjnych')
  const equityWinner = equities[0]
  const equityRunnerUp = equities[1]
  const riskOn = returns[equityWinner] > returns[config.cash]
  const defensiveWinner = returns[config.bond] >= returns[config.cash] ? config.bond : config.cash
  const candidate = riskOn ? equityWinner : defensiveWinner
  const switchAdvantage = config.currentHolding && config.currentHolding !== candidate
    ? returns[candidate] - returns[config.currentHolding]
    : null
  const forcedRiskOff = Boolean(config.currentHolding
    && config.equities.includes(config.currentHolding)
    && !riskOn
    && config.currentHolding !== candidate)
  const switchBuffered = buffer > 0 && switchAdvantage !== null && !forcedRiskOff && switchAdvantage < buffer

  return {
    selected: switchBuffered && config.currentHolding ? config.currentHolding : candidate,
    candidate,
    equityWinner,
    defensiveWinner,
    cashProxy: config.cash,
    riskOn,
    forcedRiskOff,
    switchBuffered,
    switchAdvantage,
    equityMargin: returns[equityWinner] - returns[equityRunnerUp],
    absoluteMargin: returns[equityWinner] - returns[config.cash],
    defensiveMargin: Math.abs(returns[config.bond] - returns[config.cash]),
  }
}

function requireAsset(assets: AssetMarketData[], ticker: AssetMarketData['ticker']) {
  const asset = assets.find((candidate) => candidate.ticker === ticker)
  if (!asset) throw new Error(`Brak danych dla ${ticker}`)
  return asset
}

export function calculateGemSignal(
  assets: AssetMarketData[],
  currentHoldingTicker?: AssetMarketData['ticker'] | '',
): GemSignal {
  const equities = EQUITY_TICKERS.map((ticker) => requireAsset(assets, ticker))
  const bonds = requireAsset(assets, 'CBU0.L')
  const cash = requireAsset(assets, 'IB01.L')
  const returns = Object.fromEntries(assets.map((asset) => [asset.ticker, asset.return12m])) as Record<AssetMarketData['ticker'], number>
  const selection = calculateMomentumSelection(returns, {
    equities: EQUITY_TICKERS,
    bond: bonds.ticker,
    cash: cash.ticker,
    currentHolding: currentHoldingTicker || undefined,
  })

  return {
    selected: requireAsset(assets, selection.selected),
    candidate: requireAsset(assets, selection.candidate),
    equityWinner: requireAsset(equities, selection.equityWinner),
    defensiveWinner: requireAsset(assets, selection.defensiveWinner),
    cashProxy: cash,
    riskOn: selection.riskOn,
    forcedRiskOff: selection.forcedRiskOff,
    switchBuffered: selection.switchBuffered,
    switchAdvantage: selection.switchAdvantage,
    switchBuffer: SWITCH_BUFFER_PERCENTAGE_POINTS,
    equityMargin: selection.equityMargin,
    absoluteMargin: selection.absoluteMargin,
    defensiveMargin: selection.defensiveMargin,
  }
}
