/**
 * Fundamentet for det redigerbare faginnholdet, prøvd mot en ekte database.
 *
 * Alt her kjører migrasjonene i en Postgres i minnet og kaller funksjonene og
 * tabellene slik data-API-et gjør det: som en innlogget bruker med rollen
 * `authenticated`, eller som `anon`. Det er databasen som skal håndheve
 * reglene, så det er den som prøves — ikke hva appen velger å vise.
 *
 * Innholdet er syntetisk. Navnene og kodene i testen av relasjonene er
 * eksemplene fra planen; ingen kliniske verdier inngår.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { lagFaginnholdslager, Samtidighetskonflikt } from '../faginnhold/lagring'
import {
  HANDLINGER,
  KONFLIKT,
  OBJEKTTYPER,
  TILSTANDER,
  type Objektstatus,
} from '../faginnhold/modell'
import {
  faginnholdskall,
  feilFra,
  nyDatabase,
  opprettBruker,
  som,
  type Faginnholdskall,
} from './hjelp/testdatabase'

/** Tabellene fundamentet består av, med kolonnen som peker på objektet. */
const OBJEKTKOLONNE = {
  redigerbare_objekter: 'id',
  objektrevisjoner: 'objekt_id',
  objekttilstander: 'objekt_id',
  objektpubliseringer: 'objekt_id',
  infosider: 'objekt_id',
  laboratorieanalytter: 'objekt_id',
  analyttkomponenter: 'analytt_id',
  innholdselementer: 'objekt_id',
} as const
const TABELLER = Object.keys(OBJEKTKOLONNE) as (keyof typeof OBJEKTKOLONNE)[]

let db: PGlite
let admin: string
let admin2: string
let bruker: string
let { rpc, les, fasit, opprett, lagre, gjenopprett, publiser, revisjoner, forventSamsvar, klientFor } =
  {} as Faginnholdskall

beforeAll(async () => {
  db = await nyDatabase()
  admin = await opprettBruker(db, {
    brukernavn: 'admin.en',
    fornavn: 'Ada',
    etternavn: 'Adminsen',
    rolle: 'admin',
  })
  admin2 = await opprettBruker(db, {
    brukernavn: 'admin.to',
    fornavn: 'Bo',
    etternavn: 'Bestyrer',
    rolle: 'admin',
  })
  bruker = await opprettBruker(db, {
    brukernavn: 'vanlig',
    fornavn: 'Vera',
    etternavn: 'Vanlig',
    rolle: 'user',
  })
  ;({ rpc, les, fasit, opprett, lagre, gjenopprett, publiser, revisjoner, forventSamsvar, klientFor } =
    faginnholdskall(db, admin))
}, 60_000)

/* --- Hjelpere ------------------------------------------------------------- */

let lopenummer = 0
/** En informasjonsside med et navn ingen annen test bruker. */
async function nySide(prefiks = 'Testside') {
  lopenummer += 1
  return opprett('infoside', { navn: `${prefiks} ${lopenummer}` })
}

/* --- Utgangspunktet ------------------------------------------------------- */

describe('databasen etter migrasjonene', () => {
  it('har ikke fått noe faginnhold', async () => {
    const tom = await nyDatabase()
    for (const tabell of TABELLER) {
      const { rows } = await tom.query<{ antall: number }>(
        `select count(*)::int as antall from public.${tabell}`,
      )
      expect(rows[0]!.antall, tabell).toBe(0)
    }
  }, 60_000)

  it('har de samme typene, tilstandene og handlingene som appen', async () => {
    const verdier = async (type: string) =>
      (await fasit<{ v: string[] }>(`select enum_range(null::public.${type})::text[] as v`))[0]!.v
    expect(await verdier('objekttype')).toEqual([...OBJEKTTYPER])
    expect(await verdier('objekttilstand')).toEqual([...TILSTANDER])
    expect(await verdier('innholdshandling')).toEqual([...HANDLINGER])
  })
})

/* --- 1. Relasjonene ------------------------------------------------------- */

