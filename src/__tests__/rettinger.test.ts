/**
 * Rettingene i tabellene over serumkonsentrasjoner
 * (`supabase/import/rettinger/`), prøvd mot de samme dataene produksjonen
 * har: importene og omarbeidingene kjøres med administratoren som bestilte
 * dem, og så rettingen.
 */
import { readFileSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { byggKatalog, FORTOLKNINGSOPPFORINGER } from '../domain/analyttkatalog'
import { Importfeil } from '../faginnhold/import'
import { FJERNET, type Doserad } from '../faginnhold/paneler'
import { kontrollerRettinger, rettingskilde, rettingSql, type Rettingsfil } from '../faginnhold/rettinger'
import fil from '../../supabase/import/rettinger/referanseomradeprosjektet.json'
import { kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const katalog = byggKatalog(FORTOLKNINGSOPPFORINGER)
const FORSTE_IMPORTMIGRASJON = '20260923072247'
const RETTING = migrasjonsfiler().find((f) => f.endsWith('_referanseomradeprosjektet_rettinger.sql'))!
const MIGRASJONSMAPPE = new URL('../../supabase/migrations/', import.meta.url)

interface Tabell {
  objekt_id: string
  kode: string
  panel: string
  rader: Doserad[]
  utkast: number
  publisert: number
  kilde: string | null
}

/** Tabellen over serumkonsentrasjoner på hver side, også en som er tatt bort. */
async function tabeller(db: PGlite): Promise<Map<string, Tabell>> {
  const { rows } = await db.query<Tabell>(
    `select e.objekt_id, a.kode, e.panel, e.data->'rader' as rader, u.revisjon as utkast, p.revisjon as publisert, r.kilde
     from public.innholdselementer e
     join public.laboratorieanalytter a on a.hovedside_id = e.infoside_id and a.tilstand = e.tilstand
     join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
     join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
     join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
     where e.tilstand = 'publisert' and e.elementtype = 'dosetabell'`,
  )
  return new Map(rows.map((t) => [t.kode, t]))
}

/** En redaktør endrer én rad i tabellen i appen. */
async function endreRad(db: PGlite, kode: string, dose: string, ny: string): Promise<void> {
  await db.exec(`do $$
    declare admin uuid; kort uuid; rev integer; innhold jsonb;
    begin
      select id into admin from public.profiles where username = 'peohol';
      perform set_config('request.jwt.claims', jsonb_build_object('sub', admin, 'role', 'authenticated')::text, true);
      select e.objekt_id, u.revisjon, r.innhold into kort, rev, innhold
        from public.innholdselementer e
        join public.laboratorieanalytter a on a.hovedside_id = e.infoside_id and a.tilstand = e.tilstand and a.kode = '${kode}'
        join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
        join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
        where e.tilstand = 'utkast' and e.elementtype = 'dosetabell';
      perform public.lagre_utkast(kort, rev, jsonb_set(innhold, '{data,rader}',
        (select jsonb_agg(case when x->>'dose' = '${dose}' then jsonb_set(x, '{dose}', to_jsonb('${ny}'::text)) else x end order by i)
         from jsonb_array_elements(innhold->'data'->'rader') with ordinality as t(x, i))));
      perform public.publiser_utkast(kort, rev + 1);
    end $$;`)
}

const rettingsfil = kontrollerRettinger(fil, katalog)
const retting = (kode: string) => rettingsfil.rettinger.find((r) => r.kode === kode)!

describe('rettingsfilen', () => {
  it('er gyldig, og migrasjonen er den skriptet lager av den', () => {
    expect(readFileSync(new URL(RETTING, MIGRASJONSMAPPE), 'utf8')).toBe(rettingSql(rettingsfil, 'peohol'))
  })

  it('stopper på alle feilene samtidig', () => {
    const feil: Rettingsfil = {
      kilde: '',
      rettinger: [
        { kode: 'FINNESIKKE', rad: {}, til: { dose: '1 mg' }, hvorfor: 'fordi' },
        { kode: 'SERT', rad: { dosen: '50 mg' } as never, til: { dose: 1 } as never, hvorfor: '' },
      ],
    }
    let fanget: unknown
    try {
      kontrollerRettinger(feil, katalog)
    } catch (e) {
      fanget = e
    }
    expect(fanget).toBeInstanceOf(Importfeil)
    expect((fanget as Importfeil).feil).toEqual([
      '«kilde» må være en tekst',
      'Retting 1: ukjent analyttkode «FINNESIKKE»',
      'Retting 1, «rad»: må ha minst ett av feltene dose, regime, konsentrasjon, merknad',
      'Retting 2: «hvorfor» må være en tekst',
      'Retting 2, «rad»: ukjent felt «dosen»',
      'Retting 2, «til»: «dose» må være en tekst',
    ])
  })
})

describe('rettingen i databasen', () => {
  let db: PGlite
  let for_: Map<string, Tabell>
  let etter: Map<string, Tabell>

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(db, { fra: FORSTE_IMPORTMIGRASJON, til: RETTING })
    for_ = await tabeller(db)
    await kjorMigrasjoner(db, { fra: RETTING })
    etter = await tabeller(db)
  }, 180_000)

  it('retter bare raden som er oppgitt, og lar resten av tabellen stå', () => {
    for (const { kode, rad, til } of rettingsfil.rettinger.filter((r) => r.til)) {
      const forRader = for_.get(kode)!.rader
      const i = forRader.findIndex((r) => Object.entries(rad).every(([felt, verdi]) => r[felt as keyof Doserad] === verdi))
      expect(i, kode).toBeGreaterThanOrEqual(0)
      expect(etter.get(kode)!.rader, kode).toEqual(forRader.map((r, j) => (j === i ? { ...r, ...til } : r)))
    }
  })

  it('gir rapportens tall i tabellene', () => {
    const prosjektrad = (kode: string) => etter.get(kode)!.rader.at(-1)!
    expect(prosjektrad('ESCIT')).toMatchObject({ dose: '10–30 mg', konsentrasjon: '10.–90. persentil: 19–109 nmol/L' })
    expect(prosjektrad('FLUOSUM')).toMatchObject({ dose: '20–60 mg' })
    expect(prosjektrad('KLORP')).toMatchObject({ dose: '15–300 mg', konsentrasjon: '10.–90. persentil: 5–64 nmol/L' })
    expect(prosjektrad('LMP')).toMatchObject({ dose: '25–400 mg', konsentrasjon: '10.–90. persentil: 14–158 nmol/L' })
    expect(prosjektrad('SERT')).toMatchObject({ dose: '50–200 mg', konsentrasjon: '10.–90. persentil: 26–219 nmol/L' })
  })

  it('tar bort tabellen for lurasidon, som bare hadde raden som ikke hørte til', () => {
    expect(for_.get('LURA')!.rader).toHaveLength(1)
    expect(etter.get('LURA')).toMatchObject({ panel: FJERNET, rader: for_.get('LURA')!.rader })
  })

  it('fører hver retting som en ny, publisert revisjon med hva som ble rettet og hvorfor', () => {
    for (const { kode, hvorfor } of rettingsfil.rettinger) {
      const t = etter.get(kode)!
      expect(t.publisert, kode).toBe(for_.get(kode)!.publisert + 1)
      expect(t.utkast, kode).toBe(t.publisert)
      expect(t.kilde, kode).toBe(rettingskilde(rettingsfil.kilde, hvorfor))
    }
    expect(etter.get('SERT')!.kilde).toBe(
      'Rettet etter sluttrapporten fra referanseområdeprosjektet (2008): 90-persentilen er 219 nmol/L (291 er 95-persentilen)',
    )
  })

  it('rører ikke de andre tabellene', () => {
    const rettet = new Set(rettingsfil.rettinger.map((r) => r.kode))
    for (const [kode, t] of for_) if (!rettet.has(kode)) expect(etter.get(kode), kode).toEqual(t)
  })

  it('gjør ingenting når den kjøres en gang til', async () => {
    await kjorMigrasjoner(db, { bare: [RETTING] })
    expect(await tabeller(db)).toEqual(etter)
  })

  it('retter ikke en rad som er endret i appen etter importen', async () => {
    const annen = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    await opprettBruker(annen, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(annen, { fra: FORSTE_IMPORTMIGRASJON, til: RETTING })
    await endreRad(annen, 'SERT', retting('SERT').rad.dose!, '50–150 mg')
    const endret = (await tabeller(annen)).get('SERT')!
    await kjorMigrasjoner(annen, { fra: RETTING })
    const sert = (await tabeller(annen)).get('SERT')!
    expect(sert).toEqual(endret)
    expect(sert.rader.at(-1)).toMatchObject({ dose: '50–150 mg', konsentrasjon: '10.–90. persentil: 26–291 nmol/L' })
    expect((await tabeller(annen)).get('ESCIT')!.rader.at(-1)).toMatchObject({ dose: '10–30 mg' })
  }, 180_000)

  it('gjør ingenting i en database uten administratoren', async () => {
    const tom = await nyDatabase()
    const { rows } = await tom.query<{ n: number }>('select count(*)::int as n from public.objektrevisjoner')
    expect(rows[0]!.n).toBe(0)
  })
})
