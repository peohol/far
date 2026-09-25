/**
 * Visningsmodellen for seksjonen «Preparater» i den nye presentasjonen:
 *
 *   legemiddelform → styrke → preparater → full preparatdetalj
 *
 * (`docs/ux-reimagination.md`, del 9), slik `src/components/preparater/`
 * viser den.
 *
 * Som i `preparater.ts` er alt avledet av FEST-dataene og legger ingenting
 * til: formene, navnene og styrkene er FESTs egne.
 *
 * - En **legemiddelform** er FESTs korte form, med koden som identitet og et
 *   ikon fra `legemiddelformer.ts`.
 * - En **styrke** identifiseres av de strukturerte feltene i FEST, ikke av
 *   teksten som vises: virkestoffet (også hvilket salt), verdien, enheten,
 *   nevneren, øvre verdi, operatoren og den alternative styrken, for hvert
 *   virkestoff i preparatet. Da slås ikke kombinasjoner, ulike salter,
 *   mg og mg/ml eller mg/ml og mg/5 ml sammen, selv om teksten skulle bli lik.
 *   Blir teksten lik for to ulike styrker i samme form, får de en
 *   `presisering` som skiller dem.
 * - Et **preparat** er et varenavn i én legemiddelform, som før. Det er det
 *   preparatdetaljen (modalen) handler om, med alle styrkene sine.
 * - **Godkjenningsfritak** og andre preparattyper er merker på preparatet,
 *   ikke egne grupper. Det er også **særlig overvåkning** (FESTs svarte
 *   trekant).
 * - **Byttbarhet** er FESTs byttegrupper: pakninger i samme gruppe kan byttes
 *   i apotek. Den står per styrke, med de andre preparatene i gruppen.
 */
import { antall, ramsOpp } from '../faginnhold/oppsummering'
import { alfabetisk } from '../faginnhold/paneler'
import { iSetning } from '../domain/names'
import type { Byttegruppedata, Kode, Mengde, Merkevaredata, Styrkedata } from './fest'
import { formikon, type Formikon } from './legemiddelformer'
import type { Legemiddelutvalg, MedId } from './lesing'
import {
  egneVirkestoff,
  formaterMengde,
  GODKJENNINGSFRITAK,
  handteringFor,
  pakningerPerMerkevare,
  styrkemengde,
  trygLenke,
  virkestoffI,
  type Handtering,
  type Handteringsvalg,
  type Preparatpakning,
  type Styrkemengde,
} from './preparater'

/* --- Modellen ---------------------------------------------------------------- */

/** Ett virkestoff i en styrke. Et kombinasjonspreparat har flere. */
export interface Styrkeledd {
  virkestoff_id: string
  virkestoff: string
  /** Et salt eller en ester av et virkestoff siden er koblet til. */
  salt: boolean
  /** Sidens eget virkestoff eller et salt av det; `false` for de andre i en kombinasjon. */
  egen: boolean
  mengde: Styrkemengde | null
  /** FESTs operator når den ikke er «Lik», f.eks. «Mindre enn» eller «Intervall». */
  operator: Kode | null
  /** Styrken uttrykt på en annen måte, når FEST oppgir det. */
  alternativ: Styrkemengde | null
}

export type Preparatmerketype = 'godkjenningsfritak' | 'preparattype' | 'kombinasjon' | 'overvaking'

/** Et merke på et preparat. `tekst` er FESTs egen, eller virkestoffene for en kombinasjon. */
export interface Preparatmerke {
  type: Preparatmerketype
  tekst: string
}

/** Et preparat slik det står i en åpnet styrke. */
export interface Preparatrad {
  /** Nøkkelen til preparatet i {@link Preparatvisning.preparater}. */
  preparat: string
  navn: string
  produsenter: string[]
  /** Merkene for preparatet i denne styrken. */
  merker: Preparatmerke[]
}

