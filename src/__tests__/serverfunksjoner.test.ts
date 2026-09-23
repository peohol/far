/**
 * Serverfunksjonene under `api/` kjøres av Vercel som ES-moduler i Node, fil
 * for fil og uten bundler. Node finner da ikke en relativ import uten
 * filendelse, og funksjonen feiler før den svarer (`ERR_MODULE_NOT_FOUND`).
 * Testen går gjennom alt funksjonene importerer, og krever at hver relativ
 * import har `.js`, som Vercel skriver om `.ts`-filene til.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROT = fileURLToPath(new URL('../../', import.meta.url))
const API = resolve(ROT, 'api')

/** Relative importer som blir stående etter kompilering (ikke `import type`). */
function relativeImporter(kode: string): string[] {
  return [...kode.matchAll(/^\s*(?:import|export)\s+(?!type\s)[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/gm)].map(
    (m) => m[1]!,
  )
}

/** Alle filene en serverfunksjon trekker inn, med importene som mangler `.js`. */
function uten_js(start: string): string[] {
  const funnet: string[] = []
  const sett = new Set<string>()
  const ko = [start]
  while (ko.length) {
    const fil = ko.pop()!
    if (sett.has(fil)) continue
    sett.add(fil)
    for (const sti of relativeImporter(readFileSync(fil, 'utf8'))) {
      if (!sti.endsWith('.js')) {
        funnet.push(`${relative(ROT, fil)}: ${sti}`)
        continue
      }
      const ts = resolve(dirname(fil), sti.replace(/\.js$/, '.ts'))
      expect(existsSync(ts), `${relative(ROT, fil)}: ${sti}`).toBe(true)
      ko.push(ts)
    }
  }
  return funnet
}

describe('serverfunksjonene under api/', () => {
  const funksjoner = readdirSync(API).filter((f) => f.endsWith('.ts'))

  it('finnes', () => {
    expect(funksjoner.length).toBeGreaterThan(0)
  })

  it.each(funksjoner)('%s importerer bare med .js-endelse, så Node finner filene', (fil) => {
    expect(uten_js(resolve(API, fil))).toEqual([])
  })
})
