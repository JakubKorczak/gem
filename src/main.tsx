import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/dm-sans'
import './styles.css'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { MARKET_QUERY_DEFAULTS } from './market-client'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: MARKET_QUERY_DEFAULTS,
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js?v=5')
  })
}
