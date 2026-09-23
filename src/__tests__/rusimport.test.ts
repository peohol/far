/**
 * Importen av rusmiddelreglene til Supabase (`scripts/rus-import.ts`).
 *
 * Grunnlaget skal være dagens regler og tekster, importen skal legge dem inn
 * og publisere dem uendret, og regelsettene slik databasen gir dem tilbake —
 * med kommentarene slått opp på ID-ene de fikk — skal fortolke nøyaktig som
 * dagens moduler.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { rusImportSql } from '../../scripts/rus-import'
import grunnlag from '../domain/__tests__/fasit/rus-import.json'
import { validerKommentar } from '../domain/kommentarobjekt'
import { RUS_MODULER } from '../domain/rus'
import { RUS_KOMMENTAROBJEKTER, RUS_REGELSETT } from '../domain/rusregelsett'
import type { Scenarioregelsett } from '../domain/scenario'
import { forventParitet } from './hjelp/rusparitet'
import { faginnholdskall, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

const MIGRASJONER = new URL('../../supabase/migrations/', import.meta.url)

let db: PGlite
let kall: Faginnholdskall

/** Det publiserte i databasen: regelsettene etter modul og kommentartekstene etter ID. */
let regelsett: Map<string, Scenarioregelsett>
let kommentarer: Map<string, string>

async function publisert() {
  const [rad] = await kall.fasit<{ regelsett: Scenarioregelsett[]; kommentarer: { id: string; innhold: { tekst: string } }[] }>(
    `select
       (select coalesce(jsonb_agg(intern.les_scenarioregelsett(r.objekt_id, 'publisert') order by r.modul), '[]')
        from public.scenarioregelsett r where r.tilstand = 'publisert') as regelsett,
       public.les_kommentarer('publisert') as kommentarer`,
  )
  return {
    regelsett: new Map(rad!.regelsett.map((r) => [r.modul, r])),
    kommentarer: new Map(rad!.kommentarer.map((k) => [k.id, k.innhold.tekst])),
  }
}

beforeAll(async () => {
  db = await nyDatabase()
  const admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Adminsen', rolle: 'admin' })
  kall = faginnholdskall(db, admin)
  await db.exec(rusImportSql('admin'))
  ;({ regelsett, kommentarer } = await publisert())
}, 120_000)

describe('grunnlaget for importen', () => {
  it('er dagens regelsett og kommentarer', () => {
    expect(grunnlag).toEqual({ kommentarer: RUS_KOMMENTAROBJEKTER, regelsett: RUS_REGELSETT })
  })

  it('har bare gyldige kommentarer, uten plassholdere', () => {
    for (const k of grunnlag.kommentarer) {
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
  it('publiserer hvert regelsett og hver kommentar én gang', () => {
    expect([...regelsett.keys()].sort()).toEqual(RUS_REGELSETT.map((r) => r.modul).sort())
    expect(kommentarer.size).toBe(grunnlag.kommentarer.length)
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
      const tekst = new Map(RUS_KOMMENTAROBJEKTER.map((k) => [k.id, k.innhold.tekst]))
      expect({ ...lagret, scenarier: medTekst(lagret, (id) => kommentarer.get(id)) }, mal.modul).toEqual({
        ...mal,
        scenarier: medTekst(mal, (id) => tekst.get(id)),
      })
    }
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

describe.each(RUS_MODULER.map((m) => [m.id, m] as const))('paritet for %s fra databasen', (id, modul) => {
  it('gir identisk resultat for alle kombinasjoner, og treffer hvert scenario', () => {
    forventParitet(modul, regelsett.get(id)!, kommentarer)
  })
})
