import { describe, expect, it } from 'vitest'
import {
  createDecisionCalendar,
  decisionDates,
  firstTradingDay,
  isLseTradingDay,
  lastTradingDay,
  lseDateKey,
  rebalanceSchedule,
  signalPeriod,
} from './calendar'

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
    expect(schedule.isAfterDecisionDay).toBe(true)
    expect(schedule.isBeforeDecisionDay).toBe(false)
  })

  it('rozpoznaje dzień przed pierwszą sesją miesiąca', () => {
    const schedule = rebalanceSchedule(new Date('2027-01-01T10:00:00+01:00'))
    expect(schedule.next.toISOString().slice(0, 10)).toBe('2027-01-04')
    expect(schedule.isBeforeDecisionDay).toBe(true)
  })

  it('uwzględnia jednorazowe zamknięcia i przeniesione święta LSE', () => {
    expect(isLseTradingDay(new Date('2022-05-30T12:00:00Z'))).toBe(true)
    expect(isLseTradingDay(new Date('2022-06-02T12:00:00Z'))).toBe(false)
    expect(isLseTradingDay(new Date('2022-09-19T12:00:00Z'))).toBe(false)
    expect(isLseTradingDay(new Date('2023-05-08T12:00:00Z'))).toBe(false)
  })

  it('wyznacza ostatnią sesję sierpnia 2026 przed świętem bankowym', () => {
    expect(lastTradingDay(2026, 7).toISOString().slice(0, 10)).toBe('2026-08-28')
  })

  it('przełącza miesiąc sygnału według czasu londyńskiego, a nie UTC lub Warszawy', () => {
    const beforeLondonMidnight = signalPeriod(new Date('2026-08-31T22:30:00Z'))
    const afterLondonMidnight = signalPeriod(new Date('2026-08-31T23:30:00Z'))

    expect(beforeLondonMidnight).toMatchObject({ signalMonth: '2026-08', signalDate: '2026-07-31' })
    expect(afterLondonMidnight).toMatchObject({ signalMonth: '2026-09', signalDate: '2026-08-28' })
  })

  it('zmienia klucz dnia dokładnie o północy w Londynie podczas czasu letniego', () => {
    expect(lseDateKey(new Date('2026-08-31T22:59:59Z'))).toBe('2026-08-31')
    expect(lseDateKey(new Date('2026-08-31T23:00:00Z'))).toBe('2026-09-01')
  })

  it('zmienia klucz dnia dokładnie o północy w Londynie podczas czasu zimowego', () => {
    expect(lseDateKey(new Date('2026-11-30T23:59:59Z'))).toBe('2026-11-30')
    expect(lseDateKey(new Date('2026-12-01T00:00:00Z'))).toBe('2026-12-01')
  })

  it('oznacza sygnał jako nieweryfikowany po końcu znanego kalendarza LSE', () => {
    expect(signalPeriod(new Date('2027-01-04T12:00:00Z')).calendarVerified).toBe(false)
    expect(signalPeriod(new Date('2027-02-02T12:00:00Z')).calendarVerified).toBe(false)
  })

  it('tworzy po jednym terminie na pierwszy dzień sesyjny każdego miesiąca', () => {
    const dates = decisionDates(new Date('2026-08-25T10:00:00+02:00'), 3)
    expect(dates.map((date) => date.toISOString().slice(0, 10))).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-02',
    ])
  })

  it('generuje kalendarz z pojedynczym alarmem i treścią przypomnienia', () => {
    const calendar = createDecisionCalendar(new Date('2026-08-25T08:00:00Z'), 6)
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(6)
    expect(calendar.match(/BEGIN:VALARM/g)).toHaveLength(6)
    expect(calendar).toContain('DTSTART:20260901T090000')
    expect(calendar).toContain('Dziś dzień decyzji GEM. Otwórz aplikację i wykonaj checklistę.')
    expect(calendar).toContain('Terminy po 2026 r. potwierdź w aktualnym kalendarzu LSE.')
  })
})
