import { Component, type ErrorInfo, type ReactNode } from 'react'
import { CircleAlert, RefreshCw } from 'lucide-react'

type Props = { children: ReactNode }
type State = { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Nie udało się wyrenderować GEM Kompas', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="app-shell error-shell">
        <div className="brand"><span className="brand-mark">G</span><span>GEM Kompas</span></div>
        <section className="error-card">
          <CircleAlert size={30} />
          <h1>Nie udało się odczytać sygnału</h1>
          <p>Zapisane albo pobrane dane są niepełne. Odśwież aplikację, aby pobrać ich poprawną wersję.</p>
          <button className="primary-button" onClick={() => window.location.reload()}>
            <RefreshCw size={17} /> Odśwież aplikację
          </button>
        </section>
      </main>
    )
  }
}