export interface Styrkegruppe {
  /** Kort og fast ID, trygg i en adresse. Avledet av `nokkel`. */
  id: string
  /** Den strukturerte identiteten til styrken, som tekst. */
  nokkel: string
  /** «200 mg», «10 mg/5 ml» eller «kodein 9,6 mg + acetylsalisylsyre 500 mg». Tom uten styrke i FEST. */
  styrke: string
  /** Det som skiller styrken fra en annen i samme form med samme tekst, ellers `null`. */
  presisering: string | null
  /** Styrken som tall, for ett virkestoff; `null` for kombinasjoner og uten styrke. */
  mengde: Styrkemengde | null
  ledd: Styrkeledd[]
  /** Virkestoff oppgitt uten styrke, med navn. */
  uten_styrke: string[]
  kombinasjon: boolean
  /** Preparatene med styrken, alfabetisk. */
  preparater: Preparatrad[]
}

export interface Formgruppe {
  /** FESTs kode for formen, eller `ukjent`. */
  id: string
  form: string
  ikon: Formikon
  styrker: Styrkegruppe[]
}

/**
 * Én byttegruppe i FEST som pakninger av styrken hører til: pakningene i
 * gruppen kan byttes med hverandre i apotek.
 */
export interface Byttbarhet {
  /** FESTs kode for gruppen. */
  kode: string
  /** FESTs navn på gruppen, f.eks. «AMITRIPTYLIN TABLETT 25 MG». */
  gruppe: string
  /** De andre preparatene med pakninger i gruppen, med FESTs navn med form og styrke. Alfabetisk. */
  med: string[]
  /** Pakningene av styrken som er i gruppen, når det ikke er alle; ellers `null`. */
  pakninger: string[] | null
  /** FESTs merknad til byttbarheten, når den har en. */
  merknad: string | null
}

/** Et preparat i én styrke: én eller flere merkevarer i FEST. */
export interface Preparatstyrkedetalj {
  /** Samme ID som styrken i formen. */
  styrke_id: string
  styrke: string
  presisering: string | null
  mengde: Styrkemengde | null
  /** Merkevarene i FEST. */
  merkevarer: string[]
  /** FESTs navn med form og styrke, f.eks. «Sarotex tab 25 mg». */
  navn_form_styrke: string[]
  merker: Preparatmerke[]
  reseptgrupper: string[]
  produsenter: string[]
  atc: Kode[]
  handtering: Handtering
  /** Lenkene til preparatomtalen (SPC). */
  preparatomtaler: string[]
  pakninger: Preparatpakning[]
  /** Byttegruppene pakningene hører til, med de andre preparatene i dem. Tom når ingen er byttbare. */
  byttbarhet: Byttbarhet[]
}

/** Alt om ett preparat, til preparatdetaljen. */
export interface Preparatdetalj {
  /** Fast nøkkel: formens kode og varenavnet. */
  id: string
  navn: string
  form_id: string
  form: string
  ikon: Formikon
  /** FESTs lange form når den sier mer enn den korte, f.eks. «Tablett, filmdrasjert». */
  langform: string[]
  /** Sidens virkestoff slik preparatet har dem, med saltene. */
  virkestoff: string[]
  /** Saltene eller esterne av sidens virkestoff preparatet inneholder. */
  salter: string[]
  /** De andre virkestoffene, når preparatet er en kombinasjon. */
  kombinasjon: string[]
  /** Merkene samlet for alle styrkene; `fordelMerker` skiller det felles fra det som gjelder én styrke. */
  merker: Preparatmerke[]
  administrasjonsveier: string[]
  reseptgrupper: string[]
  produsenter: string[]
  atc: Kode[]
  /** I samme rekkefølge som styrkene i formen. */
  styrker: Preparatstyrkedetalj[]
}

export interface Preparatvisning {
  /** Alfabetisk. */
  former: Formgruppe[]
  preparater: ReadonlyMap<string, Preparatdetalj>
}

