const DAY = 24 * 60 * 60 * 1000
export const LSE_CALENDAR_VERIFIED_THROUGH_YEAR = 2026
export const LSE_TIME_ZONE = 'Europe/London'

const LSE_HOLIDAY_OVERRIDES: Record<number, { add: readonly string[]; remove?: readonly string[] }> = {
  2022: {
    add: ['2022-06-02', '2022-06-03', '2022-09-19'],
    remove: ['2022-05-30'],
  },
  2023: {
    add: ['2023-05-08'],
  },
}

function dateOnly(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day))
}

function datePartsInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  return { year: value('year'), month: value('month') - 1, day: value('day') }
}

export function lseDate(now = new Date()) {
  const { year, month, day } = datePartsInTimeZone(now, LSE_TIME_ZONE)
  return dateOnly(year, month, day)
}

export function lseDateKey(now = new Date()) {
  return lseDate(now).toISOString().slice(0, 10)
}

function easterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return dateOnly(year, month, day)
}

function firstWeekday(year: number, month: number, weekday: number) {
  const date = dateOnly(year, month, 1)
  date.setUTCDate(1 + ((7 + weekday - date.getUTCDay()) % 7))
  return date
}

function lastWeekday(year: number, month: number, weekday: number) {
  const date = dateOnly(year, month + 1, 0)
  date.setUTCDate(date.getUTCDate() - ((7 + date.getUTCDay() - weekday) % 7))
  return date
}

function observed(date: Date) {
  const day = date.getUTCDay()
  if (day === 6) return new Date(date.getTime() + 2 * DAY)
  if (day === 0) return new Date(date.getTime() + DAY)
  return date
}

export function lseHolidays(year: number) {
  const easter = easterSunday(year)
  const goodFriday = new Date(easter.getTime() - 2 * DAY)
  const easterMonday = new Date(easter.getTime() + DAY)
  const christmas = dateOnly(year, 11, 25)
  const boxingDay = dateOnly(year, 11, 26)

  const observedChristmas = observed(christmas)
  let observedBoxing = observed(boxingDay)
  if (observedBoxing.getTime() === observedChristmas.getTime()) {
    observedBoxing = new Date(observedBoxing.getTime() + DAY)
  }

  const standard = [
    observed(dateOnly(year, 0, 1)),
    goodFriday,
    easterMonday,
    firstWeekday(year, 4, 1),
    lastWeekday(year, 4, 1),
    lastWeekday(year, 7, 1),
    observedChristmas,
    observedBoxing,
  ]
  const overrides = LSE_HOLIDAY_OVERRIDES[year]
  const removed = new Set(overrides?.remove ?? [])
  return [
    ...standard.filter((date) => !removed.has(date.toISOString().slice(0, 10))),
    ...(overrides?.add ?? []).map((date) => new Date(`${date}T12:00:00Z`)),
  ]
}

export function isLseTradingDay(date: Date) {
  const day = date.getUTCDay()
  if (day === 0 || day === 6) return false
  const iso = date.toISOString().slice(0, 10)
  return !lseHolidays(date.getUTCFullYear()).some((holiday) => holiday.toISOString().slice(0, 10) === iso)
}

export function firstTradingDay(year: number, month: number) {
  const candidate = dateOnly(year, month, 1)
  while (!isLseTradingDay(candidate)) candidate.setUTCDate(candidate.getUTCDate() + 1)
  return candidate
}

export function lastTradingDay(year: number, month: number) {
  const candidate = dateOnly(year, month + 1, 0)
  while (!isLseTradingDay(candidate)) candidate.setUTCDate(candidate.getUTCDate() - 1)
  return candidate
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10)

export function signalPeriod(now = new Date()) {
  const currentMarketDate = lseDate(now)
  const signalMonth = isoDate(currentMarketDate).slice(0, 7)
  const end = lastTradingDay(currentMarketDate.getUTCFullYear(), currentMarketDate.getUTCMonth() - 1)
  const start = lastTradingDay(end.getUTCFullYear() - 1, end.getUTCMonth())

  return {
    signalMonth,
    signalDate: isoDate(end),
    signalStartDate: isoDate(start),
    calendarVerified: currentMarketDate.getUTCFullYear() <= LSE_CALENDAR_VERIFIED_THROUGH_YEAR
      && end.getUTCFullYear() <= LSE_CALENDAR_VERIFIED_THROUGH_YEAR
      && start.getUTCFullYear() <= LSE_CALENDAR_VERIFIED_THROUGH_YEAR,
  }
}

export function rebalanceSchedule(now = new Date()) {
  const today = lseDate(now)
  const thisMonth = firstTradingDay(today.getUTCFullYear(), today.getUTCMonth())
  const next = today.getTime() <= thisMonth.getTime()
    ? thisMonth
    : firstTradingDay(today.getUTCMonth() === 11 ? today.getUTCFullYear() + 1 : today.getUTCFullYear(), (today.getUTCMonth() + 1) % 12)
  const previous = today.getTime() >= thisMonth.getTime()
    ? thisMonth
    : firstTradingDay(today.getUTCMonth() === 0 ? today.getUTCFullYear() - 1 : today.getUTCFullYear(), (today.getUTCMonth() + 11) % 12)
  return {
    next,
    previous,
    daysToNext: Math.max(0, Math.ceil((next.getTime() - today.getTime()) / DAY)),
    isDecisionDay: today.getTime() === thisMonth.getTime(),
    isBeforeDecisionDay: today.getTime() < thisMonth.getTime(),
    isAfterDecisionDay: today.getTime() > thisMonth.getTime(),
  }
}

export function decisionDates(now = new Date(), months = 24) {
  const dates: Date[] = []
  const today = lseDate(now)
  let year = today.getUTCFullYear()
  let month = today.getUTCMonth()

  while (dates.length < months) {
    const decisionDate = firstTradingDay(year, month)
    if (decisionDate.getTime() >= today.getTime()) {
      dates.push(decisionDate)
    }
    month += 1
    if (month === 12) {
      month = 0
      year += 1
    }
  }

  return dates
}

const compactDate = (date: Date) => date.toISOString().slice(0, 10).replaceAll('-', '')

export function createDecisionCalendar(now = new Date(), months = 24) {
  const createdAt = now.toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z')
  const events = decisionDates(now, months).map((date) => {
    const day = compactDate(date)
    const verificationNote = date.getUTCFullYear() > LSE_CALENDAR_VERIFIED_THROUGH_YEAR
      ? ` Terminy po ${LSE_CALENDAR_VERIFIED_THROUGH_YEAR} r. potwierdź w aktualnym kalendarzu LSE.`
      : ''
    return [
      'BEGIN:VEVENT',
      `UID:gem-kompas-${day}@gem-kompas`,
      `DTSTAMP:${createdAt}`,
      `DTSTART:${day}T090000`,
      `DTEND:${day}T091500`,
      'SUMMARY:Dzień decyzji GEM',
      `DESCRIPTION:Dziś dzień decyzji GEM. Otwórz aplikację i wykonaj checklistę.${verificationNote}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT0M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Dziś dzień decyzji GEM. Otwórz aplikację i wykonaj checklistę.',
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n')
  })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GEM Kompas//Kalendarz decyzji//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:GEM Kompas — dni decyzji',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
