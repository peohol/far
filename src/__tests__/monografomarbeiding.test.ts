/**
 * Omarbeidingene av de importerte stoffsidene (datamigreringer etter
 * psykofarmakaimporten), prøvd mot de samme dataene produksjonen har: importen
 * kjøres med administratoren som bestilte den, og tilstanden før og etter hver
 * omarbeiding sammenlignes.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  formaterFormverdier,
  kontrollerFormverdier,
  lesFormverdier,
} from '../faginnhold/paneler'
import { kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const FORSTE_IMPORTMIGRASJON = '20260923072247'
const migrasjon = (navn: string) => migrasjonsfiler().find((f) => f.endsWith(`_${navn}.sql`))!
const VIKTIGE_DATA = migrasjon('viktige_data_former')

interface Kort {
  objekt_id: string
  navn: string
  elementtype: string
  data: Record<string, unknown>
  utkast: number
  publisert: number
  kilde: string | null
}

/** Kortene i viktige data slik de er publisert, etter side og type. */
async function viktigeData(db: PGlite): Promise<Map<string, Kort>> {
  const { rows } = await db.query<Kort>(
    `select e.objekt_id, i.navn, e.elementtype, e.data, u.revisjon as utkast, p.revisjon as publisert, r.kilde
     from public.innholdselementer e
     join public.infosider i on i.objekt_id = e.infoside_id and i.tilstand = e.tilstand
     join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
     join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
     join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
     where e.tilstand = 'publisert' and e.panel = 'viktige_data'`,
  )
  return new Map(rows.map((k) => [`${k.navn}/${k.elementtype}`, k]))
}

const FORMVIS = new Set(['halveringstid', 'steady_state'])
const forbehold = (k: Kort) => (typeof k.data.forbehold === 'string' ? k.data.forbehold : '')

describe('viktige data: forbeholdene tas bort, og t½ og tss står per legemiddelform', () => {
  let db: PGlite
  let for_: Map<string, Kort>
  let etter: Map<string, Kort>
  const endret = () => [...for_.values()].filter((k) => FORMVIS.has(k.elementtype) || forbehold(k))

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(db, { fra: FORSTE_IMPORTMIGRASJON, til: VIKTIGE_DATA })
    for_ = await viktigeData(db)
    await kjorMigrasjoner(db, { fra: VIKTIGE_DATA, til: `${VIKTIGE_DATA}~` })
    etter = await viktigeData(db)
  }, 120_000)

  it('møter de samme kortene som produksjonen, så sjekksummen stemmer og alt blir skrevet om', () => {
    expect(endret()).toHaveLength(103)
    for (const k of endret()) expect(etter.get(`${k.navn}/${k.elementtype}`)!.publisert, k.navn).toBe(k.publisert + 1)
  })

  it('gjør «33 ± 4 timer» om til 33 (29–37) timer', () => {
    expect(etter.get('Citalopram/halveringstid')!.data).toEqual({
      former: [{ form: '', typisk: 33, min: 29, maks: 37, enhet: 'timer' }],
    })
    expect(formaterFormverdier(lesFormverdier(etter.get('Citalopram/halveringstid')!.data))).toBe('33 (29–37) timer')
  })

  it('gir hver legemiddelform sin egen verdi der forbeholdet nevnte flere', () => {
    const vist = (navn: string) => formaterFormverdier(lesFormverdier(etter.get(navn)!.data))
    expect(vist('Haloperidol/steady_state')).toBe('Peroralt: 5 døgn · Depotinjeksjon: 2–4 måneder')
    expect(vist('Haloperidol/halveringstid')).toBe('Peroralt: 24 timer · Injeksjon i.m.: 21 timer')
    expect(vist('Zuklopentiksol/halveringstid')).toBe(
      'Peroralt: 12–26 timer · Injeksjon (Acutard): 18–24 timer · Depotinjeksjon: 19 dager',
    )
  })

  it('beholder verdien uendret på kortene uten et forbehold som sa noe mer', () => {
    const uten = endret().filter((k) => FORMVIS.has(k.elementtype) && ['', 'Omtrentlig.'].includes(forbehold(k)))
    expect(uten.length).toBeGreaterThan(20)
    for (const k of uten) {
      expect(etter.get(`${k.navn}/${k.elementtype}`)!.data, k.navn).toEqual(lesFormverdier(k.data))
    }
  })

  it('tar bare bort forbeholdet på konsentrasjonskortene', () => {
    const konsentrasjoner = endret().filter((k) => !FORMVIS.has(k.elementtype))
    expect(konsentrasjoner.length).toBeGreaterThan(0)
    for (const k of konsentrasjoner) {
      const { forbehold: _, ...uten } = k.data
      expect(etter.get(`${k.navn}/${k.elementtype}`)!.data, k.navn).toEqual(uten)
    }
  })

  it('etterlater ingen forbehold, og bare gyldige verdier per form', () => {
    for (const k of etter.values()) {
      // Et tomt forbehold på et kort som ellers ikke endres, får stå: det vises ikke.
      expect(forbehold(k), k.navn).toBe('')
      if (!FORMVIS.has(k.elementtype)) continue
      expect(Object.keys(k.data), k.navn).toEqual(['former'])
      expect(kontrollerFormverdier(lesFormverdier(k.data)), `${k.navn} ${k.elementtype}`).toBeNull()
      expect(lesFormverdier(k.data).former, k.navn).toEqual((k.data as { former: unknown[] }).former)
    }
  })

  it('publiserer hver endring med en kilde i historikken, så det som sto før, kan hentes tilbake', () => {
    for (const k of endret()) {
      const ny = etter.get(`${k.navn}/${k.elementtype}`)!
      expect(ny.utkast, k.navn).toBe(ny.publisert)
      expect(ny.kilde, k.navn).toBe(
        FORMVIS.has(k.elementtype)
          ? 'Omgjort: forbeholdet er tatt bort, og verdien står som typisk, minimum og maksimum per legemiddelform'
          : 'Tatt bort: forbeholdet under verdien',
      )
    }
  })

  it('gjør ingenting når kortene er endret siden, som når den kjøres en gang til', async () => {
    await kjorMigrasjoner(db, { fra: VIKTIGE_DATA, til: `${VIKTIGE_DATA}~` })
    expect(await viktigeData(db)).toEqual(etter)
  })

  it('gjør ingenting i en database uten administratoren', async () => {
    const tom = await nyDatabase()
    const { rows } = await tom.query<{ n: number }>('select count(*)::int as n from public.objektrevisjoner')
    expect(rows[0]!.n).toBe(0)
  })
})