/* --- Byggingen ----------------------------------------------------------------- */

/** FESTs operator for en vanlig styrke; den vises ikke. */
const LIK = 'L'
/** Operatorene som vises foran styrken. De andre står i presiseringen ved behov. */
const OPERATORTEGN: Record<string, string> = { M: '<', S: '>' }
/** Preparattyper som er vanlige legemidler og ikke gir merke. Fritaket får sitt eget. */
const VANLIG_LEGEMIDDEL = '7'

type Virkestoffoppslag = ReadonlyMap<string, { navn: string }>

/**
 * @param idag Datoen byttegruppenes gyldighet måles mot (`ÅÅÅÅ-MM-DD`). Dagens
 *   dato der brukeren er, om ikke annet er gitt.
 */
export function byggPreparatvisning(
  utvalg: Legemiddelutvalg,
  koblet: readonly string[],
  idag: string = dagensDato(),
): Preparatvisning {
  const virkestoff: Virkestoffoppslag = new Map(utvalg.virkestoff.map((v) => [v.id, v]))
  const styrker = new Map(utvalg.styrker.map((s) => [s.id, s]))
  const { egne, salter } = egneVirkestoff(utvalg, koblet)
  const pakninger = pakningerPerMerkevare(utvalg)
  const navn = (id: string) => virkestoff.get(id)?.navn ?? id

  const former = new Map<string, Formgruppe & { grupper: Map<string, Styrkegruppe> }>()
  const preparater = new Map<string, Preparatdetalj & { perStyrke: Map<string, Preparatstyrkedetalj> }>()

  for (const m of utvalg.merkevarer) {
    const formId = m.legemiddelform?.kode || 'ukjent'
    const form =
      former.get(formId) ??
      former
        .set(formId, {
          id: formId,
          form: m.legemiddelform?.tekst || 'Ukjent legemiddelform',
          ikon: formikon(m.legemiddelform?.kode),
          styrker: [],
          grupper: new Map(),
        })
        .get(formId)!

    const ledd = m.virkestoff_med_styrke.map((id) => styrkeledd(id, styrker.get(id), { egne, salter, navn }))
    const stoff = virkestoffI(m, styrker)
    const andre = stoff.filter((id) => !egne.has(id))
    const kombinasjon = andre.length > 0
    const nokkel = styrkenokkel(formId, m, styrker)
    const gruppe =
      form.grupper.get(nokkel) ??
      form.grupper
        .set(nokkel, {
          id: '',
          nokkel,
          styrke: styrketekst(ledd, kombinasjon),
          presisering: null,
          mengde: !kombinasjon && ledd.length === 1 ? ledd[0]!.mengde : null,
          ledd,
          uten_styrke: m.virkestoff_uten_styrke.map(navn),
          kombinasjon,
          preparater: [],
        })
        .get(nokkel)!

    const preparatId = `${formId}:${m.varenavn}`
    const preparat =
      preparater.get(preparatId) ??
      preparater
        .set(preparatId, {
          id: preparatId,
          navn: m.varenavn,
          form_id: formId,
          form: form.form,
          ikon: form.ikon,
          langform: [],
          virkestoff: [],
          salter: [],
          kombinasjon: [],
          merker: [],
          administrasjonsveier: [],
          reseptgrupper: [],
          produsenter: [],
          atc: [],
          styrker: [],
          perStyrke: new Map(),
        })
        .get(preparatId)!
    if (m.legemiddelform_lang && m.legemiddelform_lang !== form.form) leggTil(preparat.langform, [m.legemiddelform_lang])
    leggTil(preparat.virkestoff, stoff.filter((id) => egne.has(id)).map(navn))
    leggTil(preparat.salter, stoff.filter((id) => salter.has(id)).map(navn))
    leggTil(preparat.kombinasjon, andre.map(navn))
    leggTil(preparat.administrasjonsveier, m.administrasjonsveier.map((v) => v.tekst))

    const merker = merkerFor(m, andre.map(navn))
    const styrke =
      preparat.perStyrke.get(nokkel) ??
      preparat.perStyrke
        .set(nokkel, {
          styrke_id: '',
          styrke: gruppe.styrke,
          presisering: null,
          mengde: gruppe.mengde,
          merkevarer: [],
          navn_form_styrke: [],
          merker: [],
          reseptgrupper: [],
          produsenter: [],
          atc: [],
          handtering: handteringFor(m),
          preparatomtaler: [],
          pakninger: [],
          byttbarhet: [],
        })
        .get(nokkel)!
    // Samme preparat i samme styrke kan være flere merkevarer i FEST, f.eks.
    // med hver sine pakninger. Det er én styrke å vise, med alt fra dem alle.
    if (styrke.merkevarer.length > 0) styrke.handtering = slaSammenHandtering(styrke.handtering, handteringFor(m))
    styrke.merkevarer.push(m.id)
    leggTil(styrke.navn_form_styrke, [m.navn_form_styrke])
    leggTilMerker(styrke.merker, merker)
    leggTil(styrke.reseptgrupper, [m.reseptgruppe?.tekst])
    leggTil(styrke.produsenter, [m.produsent])
    leggTilKoder(styrke.atc, [m.atc])
    leggTil(styrke.preparatomtaler, [trygLenke(m.preparatomtale)])
    for (const p of pakninger.get(m.id) ?? []) if (!styrke.pakninger.some((q) => q.id === p.id)) styrke.pakninger.push(p)
  }

  // Styrkene sorteres og får ID og presisering når alle merkevarene er med.
  const ferdigeFormer = [...former.values()].map(({ grupper, ...form }): Formgruppe => {
    const sortert = [...grupper.values()].sort(sammenlignStyrker)
    // Presiseringen kan skille styrker med lik tekst, så de sorteres etter den også.
    presiser(sortert)
    sortert.sort(sammenlignStyrker)
    const brukt = new Set<string>()
    for (const g of sortert) g.id = unikId(`${form.id}-${fnv1a(g.nokkel)}`, brukt)
    return { ...form, styrker: sortert }
  })
  const gruppeFor = new Map(ferdigeFormer.flatMap((f) => f.styrker.map((g, i) => [`${f.id}\n${g.nokkel}`, { g, i }] as const)))

  const bytte = byttbarhetFor(utvalg, idag)
  const ferdigePreparater = new Map<string, Preparatdetalj>()
  for (const { perStyrke, ...preparat } of preparater.values()) {
    const styrkeliste = [...perStyrke.entries()]
      .map(([nokkel, s]) => {
        const { g, i } = gruppeFor.get(`${preparat.form_id}\n${nokkel}`)!
        s.styrke_id = g.id
        s.presisering = g.presisering
        s.pakninger.sort((a, b) => a.tekst.localeCompare(b.tekst, 'nb', { numeric: true }))
        s.byttbarhet = bytte(s)
        g.preparater.push({ preparat: preparat.id, navn: preparat.navn, produsenter: s.produsenter, merker: s.merker })
        return { s, i }
      })
      .sort((a, b) => a.i - b.i)
      .map(({ s }) => s)
    preparat.salter.sort(alfabetisk)
    for (const s of styrkeliste) {
      leggTilMerker(preparat.merker, s.merker)
      leggTil(preparat.reseptgrupper, s.reseptgrupper)
      leggTil(preparat.produsenter, s.produsenter)
      leggTilKoder(preparat.atc, s.atc)
    }
    ferdigePreparater.set(preparat.id, { ...preparat, styrker: styrkeliste })
  }
  for (const g of ferdigeFormer.flatMap((f) => f.styrker)) {
    g.preparater.sort((a, b) => alfabetisk(a.navn, b.navn) || a.preparat.localeCompare(b.preparat))
  }

  return { former: ferdigeFormer.sort((a, b) => alfabetisk(a.form, b.form)), preparater: ferdigePreparater }
}

