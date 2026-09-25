/**
 * Oppdateringene av kort etter en nyere kilde (`supabase/import/oppdateringer/`),
 * prøvd mot de samme dataene produksjonen har: importene kjøres med
 * administratoren som bestilte dem, og så oppdateringen.
 */
import { readFileSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { byggKatalog, FORTOLKNINGSOPPFORINGER } from '../domain/analyttkatalog'
import { Importfeil, tilDokument } from '../faginnhold/import'
import {
  kontrollerOppdateringer,
  oppdateringskilde,
  oppdateringSql,
  type Oppdateringsfil,
} from '../faginnhold/kortoppdateringer'
import { FJERNET } from '../faginnhold/paneler'
import fil from '../../supabase/import/oppdateringer/antiepileptika2017.json'
import { kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const katalog = byggKatalog(FORTOLKNINGSOPPFORINGER)
const FORSTE_IMPORTMIGRASJON = '20260923072247'
const OPPDATERING = migrasjonsfiler().find((f) => f.endsWith('_antiepileptika_2017.sql'))!
const MIGRASJONSMAPPE = new URL('../../supabase/migrations/', import.meta.url)
const REIMERS = fil.referanser.reimers2017
const ANTIEPILEPTIKA = ['Fenobarbital', 'Fenytoin', 'Gabapentin', 'Karbamazepin', 'Lamotrigin', 'Levetiracetam', 'Okskarbazepin', 'Topiramat', 'Valproat']

interface Kort {
  objekt_id: string
  side: string
  panel: string
  elementtype: string
  tittel: string | null
  data: Record<string, unknown>
  referanser: string[]
  utkast: number
  publisert: number
  kilde: string | null
}

/** Alle kortene på sidene, med kildene som titler, nøklet på side, type og overskrift. */
async function kort(db: PGlite): Promise<Map<string, Kort>> {
  const { rows } = await db.query<Kort>(
    `select e.objekt_id, s.navn as side, e.panel, e.elementtype, e.data->>'tittel' as tittel, e.data,
       coalesce((select jsonb_agg(ref.tittel order by k.i) from jsonb_array_elements_text(r.innhold->'referanser') with ordinality k(id, i)
         join public.referanser ref on ref.objekt_id = k.id::uuid and ref.tilstand = 'publisert'), '[]') as referanser,
       u.revisjon as utkast, p.revisjon as publisert, r.kilde
     from public.innholdselementer e
     join public.infosider s on s.objekt_id = e.infoside_id and s.tilstand = 'publisert'
     join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
     join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
     join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
     where e.tilstand = 'publisert'`,
  )
  return new Map(rows.map((k) => [k.objekt_id, k]))
}

const finn = (alle: Map<string, Kort>, side: string, tittelEllerType: string) =>
  [...alle.values()].find((k) => k.side === side && (k.tittel ?? k.elementtype) === tittelEllerType)!

/** En redaktør endrer referanseområdet på en side i appen. */
async function endreOmrade(db: PGlite, side: string, nedre: number, ovre: number): Promise<void> {
  await db.exec(`do $$
    declare admin uuid; kort uuid; rev integer; innhold jsonb;
    begin
      select id into admin from public.profiles where username = 'peohol';
      perform set_config('request.jwt.claims', jsonb_build_object('sub', admin, 'role', 'authenticated')::text, true);
      select e.objekt_id, u.revisjon, r.innhold into kort, rev, innhold
        from public.innholdselementer e
        join public.infosider s on s.objekt_id = e.infoside_id and s.tilstand = 'utkast' and s.navn = '${side}'
        join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
        join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
        where e.tilstand = 'utkast' and e.elementtype = 'referanseomrade';
      perform public.lagre_utkast(kort, rev, jsonb_set(jsonb_set(innhold, '{data,nedre}', '${nedre}'), '{data,ovre}', '${ovre}'));
      perform public.publiser_utkast(kort, rev + 1);
    end $$;`)
}

const oppdateringsfil = kontrollerOppdateringer(fil, katalog)

describe('oppdateringsfilen', () => {
  it('er gyldig, og migrasjonen er den skriptet lager av den', () => {
    expect(readFileSync(new URL(OPPDATERING, MIGRASJONSMAPPE), 'utf8')).toBe(oppdateringSql(oppdateringsfil, 'peohol'))
  })

  it('stopper på alle feilene samtidig', () => {
    const feil = {
      kilde: '',
      referanser: { tom: { tittel: '', forfattere: '', aar: '', lenke: 'ikke en lenke' } },
      oppdateringer: [
        { kode: 'FINNESIKKE', panel: 'viktige_data', kort: 'referanseomrade', fra: { nedre: 1 }, til: { nedre: 5, ovre: 2 }, hvorfor: 'fordi' },
        { side: 'Topiramat', panel: 'tdm', kort: 'Grunnlag', fra: { tekst: [] }, til: { verdi: 1 }, kilder: { inn: ['ukjent'] }, hvorfor: '' },
        { kode: 'LAM', side: 'Lamotrigin', panel: 'dosering', kort: 'x', fra: {}, til: null, hvorfor: 'fordi' },
        { side: 'Topiramat', panel: 'viktige_data', kort: 'halveringstid', fra: { enhet: 'h' }, til: null, hvorfor: 'fordi' },
      ],
    } as unknown as Oppdateringsfil
    let fanget: unknown
    try {
      kontrollerOppdateringer(feil, katalog)
    } catch (e) {
      fanget = e
    }
    expect(fanget).toBeInstanceOf(Importfeil)
    expect((fanget as Importfeil).feil).toEqual([
      '«kilde» må være en tekst',
      'Referansen «tom» må ha en tittel og en lenke som er en nettadresse',
      'Oppdatering 1: ukjent analyttkode «FINNESIKKE»',
      'Oppdatering 1: Nedre grense kan ikke være høyere enn øvre.',
      'Oppdatering 2: «hvorfor» må være en tekst',
      'Oppdatering 2, «fra»: «tekst» må være en liste med avsnitt eller punktlister',
      'Oppdatering 2, «til»: ukjent felt «verdi»',
      'Oppdatering 2: referansen «ukjent» er ikke definert',
      'Oppdatering 3: oppgi enten «kode» eller «side»',
      'Oppdatering 3: ukjent panel «dosering», eller et panel uten kort',
      'Oppdatering 4: ukjent datakort «halveringstid»',
    ])
  })

  it('bygger på tabellen i Reimers mfl. 2017', () => {
    expect(REIMERS).toEqual({
      tittel: 'Felles referanseområder for antiepileptika',
      forfattere: 'Reimers A, Berg JA, Burns ML, Johannessen Landmark C',
      aar: '2017',
      lenke: 'https://doi.org/10.4045/tidsskr.17.0392',
    })
  })
})

describe('oppdateringen i databasen', () => {
  let db: PGlite
  let for_: Map<string, Kort>
  let etter: Map<string, Kort>

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(db, { fra: FORSTE_IMPORTMIGRASJON, til: OPPDATERING })
    for_ = await kort(db)
    await kjorMigrasjoner(db, { fra: OPPDATERING })
    etter = await kort(db)
  }, 240_000)

  const omrade = (side: string) => finn(etter, side, 'referanseomrade')

  it('gir topiramat og okskarbazepin de nasjonale områdene fra 2017, med den kilden alene', () => {
    expect(omrade('Topiramat').data).toMatchObject({ nedre: 6, ovre: 30, enhet: 'µmol/L' })
    expect(omrade('Okskarbazepin').data).toMatchObject({ nedre: 12, ovre: 140, enhet: 'µmol/L' })
    for (const side of ['Topiramat', 'Okskarbazepin']) expect(omrade(side).referanser, side).toEqual([REIMERS.tittel])
  })

  it('lar de andre antiepileptika beholde områdene, og gir dem 2017-kilden først', () => {
    const uendret: Record<string, [number, number]> = {
      Fenobarbital: [50, 130],
      Fenytoin: [40, 80],
      Gabapentin: [20, 120],
      Karbamazepin: [15, 45],
      Lamotrigin: [10, 50],
      Levetiracetam: [30, 240],
      Valproat: [300, 700],
    }
    for (const [side, [nedre, ovre]] of Object.entries(uendret)) {
      expect(omrade(side).data, side).toMatchObject({ nedre, ovre, enhet: 'µmol/L' })
      expect(omrade(side).referanser[0], side).toBe(REIMERS.tittel)
      expect(omrade(side).referanser.slice(1), side).toEqual(finn(for_, side, 'referanseomrade').referanser)
    }
  })

  it('skriver 2017-grunnlaget først i grunnlaget for referanseområdet, og tar bort kortet om nyere områder', () => {
    for (const side of ANTIEPILEPTIKA) {
      const grunnlag = finn(etter, side, 'Grunnlag for referanseområdet')
      const o = oppdateringsfil.oppdateringer.find(
        (x) => (x.side ?? 'Lamotrigin') === side && x.kort === 'Grunnlag for referanseområdet',
      )!
      expect(grunnlag.data.dokument, side).toEqual(tilDokument(o.til!.tekst!))
      expect(JSON.stringify(grunnlag.data.dokument), side).toContain('felles nasjonale referanseområdet for antiepileptika fra 2017')
      expect(grunnlag.referanser, side).toEqual([REIMERS.tittel, fil.referanser.referanseomradeprosjektet.tittel])
      const nyere = [...etter.values()].find((k) => k.side === side && k.tittel === 'Nyere nasjonale referanseområder')
      if (nyere) expect(nyere.panel, side).toBe(FJERNET)
    }
    expect(JSON.stringify(finn(etter, 'Topiramat', 'Grunnlag for referanseområdet').data)).toContain('fra 15–60 til 6–30 µmol/L')
    expect(JSON.stringify(finn(etter, 'Okskarbazepin', 'Grunnlag for referanseområdet').data)).toContain('fra 45–140 til 12–140 µmol/L')
  })

  it('gir klonazepam 40–120 nmol/L ved epilepsi, og lar grensen på 50 nmol/L stå', () => {
    const grense = finn(etter, 'Klonazepam', 'Referansegrense')
    expect(JSON.stringify(grense.data)).toContain('referanseområdet er da 40–120 nmol/L')
    expect(JSON.stringify(finn(for_, 'Klonazepam', 'Referansegrense').data)).toContain('referanseområdet er da 60–220 nmol/L')
    expect(grense.referanser[0]).toBe(REIMERS.tittel)
    expect(finn(etter, 'Klonazepam', 'referanseomrade').data).toMatchObject({ nedre: null, ovre: 50, enhet: 'nmol/L' })
  })

  it('fører hver oppdatering som en ny, publisert revisjon med kilden og hvorfor', () => {
    const endret = [...etter.values()].filter((k) => for_.get(k.objekt_id)!.publisert !== k.publisert)
    expect(endret).toHaveLength(oppdateringsfil.oppdateringer.length)
    for (const k of endret) {
      expect(k.publisert, k.side).toBe(for_.get(k.objekt_id)!.publisert + 1)
      expect(k.utkast, k.side).toBe(k.publisert)
      expect(oppdateringsfil.oppdateringer.map((o) => oppdateringskilde(oppdateringsfil.kilde, o.hvorfor))).toContain(k.kilde)
    }
    expect(omrade('Topiramat').kilde).toBe(
      'Oppdatert etter Reimers A, Berg JA, Burns ML, Johannessen Landmark C. Felles referanseområder for antiepileptika. ' +
        'Tidsskr Nor Legeforen 2017; 137: 864–5: det nasjonale referanseområdet er 6–30 µmol/L, ikke 15–60 µmol/L',
    )
  })

  it('rører ikke de andre kortene', () => {
    for (const [id, k] of for_) if (etter.get(id)!.publisert === k.publisert) expect(etter.get(id), `${k.side} ${k.tittel}`).toEqual(k)
  })

  it('gjør ingenting når den kjøres en gang til', async () => {
    await kjorMigrasjoner(db, { bare: [OPPDATERING] })
    expect(await kort(db)).toEqual(etter)
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.referanser where tilstand = 'publisert' and tittel = $1`,
      [REIMERS.tittel],
    )
    expect(rows[0]!.n).toBe(1)
  })

  it('oppdaterer ikke et kort som er endret i appen etter importen', async () => {
    const annen = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    await opprettBruker(annen, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(annen, { fra: FORSTE_IMPORTMIGRASJON, til: OPPDATERING })
    await endreOmrade(annen, 'Topiramat', 10, 50)
    const endret = finn(await kort(annen), 'Topiramat', 'referanseomrade')
    await kjorMigrasjoner(annen, { fra: OPPDATERING })
    const alle = await kort(annen)
    expect(finn(alle, 'Topiramat', 'referanseomrade')).toEqual(endret)
    expect(finn(alle, 'Okskarbazepin', 'referanseomrade').data).toMatchObject({ nedre: 12, ovre: 140 })
  }, 240_000)

  it('gjør ingenting i en database uten administratoren', async () => {
    const tom = await nyDatabase()
    const { rows } = await tom.query<{ n: number }>('select count(*)::int as n from public.objektrevisjoner')
    expect(rows[0]!.n).toBe(0)
  })
})
