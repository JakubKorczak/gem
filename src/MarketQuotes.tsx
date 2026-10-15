import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, Clock3, Minus, RefreshCw } from 'lucide-react'
import { ASSETS } from './shared/assets'
import { formatDate, formatPercent } from './format'
import { getQuotes, quoteStatus } from './quotes-client'
import type { QuoteStatus } from './quotes-client'

const STATUS_LABELS: Record<QuoteStatus, string> = {
  trading: 'Sesja trwa · dane opóźnione',
  closed: 'Poza sesją · ostatnia cena',
  stale: 'Starsze notowanie',
  offline: 'Offline · zapisane notowanie',
  unknown: 'Status sesji niedostępny',
}

const quoteTime = (value: string) => new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

export function MarketQuotes() {
  const [now, setNow] = useState(() => new Date())
  const [online, setOnline] = useState(navigator.onLine)
  const quotes = useQuery({
    queryKey: ['quotes'], queryFn: getQuotes, staleTime: 60_000, refetchInterval: 60_000,
    refetchOnWindowFocus: 'always', refetchOnReconnect: 'always', retry: 1,
  })

  useEffect(() => {
    const update = () => { setNow(new Date()); setOnline(navigator.onLine) }
    const timer = window.setInterval(update, 20_000)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      window.removeEventListener('focus', update)
    }
  }, [])

  return (
    <section className="market-quotes full-span" aria-labelledby="quotes-heading">
      <div className="quotes-heading">
        <div><span className="quotes-eyebrow">Puls portfela</span><h2 id="quotes-heading">Co słychać na rynkach?</h2></div>
        <button onClick={() => quotes.refetch()} disabled={quotes.isFetching || !online} aria-label="Odśwież bieżące ceny">
          <RefreshCw size={14} className={quotes.isFetching ? 'spin' : ''} />
          <span>{formatDate(now)}</span>
        </button>
      </div>
      <div className="quotes-grid" aria-busy={quotes.isFetching}>
        {ASSETS.map((asset) => {
          const quote = quotes.data?.quotes.find((entry) => entry.ticker === asset.ticker)?.quote
          const status = quote && quotes.data ? quoteStatus(quote, quotes.data.generatedAt, now, online, quotes.isError) : null
          const change = quote ? quote.price - quote.previousClose : null
          const direction = change === null || change === 0 ? 'flat' : change > 0 ? 'up' : 'down'
          const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus
          return (
            <article key={asset.ticker} className={`quote-card quote-card--${status ?? 'unavailable'}`}>
              <div className="quote-card-top"><span className="quote-ticker" style={{ color: asset.color, background: asset.pale }}>{asset.shortTicker}</span><span className="quote-exchange">LSE · USD</span></div>
              <h3>{asset.name}</h3>
              <strong className="quote-price">{quote ? quote.price.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} <small>USD</small></strong>
              <div className={`quote-change quote-change--${direction}`}>
                <Icon size={17} aria-hidden="true" />
                <strong>{quote && change !== null ? formatPercent(change / quote.previousClose * 100) : '—'}</strong>
                {change !== null && <span>{change >= 0 ? '+' : ''}{change.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>}
              </div>
              <div className="quote-status"><Clock3 size={11} aria-hidden="true" /><span>{status ? STATUS_LABELS[status] : !online ? 'Offline · brak notowania' : quotes.isPending ? 'Pobieranie ceny…' : 'Cena chwilowo niedostępna'}</span></div>
              <time className="quote-time" dateTime={quote?.quotedAt}>{quote ? `${quoteTime(quote.quotedAt)} · czas PL` : 'Spróbuj odświeżyć za chwilę'}</time>
            </article>
          )
        })}
      </div>
      <p className="quotes-footnote">Zmiana względem poprzedniego zamknięcia. Poza sesją pokazujemy ostatnie dostępne notowanie. Źródło: <a href="https://finance.yahoo.com/" target="_blank" rel="noreferrer">Yahoo Finance</a> · ceny mogą być opóźnione · odświeżanie co minutę.</p>
    </section>
  )
}
