import { useMemo, useState } from 'react'
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
} from 'lucide-react'
import { ASSETS } from './shared/assets'
import type { AssetTicker } from './shared/assets'
import type { MarketResponse } from './types'
import { PerformanceChart } from './PerformanceChart'
import { rebalanceSchedule } from './calendar'
import { calculateGemSignal } from './strategy'

const HOLDING_STORAGE_KEY = 'gem-current-holding-v2'

const formatDate = (date: Date | string) => new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric', month: 'long', year: 'numeric',
}).format(typeof date === 'string' ? new Date(`${date}T12:00:00`) : date)

const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const formatPercentagePoints = (value: number) => `${value >= 0 ? '+' : ''}${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`

const formatSignalMonth = (isoDate: string) => {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(date)
}

async function getMarketData(): Promise<MarketResponse> {
  const response = await fetch('/api/market')
  const rawBody = await response.text()
  let body: Partial<MarketResponse> & { error?: string }

  try {
    body = JSON.parse(rawBody) as Partial<MarketResponse> & { error?: string }
  } catch {
    throw new Error(
      response.ok
        ? 'Serwer notowań zwrócił nieprawidłowe dane.'
        : 'Serwer notowań jest chwilowo niedostępny.',
    )
  }

  if (!response.ok) throw new Error(body.error ?? 'Nie udało się pobrać notowań')
  return body as MarketResponse
}

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
  const market = useQuery({ queryKey: ['market'], queryFn: getMarketData })
  const [visible, setVisible] = useState<string[]>(ASSETS.map((asset) => asset.ticker))
  const [methodOpen, setMethodOpen] = useState(false)
  const [currentHolding, setCurrentHolding] = useState<AssetTicker | ''>(() => {
    const stored = localStorage.getItem(HOLDING_STORAGE_KEY)
    return ASSETS.some((asset) => asset.ticker === stored) ? stored as AssetTicker : ''
  })
  const schedule = rebalanceSchedule()

  const ranking = useMemo(() => market.data ? [...market.data.assets].sort((a, b) => b.return12m - a.return12m) : [], [market.data])
  const signal = useMemo(
    () => market.data ? calculateGemSignal(market.data.assets, currentHolding) : null,
    [market.data, currentHolding],
  )
  const selected = signal?.selected
  const selectedMeta = ASSETS.find((asset) => asset.ticker === selected?.ticker)

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
  const actionLabel = schedule.isDecisionDay
    ? currentHolding === selected.ticker
      ? `Bez zmian — utrzymaj ${selectedMeta.shortTicker}`
      : currentHolding
        ? `Zamień ${ASSETS.find((asset) => asset.ticker === currentHolding)?.shortTicker} na ${selectedMeta.shortTicker}`
        : `Zweryfikuj i ustaw 100% ${selectedMeta.shortTicker}`
    : currentHolding === selected.ticker
      ? `Bez zmian — utrzymuj ${selectedMeta.shortTicker}`
      : 'Dziś nie składaj zlecenia'

  const updateHolding = (ticker: AssetTicker | '') => {
    setCurrentHolding(ticker)
    if (ticker) localStorage.setItem(HOLDING_STORAGE_KEY, ticker)
    else localStorage.removeItem(HOLDING_STORAGE_KEY)
  }

  return (
    <div className="page">
      <header className="topbar app-shell">
        <a className="brand" href="#top" aria-label="GEM Kompas — strona główna">
          <span className="brand-mark">G</span><span>GEM Kompas</span>
        </a>
        <div className="data-status"><span className="status-dot" /> Sygnał z {formatDate(market.data.signalDate)}</div>
      </header>

      <main id="top" className="app-shell main-grid">
        <section className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> Twój miesięczny sygnał</div>
          <h1>Jedna decyzja.<br /><span>Raz w miesiącu.</span></h1>
          <p>Sygnał jest liczony raz w miesiącu z zamkniętych danych. Najpierw wybieramy silniejszy rynek akcji, potem sprawdzamy, czy warto w ogóle podejmować ryzyko.</p>
        </section>

        <section className="recommendation-card" style={{ '--accent': selectedMeta.color, '--pale': selectedMeta.pale } as React.CSSProperties}>
          <div className="recommendation-topline">
            <span className="signal-pill"><TrendingUp size={14} /> {signal.switchBuffered ? 'Bufor 3 p.p. · bez zmiany' : signal.riskOn ? 'Tryb risk-on' : 'Tryb ochronny'}</span>
            <span className="signal-date">Zamknięty sygnał miesięczny</span>
          </div>
          <p className="recommendation-kicker">Sygnał obowiązujący na {signalMonth}</p>
          <div className="recommendation-asset">
            <span className="ticker-badge">{selectedMeta.shortTicker}</span>
            <div><h2>{selectedMeta.name}</h2><p>{selectedMeta.fullName}</p></div>
          </div>
          <div className="recommendation-metrics">
            <div><span>Momentum 12M</span><strong>{formatPercent(selected.return12m)}</strong></div>
            <div><span>Filtr akcji vs IB01</span><strong>{formatPercent(signal.absoluteMargin)}</strong></div>
          </div>
          <div className="next-action">
            <div className="action-icon"><CalendarDays size={21} /></div>
            <div><span>Co zrobić teraz</span><strong>{actionLabel}</strong><small>{schedule.isDecisionDay ? 'Najpierw potwierdź ceny u brokera' : `Następna planowana decyzja: ${formatDate(schedule.next)}`}</small></div>
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
              return <button key={asset.ticker} className={active ? 'active' : ''} onClick={() => setVisible((current) => active ? current.filter((item) => item !== asset.ticker) : [...current, asset.ticker])}><span style={{ background: asset.color }} />{asset.shortTicker}</button>
            })}
          </div>
          <div className="chart-wrap"><PerformanceChart assets={market.data.assets} visible={visible} /></div>
        </section>

        <section className="section full-span" id="ranking">
          <div className="section-heading">
            <div><span className="section-number">03</span><h2>Jak powstał sygnał</h2></div>
            <p>Trzy decyzje zamiast jednego rankingu</p>
          </div>
          <div className="decision-grid">
            <article>
              <div className="decision-icon"><Scale size={20} /></div><span className="decision-step">Krok 1 · momentum względne</span>
              <h3>{equityMeta.shortTicker} wygrywa rynek akcji</h3>
              <p>{equityMeta.name} ma przewagę <strong>{formatPercent(signal.equityMargin)}</strong> nad kolejnym ETF-em akcyjnym.</p>
            </article>
            <ArrowRight className="decision-arrow" />
            <article>
              <div className="decision-icon"><ShieldCheck size={20} /></div><span className="decision-step">Krok 2 · momentum absolutne</span>
              <h3>{signal.riskOn ? 'Ryzyko jest dozwolone' : 'Włącz ochronę kapitału'}</h3>
              <p>{equityMeta.shortTicker} {signal.riskOn ? 'pokonuje' : 'nie pokonuje'} IB01 o <strong>{formatPercent(Math.abs(signal.absoluteMargin))}</strong>.</p>
            </article>
            <ArrowRight className="decision-arrow" />
            <article>
              <div className="decision-icon"><Landmark size={20} /></div><span className="decision-step">Krok 3 · pozycja</span>
              <h3>Portfel: {selectedMeta.shortTicker}</h3>
              <p>{signal.switchBuffered
                ? `${candidateMeta.shortTicker} ma przewagę ${formatPercentagePoints(signal.switchAdvantage ?? 0)}, czyli mniej niż wymagane +${signal.switchBuffer.toLocaleString('pl-PL')} p.p. — bez zmiany pozycji.`
                : signal.riskOn
                  ? `W trybie risk-on trzymamy zwycięzcę części akcyjnej.`
                  : `W obronie silniejszy jest ${defensiveMeta.shortTicker} — przewaga ${formatPercent(signal.defensiveMargin)}.`}</p>
            </article>
          </div>
        </section>

        <section className="method-card full-span">
          <button onClick={() => setMethodOpen((value) => !value)} aria-expanded={methodOpen}>
            <span><Info size={19} /><span><strong>Jak dokładnie działa ta wersja GEM?</strong><small>Reguła, założenia i ważna różnica względem klasycznego GEM</small></span></span>
            <ChevronDown className={methodOpen ? 'rotated' : ''} />
          </button>
          {methodOpen && <div className="method-content">
            <p><strong>Reguła adaptowana:</strong> porównujemy EIMI, IWDA i CNDX, a następnie wybieramy najsilniejszy ETF akcyjny. Jeżeli jego 12-miesięczna stopa zwrotu przewyższa IB01, portfel otrzymuje sygnał risk-on. Jeżeli nie — przechodzi do silniejszego z CBU0 i IB01.</p>
            <p><strong>Bufor zmiany 3 p.p.:</strong> jeśli w portfelu jest już ustawione aktywo, nowy kandydat musi mieć momentum wyższe o co najmniej 3 punkty procentowe. Mniejsza przewaga nie wywołuje zmiany, co ogranicza niepotrzebne transakcje przy częstym przecinaniu się wykresów.</p>
            <p><strong>Dlaczego nie nazywamy tego dokładnym klasycznym GEM?</strong> Oryginał porównuje akcje USA z akcjami poza USA, a w trybie ochronnym wykorzystuje szeroki indeks obligacji agregatowych. CNDX koncentruje się na Nasdaq 100, IWDA zawiera dużo USA, EIMI obejmuje tylko rynki wschodzące, a CBU0 to obligacje skarbowe USA 7–10 lat. Mechanika dual momentum jest zachowana, lecz koszyki są inne.</p>
            <p><strong>Sygnał nie zmienia się w środku miesiąca.</strong> Obliczamy go ze skorygowanych cen zamknięcia od końca miesiąca do końca miesiąca 12 miesięcy wcześniej. Kalendarz uwzględnia weekendy i standardowe dni bez sesji LSE.</p>
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
