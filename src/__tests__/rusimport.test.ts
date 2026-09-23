/**
 * Importen av rusmiddelreglene til Supabase (`scripts/rus-import.ts`), og
 * lesingen fortolkningen gjør av dem.
 *
 * Importen skal legge inn og publisere grunnlaget uendret, og regelsettene
 * slik en vanlig bruker får dem fra `les_scenarioregler` — kontrollert og
 * gjort klare slik appen gjør det — skal fortolke nøyaktig som den
 * opprinnelige rusmiddelmotoren (fasiten i `hjelp/rusparitet.ts`).
 */
import type { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { rusImportSql } from '../../scripts/rus-import'
import { validerKommentar } from '../domain/kommentarobjekt'
import type { Scenarioregelsett } from '../domain/scenario'
import { lesScenarioregler, tilScenarioregler, type Scenarioregler } from '../faginnhold/scenarioregler'
import { RUS_GRUNNLAG, RUS_KOMMENTARER, RUS_REGELSETT } from './hjelp/rusgrunnlag'
import { forventFasit } from './hjelp/rusparitet'
import { faginnholdskall, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

const MIGRASJONER = new URL('../../supabase/migrations/', import.meta.url)

let db: PGlite
let kall: Faginnholdskall
let admin: string
let bruker: string

/** Det en vanlig bruker får fra lesingen, gjort klart slik appen gjør det. */
let regler: Scenarioregler
let regelsett: Map<string, Scenarioregelsett>
let kommentarer: ReadonlyMap<string, string>

async function publisert() {
  const klare = tilScenarioregler(await lesScenarioregler(kall.klientFor(bruker)))
  return {
    regler: klare,
    regelsett: new Map([...klare.regelsett].map(([modul, u]) => [modul, u.innhold])),
    kommentarer: klare.kommentarer,
  }
}

beforeAll(async () => {
  db = await nyDatabase()
  admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Adminsen', rolle: 'admin' })
  bruker = await opprettBruker(db, { brukernavn: 'vanlig', fornavn: 'Vera', etternavn: 'Vanlig', rolle: 'user' })
  kall = faginnholdskall(db, admin)
  await db.exec(rusImportSql('admin'))
  ;({ regler, regelsett, kommentarer } = await publisert())
}, 120_000)

describe('grunnlaget for importen', () => {
  it('har bare gyldige kommentarer, uten plassholdere', () => {
    for (const k of RUS_GRUNNLAG.kommentarer) {
      expect(validerKommentar(k.innhold), k.id).toEqual([])
      expect(k.innhold.plassholdere).toEqual([])
    }
  })

  it('ligger i migrasjonen som importerer det, uendret', () => {
    const filer = readdirSync(MIGRASJONER).filter((f) => f.endsWith('_rusregler_import.sql'))
    expect(filer).toHaveLength(1)
    expect(readFileSync(new URL(filer[0]!, MIGRASJONER), 'utf8')).toBe(rusImportSql('peohol'))
  })
})

describe('importen', () => {
  it('publiserer hvert regelsett og hver kommentar én gang, og alle består appens kontroll', () => {
    expect([...regelsett.keys()].sort()).toEqual(RUS_REGELSETT.map((r) => r.modul).sort())
    expect(kommentarer.size).toBe(RUS_GRUNNLAG.kommentarer.length)
    expect(regler.ugyldige.size).toBe(0)
  })

  it('gir regelsettene og tekstene tilbake uendret, med ID-ene kommentarene fikk', () => {
    for (const mal of RUS_REGELSETT) {
      const lagret = regelsett.get(mal.modul)!
      // Samme regelsett når ID-ene byttes med tekstene de peker på.
      const medTekst = (r: Scenarioregelsett, slaOpp: (id: string) => string | undefined) =>
        r.scenarier.map((s) =>
          s.utfall.type === 'kommentarer'
            ? { ...s, utfall: { ...s.utfall, plasseringer: s.utfall.plasseringer.map((p) => ({ ...p, kommentar: slaOpp(p.kommentar) })) } }
            : s,
        )
      expect({ ...lagret, scenarier: medTekst(lagret, (id) => kommentarer.get(id)) }, mal.modul).toEqual({
        ...mal,
        scenarier: medTekst(mal, (id) => RUS_KOMMENTARER.get(id)),
      })
    }
  })

  it('gir vanlige brukere bare det publiserte', async () => {
    expect(await lesScenarioregler(kall.klientFor(bruker), 'utkast')).toEqual({ regelsett: [], kommentarer: [] })
    const utkast = await lesScenarioregler(kall.klientFor(admin), 'utkast')
    expect(utkast.regelsett).toHaveLength(RUS_REGELSETT.length)
    expect(utkast.kommentarer).toHaveLength(RUS_GRUNNLAG.kommentarer.length)
  })

  it('gjør ingenting når den kjøres igjen', async () => {
    await db.exec(rusImportSql('admin'))
    const igjen = await publisert()
    expect(igjen.regelsett).toEqual(regelsett)
    expect(igjen.kommentarer).toEqual(kommentarer)
  })

  it('gjør ingenting uten administratoren', async () => {
    await db.exec(rusImportSql('finnes.ikke'))
    expect((await publisert()).regelsett).toEqual(regelsett)
  })
})

describe.each(RUS_REGELSETT.map((r) => [r.modul] as const))('paritet for %s fra databasen', (modul) => {
  it('gir det den opprinnelige motoren ga, for alle kombinasjoner, og treffer hvert scenario', () => {
    forventFasit(regelsett.get(modul)!, kommentarer)
  })
})
