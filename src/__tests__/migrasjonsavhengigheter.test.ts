/** Når CI kjører migrasjonskontrollen, og at lista over hva den avhenger av holder følge med koden. */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AVHENGIGHETER, berorteAvhengigheter, erAvhengighet, PAKKEDELER } from '../faginnhold/migrasjonsavhengigheter'

const ROT = fileURLToPath(new URL('../../', import.meta.url))
const les = (fil: string) => readFileSync(join(ROT, fil), 'utf8')
const ARBEIDSFLYTER = ['.github/workflows/ci.yml', '.github/workflows/produksjonsmigrering.yml']
const pakke = JSON.parse(les('package.json')) as { scripts: Record<string, string> }

/** `berorteAvhengigheter` med filene slik de står før og etter. */
function berort(endringer: Record<string, [string | undefined, string | undefined]>) {
  return berorteAvhengigheter(Object.keys(endringer), (hvor, fil) => endringer[fil]?.[hvor === 'før' ? 0 : 1])
}

const pakkejson = (versjon: string, skript: Record<string, string> = {}) =>
  JSON.stringify({ version: versjon, scripts: { 'kontroller:migrasjoner': 'vite-node a.ts', ...skript } })

describe('om en PR berører migrasjonene', () => {
  it('gjelder migrasjonene og filene kontrollen og utrullingen avhenger av', () => {
    expect(erAvhengighet('supabase/migrations/20261006000000_ny.sql')).toBe(true)
    expect(erAvhengighet('src/faginnhold/sqlsetninger.ts')).toBe(true)
    expect(erAvhengighet('.github/workflows/produksjonsmigrering.yml')).toBe(true)
    expect(erAvhengighet('supabase/migrationsx/a.sql')).toBe(false)
    expect(erAvhengighet('supabase/maler/monografkuratering.sql')).toBe(false)
    expect(erAvhengighet('src/components/Fagside.tsx')).toBe(false)
  })

  it('gir hver endret avhengighet, og ingenting for andre filer', () => {
    expect(
      berort({
        'supabase/migrations/20261006000000_ny.sql': [undefined, 'select 1;'],
        'src/data/endringslogg.ts': ['a', 'b'],
      }),
    ).toEqual(['supabase/migrations/20261006000000_ny.sql'])
    expect(berort({ 'src/data/endringslogg.ts': ['a', 'b'], 'docs/x.md': [undefined, 'c'] })).toEqual([])
  })

  it('ser bort fra endringer i pakkefilene som ikke gjelder migrasjonene, som versjonsnummeret', () => {
    expect(berort({ 'package.json': [pakkejson('1.0.0'), pakkejson('1.0.1', { dev: 'vite' })] })).toEqual([])
    expect(
      berort({
        'package-lock.json': [
          JSON.stringify({ version: '1.0.0', packages: { 'node_modules/supabase': { version: '2.117.0' } } }),
          JSON.stringify({ version: '1.0.1', packages: { 'node_modules/supabase': { version: '2.117.0' } } }),
        ],
      }),
    ).toEqual([])
  })

  it('gir delene av pakkefilene migrasjonene avhenger av, når de endres', () => {
    expect(
      berort({ 'package.json': [pakkejson('1.0.0'), pakkejson('1.0.1', { 'kontroller:migrasjoner': 'vite-node b.ts' })] }),
    ).toEqual(['package.json: scripts → kontroller:migrasjoner'])
    expect(
      berort({
        'package-lock.json': [
          JSON.stringify({ packages: { 'node_modules/supabase': { version: '2.117.0' } } }),
          JSON.stringify({ packages: { 'node_modules/supabase': { version: '2.118.0' } } }),
        ],
      }),
    ).toEqual(['package-lock.json: packages → node_modules/supabase'])
  })

  it('regner en pakkefil som er fjernet, lagt til eller ikke kan leses, som endret', () => {
    const delene = (PAKKEDELER['package.json'] ?? []).map((sti) => `package.json: ${sti.join(' → ')}`)
    expect(berort({ 'package.json': [les('package.json'), undefined] })).toEqual(delene)
    expect(berort({ 'package.json': [undefined, les('package.json')] })).toEqual(delene)
    expect(berort({ 'package.json': [les('package.json'), '{ ødelagt'] })).toEqual(delene)
  })
})

