/**
 * Referansesystemet, prøvd mot en ekte database.
 *
 * Som i `faginnhold.test.ts` kjøres alle migrasjonene i en Postgres i minnet,
 * og kallene gjøres slik data-API-et gjør dem. Det er databasen som skal
 * håndheve reglene: stabile ID-er, historikk, utkast og publisering,
 * rettigheter, koblingene fra innholdet og vernet mot sletting.
 *
 * Referansene og tekstene er syntetiske. Ingen kliniske verdier inngår.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { lagFaginnholdslager } from '../faginnhold/lagring'
import {
  REFERANSENIVAER,
  type Innholdselementinnhold,
  type Objektstatus,
  type Referanseinnhold,
} from '../faginnhold/modell'
import { SITERING, sidereferanser, type Referanse } from '../faginnhold/referanser'
import {
  faginnholdskall,
  feilFra,
  nyDatabase,
  opprettBruker,
  type Faginnholdskall,
} from './hjelp/testdatabase'

/** De nye tabellene, med kolonnen som peker på objektet. */
const TABELLER = {
  referanser: 'objekt_id',
  referansekoblinger: 'objekt_id',
  slettede_referanser: 'objekt_id',
} as const

let db: PGlite
let admin: string
let admin2: string
let bruker: string
let { rpc, les, fasit, opprett, lagre, gjenopprett, publiser, revisjoner, forventSamsvar, klientFor } =
  {} as Faginnholdskall

beforeAll(async () => {
  db = await nyDatabase()
  admin = await opprettBruker(db, { brukernavn: 'admin.en', fornavn: 'Ada', etternavn: 'Adminsen', rolle: 'admin' })
  admin2 = await opprettBruker(db, { brukernavn: 'admin.to', fornavn: 'Bo', etternavn: 'Bestyrer', rolle: 'admin' })
  bruker = await opprettBruker(db, { brukernavn: 'vanlig', fornavn: 'Vera', etternavn: 'Vanlig', rolle: 'user' })
  ;({ rpc, les, fasit, opprett, lagre, gjenopprett, publiser, revisjoner, forventSamsvar, klientFor } =
    faginnholdskall(db, admin))
}, 60_000)

/* --- Hjelpere ------------------------------------------------------------- */

let lopenummer = 0
function neste() {
  lopenummer += 1
  return lopenummer
}

function referanseinnhold(tittel: string, endringer: Partial<Referanseinnhold> = {}): Referanseinnhold {
  return {
    tittel,
    forfattere: 'Nordmann O, Hansen K',
    aar: '2021',
    lenke: 'https://example.org/artikkel',
    ...endringer,
  }
}

function nyReferanse(tittel = `Kilde ${neste()}`, endringer: Partial<Referanseinnhold> = {}) {
  return opprett('referanse', referanseinnhold(tittel, endringer))
}

function nySide(panelreferanser?: Record<string, string[]>) {
  return opprett('infoside', { navn: `Referanseside ${neste()}`, ...(panelreferanser && { panelreferanser }) })
}

/** En siteringsnode i rikteksten, slik editoren lagrer den. */
function sitering(...referanser: string[]) {
  return { type: SITERING, attrs: { referanser } }
}

/** Et avsnitt med tekst og siteringer, på samme form som Tiptap-JSON. */
function avsnitt(...deler: (string | ReturnType<typeof sitering>)[]) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: deler.map((del) => (typeof del === 'string' ? { type: 'text', text: del } : del)),
      },
    ],
  }
}

function element(
  infoside: string,
  endringer: Partial<Innholdselementinnhold> = {},
): Innholdselementinnhold {
  return { infoside, panel: 'farmakodynamikk', posisjon: 0, elementtype: 'tekst', data: {}, ...endringer }
}

function slett(id: string, forventet: number, av = admin) {
  return rpc<{ slett_referanse: string }>(av, 'slett_referanse', { objekt: id, forventet_revisjon: forventet })
}

interface Kobling {
  nr: number
  niva: string
  panel: string | null
  referanse_id: string
}

function koblinger(objekt: string, tilstand = 'utkast') {
  return fasit<Kobling>(
    `select nr, niva::text, panel, referanse_id from public.referansekoblinger
     where objekt_id = $1 and tilstand = $2 order by nr`,
    [objekt, tilstand],
  )
}

async function utkastet<T>(id: string): Promise<T> {
  return (
    await fasit<{ innhold: T }>(
      `select r.innhold from public.objekttilstander t
       join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = t.revisjon
       where t.objekt_id = $1 and t.tilstand = 'utkast'`,
      [id],
    )
  )[0]!.innhold
}

