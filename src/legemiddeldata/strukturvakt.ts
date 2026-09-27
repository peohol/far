/**
 * Strukturkontrollen av et FEST-uttrekk: et sikkerhetsnett mot at DMP endrer
 * navn eller plassering på et felt, så parseren i `fest.ts` stille slutter å
 * lese det, mens antallet poster er som før.
 *
 * Kontrollene er bevisst få og grove. Hver sier hvor stor andel av postene av
 * en type som minst må ha et sentralt felt eller en sentral kobling. Tersklene
 * er satt godt under det dagens data har (målt 26.09.2026, se
 * `docs/legemiddeldata.md`), så enkeltposter som mangler noe, eller vanlige
 * endringer i FEST, aldri stanser synkroniseringen. Det de fanger, er at et
 * felt forsvinner fra nesten alle postene samtidig — det skjer ikke av
 * kliniske grunner.
 *
 * Kontrollen er ren: den ser postene etter hvert som de leses, og
 * {@link Strukturvakt.avvik} gir kontrollene som slo ut, i klartekst.
 */
import type {
  Byttegruppedata,
  Entitetnavn,
  Festpost,
  IkkeVurdertdata,
  Interaksjonsdata,
  Merkevaredata,
  Pakningsdata,
  Styrkedata,
  Virkestoffdata,
} from './fest.js'

/** Formen på dataene for hver type, som `fest.ts` leser dem. */
interface Postdata {
  virkestoff: Virkestoffdata
  virkestoff_styrke: Styrkedata
  merkevare: Merkevaredata
  pakning: Pakningsdata
  byttegruppe: Byttegruppedata
  interaksjon: Interaksjonsdata
  interaksjon_ikke_vurdert: IkkeVurdertdata
}

type Kontroll = {
  [E in Entitetnavn]: {
    entitet: E
    /** Hva andelen gjelder, i klartekst: «virkestoffene har navn». */
    tekst: string
    minsteAndel: number
  } & (
    | { /** Om posten har feltet. */ har: (data: Postdata[E]) => boolean }
    | {
        /** ID-ene posten peker på. Bare poster som peker på noe, telles med. */
        peker: (data: Postdata[E]) => readonly string[]
        /** Typen ID-ene skal finnes blant i samme uttrekk. */
        til: Entitetnavn
      }
  )
}[Entitetnavn]

const harTekst = (t: string | null | undefined) => typeof t === 'string' && t.trim() !== ''

/**
 * Kontrollene. Andelen i dag står i kommentaren; terskelen er satt med god
 * margin under. Et felt som ofte mangler i FEST (ATC, preparatomtale, deling),
 * kontrolleres ikke, eller bare mot en lav terskel.
 */
export const KONTROLLER: readonly Kontroll[] = [
  // 100 %
  { entitet: 'virkestoff', tekst: 'virkestoffene har navn', minsteAndel: 0.9, har: (d) => harTekst(d.navn) },
  // 100 %
  { entitet: 'virkestoff_styrke', tekst: 'styrkene peker på et virkestoff', minsteAndel: 0.9, har: (d) => harTekst(d.virkestoff_id) },
  // 100 %
  {
    entitet: 'virkestoff_styrke',
    tekst: 'styrkene peker på et virkestoff som finnes i uttrekket',
    minsteAndel: 0.9,
    peker: (d) => (harTekst(d.virkestoff_id) ? [d.virkestoff_id] : []),
    til: 'virkestoff',
  },
  // 100 %
  { entitet: 'virkestoff_styrke', tekst: 'styrkene har en verdi', minsteAndel: 0.8, har: (d) => d.styrke !== null },
  // 100 %
  { entitet: 'merkevare', tekst: 'merkevarene har varenavn', minsteAndel: 0.9, har: (d) => harTekst(d.varenavn) },
  // 100 %
  { entitet: 'merkevare', tekst: 'merkevarene har navn med form og styrke', minsteAndel: 0.9, har: (d) => harTekst(d.navn_form_styrke) },
  // 100 %
  { entitet: 'merkevare', tekst: 'merkevarene har legemiddelform', minsteAndel: 0.9, har: (d) => d.legemiddelform !== null },
  // 100 % (97 % med styrke, 3 % uten)
  {
    entitet: 'merkevare',
    tekst: 'merkevarene peker på virkestoff',
    minsteAndel: 0.9,
    har: (d) => d.virkestoff_med_styrke.length > 0 || d.virkestoff_uten_styrke.length > 0,
  },
  // 100 % av dem som har styrker
  {
    entitet: 'merkevare',
    tekst: 'merkevarene peker på styrker som finnes i uttrekket',
    minsteAndel: 0.9,
    peker: (d) => d.virkestoff_med_styrke,
    til: 'virkestoff_styrke',
  },
  // 97 %
  { entitet: 'merkevare', tekst: 'merkevarene har ATC-kode', minsteAndel: 0.7, har: (d) => d.atc !== null },
  // 100 %
  { entitet: 'merkevare', tekst: 'merkevarene har reseptgruppe', minsteAndel: 0.8, har: (d) => d.reseptgruppe !== null },
  // 100 %
  { entitet: 'merkevare', tekst: 'merkevarene har administrasjonsvei', minsteAndel: 0.8, har: (d) => d.administrasjonsveier.length > 0 },
  // 100 %
  { entitet: 'pakning', tekst: 'pakningene har varenummer', minsteAndel: 0.9, har: (d) => harTekst(d.varenr) },
  // 100 %
  { entitet: 'pakning', tekst: 'pakningene peker på en merkevare', minsteAndel: 0.9, har: (d) => d.merkevarer.length > 0 },
  // 100 %
  {
    entitet: 'pakning',
    tekst: 'pakningene peker på merkevarer som finnes i uttrekket',
    minsteAndel: 0.9,
    peker: (d) => d.merkevarer,
    til: 'merkevare',
  },
  // 43 %: mange pakninger er ikke byttbare, men at nesten ingen er det, er et brudd.
  { entitet: 'pakning', tekst: 'pakningene hører til en byttegruppe', minsteAndel: 0.15, har: (d) => d.byttegrupper.length > 0 },
  // 100 % av dem som har byttegruppe
  {
    entitet: 'pakning',
    tekst: 'pakningene peker på byttegrupper som finnes i uttrekket',
    minsteAndel: 0.9,
    peker: (d) => d.byttegrupper,
    til: 'byttegruppe',
  },
  // 100 %
  { entitet: 'byttegruppe', tekst: 'byttegruppene har kode', minsteAndel: 0.9, har: (d) => harTekst(d.kode) },
  // 100 %
  { entitet: 'interaksjon', tekst: 'interaksjonene har relevans', minsteAndel: 0.9, har: (d) => d.relevans !== null },
  // 100 %
  {
    entitet: 'interaksjon',
    tekst: 'interaksjonene har to substansgrupper med stoffer',
    minsteAndel: 0.9,
    har: (d) => d.substansgrupper.length === 2 && d.substansgrupper.every((g) => g.substanser.length > 0),
  },
  // 100 %
  { entitet: 'interaksjon', tekst: 'interaksjonene har klinisk konsekvens', minsteAndel: 0.8, har: (d) => harTekst(d.klinisk_konsekvens) },
  // 100 %
  { entitet: 'interaksjon_ikke_vurdert', tekst: 'ATC-kodene som ikke er vurdert, har kode', minsteAndel: 0.9, har: (d) => d.atc.length > 0 },
]