describe('laboratorieanalytter, hovedsider og komponenter', () => {
  it('lar én analyttkode ha én hovedside, men omfatte flere komponenter', async () => {
    const amitriptylin = await opprett('infoside', { navn: 'Amitriptylin' })
    const nortriptylin = await opprett('infoside', { navn: 'Nortriptylin' })

    const sum = await opprett('laboratorieanalytt', {
      kode: 'AMTNORSUM',
      hovedside: amitriptylin.id,
      komponenter: [amitriptylin.id, nortriptylin.id],
    })
    const nor = await opprett('laboratorieanalytt', {
      kode: 'NOR',
      hovedside: nortriptylin.id,
      komponenter: [nortriptylin.id],
    })

    const analytter = await fasit<{ kode: string; hovedside: string; komponenter: string[] }>(
      `select a.kode, h.navn as hovedside,
              array_agg(k.navn order by c.posisjon) as komponenter
       from public.laboratorieanalytter a
       join public.infosider h on h.objekt_id = a.hovedside_id and h.tilstand = a.tilstand
       join public.analyttkomponenter c on c.analytt_id = a.objekt_id and c.tilstand = a.tilstand
       join public.infosider k on k.objekt_id = c.infoside_id and k.tilstand = c.tilstand
       where a.objekt_id in ($1, $2) and a.tilstand = 'utkast'
       group by a.kode, h.navn
       order by a.kode`,
      [sum.id, nor.id],
    )
    expect(analytter).toEqual([
      { kode: 'AMTNORSUM', hovedside: 'Amitriptylin', komponenter: ['Amitriptylin', 'Nortriptylin'] },
      { kode: 'NOR', hovedside: 'Nortriptylin', komponenter: ['Nortriptylin'] },
    ])

    // Nortriptylin er komponent i to analyser, men hovedside for bare én.
    const iBruk = await fasit<{ analyser: number }>(
      `select count(*)::int as analyser from public.analyttkomponenter
       where infoside_id = $1 and tilstand = 'utkast'`,
      [nortriptylin.id],
    )
    expect(iBruk[0]!.analyser).toBe(2)

    // Øyeblikksbildet i revisjonen har den samme strukturen.
    expect((await revisjoner(sum.id))[0]!.innhold).toEqual({
      kode: 'AMTNORSUM',
      hovedside: amitriptylin.id,
      komponenter: [amitriptylin.id, nortriptylin.id],
    })
    await forventSamsvar(sum.id)
  })

  it('krever at hovedsiden og komponentene er informasjonssider', async () => {
    const side = await nySide()
    const analytt = await opprett('laboratorieanalytt', {
      kode: 'TESTA',
      hovedside: side.id,
      komponenter: [side.id],
    })

    for (const innhold of [
      { kode: 'TESTB', hovedside: analytt.id, komponenter: [side.id] },
      { kode: 'TESTB', hovedside: side.id, komponenter: [analytt.id] },
      { kode: 'TESTB', hovedside: crypto.randomUUID(), komponenter: [side.id] },
    ]) {
      expect((await feilFra(() => opprett('laboratorieanalytt', innhold)))?.code).toBe('22023')
    }
  })

  it('krever minst én komponent, og hver bare én gang', async () => {
    const side = await nySide()
    const tom = await feilFra(() =>
      opprett('laboratorieanalytt', { kode: 'TESTC', hovedside: side.id, komponenter: [] }),
    )
    expect(tom?.code).toBe('22023')

    const dobbel = await feilFra(() =>
      opprett('laboratorieanalytt', { kode: 'TESTC', hovedside: side.id, komponenter: [side.id, side.id] }),
    )
    expect(dobbel?.code).toBe('22023')
  })

  it('gir hver analyttkode til bare én laboratorieanalytt', async () => {
    const side = await nySide()
    await opprett('laboratorieanalytt', { kode: 'TESTD', hovedside: side.id, komponenter: [side.id] })
    const feil = await feilFra(() =>
      opprett('laboratorieanalytt', { kode: 'TESTD', hovedside: side.id, komponenter: [side.id] }),
    )
    expect(feil?.code).toBe('22023')
    expect(feil?.message).toContain('TESTD')
  })

  it('knytter innholdselementer til en informasjonsside', async () => {
    const side = await nySide()
    const element = await opprett('innholdselement', {
      infoside: side.id,
      panel: 'testpanel',
      posisjon: 1,
      elementtype: 'fritekst',
      data: { tekst: 'Syntetisk tekst.' },
    })
    await forventSamsvar(element.id)

    const annetElement = await feilFra(() =>
      opprett('innholdselement', {
        infoside: element.id,
        panel: 'testpanel',
        posisjon: 2,
        elementtype: 'fritekst',
        data: {},
      }),
    )
    expect(annetElement?.code).toBe('22023')
  })
})

/* --- 2 og 3. Hvem som kan endre ------------------------------------------- */

