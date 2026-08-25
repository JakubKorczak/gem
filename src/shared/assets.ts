export const ASSETS = [
  {
    ticker: 'EIMI.L',
    shortTicker: 'EIMI',
    name: 'Rynki wschodzące',
    fullName: 'iShares Core MSCI EM IMI UCITS ETF',
    description: 'Duże, średnie i małe spółki z rynków rozwijających się.',
    isin: 'IE00BKM4GZ66',
    color: '#e46c4d',
    pale: '#fff0ea',
  },
  {
    ticker: 'IWDA.L',
    shortTicker: 'IWDA',
    name: 'Rynki rozwinięte',
    fullName: 'iShares Core MSCI World UCITS ETF',
    description: 'Szeroki koszyk spółek z rozwiniętych rynków świata.',
    isin: 'IE00B4L5Y983',
    color: '#2a68e8',
    pale: '#edf3ff',
  },
  {
    ticker: 'CBU0.L',
    shortTicker: 'CBU0',
    name: 'Obligacje USA 7–10 lat',
    fullName: 'iShares $ Treasury Bond 7-10yr UCITS ETF',
    description: 'Średnioterminowe obligacje skarbowe Stanów Zjednoczonych.',
    isin: 'IE00B3VWN518',
    color: '#169a76',
    pale: '#eaf8f3',
  },
  {
    ticker: 'IB01.L',
    shortTicker: 'IB01',
    name: 'Gotówka / obligacje 0–1 rok',
    fullName: 'iShares $ Treasury Bond 0-1yr UCITS ETF',
    description: 'Krótkoterminowe bony i obligacje skarbowe USA.',
    isin: 'IE00BGSF1X88',
    color: '#7867d8',
    pale: '#f2efff',
  },
] as const

export type AssetTicker = (typeof ASSETS)[number]['ticker']