/** En kontroll som slo ut. */
export interface Strukturavvik {
  entitet: Entitetnavn
  tekst: string
  /** Andelen i uttrekket, mellom 0 og 1. */
  andel: number
  minsteAndel: number
  antall: number
}

function prosent(andel: number): string {
  return `${Math.floor(andel * 100)} %`
}

/** Avvikene som én setning, til loggen og panelet «Datakilder». */
export function avvikstekst(avvik: readonly Strukturavvik[]): string {
  const deler = avvik.map(
    (a) => `bare ${prosent(a.andel)} av de ${a.antall} ${a.tekst} (krever minst ${prosent(a.minsteAndel)})`,
  )
  return (
    `Strukturkontrollen stoppet FEST-uttrekket, trolig fordi DMP har endret formen på filen: ${deler.join('; ')}. ` +
    'Ingenting er byttet inn.'
  )
}

export class Strukturvakt {
  private readonly ider = new Map<Entitetnavn, Set<string>>()
  private readonly treff = KONTROLLER.map(() => ({ antall: 0, ok: 0 }))
  /** For kontrollene av koblinger: ID-ene hver post peker på, til alle ID-ene er kjent. */
  private readonly pekere = KONTROLLER.map(() => [] as (readonly string[])[])

  constructor(private readonly kontroller: readonly Kontroll[] = KONTROLLER) {}

  se(post: Festpost): void {
    let ider = this.ider.get(post.entitet)
    if (!ider) this.ider.set(post.entitet, (ider = new Set()))
    ider.add(post.fest_id)
    this.kontroller.forEach((k, i) => {
      if (k.entitet !== post.entitet) return
      // Kontrollen gjelder typen til posten, så dataene har formen den venter.
      const data = post.data as never
      if ('har' in k) {
        this.treff[i]!.antall += 1
        if (k.har(data)) this.treff[i]!.ok += 1
      } else {
        const ut = k.peker(data)
        if (ut.length > 0) this.pekere[i]!.push(ut)
      }
    })
  }

  /**
   * Kontrollene som slo ut. En type uten poster, og koblinger til den,
   * kontrolleres ikke her; den avvises av antallskontrollen.
   */
  avvik(): Strukturavvik[] {
    const ut: Strukturavvik[] = []
    this.kontroller.forEach((k, i) => {
      let { antall, ok } = this.treff[i]!
      if ('til' in k) {
        const finnes = this.ider.get(k.til)
        // En type uten poster avvises av antallskontrollen i databasen, med sin egen melding.
        if (!finnes) return
        antall = this.pekere[i]!.length
        ok = this.pekere[i]!.filter((ider) => ider.every((id) => finnes.has(id))).length
      }
      if (antall === 0) return
      const andel = ok / antall
      if (andel < k.minsteAndel) ut.push({ entitet: k.entitet, tekst: k.tekst, andel, minsteAndel: k.minsteAndel, antall })
    })
    return ut
  }
}
