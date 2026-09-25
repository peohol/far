/**
 * Søket i hele kunnskapsbasen: lesingen av alle sidene i én omgang, prøvd mot
 * en ekte database med migrasjonene og FEST-utdraget, og rangeringen og
 * stedene treffene peker på.
 *
 * Det viktigste som prøves, er at søket i kunnskapsbasen finner det samme som
 * søket på hver side — de samme tekstene, på de samme stedene — selv om alt
 * leses i tre kall i stedet for tre per side.
 *
 * Navnene på sidene er ekte virkestoff fordi FEST-utdraget er ekte, men
 * tekstene og tallene på sidene er syntetiske. Ingen kliniske verdier inngår.
 */
import type { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { byggSidemodell, publiseringsplan } from '../faginnhold/analyttside'
import {
  MAKS_INTERAKSJONSNOKLER,
  indekserKunnskapsbase,
  lagSideleser,
  lesKunnskapsbase,
  lesSokeindeks,
  type Sideleser,
} from '../faginnhold/globaltSok'
import { lagFaginnholdslager } from '../faginnhold/lagring'
import { lagFaginnholdsleser, type Analyttsidedata, type Faginnholdsleser } from '../faginnhold/lesing'
import { SITERING } from '../faginnhold/referanser'
import {
  indekserSide,
  lagSokeindeks,
  sok,
  sokGlobalt,
  sokeadresse,
  stedsnokkel,
  sti,
  type Sokedokument,
  type Sokefelt,
} from '../faginnhold/sok'
import { byggInteraksjoner, interaksjonsnokler } from '../legemiddeldata/interaksjoner'
import { lagLegemiddelleser, TOMME_INTERAKSJONER, TOMT_UTVALG, type Legemiddelleser } from '../legemiddeldata/lesing'
import { byggPreparatvisning } from '../legemiddeldata/preparatmodell'
import { interaksjonstekster, koblede, preparatkort, preparattekster } from '../legemiddeldata/stoffside'
import { AMITRIPTYLIN, KODEIN, synkroniserUtdrag } from './hjelp/fest'
import { faginnholdskall, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

function dokument(...innhold: unknown[]) {
  return { type: 'doc', content: [{ type: 'paragraph', content: innhold }] }
}

const tekst = (text: string) => ({ type: 'text', text })

let db: PGlite
let kall: Faginnholdskall
let admin: string
let bruker: string
let brukerklient: SupabaseClient
let sideleser: Sideleser
let faginnhold: Faginnholdsleser
let legemidler: Legemiddelleser
const ider = { kilde: '', metabolisme: '', fjernet: '' }

/** Oppretter en side med innholdet, og publiserer alt. */
async function publisertSide(
  kode: string,
  navn: string,
  elementer: { panel: string; elementtype: string; data: Record<string, unknown>; referanser?: string[] }[],
  komponenter: string[] = [],
): Promise<Record<string, string>> {
  const lager = lagFaginnholdslager(kall.klientFor(admin))
  const side = (await lager.opprettUtkast('infoside', { navn })).id
  await lager.opprettUtkast('laboratorieanalytt', { kode, hovedside: side, komponenter: [side, ...komponenter] })
  const laget: Record<string, string> = {}
  for (const [posisjon, e] of elementer.entries()) {
    laget[`${e.panel}:${posisjon}`] = (
      await lager.opprettUtkast('innholdselement', { infoside: side, posisjon, ...e })
    ).id
  }
  const leser = lagFaginnholdsleser(kall.klientFor(admin))
  for (const steg of publiseringsplan(await leser.lesAnalyttside(kode, 'utkast'))) {
    await lager.publiserUtkast(steg.id, steg.revisjon)
  }
  return { side, ...laget }
}

beforeAll(async () => {
  db = await nyDatabase()
  await synkroniserUtdrag(db)
  admin = await opprettBruker(db, { brukernavn: 'redaktor', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
  bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
  kall = faginnholdskall(db, admin)
  const lager = lagFaginnholdslager(kall.klientFor(admin))

  ider.kilde = (await lager.opprettUtkast('referanse', { tittel: 'Syntetisk lærebok', forfattere: 'Nordmann O', aar: '2020', lenke: '' })).id

  // Nortriptylin først, så Amitriptylin kan ha den som komponent.
  const nortriptylin = await publisertSide('NORT', 'Nortriptylin', [
    {
      panel: 'farmakodynamikk',
      elementtype: 'riktekst',
      data: { dokument: dokument(tekst('Syntetisk: hemmer reopptaket av noradrenalin.'), { type: SITERING, attrs: { referanser: [ider.kilde] } }) },
    },
  ])
  const amitriptylin = await publisertSide(
    'AMTNORSUM',
    'Amitriptylin',
    [
      { panel: 'preparater', elementtype: 'legemiddelkobling', data: { virkestoff: [{ fest_id: AMITRIPTYLIN, navn: 'Amitriptylin' }] } },
      {
        panel: 'farmakokinetikk',
        elementtype: 'kinetikkort',
        data: { tittel: 'Metabolisme', dokument: dokument(tekst('Syntetisk: omdannes i leveren.')) },
        referanser: [ider.kilde],
      },
      { panel: 'dosering', elementtype: 'riktekst', data: { dokument: dokument(tekst('Syntetisk doseringstekst.')) } },
      { panel: 'fjernet', elementtype: 'riktekst', data: { dokument: dokument(tekst('Fjernettekst som ikke skal finnes.')) } },
    ],
    [nortriptylin.side!],
  )
  ider.metabolisme = amitriptylin['farmakokinetikk:1']!
  await publisertSide('KOD', 'Kodein', [
    { panel: 'preparater', elementtype: 'legemiddelkobling', data: { virkestoff: [{ fest_id: KODEIN, navn: 'Kodein' }] } },
  ])
  // En side som bare finnes som utkast.
  const upublisert = (await lager.opprettUtkast('infoside', { navn: 'Upublisertmiddel' })).id
  await lager.opprettUtkast('laboratorieanalytt', { kode: 'UPUB', hovedside: upublisert, komponenter: [upublisert] })

  brukerklient = kall.klientFor(bruker)
  sideleser = lagSideleser(brukerklient)
  faginnhold = lagFaginnholdsleser(brukerklient)
  legemidler = lagLegemiddelleser(brukerklient)
}, 120_000)

describe('les_analyttsider', () => {
  it('gir hver side på samme form som les_analyttside', async () => {
    const sider = await sideleser.lesAnalyttsider('publisert')
    expect(sider.map((s) => s.analytt?.innhold.kode)).toEqual(['AMTNORSUM', 'KOD', 'NORT'])
    for (const side of sider) {
      expect(side).toEqual(await faginnhold.lesAnalyttside(side.analytt!.innhold.kode, 'publisert'))
    }
  })

  it('gir en vanlig bruker bare det publiserte, og ingenting uten innlogging', async () => {
    expect(await sideleser.lesAnalyttsider('utkast')).toEqual([])
    const utkast = await lagSideleser(kall.klientFor(admin)).lesAnalyttsider('utkast')
    expect(utkast.map((s) => s.analytt?.innhold.kode)).toContain('UPUB')
    await expect(kall.rpc(null, 'les_analyttsider', { sidetilstand: 'publisert' })).rejects.toThrow(/permission denied/)
  })
})

describe('lesingen av kunnskapsbasen', () => {
  it('leser alt i tre kall, uansett hvor mange sider det er', async () => {
    const kalt: string[] = []
    const tellende = {
      rpc: (funksjon: string, argumenter: Record<string, unknown>) => {
        kalt.push(funksjon)
        return brukerklient.rpc(funksjon, argumenter)
      },
    } as unknown as SupabaseClient
    const base = await lesKunnskapsbase(lagSideleser(tellende), lagLegemiddelleser(tellende))
    expect(kalt).toEqual(['les_analyttsider', 'les_legemidler', 'les_interaksjoner'])
    expect(base.sider).toHaveLength(3)
    expect(base.festfeil).toBeUndefined()
  })

  it('gir hver side de samme søkedokumentene som søket på siden selv', async () => {
    const base = await lesKunnskapsbase(sideleser, legemidler)
    const globale = indekserKunnskapsbase(base)

    for (const kode of ['AMTNORSUM', 'KOD', 'NORT']) {
      // Slik siden selv gjør det (Analyttside.tsx): én side og legemidlene for koblingen den har.
      const data = await faginnhold.lesAnalyttside(kode, 'publisert')
      const modell = byggSidemodell(data)
      const koblet = koblede(modell)
      const tillegg = []
      if (koblet.length > 0) {
        const utvalg = await legemidler.les(koblet)
        const nokler = interaksjonsnokler(utvalg, koblet)
        tillegg.push(
          ...preparattekster(byggPreparatvisning(utvalg, koblet)),
          ...interaksjonstekster(byggInteraksjoner(await legemidler.interaksjoner(nokler), nokler)),
        )
      }
      const paSiden = indekserSide(
        { kode, navn: data.infoside!.innhold.navn, komponenter: data.komponenter.map((k) => k.innhold.navn) },
        modell,
        tillegg,
      )
      expect(globale.filter((d) => d.sted.side.kode === kode), kode).toEqual(paSiden)
    }
    // Kodeinsiden fikk ikke amitriptylinpreparatene, selv om alt ble lest sammen.
    expect(globale.filter((d) => d.sted.side.kode === 'KOD' && d.felt === 'preparat').map((d) => d.tekst)).toEqual([
      'Kodimagnyl Ikke-stoppende dak',
    ])
  })

  it('indekserer faginnholdet også når legemiddeldataene ikke kan leses', async () => {
    const nede: Legemiddelleser = {
      les: async () => {
        throw new Error('Legemiddeldataene svarer ikke')
      },
      sok: async () => [],
      interaksjoner: async () => TOMME_INTERAKSJONER,
    }
    const indeks = await lesSokeindeks(sideleser, nede)
    expect(indeks.festfeil).toBe('Legemiddeldataene svarer ikke')
    expect(sokGlobalt(indeks, 'sarotex')).toEqual([])
    expect(sokGlobalt(indeks, 'doseringstekst')).toHaveLength(1)
  })

  it('deler interaksjonsoppslaget i flere kall når nøklene er flere enn databasen tar imot', async () => {
    const antall = MAKS_INTERAKSJONSNOKLER + 20
    const sider = Array.from({ length: antall }, (_, i) => side(`K${i}`, `Side ${i}`, [`V${i}`]))
    const oppslag: number[] = []
    const mange: Legemiddelleser = {
      les: async () => ({ ...TOMT_UTVALG, virkestoff: [] }),
      sok: async () => [],
      interaksjoner: async ({ atc, virkestoff }) => {
        oppslag.push(virkestoff.length)
        expect(atc).toEqual([])
        // Samme interaksjon i begge svarene står bare én gang.
        return { interaksjoner: [{ id: 'felles' } as never], ikke_vurdert: [] }
      },
    }
    const base = await lesKunnskapsbase({ lesAnalyttsider: async () => sider }, mange)
    expect(oppslag).toEqual([MAKS_INTERAKSJONSNOKLER, 20])
    expect(base.interaksjoner?.interaksjoner).toHaveLength(1)
  })
})

describe('søket i kunnskapsbasen', () => {
  let indeks: Awaited<ReturnType<typeof lesSokeindeks>>
  beforeAll(async () => {
    indeks = await lesSokeindeks(sideleser, legemidler)
  })

  it('finner et preparat og peker på detaljkortet for legemiddelformen', async () => {
    const [treff] = sokGlobalt(indeks, 'sarotex')
    expect(treff!.dokument.felt).toBe('preparat')
    expect(sti(treff!.dokument.sted)).toEqual(['Amitriptylin', 'Preparater', 'Tablett'])
    const formMed = async (koblet: string, navn: string) => {
      const visning = byggPreparatvisning(await legemidler.les([koblet]), [koblet])
      return visning.former.find((f) => f.styrker.some((s) => s.preparater.some((p) => p.navn === navn)))!
    }
    const tablett = await formMed(AMITRIPTYLIN, 'Sarotex')
    expect(tablett.form).toBe('Tablett')
    expect(sokeadresse(treff!.dokument.sted)).toBe(`#/analytt/AMTNORSUM/preparater/${preparatkort(tablett.id)}`)
    // Et preparat som krever godkjenningsfritak, står i kortet for sin form, som de andre.
    const [fritak] = sokGlobalt(indeks, 'kodimagnyl')
    const form = await formMed(KODEIN, fritak!.dokument.tekst)
    expect(sokeadresse(fritak!.dokument.sted)).toBe(`#/analytt/KOD/preparater/${preparatkort(form.id)}`)
  })

  it('finner en interaksjon og peker på kortet dens', () => {
    const [treff] = sokGlobalt(indeks, 'terbinafin')
    expect(sti(treff!.dokument.sted)).toEqual(['Amitriptylin', 'Interaksjoner', 'Terbinafin'])
    expect(sokeadresse(treff!.dokument.sted)).toMatch(/^#\/analytt\/AMTNORSUM\/interaksjoner\/interaksjon-ID_/)
  })

  it('peker på kortet i farmakokinetikken, og finner det med navnet på siden i søket', () => {
    const [treff] = sokGlobalt(indeks, 'amitriptylin metabolisme')
    expect(sti(treff!.dokument.sted)).toEqual(['Amitriptylin', 'Farmakokinetikk', 'Metabolisme'])
    expect(sokeadresse(treff!.dokument.sted)).toBe(`#/analytt/AMTNORSUM/farmakokinetikk/${ider.metabolisme}`)
    // Uten siden i søket finnes kortet fortsatt; med en annen side ikke.
    expect(sokGlobalt(indeks, 'metabolisme').map((t) => t.dokument.sted.side.kode)).toEqual(['AMTNORSUM'])
    expect(sokGlobalt(indeks, 'kodein metabolisme')).toEqual([])
    // En tekst i seksjonen, og ikke i et kort, peker på seksjonen.
    const [dosering] = sokGlobalt(indeks, 'doseringstekst')
    expect(sokeadresse(dosering!.dokument.sted)).toBe('#/analytt/AMTNORSUM/dosering')
  })

  it('rangerer navnet foran komponenten, og komponenten foran teksten', () => {
    const treff = sokGlobalt(indeks, 'nortriptylin')
    expect(treff.map((t) => [t.dokument.sted.side.kode, t.dokument.felt])).toEqual([
      ['NORT', 'navn'],
      ['AMTNORSUM', 'komponent'],
    ])
    // Siden står bare én gang, selv om navnet, koden og komponenten alle treffer.
    expect(sokGlobalt(indeks, 'amtnorsum')).toHaveLength(1)
  })

  it('gir det beste treffet én gang per sted', () => {
    const treff = sokGlobalt(indeks, 'syntetisk')
    const steder = treff.map((t) => stedsnokkel(t.dokument.sted))
    expect(new Set(steder).size).toBe(steder.length)
    expect(treff.length).toBeGreaterThan(1)
    expect(sokGlobalt(indeks, 'syntetisk', 1)).toHaveLength(1)
  })

  it('finner verken det fjernede eller det upubliserte', () => {
    expect(sokGlobalt(indeks, 'fjernettekst')).toEqual([])
    expect(sokGlobalt(indeks, 'upublisertmiddel')).toEqual([])
  })

  it('finner referansene sist', () => {
    const treff = sokGlobalt(indeks, 'lærebok')
    expect(treff.map((t) => t.dokument.felt)).toEqual(['referanse', 'referanse'])
  })
})

/* --- Rangeringen, uten database ------------------------------------------- */

function dok(felt: Sokefelt, tekst: string, kode = 'TEST', navn = 'Testmiddel'): Sokedokument {
  return { sted: { side: { kode, navn }, panel: { nokkel: felt, tittel: felt } }, felt, tekst }
}

describe('rangeringen', () => {
  it('følger planens rekkefølge av felt', () => {
    const rekkefolge: Sokefelt[] = ['referanse', 'fritekst', 'tabell', 'verdi', 'overskrift', 'preparat', 'komponent', 'alias', 'kode', 'navn']
    const dokumenter = rekkefolge.map((felt) => dok(felt, `ordet ${felt}`))
    expect(sok(dokumenter, 'ordet').map((t) => t.dokument.felt)).toEqual([
      'kode',
      'navn',
      'komponent',
      'alias',
      'preparat',
      'overskrift',
      'tabell',
      'verdi',
      'fritekst',
      'referanse',
    ])
  })

  it('setter teksten som begynner med søket, foran ordstart, foran treff inne i et ord', () => {
    const dokumenter = [dok('fritekst', 'Ekvetiapin'), dok('fritekst', 'Om kvetiapin'), dok('fritekst', 'Kvetiapin først')]
    expect(sok(dokumenter, 'kvetiapin').map((t) => t.dokument.tekst)).toEqual(['Kvetiapin først', 'Om kvetiapin', 'Ekvetiapin'])
  })

  it('ser bort fra aksenter og leser æ, ø og å som a, o og a', () => {
    expect(sok([dok('fritekst', 'Blodkonsentrasjon målt på sykehus')], 'MALT PA')).toHaveLength(1)
    expect(sok([dok('fritekst', 'Crème brûlée')], 'creme brulee')).toHaveLength(1)
  })

  it('krever på siden at alle ordene står i samme tekst', () => {
    const dokumenter = [dok('navn', 'Testmiddel'), dok('overskrift', 'Metabolisme')]
    expect(sok(dokumenter, 'testmiddel metabolisme')).toEqual([])
    const indeks = lagSokeindeks(dokumenter)
    expect(sokGlobalt(indeks, 'testmiddel metabolisme').map((t) => t.dokument.tekst)).toEqual(['Metabolisme'])
    // Utdraget fremhever bare det som står i teksten.
    expect(sokGlobalt(indeks, 'testmiddel metabolisme')[0]!.utdrag).toEqual({ tekst: 'Metabolisme', treff: [[0, 11]] })
  })

  it('indekserer en side flere koder deler, én gang', () => {
    const dokumenter = indekserKunnskapsbase({
      sider: [side('DELTA', 'Delt side'), side('DELTB', 'Delt side')],
      legemidler: null,
      interaksjoner: null,
    })
    expect(dokumenter.map((d) => [d.felt, d.tekst, d.sted.side.kode])).toEqual([
      ['navn', 'Delt side', 'DELTA'],
      ['kode', 'DELTA', 'DELTA'],
      ['kode', 'DELTB', 'DELTA'],
    ])
  })

  it('tar med aliasene til kodene, uten å gjenta navnet', () => {
    const aliaser: Record<string, string[]> = { RISPSUM: ['paliperidon', 'Risperidon'] }
    const dokumenter = indekserKunnskapsbase(
      { sider: [side('RISPSUM', 'Risperidon')], legemidler: null, interaksjoner: null },
      { aliaser: (kode) => aliaser[kode] },
    )
    expect(dokumenter.filter((d) => d.felt === 'alias').map((d) => d.tekst)).toEqual(['paliperidon'])
    const [treff] = sokGlobalt(lagSokeindeks(dokumenter), 'paliperidon')
    expect(treff!.dokument.sted.side.kode).toBe('RISPSUM')
  })
})

function utgave<T>(id: string, innhold: T) {
  return { id, revisjon: 1, publisert_revisjon: 1, innhold, endret_av_fornavn: '', endret_av_etternavn: '', endret_kl: '' }
}

/** En side slik `les_analyttsider` gir den, med en kobling til legemiddeldataene når `koblet` er gitt. */
function side(kode: string, navn: string, koblet: string[] = []): Analyttsidedata {
  const sideId = `side-${navn}`
  return {
    analytt: utgave(`analytt-${kode}`, { kode, hovedside: sideId, komponenter: [sideId] }),
    infoside: utgave(sideId, { navn }),
    elementer: koblet.length
      ? [
          utgave(`kobling-${kode}`, {
            infoside: sideId,
            panel: 'preparater',
            posisjon: 0,
            elementtype: 'legemiddelkobling',
            data: { virkestoff: koblet.map((fest_id) => ({ fest_id, navn: fest_id })) },
          }),
        ]
      : [],
    komponenter: [],
    referanser: [],
    regelsett: null,
    thcregelsett: null,
    scenarioregelsett: null,
  }
}