/** De relative importene i en TypeScript-fil, som stier fra roten. */
function importer(fil: string): string[] {
  return [...les(fil).matchAll(/(?:from|import)\s+'(\.{1,2}\/[^']+)'/g)].map((m) => {
    const full = normalize(join(dirname(fil), m[1] ?? ''))
    return existsSync(join(ROT, full)) ? full : `${full}.ts`
  })
}

/** Fila og alt den importerer, direkte eller gjennom andre filer i repoet. */
function medImporter(start: string): string[] {
  const sett = new Set<string>()
  const besok = (fil: string) => {
    if (sett.has(fil)) return
    sett.add(fil)
    importer(fil).forEach(besok)
  }
  besok(start)
  return [...sett]
}

/**
 * Stegene som gjelder migrasjonene: hele utrullingen, og i CI stegene som
 * avgjør om kontrollen trengs og som bruker svaret (de nevner `berort`).
 */
const MIGRASJONSSTEG = [
  les('.github/workflows/produksjonsmigrering.yml'),
  ...les('.github/workflows/ci.yml')
    .split(/\n(?= {6}- )/)
    .filter((steg) => steg.includes('berort')),
].join('\n')

/** Programmene stegene kjører med `cmd` (som `npm run -s` eller `npx`). */
const kjort = (cmd: string) => [...new Set([...MIGRASJONSSTEG.matchAll(new RegExp(`${cmd} ([\\w:-]+)`, 'g'))].map((m) => m[1] ?? ''))]

describe('lista over hva migrasjonene avhenger av', () => {
  it('har med arbeidsflytene selv', () => {
    expect(ARBEIDSFLYTER.filter((f) => !erAvhengighet(f))).toEqual([])
  })

  it('har med alle npm-skriptene arbeidsflytene kjører, programmet som kjører dem og hver fil de bruker', () => {
    const skript = kjort('npm run(?: -s)?')
    expect(skript).toEqual(expect.arrayContaining(['kontroller:migrasjoner', 'produksjonsmigrering', 'berorer:migrasjoner']))
    const dekket = (fil: string, sti: string[]) => (PAKKEDELER[fil] ?? []).some((d) => d.join('\0') === sti.join('\0'))
    expect(skript.filter((s) => !dekket('package.json', ['scripts', s]))).toEqual([])

    const kommandoer = skript.map((s) => (pakke.scripts[s] ?? '').split(' '))
    const npx = kjort('npx')
    expect(npx).toContain('supabase')
    const programmer = [...new Set([...kommandoer.map(([program]) => program), ...npx])]
    expect(programmer.filter((p) => !dekket('package-lock.json', ['packages', `node_modules/${p}`]))).toEqual([])

    const filer = kommandoer.flatMap((k) => k.filter((d) => /\.(ts|mjs|js)$/.test(d))).flatMap(medImporter)
    expect(filer).toContain('src/faginnhold/sqlsetninger.ts')
    expect(filer.filter((f) => !erAvhengighet(f))).toEqual([])
  })

  it('har med alt som starter utrullingen til produksjonen', () => {
    const utrulling = les('.github/workflows/produksjonsmigrering.yml')
    const blokk = utrulling.match(/^ {4}paths:\n((?: {6}(?:- .+|#.*)\n)+)/m)
    expect(blokk).not.toBeNull()
    const stier = [...(blokk?.[1] ?? '').matchAll(/^ {6}- (\S+)/gm)].map((m) => m[1] ?? '')
    expect(stier).toContain('supabase/migrations/**')
    expect(stier.filter((s) => !AVHENGIGHETER.includes(s))).toEqual([])
  })

  it('peker bare på filer og mapper som finnes', () => {
    expect(AVHENGIGHETER.filter((a) => !existsSync(join(ROT, a.replace(/\/\*\*$/, ''))))).toEqual([])
  })
})