/* --- Utgangspunktet ------------------------------------------------------- */

describe('databasen etter migrasjonene', () => {
  it('har ingen referanser eller koblinger', async () => {
    const tom = await nyDatabase()
    for (const tabell of Object.keys(TABELLER)) {
      const { rows } = await tom.query<{ antall: number }>(`select count(*)::int as antall from public.${tabell}`)
      expect(rows[0]!.antall, tabell).toBe(0)
    }
  }, 60_000)

  it('har de samme referansenivåene som appen', async () => {
    const [rad] = await fasit<{ v: string[] }>(`select enum_range(null::public.referanseniva)::text[] as v`)
    expect(rad!.v).toEqual([...REFERANSENIVAER])
  })
})

/* --- Global referansebase med stabile ID-er ------------------------------- */

describe('referansene', () => {
  it('lagres på Slaids-formen, med arkivert som usann når den ikke er oppgitt', async () => {
    const ref = await nyReferanse('  Tittel med mellomrom  ')
    expect(ref).toMatchObject({ type: 'referanse', revisjon: 1, publisert_revisjon: null })
    expect(await utkastet(ref.id)).toEqual({
      tittel: 'Tittel med mellomrom',
      forfattere: 'Nordmann O, Hansen K',
      aar: '2021',
      lenke: 'https://example.org/artikkel',
      arkivert: false,
    })
    await forventSamsvar(ref.id)
  })

  it('krever minst tittel, forfatter eller lenke, men ikke alle', async () => {
    const tom = { tittel: '', forfattere: '', aar: '2020', lenke: '' }
    expect((await feilFra(() => opprett('referanse', tom)))?.code).toBe('22023')
    for (const felt of ['tittel', 'forfattere', 'lenke'] as const) {
      const verdi = felt === 'lenke' ? 'https://example.org' : 'Noe'
      const ref = await opprett('referanse', { ...tom, [felt]: verdi })
      expect(ref.revisjon, felt).toBe(1)
    }
  })

  it('godtar bare nettadresser som lenke', async () => {
    for (const lenke of ['javascript:alert(1)', 'ftp://example.org', 'example.org', 'https://', 'https://a b']) {
      expect((await feilFra(() => nyReferanse(undefined, { lenke })))?.code, lenke).toBe('22023')
    }
    for (const lenke of ['http://example.org', 'HTTPS://example.org/a?b=c#d', '']) {
      expect((await nyReferanse(undefined, { lenke })).revisjon, lenke).toBe(1)
    }
  })

  it('avviser ukjente felt og felt av feil type', async () => {
    const gyldig = referanseinnhold('Feltkontroll')
    for (const innhold of [
      { ...gyldig, doi: '10.1000/1' },
      { ...gyldig, aar: 2021 },
      { ...gyldig, arkivert: 'nei' },
      { tittel: 'Uten resten' },
    ]) {
      expect((await feilFra(() => opprett('referanse', innhold as never)))?.code, JSON.stringify(innhold)).toBe('22023')
    }
  })

  it('beholder ID-en når referansen endres, og endringen vises overalt den brukes', async () => {
    const ref = await nyReferanse('Før endringen')
    const sideA = await nySide()
    const sideB = await nySide()
    const kort = await opprett('innholdselement', element(sideA.id, { referanser: [ref.id] }))
    const tekst = await opprett('innholdselement', element(sideB.id, { data: { tekst: avsnitt('Tekst', sitering(ref.id)) } }))

    const endret = await lagre(ref.id, 1, referanseinnhold('Etter endringen'))
    expect(endret.id).toBe(ref.id)
    expect(endret.revisjon).toBe(2)

    // Innholdet peker fortsatt på den samme ID-en, og ingen av elementene fikk
    // en ny revisjon av at referansen ble endret.
    expect((await utkastet<Innholdselementinnhold>(kort.id)).referanser).toEqual([ref.id])
    expect(await revisjoner(kort.id)).toHaveLength(1)
    expect(await revisjoner(tekst.id)).toHaveLength(1)
    const titler = await fasit<{ tittel: string }>(
      `select distinct r.tittel from public.referansekoblinger k
       join public.referanser r on r.objekt_id = k.referanse_id and r.tilstand = k.tilstand
       where k.objekt_id = any($1::uuid[])`,
      [[kort.id, tekst.id]],
    )
    expect(titler).toEqual([{ tittel: 'Etter endringen' }])
  })

  it('gjenbrukes på flere kort og sider, og viser hvor og hvor ofte den brukes', async () => {
    const ref = await nyReferanse()
    const annen = await nyReferanse()
    const sideA = await nySide({ farmakokinetikk: [ref.id] })
    const sideB = await nySide()
    await opprett('innholdselement', element(sideA.id, { referanser: [ref.id, annen.id] }))
    await opprett(
      'innholdselement',
      element(sideA.id, { data: { tekst: avsnitt('En', sitering(ref.id), 'to', sitering(annen.id, ref.id)) } }),
    )
    await opprett('innholdselement', element(sideB.id, { data: { tekst: avsnitt('Tre', sitering(ref.id)) } }))

    const bruk = await fasit<{ infoside_id: string; forekomster: number }>(
      `select infoside_id, forekomster from public.referansebruk
       where referanse_id = $1 and tilstand = 'utkast' order by forekomster desc`,
      [ref.id],
    )
    expect(bruk).toEqual([
      { infoside_id: sideA.id, forekomster: 4 },
      { infoside_id: sideB.id, forekomster: 1 },
    ])
  })
})