describe('hvem som kan endre faginnholdet', () => {
  it('avviser en vanlig bruker i alle operasjonene', async () => {
    const side = await nySide()
    const forsok = [
      () => opprett('infoside', { navn: 'Fra vanlig bruker' }, bruker),
      () => lagre(side.id, 1, { navn: 'Endret av vanlig bruker' }, bruker),
      () => publiser(side.id, 1, bruker),
      () => gjenopprett(side.id, 1, 1, bruker),
    ]
    for (const kall of forsok) {
      expect((await feilFra(kall))?.code).toBe('42501')
    }
    expect(await revisjoner(side.id)).toHaveLength(1)
    expect(await fasit(`select 1 from public.infosider where navn = 'Fra vanlig bruker'`)).toEqual([])
  })

  it('gir verken vanlige brukere eller administratorer skriverett på tabellene', async () => {
    const side = await nySide()
    for (const hvem of [bruker, admin]) {
      for (const tabell of TABELLER) {
        const kolonne = OBJEKTKOLONNE[tabell]
        for (const sql of [
          `insert into public.${tabell} default values`,
          `update public.${tabell} set ${kolonne} = ${kolonne}`,
          `delete from public.${tabell}`,
        ]) {
          const feil = await feilFra(() => les(hvem, sql))
          expect(feil?.code, `${tabell}: ${sql}`).toBe('42501')
        }
      }
    }
    expect(await revisjoner(side.id)).toHaveLength(1)
  })

  it('stenger alt for den som ikke er logget inn', async () => {
    const side = await nySide()
    await publiser(side.id, 1)
    expect((await feilFra(() => opprett('infoside', { navn: 'Anonym' }, null as never)))?.code).toBe('42501')
    for (const tabell of TABELLER) {
      expect((await feilFra(() => les(null, `select * from public.${tabell}`)))?.code, tabell).toBe('42501')
    }
  })

  it('gir API-rollene bare lesing, og kallene bare til innloggede', async () => {
    const RELASJONER = [...TABELLER, 'objektstatus', 'objekthistorikk']
    const RETTIGHETER = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']
    const KALL = [
      'public.er_admin()',
      'public.opprett_utkast(public.objekttype, jsonb)',
      'public.lagre_utkast(uuid, integer, jsonb)',
      'public.gjenopprett_revisjon(uuid, integer, integer)',
      'public.publiser_utkast(uuid, integer)',
    ]
    const har = async (sql: string, ...parametre: unknown[]) =>
      (await fasit<{ har: boolean }>(`select ${sql} as har`, parametre))[0]!.har

    for (const rolle of ['anon', 'authenticated', 'service_role']) {
      for (const relasjon of RELASJONER) {
        for (const rett of RETTIGHETER) {
          const forventet = rett === 'SELECT' && rolle !== 'anon'
          expect(await har('has_table_privilege($1, $2, $3)', rolle, `public.${relasjon}`, rett), `${rolle} ${rett} ${relasjon}`)
            .toBe(forventet)
        }
      }
      for (const kall of KALL) {
        expect(await har('has_function_privilege($1, $2, $3)', rolle, kall, 'EXECUTE'), `${rolle} ${kall}`)
          .toBe(rolle === 'authenticated')
      }
      for (const rett of ['USAGE', 'SELECT', 'UPDATE']) {
        expect(await har('has_sequence_privilege($1, $2, $3)', rolle, 'public.objektpubliseringer_id_seq', rett))
          .toBe(false)
      }
      expect(await har(`has_schema_privilege($1, 'intern', 'USAGE')`, rolle), rolle).toBe(false)
      expect(
        await har(
          `exists (select 1 from pg_proc where pronamespace = 'intern'::regnamespace
                   and has_function_privilege($1, oid, 'EXECUTE'))`,
          rolle,
        ),
        rolle,
      ).toBe(false)
    }
  })

  it('lar en administrator opprette og endre et utkast', async () => {
    const opprettet = await opprett('infoside', { navn: 'Utkast fra admin' })
    expect(opprettet).toMatchObject({ type: 'infoside', revisjon: 1, publisert_revisjon: null })

    const lagret = await lagre(opprettet.id, 1, { navn: 'Utkast fra admin, endret' })
    expect(lagret).toMatchObject({ id: opprettet.id, revisjon: 2, publisert_revisjon: null })

    const rader = await les<{ navn: string; tilstand: string }>(
      admin,
      'select navn, tilstand from public.infosider where objekt_id = $1',
      [opprettet.id],
    )
    expect(rader).toEqual([{ navn: 'Utkast fra admin, endret', tilstand: 'utkast' }])
    await forventSamsvar(opprettet.id)
  })
})

/* --- 4 og 5. Revisjonene -------------------------------------------------- */

