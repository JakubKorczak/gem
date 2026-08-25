const DAY = 24 * 60 * 60 * 1000

function dateOnly(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day))
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

  return [
    observed(dateOnly(year, 0, 1)),
    goodFriday,
    easterMonday,
    firstWeekday(year, 4, 1),
    lastWeekday(year, 4, 1),
    lastWeekday(year, 7, 1),
    observedChristmas,
    observedBoxing,
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

export function rebalanceSchedule(now = new Date()) {
  const today = dateOnly(now.getFullYear(), now.getMonth(), now.getDate())
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
  }
}