/* --- Referansehistorikk --------------------------------------------------- */

describe('historikken til en referanse', () => {
  it('fører hver endring som en revisjon med hvem som gjorde den, og kan gjenopprettes', async () => {
    const ref = await nyReferanse('Versjon 1')
    await lagre(ref.id, 1, referanseinnhold('Versjon 2'), admin2)
    await lagre(ref.id, 2, referanseinnhold('Versjon 2', { lenke: '' }))

    const historikk = await revisjoner(ref.id)
    expect(historikk.map((r) => [r.revisjon, r.handling, r.utfort_av_fornavn, r.innhold.tittel, r.innhold.lenke])).toEqual([
      [1, 'opprettet', 'Ada', 'Versjon 1', 'https://example.org/artikkel'],
      [2, 'endret', 'Bo', 'Versjon 2', 'https://example.org/artikkel'],
      [3, 'endret', 'Ada', 'Versjon 2', ''],
    ])

    const gjenopprettet = await gjenopprett(ref.id, 3, 1, admin2)
    expect(gjenopprettet.revisjon).toBe(4)
    const [fjerde] = (await revisjoner(ref.id)).slice(-1)
    expect(fjerde).toMatchObject({ handling: 'gjenopprettet', gjenopprettet_fra: 1, utfort_av: admin2 })
    expect(fjerde!.innhold).toEqual((await revisjoner(ref.id))[0]!.innhold)
    await forventSamsvar(ref.id)
  })

  it('gjør arkivering til en revisjon som kan gjøres om', async () => {
    const ref = await nyReferanse()
    await lagre(ref.id, 1, { ...referanseinnhold('Arkiveres'), arkivert: true })
    await lagre(ref.id, 2, { ...referanseinnhold('Arkiveres'), arkivert: false })
    await gjenopprett(ref.id, 3, 2)
    expect((await utkastet<Referanseinnhold>(ref.id)).arkivert).toBe(true)
    await gjenopprett(ref.id, 4, 1)
    expect((await utkastet<Referanseinnhold>(ref.id)).arkivert).toBe(false)
    expect((await revisjoner(ref.id)).map((r) => r.innhold.arkivert)).toEqual([false, true, false, true, false])
  })

  it('gjenoppretter koblingene sammen med innholdet, atomisk', async () => {
    const a = await nyReferanse()
    const b = await nyReferanse()
    const side = await nySide()
    const kort = await opprett(
      'innholdselement',
      element(side.id, { referanser: [a.id], data: { tekst: avsnitt('x', sitering(b.id)) } }),
    )
    await lagre(kort.id, 1, element(side.id, { referanser: [b.id] }))
    expect((await koblinger(kort.id)).map((k) => [k.niva, k.referanse_id])).toEqual([['element', b.id]])

    await gjenopprett(kort.id, 2, 1)
    expect((await koblinger(kort.id)).map((k) => [k.niva, k.referanse_id])).toEqual([
      ['element', a.id],
      ['inline', b.id],
    ])
    await forventSamsvar(kort.id)
  })
})

/* --- Referansekoblinger fra innholdet ------------------------------------- */