describe('revisjonshistorikken', () => {
  it('lager en ny revisjon for hver endring, med hvem som gjorde den og hele objektet', async () => {
    const side = await nySide()
    const analytt = await opprett('laboratorieanalytt', {
      kode: 'TESTE',
      hovedside: side.id,
      komponenter: [side.id],
    })
    const annen = await nySide()
    await lagre(analytt.id, 1, { kode: 'TESTE', hovedside: side.id, komponenter: [side.id, annen.id] }, admin2)

    const [forste, andre] = await revisjoner(analytt.id)
    expect(forste).toMatchObject({
      revisjon: 1,
      handling: 'opprettet',
      utfort_av: admin,
      utfort_av_fornavn: 'Ada',
      utfort_av_etternavn: 'Adminsen',
      innhold: { kode: 'TESTE', hovedside: side.id, komponenter: [side.id] },
    })
    // Det komplette objektet, ikke bare det som ble endret.
    expect(andre).toMatchObject({
      revisjon: 2,
      handling: 'endret',
      gjenopprettet_fra: null,
      utfort_av: admin2,
      utfort_av_fornavn: 'Bo',
      utfort_av_etternavn: 'Bestyrer',
      innhold: { kode: 'TESTE', hovedside: side.id, komponenter: [side.id, annen.id] },
    })
    await forventSamsvar(analytt.id)
  })

  it('beholder navnet slik det var da endringen ble gjort', async () => {
    const skribent = await opprettBruker(db, {
      brukernavn: 'navnebytter',
      fornavn: 'Gammelt',
      etternavn: 'Navn',
      rolle: 'admin',
    })
    const side = await opprett('infoside', { navn: 'Side før navnebytte' }, skribent)

    // Brukeren endrer navnet sitt selv, slik profilen tillater.
    await som(db, skribent, (tx) =>
      tx.query(`update public.profiles set first_name = 'Nytt', last_name = 'Etternavn' where id = $1`, [
        skribent,
      ]),
    )
    await lagre(side.id, 1, { navn: 'Side etter navnebytte' }, skribent)

    const [gammel, ny] = await revisjoner(side.id)
    expect(gammel).toMatchObject({ utfort_av: skribent, utfort_av_fornavn: 'Gammelt', utfort_av_etternavn: 'Navn' })
    expect(ny).toMatchObject({ utfort_av: skribent, utfort_av_fornavn: 'Nytt', utfort_av_etternavn: 'Etternavn' })
  })

  it('lager ingen revisjon når ingenting er endret', async () => {
    const side = await opprett('infoside', { navn: 'Uendret side' })
    const status = await lagre(side.id, 1, { navn: '  Uendret side  ' })
    expect(status.revisjon).toBe(1)
    expect(await revisjoner(side.id)).toHaveLength(1)
  })

  it('avviser ugyldig innhold uten å lagre noe', async () => {
    const side = await nySide()
    for (const innhold of [
      { navn: '' },
      { navn: 42 },
      { navn: 'Ok', ukjent: 'felt' },
      {},
      [],
    ]) {
      const feil = await feilFra(() => lagre(side.id, 1, innhold as never))
      expect(feil?.code, JSON.stringify(innhold)).toMatch(/^(22023|23514)$/)
    }
    expect(await revisjoner(side.id)).toHaveLength(1)
    await forventSamsvar(side.id)
  })

  it('godtar heltall skrevet med desimaler, men ikke brøker eller for store tall', async () => {
    // Som JSON-tekst, slik at «2.0» kommer fram som det står.
    const heltall = (json: string) =>
      fasit<{ tall: number }>(`select intern.heltall($1::jsonb, 'posisjon') as tall`, [json])
    expect(await heltall('{"posisjon": 2.0}')).toEqual([{ tall: 2 }])
    expect(await heltall('{"posisjon": -3}')).toEqual([{ tall: -3 }])
    for (const json of ['{"posisjon": 1.5}', '{"posisjon": 2147483648}', '{"posisjon": "2"}']) {
      expect((await feilFra(() => heltall(json)))?.code, json).toBe('22023')
    }
  })

  it('kan ikke endres eller slettes av noen, heller ikke server-side', async () => {
    const side = await nySide()
    await publiser(side.id, 1)
    for (const sql of [
      `update public.objektrevisjoner set utfort_av_fornavn = 'Forfalsket' where objekt_id = $1`,
      `delete from public.objektrevisjoner where objekt_id = $1`,
      `update public.objektpubliseringer set revisjon = revisjon where objekt_id = $1`,
      `delete from public.objektpubliseringer where objekt_id = $1`,
      `update public.redigerbare_objekter set type = 'innholdselement' where id = $1`,
      `delete from public.redigerbare_objekter where id = $1`,
    ]) {
      expect((await feilFra(() => db.query(sql, [side.id])))?.code, sql).toBe('42501')
    }
    expect((await feilFra(() => db.query('truncate public.objektrevisjoner cascade')))?.code).toBe('42501')
    expect(await revisjoner(side.id)).toHaveLength(1)
  })

  it('nummererer revisjonene fortløpende, uten hull', async () => {
    const side = await nySide()
    const feil = await feilFra(() =>
      db.query(
        `insert into public.objektrevisjoner
           (objekt_id, revisjon, handling, innhold, utfort_av, utfort_av_fornavn, utfort_av_etternavn)
         values ($1, 3, 'endret', '{"navn": "Hopp"}', $2, 'A', 'B')`,
        [side.id, admin],
      ),
    )
    expect(feil?.code).toBe('23514')
  })
})

