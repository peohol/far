/**
 * Lesingen av FEST-filen fra Direktoratet for medisinske produkter.
 *
 * FEST er én stor XML-fil (om lag 120 MB) med én katalog per type:
 * virkestoff, merkevarer, pakninger osv. Hver oppføring i en katalog leses for
 * seg, gjøres om til en liten post med de feltene OUSFAR bruker, og kastes
 * igjen, så hele filen aldri ligger i minnet som ett tre.
 *
 * Hvilke kataloger som leses, og hvordan, står i {@link ENHETER}. Å ta inn en
 * ny type er å legge til en oppføring der — resten av synkroniseringen og
 * databasen finner den på navnet.
 *
 * Feltene og kodene er beskrevet i `docs/legemiddeldata.md`.
 */
import { SaxesParser } from 'saxes'

/**
 * Øk når postene får en ny form. Da synkroniseres alt på nytt ved neste
 * kjøring selv om FEST-filen er uendret, slik at også de eldre radene får den
 * nye formen.
 */
export const PARSERVERSJON = 2

/* --- Et lite tre per oppføring -------------------------------------------- */

/** Et element i én oppføring: navnet uten prefiks, attributtene, teksten og barna. */
export interface Xmlnode {
  navn: string
  attr: Record<string, string>
  tekst: string
  barn: Xmlnode[]
}

function barn(node: Xmlnode | undefined, navn: string): Xmlnode | undefined {
  return node?.barn.find((b) => b.navn === navn)
}

function alleBarn(node: Xmlnode | undefined, navn: string): Xmlnode[] {
  return node?.barn.filter((b) => b.navn === navn) ?? []
}

function tekstIn(node: Xmlnode | undefined, navn: string): string | null {
  const b = barn(node, navn)
  const t = b?.tekst.trim()
  return t ? t : null
}

/** En kodet verdi: koden (`V`) og teksten (`DN`). */
export interface Kode {
  kode: string
  tekst: string
}

function kode(node: Xmlnode | undefined, navn: string): Kode | null {
  const b = barn(node, navn)
  if (!b || b.attr.V === undefined) return null
  return { kode: b.attr.V, tekst: b.attr.DN ?? '' }
}

function koder(node: Xmlnode | undefined, navn: string): Kode[] {
  return alleBarn(node, navn)
    .filter((b) => b.attr.V !== undefined)
    .map((b) => ({ kode: b.attr.V!, tekst: b.attr.DN ?? '' }))
}

/** Et tall med enhet, som `<Styrke V="2.5" U="mg" />`. */
export interface Mengde {
  verdi: number
  enhet: string
}

function tall(tekst: string | null | undefined): number | null {
  if (tekst === null || tekst === undefined || tekst.trim() === '') return null
  const n = Number(tekst)
  return Number.isFinite(n) ? n : null
}

function mengde(node: Xmlnode | undefined, navn: string): Mengde | null {
  const b = barn(node, navn)
  const verdi = tall(b?.attr.V)
  if (!b || verdi === null) return null
  return { verdi, enhet: b.attr.U ?? '' }
}

function sannhet(tekst: string | null): boolean | null {
  if (tekst === 'true') return true
  if (tekst === 'false') return false
  return null
}

/** ID-ene i en sortert liste, som `SortertVirkestoffMedStyrke`, i rekkefølgen `Sortering` gir. */
function sorterteRef(node: Xmlnode, liste: string, ref: string): string[] {
  return alleBarn(node, liste)
    .map((b, i) => ({ id: tekstIn(b, ref), rekkefolge: tall(tekstIn(b, 'Sortering')) ?? i }))
    .filter((x): x is { id: string; rekkefolge: number } => x.id !== null)
    .sort((a, b) => a.rekkefolge - b.rekkefolge)
    .map((x) => x.id)
}

/* --- Postene -------------------------------------------------------------- */

export interface Virkestoffdata {
  navn: string
  navn_engelsk: string | null
  /** Saltene og esterne av stoffet, som egne virkestoff. */
  salter: string[]
}

