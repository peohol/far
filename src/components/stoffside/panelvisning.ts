import { FORMVARIANTER, formvariant } from '../../legemiddeldata/legemiddelformer'
import type { Ikonnavn } from '../ikon/register'
import type { Mekanisme } from '../../faginnhold/mekanismer'
import type { Frekvenskode, Gruppenokkel, Organsystemkode } from '../../bivirkninger/modell'

/**
 * Ikonene på stoffsiden: seksjonsikonet for hvert panel, og ikonet for hvert
 * kort i farmakokinetikken. Tegningene står i Atlas-registeret
 * (`src/components/ikon/register.ts`); her står bare hvilket som hører til hva.
 *
 * Ikonene er pynt ved siden av en tittel som alltid står i tekst, så et ikon
 * som mangler eller er feil, endrer aldri hva siden sier.
 */

/** Seksjonsikonet for hver seksjon på siden, etter seksjonens faste nøkkel. */
const SEKSJONSIKONER: Readonly<Record<string, Ikonnavn>> = {
  viktige_data: 'ref',
  farmakodynamikk: 'gears',
  virkninger: 'virkning',
  bivirkninger: 'bivirkning',
  indikasjon: 'indik',
  preparater: 'prep',
  dosering: 'dose',
  farmakokinetikk: 'pk',
  farmakogenetikk: 'dna',
  interaksjoner: 'inter',
  tdm: 'tdm',
  serumkonsentrasjoner: 'serum',
  avhengighet_toleranse: 'avhengighet',
  fortolkning: 'interp',
  referanser: 'refs',
}

/** Ikonet for seksjonen med nøkkelen, eller ingen når den ikke har et eget. */
export function seksjonsikon(nokkel: string): Ikonnavn | undefined {
  return SEKSJONSIKONER[nokkel]
}

/**
 * Kategoriene kortene i farmakokinetikken og de andre kortseksjonene (som TDM)
 * kan høre til, med mønstre for
 * overskriften. Overskriften er fri redaksjonell tekst, så den sammenlignes
 * etter normalisering (små bokstaver, uten aksenter, og senket skrift som
 * vanlige bokstaver: «tₘₐₓ» leses som «tmax»). Den første kategorien som
 * passer, vinner. Passer ingen, får kortet det generiske ikonet.
 */
const KINETIKKATEGORIER: readonly { ikon: Ikonnavn; monster: RegExp }[] = [
  { ikon: 'bio', monster: /biotilgj|bioavail/ },
  { ikon: 'absorp', monster: /absorp/ },
  { ikon: 'peak', monster: /^t ?max\b|maks(imal)?konsentrasjon|c ?max/ },
  { ikon: 'hl', monster: /^t ?(1\/2|1⁄2)|halveringstid/ },
  { ikon: 'ss', monster: /^t ?ss\b|steady.?state/ },
  { ikon: 'protein', monster: /protein/ },
  { ikon: 'dist', monster: /distribu|^v ?d\b|volum/ },
  { ikon: 'metab', monster: /metabol|cyp|enzym/ },
  { ikon: 'elim', monster: /elimin|utskil|ekskresj|clearance/ },
  { ikon: 'inter', monster: /interaksj/ },
  { ikon: 'tdm', monster: /pr[oø]vetak/ },
  { ikon: 'ref', monster: /referanse(omr|grense)/ },
  { ikon: 'indik', monster: /indikasjon/ },
  // De faste kortene i «Avhengighet, toleranse og tilbakeslagseffekter».
  { ikon: 'krykke', monster: /mestring/ },
  { ikon: 'misbruk', monster: /misbruk/ },
  { ikon: 'vane', monster: /vanedann|addiksjon/ },
  { ikon: 'toleranse', monster: /toleranse/ },
  { ikon: 'abstinens', monster: /abstinens|tilbakeslag|rebound|seponering/ },
]

