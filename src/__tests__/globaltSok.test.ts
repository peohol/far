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
import { beforeAll, describe, expect, it } from 'vitest'
import { visTreff } from '../components/sok/treffvisning'
import { analytterForStoff, stoffbeskrivelse } from '../domain/koblinger'
import { STOFFREGISTER, STOFFREGISTERDATA, byggStoffregister, stoffslug, type Registerdata } from '../domain/stoffregister'
import { GRUNNSTRUKTUR } from './hjelp/registerstruktur'
import { byggSidemodell, publiseringsplan } from '../faginnhold/stoffside'
import {
  MAKS_INTERAKSJONSNOKLER,
  indekserKunnskapsbase,
  lagSideleser,
  lesKunnskapsbase,
  lesSokeindeks,
  type Sideleser,
} from '../faginnhold/globaltSok'
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
}, 120_000)

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
  it('leser alt i tre kall, uansett hvor mange sider det er', async () => {
    const kalt: string[] = []
    const tellende = {
      rpc: (funksjon: string, argumenter: Record<string, unknown>) => {
        kalt.push(funksjon)
        return brukerklient.rpc(funksjon, argumenter)
      },
    } as unknown as SupabaseClient
    const base = await lesKunnskapsbase(lagSideleser(tellende), lagLegemiddelleser(tellende))
    // Sidene leses etter stoffet, aldri gjennom en analyttkode.
    expect(kalt).toEqual(['les_stoffer', 'les_legemidler', 'les_interaksjoner'])
    expect(base.sider).toHaveLength(4)
    expect(base.festfeil).toBeUndefined()
  })

  it('finner stoffene i registeret også når databasen ikke har noen sider', async () => {
    const tom: Sideleser = { lesStoffsider: async () => [] }
    const base = await lesKunnskapsbase(tom, null)
    expect(base.sider).toEqual([])
    const [treff] = sokGlobalt(lagSokeindeks(indekserKunnskapsbase(base)), 'kvetiapin')
    expect(treff!.dokument).toMatchObject({ felt: 'navn', sted: { side: { stoff: 'kvetiapin', navn: 'Kvetiapin' } } })
    expect(sokeadresse(treff!.dokument.sted)).toBe('#/stoff/kvetiapin')
  })

  it('gir hver side de samme søkedokumentene som søket på siden selv', async () => {
    const base = await lesKunnskapsbase(sideleser, legemidler)
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
          ...preparattekster(byggPreparatvisning(utvalg, koblet)),
          ...interaksjonstekster(byggInteraksjoner(await legemidler.interaksjoner(nokler), nokler)),
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

  it('gir indekser over det som er lest, før legemiddeldataene er der', async () => {
    const delvise: Awaited<ReturnType<typeof lesSokeindeks>>[] = []
    const indeks = await lesSokeindeks(sideleser, legemidler, {}, (d) => delvise.push(d))
    expect(delvise).toHaveLength(2)
    const [forst, sa] = delvise as [(typeof delvise)[0], (typeof delvise)[0]]
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

  it('deler interaksjonsoppslaget i flere kall når nøklene er flere enn databasen tar imot', async () => {
    const antall = MAKS_INTERAKSJONSNOKLER + 20
    const sider = Array.from({ length: antall }, (_, i) => side(`side-${i}`, `Side ${i}`, { koblet: [`V${i}`] }))
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
    const base = await lesKunnskapsbase({ lesStoffsider: async () => sider }, mange)
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
      indekserKunnskapsbase({ sider, legemidler: null, interaksjoner: null }),
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

const utenTillegg = (sider: Stoffsidedata[]) => ({ sider, legemidler: null, interaksjoner: null })

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