describe('koblingene fra innholdet', () => {
  it('lagrer panel-, kort- og inlinereferanser som ID-er, aldri som numre', async () => {
    const [a, b, c] = [await nyReferanse(), await nyReferanse(), await nyReferanse()]
    const side = await nySide({ indikasjon: [c.id, a.id] })
    const kort = await opprett(
      'innholdselement',
      element(side.id, {
        referanser: [b.id],
        data: { tekst: avsnitt('Først', sitering(a.id, c.id), 'så', sitering(a.id)) },
      }),
    )

    expect((await koblinger(side.id)).map((k) => [k.niva, k.panel, k.referanse_id])).toEqual([
      ['panel', 'indikasjon', c.id],
      ['panel', 'indikasjon', a.id],
    ])
    expect((await koblinger(kort.id)).map((k) => [k.nr, k.niva, k.referanse_id])).toEqual([
      [1, 'element', b.id],
      [2, 'inline', a.id],
      [3, 'inline', c.id],
      [4, 'inline', a.id],
    ])

    // Øyeblikksbildet har ID-ene, og ingen numre noe sted.
    const innhold = await utkastet<Innholdselementinnhold>(kort.id)
    expect(innhold.referanser).toEqual([b.id])
    expect(JSON.stringify(innhold.data)).not.toMatch(/"nummer"|"numre"/)
    expect(await utkastet(side.id)).toEqual({
      navn: expect.any(String),
      panelreferanser: { indikasjon: [c.id, a.id] },
    })
    await forventSamsvar(side.id)
    await forventSamsvar(kort.id)
  })

  it('finner siteringene hvor som helst i dataene', async () => {
    const [a, b] = [await nyReferanse(), await nyReferanse()]
    const side = await nySide()
    const data = {
      rader: [{ merknad: avsnitt('i en tabell', sitering(a.id)) }],
      tekst: { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [avsnitt(sitering(b.id))] }] }] },
    }
    const kort = await opprett('innholdselement', element(side.id, { data }))
    expect((await koblinger(kort.id)).map((k) => k.referanse_id).sort()).toEqual([a.id, b.id].sort())
  })

  it('lar et objekt uten referanser være som før, og fyller inn tomme lister', async () => {
    const side = await opprett('infoside', { navn: `Uten referanser ${neste()}` })
    const kort = await opprett('innholdselement', element(side.id))
    expect(await utkastet(side.id)).toMatchObject({ panelreferanser: {} })
    expect(await utkastet(kort.id)).toMatchObject({ referanser: [] })
    expect(await koblinger(kort.id)).toEqual([])
  })

  it('avviser siteringer som ikke peker på en referanse', async () => {
    const ref = await nyReferanse()
    const side = await nySide()
    const ukjent = '00000000-0000-4000-8000-000000000000'
    const forsok: [string, Partial<Innholdselementinnhold>][] = [
      ['kortreferanse til en side', { referanser: [side.id] }],
      ['kortreferanse som ikke finnes', { referanser: [ukjent] }],
      ['samme kortreferanse to ganger', { referanser: [ref.id, ref.id] }],
      ['kortreferanse som ikke er en ID', { referanser: ['abc'] }],
      ['sitering av en side', { data: { tekst: avsnitt(sitering(side.id)) } }],
      ['sitering som ikke finnes', { data: { tekst: avsnitt(sitering(ukjent)) } }],
      ['tom sitering', { data: { tekst: avsnitt(sitering()) } }],
      ['sitering uten attrs', { data: { tekst: { type: SITERING } } }],
      ['samme ID to ganger i én sitering', { data: { tekst: avsnitt(sitering(ref.id, ref.id)) } }],
      ['ID med store bokstaver', { data: { tekst: avsnitt(sitering(ref.id.toUpperCase())) } }],
    ]
    for (const [hva, endring] of forsok) {
      const feil = await feilFra(() => opprett('innholdselement', element(side.id, endring)))
      expect(feil?.code, hva).toBe('22023')
    }
    expect(await fasit('select 1 from public.innholdselementer where infoside_id = $1', [side.id])).toEqual([])
  })

  it('avviser panelreferanser med ugyldig panel eller til noe annet enn en referanse', async () => {
    const ref = await nyReferanse()
    const annen = await nySide()
    for (const panelreferanser of [
      { 'Ugyldig panel': [ref.id] },
      { panel: [annen.id] },
      { panel: [ref.id, ref.id] },
      { panel: ref.id },
    ]) {
      const feil = await feilFra(() => nySide(panelreferanser as never))
      expect(feil?.code, JSON.stringify(panelreferanser)).toBe('22023')
    }
  })

  it('lar samme referanse stå mange ganger inline, i flere paneler og på flere kort', async () => {
    const ref = await nyReferanse()
    const side = await nySide({ a: [ref.id], b: [ref.id] })
    const data = { tekst: avsnitt(sitering(ref.id), 'og igjen', sitering(ref.id)) }
    const en = await opprett('innholdselement', element(side.id, { referanser: [ref.id], data }))
    const to = await opprett('innholdselement', element(side.id, { referanser: [ref.id], posisjon: 1 }))
    expect(await koblinger(side.id)).toHaveLength(2)
    expect(await koblinger(en.id)).toHaveLength(3)
    expect(await koblinger(to.id)).toHaveLength(1)
  })
})

