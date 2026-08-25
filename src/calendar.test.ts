import { describe, expect, it } from 'vitest'
import { firstTradingDay, rebalanceSchedule } from './calendar'

describe('kalendarz decyzji GEM', () => {
  it('przesuwa pierwszy dzień miesiąca z weekendu na poniedziałek', () => {
    expect(firstTradingDay(2026, 7).toISOString().slice(0, 10)).toBe('2026-08-03')
  })

  it('uwzględnia Nowy Rok jako dzień bez sesji LSE', () => {
    expect(firstTradingDay(2026, 0).toISOString().slice(0, 10)).toBe('2026-01-02')
  })

  it('wyznacza kolejną decyzję po bieżącej dacie', () => {
    const schedule = rebalanceSchedule(new Date('2026-08-25T10:00:00+02:00'))
    expect(schedule.next.toISOString().slice(0, 10)).toBe('2026-09-01')
    expect(schedule.previous.toISOString().slice(0, 10)).toBe('2026-08-03')
  })
})
