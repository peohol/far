/**
 * Endringene beskrevet i vanlig språk, når den som gjorde dem ikke skrev noe
 * selv: «Dosering oppdatert», «Farmakodynamikk: to mekanismekort endret»,
 * «Sertralin flyttet fra kategorien SSRI til Antidepressiver».
 *
 * Beskrivelsen bygges av delene og hendelsene databasen gir for endringen
 * (`modell.ts`), med panelene og kortene slik appen ellers kaller dem.
 */
import { FJERNET, ELEMENTTYPER, PANELER, datakortFor, erKortserie, korttittel, panelFor } from '../faginnhold/paneler'
import { modulMedId } from '../domain/rus'
import type { Endring, Endringsdel, Hendelse } from './modell'

export type Handling = 'nytt' | 'endret' | 'fjernet' | 'rekkefolge' | 'kilder'

/** Det en del eller hendelse gjorde, i én seksjon av siden. */
export interface Endringslinje {
  /** Seksjonen den hører til, slik den heter på siden. */
  seksjon: string
  handling: Handling
  /** Det som ble endret, i ubestemt entall og flertall; uten enhet gjelder linjen hele seksjonen. */
  enhet?: Enhet
  /** Navnet på det som ble endret, når det har et: målet på et mekanismekort, tittelen på en referanse. */
  navn?: string
  /** Hele linjen, når den ikke kan settes sammen med andre (navn, flytting, kategorier). */
  tekst?: string
  /** For referansene på et kort eller en seksjon: hvor mange som er lagt til og fjernet. */
  kilder?: { lagtTil: number; fjernet: number }
}

export interface Enhet {
  entall: string
  flertall: string
  /** Ett kort, én referanse. */
  intetkjonn: boolean
}

const enhet = (entall: string, flertall = entall, intetkjonn = true): Enhet => ({ entall, flertall, intetkjonn })
const KORT = enhet('kort')
const ENHETER: Record<string, Enhet> = {
  [ELEMENTTYPER.mekanisme]: enhet('mekanismekort'),
  [ELEMENTTYPER.kinetikk]: KORT,
  [ELEMENTTYPER.riktekst]: KORT,
}
const REFERANSE = enhet('referanse', 'referanser', false)
const KOMMENTAR = enhet('fortolkningskommentar', 'fortolkningskommentarer', false)

/** Koblingene på et panel heter det de kobler til. */
const KOBLINGER: Record<string, string> = {
  [ELEMENTTYPER.legemiddelkobling]: 'Koblingen til legemiddeldataene',
  [ELEMENTTYPER.clinpgxkobling]: 'Koblingen til ClinPGx',
}