/* --- Utkast og publisering ------------------------------------------------ */

describe('utkast og publisering', () => {
  it('publiserer ikke noe som siterer en referanse som ikke er publisert', async () => {
    const ref = await nyReferanse()
    const side = await nySide({ panel: [ref.id] })
    const kort = await opprett(
      'innholdselement',
      element(side.id, { data: { tekst: avsnitt(sitering(ref.id)) } }),
    )

    for (const [id, revisjon] of [[side.id, 1], [kort.id, 1]] as const) {
      expect((await feilFra(() => publiser(id, revisjon)))?.code).toBe('22023')
    }
    await publiser(ref.id, 1)
    await publiser(side.id, 1)
    const publisert = await publiser(kort.id, 1)
    expect(publisert.publisert_revisjon).toBe(1)
    expect(await koblinger(kort.id, 'publisert')).toEqual(await koblinger(kort.id))
    await forventSamsvar(side.id)
    await forventSamsvar(kort.id)
  })

  it('lar det publiserte stå urørt mens referansen endres i utkastet', async () => {
    const ref = await nyReferanse('Publisert tittel')
    await publiser(ref.id, 1)
    await lagre(ref.id, 1, referanseinnhold('Utkast til ny tittel'))

    const somBruker = await les<{ tittel: string; tilstand: string }>(
      bruker,
      'select tittel, tilstand from public.referanser where objekt_id = $1',
      [ref.id],
    )
    expect(somBruker).toEqual([{ tittel: 'Publisert tittel', tilstand: 'publisert' }])

    await publiser(ref.id, 2)
    expect(
      await les(bruker, 'select tittel from public.referanser where objekt_id = $1', [ref.id]),
    ).toEqual([{ tittel: 'Utkast til ny tittel' }])
  })

  it('viser en vanlig bruker bare publiserte referanser og koblinger', async () => {
    const synlig = await nyReferanse()
    const skjult = await nyReferanse()
    await publiser(synlig.id, 1)
    const side = await nySide()
    await publiser(side.id, 1)
    const kort = await opprett('innholdselement', element(side.id, { referanser: [synlig.id] }))
    await publiser(kort.id, 1)
    await lagre(kort.id, 1, element(side.id, { referanser: [synlig.id, skjult.id] }))

    expect(await les(bruker, 'select 1 from public.referanser where objekt_id = $1', [skjult.id])).toEqual([])
    expect(await les(bruker, 'select 1 from public.redigerbare_objekter where id = $1', [skjult.id])).toEqual([])
    const sett = await les<{ referanse_id: string; tilstand: string }>(
      bruker,
      'select referanse_id, tilstand from public.referansekoblinger where objekt_id = $1',
      [kort.id],
    )
    expect(sett).toEqual([{ referanse_id: synlig.id, tilstand: 'publisert' }])
    expect(
      await les(bruker, `select 1 from public.referansebruk where referanse_id = $1`, [skjult.id]),
    ).toEqual([])
    expect(
      await les(admin, `select tilstand from public.referansebruk where referanse_id = $1`, [skjult.id]),
    ).toEqual([{ tilstand: 'utkast' }])
  })
})

/* --- Arkivering ----------------------------------------------------------- */

