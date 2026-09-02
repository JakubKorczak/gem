import { describe, expect, it } from 'vitest'
import { APP_GUIDE_SECTIONS } from './app-guide'

describe('prosty przewodnik po aplikacji', () => {
  it('wyjaśnia wszystkie wymagane elementy w dziewięciu krótkich sekcjach', () => {
    const text = APP_GUIDE_SECTIONS.map((section) => `${section.title} ${section.body}`).join(' ')

    expect(APP_GUIDE_SECTIONS).toHaveLength(9)
    expect(text).toContain('stopy zwrotu z ostatnich 12 miesięcy')
    expect(text).toContain('nigdy nie blokuje wyjścia z akcji')
    expect(text).toContain('Stary zapis służy tylko do informacji')
    expect(text).toContain('nie składa zleceń')
  })
})
