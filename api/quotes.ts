import { getQuotes } from '../server/quotes.js'

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') {
      return Response.json({ error: 'Metoda niedozwolona' }, { status: 405, headers: { Allow: 'GET' } })
    }
    const data = await getQuotes()
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } })
  },
}
