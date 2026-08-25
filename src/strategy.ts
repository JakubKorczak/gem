import type { AssetMarketData } from './types'

export type GemSignal = {
  selected: AssetMarketData
  equityWinner: AssetMarketData
  defensiveWinner: AssetMarketData
  cashProxy: AssetMarketData
  riskOn: boolean
  equityMargin: number
  absoluteMargin: number
  defensiveMargin: number
}

function requireAsset(assets: AssetMarketData[], ticker: AssetMarketData['ticker']) {
  const asset = assets.find((candidate) => candidate.ticker === ticker)
  if (!asset) throw new Error(`Brak danych dla ${ticker}`)
  return asset
}

export function calculateGemSignal(assets: AssetMarketData[]): GemSignal {
  const emerging = requireAsset(assets, 'EIMI.L')
  const developed = requireAsset(assets, 'IWDA.L')
  const bonds = requireAsset(assets, 'CBU0.L')
  const cash = requireAsset(assets, 'IB01.L')

  const equityWinner = emerging.return12m >= developed.return12m ? emerging : developed
  const equityLoser = equityWinner.ticker === emerging.ticker ? developed : emerging
  const riskOn = equityWinner.return12m > cash.return12m
  const defensiveWinner = bonds.return12m >= cash.return12m ? bonds : cash

  return {
    selected: riskOn ? equityWinner : defensiveWinner,
    equityWinner,
    defensiveWinner,
    cashProxy: cash,
    riskOn,
    equityMargin: equityWinner.return12m - equityLoser.return12m,
    absoluteMargin: equityWinner.return12m - cash.return12m,
    defensiveMargin: Math.abs(bonds.return12m - cash.return12m),
  }
}
