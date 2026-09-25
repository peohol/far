/**
 * Import av faginnhold fra en kilde, som en kontrollert datamigrering.
 *
 * Innholdet ligger først i et importdatasett — én JSON-fil per analyttkode,
 * skrevet så tett på kilden at hvert tall kan kontrolleres mot den — og gjøres
 * her om til objektene databasen lagrer: referanser, informasjonssider,
 * laboratorieanalytter og innholdselementer. Datasettet kontrolleres først, og
 * alt som ikke har formen appen leser, stopper importen.
 *
 * Selve innleggingen er SQL som går gjennom de samme funksjonene appen bruker
 * (`opprett_utkast`, `publiser_utkast`), som administratoren som har bestilt
 * importen. Hver revisjon får kilden sin (`far.revisjonskilde`), så historikken
 * viser «Importert fra Psykofarmaka.pdf, side 7». Én blokk per analyttkode, som
 * hver lykkes eller feiler for seg; en kode som alt har en side, hoppes over,
 * så importen kan kjøres igjen etter et avbrudd.
 *
 * Alt her er rene funksjoner. Bakgrunnen står i docs/faginnhold.md.
 */
import type { Analyttkatalog } from '../domain/analyttkatalog'
import type { Referanseinnhold } from './modell'
import {
  DATAKORT,
  ELEMENTTYPER,
  kontrollerIntervall,
  lesDosetabell,
  lesIntervallverdi,
  lesKinetikk,
  type Doserad,
  type Intervallverdi,
} from './paneler'
import { PROSJEKTMERKNAD, persentilmerknad, persentiltekst } from './serumtabell'
import { MERKER, NODER, rensDokument, type Riktekstdokument, type Riktekstnode } from './riktekst'

/* --- Datasettet ----------------------------------------------------------- */

/**
 * Et tekststykke: et avsnitt, eller en punktliste. I teksten kan `_{x}` stå
 * for senket skrift, `^{x}` for hevet og `[tekst](https://…)` for en lenke.
 */
export type Tekstblokk = string | { punkter: string[] }

export interface Importtekst {
  tekst: Tekstblokk[]
  /** Nøklene til kildene for hele kortet. */
  referanser?: string[]
}

/** Et datakort. Forbeholdet kan utelates når kilden ikke har noe. */
export type Importverdi = Omit<Intervallverdi, 'forbehold'> & { forbehold?: string; referanser?: string[] }

export interface Importkinetikk extends Importtekst {
  tittel: string
}

/**
 * En tabell over serumkonsentrasjoner ved ulike doser, slik kilden har den:
 * én kolonne per dose, med antall prøver, 10-persentil, median og
 * 90-persentil. `null` der kilden ikke har noe tall.
 */
export interface Persentiltabell {
  stoff: string
  kilde: string
  enhet: string
  doser: string[]
  antall: (number | null)[]
  p10: (number | null)[]
  median: (number | null)[]
  p90: (number | null)[]
}

/** 10- og 90-persentilen fra referanseområdeprosjektet ved Diakonhjemmet og St. Olavs. */
export interface Referanseomradeprosjekt {
  doser: string
  enhet: string
  p10: number
  p90: number
}

export interface Importserum {
  tabeller?: Persentiltabell[]
  referanseomradeprosjektet?: Referanseomradeprosjekt
  rader?: Doserad[]
  referanser?: string[]
}

/** Innholdet for én analyttkode, fra én eller flere sider i kilden. */
export interface Importfil {
  kode: string
  sider: number[]
  /**
   * Hvor innholdet er hentet fra, slik historikken skal vise det, når det er
   * noe annet enn dokumentet importen gjelder (se {@link Importkilde}): f.eks.
   * «Tidsskriftartikkel.pdf, side 1–2, og Rapport.pdf, side 36». Står det,
   * brukes det i stedet for dokumentet og sidene.
   */
  kilde?: string
  viktige_data?: Record<string, Importverdi>
  farmakodynamikk?: Importtekst
  dosering?: Importtekst
  indikasjon?: Importtekst
  farmakokinetikk?: Importkinetikk[]
  /** Kortene i seksjonen om terapeutisk legemiddelmonitorering, i rekkefølge. */
  tdm?: Importkinetikk[]
  serumkonsentrasjoner?: Importserum
  /** Referansene filen bruker, utenom de felles. Nøkkel → referanse. */
  referanser?: Record<string, Referanseinnhold>
}

/** Hvor innholdet kommer fra, slik historikken skal vise det. */
export interface Importkilde {
  /** Dokumentet innholdet er hentet fra, f.eks. «Psykofarmaka.pdf». */
  dokument: string
  /**
   * Datoen indikasjonene ble hentet fra Felleskatalogen, som «2026-09-23».
   * Står i kilden til revisjonene deres.
   */
  felleskatalogen: string
}

/** Filen med referansene flere filer i et datasett deler. */
const FELLESFIL = 'felles.json'

