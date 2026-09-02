export const formatDate = (date: Date | string) => new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric', month: 'long', year: 'numeric',
}).format(typeof date === 'string' ? new Date(`${date}T12:00:00`) : date)

export const formatDateTime = (value: string) => new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

export const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toLocaleString('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}%`

export const formatPercentagePoints = (value: number) => `${value >= 0 ? '+' : ''}${value.toLocaleString('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})} p.p.`

export const formatSignalMonth = (isoDate: string) => {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(date)
}