describe('arkivering', () => {
  it('går ikke så lenge referansen er sitert i utkastet', async () => {
    const ref = await nyReferanse()
    const side = await nySide()
    const kort = await opprett('innholdselement', element(side.id, { data: { tekst: avsnitt(sitering(ref.id)) } }))

    const feil = await feilFra(() => lagre(ref.id, 1, { ...referanseinnhold('x'), arkivert: true }))
    expect(feil).toMatchObject({ code: '22023', message: expect.stringContaining('i bruk') })

    await lagre(kort.id, 1, element(side.id))
    expect((await lagre(ref.id, 1, { ...referanseinnhold('x'), arkivert: true })).revisjon).toBe(2)
  })

  it('stopper en arkivert referanse fra å bli sitert, på alle nivåene', async () => {
    const ref = await nyReferanse(undefined, { arkivert: true })
    const side = await nySide()
    for (const endring of [{ referanser: [ref.id] }, { data: { tekst: avsnitt(sitering(ref.id)) } }]) {
      const feil = await feilFra(() => opprett('innholdselement', element(side.id, endring)))
      expect(feil).toMatchObject({ code: '22023', message: expect.stringContaining('arkivert') })
    }
    expect((await feilFra(() => nySide({ panel: [ref.id] })))?.code).toBe('22023')
  })

  it('stopper en gjenoppretting som ville sitert en arkivert referanse', async () => {
    const ref = await nyReferanse()
    const side = await nySide()
    const kort = await opprett('innholdselement', element(side.id, { referanser: [ref.id] }))
    await lagre(kort.id, 1, element(side.id))
    await lagre(ref.id, 1, { ...referanseinnhold('Arkivert'), arkivert: true })

    expect((await feilFra(() => gjenopprett(kort.id, 2, 1)))?.code).toBe('22023')
    expect(await revisjoner(kort.id)).toHaveLength(2)

    // Hentes referansen fram igjen, går gjenopprettingen.
    await gjenopprett(ref.id, 2, 1)
    expect((await gjenopprett(kort.id, 2, 1)).revisjon).toBe(3)
  })

  it('publiseres ikke før det publiserte innholdet har sluppet referansen', async () => {
    const ref = await nyReferanse()
    await publiser(ref.id, 1)
    const side = await nySide()
    await publiser(side.id, 1)
    const kort = await opprett('innholdselement', element(side.id, { referanser: [ref.id] }))
    await publiser(kort.id, 1)

    await lagre(kort.id, 1, element(side.id))
    await lagre(ref.id, 1, { ...referanseinnhold('Arkiveres'), arkivert: true })
    const feil = await feilFra(() => publiser(ref.id, 2))
    expect(feil).toMatchObject({ code: '22023', message: expect.stringContaining('publiserte') })

    await publiser(kort.id, 2)
    expect((await publiser(ref.id, 2)).publisert_revisjon).toBe(2)
  })
})

/* --- Vernet mot sletting -------------------------------------------------- */

