import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

describe('kontrakt PWA', () => {
  it('oznacza odpowiedzi z cache i omija cache HTTP podczas próby sieciowej API', () => {
    const worker = readFileSync(`${projectRoot}/public/sw.js`, 'utf8')
    expect(worker).toContain("new Request(request, { cache: 'no-store' })")
    expect(worker).toContain("headers.set('X-GEM-Cache', 'true')")
  })

  it('synchronizuje wersję rejestracji workera i obu cache', () => {
    const worker = readFileSync(`${projectRoot}/public/sw.js`, 'utf8')
    const entry = readFileSync(`${projectRoot}/src/main.tsx`, 'utf8')

    expect(worker).toContain("const SHELL_CACHE = 'gem-shell-v6'")
    expect(worker).toContain("const DATA_CACHE = 'gem-data-v6'")
    expect(entry).toContain("register('/sw.js?v=6')")
  })

  it('ma komplet ikon zadeklarowanych w manifeście', () => {
    const manifest = JSON.parse(readFileSync(`${projectRoot}/public/manifest.webmanifest`, 'utf8')) as {
      icons: Array<{ src: string }>
    }
    expect(manifest.icons.length).toBeGreaterThan(0)
    expect(manifest.icons.every((icon) => existsSync(`${projectRoot}/public${icon.src}`))).toBe(true)
  })
})