/* --- 6. Samtidige endringer ----------------------------------------------- */

describe('samtidige endringer', () => {
  it('avviser en lagring fra en gammel kopi i stedet for å skrive over', async () => {
    const side = await opprett('infoside', { navn: 'Delt side' })

    // A og B åpner begge revisjon 1. A lagrer først.
    const aLagret = await lagre(side.id, 1, { navn: 'Delt side, As versjon' }, admin)
    expect(aLagret.revisjon).toBe(2)

    // B lagrer sin gamle kopi.
    const feil = await feilFra(() => lagre(side.id, 1, { navn: 'Delt side, Bs versjon' }, admin2))
    expect(feil?.code).toBe(KONFLIKT)
    expect(JSON.parse(feil!.detail!)).toEqual({ gjeldende_revisjon: 2, forventet_revisjon: 1 })

    // As endring står, og det er ikke laget noen revisjon for B.
    expect(await fasit(`select navn from public.infosider where objekt_id = $1`, [side.id])).toEqual([
      { navn: 'Delt side, As versjon' },
    ])
    expect(await revisjoner(side.id)).toHaveLength(2)

    // Med den nye revisjonen i hånden går det.
    expect((await lagre(side.id, 2, { navn: 'Delt side, Bs versjon' }, admin2)).revisjon).toBe(3)
    await forventSamsvar(side.id)
  })

  it('avviser også publisering og gjenoppretting fra en gammel kopi', async () => {
    const side = await nySide()
    await lagre(side.id, 1, { navn: `${side.id} endret` })
    expect((await feilFra(() => publiser(side.id, 1)))?.code).toBe(KONFLIKT)
    expect((await feilFra(() => gjenopprett(side.id, 1, 1)))?.code).toBe(KONFLIKT)
    expect(await fasit(`select * from public.objektpubliseringer where objekt_id = $1`, [side.id])).toEqual([])
    expect(await revisjoner(side.id)).toHaveLength(2)
  })

  it('krever at klienten oppgir revisjonen den åpnet', async () => {
    const side = await nySide()
    const feil = await feilFra(() =>
      rpc(admin, 'lagre_utkast', { objekt: side.id, forventet_revisjon: null, innhold: { navn: 'X' } }),
    )
    expect(feil?.code).toBe('22023')
  })

  it('sier fra når objektet ikke finnes', async () => {
    expect((await feilFra(() => lagre(crypto.randomUUID(), 1, { navn: 'Ingen' })))?.code).toBe('PT404')
  })

  it('låser utkastet før revisjonen sammenlignes, i alle operasjonene som endrer et objekt', async () => {
    // Databasen i testene har bare én forbindelse, så to lagringer i samme
    // øyeblikk kan ikke spilles av her. Det som gjør dem trygge, er at
    // revisjonen leses med en radlås: den andre venter til den første er
    // ferdig, ser den nye revisjonen og avvises. Prøvd med to samtidige
    // økter mot en vanlig Postgres da fundamentet ble lagt.
    const kilde = async (navn: string) =>
      (await fasit<{ kilde: string }>(`select prosrc as kilde from pg_proc where proname = $1`, [navn]))[0]!.kilde
    const laas = (await kilde('laas_utkast')).replace(/\s+/g, ' ')
    expect(laas).toMatch(/where t\.objekt_id = p_objekt and t\.tilstand = 'utkast' for update;.*if gjeldende <> p_forventet_revisjon then/)
    for (const operasjon of ['lagre_utkast', 'gjenopprett_revisjon', 'publiser_utkast']) {
      expect(await kilde(operasjon), operasjon).toContain('intern.laas_utkast(objekt, forventet_revisjon)')
    }
  })
})