describe('sletting av referanser', () => {
  it('sletter en referanse som aldri er brukt eller publisert, og fører det i loggen', async () => {
    const ref = await nyReferanse('Feilregistrert')
    await lagre(ref.id, 1, referanseinnhold('Feilregistrert, rettet'))

    expect(await slett(ref.id, 2, admin2)).toEqual({ slett_referanse: ref.id })
    expect(await fasit('select 1 from public.redigerbare_objekter where id = $1', [ref.id])).toEqual([])
    expect(await revisjoner(ref.id)).toEqual([])
    expect(await fasit('select 1 from public.referanser where objekt_id = $1', [ref.id])).toEqual([])

    const [logg] = await fasit<Record<string, unknown>>('select * from public.slettede_referanser where objekt_id = $1', [ref.id])
    expect(logg).toMatchObject({
      revisjon: 2,
      slettet_av: admin2,
      slettet_av_fornavn: 'Bo',
      innhold: expect.objectContaining({ tittel: 'Feilregistrert, rettet' }),
    })
    expect(await les(bruker, 'select 1 from public.slettede_referanser')).toEqual([])
    expect((await les(admin, 'select 1 from public.slettede_referanser where objekt_id = $1', [ref.id])).length).toBe(1)
  })

  it('sletter ikke en referanse som er i bruk, på noe nivå', async () => {
    const side = await nySide()
    const lag = {
      panel: async (id: string) => nySide({ panel: [id] }),
      kort: async (id: string) => opprett('innholdselement', element(side.id, { referanser: [id] })),
      inline: async (id: string) =>
        opprett('innholdselement', element(side.id, { data: { tekst: avsnitt(sitering(id)) } })),
    }
    for (const [niva, bruk] of Object.entries(lag)) {
      const ref = await nyReferanse()
      await bruk(ref.id)
      const feil = await feilFra(() => slett(ref.id, 1))
      expect(feil, niva).toMatchObject({ code: '22023', message: expect.stringContaining('i bruk') })
      expect(await revisjoner(ref.id), niva).toHaveLength(1)
    }
  })

  it('sletter ikke en referanse som bare står i en eldre revisjon', async () => {
    const ref = await nyReferanse()
    const side = await nySide()
    const kort = await opprett('innholdselement', element(side.id, { referanser: [ref.id] }))
    await lagre(kort.id, 1, element(side.id))
    expect(await koblinger(kort.id)).toEqual([])

    expect((await feilFra(() => slett(ref.id, 1)))?.code).toBe('22023')
    // Den eldre revisjonen kan fortsatt hentes fram, med referansen.
    expect((await gjenopprett(kort.id, 2, 1)).revisjon).toBe(3)
    expect((await koblinger(kort.id)).map((k) => k.referanse_id)).toEqual([ref.id])
  })

  it('sletter ikke en referanse som har vært publisert', async () => {
    const ref = await nyReferanse()
    await publiser(ref.id, 1)
    const feil = await feilFra(() => slett(ref.id, 1))
    expect(feil).toMatchObject({ code: '22023', message: expect.stringContaining('Arkiver') })
  })

  it('sletter bare referanser, bare for administratorer og bare fra den gjeldende revisjonen', async () => {
    const side = await nySide()
    expect((await feilFra(() => slett(side.id, 1)))?.code).toBe('22023')

    const ref = await nyReferanse()
    await lagre(ref.id, 1, referanseinnhold('Endret'))
    expect((await feilFra(() => slett(ref.id, 1)))?.code).toBe('PT409')
    expect((await feilFra(() => slett(ref.id, 2, bruker)))?.code).toBe('42501')
    expect((await feilFra(() => slett('00000000-0000-4000-8000-000000000000', 1)))?.code).toBe('PT404')
    expect(await revisjoner(ref.id)).toHaveLength(2)
  })

  it('åpner ikke historikken for sletting utenom slett_referanse', async () => {
    const ref = await nyReferanse()
    const side = await nySide()
    for (const [id, tabell, kolonne] of [
      [side.id, 'objektrevisjoner', 'objekt_id'],
      [side.id, 'redigerbare_objekter', 'id'],
      [ref.id, 'objektpubliseringer', 'objekt_id'],
    ] as const) {
      // Selv med innstillingen slettingen bruker, og uten radsikkerhet, står
      // alt som ikke er referansen som slettes, eller som er en publisering.
      const feil = await feilFra(() =>
        db.transaction(async (tx) => {
          await tx.query(`select set_config('intern.sletter_referanse', $1, true)`, [id])
          await tx.query(`delete from public.${tabell} where ${kolonne} = $1`, [id])
          await tx.query(`update public.objektrevisjoner set handling = handling where objekt_id = $1`, [ref.id])
        }),
      )
      expect(feil?.code, tabell).toBe('42501')
    }
    expect(await revisjoner(side.id)).toHaveLength(1)
    expect(await revisjoner(ref.id)).toHaveLength(1)
  })

  it('lar ikke loggen over slettede referanser endres', async () => {
    const ref = await nyReferanse()
    await slett(ref.id, 1)
    for (const sql of ['update public.slettede_referanser set revisjon = 9', 'delete from public.slettede_referanser']) {
      expect((await feilFra(() => db.query(sql)))?.code, sql).toBe('42501')
    }
  })
})

/* --- Tilgang -------------------------------------------------------------- */

