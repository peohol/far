/**
 * Preparatene på en stoffside, slik seksjonen «Preparater» viser dem:
 * `legemiddelform → preparat → styrker`, med pakningene i detaljkortene.
 *
 * Alt her er avledet av legemiddeldataene fra FEST ({@link Legemiddelutvalg})
 * og virkestoffene siden er koblet til. Ingenting legges til, rettes eller
 * slås sammen på skjønn: formene, navnene og styrkene er FESTs egne. Det som
 * gjøres, er å gruppere, sortere og skrive styrkene på norsk form.
 *
 * - Et **preparat** er et varenavn i én legemiddelform. Styrkene er
 *   merkevarene med det varenavnet i den formen.
 * - **Salter og estere** av et koblet virkestoff hører til siden, og saltet
 *   står på preparatet.
 * - Et **kombinasjonspreparat** har flere virkestoff med styrke; de andre
 *   virkestoffene står på preparatet.
 * - Preparater som krever **godkjenningsfritak** (uten markedsføringstillatelse
 *   i Norge), står for seg og telles ikke med i oppsummeringen av de andre.
 */
import { antall, ramsOpp } from '../faginnhold/oppsummering'
import { iSetning } from '../domain/names'
import { alfabetisk, formaterTall } from '../faginnhold/paneler'
import type { Mengde } from './fest'
import type { Legemiddelutvalg } from './lesing'

/** Preparattypen FEST bruker for preparater som krever godkjenningsfritak. */
export const GODKJENNINGSFRITAK = '11'

/** Én pakning av en merkevare. */
export interface Preparatpakning {
  id: string
  varenr: string
  /** F.eks. «100 stk, blisterpakning». */
  tekst: string
  /** Datoen pakningen er meldt midlertidig utgått, når den er det. */
  midlertidig_utgatt: string | null
}

/** En styrke som tall: `fra` og `til` er like når den ikke er et intervall. */
export interface Styrkemengde {
  fra: number
  til: number
  /** Enheten med det styrken er per, f.eks. «mg», «mg/ml» eller «mg/5 ml». */
  enhet: string
}

/** Preparatet i én styrke: én merkevare i FEST, eller flere med samme styrke. */
export interface Preparatstyrke {
  /** Den første merkevaren med styrken. */
  id: string
  /** Styrken, f.eks. «25 mg» eller «10 mg/5 ml». For kombinasjoner alle virkestoffene. */
  styrke: string
  /** Styrken som tall, for ett virkestoff; `null` for kombinasjoner og uten styrke. */
  mengde: Styrkemengde | null
  /** FESTs eget navn med form og styrke, f.eks. «Sarotex tab 25 mg». */
  navn_form_styrke: string
  reseptgruppe: string | null
  produsent: string | null
  pakninger: Preparatpakning[]
}

export interface Preparat {
  /** Fast nøkkel: formens kode og varenavnet. */
  id: string
  navn: string
  form: string
  /** FESTs lange form når den sier mer enn den korte, f.eks. «Tablett, filmdrasjert». */
  langform: string[]
  /** Saltene eller esterne av sidens virkestoff preparatet inneholder. */
  salter: string[]
  /** De andre virkestoffene, når preparatet er en kombinasjon. */
  kombinasjon: string[]
  /** Preparattypen når den ikke er et vanlig legemiddel, f.eks. «Sykehuspreparat». */
  type: string | null
  styrker: Preparatstyrke[]
}

export interface Legemiddelform {
  /** Fast nøkkel: FESTs kode for formen. */
  id: string
  form: string
  preparater: Preparat[]
}

export interface Preparatoversikt {
  former: Legemiddelform[]
  /** Preparatene som krever godkjenningsfritak, alfabetisk. */
  godkjenningsfritak: Preparat[]
}

/** Typer som er vanlige legemidler og ikke trenger å stå på preparatet. */
const VANLIGE_TYPER = new Set(['7', GODKJENNINGSFRITAK])