function styrkeledd(
  id: string,
  s: Styrkedata | undefined,
  { egne, salter, navn }: { egne: ReadonlySet<string>; salter: ReadonlySet<string>; navn: (id: string) => string },
): Styrkeledd {
  const virkestoff_id = s?.virkestoff_id ?? id
  return {
    virkestoff_id,
    virkestoff: navn(virkestoff_id),
    salt: salter.has(virkestoff_id),
    egen: egne.has(virkestoff_id),
    mengde: s ? styrkemengde(s.styrke, s.ovre, s.nevner) : null,
    operator: s?.operator && s.operator.kode !== LIK ? s.operator : null,
    alternativ: s ? styrkemengde(s.alternativ_styrke, null, s.alternativ_nevner) : null,
  }
}

/**
 * Den strukturerte identiteten til styrken til en merkevare i en form:
 * rådataene fra FEST for hvert virkestoff, sortert så rekkefølgen i FEST ikke
 * betyr noe, og virkestoffene uten styrke. Tall og enheter tas som FEST
 * oppgir dem, ikke som de vises.
 */
export function styrkenokkel(formId: string, m: Merkevaredata, styrker: ReadonlyMap<string, Styrkedata>): string {
  const mengde = (x: Mengde | null) => (x ? [x.verdi, x.enhet] : null)
  const ledd = m.virkestoff_med_styrke
    .map((id) => {
      const s = styrker.get(id)
      // En styrke som mangler i utvalget, skal aldri kunne bli lik en annen.
      if (!s) return JSON.stringify(['mangler', id])
      return JSON.stringify([
        s.virkestoff_id,
        s.operator?.kode ?? LIK,
        mengde(s.styrke),
        mengde(s.ovre),
        mengde(s.nevner),
        mengde(s.alternativ_styrke),
        mengde(s.alternativ_nevner),
      ])
    })
    .sort()
  return JSON.stringify([formId, ledd, [...m.virkestoff_uten_styrke].sort()])
}