/** Et datasett: filene for hver analyttkode, sortert på koden, og de felles referansene. */
export interface Datasett {
  filer: Importfil[]
  referanser: Record<string, Referanseinnhold>
}

/**
 * Datasettet i en mappe, lest med `import.meta.glob` (filsti → innhold):
 * én fil per analyttkode, og `felles.json` med referansene de deler.
 */
export function datasett(filer: Readonly<Record<string, unknown>>): Datasett {
  const felles = Object.entries(filer).find(([sti]) => sti.endsWith(`/${FELLESFIL}`))?.[1] as
    | { referanser?: Record<string, Referanseinnhold> }
    | undefined
  return {
    filer: Object.entries(filer)
      .filter(([sti]) => !sti.endsWith(`/${FELLESFIL}`))
      .map(([, fil]) => fil as Importfil)
      .sort((a, b) => a.kode.localeCompare(b.kode)),
    referanser: felles?.referanser ?? {},
  }
}

/* --- Planen --------------------------------------------------------------- */

/** Et objekt som skal inn, med kilden revisjonen skal vise. */
interface Planlagt {
  kilde: string
}

export interface Planreferanse extends Planlagt {
  nokkel: string
  innhold: Referanseinnhold
}

export interface Planside extends Planlagt {
  navn: string
}

export interface Planelement extends Planlagt {
  panel: string
  posisjon: number
  elementtype: string
  data: Record<string, unknown>
  /** Nøklene til referansene, i rekkefølge. */
  referanser: string[]
}

/** Alt for én analyttkode: siden, komponentene og innholdet. */
export interface Plankode {
  kode: string
  hovedside: Planside
  /** Stoffene analysen omfatter, i rekkefølge. Hovedsiden kan være ett av dem. */
  komponenter: Planside[]
  kilde: string
  elementer: Planelement[]
}

export interface Importplan {
  referanser: Planreferanse[]
  koder: Plankode[]
}

/** Alle feilene i datasettet, så de kan rettes på én gang. */
export class Importfeil extends Error {
  constructor(readonly feil: string[]) {
    super(`Importdatasettet har ${feil.length} feil:\n${feil.map((f) => `- ${f}`).join('\n')}`)
    this.name = 'Importfeil'
  }
}

/* --- Rikteksten ----------------------------------------------------------- */

const INLINE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|_\{([^}]*)\}|\^\{([^}]*)\}/g

function tekstnode(text: string, marks?: Riktekstnode['marks']): Riktekstnode {
  return { type: NODER.tekst, text, ...(marks && { marks }) }
}

/** Tekstnodene i ett avsnitt, med merkene fra den enkle markeringen. */
function inline(tekst: string): Riktekstnode[] {
  const noder: Riktekstnode[] = []
  let forrige = 0
  for (const treff of tekst.matchAll(INLINE)) {
    if (treff.index > forrige) noder.push(tekstnode(tekst.slice(forrige, treff.index)))
    const [, lenketekst, href, senket, hevet] = treff
    if (lenketekst !== undefined) noder.push(tekstnode(lenketekst, [{ type: MERKER.lenke, attrs: { href } }]))
    else if (senket !== undefined) noder.push(tekstnode(senket, [{ type: MERKER.senket }]))
    else if (hevet !== undefined) noder.push(tekstnode(hevet, [{ type: MERKER.hevet }]))
    forrige = treff.index + treff[0].length
  }
  if (forrige < tekst.length) noder.push(tekstnode(tekst.slice(forrige)))
  return noder.filter((n) => n.text !== '')
}

function avsnitt(tekst: string): Riktekstnode {
  return { type: NODER.avsnitt, content: inline(tekst) }
}

/** Tekststykkene som et riktekstdokument. */
export function tilDokument(blokker: readonly Tekstblokk[]): Riktekstdokument {
  return {
    type: 'doc',
    content: blokker.map((blokk) =>
      typeof blokk === 'string'
        ? avsnitt(blokk)
        : {
            type: NODER.punktliste,
            content: blokk.punkter.map((punkt) => ({ type: NODER.listepunkt, content: [avsnitt(punkt)] })),
          },
    ),
  }
}

/* --- Tabellen over serumkonsentrasjoner ----------------------------------- */

/** Radene i tabellen: persentiltabellene kolonne for kolonne, så resten som i kilden. */
export function doserader(serum: Importserum): Doserad[] {
  const rader: Doserad[] = []
  for (const tabell of serum.tabeller ?? []) {
    tabell.doser.forEach((dose, i) => {
      const konsentrasjon = persentiltekst(tabell.median[i] ?? null, tabell.p10[i] ?? null, tabell.p90[i] ?? null, tabell.enhet)
      if (!konsentrasjon) return
      const merknad = persentilmerknad(tabell.stoff, tabell.antall[i] ?? null, tabell.kilde)
      rader.push({ dose, regime: '', konsentrasjon, merknad })
    })
  }
  const prosjekt = serum.referanseomradeprosjektet
  if (prosjekt) {
    rader.push({
      dose: prosjekt.doser,
      regime: '',
      konsentrasjon: persentiltekst(null, prosjekt.p10, prosjekt.p90, prosjekt.enhet),
      merknad: PROSJEKTMERKNAD,
    })
  }
  return [...rader, ...(serum.rader ?? [])]
}

