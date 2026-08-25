import express from 'express'
import { createServer as createViteServer } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getMarketData } from './server/market.js'

const app = express()
const port = Number(process.env.PORT ?? 5173)
const root = path.dirname(fileURLToPath(import.meta.url))
app.get('/api/market', async (_request, response) => {
  try {
    const data = await getMarketData()
    response.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    return response.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nieznany błąd źródła danych'
    return response.status(502).json({ error: message })
  }
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