/** «25 mg», «< 5 mg», eller med virkestoffene for en kombinasjon. */
function styrketekst(ledd: readonly Styrkeledd[], kombinasjon: boolean): string {
  return ledd
    .map((l) => {
      const tegn = l.operator ? OPERATORTEGN[l.operator.kode] : undefined
      const tekst = [tegn, formaterMengde(l.mengde)].filter(Boolean).join(' ')
      return kombinasjon ? `${iSetning(l.virkestoff)} ${tekst}`.trim() : tekst
    })
    .filter(Boolean)
    .join(' + ')
}

function merkerFor(m: Merkevaredata, kombinasjon: readonly string[]): Preparatmerke[] {
  const type = m.preparattype
  return [
    m.svart_trekant && { type: 'overvaking' as const, tekst: 'Særlig overvåkning' },
    type?.kode === GODKJENNINGSFRITAK && { type: 'godkjenningsfritak' as const, tekst: type.tekst },
    type && type.kode !== GODKJENNINGSFRITAK && type.kode !== VANLIG_LEGEMIDDEL && { type: 'preparattype' as const, tekst: type.tekst },
    kombinasjon.length > 0 && { type: 'kombinasjon' as const, tekst: kombinasjon.map(iSetning).join(', ') },
  ].filter((x): x is Preparatmerke => !!x)
}

/**
 * Enkeltstoff først, så kombinasjoner, så preparater uten styrke. Innenfor
 * hver: etter enhet, så etter verdi, og en styrke uten presisering før en
 * med.
 */