/* --- 7. Gjenoppretting ---------------------------------------------------- */

describe('gjenoppretting', () => {
  it('lager en ny revisjon og lar alle de mellomliggende stå', async () => {
    const side = await opprett('infoside', { navn: 'Versjon 1' })
    for (let v = 2; v <= 5; v++) await lagre(side.id, v - 1, { navn: `Versjon ${v}` })
    const for_ = await revisjoner(side.id)

    const status = await gjenopprett(side.id, 5, 3, admin2)
    expect(status.revisjon).toBe(6)

    const etter = await revisjoner(side.id)
    expect(etter.map((r) => r.revisjon)).toEqual([1, 2, 3, 4, 5, 6])
    // Det som var der fra før, er urørt.
    expect(etter.slice(0, 5)).toEqual(for_)
    expect(etter[5]).toMatchObject({
      handling: 'gjenopprettet',
      gjenopprettet_fra: 3,
      innhold: etter[2]!.innhold,
      utfort_av: admin2,
      utfort_av_fornavn: 'Bo',
    })
    expect(await fasit(`select navn from public.infosider where objekt_id = $1`, [side.id])).toEqual([
      { navn: 'Versjon 3' },
    ])
    await forventSamsvar(side.id)
  })

  it('gjenoppretter et helt objekt med komponentene, atomisk', async () => {
    const a = await nySide()
    const b = await nySide()
    const analytt = await opprett('laboratorieanalytt', { kode: 'TESTF', hovedside: a.id, komponenter: [a.id, b.id] })
    await lagre(analytt.id, 1, { kode: 'TESTG', hovedside: b.id, komponenter: [b.id] })
    await gjenopprett(analytt.id, 2, 1)

    const [forste, , tredje] = await revisjoner(analytt.id)
    expect(tredje!.innhold).toEqual(forste!.innhold)
    await forventSamsvar(analytt.id)
  })

  it('gjenoppretter bare revisjoner som ligger bak den gjeldende', async () => {
    const side = await nySide()
    await lagre(side.id, 1, { navn: `${side.id} v2` })
    for (const fra of [2, 3, 0]) {
      expect((await feilFra(() => gjenopprett(side.id, 2, fra)))?.code, String(fra)).toBe('22023')
    }
    expect(await revisjoner(side.id)).toHaveLength(2)
  })
})

/* --- 8 og 9. Utkast og publisering ---------------------------------------- */