export interface Styrkedata {
  virkestoff_id: string
  styrke: Mengde | null
  /** Det styrken er per, f.eks. «5 ml» i «50 mg/5 ml». */
  nevner: Mengde | null
  /** Øvre verdi når styrken er et intervall. */
  ovre: Mengde | null
  operator: Kode | null
  alternativ_styrke: Mengde | null
  alternativ_nevner: Mengde | null
}

export interface Merkevaredata {
  varenavn: string
  navn_form_styrke: string
  legemiddelform: Kode | null
  legemiddelform_lang: string | null
  atc: Kode | null
  reseptgruppe: Kode | null
  preparattype: Kode | null
  administrasjonsveier: Kode[]
  deling: Kode | null
  kan_knuses: Kode | null
  kan_apnes: Kode | null
  produsent: string | null
  referanseprodukt: string | null
  preparatomtale: string | null
  svart_trekant: boolean
  /** Virkestoffene med styrke, i FESTs rekkefølge. Flere betyr kombinasjonspreparat. */
  virkestoff_med_styrke: string[]
  /** Virkestoff oppgitt uten styrke, i FESTs rekkefølge. */
  virkestoff_uten_styrke: string[]
}

export interface Pakningsinnhold {
  merkevare_id: string
  pakningsstorrelse: number | null
  enhet: Kode | null
  pakningstype: Kode | null
  mengde: number | null
  antall: number | null
}

export interface Pakningsdata {
  varenr: string
  navn_form_styrke: string
  /** Hva pakningen inneholder. Mer enn én for sett og startpakninger. */
  innhold: Pakningsinnhold[]
  /** Merkevarene pakningen inneholder, samlet for oppslag. */
  merkevarer: string[]
  markedsforingsdato: string | null
  midlertidig_utgatt_dato: string | null
  avregistrert_dato: string | null
  byttegrupper: string[]
  ean: string[]
}

export interface Byttegruppedata {
  kode: string
  tekst: string
  merknad_til_byttbarhet: boolean | null
  beskrivelse: string | null
  gyldig_fra: string | null
  gyldig_til: string | null
}

/** Et stoff i en interaksjon: med ATC-kode, eller med virkestoffets ID når det ikke har noen. */
export interface Interaksjonssubstans {
  navn: string
  /** ATC-koden. Kan være på et overordnet nivå, og gjelder da alle kodene under. */
  atc: Kode | null
  virkestoff_id: string | null
}

/** Den ene siden av en interaksjon: ett stoff, eller en gruppe med navn. */
export interface Substansgruppe {
  /** Navnet på gruppen, når den har flere stoffer, f.eks. «Johannesurt». */
  navn: string | null
  substanser: Interaksjonssubstans[]
}

export interface Interaksjonsdata {
  /** «Bør unngås», «Forholdsregler bør tas» eller «Ingen tiltak nødvendig». */
  relevans: Kode | null
  klinisk_konsekvens: string | null
  mekanisme: string | null
  /** Håndteringen, med avsnitt som «Dosetilpasning: …» på hver sin linje. */
  handtering: string | null
  /** Når interaksjonen bare gjelder under visse forhold. */
  situasjonskriterier: string[]
  kildegrunnlag: Kode | null
  referanser: { kilde: string; lenke: string | null }[]
  /** De to sidene av interaksjonen. */
  substansgrupper: Substansgruppe[]
}

/** ATC-koder DMP ikke har vurdert for interaksjoner ennå, f.eks. nye legemidler. */
export interface IkkeVurdertdata {
  atc: Kode[]
}

/** Én post fra FEST, klar til å lagres. */
export interface Festpost {
  entitet: Entitetnavn
  fest_id: string
  /** Når oppføringen sist ble endret i FEST. */
  tidspunkt: string | null
  data: object
}

/* --- Katalogene ------------------------------------------------------------ */