/* --- Farmakokinetikken ---------------------------------------------------- */

/**
 * Overskriftene kilden skriver med senket skrift, slik de står på kortene.
 * Overskriften er ren tekst, så symbolene står med Unicode.
 */
const KINETIKKTITLER: Record<string, string> = {
  tmax: 'tₘₐₓ',
  't1/2': 't½',
  tss: 'tₛₛ',
  VD: 'Vd',
}

export function kinetikktittel(tittel: string): string {
  return KINETIKKTITLER[tittel.trim()] ?? tittel.trim()
}

/* --- Kontrollen og planen ------------------------------------------------- */

const FILFELT = new Set([
  'kode',
  'sider',
  'kilde',
  'viktige_data',
  'farmakodynamikk',
  'dosering',
  'indikasjon',
  'farmakokinetikk',
  'tdm',
  'serumkonsentrasjoner',
  'referanser',
])
const TEKSTPANELER = ['farmakodynamikk', 'dosering', 'indikasjon'] as const
/** Panelene med en ordnet serie kort med overskrift og tekst. */
const KORTPANELER = ['farmakokinetikk', 'tdm'] as const
const DATAKORTTYPER = new Set<string>(DATAKORT.map((k) => k.type))
/** Panelene som er hentet fra Felleskatalogen, ikke fra PDF-en. */
const FELLESKATALOGPANELER = new Set<string>(['indikasjon'])

/** Verdien med nøklene sortert, så to like objekter sammenlignes likt uansett rekkefølge. */
function kanonisk(verdi: unknown): unknown {
  if (Array.isArray(verdi)) return verdi.map(kanonisk)
  if (verdi === null || typeof verdi !== 'object') return verdi
  return Object.fromEntries(
    Object.entries(verdi)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => [k, kanonisk(v)]),
  )
}

function erLik(a: unknown, b: unknown): boolean {
  return JSON.stringify(kanonisk(a)) === JSON.stringify(kanonisk(b))
}

/** «side 7», «side 8–9», «side 24, 26». */
export function sidetekst(sider: readonly number[]): string {
  const sortert = [...new Set(sider)].sort((a, b) => a - b)
  const sammenhengende = sortert.every((s, i) => i === 0 || s === sortert[i - 1]! + 1)
  const liste = sortert.length > 1 && sammenhengende ? `${sortert[0]}–${sortert.at(-1)}` : sortert.join(', ')
  return `side ${liste}`
}

function norskDato(iso: string): string {
  const [aar, maned, dag] = iso.split('-')
  return `${dag}.${maned}.${aar}`
}

/**
 * Planen for importen: hva som skal opprettes, i hvilken rekkefølge, og med
 * hvilken kilde. Kaster {@link Importfeil} med alle feilene i datasettet.
 */
