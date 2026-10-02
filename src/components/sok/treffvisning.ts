import {
  erIdentitetsfelt,
  fold,
  sokeadresse,
  stedsnokkel,
  sti,
  treffgruppe,
  treffIntervaller,
  type Soketreff,
  type Sokefelt,
  type Treffgruppe,
  type Utdrag,
} from '../../faginnhold/sok'
import type { Ikonnavn } from '../ikon/register'
import { seksjonsikon } from '../stoffside/panelvisning'

/**
 * Hvordan et treff i fagsøket vises, i rullegardinen og på søkesiden: en
 * tittel, stien til stedet, et utdrag når treffet står i løpende tekst, og
 * adressen det dyplenker til. Hva som er treff, og i hvilken rekkefølge, avgjør
 * søket (`src/faginnhold/sok.ts`); her står bare presentasjonen.
 */
export interface Treffvisning {
  /** Stedet treffet peker på. Unikt blant treffene i ett søk. */
  nokkel: string
  adresse: string
  gruppe: Treffgruppe
  /** Hva slags treff det er, som står ved siden av i rullegardinen. */
  type: string
  ikon: Ikonnavn
  /** Tittelen, med ordene fra søket markert. */
  tittel: Utdrag
  /** Hvor treffet står, fra siden og innover — uten tittelen selv. */
  sti: string[]
  /** Teksten rundt treffet, når tittelen ikke er selve treffet. */
  utdrag?: Utdrag
}

/** Det som står mens søket bare har en del av fagstoffet, og resten hentes. */
export const HENTER_MER = 'Henter mer fagstoff …'

/** Navnene på gruppene: fanen på søkesiden og overskriften over gruppen. */
export const GRUPPENAVN: Record<Treffgruppe, { fane: string; overskrift: string }> = {
  stoff: { fane: 'Stoff', overskrift: 'Stoff' },
  preparat: { fane: 'Preparater', overskrift: 'Preparater' },
  tekst: { fane: 'Tekst', overskrift: 'I teksten' },
  referanse: { fane: 'Referanser', overskrift: 'Referanser' },
}

const TYPE: Record<Sokefelt, string> = {
  navn: 'Stoff',
  kode: 'Stoff',
  alias: 'Stoff',
  komponent: 'Stoff',
  preparat: 'Preparat',
  overskrift: 'Tekst',
  fritekst: 'Tekst',
  verdi: 'Verdi',
  tabell: 'Tabell',
  referanse: 'Referanse',
}

/** Ikonet for et stoff, som i Atlas-referansen for søket. */
const STOFFIKON: Ikonnavn = 'pk'

/** Stien til referansene nederst på siden, som ikke er en seksjon. */
const REFERANSER = 'Referanser'

/** Linja under navnet på et stoff når det ikke er noe å si om det. */
const FAGSIDE = 'Fagside'

/** Teksten med ordene fra søket markert. */
export function markert(tekst: string, ord: readonly string[]): Utdrag {
  return { tekst, treff: treffIntervaller(tekst, ord) }
}

/**
 * Visningen av et treff. `beskrivSide` gir linja under et stoff, etter
 * nøkkelen — kategorien og analyttene det er koblet til (`stoffbeskrivelse`).
 */
export function visTreff(
  { dokument, utdrag }: Soketreff,
  ord: readonly string[],
  beskrivSide?: (stoff: string) => string | undefined,
): Treffvisning {
  const { sted, felt, tekst } = dokument
  const gruppe = treffgruppe(felt)
  const felles = {
    nokkel: stedsnokkel(sted),
    adresse: sokeadresse(sted),
    gruppe,
    type: TYPE[felt],
    ikon: sted.panel ? (seksjonsikon(sted.panel.nokkel) ?? 'fallback') : STOFFIKON,
  }

  if (erIdentitetsfelt(felt)) {
    // Et annet navn eller en komponent vises under navnet, så det går fram
    // hvorfor siden kom med.
    const annetNavn = felt !== 'navn' && felt !== 'kode' && fold(tekst) !== fold(sted.side.navn)
    return {
      ...felles,
      ikon: STOFFIKON,
      tittel: markert(sted.side.navn, ord),
      sti: [beskrivSide?.(sted.side.stoff) ?? FAGSIDE],
      ...(annetNavn && { utdrag }),
    }
  }
  if (gruppe === 'referanse') {
    return { ...felles, ikon: seksjonsikon('referanser') ?? 'fallback', tittel: utdrag, sti: [sted.side.navn, REFERANSER] }
  }
  // Preparatnavn og overskrifter er selve treffet; i løpende tekst er det
  // kortet eller seksjonen som er tittelen, og treffet står i utdraget.
  if (felt === 'preparat' || felt === 'overskrift') {
    return { ...felles, tittel: utdrag, sti: utenSiste(sti(sted), tekst) }
  }
  const tittel = sted.element?.tittel ?? sted.panel?.tittel ?? sted.side.navn
  return { ...felles, tittel: markert(tittel, ord), sti: utenSiste(sti(sted), tittel), utdrag }
}

/** Stien uten det siste leddet når det er det samme som tittelen. */
function utenSiste(ledd: string[], tittel: string): string[] {
  const siste = ledd[ledd.length - 1]
  return siste !== undefined && fold(siste.trim()) === fold(tittel.trim()) ? ledd.slice(0, -1) : ledd
}