function sammenlignStyrker(a: Styrkegruppe, b: Styrkegruppe): number {
  const rang = (g: Styrkegruppe) => (g.ledd.length === 0 ? 2 : g.kombinasjon ? 1 : 0)
  const forste = (g: Styrkegruppe) => g.mengde ?? g.ledd[0]?.mengde ?? null
  const [x, y] = [forste(a), forste(b)]
  return (
    rang(a) - rang(b) ||
    (x?.enhet ?? '').localeCompare(y?.enhet ?? '', 'nb') ||
    (x?.fra ?? 0) - (y?.fra ?? 0) ||
    (x?.til ?? 0) - (y?.til ?? 0) ||
    a.styrke.localeCompare(b.styrke, 'nb', { numeric: true }) ||
    (a.presisering ?? '').localeCompare(b.presisering ?? '', 'nb', { numeric: true }) ||
    a.nokkel.localeCompare(b.nokkel)
  )
}

/**
 * Når to ulike styrker i samme form får samme tekst, får de hver sin
 * presisering: det av virkestoffet (også saltet), den alternative styrken,
 * operatoren og virkestoffene uten styrke som ikke er likt for dem alle. Den
 * som ikke har noe av dette, står uten presisering.
 */
function presiser(grupper: readonly Styrkegruppe[]) {
  const likeTekster = new Map<string, Styrkegruppe[]>()
  for (const g of grupper) likeTekster.set(g.styrke, [...(likeTekster.get(g.styrke) ?? []), g])
  for (const like of likeTekster.values()) {
    if (like.length < 2) continue
    const deler = like.map((g) => [
      g.ledd.map((l) => iSetning(l.virkestoff)).join(' + '),
      ...g.ledd.map((l) => l.alternativ && `tilsvarer ${formaterMengde(l.alternativ)}`),
      ...g.ledd.map((l) => l.operator && l.operator.tekst.toLocaleLowerCase('nb')),
      g.uten_styrke.length > 0 && `med ${g.uten_styrke.map(iSetning).join(', ')}`,
    ].filter((d): d is string => !!d))
    const felles = (d: string) => deler.every((liste) => liste.includes(d))
    const presiseringer = deler.map((d) => [...new Set(d.filter((x) => !felles(x)))].join(', ') || null)
    // Skiller ingen av delene to av dem, nummereres de i tillegg.
    like.forEach((g, i) => {
      const p = presiseringer[i]!
      const nummer = `variant ${i + 1}`
      g.presisering = presiseringer.filter((x) => x === p).length > 1 ? (p ? `${p}, ${nummer}` : nummer) : p
    })
  }
}