export function byggImportplan(
  filer: readonly Importfil[],
  felles: Readonly<Record<string, Referanseinnhold>>,
  katalog: Analyttkatalog,
  kilde: Importkilde,
): Importplan {
  const feil: string[] = []
  const referanser = new Map<string, Planreferanse>()
  const pdfkilde = `Importert fra ${kilde.dokument}`
  const fkkilde = `Hentet fra Felleskatalogen ${norskDato(kilde.felleskatalogen)}`

  const leggTilReferanse = (nokkel: string, innhold: Referanseinnhold, hvor: string, fra: string) => {
    const kjent = referanser.get(nokkel)
    if (kjent) {
      if (!erLik(kjent.innhold, innhold)) feil.push(`${hvor}: referansen «${nokkel}» er definert ulikt flere steder.`)
      return
    }
    if (!innhold.tittel && !innhold.forfattere && !innhold.lenke) feil.push(`${hvor}: referansen «${nokkel}» er tom.`)
    if (innhold.lenke && !/^https?:\/\/\S+$/i.test(innhold.lenke)) {
      feil.push(`${hvor}: lenken i «${nokkel}» er ikke en nettadresse.`)
    }
    referanser.set(nokkel, { nokkel, innhold, kilde: fra })
  }
  for (const [nokkel, innhold] of Object.entries(felles)) leggTilReferanse(nokkel, innhold, 'felles', pdfkilde)

  const koder: Plankode[] = []
  const brukteKoder = new Set<string>()
  const sorterte = [...filer].sort((a, b) => a.kode.localeCompare(b.kode))

  for (const fil of sorterte) {
    const hvor = fil.kode || '(uten kode)'
    const oppforing = katalog.finn(fil.kode)
    if (!oppforing || oppforing.kode !== fil.kode) {
      feil.push(`${hvor}: koden finnes ikke i katalogen.`)
      continue
    }
    if (brukteKoder.has(fil.kode)) feil.push(`${hvor}: koden står i flere filer.`)
    brukteKoder.add(fil.kode)
    for (const felt of Object.keys(fil)) if (!FILFELT.has(felt)) feil.push(`${hvor}: ukjent felt «${felt}».`)
    if (!Array.isArray(fil.sider) || fil.sider.length === 0 || !fil.sider.every((s) => Number.isInteger(s) && s > 0)) {
      feil.push(`${hvor}: «sider» må være en liste med sidetall.`)
    }
    if (fil.kilde !== undefined && (typeof fil.kilde !== 'string' || fil.kilde.trim() === '')) {
      feil.push(`${hvor}: «kilde» må være en tekst.`)
    }

    const fraKilden = fil.kilde ? `Importert fra ${fil.kilde.trim()}` : `${pdfkilde}, ${sidetekst(fil.sider ?? [])}`
    const egne = fil.referanser ?? {}
    for (const [nokkel, innhold] of Object.entries(egne)) {
      leggTilReferanse(nokkel, innhold, hvor, nokkel.startsWith('fk-') ? fkkilde : fraKilden)
    }
    const kjente = (nokler: readonly string[] | undefined, hvorIFil: string): string[] => {
      const liste = nokler ?? []
      for (const nokkel of liste) {
        if (!referanser.has(nokkel)) feil.push(`${hvor} ${hvorIFil}: referansen «${nokkel}» er ikke definert.`)
      }
      if (new Set(liste).size !== liste.length) feil.push(`${hvor} ${hvorIFil}: samme referanse står to ganger.`)
      return [...liste]
    }

    const elementer: Planelement[] = []
    const element = (
      panel: string,
      elementtype: string,
      data: Record<string, unknown>,
      nokler: readonly string[] | undefined,
      posisjon = 0,
    ) => {
      elementer.push({
        panel,
        posisjon,
        elementtype,
        data,
        referanser: kjente(nokler, `${panel}/${elementtype}`),
        kilde: FELLESKATALOGPANELER.has(panel) ? fkkilde : fraKilden,
      })
    }

    const tekst = (blokker: readonly Tekstblokk[] | undefined, hvorIFil: string): Riktekstdokument | null => {
      const gyldig =
        Array.isArray(blokker) &&
        blokker.length > 0 &&
        blokker.every((b) =>
          typeof b === 'string'
            ? b.trim() !== ''
            : Array.isArray(b?.punkter) && b.punkter.length > 0 && b.punkter.every((p: unknown) => typeof p === 'string' && p.trim() !== ''),
        )
      if (!gyldig) {
        feil.push(`${hvor} ${hvorIFil}: teksten må være en liste med avsnitt eller punktlister.`)
        return null
      }
      const dokument = tilDokument(blokker)
      if (!erLik(rensDokument(dokument), dokument)) feil.push(`${hvor} ${hvorIFil}: teksten har formatering appen ikke viser.`)
      return dokument
    }

    // Panel 2: datakortene.
    for (const [type, verdi] of Object.entries(fil.viktige_data ?? {})) {
      if (!DATAKORTTYPER.has(type)) {
        feil.push(`${hvor} viktige_data: ukjent kort «${type}».`)
        continue
      }
      const { referanser: nokler, ...rest } = verdi
      const data = { ...rest, forbehold: rest.forbehold ?? '' }
      const lest = lesIntervallverdi(data)
      const problem = kontrollerIntervall(lest)
      if (problem) feil.push(`${hvor} ${type}: ${problem}`)
      if (!erLik(lest, data)) feil.push(`${hvor} ${type}: verdien må ha nøyaktig nedre, ovre (tall eller null), enhet og forbehold.`)
      if (lest.nedre === null && lest.ovre === null) feil.push(`${hvor} ${type}: kortet har ingen verdi.`)
      element('viktige_data', type, { ...lest }, nokler)
    }

    // Panel 3–5: rikteksten.
    for (const panel of TEKSTPANELER) {
      const innhold = fil[panel]
      if (!innhold) continue
      const dokument = tekst(innhold.tekst, panel)
      if (!dokument) continue
      element(panel, ELEMENTTYPER.riktekst, { dokument }, innhold.referanser)
    }

    // Farmakokinetikken og TDM: kort for kort.
    for (const panel of KORTPANELER) {
      const titler = new Set<string>()
      ;(fil[panel] ?? []).forEach((kort, posisjon) => {
        const tittel = kinetikktittel(kort.tittel ?? '')
        if (!tittel) feil.push(`${hvor} ${panel} ${posisjon + 1}: kortet mangler overskrift.`)
        if (titler.has(tittel)) feil.push(`${hvor} ${panel}/${tittel}: to kort har samme overskrift.`)
        titler.add(tittel)
        const dokument = tekst(kort.tekst, `${panel}/${tittel}`)
        if (!dokument) return
        const data = { tittel, dokument }
        if (!erLik(lesKinetikk(data), data)) feil.push(`${hvor} ${panel}/${tittel}: kortet leses ikke tilbake likt.`)
        element(panel, ELEMENTTYPER.kinetikk, data, kort.referanser, posisjon)
      })
    }

    // Panel 7: serumkonsentrasjonene.
    if (fil.serumkonsentrasjoner) {
      const serum = fil.serumkonsentrasjoner
      for (const tabell of serum.tabeller ?? []) {
        const n = tabell.doser?.length ?? 0
        const kolonner = [tabell.antall, tabell.p10, tabell.median, tabell.p90]
        if (n === 0 || kolonner.some((k) => !Array.isArray(k) || k.length !== n)) {
          feil.push(`${hvor} serumkonsentrasjoner «${tabell.stoff}»: kolonnene må ha like mange verdier som dosene.`)
          continue
        }
        if (kolonner.flat().some((v) => v !== null && (typeof v !== 'number' || !Number.isFinite(v)))) {
          feil.push(`${hvor} serumkonsentrasjoner «${tabell.stoff}»: verdiene må være tall eller null.`)
        }
        if (!tabell.stoff || !tabell.kilde || !tabell.enhet) {
          feil.push(`${hvor} serumkonsentrasjoner: en tabell mangler stoff, kilde eller enhet.`)
        }
      }
      const rader = doserader(serum)
      const data = { rader }
      if (rader.length === 0) feil.push(`${hvor} serumkonsentrasjoner: tabellen er tom.`)
      if (!erLik(lesDosetabell(data), data)) feil.push(`${hvor} serumkonsentrasjoner: radene leses ikke tilbake likt.`)
      element('serumkonsentrasjoner', ELEMENTTYPER.dosetabell, data, serum.referanser)
    }

    const side = (navn: string): Planside => ({ navn, kilde: fraKilden })
    koder.push({
      kode: fil.kode,
      hovedside: side(oppforing.sidenavn),
      komponenter: oppforing.komponenter.map(side),
      kilde: fraKilden,
      elementer,
    })
  }

  // Bare referansene som faktisk brukes, i den rekkefølgen de ble definert.
  const brukt = new Set(koder.flatMap((k) => k.elementer.flatMap((e) => e.referanser)))
  if (feil.length > 0) throw new Importfeil(feil)
  return { referanser: [...referanser.values()].filter((r) => brukt.has(r.nokkel)), koder }
}