export function byggPreparatoversikt(utvalg: Legemiddelutvalg, koblet: readonly string[]): Preparatoversikt {
  const virkestoff = new Map(utvalg.virkestoff.map((v) => [v.id, v]))
  const styrker = new Map(utvalg.styrker.map((s) => [s.id, s]))

  // Sidens virkestoff med saltene sine; saltene husker hvilket de hører til.
  const egne = new Set<string>(koblet)
  const salter = new Set<string>()
  for (const id of koblet) {
    for (const salt of virkestoff.get(id)?.salter ?? []) {
      egne.add(salt)
      salter.add(salt)
    }
  }

  const pakningerFor = new Map<string, Preparatpakning[]>()
  for (const p of utvalg.pakninger) {
    for (const innhold of p.innhold) {
      // Noen pakninger oppgir mengden i stedet for pakningsstørrelsen.
      const storrelse = innhold.pakningsstorrelse ?? innhold.mengde
      const liste = pakningerFor.get(innhold.merkevare_id) ?? []
      liste.push({
        id: p.id,
        varenr: p.varenr,
        tekst: [
          storrelse !== null && `${formaterTall(storrelse)} ${innhold.enhet?.kode ?? ''}`.trim(),
          innhold.pakningstype?.tekst.toLocaleLowerCase('nb'),
        ]
          .filter(Boolean)
          .join(', '),
        midlertidig_utgatt: p.midlertidig_utgatt_dato,
      })
      pakningerFor.set(innhold.merkevare_id, liste)
    }
  }

  const preparater = new Map<string, Preparat & { fritak: boolean; formkode: string }>()
  for (const m of utvalg.merkevarer) {
    const formkode = m.legemiddelform?.kode ?? 'ukjent'
    const form = m.legemiddelform?.tekst || 'Ukjent legemiddelform'
    const nokkel = `${formkode}:${m.varenavn}`
    const mine = m.virkestoff_med_styrke.map((id) => styrker.get(id)).filter((s) => s !== undefined)
    const stoff = [...mine.map((s) => s.virkestoff_id), ...m.virkestoff_uten_styrke]
    const andre = stoff.filter((id) => !egne.has(id))
    const kombinert = andre.length > 0

    const preparat = preparater.get(nokkel) ?? {
      id: nokkel,
      navn: m.varenavn,
      form,
      formkode,
      langform: [],
      salter: [],
      kombinasjon: [],
      type: m.preparattype && !VANLIGE_TYPER.has(m.preparattype.kode) ? m.preparattype.tekst : null,
      fritak: m.preparattype?.kode === GODKJENNINGSFRITAK,
      styrker: [],
    }
    if (m.legemiddelform_lang && m.legemiddelform_lang !== form) leggTil(preparat.langform, [m.legemiddelform_lang])
    leggTil(preparat.salter, stoff.filter((id) => salter.has(id)).map((id) => virkestoff.get(id)?.navn))
    leggTil(preparat.kombinasjon, andre.map((id) => virkestoff.get(id)?.navn))
    const mengder = mine.map((s) => styrkemengde(s.styrke, s.ovre, s.nevner))
    const styrke: Preparatstyrke = {
      id: m.id,
      styrke: mine
        .map((s, i) => {
          const tekst = formaterMengde(mengder[i] ?? null)
          const navn = virkestoff.get(s.virkestoff_id)?.navn
          return kombinert && navn ? `${iSetning(navn)} ${tekst}`.trim() : tekst
        })
        .filter(Boolean)
        .join(' + '),
      mengde: !kombinert && mengder.length === 1 ? (mengder[0] ?? null) : null,
      navn_form_styrke: m.navn_form_styrke,
      reseptgruppe: m.reseptgruppe?.kode ?? null,
      produsent: m.produsent,
      pakninger: pakningerFor.get(m.id) ?? [],
    }
    // Samme preparat i samme styrke kan være flere merkevarer i FEST, f.eks.
    // med hver sine pakninger. Det er én styrke å vise, med alle pakningene.
    const lik = preparat.styrker.find((x) => x.styrke === styrke.styrke)
    if (lik) lik.pakninger.push(...styrke.pakninger.filter((p) => !lik.pakninger.some((q) => q.id === p.id)))
    else preparat.styrker.push(styrke)
    preparater.set(nokkel, preparat)
  }

  const alle = [...preparater.values()].map((p) => {
    for (const styrke of p.styrker) {
      styrke.pakninger.sort((a, b) => a.tekst.localeCompare(b.tekst, 'nb', { numeric: true }))
    }
    p.styrker.sort(
      (a, b) =>
        (a.mengde?.fra ?? 0) - (b.mengde?.fra ?? 0) ||
        a.styrke.localeCompare(b.styrke, 'nb', { numeric: true }) ||
        alfabetisk(a.navn_form_styrke, b.navn_form_styrke),
    )
    p.salter.sort(alfabetisk)
    return p
  })
  const iRekkefolge = (a: Preparat, b: Preparat) => alfabetisk(a.navn, b.navn) || alfabetisk(a.form, b.form)

  const former = new Map<string, Legemiddelform>()
  for (const p of alle.filter((p) => !p.fritak)) {
    const form = former.get(p.formkode) ?? { id: p.formkode, form: p.form, preparater: [] }
    form.preparater.push(fjernIntern(p))
    former.set(p.formkode, form)
  }
  return {
    former: [...former.values()]
      .map((f) => ({ ...f, preparater: f.preparater.sort(iRekkefolge) }))
      .sort((a, b) => alfabetisk(a.form, b.form)),
    godkjenningsfritak: alle.filter((p) => p.fritak).map(fjernIntern).sort(iRekkefolge),
  }
}

