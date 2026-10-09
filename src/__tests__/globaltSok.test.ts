/**
 * Søket i hele kunnskapsbasen: lesingen av alle stoffsidene i én omgang,
 * prøvd mot en ekte database med migrasjonene og FEST-utdraget, og
 * rangeringen og stedene treffene peker på.
 *
 * Det viktigste som prøves, er at søket i kunnskapsbasen finner det samme som
 * søket på hver side — de samme tekstene, på de samme stedene — selv om alt
 * leses i tre kall i stedet for tre per side, og at hvert treff er et stoff:
 * kodene og navnene til laboratorieanalyttene stoffet er koblet til, er bare
 * andre veier til den samme stoffsiden (`#/stoff/<slug>`).
 *
 * Navnene på sidene er ekte virkestoff fordi FEST-utdraget og stoffregisteret
 * er ekte, men tekstene og tallene på sidene er syntetiske. Ingen kliniske
 * verdier inngår.
 */
import type { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { manglertekst, visTreff } from '../components/sok/treffvisning'
import type { Labsokedata } from '../farmakologiportalen/lesing'
import { alleLabkomponenter, labsted } from '../farmakologiportalen/stoffside'
import { FORBINDELSER } from '../kjemi/forbindelser'
import { analytterForStoff, stoffbeskrivelse } from '../domain/koblinger'
import { STOFFREGISTER, STOFFREGISTERDATA, byggStoffregister, stoffslug, type Registerdata } from '../domain/stoffregister'
import { GRUNNSTRUKTUR } from './hjelp/registerstruktur'
import { byggSidemodell, publiseringsplan } from '../faginnhold/stoffside'
import {
  indekserKunnskapsbase,
  lagSideleser,
  lagVersjonsleser,
  lesKunnskapsbase,
  lesSokeindeks,
  type Kunnskapsindeks,
  type Sideleser,
  type Sokekilder,
} from '../faginnhold/globaltSok'
import type { Mellomlager } from '../auth/mellomlager'
import { lagFaginnholdslager } from '../faginnhold/lagring'
import { lagFaginnholdsleser, type Faginnholdsleser, type Stoffsidedata } from '../faginnhold/lesing'
import { SITERING } from '../faginnhold/referanser'
import {
  indekserSide,
  lagSokeindeks,
  sok,
  sokeord,
  sokGlobalt,
  sokeadresse,
  stedsnokkel,
  sti,
  stoffidentitet,
  type Sokedokument,
  type Sokefelt,
  type Sokeindeks,
} from '../faginnhold/sok'
import { byggInteraksjoner, interaksjonsnokler } from '../legemiddeldata/interaksjoner'
import {
  lagLegemiddelleser,
  lagLegemiddelsok,
  MAKS_SOKESIDER,
  type Legemiddelleser,
  type Legemiddelsok,
} from '../legemiddeldata/lesing'
import { byggPreparatvisning } from '../legemiddeldata/preparatmodell'
import {
  interaksjonstekster,
  koblede,
  preparatformer,
  preparatkort,
  preparattekster,
} from '../legemiddeldata/stoffside'
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
let legemiddelsok: Legemiddelsok
const ider = { kilde: '', metabolisme: '', fjernet: '' }

/** Oppretter en stoffside med innholdet, og publiserer alt. Nøkkelen er den navnet gir. */
async function publisertSide(
  navn: string,
  elementer: { panel: string; elementtype: string; data: Record<string, unknown>; referanser?: string[] }[],
): Promise<Record<string, string>> {
  const lager = lagFaginnholdslager(kall.klientFor(admin))
  const side = (await lager.opprettUtkast('infoside', { navn })).id
  const laget: Record<string, string> = {}
  for (const [posisjon, e] of elementer.entries()) {
    laget[`${e.panel}:${posisjon}`] = (
      await lager.opprettUtkast('innholdselement', { infoside: side, posisjon, ...e })
    ).id
  }
  const leser = lagFaginnholdsleser(kall.klientFor(admin))
  for (const steg of publiseringsplan(await leser.lesStoffside(stoffslug(navn), 'utkast'))) {
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

  await publisertSide('Nortriptylin', [
    {
      panel: 'farmakodynamikk',
      elementtype: 'riktekst',
      data: { dokument: dokument(tekst('Syntetisk: hemmer reopptaket av noradrenalin.'), { type: SITERING, attrs: { referanser: [ider.kilde] } }) },
    },
  ])
  const amitriptylin = await publisertSide('Amitriptylin', [
    { panel: 'preparater', elementtype: 'legemiddelkobling', data: { virkestoff: [{ fest_id: AMITRIPTYLIN, navn: 'Amitriptylin' }] } },
    {
      panel: 'farmakokinetikk',
      elementtype: 'kinetikkort',
      data: { tittel: 'Metabolisme', dokument: dokument(tekst('Syntetisk: omdannes i leveren.')) },
      referanser: [ider.kilde],
    },
    { panel: 'dosering', elementtype: 'riktekst', data: { dokument: dokument(tekst('Syntetisk doseringstekst.')) } },
    { panel: 'fjernet', elementtype: 'riktekst', data: { dokument: dokument(tekst('Fjernettekst som ikke skal finnes.')) } },
  ])
  ider.metabolisme = amitriptylin['farmakokinetikk:1']!
  await publisertSide('Kodein', [
    { panel: 'preparater', elementtype: 'legemiddelkobling', data: { virkestoff: [{ fest_id: KODEIN, navn: 'Kodein' }] } },
  ])
  // En gammel komponentside for en metabolitt: nøkkelen er et alias for Bupropion i registeret.
  await publisertSide('Hydroksybupropion', [
    { panel: 'dosering', elementtype: 'riktekst', data: { dokument: dokument(tekst('Gammel komponenttekst.')) } },
  ])
  // En side som bare finnes som utkast.
  await lager.opprettUtkast('infoside', { navn: 'Upublisertmiddel' })

  brukerklient = kall.klientFor(bruker)
  sideleser = lagSideleser(brukerklient)
  faginnhold = lagFaginnholdsleser(brukerklient)
  legemidler = lagLegemiddelleser(brukerklient)
  legemiddelsok = lagLegemiddelsok(brukerklient)
}, 120_000)

/** Et mellomlager i minnet, som i nettleseren. */
function minnelager(): Mellomlager & { innhold: Map<string, unknown> } {
  const innhold = new Map<string, unknown>()
  return {
    innhold,
    les: async (nokkel) => structuredClone(innhold.get(nokkel)),
    skriv: async (nokkel, verdi) => void innhold.set(nokkel, structuredClone(verdi)),
  }
}

/** En klient som noterer hvilke funksjoner som kalles, og kan få noen av dem til å feile. */
function tellendeKlient(feiler: (funksjon: string) => boolean = () => false) {
  const kalt: string[] = []
  const klient = {
    rpc: async (funksjon: string, argumenter?: Record<string, unknown>) => {
      kalt.push(funksjon)
      if (feiler(funksjon)) return { data: null, error: { message: `${funksjon} svarer ikke` } }
      return brukerklient.rpc(funksjon, argumenter)
    },
  } as unknown as SupabaseClient
  return { kalt, klient }
}

/** Kildene appen leser fra, mot klienten. */
function kilderFor(klient: SupabaseClient, ekstra: Partial<Sokekilder> = {}): Sokekilder {
  return { sider: lagSideleser(klient), legemidler: lagLegemiddelsok(klient), versjoner: lagVersjonsleser(klient), ventetider: [], ...ekstra }
}

describe('les_stoffer', () => {
  it('gir hver stoffside på samme form som les_stoff', async () => {
    const sider = await sideleser.lesStoffsider('publisert')
    expect(sider.map((s) => s.stoff?.slug)).toEqual(['amitriptylin', 'hydroksybupropion', 'kodein', 'nortriptylin'])
    for (const side of sider) {
      expect(side.stoff).toMatchObject({ id: side.infoside!.id, navn: side.infoside!.innhold.navn })
      expect(side).toEqual(await faginnhold.lesStoffside(side.stoff!.slug, 'publisert'))
    }
  })

  it('gir en vanlig bruker bare det publiserte, og ingenting uten innlogging', async () => {
    expect(await sideleser.lesStoffsider('utkast')).toEqual([])
    const utkast = await lagSideleser(kall.klientFor(admin)).lesStoffsider('utkast')
    expect(utkast.map((s) => s.stoff?.slug)).toContain('upublisertmiddel')
    await expect(kall.rpc(null, 'les_stoffer', { sidetilstand: 'publisert' })).rejects.toThrow(/permission denied/)
  })
})

describe('lesingen av kunnskapsbasen', () => {
  it('leser alt i fire små kall, uansett hvor mange sider det er', async () => {
    const { kalt, klient } = tellendeKlient()
    const base = await lesKunnskapsbase(kilderFor(klient))
    // Sidene leses etter stoffet, aldri gjennom en analyttkode, og FEST bare med navnene søket trenger.
    expect(kalt).toEqual(['sokedata_versjoner', 'les_stoffer', 'les_preparatsok', 'les_interaksjonssok'])
    expect(base.sider).toHaveLength(4)
    expect(base.mangler).toBeUndefined()
  })

  it('finner stoffene i registeret også når databasen ikke har noen sider', async () => {
    const tom: Sideleser = { lesStoffsider: async () => [] }
    const base = await lesKunnskapsbase({ sider: tom })
    expect(base.sider).toEqual([])
    const [treff] = sokGlobalt(lagSokeindeks(indekserKunnskapsbase(base)), 'kvetiapin')
    expect(treff!.dokument).toMatchObject({ felt: 'navn', sted: { side: { stoff: 'kvetiapin', navn: 'Kvetiapin' } } })
    expect(sokeadresse(treff!.dokument.sted)).toBe('#/stoff/kvetiapin')
  })

  it('gir hver side de samme søkedokumentene som søket på siden selv', async () => {
    const base = await lesKunnskapsbase({ sider: sideleser, legemidler: legemiddelsok })
    const globale = indekserKunnskapsbase(base)

    for (const slug of ['amitriptylin', 'kodein', 'nortriptylin']) {
      // Slik siden selv gjør det (Stoffside.tsx): én side og legemidlene for koblingen den har.
      const data = await faginnhold.lesStoffside(slug, 'publisert')
      const modell = byggSidemodell(data)
      const koblet = koblede(modell)
      const tillegg = []
      if (koblet.length > 0) {
        const utvalg = await legemidler.les(koblet)
        const nokler = interaksjonsnokler(utvalg, koblet)
        tillegg.push(
          ...preparattekster(preparatformer(byggPreparatvisning(utvalg, koblet))),
          ...interaksjonstekster(byggInteraksjoner(await legemidler.interaksjoner(nokler), nokler).interaksjoner),
        )
      }
      const paSiden = indekserSide(stoffidentitet(STOFFREGISTER.finn(slug)!, analytterForStoff(slug)), modell, tillegg)
      expect(globale.filter((d) => d.sted.side.stoff === slug), slug).toEqual(paSiden)
    }
    // Kodeinsiden fikk ikke amitriptylinpreparatene, selv om alt ble lest sammen.
    expect(globale.filter((d) => d.sted.side.stoff === 'kodein' && d.felt === 'preparat').map((d) => d.tekst)).toEqual([
      'Kodimagnyl Ikke-stoppende dak',
    ])
  })

  it('indekserer alt det andre når en kilde ikke kan leses, og sier hvilken', async () => {
    const nede: Legemiddelsok = {
      preparater: async () => {
        throw new Error('Preparatene svarer ikke')
      },
      interaksjoner: legemiddelsok.interaksjoner,
    }
    const indeks = await lesSokeindeks({ sider: sideleser, legemidler: nede, ventetider: [] })
    expect(indeks.mangler).toEqual({ preparater: 'Preparatene svarer ikke' })
    expect(sokGlobalt(indeks, 'sarotex')).toEqual([])
    expect(sokGlobalt(indeks, 'terbinafin')).not.toEqual([])
    expect(sokGlobalt(indeks, 'doseringstekst')).toHaveLength(1)
  })

  it('finner registeret når sidene ikke kan leses, og sier fra', async () => {
    const nede: Sideleser = {
      lesStoffsider: async () => {
        throw new Error('Sidene svarer ikke')
      },
    }
    const indeks = await lesSokeindeks({ sider: nede, legemidler: legemiddelsok, ventetider: [] })
    expect(indeks.mangler).toEqual({ sider: 'Sidene svarer ikke' })
    expect(sokGlobalt(indeks, 'kvetiapin').map((t) => t.dokument.sted.side.stoff)).toEqual(['kvetiapin'])
  })

  it('prøver en kilde igjen før den gir opp', async () => {
    let forsok = 0
    const ustabil: Legemiddelsok = {
      ...legemiddelsok,
      preparater: async (sider) => {
        forsok += 1
        if (forsok < 3) throw new Error('Tidsavbrudd')
        return legemiddelsok.preparater(sider)
      },
    }
    const indeks = await lesSokeindeks({ sider: sideleser, legemidler: ustabil, ventetider: [0, 0] })
    expect(forsok).toBe(3)
    expect(indeks.mangler).toBeUndefined()
    expect(sokGlobalt(indeks, 'sarotex')).not.toEqual([])
  })

  it('gir indekser over det som er lest, før de andre kildene er der', async () => {
    const delvise: Kunnskapsindeks[] = []
    const indeks = await lesSokeindeks({ sider: sideleser, legemidler: legemiddelsok }, {}, (d) => delvise.push(d))
    // Registeret, sidene, og så preparatene og interaksjonene hver for seg.
    expect(delvise).toHaveLength(4)
    const [forst, sa] = delvise as [Kunnskapsindeks, Kunnskapsindeks]
    // Først bare stoffene i registeret, uten å vente på noe.
    expect(sokGlobalt(forst, 'kvetiapin').map((t) => t.dokument.sted.side.stoff)).toEqual(['kvetiapin'])
    expect(sokGlobalt(forst, 'doseringstekst')).toEqual([])
    // Så faginnholdet på sidene, men ikke preparatene.
    expect(sokGlobalt(sa, 'doseringstekst')).toHaveLength(1)
    expect(sokGlobalt(sa, 'sarotex')).toEqual([])
    // Til sist alt, med de samme treffene på sidene som før.
    expect(sokGlobalt(indeks, 'sarotex')).not.toEqual([])
    expect(sokGlobalt(indeks, 'doseringstekst')).toEqual(sokGlobalt(sa, 'doseringstekst'))
    expect(sokGlobalt(indeks, 'kvetiapin')).toEqual(sokGlobalt(forst, 'kvetiapin'))
  })

  it('leser søkedataene for mange sider i deler, med ett svar per side', async () => {
    const kall: number[] = []
    const klient = {
      rpc: async (_funksjon: string, { sider }: { sider: string[][] }) => {
        kall.push(sider.length)
        return { data: sider.map((s) => [[null, null, s[0]]]), error: null }
      },
    } as unknown as SupabaseClient
    const sider = Array.from({ length: MAKS_SOKESIDER + 20 }, (_, i) => [`V${i}`])
    const svar = await lagLegemiddelsok(klient).preparater(sider)
    expect(kall).toEqual([MAKS_SOKESIDER, 20])
    expect(svar.map((s) => s[0]![2])).toEqual(sider.map((s) => s[0]))
    // Et svar som ikke har én liste per side, er en feil, ikke tomme sider.
    const feil = { rpc: async () => ({ data: [], error: null }) } as unknown as SupabaseClient
    await expect(lagLegemiddelsok(feil).interaksjoner([['V1']])).rejects.toThrow(/uventet svar/)
  })
})

describe('mellomlagringen', () => {
  it('viser det lagrede med én gang, og leser bare versjonene når ingenting er endret', async () => {
    const lager = minnelager()
    const forste = tellendeKlient()
    const ny = await lesSokeindeks(kilderFor(forste.klient, { mellomlager: lager }))
    expect([...lager.innhold.keys()].sort()).toEqual(['sok:interaksjoner', 'sok:preparater', 'sok:sider'])

    const andre = tellendeKlient()
    const delvise: Kunnskapsindeks[] = []
    const lagret = await lesSokeindeks(kilderFor(andre.klient, { mellomlager: lager }), {}, (d) => delvise.push(d))
    expect(andre.kalt).toEqual(['sokedata_versjoner'])
    // Registeret, og så alt fra lageret i én omgang, før noe er spurt om.
    expect(delvise).toHaveLength(2)
    expect(sokGlobalt(delvise[1]!, 'sarotex')).toEqual(sokGlobalt(ny, 'sarotex'))
    expect(lagret.dokumenter).toEqual(ny.dokumenter)
  })

  it('leser på nytt bare kildene som er endret', async () => {
    const lager = minnelager()
    await lesSokeindeks(kilderFor(tellendeKlient().klient, { mellomlager: lager }))
    // En ny FEST-synkronisering gir en ny versjon for preparatene og interaksjonene.
    const { kalt, klient } = tellendeKlient()
    const versjoner = lagVersjonsleser(klient)
    await lesSokeindeks(
      kilderFor(klient, { mellomlager: lager, versjoner: async () => ({ ...(await versjoner()), fest: 'ny' }) }),
    )
    expect(kalt).toEqual(['sokedata_versjoner', 'les_preparatsok', 'les_interaksjonssok'])
  })

  it('bruker det lagrede når en kilde ikke kan leses, og leser alt når versjonene ikke kan leses', async () => {
    const lager = minnelager()
    const ny = await lesSokeindeks(kilderFor(tellendeKlient().klient, { mellomlager: lager }))
    const { kalt, klient } = tellendeKlient((f) => f !== 'les_stoffer')
    const indeks = await lesSokeindeks(kilderFor(klient, { mellomlager: lager }))
    expect(kalt).toEqual(['sokedata_versjoner', 'les_stoffer', 'les_preparatsok', 'les_interaksjonssok'])
    expect(indeks.mangler).toBeUndefined()
    expect(indeks.dokumenter).toEqual(ny.dokumenter)
  })

  it('bruker ikke det som er lagret for andre koblinger', async () => {
    const lager = minnelager()
    await lesSokeindeks(kilderFor(tellendeKlient().klient, { mellomlager: lager }))
    const bareAmitriptylin: Sideleser = {
      lesStoffsider: async (t) => (await sideleser.lesStoffsider(t)).filter((s) => s.stoff?.slug !== 'kodein'),
    }
    const { klient } = tellendeKlient((f) => f.startsWith('les_') && f !== 'les_stoffer')
    const indeks = await lesSokeindeks({ ...kilderFor(klient, { mellomlager: lager }), sider: bareAmitriptylin, versjoner: null })
    // Preparatene som var lagret, gjaldt også Kodein, og brukes ikke.
    expect(indeks.mangler).toEqual({ preparater: 'les_preparatsok svarer ikke', interaksjoner: 'les_interaksjonssok svarer ikke' })
  })
})

describe('laboratorieanalysene fra Farmakologiportalen', () => {
  const amitriptylin = FORBINDELSER.fpId(FORBINDELSER.forStoff('amitriptylin')[0]!)!
  // Syntetiske navn; bare formen er som i `les_laboratoriesok`.
  const sokedata: Labsokedata = {
    komponenter: [{ id: amitriptylin, data: { navn: 'Amitriptylin', gruppe: [] } }],
    analyser: [
      { id: 'syn1', data: { komponent_id: amitriptylin, laboratorium_id: 'l1', metode: 'Syntetisk kromatografi', status: 'Active', synlighet: null } },
      { id: 'syn2', data: { komponent_id: amitriptylin, laboratorium_id: 'l1', metode: 'Skjult metode', status: 'Active', synlighet: 'Hidden' } },
      { id: 'syn3', data: { komponent_id: amitriptylin, laboratorium_id: 'l2', metode: 'Nedlagt metode', status: 'Active', synlighet: null } },
    ],
    laboratorier: [
      { id: 'l1', data: { navn: 'Syntetisk laboratorium', institusjon_id: 'i1', institusjon: null } },
      { id: 'l2', data: { navn: 'Nedlagt laboratorium', institusjon_id: null, institusjon: null, aktiv: false } },
    ],
    institusjoner: [{ id: 'i1', data: { navn: 'Syntetisk helseforetak' } }],
  }

  it('finner laboratoriet, institusjonen og metoden på fagsiden, og bare det seksjonen viser', async () => {
    const les = vi.fn(async () => sokedata)
    const indeks = await lesSokeindeks({ sider: sideleser, laboratorier: { les }, ventetider: [] })
    expect(les).toHaveBeenCalledOnce()
    expect(les).toHaveBeenCalledWith(alleLabkomponenter())
    expect(indeks.mangler).toBeUndefined()
    for (const ord of ['syntetisk laboratorium', 'syntetisk helseforetak', 'syntetisk kromatografi']) {
      const treff = sokGlobalt(indeks, ord)
      expect(treff.map((t) => sti(t.dokument.sted)), ord).toEqual([['Amitriptylin', 'Analyse ved norske laboratorier', 'Amitriptylin · Syntetisk laboratorium']])
      // Som søket på siden: lenken åpner seksjonen, og stedet har raden.
      expect(sokeadresse(treff[0]!.dokument.sted)).toBe('#/stoff/amitriptylin/laboratorieanalyser')
      expect(treff[0]!.dokument.sted.element?.id).toBe(labsted('syn1'))
    }
    expect(sokGlobalt(indeks, 'skjult metode')).toEqual([])
    expect(sokGlobalt(indeks, 'nedlagt')).toEqual([])
  })

  it('indekserer resten og sier fra når analysene ikke kan leses', async () => {
    const nede = { les: async () => Promise.reject(new Error('Analysene svarer ikke')) }
    const indeks = await lesSokeindeks({ sider: sideleser, legemidler: legemiddelsok, laboratorier: nede, ventetider: [] })
    expect(indeks.mangler).toEqual({ laboratorier: 'Analysene svarer ikke' })
    expect(manglertekst(indeks.mangler)).toBe('Søket mangler nå laboratorieanalysene fra Farmakologiportalen, som ikke kunne hentes.')
    expect(sokGlobalt(indeks, 'sarotex')).not.toEqual([])
  })

  it('leser analysene på nytt bare når versjonen er endret', async () => {
    const lager = minnelager()
    const les = vi.fn(async () => sokedata)
    const kilder = (versjon: string): Sokekilder => ({
      sider: sideleser,
      laboratorier: { les },
      versjoner: async () => ({ sider: 's', laboratorier: versjon }),
      mellomlager: lager,
      ventetider: [],
    })
    await lesSokeindeks(kilder('1'))
    const igjen = await lesSokeindeks(kilder('1'))
    expect(les).toHaveBeenCalledOnce()
    expect(sokGlobalt(igjen, 'syntetisk laboratorium')).toHaveLength(1)
    await lesSokeindeks(kilder('2'))
    expect(les).toHaveBeenCalledTimes(2)
  })
})

describe('søket i kunnskapsbasen', () => {
  let indeks: Awaited<ReturnType<typeof lesSokeindeks>>
  beforeAll(async () => {
    indeks = await lesSokeindeks({ sider: sideleser, legemidler: legemiddelsok })
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
    expect(sokeadresse(treff!.dokument.sted)).toBe(`#/stoff/amitriptylin/preparater/${preparatkort(tablett.id)}`)
    // Et preparat som krever godkjenningsfritak, står i kortet for sin form, som de andre.
    const [fritak] = sokGlobalt(indeks, 'kodimagnyl')
    const form = await formMed(KODEIN, fritak!.dokument.tekst)
    expect(sokeadresse(fritak!.dokument.sted)).toBe(`#/stoff/kodein/preparater/${preparatkort(form.id)}`)
  })

  it('finner en interaksjon og peker på kortet dens', () => {
    const [treff] = sokGlobalt(indeks, 'terbinafin')
    expect(sti(treff!.dokument.sted)).toEqual(['Amitriptylin', 'Interaksjoner', 'Terbinafin'])
    expect(sokeadresse(treff!.dokument.sted)).toMatch(/^#\/stoff\/amitriptylin\/interaksjoner\/interaksjon-ID_/)
  })

  it('peker på kortet i farmakokinetikken, og finner det med navnet på siden i søket', () => {
    const [treff] = sokGlobalt(indeks, 'amitriptylin metabolisme')
    expect(sti(treff!.dokument.sted)).toEqual(['Amitriptylin', 'Farmakokinetikk', 'Metabolisme'])
    expect(sokeadresse(treff!.dokument.sted)).toBe(`#/stoff/amitriptylin/farmakokinetikk/${ider.metabolisme}`)
    // Uten siden i søket finnes kortet fortsatt; med en annen side ikke.
    expect(sokGlobalt(indeks, 'metabolisme').map((t) => t.dokument.sted.side.stoff)).toEqual(['amitriptylin'])
    expect(sokGlobalt(indeks, 'kodein metabolisme')).toEqual([])
    // Koden til analytten stoffet er primært stoff for, er også navnet på siden.
    expect(sokGlobalt(indeks, 'amtnorsum metabolisme').map((t) => sokeadresse(t.dokument.sted))).toEqual([
      `#/stoff/amitriptylin/farmakokinetikk/${ider.metabolisme}`,
    ])
    // En tekst i seksjonen, og ikke i et kort, peker på seksjonen.
    const [dosering] = sokGlobalt(indeks, 'doseringstekst')
    expect(sokeadresse(dosering!.dokument.sted)).toBe('#/stoff/amitriptylin/dosering')
  })

  it('rangerer navnet foran analyttens komponent, og komponenten foran teksten', () => {
    const treff = sokGlobalt(indeks, 'nortriptylin')
    expect(treff.map((t) => [t.dokument.sted.side.stoff, t.dokument.felt])).toEqual([
      ['nortriptylin', 'navn'],
      ['amitriptylin', 'komponent'],
    ])
    // Stoffet står bare én gang, selv om navnet, koden og komponenten alle treffer.
    expect(sokGlobalt(indeks, 'amitriptylin').filter((t) => !t.dokument.sted.panel).map((t) => t.dokument.sted.side.stoff)).toEqual([
      'amitriptylin',
      'nortriptylin',
    ])
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

  it('indekserer ikke en side med et alias som nøkkel som et eget stoff', () => {
    // Teksten på den gamle komponentsiden hører ikke til noe stoff.
    expect(sokGlobalt(indeks, 'komponenttekst')).toEqual([])
    const treff = sokGlobalt(indeks, 'hydroksybupropion')
    expect(treff.map((t) => sokeadresse(t.dokument.sted))).toEqual(['#/stoff/bupropion'])
    expect(indeks.dokumenter.some((d) => d.sted.side.stoff === 'hydroksybupropion')).toBe(false)
  })

  it('finner referansene sist', () => {
    const treff = sokGlobalt(indeks, 'lærebok')
    expect(treff.map((t) => t.dokument.felt)).toEqual(['referanse', 'referanse'])
  })
})

/* --- Fagsøkets akseptansekrav, mot hele stoffregisteret --------------------- */

describe('hvert treff er et stoff, og analytten er sekundær kontekst', () => {
  /** Registeret med kategoriene, som i appen når inndelingen er hentet. */
  const MED_INNDELING = byggStoffregister([], STOFFREGISTERDATA, GRUNNSTRUKTUR)
  let indeks: Sokeindeks
  beforeAll(() => {
    // Som i databasen før migrasjonen: en gammel komponentside ved siden av stoffsiden.
    const sider = [
      side('bupropion', 'Bupropion', { tekst: 'Syntetisk tekst om bupropion.' }),
      side('hydroksybupropion', 'Hydroksybupropion', { tekst: 'Syntetisk tekst på den gamle komponentsiden.' }),
    ]
    indeks = lagSokeindeks(
      indekserKunnskapsbase({ sider }),
    )
  })

  /** Det øverste treffet og hvordan det vises, med linja under fra `stoffbeskrivelse`. */
  function forste(sporring: string) {
    const [treff] = sokGlobalt(indeks, sporring)
    expect(treff, sporring).toBeDefined()
    return { treff: treff!, visning: visTreff(treff!, sokeord(sporring), (stoff) => stoffbeskrivelse(stoff, MED_INNDELING)) }
  }

  it.each(['bupropion', 'hydroksybupropion', 'HBUP'])('«%s» gir stoffet Bupropion på #/stoff/bupropion', (sporring) => {
    const { treff, visning } = forste(sporring)
    expect(treff.dokument.sted.side).toEqual({ stoff: 'bupropion', navn: 'Bupropion' })
    expect(visning.adresse).toBe('#/stoff/bupropion')
    expect(visning.tittel.tekst).toBe('Bupropion')
    expect(visning.sti).toEqual(['Antidepressiver › NDRI · analytt HBUP · hydroksybupropion (kun aktiv metabolitt)'])
    expect(visning.sti[0]).toContain('analytt HBUP · hydroksybupropion (kun aktiv metabolitt)')

    for (const t of sokGlobalt(indeks, sporring)) {
      const vist = visTreff(t, sokeord(sporring), (stoff) => stoffbeskrivelse(stoff, MED_INNDELING))
      expect(vist.tittel.tekst).not.toBe('Hydroksybupropion')
      expect(vist.adresse).not.toMatch(/HBUP/i)
      expect(vist.adresse).not.toMatch(/hydroksybupropion/i)
      expect(t.dokument.sted.side.stoff).toBe('bupropion')
    }
  })

  it('viser et annet navn stoffet ble funnet under, som utdrag under navnet', () => {
    const { treff, visning } = forste('hydroksybupropion')
    expect(treff.dokument.felt).toBe('alias')
    expect(visning.utdrag?.tekst).toMatch(/^Hydroksybupropion/)
    // Koden er selve stoffets vei inn, og gjentas ikke under navnet.
    expect(forste('HBUP').treff.dokument.felt).toBe('kode')
    expect(forste('HBUP').visning.utdrag).toBeUndefined()
  })

  it('gir Amitriptylin først for AMTNORSUM, og Nortriptylin etter som sekundær kobling', () => {
    const treff = sokGlobalt(indeks, 'AMTNORSUM')
    expect(treff.map((t) => [t.dokument.sted.side.stoff, t.dokument.felt])).toEqual([
      ['amitriptylin', 'kode'],
      ['nortriptylin', 'komponent'],
    ])
    expect(treff.map((t) => sokeadresse(t.dokument.sted))).toEqual(['#/stoff/amitriptylin', '#/stoff/nortriptylin'])
  })

  it.each([
    ['NOR', 'nortriptylin', 'Nortriptylin'],
    ['DMI', 'diazepam', 'Diazepam'],
    ['N-desmetyldiazepam', 'diazepam', 'Diazepam'],
    ['OTRAM', 'tramadol', 'Tramadol'],
    ['IRCAK', 'thc', 'THC'],
    ['THC-syre', 'thc', 'THC'],
    ['UETS', 'etanol', 'Etanol'],
    ['EtG', 'etanol', 'Etanol'],
  ])('«%s» gir stoffet %s, aldri koden', (sporring, stoff, navn) => {
    const { treff, visning } = forste(sporring)
    expect(treff.dokument.sted.side).toEqual({ stoff, navn })
    expect(visning.adresse).toBe(`#/stoff/${stoff}`)
    expect(visning.tittel.tekst).toBe(navn)
    // Identiteten er stoffet: ingen treff har koden eller analyttens navn som nøkkel.
    for (const t of sokGlobalt(indeks, sporring)) {
      expect(t.dokument.sted.side.stoff).not.toBe(sporring)
      expect(t.dokument.sted.side.stoff).not.toBe(stoffslug(sporring))
    }
  })

  it('finner et stoff i registeret som ikke har noen side, på navnet', () => {
    const { treff, visning } = forste('kvetiapin')
    expect(treff.dokument).toMatchObject({ felt: 'navn', sted: { side: { stoff: 'kvetiapin', navn: 'Kvetiapin' } } })
    expect(visning.adresse).toBe('#/stoff/kvetiapin')
    expect(visning.sti).toEqual([stoffbeskrivelse('kvetiapin', MED_INNDELING)])
  })

  it('indekserer innholdet på stoffsiden, men ikke på siden med et alias som nøkkel', () => {
    expect(sokGlobalt(indeks, 'syntetisk').map((t) => t.dokument.sted.side.stoff)).toEqual(['bupropion'])
    expect(sokGlobalt(indeks, 'komponentsiden')).toEqual([])
    expect(indeks.dokumenter.filter((d) => d.felt === 'navn' && d.tekst === 'Hydroksybupropion')).toEqual([])
  })
})

/* --- Rangeringen, uten database ------------------------------------------- */

function dok(felt: Sokefelt, tekst: string, stoff = 'testmiddel', navn = 'Testmiddel'): Sokedokument {
  return { sted: { side: { stoff, navn }, panel: { nokkel: felt, tittel: felt } }, felt, tekst }
}

/** Et lite stoffregister med de ekte analyttkodene, så dokumentene kan listes fullt ut. */
function register(
  stoffer: Registerdata['stoffer'],
  analyttkoblinger: Registerdata['analyttkoblinger'] = [],
): Registerdata {
  return { stoffer, analyttkoblinger }
}

const utenTillegg = (sider: Stoffsidedata[]) => ({ sider })

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

  it('indekserer et stoff med flere analytter én gang, med kodene som andre veier inn', () => {
    const dokumenter = indekserKunnskapsbase(utenTillegg([side('diazepam', 'Diazepam')]), {
      registerdata: register(
        [{ slug: 'diazepam', navn: 'Diazepam' }],
        [
          { kode: 'DIAZ', stoff: 'diazepam', relasjon: 'selve_stoffet' },
          { kode: 'DMI', stoff: 'diazepam', relasjon: 'metabolitt' },
        ],
      ),
    })
    expect(dokumenter.map((d) => [d.felt, d.tekst, d.sted.side.stoff])).toEqual([
      ['navn', 'Diazepam', 'diazepam'],
      ['kode', 'DIAZ', 'diazepam'],
      ['kode', 'DMI', 'diazepam'],
      ['komponent', 'N-desmetyldiazepam', 'diazepam'],
    ])
  })

  it('gir en analytt som gjelder flere stoffer, det primære stoffet som kode og de andre som komponent', () => {
    const dokumenter = indekserKunnskapsbase(utenTillegg([]), {
      registerdata: register(
        [
          { slug: 'amitriptylin', navn: 'Amitriptylin' },
          { slug: 'nortriptylin', navn: 'Nortriptylin' },
        ],
        [
          { kode: 'AMTNORSUM', stoff: 'amitriptylin', relasjon: 'sumanalyse' },
          { kode: 'AMTNORSUM', stoff: 'nortriptylin', relasjon: 'sumanalyse', primar: false },
          { kode: 'NOR', stoff: 'nortriptylin', relasjon: 'selve_stoffet' },
        ],
      ),
    })
    expect(dokumenter.map((d) => [d.felt, d.tekst, d.sted.side.stoff])).toEqual([
      ['navn', 'Amitriptylin', 'amitriptylin'],
      ['kode', 'AMTNORSUM', 'amitriptylin'],
      ['komponent', 'Amitriptylin + nortriptylin', 'amitriptylin'],
      ['komponent', 'Nortriptylin', 'amitriptylin'],
      ['navn', 'Nortriptylin', 'nortriptylin'],
      ['kode', 'NOR', 'nortriptylin'],
      ['komponent', 'Amitriptylin + nortriptylin', 'nortriptylin'],
      ['komponent', 'Amitriptylin', 'nortriptylin'],
      ['komponent', 'AMTNORSUM', 'nortriptylin'],
    ])
  })

  it('finner stoffene i registeret som ennå ikke har noen side', () => {
    const dokumenter = indekserKunnskapsbase(utenTillegg([side('diazepam', 'Diazepam')]), {
      registerdata: register(
        [
          { slug: 'diazepam', navn: 'Diazepam' },
          { slug: 'kvetiapin', navn: 'Kvetiapin', aliaser: ['Norkvetiapin'] },
        ],
        [
          { kode: 'DIAZ', stoff: 'diazepam', relasjon: 'selve_stoffet' },
          { kode: 'KVE', stoff: 'kvetiapin', relasjon: 'selve_stoffet' },
        ],
      ),
    })
    expect(dokumenter.map((d) => [d.felt, d.tekst, d.sted.side.stoff])).toEqual([
      ['navn', 'Diazepam', 'diazepam'],
      ['kode', 'DIAZ', 'diazepam'],
      ['navn', 'Kvetiapin', 'kvetiapin'],
      ['kode', 'KVE', 'kvetiapin'],
      ['alias', 'Norkvetiapin', 'kvetiapin'],
    ])
    const indeks = lagSokeindeks(dokumenter)
    const [treff] = sokGlobalt(indeks, 'kvetiapin')
    expect(treff!.dokument).toMatchObject({ felt: 'navn', sted: { side: { stoff: 'kvetiapin', navn: 'Kvetiapin' } } })
    expect(sokeadresse(treff!.dokument.sted)).toBe('#/stoff/kvetiapin')
    // Aliaset fører til det samme stoffet.
    expect(sokGlobalt(indeks, 'norkvetiapin').map((t) => sokeadresse(t.dokument.sted))).toEqual(['#/stoff/kvetiapin'])
  })

  it('indekserer ikke en side med et alias som nøkkel som et eget stoff', () => {
    const dokumenter = indekserKunnskapsbase(
      utenTillegg([
        side('bupropion', 'Bupropion'),
        side('hydroksybupropion', 'Hydroksybupropion', { tekst: 'Gammel komponenttekst.' }),
      ]),
      {
        registerdata: register(
          [{ slug: 'bupropion', navn: 'Bupropion', aliaser: ['Hydroksybupropion'] }],
          [{ kode: 'HBUP', stoff: 'bupropion', relasjon: 'metabolitt' }],
        ),
      },
    )
    expect(dokumenter.map((d) => [d.felt, d.tekst, d.sted.side.stoff])).toEqual([
      ['navn', 'Bupropion', 'bupropion'],
      ['kode', 'HBUP', 'bupropion'],
      ['alias', 'Hydroksybupropion', 'bupropion'],
      ['komponent', 'Hydroksybupropion (kun aktiv metabolitt)', 'bupropion'],
    ])
  })

  it('indekserer en side registeret ikke kjenner, som et eget stoff', () => {
    const dokumenter = indekserKunnskapsbase(utenTillegg([side('nytt-stoff', 'Nytt stoff', { tekst: 'Syntetisk tekst.' })]), {
      registerdata: register([]),
    })
    expect(dokumenter.map((d) => [d.felt, d.tekst, d.sted.side.stoff])).toEqual([
      ['navn', 'Nytt stoff', 'nytt-stoff'],
      ['fritekst', 'Syntetisk tekst.', 'nytt-stoff'],
    ])
    expect(sokeadresse(dokumenter[1]!.sted)).toBe('#/stoff/nytt-stoff/dosering')
  })
})

function utgave<T>(id: string, innhold: T) {
  return { id, revisjon: 1, publisert_revisjon: 1, innhold, endret_av_fornavn: '', endret_av_etternavn: '', endret_kl: '' }
}

/**
 * En stoffside slik `les_stoffer` gir den, med en kobling til
 * legemiddeldataene når `koblet` er gitt og en tekst i doseringen når `tekst`
 * er det.
 */
function side(slug: string, navn: string, { koblet = [], tekst: t }: { koblet?: string[]; tekst?: string } = {}): Stoffsidedata {
  const sideId = `side-${slug}`
  return {
    stoff: { id: sideId, slug, navn },
    infoside: utgave(sideId, { navn }),
    elementer: [
      ...(koblet.length
        ? [
            utgave(`kobling-${slug}`, {
              infoside: sideId,
              panel: 'preparater',
              posisjon: 0,
              elementtype: 'legemiddelkobling',
              data: { virkestoff: koblet.map((fest_id) => ({ fest_id, navn: fest_id })) },
            }),
          ]
        : []),
      ...(t
        ? [
            utgave(`tekst-${slug}`, {
              infoside: sideId,
              panel: 'dosering',
              posisjon: 1,
              elementtype: 'riktekst',
              data: { dokument: dokument(tekst(t)) },
            }),
          ]
        : []),
    ],
    referanser: [],
  }
}
