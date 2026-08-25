import { getMarketData } from '../server/market.ts'

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') {
      return Response.json(
        { error: 'Metoda niedozwolona' },
        { status: 405, headers: { Allow: 'GET' } },
      )
    }

    try {
      const data = await getMarketData()
      return Response.json(data, {
        headers: {
          'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd źródła danych'
      return Response.json({ error: message }, { status: 502 })
    }
  },
}