describe('publisering', () => {
  it('peker entydig på revisjonen som ble publisert', async () => {
    const side = await opprett('infoside', { navn: 'Publiseres 1' })
    await lagre(side.id, 1, { navn: 'Publiseres 2' })

    const status = await publiser(side.id, 2, admin2)
    expect(status).toMatchObject({ revisjon: 2, publisert_revisjon: 2 })

    const [publisering] = await fasit<Record<string, unknown>>(
      'select * from public.objektpubliseringer where objekt_id = $1',
      [side.id],
    )
    expect(publisering).toMatchObject({
      revisjon: 2,
      forrige_revisjon: null,
      utfort_av: admin2,
      utfort_av_fornavn: 'Bo',
      utfort_av_etternavn: 'Bestyrer',
    })

    // Publisering lager ingen ny revisjon.
    expect(await revisjoner(side.id)).toHaveLength(2)
    await forventSamsvar(side.id)
  })

  it('lar det publiserte stå urørt mens utkastet endres', async () => {
    const side = await opprett('infoside', { navn: 'Stabil 1' })
    await publiser(side.id, 1)
    await lagre(side.id, 1, { navn: 'Stabil 2 (utkast)' })

    expect(await fasit(`select tilstand, navn from public.infosider where objekt_id = $1 order by tilstand`, [side.id]))
      .toEqual([
        { tilstand: 'utkast', navn: 'Stabil 2 (utkast)' },
        { tilstand: 'publisert', navn: 'Stabil 1' },
      ])
    const [status] = await fasit<Objektstatus>('select * from public.objektstatus where id = $1', [side.id])
    expect(status).toMatchObject({ revisjon: 2, publisert_revisjon: 1 })
    await forventSamsvar(side.id)
  })

  it('kan publisere en gjenopprettet revisjon, med hele historikken i behold', async () => {
    const side = await opprett('infoside', { navn: 'Gjenopprettes 1' })
    await publiser(side.id, 1)
    await lagre(side.id, 1, { navn: 'Gjenopprettes 2' })
    await publiser(side.id, 2)
    await gjenopprett(side.id, 2, 1)
    const status = await publiser(side.id, 3)
    expect(status).toMatchObject({ revisjon: 3, publisert_revisjon: 3 })

    const publiseringer = await fasit<{ revisjon: number; forrige_revisjon: number | null }>(
      'select revisjon, forrige_revisjon from public.objektpubliseringer where objekt_id = $1 order by id',
      [side.id],
    )
    expect(publiseringer).toEqual([
      { revisjon: 1, forrige_revisjon: null },
      { revisjon: 2, forrige_revisjon: 1 },
      { revisjon: 3, forrige_revisjon: 2 },
    ])
    expect(await fasit(`select navn from public.infosider where objekt_id = $1 and tilstand = 'publisert'`, [side.id]))
      .toEqual([{ navn: 'Gjenopprettes 1' }])

    const historikk = await fasit<{ handling: string; revisjon: number }>(
      `select handling, revisjon from public.objekthistorikk
       where objekt_id = $1 order by revisjon, handling = 'publisert'`,
      [side.id],
    )
    expect(historikk.map((h) => `${h.handling} ${h.revisjon}`)).toEqual([
      'opprettet 1',
      'publisert 1',
      'endret 2',
      'publisert 2',
      'gjenopprettet 3',
      'publisert 3',
    ])
    await forventSamsvar(side.id)
  })

  it('gjør ingenting når revisjonen alt er publisert', async () => {
    const side = await nySide()
    await publiser(side.id, 1)
    await publiser(side.id, 1)
    expect(await fasit('select 1 from public.objektpubliseringer where objekt_id = $1', [side.id])).toHaveLength(1)
  })

  it('publiserer en sumanalyse med alle komponentene samtidig', async () => {
    const a = await nySide()
    const b = await nySide()
    await publiser(a.id, 1)
    await publiser(b.id, 1)
    const analytt = await opprett('laboratorieanalytt', { kode: 'TESTH', hovedside: a.id, komponenter: [a.id, b.id] })
    await publiser(analytt.id, 1)
    await lagre(analytt.id, 1, { kode: 'TESTH', hovedside: a.id, komponenter: [a.id] })

    const publisert = await fasit<{ infoside_id: string }>(
      `select infoside_id from public.analyttkomponenter
       where analytt_id = $1 and tilstand = 'publisert' order by posisjon`,
      [analytt.id],
    )
    expect(publisert.map((k) => k.infoside_id)).toEqual([a.id, b.id])
    await forventSamsvar(analytt.id)
  })

  it('publiserer ikke noe som peker på en side som ikke er publisert', async () => {
    const hovedside = await nySide()
    const komponent = await nySide()
    const analytt = await opprett('laboratorieanalytt', {
      kode: 'TESTJ',
      hovedside: hovedside.id,
      komponenter: [hovedside.id, komponent.id],
    })
    const element = await opprett('innholdselement', {
      infoside: hovedside.id,
      panel: 'testpanel',
      posisjon: 1,
      elementtype: 'fritekst',
      data: {},
    })

    // Verken hovedsiden eller komponenten er publisert.
    expect((await feilFra(() => publiser(analytt.id, 1)))?.message).toContain('hovedside_id')
    expect((await feilFra(() => publiser(element.id, 1)))?.code).toBe('22023')

    // Hovedsiden alene er ikke nok når en komponent mangler.
    await publiser(hovedside.id, 1)
    expect((await feilFra(() => publiser(analytt.id, 1)))?.message).toContain('infoside_id')

    // Ingenting ble halvveis publisert underveis.
    for (const id of [analytt.id, element.id]) {
      expect(await fasit('select 1 from public.objekttilstander where objekt_id = $1 and tilstand = $2', [id, 'publisert']))
        .toEqual([])
      expect(await fasit('select 1 from public.objektpubliseringer where objekt_id = $1', [id])).toEqual([])
    }

    await publiser(komponent.id, 1)
    expect((await publiser(analytt.id, 1)).publisert_revisjon).toBe(1)
    expect((await publiser(element.id, 1)).publisert_revisjon).toBe(1)
    await forventSamsvar(analytt.id)
    await forventSamsvar(element.id)
  })
})