/** Overskriften slik kategoriene sammenlignes: «tₘₐₓ» → «tmax», «Absorpsjon» → «absorpsjon». */
export function normaliserOverskrift(tittel: string): string {
  return tittel
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Ikonet for et kort i farmakokinetikken, etter overskriften. `fallback` når ingen kategori passer. */
export function kinetikkikon(tittel: string): Ikonnavn {
  const normalisert = normaliserOverskrift(tittel)
  return KINETIKKATEGORIER.find(({ monster }) => monster.test(normalisert))?.ikon ?? 'fallback'
}

/**
 * Ikonet for en legemiddelform på t₁/₂- og tₛₛ-kortene i «Viktige data», etter
 * navnet redaktøren har gitt formen («Peroralt», «Depotinjeksjon (Xeplion)»).
 * Samme regler og tegninger som legemiddelformene i «Preparater»
 * (`src/legemiddeldata/legemiddelformer.ts`). `fallback` når ingen regel passer.
 */
export function legemiddelformikon(form: string): Ikonnavn {
  const variant = formvariant(form)
  return variant ? FORMVARIANTER[variant].ikon : 'fallback'
}

/**
 * Hvordan et tekstpanel vises. `lesing` er løpende tekst; `dosering` er ett
 * kort per avsnitt med etiketten foran kolonet (se `doseringskort`), når
 * teksten har den formen.
 */
export type Tekstvisning = 'lesing' | 'dosering'

const TEKSTVISNINGER: Readonly<Record<string, Tekstvisning>> = {
  dosering: 'dosering',
}

export function tekstvisning(nokkel: string): Tekstvisning {
  return TEKSTVISNINGER[nokkel] ?? 'lesing'
}

/**
 * Ikonet for hver mekanisme i farmakodynamikken (`docs/farmakodynamikk-ikoner.md`).
 * De spesifikke mekanismene har sitt eget; de generelle har et nøytralt ikon
 * for familien, som ikke later som kilden sier mer. «Ingen effekt» har
 * bevisst ikke noe ikon.
 */
const MEKANISMEIKONER: Readonly<Record<Mekanisme, Ikonnavn | null>> = {
  agonisme: 'mekAgonisme',
  partiell_agonisme: 'mekPartiellAgonisme',
  antagonisme: 'mekAntagonisme',
  kompetitiv_antagonisme: 'mekKompetitivAntagonisme',
  invers_agonisme: 'mekInversAgonisme',
  positiv_allosterisk_modulering: 'mekPositivModulering',
  negativ_allosterisk_modulering: 'mekNegativModulering',
  reseptorbinding: 'mekReseptor',
  reseptorpavirkning: 'mekReseptor',
  kanalblokkering: 'mekKanalblokkering',
  bruksavhengig_blokkering: 'mekBruksavhengigBlokkering',
  ionekanalpavirkning: 'mekIonekanal',
  reopptakshemming: 'mekReopptakshemming',
  transporterhemming: 'mekTransporterhemming',
  kotransporterhemming: 'mekKotransporterhemming',
  transportorpavirkning: 'mekTransportor',
  enzymhemming: 'mekEnzymhemming',
  ingen_effekt: null,
}

/** Ikonet for mekanismen, eller ingen for «Ingen effekt» og en mekanisme som mangler. */
export function mekanismeikon(mekanisme: Mekanisme | null): Ikonnavn | undefined {
  return (mekanisme && MEKANISMEIKONER[mekanisme]) || undefined
}

/**
 * Ikonet for hver frekvens i «Bivirkninger»: fem prikker der færre er fylt jo
 * sjeldnere bivirkningen er, så nivåene leses i rekkefølge. «Ikke kjent» har
 * ikke noe nivå og får et spørsmålstegn. Ikonet står alltid sammen med navnet.
 */
const FREKVENSIKONER: Readonly<Record<Frekvenskode, Ikonnavn>> = {
  svaert_vanlige: 'frekvens5',
  vanlige: 'frekvens4',
  mindre_vanlige: 'frekvens3',
  sjeldne: 'frekvens2',
  svaert_sjeldne: 'frekvens1',
  ikke_kjent: 'frekvensUkjent',
}

/**
 * Ikonet for hvert organsystem i «Bivirkninger» — det eneste stedet de velges.
 * Et nytt organsystem i `src/bivirkninger/modell.ts` må få et ikon her, ellers
 * bygger ikke appen.
 */
const ORGANSYSTEMIKONER: Readonly<Record<Organsystemkode, Ikonnavn>> = {
  infeksiose: 'orgInfeksjon',
  svulster: 'orgSvulst',
  blod_lymfe: 'orgBlod',
  immunsystemet: 'shield',
  endokrine: 'orgEndokrin',
  stoffskifte: 'orgStoffskifte',
  psykiatriske: 'orgPsykisk',
  nevrologiske: 'orgHjerne',
  oye: 'orgOye',
  ore_labyrint: 'orgOre',
  hjerte: 'heart',
  kar: 'orgKar',
  respirasjon: 'orgLunger',
  gastrointestinale: 'orgMage',
  lever_galle: 'orgLever',
  hud: 'orgHud',
  muskel_skjelett: 'orgSkjelett',
  nyre_urinveier: 'orgNyre',
  svangerskap: 'orgSvangerskap',
  kjonnsorganer_bryst: 'orgKjonn',
  medfodte: 'dna',
  generelle: 'orgGenerell',
  undersokelser: 'serum',
  skader: 'orgSkade',
  prosedyrer: 'orgProsedyre',
  sosiale: 'orgSosial',
  produktproblemer: 'pack',
}

export function frekvensikon(kode: Frekvenskode): Ikonnavn {
  return FREKVENSIKONER[kode]
}

export function organsystemikon(kode: Organsystemkode): Ikonnavn {
  return ORGANSYSTEMIKONER[kode]
}

/** Ikonet for en frekvens eller et organsystem i «Bivirkninger». */
export function bivirkningsikon(nokkel: Gruppenokkel): Ikonnavn {
  return nokkel.slag === 'frekvens' ? frekvensikon(nokkel.kode) : organsystemikon(nokkel.kode)
}
