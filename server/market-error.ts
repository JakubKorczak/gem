import type { MarketErrorCode } from '../src/types.js'

export class MarketDataError extends Error {
  constructor(public readonly code: MarketErrorCode, message: string) {
    super(message)
    this.name = 'MarketDataError'
  }
}