/* --- SQL-en --------------------------------------------------------------- */

/** Så mange tegn står det høyst på hver linje i en lang literal. */
const LITERALBREDDE = 400

/** Tegn som ikke synes, og som derfor kan byttes ut uten at noen ser det. */
const USYNLIGE_TEGN = /[\u00a0\u00ad\u1680\u2000-\u200f\u2028-\u202f\u205f-\u2064\u3000\ufeff]/

/**
 * En tekst som SQL-literal. Lange tekster deles over flere linjer, som
 * Postgres setter sammen igjen (literaler skilt av linjeskift er én literal),
 * slik at SQL-en kan leses og limes inn uten kilometerlange linjer. Har
 * teksten usynlige tegn (som hardt mellomrom), blir den en Unicode-literal
 * der de står som escape (`U&'1\00A0026'`), slik at de ikke kan bli til noe
 * annet på veien inn i databasen.
 */
export function lit(tekst: string): string {
  const unicode = USYNLIGE_TEGN.test(tekst)
  const tegn = [...tekst].map((t) => {
    if (t === "'") return "''"
    if (!unicode) return t
    if (t === '\\') return '\\\\'
    return USYNLIGE_TEGN.test(t) ? `\\${t.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}` : t
  })
  const linjer: string[] = []
  for (let i = 0; i < tegn.length; i += LITERALBREDDE) linjer.push(`'${tegn.slice(i, i + LITERALBREDDE).join('')}'`)
  return `${unicode ? 'U&' : ''}${(linjer.length > 0 ? linjer : ["''"]).join('\n    ')}`
}

function jsonLit(verdi: unknown): string {
  return `${lit(JSON.stringify(verdi))}::jsonb`
}

/** Setter kilden de neste revisjonene får. */
function kildeSql(kilde: string): string {
  return `  perform set_config('far.revisjonskilde', ${lit(kilde)}, true);`
}

/** Den publiserte referansen med denne tittelen og lenken. */
function finnReferanse(innhold: Referanseinnhold): string {
  return `(select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = ${lit(innhold.tittel.trim())} and r.lenke = ${lit(innhold.lenke.trim())}
     order by r.objekt_id limit 1)`
}