describe('hvem som kan gjøre hva med referansene', () => {
  it('avviser en vanlig bruker i alle operasjonene', async () => {
    const ref = await nyReferanse()
    for (const kall of [
      () => opprett('referanse', referanseinnhold('Fra vanlig bruker'), bruker),
      () => lagre(ref.id, 1, referanseinnhold('Endret av vanlig bruker'), bruker),
      () => publiser(ref.id, 1, bruker),
      () => gjenopprett(ref.id, 1, 1, bruker),
      () => slett(ref.id, 1, bruker),
    ]) {
      expect((await feilFra(kall))?.code).toBe('42501')
    }
    expect(await revisjoner(ref.id)).toHaveLength(1)
  })

  it('gir ingen skriverett på tabellene, og stenger alt for den som ikke er logget inn', async () => {
    for (const hvem of [bruker, admin]) {
      for (const [tabell, kolonne] of Object.entries(TABELLER)) {
        for (const sql of [
          `insert into public.${tabell} default values`,
          `update public.${tabell} set ${kolonne} = ${kolonne}`,
          `delete from public.${tabell}`,
        ]) {
          expect((await feilFra(() => les(hvem, sql)))?.code, `${tabell}: ${sql}`).toBe('42501')
        }
      }
    }
    for (const relasjon of [...Object.keys(TABELLER), 'referansebruk']) {
      expect((await feilFra(() => les(null, `select * from public.${relasjon}`)))?.code, relasjon).toBe('42501')
    }
  })

  it('gir API-rollene bare lesing, og slettingen bare til innloggede', async () => {
    const RETTIGHETER = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']
    const har = async (sql: string, ...parametre: unknown[]) =>
      (await fasit<{ har: boolean }>(`select ${sql} as har`, parametre))[0]!.har
    for (const rolle of ['anon', 'authenticated', 'service_role']) {
      for (const relasjon of [...Object.keys(TABELLER), 'referansebruk']) {
        for (const rett of RETTIGHETER) {
          expect(
            await har('has_table_privilege($1, $2, $3)', rolle, `public.${relasjon}`, rett),
            `${rolle} ${rett} ${relasjon}`,
          ).toBe(rett === 'SELECT' && rolle !== 'anon')
        }
      }
      expect(
        await har('has_function_privilege($1, $2, $3)', rolle, 'public.slett_referanse(uuid, integer)', 'EXECUTE'),
        rolle,
      ).toBe(rolle === 'authenticated')
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
})

/* --- Fra databasen til numrene på siden ----------------------------------- */

describe('nummereringen av en publisert side', () => {
  it('regner numrene ut fra det en vanlig bruker leser, etter første forekomst', async () => {
    const [a, b, c, d] = [await nyReferanse('A'), await nyReferanse('B'), await nyReferanse('C'), await nyReferanse('D')]
    for (const ref of [a, b, c, d]) await publiser(ref.id, 1)
    const side = await nySide({ kinetikk: [d.id] })
    await publiser(side.id, 1)
    const kort: Objektstatus[] = [
      await opprett('innholdselement', element(side.id, { panel: 'dynamikk', posisjon: 2, data: { tekst: avsnitt(sitering(a.id)) } })),
      await opprett('innholdselement', element(side.id, { panel: 'dynamikk', posisjon: 1, referanser: [c.id], data: { tekst: avsnitt(sitering(b.id, c.id)) } })),
      await opprett('innholdselement', element(side.id, { panel: 'kinetikk', posisjon: 0, data: { tekst: avsnitt(sitering(a.id)) } })),
    ]
    for (const k of kort) await publiser(k.id, 1)

    const [sideinnhold] = await les<{ panelreferanser: Record<string, string[]> }>(
      bruker,
      `select jsonb_object_agg(panel, ider) as panelreferanser from (
         select panel, jsonb_agg(referanse_id order by nr) as ider from public.referansekoblinger
         where objekt_id = $1 and niva = 'panel' group by panel) p`,
      [side.id],
    )
    const elementer = await les<{ id: string; panel: string; posisjon: number; data: unknown; referanser: string[] }>(
      bruker,
      `select e.objekt_id as id, e.panel, e.posisjon, e.data,
              coalesce((select array_agg(k.referanse_id order by k.nr) from public.referansekoblinger k
                        where k.objekt_id = e.objekt_id and k.tilstand = e.tilstand and k.niva = 'element'), '{}') as referanser
       from public.innholdselementer e where e.infoside_id = $1`,
      [side.id],
    )
    const referanser = await les<Referanse>(
      bruker,
      `select objekt_id as id, tittel, forfattere, aar, lenke, arkivert from public.referanser`,
    )

    const { nummerering, liste } = sidereferanser(
      { panelreferanser: sideinnhold!.panelreferanser, elementer },
      referanser,
      ['dynamikk', 'kinetikk'],
    )
    // dynamikk: kortet på posisjon 1 (C på kortet, så B og C inline), så
    // posisjon 2 (A). kinetikk: panelets D, så A igjen.
    expect(Object.fromEntries([...nummerering].map(([id, n]) => [referanser.find((r) => r.id === id)!.tittel, n]))).toEqual({
      C: 1,
      B: 2,
      A: 3,
      D: 4,
    })
    expect(liste.map((o) => `${o.nummer} ${o.referanse.tittel}`)).toEqual(['1 C', '2 B', '3 A', '4 D'])
  })
})

/* --- Lagringsmodulen i appen ---------------------------------------------- */

describe('lagringsmodulen i appen', () => {
  it('sletter en ubrukt referanse, og gir databasens melding når den er i bruk', async () => {
    const lager = lagFaginnholdslager(klientFor(admin))
    const ubrukt = await lager.opprettUtkast('referanse', referanseinnhold('Ubrukt'))
    await expect(lager.slettReferanse(ubrukt.id, 1)).resolves.toBeUndefined()

    const brukt = await lager.opprettUtkast('referanse', referanseinnhold('Brukt'))
    const side = await nySide({ panel: [brukt.id] })
    expect(side.revisjon).toBe(1)
    await expect(lager.slettReferanse(brukt.id, 1)).rejects.toThrow(/i bruk/)
  })
})