function fjernIntern({ fritak: _f, formkode: _k, ...preparat }: Preparat & { fritak: boolean; formkode: string }): Preparat {
  return preparat
}

function leggTil(liste: string[], navn: readonly (string | undefined)[]) {
  for (const n of navn) if (n && !liste.includes(n)) liste.push(n)
}


/** Styrken fra FEST som tall og enhet. `null` uten styrke. */
export function styrkemengde(styrke: Mengde | null, ovre: Mengde | null = null, nevner: Mengde | null = null): Styrkemengde | null {
  if (!styrke) return null
  const per = nevner ? `/${nevner.verdi === 1 ? '' : `${formaterTall(nevner.verdi)} `}${nevner.enhet}` : ''
  return { fra: styrke.verdi, til: ovre?.verdi ?? styrke.verdi, enhet: `${styrke.enhet}${per}` }
}

/** «25 mg», «10–20 mg», «50 mg/5 ml» eller «2 mg/ml». Tom uten styrke. */
export function formaterMengde(mengde: Styrkemengde | null): string {
  if (!mengde) return ''
  const { fra, til, enhet } = mengde
  const tall = fra === til ? formaterTall(fra) : `${formaterTall(fra)}–${formaterTall(til)}`
  return `${tall} ${enhet}`.trim()
}

/* --- Oppsummeringene ------------------------------------------------------- */

function styrkerI(preparater: readonly Preparat[]): string[] {
  return [...new Set(preparater.flatMap((p) => p.styrker.map((s) => s.styrke)).filter(Boolean))]
}

function antallPreparater(preparater: readonly Preparat[]): number {
  return new Set(preparater.map((p) => p.navn.toLocaleLowerCase('nb'))).size
}

/** Hele seksjonen, f.eks. «12 preparater · 3 legemiddelformer · 6 styrker». */
export function oppsummerPreparater(oversikt: Preparatoversikt): string {
  const registrerte = oversikt.former.flatMap((f) => f.preparater)
  const fritak = antallPreparater(oversikt.godkjenningsfritak)
  return ramsOpp([
    registrerte.length > 0 && antall(antallPreparater(registrerte), 'preparat', 'preparater'),
    registrerte.length > 0 && antall(oversikt.former.length, 'legemiddelform', 'legemiddelformer'),
    registrerte.length > 0 && antall(styrkerI(registrerte).length, 'styrke', 'styrker'),
    fritak > 0 && `${fritak} med godkjenningsfritak`,
  ])
}

/**
 * Én gruppe preparater, f.eks. «4 preparater · 10–75 mg»: antallet, og
 * styrkene som et spenn per enhet. Kombinasjonene er med i antallet, men ikke i
 * spennet.
 */
export function oppsummerGruppe(preparater: readonly Preparat[]): string {
  const perEnhet = new Map<string, Styrkemengde>()
  for (const { mengde } of preparater.flatMap((p) => p.styrker)) {
    if (!mengde) continue
    const spenn = perEnhet.get(mengde.enhet)
    perEnhet.set(
      mengde.enhet,
      spenn ? { ...spenn, fra: Math.min(spenn.fra, mengde.fra), til: Math.max(spenn.til, mengde.til) } : { ...mengde },
    )
  }
  return ramsOpp([
    antall(antallPreparater(preparater), 'preparat', 'preparater'),
    [...perEnhet.values()].map(formaterMengde).join(', '),
  ])
}