/**
 * Hva en blokk gjør når administratoren ikke finnes: stopper med en feil
 * (SQL-en kjøres for hånd), eller hopper over uten å gjøre noe (SQL-en ligger
 * i en migrasjon, som også kjøres i testdatabasen og i nye grener).
 */
export type UtenAdministrator = 'feil' | 'hopp over'

/** Starten på hver blokk: administratoren som gjør importen, som innlogget. */
function innlogging(admin: string, utenAdministrator: UtenAdministrator): string {
  const mangler =
    utenAdministrator === 'feil'
      ? `    raise exception 'Fant ingen administrator med brukernavnet %.', ${lit(admin)};`
      : `    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', ${lit(admin)};\n    return;`
  return `  select p.id into administrator from public.profiles p where p.username = ${lit(admin)} and p.role = 'admin';
  if administrator is null then
${mangler}
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);`
}

function blokk(navn: string, deklarasjoner: string, admin: string, utenAdministrator: UtenAdministrator, kropp: string[]): string {
  return `-- ${navn}
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
${deklarasjoner}
begin
${innlogging(admin, utenAdministrator)}
${kropp.join('\n')}

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;`
}

/** Oppretter referansen om den ikke alt er publisert, og husker ID-en. */
function referanseSql(ref: Planreferanse): string[] {
  return [
    `  objekt := ${finnReferanse(ref.innhold)};`,
    `  if objekt is null then`,
    `  ${kildeSql(ref.kilde)}`,
    `    objekt := (public.opprett_utkast('referanse', ${jsonLit(ref.innhold)})).id;`,
    `    nye := nye || objekt;`,
    `  end if;`,
  ]
}

/** Så mange referanser legges inn i hver blokk, så ingen blokk blir for stor. */
const REFERANSER_PER_BLOKK = 25

/**
 * Hva en blokk gjør med en kode som alt har en side:
 *
 * - `hopp over` — lar den stå urørt. Slik kan en import kjøres igjen etter et
 *   avbrudd uten å legge noe inn to ganger.
 * - `utvid` — legger til det siden ikke har fra før, og lar alt den har stå.
 *   Et kort står fra før når siden har et kort av samme type i samme panel,
 *   med samme overskrift. Et datakort som står fra før, får kildene i
 *   datasettet lagt til bare når verdien er nøyaktig den datasettet har; er
 *   den en annen, røres det ikke, så en verdi aldri endres i stillhet. Da
 *   sier blokken fra (`raise notice`). Et kort med et upublisert utkast røres
 *   heller ikke, siden publiseringen ellers ville tatt utkastet med seg.
 */
export type FinnesFraFor = 'hopp over' | 'utvid'

/** Kilden i historikken når kildene legges til på et kort som står fra før. */
export function kildetilleggskilde(kilde: string): string {
  return `Kilde lagt til: ${kilde.replace(/^Importert fra /, '')}`
}

/**
 * SQL-en for importen: blokker for referansene, så én per analyttkode. Hver
 * blokk er én transaksjon. `admin` er brukernavnet til administratoren
 * revisjonene føres på.
 */
