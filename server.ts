import express from 'express'
import { createServer as createViteServer } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getMarketData, MarketDataError } from './server/market.js'
import { getQuotes } from './server/quotes.js'

const app = express()
app.disable('x-powered-by')
const port = Number(process.env.PORT ?? 5173)
const root = path.dirname(fileURLToPath(import.meta.url))
app.get('/api/quotes', async (_request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  return response.json(await getQuotes())
})
app.all('/api/quotes', (_request, response) => {
  response.setHeader('Allow', 'GET')
  return response.status(405).json({ error: 'Metoda niedozwolona' })
})
app.get('/api/market', async (_request, response) => {
  try {
    const data = await getMarketData()
    response.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    return response.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd źródła danych'
    const code = error instanceof MarketDataError ? error.code : 'UPSTREAM_UNAVAILABLE'
    return response.status(502).json({ error: message, code })
  }
})
app.all('/api/market', (_request, response) => {
  response.setHeader('Allow', 'GET')
  return response.status(405).json({ error: 'Metoda niedozwolona' })
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(root, 'dist')))
  app.get('*splat', (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))
} else {
  const vite = await createViteServer({ server: { middlewareMode: true, hmr: { port: 24679 } }, appType: 'spa' })
  app.use(vite.middlewares)
}

app.listen(port, '127.0.0.1', () => {
  console.log(`GEM Kompas działa na http://127.0.0.1:${port}`)
})