interface Enhet {
  /** Navnet i databasen: tabellen i skjemaet `legemiddeldata`. */
  entitet: string
  /** Katalogen i FEST-filen. */
  katalog: string
  /** Elementet i oppføringen som bærer posten. */
  element: string
  /** ID-en. Som regel elementets egen; noen elementer har ingen, og bruker oppføringens. */
  id?: (element: Xmlnode, oppforing: Xmlnode) => string | null
  les: (node: Xmlnode) => object
}

/**
 * Typene som tas inn. Samme navn som tabellene i databasen, og som
 * `legemiddeldata.entiteter` — testene kontrollerer at de stemmer.
 */
export const ENHETER = [
  {
    entitet: 'virkestoff',
    katalog: 'KatVirkestoff',
    element: 'Virkestoff',
    les: (n): Virkestoffdata => ({
      navn: tekstIn(n, 'Navn') ?? '',
      navn_engelsk: tekstIn(n, 'NavnEngelsk'),
      salter: alleBarn(n, 'RefVirkestoff')
        .map((b) => b.tekst.trim())
        .filter(Boolean),
    }),
  },
  {
    entitet: 'virkestoff_styrke',
    katalog: 'KatVirkestoff',
    element: 'VirkestoffMedStyrke',
    les: (n): Styrkedata => ({
      virkestoff_id: tekstIn(n, 'RefVirkestoff') ?? '',
      styrke: mengde(n, 'Styrke'),
      nevner: mengde(n, 'StyrkeNevner'),
      ovre: mengde(n, 'StyrkeOvreVerdi'),
      operator: kode(n, 'Styrkeoperator'),
      alternativ_styrke: mengde(n, 'AlternativStyrke'),
      alternativ_nevner: mengde(n, 'AlternativStyrkeNevner'),
    }),
  },
  {
    entitet: 'merkevare',
    katalog: 'KatLegemiddelMerkevare',
    element: 'LegemiddelMerkevare',
    les: (n): Merkevaredata => {
      const adm = barn(n, 'AdministreringLegemiddel')
      const omtale = alleBarn(n, 'Preparatomtaleavsnitt')
        .map((a) => barn(barn(a, 'Lenke'), 'Www')?.attr.V?.trim())
        .find((url) => url && /^https?:\/\//.test(url))
      return {
        varenavn: tekstIn(n, 'Varenavn') ?? '',
        navn_form_styrke: tekstIn(n, 'NavnFormStyrke') ?? '',
        legemiddelform: kode(n, 'LegemiddelformKort'),
        legemiddelform_lang: tekstIn(n, 'LegemiddelformLang'),
        atc: kode(n, 'Atc'),
        reseptgruppe: kode(n, 'Reseptgruppe'),
        preparattype: kode(n, 'Preparattype'),
        administrasjonsveier: koder(adm, 'Administrasjonsvei'),
        deling: kode(adm, 'Deling'),
        kan_knuses: kode(adm, 'KanKnuses'),
        kan_apnes: kode(adm, 'KanApnes'),
        produsent: tekstIn(barn(n, 'ProduktInfo'), 'Produsent'),
        referanseprodukt: tekstIn(barn(n, 'ProduktInfo'), 'Referanseprodukt'),
        preparatomtale: omtale ?? null,
        svart_trekant: barn(n, 'SvartTrekant') !== undefined,
        virkestoff_med_styrke: sorterteRef(n, 'SortertVirkestoffMedStyrke', 'RefVirkestoffMedStyrke'),
        virkestoff_uten_styrke: sorterteRef(n, 'SortertVirkestoffUtenStyrke', 'RefVirkestoff'),
      }
    },
  },
  {
    entitet: 'pakning',
    katalog: 'KatLegemiddelpakning',
    element: 'Legemiddelpakning',
    les: (n): Pakningsdata => {
      const innhold = alleBarn(n, 'Pakningsinfo')
        .map((p) => ({
          merkevare_id: tekstIn(p, 'RefLegemiddelMerkevare') ?? '',
          pakningsstorrelse: tall(tekstIn(p, 'Pakningsstr')),
          enhet: kode(p, 'EnhetPakning'),
          pakningstype: kode(p, 'Pakningstype'),
          mengde: tall(tekstIn(p, 'Mengde')),
          antall: tall(tekstIn(p, 'Antall')),
          rekkefolge: tall(tekstIn(p, 'Sortering')),
        }))
        .filter((p) => p.merkevare_id !== '')
        .sort((a, b) => (a.rekkefolge ?? 0) - (b.rekkefolge ?? 0))
        .map(({ rekkefolge: _, ...p }) => p)
      const marked = barn(n, 'Markedsforingsinfo')
      return {
        varenr: tekstIn(n, 'Varenr') ?? '',
        navn_form_styrke: tekstIn(n, 'NavnFormStyrke') ?? '',
        innhold,
        merkevarer: [...new Set(innhold.map((p) => p.merkevare_id))],
        markedsforingsdato: tekstIn(marked, 'Markedsforingsdato'),
        midlertidig_utgatt_dato: tekstIn(marked, 'MidlUtgattDato'),
        avregistrert_dato: tekstIn(marked, 'AvregDato'),
        byttegrupper: alleBarn(n, 'PakningByttegruppe')
          .map((b) => tekstIn(b, 'RefByttegruppe'))
          .filter((id): id is string => id !== null),
        ean: alleBarn(n, 'Ean')
          .map((e) => e.tekst.trim())
          .filter(Boolean),
      }
    },
  },
  {
    entitet: 'byttegruppe',
    katalog: 'KatByttegruppe',
    element: 'Byttegruppe',
    les: (n): Byttegruppedata => ({
      kode: barn(n, 'Kode')?.attr.V ?? '',
      tekst: barn(n, 'Kode')?.attr.DN ?? '',
      merknad_til_byttbarhet: sannhet(tekstIn(n, 'MerknadTilByttbarhet')),
      beskrivelse: tekstIn(n, 'BeskrivelseByttbarhet'),
      gyldig_fra: tekstIn(n, 'GyldigFraDato'),
      gyldig_til: tekstIn(n, 'GyldigTilDato'),
    }),
  },
  {
    entitet: 'interaksjon',
    katalog: 'KatInteraksjon',
    element: 'Interaksjon',
    les: (n): Interaksjonsdata => ({
      relevans: kode(n, 'Relevans'),
      klinisk_konsekvens: tekstIn(n, 'KliniskKonsekvens'),
      mekanisme: tekstIn(n, 'Interaksjonsmekanisme'),
      handtering: tekstIn(n, 'Handtering'),
      situasjonskriterier: alleBarn(n, 'Situasjonskriterium')
        .map((b) => b.tekst.trim())
        .filter(Boolean),
      kildegrunnlag: kode(n, 'Kildegrunnlag'),
      referanser: alleBarn(n, 'Referanse')
        .map((r) => ({ kilde: tekstIn(r, 'Kilde') ?? '', lenke: barn(r, 'Lenke')?.attr.V?.trim() || null }))
        .filter((r) => r.kilde || r.lenke),
      substansgrupper: alleBarn(n, 'Substansgruppe').map((g) => ({
        navn: tekstIn(g, 'Navn'),
        substanser: alleBarn(g, 'Substans').map((s) => ({
          navn: tekstIn(s, 'Substans') ?? '',
          atc: kode(s, 'Atc'),
          virkestoff_id: tekstIn(s, 'RefVirkestoff'),
        })),
      })),
    }),
  },
  {
    entitet: 'interaksjon_ikke_vurdert',
    katalog: 'KatInteraksjon',
    element: 'InteraksjonIkkeVurdert',
    id: (_element, oppforing) => tekstIn(oppforing, 'Id'),
    les: (n): IkkeVurdertdata => ({ atc: koder(n, 'Atc') }),
  },
] as const satisfies readonly Enhet[]

export type Entitetnavn = (typeof ENHETER)[number]['entitet']

export const ENTITETER: readonly Entitetnavn[] = ENHETER.map((e) => e.entitet)

const PER_KATALOG = new Map<string, Enhet[]>()
for (const e of ENHETER as readonly Enhet[]) {
  PER_KATALOG.set(e.katalog, [...(PER_KATALOG.get(e.katalog) ?? []), e])
}

/**
 * Gjør en oppføring (`Oppf…`) om til en post, eller `null` når den ikke
 * gjelder noen av typene. En oppføring uten ID eller med en annen status enn
 * aktiv hoppes over; det fulle uttrekket har bare aktive.
 */
export function lesOppforing(katalog: string, oppforing: Xmlnode): Festpost | null {
  const enheter = PER_KATALOG.get(katalog)
  if (!enheter) return null
  if (barn(oppforing, 'Status')?.attr.V !== 'A') return null
  for (const enhet of enheter) {
    const node = barn(oppforing, enhet.element)
    if (!node) continue
    const id = enhet.id ? enhet.id(node, oppforing) : tekstIn(node, 'Id')
    if (!id) continue
    return {
      entitet: enhet.entitet as Entitetnavn,
      fest_id: id,
      tidspunkt: tekstIn(oppforing, 'Tidspunkt'),
      data: enhet.les(node),
    }
  }
  return null
}

/* --- Strømmen ------------------------------------------------------------- */

export interface Festfil {
  /** Når DMP laget uttrekket (`HentetDato`), eller `null` om det mangler. */
  hentetDato: string | null
}

/**
 * Leser FEST-filen bit for bit og gir postene etter hvert som de er lest.
 * `fil.hentetDato` er fylt ut når den er lest, i starten av filen.
 *
 * Kaster ved ugyldig XML eller en fil som ikke er FEST, slik at en halv eller
 * feil fil aldri ser ut som et fullstendig uttrekk.
 */
export async function* lesFest(biter: AsyncIterable<string>, fil: Festfil = { hentetDato: null }): AsyncGenerator<Festpost> {
  const parser = new SaxesParser({ position: false })
  const sti: string[] = []
  let noder: Xmlnode[] = []
  let klare: Festpost[] = []
  let rot: string | null = null
  let feil: Error | null = null
  let tekstTil: string | null = null
  let hentet = ''

  parser.on('opentag', (tag) => {
    const navn = lokalt(tag.name)
    sti.push(navn)
    if (sti.length === 1) rot = navn
    if (sti.length === 2 && navn === 'HentetDato') tekstTil = 'hentet'
    // Nivå 3 er oppføringene: FEST › Kat… › Oppf…
    if (sti.length >= 3 && PER_KATALOG.has(sti[1]!)) {
      const attr: Record<string, string> = {}
      for (const [k, v] of Object.entries(tag.attributes)) {
        if (!k.startsWith('xmlns')) attr[lokalt(k)] = typeof v === 'string' ? v : v.value
      }
      const node: Xmlnode = { navn, attr, tekst: '', barn: [] }
      noder.at(-1)?.barn.push(node)
      noder.push(node)
    }
  })
  parser.on('text', (tekst) => {
    if (tekstTil === 'hentet') hentet += tekst
    const node = noder.at(-1)
    if (node) node.tekst += tekst
  })
  parser.on('closetag', () => {
    if (tekstTil === 'hentet' && sti.length === 2) {
      fil.hentetDato = hentet.trim() || null
      tekstTil = null
    }
    if (sti.length >= 3 && PER_KATALOG.has(sti[1]!)) {
      const node = noder.pop()!
      if (sti.length === 3) {
        const post = lesOppforing(sti[1]!, node)
        if (post) klare.push(post)
        noder = []
      }
    }
    sti.pop()
  })
  parser.on('error', (e) => {
    feil ??= e
  })

  for await (const bit of biter) {
    parser.write(bit)
    if (feil) throw feil
    if (klare.length > 0) {
      const ut = klare
      klare = []
      yield* ut
    }
  }
  parser.close()
  if (feil) throw feil
  yield* klare
  if (rot !== 'FEST') throw new Error('Filen er ikke et FEST-uttrekk.')
}

function lokalt(navn: string): string {
  const i = navn.indexOf(':')
  return i === -1 ? navn : navn.slice(i + 1)
}