export function importSql(
  plan: Importplan,
  admin: string,
  utenAdministrator: UtenAdministrator = 'feil',
  finnesFraFor: FinnesFraFor = 'hopp over',
): string[] {
  const utvid = finnesFraFor === 'utvid'
  const referansegrupper = Array.from({ length: Math.ceil(plan.referanser.length / REFERANSER_PER_BLOKK) }, (_, i) =>
    plan.referanser.slice(i * REFERANSER_PER_BLOKK, (i + 1) * REFERANSER_PER_BLOKK),
  )
  const referanseblokker = referansegrupper.map((gruppe, i) =>
    blokk(
      referansegrupper.length > 1 ? `Referansene (${i + 1} av ${referansegrupper.length})` : 'Referansene',
      '',
      admin,
      utenAdministrator,
      gruppe.flatMap((ref) => [`  -- ${ref.nokkel}`, ...referanseSql(ref)]),
    ),
  )

  const kodeblokker = plan.koder.map((kode) => {
    const sider = [kode.hovedside, ...kode.komponenter].filter(
      (s, i, alle) => alle.findIndex((a) => a.navn.toLocaleLowerCase('nb') === s.navn.toLocaleLowerCase('nb')) === i,
    )
    const sidevariabel = (navn: string) => `side_${sider.findIndex((s) => s.navn.toLocaleLowerCase('nb') === navn.toLocaleLowerCase('nb'))}`
    const hovedside = sidevariabel(kode.hovedside.navn)
    const refnokler = [...new Set(kode.elementer.flatMap((e) => e.referanser))]
    const refvariabel = (nokkel: string) => `referanse_${refnokler.indexOf(nokkel)}`
    const referanseinnhold = new Map(plan.referanser.map((r) => [r.nokkel, r.innhold]))

    const deklarasjoner = [
      ...sider.map((_, i) => `  side_${i} uuid;`),
      ...refnokler.map((_, i) => `  referanse_${i} uuid;`),
      ...(utvid
        ? ['  kort uuid;', '  revisjon integer;', '  publisert boolean;', '  innhold jsonb;', '  kilder jsonb;']
        : []),
    ].join('\n')

    const nySide: string[] = [
      '  -- Sidene: en side med samme navn som alt finnes, brukes.',
      ...sider.flatMap((s, i) => [
        `  select s.objekt_id into side_${i} from public.infosider s`,
        `    where s.tilstand = 'utkast' and lower(s.navn) = lower(${lit(s.navn)});`,
        `  if side_${i} is null then`,
        `  ${kildeSql(s.kilde)}`,
        `    side_${i} := (public.opprett_utkast('infoside', ${jsonLit({ navn: s.navn })})).id;`,
        `    nye := nye || side_${i};`,
        `  end if;`,
      ]),
      '',
      kildeSql(kode.kilde),
      `  objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(`,
      `    'kode', ${lit(kode.kode)},`,
      `    'hovedside', ${hovedside},`,
      `    'komponenter', jsonb_build_array(${(kode.komponenter.length > 0 ? kode.komponenter : [kode.hovedside]).map((k) => sidevariabel(k.navn)).join(', ')})`,
      `  ))).id;`,
      `  nye := nye || objekt;`,
    ]

    const kropp: string[] = [
      ...(utvid
        ? [
            '  -- Siden koden har fra før, eller en ny.',
            `  select a.hovedside_id into ${hovedside} from public.laboratorieanalytter a`,
            `    where a.kode = ${lit(kode.kode)} and a.tilstand = 'utkast';`,
            '',
          ]
        : [
            `  if exists (select 1 from public.laboratorieanalytter a where a.kode = ${lit(kode.kode)}) then`,
            `    raise notice '${kode.kode} har alt en side og hoppes over.';`,
            `    return;`,
            `  end if;`,
            '',
          ]),
      '  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.',
      ...refnokler.flatMap((nokkel) => {
        const innhold = referanseinnhold.get(nokkel)!
        return [
          `  ${refvariabel(nokkel)} := ${finnReferanse(innhold)};`,
          `  if ${refvariabel(nokkel)} is null then`,
          `    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', ${lit(nokkel)};`,
          `  end if;`,
        ]
      }),
      '',
      ...(utvid
        ? [
            `  if ${hovedside} is null then`,
            ...nySide.map((l) => (l ? `  ${l}` : l)),
            '  end if;',
            // Kilden settes også når siden fantes: innstillingen gjelder hele transaksjonen.
            kildeSql(kode.kilde),
          ]
        : nySide),
    ]

    let forrigeKilde = kode.kilde
    for (const e of kode.elementer) {
      kropp.push('', `  -- ${e.panel}/${e.elementtype}${typeof e.data.tittel === 'string' ? ` «${e.data.tittel}»` : ''}`)
      if (e.kilde !== forrigeKilde) kropp.push(kildeSql(e.kilde))
      forrigeKilde = e.kilde
      const felt = [
        `'infoside', ${hovedside}`,
        `'panel', ${lit(e.panel)}`,
        `'posisjon', ${e.posisjon}`,
        `'elementtype', ${lit(e.elementtype)}`,
        `'data', ${jsonLit(e.data)}`,
        ...(e.referanser.length > 0 ? [`'referanser', jsonb_build_array(${e.referanser.map(refvariabel).join(', ')})`] : []),
      ]
      const opprett = [
        `  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(`,
        `    ${felt.join(',\n    ')}`,
        `  ))).id;`,
        `  nye := nye || objekt;`,
      ]
      if (!utvid) {
        kropp.push(...opprett)
        continue
      }

      // Kortet siden har fra før: av samme type i samme panel, med samme overskrift.
      const tittel = typeof e.data.tittel === 'string' ? lit(e.data.tittel) : 'null'
      kropp.push(
        `  kort := null;`,
        `  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold`,
        `    from public.innholdselementer e`,
        `    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'`,
        `    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'`,
        `    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon`,
        `    where e.tilstand = 'utkast' and e.infoside_id = ${hovedside} and e.panel = ${lit(e.panel)}`,
        `      and e.elementtype = ${lit(e.elementtype)} and (e.data ->> 'tittel') is not distinct from ${tittel}`,
        `    order by e.posisjon, e.objekt_id limit 1;`,
        `  if kort is null then`,
        ...opprett.map((l) => `  ${l}`),
      )
      if (e.panel === 'viktige_data' && e.referanser.length > 0) {
        // Kildene legges til på et datakort med nøyaktig samme verdi.
        const sammeVerdi = (['nedre', 'ovre'] as const)
          .map((felt) => `coalesce(innhold -> 'data' -> '${felt}', 'null') = ${jsonLit(e.data[felt] ?? null)}`)
          .concat(`coalesce(innhold -> 'data' ->> 'enhet', '') = ${lit(String(e.data.enhet ?? ''))}`)
        kropp.push(
          `  elsif not (${sammeVerdi.join('\n      and ')}) then`,
          `    raise notice '%: verdien på kortet % er en annen enn i kilden, og kortet endres ikke.', ${lit(kode.kode)}, ${lit(e.elementtype)};`,
          `  elsif not publisert then`,
          `    raise notice '%: kortet % har et upublisert utkast, og endres ikke.', ${lit(kode.kode)}, ${lit(e.elementtype)};`,
          `  else`,
          `    kilder := coalesce(innhold -> 'referanser', '[]');`,
          ...e.referanser.map(
            (n) => `    if not kilder ? ${refvariabel(n)}::text then kilder := kilder || to_jsonb(${refvariabel(n)}::text); end if;`,
          ),
          `    if kilder is distinct from coalesce(innhold -> 'referanser', '[]') then`,
          `    ${kildeSql(kildetilleggskilde(e.kilde))}`,
          `      perform public.lagre_utkast(kort, revisjon, innhold || jsonb_build_object('referanser', kilder));`,
          `      perform public.publiser_utkast(kort, revisjon + 1);`,
          `    ${kildeSql(e.kilde)}`,
          `    end if;`,
        )
      }
      kropp.push(`  end if;`)
    }
    return blokk(kode.kode, deklarasjoner, admin, utenAdministrator, kropp)
  })

  return [...referanseblokker, ...kodeblokker]
}