describe('hva en vanlig bruker får se', () => {
  it('ser ingenting av et objekt som aldri er publisert', async () => {
    const side = await opprett('infoside', { navn: 'Hemmelig utkast' })
    const analytt = await opprett('laboratorieanalytt', { kode: 'TESTI', hovedside: side.id, komponenter: [side.id] })
    for (const id of [side.id, analytt.id]) {
      for (const tabell of TABELLER) {
        const sql = `select * from public.${tabell} where ${OBJEKTKOLONNE[tabell]} = $1`
        expect(await les(bruker, sql, [id]), tabell).toEqual([])
      }
      expect(await les(bruker, 'select * from public.objektstatus where id = $1', [id])).toEqual([])
      expect(await les(bruker, 'select * from public.objekthistorikk where objekt_id = $1', [id])).toEqual([])
    }
    // Administratoren ser utkastet.
    expect(await les(admin, 'select navn from public.infosider where objekt_id = $1', [side.id])).toEqual([
      { navn: 'Hemmelig utkast' },
    ])
  })

  it('ser den publiserte utgaven, men aldri utkastet eller revisjoner som ikke er publisert', async () => {
    const side = await opprett('infoside', { navn: 'Synlig 1' })
    await lagre(side.id, 1, { navn: 'Synlig 2, aldri publisert' })
    await lagre(side.id, 2, { navn: 'Synlig 3' })
    await publiser(side.id, 3)
    await lagre(side.id, 3, { navn: 'Synlig 4, upublisert utkast' })

    expect(await les(bruker, 'select tilstand, navn from public.infosider where objekt_id = $1', [side.id])).toEqual([
      { tilstand: 'publisert', navn: 'Synlig 3' },
    ])
    expect((await revisjoner(side.id, bruker)).map((r) => r.revisjon)).toEqual([3])
    expect(await les(bruker, 'select tilstand, revisjon from public.objekttilstander where objekt_id = $1', [side.id]))
      .toEqual([{ tilstand: 'publisert', revisjon: 3 }])

    // Statusen røper ikke at det finnes et nyere utkast.
    const [status] = await les<Objektstatus>(bruker, 'select * from public.objektstatus where id = $1', [side.id])
    expect(status).toMatchObject({ revisjon: null, endret_kl: null, publisert_revisjon: 3 })

    const historikk = await les<{ handling: string; revisjon: number }>(
      bruker,
      `select handling, revisjon from public.objekthistorikk
       where objekt_id = $1 order by revisjon, handling = 'publisert'`,
      [side.id],
    )
    expect(historikk.map((h) => `${h.handling} ${h.revisjon}`)).toEqual(['endret 3', 'publisert 3'])

    // Administratoren ser alt.
    expect((await revisjoner(side.id, admin)).map((r) => r.revisjon)).toEqual([1, 2, 3, 4])
  })
})

/* --- Appens lagringsmodul ------------------------------------------------- */

describe('lagringsmodulen i appen', () => {
  it('oppretter, lagrer, gjenoppretter og publiserer', async () => {
    const lager = lagFaginnholdslager(klientFor(admin))
    const side = await lager.opprettUtkast('infoside', { navn: 'Fra appen' })
    expect(side).toMatchObject({ type: 'infoside', revisjon: 1, publisert_revisjon: null })
    expect((await lager.lagreUtkast(side.id, 1, { navn: 'Fra appen, endret' })).revisjon).toBe(2)
    expect((await lager.gjenopprettRevisjon(side.id, 2, 1)).revisjon).toBe(3)
    expect(await lager.publiserUtkast(side.id, 3)).toMatchObject({ revisjon: 3, publisert_revisjon: 3 })
  })

  it('gjør en konflikt om til en egen feil med revisjonene', async () => {
    const lager = lagFaginnholdslager(klientFor(admin))
    const side = await lager.opprettUtkast('infoside', { navn: 'Konflikt i appen' })
    await lager.lagreUtkast(side.id, 1, { navn: 'Konflikt i appen, først' })

    const feil = await lager.lagreUtkast(side.id, 1, { navn: 'Konflikt i appen, sist' }).catch((f: unknown) => f)
    expect(feil).toBeInstanceOf(Samtidighetskonflikt)
    expect(feil).toMatchObject({ gjeldendeRevisjon: 2, forventetRevisjon: 1 })
  })

  it('gir databasens melding når en vanlig bruker prøver å endre', async () => {
    const lager = lagFaginnholdslager(klientFor(bruker))
    await expect(lager.opprettUtkast('infoside', { navn: 'Nei' })).rejects.toThrow(
      'Bare administratorer kan endre faginnholdet.',
    )
  })

  it('gir en lesbar melding når innholdet bryter en regel i tabellen', async () => {
    const lager = lagFaginnholdslager(klientFor(admin))
    await expect(lager.opprettUtkast('infoside', { navn: '' })).rejects.toThrow(
      'Innholdet ble ikke godtatt.',
    )
    await expect(
      lager.opprettUtkast('infoside', { navn: 'Ok', ukjent: 1 } as never),
    ).rejects.toThrow('Ukjente felt: ukjent.')
  })
})