/** Dagens dato der brukeren er, som `ÅÅÅÅ-MM-DD`. */
function dagensDato(): string {
  const d = new Date()
  const to = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${to(d.getMonth() + 1)}-${to(d.getDate())}`
}

/** Om byttegruppen gjelder `idag`. Datoene er `ÅÅÅÅ-MM-DD` og sammenlignes som tekst. */
export function gyldigByttegruppe(g: Pick<Byttegruppedata, 'gyldig_fra' | 'gyldig_til'>, idag: string): boolean {
  const dag = (dato: string | null) => dato?.slice(0, 10) || null
  const fra = dag(g.gyldig_fra)
  const til = dag(g.gyldig_til)
  return (!fra || fra <= idag) && (!til || til >= idag)
}

/**
 * Byttbarheten for en styrke: hver gyldige byttegruppe pakningene hører til,
 * med de andre preparatene som har pakninger i den. En gruppe uten andre
 * preparater i utvalget sier ingenting om hva det kan byttes med, og vises
 * ikke.
 */
function byttbarhetFor(utvalg: Legemiddelutvalg, idag: string) {
  const grupper = new Map<string, MedId<Byttegruppedata>>(
    utvalg.byttegrupper.filter((g) => gyldigByttegruppe(g, idag)).map((g) => [g.id, g]),
  )
  const navnFor = new Map(utvalg.merkevarer.map((m) => [m.id, m.navn_form_styrke]))
  const merkevarerI = new Map<string, Set<string>>()
  for (const p of utvalg.pakninger) {
    for (const g of p.byttegrupper) {
      if (!grupper.has(g)) continue
      const merkevarer = merkevarerI.get(g) ?? merkevarerI.set(g, new Set()).get(g)!
      for (const { merkevare_id } of p.innhold) merkevarer.add(merkevare_id)
    }
  }

  return (s: Pick<Preparatstyrkedetalj, 'merkevarer' | 'navn_form_styrke' | 'pakninger'>): Byttbarhet[] => {
    const egne = new Set(s.merkevarer)
    const iStyrken = [...new Set(s.pakninger.flatMap((p) => p.byttegrupper))]
    return iStyrken
      .flatMap((id): Byttbarhet[] => {
        const gruppe = grupper.get(id)
        if (!gruppe) return []
        const med: string[] = []
        for (const m of merkevarerI.get(id) ?? []) if (!egne.has(m)) leggTil(med, [navnFor.get(m)])
        const andre = med.filter((n) => !s.navn_form_styrke.includes(n)).sort(alfabetisk)
        if (andre.length === 0) return []
        const pakninger = s.pakninger.filter((p) => p.byttegrupper.includes(id))
        return [
          {
            kode: gruppe.kode,
            gruppe: gruppe.tekst,
            med: andre,
            pakninger: pakninger.length === s.pakninger.length ? null : [...new Set(pakninger.map((p) => p.tekst || p.varenr))],
            merknad: (gruppe.merknad_til_byttbarhet && gruppe.beskrivelse?.trim()) || null,
          },
        ]
      })
      .sort((a, b) => a.gruppe.localeCompare(b.gruppe, 'nb', { numeric: true }))
  }
}

function slaSammenHandtering(a: Handtering, b: Handtering): Handtering {
  const slaSammen = (x: Handteringsvalg, y: Handteringsvalg): Handteringsvalg =>
    x.status === y.status && x.tekst === y.tekst
      ? x
      : x.status === 'ukjent'
        ? y
        : y.status === 'ukjent'
          ? x
          : { status: 'varierer', tekst: [x.tekst, y.tekst].filter(Boolean).join(' / ') || null }
  return {
    deling: slaSammen(a.deling, b.deling),
    knusing: slaSammen(a.knusing, b.knusing),
    apning: slaSammen(a.apning, b.apning),
  }
}

/** FNV-1a, 32 bit, i base 36: en kort og stabil ID av nøkkelen. */
function fnv1a(tekst: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

function unikId(id: string, brukt: Set<string>): string {
  let kandidat = id
  for (let n = 2; brukt.has(kandidat); n++) kandidat = `${id}-${n}`
  brukt.add(kandidat)
  return kandidat
}

function leggTil(liste: string[], verdier: readonly (string | null | undefined)[]) {
  for (const v of verdier) if (v && !liste.includes(v)) liste.push(v)
}

function leggTilKoder(liste: Kode[], koder: readonly (Kode | null)[]) {
  for (const k of koder) if (k && !liste.some((x) => x.kode === k.kode)) liste.push(k)
}

const sammeMerke = (a: Preparatmerke) => (b: Preparatmerke) => a.type === b.type && a.tekst === b.tekst

function leggTilMerker(liste: Preparatmerke[], merker: readonly Preparatmerke[]) {
  for (const m of merker) if (!liste.some(sammeMerke(m))) liste.push(m)
}

/**
 * Merkene som gjelder hele preparatet, og merkene som bare gjelder hver
 * styrke. Et preparat med godkjenningsfritak i én styrke er ikke et
 * fritakspreparat i de andre.
 */
export function fordelMerker({ merker, styrker }: Pick<Preparatdetalj, 'merker' | 'styrker'>): {
  felles: Preparatmerke[]
  /** I samme rekkefølge som styrkene. */
  egne: Preparatmerke[][]
} {
  const felles = merker.filter((m) => styrker.every((s) => s.merker.some(sammeMerke(m))))
  return { felles, egne: styrker.map((s) => s.merker.filter((m) => !felles.some(sammeMerke(m)))) }
}

/* --- Oppsummeringene ------------------------------------------------------- */

function antallPreparater(navn: readonly string[]): number {
  return new Set(navn.map((n) => n.toLocaleLowerCase('nb'))).size
}

/** Spennet i styrkene per enhet, f.eks. «50–400 mg». Kombinasjonene har ikke noe spenn. */
function spenn(grupper: readonly Styrkegruppe[]): string {
  const perEnhet = new Map<string, Styrkemengde>()
  for (const { mengde } of grupper) {
    if (!mengde) continue
    const s = perEnhet.get(mengde.enhet)
    perEnhet.set(
      mengde.enhet,
      s ? { ...s, fra: Math.min(s.fra, mengde.fra), til: Math.max(s.til, mengde.til) } : { ...mengde },
    )
  }
  return [...perEnhet.values()].map(formaterMengde).join(', ')
}

/** Hele seksjonen, f.eks. «8 preparater · 2 legemiddelformer · 7 styrker · 1 med godkjenningsfritak». */
export function oppsummerPreparatvisning(visning: Preparatvisning): string {
  const alle = [...visning.preparater.values()]
  if (alle.length === 0) return ''
  const styrker = new Set(visning.former.flatMap((f) => f.styrker.map((g) => g.styrke)).filter(Boolean))
  const fritak = antallPreparater(alle.filter((p) => p.merker.some((m) => m.type === 'godkjenningsfritak')).map((p) => p.navn))
  return ramsOpp([
    antall(antallPreparater(alle.map((p) => p.navn)), 'preparat', 'preparater'),
    antall(visning.former.length, 'legemiddelform', 'legemiddelformer'),
    styrker.size > 0 && antall(styrker.size, 'styrke', 'styrker'),
    fritak > 0 && `${fritak} med godkjenningsfritak`,
  ])
}

/** Én form, f.eks. «5 styrker · 50–400 mg · 5 preparater». */
export function oppsummerForm(form: Formgruppe): string {
  return ramsOpp([
    antall(form.styrker.length, 'styrke', 'styrker'),
    spenn(form.styrker),
    antall(antallPreparater(form.styrker.flatMap((g) => g.preparater.map((p) => p.navn))), 'preparat', 'preparater'),
  ])
}

/** Én styrke, f.eks. «5 preparater». */
export function oppsummerStyrke(styrke: Styrkegruppe): string {
  return antall(styrke.preparater.length, 'preparat', 'preparater')
}

/**
 * Byttbarheten i én gruppe som setning, f.eks. «Byttbar i apotek med
 * Amitriptylin Abcur tab 25 mg og Sarotex tab 25 mg.», eller for bare noen
 * av pakningene «Pakningen 2 ml ampulle er byttbar i apotek med …».
 */
export function byttbarhetstekst(b: Pick<Byttbarhet, 'med' | 'pakninger'>): string {
  const med = `i apotek med ${ramsOppMed(b.med)}.`
  if (!b.pakninger) return `Byttbar ${med}`
  return b.pakninger.length === 1
    ? `Pakningen ${b.pakninger[0]} er byttbar ${med}`
    : `Pakningene ${ramsOppMed(b.pakninger)} er byttbare ${med}`
}

/** «A», «A og B», «A, B og C». */
const OG = new Intl.ListFormat('nb', { type: 'conjunction' })
const ramsOppMed = (deler: readonly string[]) => OG.format(deler)

/** Formene som ikke står i ikonregisteret og vises med det generiske ikonet. */
export function ukartlagteFormer(visning: Preparatvisning): { kode: string; tekst: string }[] {
  return visning.former.filter((f) => !f.ikon.kartlagt).map((f) => ({ kode: f.id, tekst: f.form }))
}