/**
 * Importen som migrasjoner: blokkene samlet i filer på høyst `maksTegn` tegn
 * (en blokk som alene er større, får en fil for seg), i samme rekkefølge.
 * Finnes ikke administratoren, gjør de ingenting — slik kan de kjøres i
 * testdatabasen og i nye grener, der importen ikke hører hjemme.
 */
export function importmigrasjoner(
  plan: Importplan,
  admin: string,
  maksTegn = 50_000,
  finnesFraFor: FinnesFraFor = 'hopp over',
): string[] {
  const filer: string[][] = []
  for (const blokk of importSql(plan, admin, 'hopp over', finnesFraFor)) {
    const siste = filer.at(-1)
    if (siste && [...siste, blokk].join('\n\n').length <= maksTegn) siste.push(blokk)
    else filer.push([blokk])
  }
  return filer.map((blokker) => blokker.join('\n\n'))
}

/** Kilden revisjonene fra kursendringen får i historikken. */
export const KURSENDRINGSKILDER = {
  preparater: 'Tatt bort: preparatnavnene skal hentes fra offentlige legemiddeldata',
  kontrolldato: 'Tatt bort: datoen for kontroll mot Felleskatalogen',
} as const

/**
 * Kursendringen etter importen: preparatnavnene skal ikke føres for hånd, men
 * hentes fra offentlige legemiddeldata, og datoen for kontroll mot
 * Felleskatalogen skal ikke vedlikeholdes. Preparatkortene importen la inn,
 * tas derfor bort fra siden (panelet `fjernet`), og datoen tas ut av
 * indikasjonene — som nye, publiserte revisjoner, så alt står i historikken
 * og kan hentes tilbake. Bare det importen la inn og ingen har endret siden,
 * røres. Uten administratoren gjør den ingenting, som migrasjonene over.
 */
export function kursendringSql(admin: string): string {
  return `-- Kursendringen: preparatnavnene og datoen for kontroll mot Felleskatalogen tas bort
do $kursendring$
declare
  administrator uuid;
  e record;
begin
${innlogging(admin, 'hopp over')}

  for e in
    select u.objekt_id, u.revisjon, r.innhold
    from public.objekttilstander u
    join public.objekttilstander p on p.objekt_id = u.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r on r.objekt_id = u.objekt_id and r.revisjon = u.revisjon
    join public.objektrevisjoner forste on forste.objekt_id = u.objekt_id and forste.revisjon = 1
    join public.redigerbare_objekter o on o.id = u.objekt_id and o.type = 'innholdselement'
    where u.tilstand = 'utkast'
      and u.revisjon = 1
      and forste.kilde like 'Hentet fra Felleskatalogen %'
      and r.innhold->>'panel' <> 'fjernet'
    order by u.objekt_id
  loop
    if e.innhold->>'elementtype' = 'preparater' then
      perform set_config('far.revisjonskilde', ${lit(KURSENDRINGSKILDER.preparater)}, true);
      perform public.lagre_utkast(e.objekt_id, e.revisjon, jsonb_set(e.innhold, '{panel}', '"fjernet"'));
    elsif e.innhold->'data' ? 'kontrollert' then
      perform set_config('far.revisjonskilde', ${lit(KURSENDRINGSKILDER.kontrolldato)}, true);
      perform public.lagre_utkast(e.objekt_id, e.revisjon, e.innhold #- '{data,kontrollert}');
    else
      continue;
    end if;
    perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);
  end loop;
end
$kursendring$;`
}