const TALLORD = ['null', 'ett', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti']

/** «ett kort», «én referanse», «to mekanismekort», «12 kort». */
export function antallAv(antall: number, e: Enhet): string {
  const tall = antall === 1 ? (e.intetkjonn ? 'ett' : 'én') : (TALLORD[antall] ?? String(antall))
  return `${tall} ${antall === 1 ? e.entall : e.flertall}`
}

const stor = (tekst: string) => tekst.charAt(0).toLocaleUpperCase('nb') + tekst.slice(1)
const tekst = (verdi: unknown): string => (typeof verdi === 'string' ? verdi.trim() : '')
const sitat = (verdi: unknown) => `«${tekst(verdi)}»`

const PARTISIPP: Record<Exclude<Handling, 'rekkefolge' | 'kilder'>, string> = {
  nytt: 'lagt til',
  endret: 'endret',
  fjernet: 'fjernet',
}

/* --- Delene ------------------------------------------------------------------ */

const seksjonsnavn = (panel: unknown) => panelFor(tekst(panel))?.tittel ?? 'Siden'

function elementlinjer(del: Endringsdel): Endringslinje[] {
  const fjernet = del.etter.panel === FJERNET
  const panel = fjernet ? del.for?.panel : del.etter.panel
  const seksjon = seksjonsnavn(panel)
  const elementtype = tekst(del.etter.elementtype)
  const data = (fjernet ? del.for?.data : del.etter.data) ?? {}
  const handling: Handling = fjernet ? 'fjernet' : del.fra === null || del.for?.panel === FJERNET ? 'nytt' : 'endret'

  const datakort = datakortFor(elementtype)
  const kobling = KOBLINGER[elementtype]
  const navngitt = (navn: string): Endringslinje => ({
    seksjon,
    handling,
    tekst: `${seksjon}: ${navn} ${handling === 'endret' ? 'oppdatert' : PARTISIPP[handling]}`,
  })

  if (handling === 'endret') {
    const bareRekkefolge = del.endret.length > 0 && del.endret.every((f) => f === 'posisjon')
    if (bareRekkefolge) return [{ seksjon, handling: 'rekkefolge' }]
    const bareKilder = del.dataEndret.length === 0 && del.endret.every((f) => f === 'referanser' || f === 'posisjon')
    if (bareKilder && del.referanser) {
      return [{ seksjon, handling: 'kilder', kilder: { lagtTil: del.referanser.lagt_til, fjernet: del.referanser.fjernet } }]
    }
  }
  if (datakort) return [navngitt(datakort.tittel)]
  if (kobling) return [navngitt(kobling.toLocaleLowerCase('nb'))]
  if (!erKortserie(panelFor(tekst(panel))?.form)) return [{ seksjon, handling }]
  const navn = korttittel(elementtype, data)
  return [{ seksjon, handling, enhet: ENHETER[elementtype] ?? KORT, ...(navn && { navn }) }]
}

function infosidelinjer(del: Endringsdel): Endringslinje[] {
  if (del.fra === null) return [{ seksjon: 'Siden', handling: 'nytt', tekst: 'Fagsiden opprettet' }]
  const linjer: Endringslinje[] = []
  if (del.endret.includes('navn')) {
    linjer.push({
      seksjon: 'Siden',
      handling: 'endret',
      tekst: `Navnet endret fra ${sitat(del.for?.navn)} til ${sitat(del.etter.navn)}`,
    })
  }
  for (const [panel, { lagt_til, fjernet }] of Object.entries(del.panelreferanser)) {
    if (lagt_til + fjernet > 0) linjer.push({ seksjon: seksjonsnavn(panel), handling: 'kilder', kilder: { lagtTil: lagt_til, fjernet } })
  }
  return linjer
}

function navngittLinje(seksjon: string, del: Endringsdel, e: Enhet, navn: string): Endringslinje {
  return { seksjon, handling: del.fra === null ? 'nytt' : 'endret', enhet: e, ...(navn && { navn }) }
}

/** Det én del gjorde, som linjer i én eller flere seksjoner. */
export function dellinjer(del: Endringsdel): Endringslinje[] {
  switch (del.type) {
    case 'innholdselement':
      return elementlinjer(del)
    case 'infoside':
      return infosidelinjer(del)
    case 'referanse': {
      if (del.etter.arkivert === true && del.for?.arkivert !== true) {
        return [{ seksjon: 'Referanser', handling: 'fjernet', tekst: `Referansen ${sitat(del.etter.tittel)} arkivert` }]
      }
      return [navngittLinje('Referanser', del, REFERANSE, tekst(del.etter.tittel))]
    }
    case 'kommentar':
      return [navngittLinje('Fortolkningskommentarer', del, KOMMENTAR, tekst(del.etter.navn))]
    case 'intervallregelsett':
    case 'scenarioregelsett':
    case 'thc_regelsett': {
      const seksjon = `Fortolkningsreglene for ${regelsettnavn(del)}`
      return [{ seksjon, handling: del.fra === null ? 'nytt' : 'endret', tekst: `${seksjon} ${del.fra === null ? 'lagt til' : 'oppdatert'}` }]
    }
    case 'laboratorieanalytt':
      return [{ seksjon: 'Analytten', handling: 'endret', tekst: `Analytten ${tekst(del.etter.kode)} oppdatert` }]
    default:
      return [{ seksjon: 'Siden', handling: 'endret' }]
  }
}

function regelsettnavn(del: Endringsdel): string {
  if (del.type === 'thc_regelsett') return 'THC-syre i urin'
  if (del.type === 'scenarioregelsett') return modulMedId(tekst(del.etter.modul))?.navn ?? tekst(del.etter.modul)
  return tekst(del.etter.analyttkode)
}

/** Hva en del gjelder, kort: «Farmakodynamikk › D2», «Referanse: Tittel». Til listen over delene. */
export function delnavn(del: Endringsdel): string {
  switch (del.type) {
    case 'innholdselement': {
      const fjernet = del.etter.panel === FJERNET
      const kilde = fjernet ? del.for : del.etter
      const elementtype = tekst(kilde?.elementtype)
      const navn =
        datakortFor(elementtype)?.tittel ??
        KOBLINGER[elementtype] ??
        korttittel(elementtype, kilde?.data ?? {})
      return [seksjonsnavn(kilde?.panel), navn].filter(Boolean).join(' › ')
    }
    case 'infoside':
      return `Fagsiden ${tekst(del.etter.navn)}`.trim()
    case 'referanse':
      return `Referanse: ${tekst(del.etter.tittel) || 'uten tittel'}`
    case 'kommentar':
      return `Kommentar: ${tekst(del.etter.navn) || 'uten navn'}`
    case 'intervallregelsett':
    case 'scenarioregelsett':
    case 'thc_regelsett':
      return `Fortolkningsreglene for ${regelsettnavn(del)}`
    case 'laboratorieanalytt':
      return `Analytten ${tekst(del.etter.kode)}`
    default:
      return del.type
  }
}

/* --- Hendelsene -------------------------------------------------------------- */

const kategori = (navn: unknown) => `kategorien ${sitat(navn)}`
const nivaa = (navn: unknown) => (tekst(navn) ? kategori(navn) : 'øverste nivå')

/** Det stoffregisteret og bivirkningsimportene gjorde, som linjer. Flytting av et stoff blir én linje. */
export function hendelseslinjer(hendelser: readonly Hendelse[]): Endringslinje[] {
  const linjer: Endringslinje[] = []
  const brukt = new Set<Hendelse>()
  const register = (t: string): Endringslinje => ({ seksjon: 'Stoffregisteret', handling: 'endret', tekst: t })
  for (const h of hendelser) {
    if (brukt.has(h)) continue
    const d = h.data
    const stoff = tekst(d.stoffnavn) || tekst(d.stoff)
    switch (h.hendelse) {
      case 'stoff_plassert':
      case 'stoff_tatt_ut': {
        const motsatt = hendelser.find(
          (a) =>
            !brukt.has(a) &&
            a !== h &&
            a.data.stoff === d.stoff &&
            a.hendelse === (h.hendelse === 'stoff_plassert' ? 'stoff_tatt_ut' : 'stoff_plassert'),
        )
        if (motsatt) {
          brukt.add(motsatt)
          const [fra, til] = h.hendelse === 'stoff_tatt_ut' ? [d, motsatt.data] : [motsatt.data, d]
          linjer.push(register(`${stoff} flyttet fra ${kategori(fra.kategorinavn)} til ${sitat(til.kategorinavn)}`))
        } else if (h.hendelse === 'stoff_plassert') {
          linjer.push(register(`${stoff} lagt i ${kategori(d.kategorinavn)}`))
        } else {
          linjer.push(register(`${stoff} tatt ut av ${kategori(d.kategorinavn)}`))
        }
        break
      }
      case 'stoff_arkivert':
        linjer.push(register(`${stoff} arkivert`))
        break
      case 'stoff_hentet_fra_arkivet':
        linjer.push(register(`${stoff} hentet fra arkivet`))
        break
      case 'stoff_slettet':
        linjer.push(register(`${stoff} lagt i papirkurven`))
        break
      case 'stoff_gjenopprettet':
        linjer.push(register(`${stoff} hentet tilbake fra papirkurven`))
        break
      case 'stoff_slettet_for_godt':
        linjer.push(register(`${stoff} slettet for godt`))
        break
      case 'kategori_opprettet':
        linjer.push(register(`${stor(kategori(d.navn))} opprettet${tekst(d.forelder) ? ` under ${sitat(d.forelder)}` : ''}`))
        break
      case 'kategori_slettet': {
        const stoffer = typeof d.stoffer === 'number' && d.stoffer > 0 ? ` (med ${antallAv(d.stoffer, enhet('stoff'))})` : ''
        linjer.push(register(`${stor(kategori(d.navn))} slettet${stoffer}`))
        break
      }
      case 'kategori_omdopt':
        linjer.push(register(`${stor(kategori(d.fra))} har fått navnet ${sitat(d.navn)}`))
        break
      case 'kategori_flyttet':
        linjer.push(register(`${stor(kategori(d.navn))} flyttet fra ${nivaa(d.fra)} til ${nivaa(d.til)}`))
        break
      case 'kategori_arkivert':
        linjer.push(register(`${stor(kategori(d.navn))} arkivert`))
        break
      case 'kategori_hentet':
        linjer.push(register(`${stor(kategori(d.navn))} hentet fra arkivet`))
        break
      case 'kategori_ikon':
        linjer.push(register(`${stor(kategori(d.navn))} har fått nytt ikon`))
        break
      case 'bivirkning_importert':
        linjer.push({
          seksjon: 'Bivirkninger',
          handling: d.erstatter === true ? 'endret' : 'nytt',
          tekst: `Bivirkninger ${d.erstatter === true ? 'oppdatert' : 'lagt inn'} fra ${sitat(d.tittel || d.preparat)}`,
        })
        break
      case 'bivirkning_trukket':
        linjer.push({ seksjon: 'Bivirkninger', handling: 'fjernet', tekst: `Bivirkningene fra ${sitat(d.tittel || d.preparat)} trukket tilbake` })
        break
      default:
        linjer.push({ seksjon: 'Siden', handling: 'endret', tekst: h.hendelse.replace(/_/g, ' ') })
    }
  }
  return linjer
}

/* --- Sammendraget ------------------------------------------------------------ */

/** Alle linjene i endringen, i den rekkefølgen seksjonene står på siden. */
export function endringslinjer(endring: Pick<Endring, 'deler' | 'hendelser'>): Endringslinje[] {
  const rekkefolge = new Map<string, number>(PANELER.map((p, i) => [p.tittel, i]))
  const plass = (l: Endringslinje) => (l.seksjon === 'Siden' ? -1 : (rekkefolge.get(l.seksjon) ?? PANELER.length))
  return [...endring.deler.flatMap(dellinjer), ...hendelseslinjer(endring.hendelser)]
    .map((linje, i) => ({ linje, i }))
    .sort((a, b) => plass(a.linje) - plass(b.linje) || a.i - b.i)
    .map(({ linje }) => linje)
}

function kildetekst({ lagtTil, fjernet }: { lagtTil: number; fjernet: number }): string {
  return [
    lagtTil > 0 && `${antallAv(lagtTil, REFERANSE)} lagt til`,
    fjernet > 0 && `${antallAv(fjernet, REFERANSE)} fjernet`,
  ]
    .filter(Boolean)
    .join(' og ')
}

/**
 * Linjene slått sammen per seksjon og handling: to endrede mekanismekort blir
 * «Farmakodynamikk: to mekanismekort endret», ett blir
 * «Farmakodynamikk: mekanismekortet «D2» endret».
 */
export function beskrivelser(linjer: readonly Endringslinje[]): string[] {
  const grupper = new Map<string, Endringslinje[]>()
  const ut: (string | Endringslinje[])[] = []
  for (const linje of linjer) {
    if (linje.tekst) {
      ut.push(linje.tekst)
      continue
    }
    const nokkel = `${linje.seksjon}\u0000${linje.handling}\u0000${linje.enhet?.entall ?? ''}`
    const gruppe = grupper.get(nokkel)
    if (gruppe) gruppe.push(linje)
    else {
      const ny = [linje]
      grupper.set(nokkel, ny)
      ut.push(ny)
    }
  }
  const sett = new Set<string>()
  return ut
    .map((del) => (typeof del === 'string' ? del : gruppetekst(del)))
    .filter((t) => (sett.has(t) ? false : (sett.add(t), true)))
}

function gruppetekst(gruppe: Endringslinje[]): string {
  const [forste] = gruppe as [Endringslinje]
  const { seksjon, handling, enhet: e } = forste
  if (handling === 'rekkefolge') return `${seksjon}: rekkefølgen endret`
  if (handling === 'kilder') {
    const sum = gruppe.reduce(
      (s, l) => ({ lagtTil: s.lagtTil + (l.kilder?.lagtTil ?? 0), fjernet: s.fjernet + (l.kilder?.fjernet ?? 0) }),
      { lagtTil: 0, fjernet: 0 },
    )
    return `${seksjon}: ${kildetekst(sum) || 'kildene endret'}`
  }
  if (!e) return `${seksjon} ${handling === 'endret' ? 'oppdatert' : PARTISIPP[handling]}`
  const navn = gruppe.length === 1 && forste.navn
  const hva = navn ? `${e.entall} ${sitat(navn)}` : antallAv(gruppe.length, e)
  return `${seksjon}: ${hva} ${PARTISIPP[handling]}`
}

/** Høyst så mange beskrivelser står i sammendraget; resten står i detaljene. */
const I_SAMMENDRAGET = 3

/** Endringen beskrevet på én linje, ut fra det som ble endret. */
export function autosammendrag(endring: Pick<Endring, 'deler' | 'hendelser'>): string {
  const alle = beskrivelser(endringslinjer(endring))
  if (alle.length === 0) return 'Ingen synlige endringer'
  const vist = alle.slice(0, I_SAMMENDRAGET).join(' · ')
  const resten = alle.length - I_SAMMENDRAGET
  return resten > 0 ? `${vist} · og ${resten} ${resten === 1 ? 'endring' : 'endringer'} til` : vist
}

/** Sammendraget loggen viser: det personen eller agenten skrev, ellers det som ble endret. */
export function sammendrag(endring: Pick<Endring, 'oppsummering' | 'deler' | 'hendelser'>): string {
  return endring.oppsummering ?? autosammendrag(endring)
}
