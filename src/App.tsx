import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  Info,
  Landmark,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  WifiOff,
} from 'lucide-react'
import { ASSETS } from './shared/assets'
import type { AssetTicker } from './shared/assets'
import { lseDateKey, rebalanceSchedule } from './calendar'
import { APP_GUIDE_SECTIONS } from './app-guide'
import { formatDate, formatDateTime, formatPercentagePoints, formatPercent, formatSignalMonth } from './format'
import { getMarketData, marketQueryKey } from './market-client'
import { calculateGemSignal } from './strategy'

const HOLDING_STORAGE_KEY = 'gem-current-holding-v2'
const PerformanceChart = lazy(() => import('./PerformanceChart').then((module) => ({
  default: module.PerformanceChart,
})))

function LoadingState() {
  return (
    <main className="app-shell loading-shell">
      <div className="brand"><span className="brand-mark">G</span><span>GEM Kompas</span></div>
      <div className="loading-card">
        <span className="loading-orbit"><RefreshCw size={24} /></span>
        <h1>Sprawdzam rynki</h1>
        <p>Pobieram ostatnie 12 miesięcy notowań pięciu ETF-ów z giełdy w Londynie.</p>
      </div>
    </main>
  )
}

export default function App() {
  const [lseDay, setLseDay] = useState(lseDateKey)
  const market = useQuery({ queryKey: marketQueryKey(lseDay), queryFn: getMarketData })
  const [visible, setVisible] = useState<string[]>(ASSETS.map((asset) => asset.ticker))
  const [methodOpen, setMethodOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [currentHolding, setCurrentHolding] = useState<AssetTicker | ''>(() => {
    try {
      const stored = localStorage.getItem(HOLDING_STORAGE_KEY)
      return ASSETS.some((asset) => asset.ticker === stored) ? stored as AssetTicker : ''
    } catch {
      return ''
    }
  })
  const schedule = useMemo(() => rebalanceSchedule(new Date(`${lseDay}T12:00:00Z`)), [lseDay])

  useEffect(() => {
    const refreshLseDay = () => setLseDay((current) => {
      const next = lseDateKey()
      return next === current ? current : next
    })
    const interval = window.setInterval(refreshLseDay, 60_000)

    document.addEventListener('visibilitychange', refreshLseDay)
    window.addEventListener('focus', refreshLseDay)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshLseDay)
      window.removeEventListener('focus', refreshLseDay)
    }
  }, [])

  useEffect(() => {
    const markOnline = () => setOnline(true)
    const markOffline = () => setOnline(false)

    window.addEventListener('online', markOnline)
    window.addEventListener('offline', markOffline)
    return () => {
      window.removeEventListener('online', markOnline)
      window.removeEventListener('offline', markOffline)
    }
  }, [])

  const ranking = useMemo(() => market.data ? [...market.data.assets].sort((a, b) => b.return12m - a.return12m) : [], [market.data])
  const signal = useMemo(
    () => market.data ? calculateGemSignal(
      market.data.assets,
      market.data.isActionable ? currentHolding : '',
    ) : null,
    [market.data, currentHolding],
  )
  const selected = signal?.selected
  const selectedMeta = ASSETS.find((asset) => asset.ticker === selected?.ticker)
  const showingCachedSignal = !online || market.data?.dataMode !== 'live'
  const staleSignal = market.data?.dataMode === 'stale'

  if (market.isPending) return <LoadingState />

  if (market.isError || !market.data || !signal || !selected || !selectedMeta) {
    return (
      <main className="app-shell error-shell">
        <div className="brand"><span className="brand-mark">G</span><span>GEM Kompas</span></div>
        <section className="error-card">
          <CircleAlert size={30} />
          <h1>Nie udało się pobrać notowań</h1>
          <p>{market.error?.message ?? 'Źródło danych jest chwilowo niedostępne.'}</p>
          <button className="primary-button" onClick={() => market.refetch()}><RefreshCw size={17} /> Spróbuj ponownie</button>
        </section>
      </main>
    )
  }

  const signalMonth = formatSignalMonth(market.data.signalDate)
  const equityMeta = ASSETS.find((asset) => asset.ticker === signal.equityWinner.ticker)!
  const defensiveMeta = ASSETS.find((asset) => asset.ticker === signal.defensiveWinner.ticker)!
  const candidateMeta = ASSETS.find((asset) => asset.ticker === signal.candidate.ticker)!
  const currentMeta = ASSETS.find((asset) => asset.ticker === currentHolding)
  const positionAction = currentHolding === selected.ticker
    ? `bez zmian — utrzymuj ${selectedMeta.shortTicker}`
    : currentHolding
      ? `zamień ${currentMeta?.shortTicker} na ${selectedMeta.shortTicker}`
      : `zweryfikuj i ustaw 100% ${selectedMeta.shortTicker}`
  const immediateAction = `${positionAction.charAt(0).toLocaleUpperCase('pl-PL')}${positionAction.slice(1)}`
  const actionLabel = !market.data.isActionable
    ? 'Połącz się z internetem i pobierz aktualny sygnał'
    : schedule.isBeforeDecisionDay
    ? `Poczekaj do ${formatDate(schedule.next)}`
    : schedule.isDecisionDay || currentHolding === selected.ticker
      ? immediateAction
      : `Jeśli decyzja nie była wykonana — ${positionAction}`
  const actionDetail = !market.data.isActionable
    ? 'Ten zapis pochodzi z wcześniejszego miesiąca i nie może być podstawą transakcji.'
    : schedule.isBeforeDecisionDay
    ? 'Wykonaj zmianę dopiero w planowanym dniu decyzji.'
    : schedule.isDecisionDay
      ? 'Najpierw potwierdź ceny u brokera.'
      : `Sygnał obowiązuje do kolejnej decyzji (${formatDate(schedule.next)}). Przed zleceniem potwierdź ceny u brokera.`

  const updateHolding = (ticker: AssetTicker | '') => {
    setCurrentHolding(ticker)
    try {
      if (ticker) localStorage.setItem(HOLDING_STORAGE_KEY, ticker)
      else localStorage.removeItem(HOLDING_STORAGE_KEY)
    } catch {
      // W trybie prywatnym wybór może działać tylko do końca bieżącej sesji.
    }
  }

  return (
    <div className="page">
      <header className="topbar app-shell">
        <a className="brand" href="#top" aria-label="GEM Kompas — strona główna">
          <span className="brand-mark">G</span><span>GEM Kompas</span>
        </a>
        <div className={`data-status ${showingCachedSignal ? 'data-status--offline' : ''} ${staleSignal ? 'data-status--stale' : ''}`}>
          {showingCachedSignal ? <WifiOff size={14} /> : <span className="status-dot" />}
          <span className="data-status-copy">
            <span>{staleSignal
              ? 'Stary zapis — bez decyzji'
              : showingCachedSignal
                ? 'Aktualny zapisany sygnał'
                : `Sygnał z ${formatDate(market.data.signalDate)}`}</span>
            {showingCachedSignal && <small>Zapis: {formatDateTime(market.data.snapshotSavedAt)}</small>}
          </span>
        </div>
      </header>

      <main id="top" className="app-shell main-grid">
        <section className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> Twój miesięczny sygnał</div>
          <h1>Jedna decyzja.<br /><span>Raz w miesiącu.</span></h1>
          <p>Sygnał jest liczony raz w miesiącu z zamkniętych danych. Najpierw wybieramy silniejszy rynek akcji, potem sprawdzamy, czy warto w ogóle podejmować ryzyko.</p>
        </section>

        <section className={`recommendation-card ${staleSignal ? 'recommendation-card--stale' : ''}`} style={{ '--accent': selectedMeta.color, '--pale': selectedMeta.pale } as React.CSSProperties}>
          <div className="recommendation-topline">
            <span className="signal-pill"><TrendingUp size={14} /> {staleSignal
              ? 'Stary sygnał · tylko informacyjnie'
              : signal.forcedRiskOff
                ? 'Tryb ochronny · bufor pominięty'
                : signal.switchBuffered
                  ? 'Bufor 3 p.p. · bez zmiany'
                  : signal.riskOn ? 'Tryb akcyjny' : 'Tryb ochronny'}</span>
            <span className="signal-date">Zamknięty sygnał miesięczny</span>
          </div>
          <p className="recommendation-kicker">Sygnał obowiązujący na {signalMonth}</p>
          <div className="recommendation-asset">
            <span className="ticker-badge">{selectedMeta.shortTicker}</span>
            <div><h2>{selectedMeta.name}</h2><p>{selectedMeta.fullName}</p></div>
          </div>
          <div className="recommendation-metrics">
            <div><span>Stopa zwrotu 12M</span><strong>{formatPercent(selected.return12m)}</strong></div>
            <div><span>Filtr akcji vs IB01</span><strong>{formatPercentagePoints(signal.absoluteMargin)}</strong></div>
          </div>
          <div className="next-action">
            <div className="action-icon"><CalendarDays size={21} /></div>
            <div><span>Co zrobić teraz</span><strong>{actionLabel}</strong><small>{actionDetail}</small></div>
          </div>
          <label className="holding-control">
            <span><WalletCards size={16} /> Co masz obecnie w portfelu?</span>
            <select value={currentHolding} onChange={(event) => updateHolding(event.target.value as AssetTicker | '')}>
              <option value="">Nie ustawiono</option>
              {ASSETS.map((asset) => <option key={asset.ticker} value={asset.ticker}>{asset.shortTicker} — {asset.name}</option>)}
            </select>
          </label>
        </section>

        <section className="section full-span">
          <div className="section-heading">
            <div><span className="section-number">01</span><h2>Dane wejściowe</h2></div>
            <p>Pełny obraz na {formatDate(market.data.signalDate)}</p>
          </div>
          <div className="ranking-grid">
            {ranking.map((asset, index) => {
              const meta = ASSETS.find((candidate) => candidate.ticker === asset.ticker)!
              return (
                <article key={asset.ticker} className={`asset-card ${selected.ticker === asset.ticker ? 'asset-card--selected' : ''}`}>
                  <div className="rank-row"><span className="rank">{String(index + 1).padStart(2, '0')}</span>{selected.ticker === asset.ticker && <span className="choice-label"><Check size={12} /> wybór</span>}</div>
                  <div className="asset-symbol" style={{ background: meta.pale, color: meta.color }}>{meta.shortTicker}</div>
                  <h3>{meta.name}</h3>
                  <p>{meta.description}</p>
                  <strong className={asset.return12m >= 0 ? 'positive' : 'negative'}>{formatPercent(asset.return12m)}</strong>
                  <span className="price">Cena sygnału: {asset.signalPrice.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {asset.currency}</span>
                </article>
              )
            })}
          </div>
        </section>

        <section className="section chart-section full-span">
          <div className="section-heading chart-heading">
            <div><span className="section-number">02</span><h2>Jak wyglądał wyścig</h2></div>
            <p>{formatDate(market.data.signalStartDate)} – {formatDate(market.data.signalDate)}</p>
          </div>
          <div className="chart-controls">
            {ASSETS.map((asset) => {
              const active = visible.includes(asset.ticker)
              return <button key={asset.ticker} className={active ? 'active' : ''} aria-pressed={active} onClick={() => setVisible((current) => active ? current.filter((item) => item !== asset.ticker) : [...current, asset.ticker])}><span style={{ background: asset.color }} />{asset.shortTicker}</button>
            })}
          </div>
          <div className="chart-wrap">
            <Suspense fallback={<div className="chart-loading">Ładowanie wykresu…</div>}>
              <PerformanceChart assets={market.data.assets} visible={visible} />
            </Suspense>
          </div>
        </section>

        <section className="section full-span" id="ranking">
          <div className="section-heading">
            <div><span className="section-number">03</span><h2>Jak powstał sygnał</h2></div>
            <p>Trzy decyzje zamiast jednego rankingu</p>
          </div>
          <div className="decision-grid">
            <article>
              <div className="decision-icon"><Scale size={20} /></div><span className="decision-step">Krok 1 · porównanie akcji</span>
              <h3>{equityMeta.shortTicker} wygrywa rynek akcji</h3>
              <p>{equityMeta.name} ma przewagę <strong>{formatPercentagePoints(signal.equityMargin)}</strong> nad kolejnym ETF-em akcyjnym.</p>
            </article>
            <ArrowRight className="decision-arrow" />
            <article>
              <div className="decision-icon"><ShieldCheck size={20} /></div><span className="decision-step">Krok 2 · akcje czy ochrona</span>
              <h3>{signal.riskOn ? 'Ryzyko jest dozwolone' : 'Włącz ochronę kapitału'}</h3>
              <p>{equityMeta.shortTicker} {signal.riskOn ? 'pokonuje' : 'nie pokonuje'} IB01 o <strong>{formatPercentagePoints(Math.abs(signal.absoluteMargin))}</strong>.</p>
            </article>
            <ArrowRight className="decision-arrow" />
            <article>
              <div className="decision-icon"><Landmark size={20} /></div><span className="decision-step">Krok 3 · pozycja</span>
              <h3>Portfel: {selectedMeta.shortTicker}</h3>
              <p>{signal.switchBuffered
                ? `${candidateMeta.shortTicker} ma przewagę ${formatPercentagePoints(signal.switchAdvantage ?? 0)}, czyli mniej niż wymagane +${signal.switchBuffer.toLocaleString('pl-PL')} p.p. — bez zmiany pozycji.`
                : signal.riskOn
                  ? `W trybie akcyjnym trzymamy zwycięzcę części akcyjnej.`
                  : `W obronie silniejszy jest ${defensiveMeta.shortTicker} — przewaga ${formatPercentagePoints(signal.defensiveMargin)}.`}</p>
            </article>
          </div>
        </section>

        <section className="method-card full-span">
          <button
            onClick={() => setMethodOpen((value) => !value)}
            aria-expanded={methodOpen}
            aria-controls="gem-app-guide"
          >
            <span><Info size={19} /><span><strong>Jak działa GEM Kompas?</strong><small>Proste wyjaśnienie danych, sygnału, bufora i trybu offline</small></span></span>
            <ChevronDown className={methodOpen ? 'rotated' : ''} />
          </button>
          {methodOpen && <div
            className="method-content guide-grid"
            id="gem-app-guide"
            role="region"
            aria-label="Jak działa GEM Kompas"
          >
            {APP_GUIDE_SECTIONS.map((section, index) => (
              <article key={section.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><h3>{section.title}</h3><p>{section.body}</p></div>
              </article>
            ))}
          </div>}
        </section>

      </main>

      <footer className="app-shell">
        <div className="brand"><span className="brand-mark">G</span><span>GEM Kompas</span></div>
        <button onClick={() => market.refetch()} disabled={market.isFetching}><RefreshCw size={15} className={market.isFetching ? 'spin' : ''} /> Odśwież dane</button>
      </footer>
    </div>
  )
}
