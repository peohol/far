import type { Formikon } from '../../legemiddeldata/legemiddelformer'
import type { Handtering, Handteringsvalg } from '../../legemiddeldata/preparater'
import type { Preparatmerke } from '../../legemiddeldata/preparatmodell'
import { Ikon } from '../ikon/Ikon'
import { IKONER, type Ikonnavn } from '../ikon/register'
import { Merke, type Merketone } from '../Merke'

/** Ikonet for en legemiddelform. En form registeret ikke kjenner, får det generiske. */
export function formikonnavn(ikon: Formikon): Ikonnavn {
  return ikon.ikon in IKONER ? (ikon.ikon as Ikonnavn) : 'fallback'
}

const MERKER: Record<Preparatmerke['type'], { tone: Merketone; tekst: (m: Preparatmerke) => string }> = {
  godkjenningsfritak: { tone: 'fritak', tekst: () => 'Godkjenningsfritak' },
  preparattype: { tone: 'noytral', tekst: (m) => m.tekst },
  kombinasjon: { tone: 'noytral', tekst: (m) => `Kombinasjon med ${m.tekst}` },
}

/** Merkene på et preparat: godkjenningsfritak, preparattype og kombinasjon. */
export function Preparatmerker({ merker }: { merker: readonly Preparatmerke[] }) {
  return merker.map((m) => {
    const { tone, tekst } = MERKER[m.type]
    return (
      <Merke key={`${m.type}:${m.tekst}`} tone={tone}>
        {tekst(m)}
      </Merke>
    )
  })
}

const HANDLINGER: Record<keyof Handtering, { ikon: Ikonnavn; navn: string; egenTekst: boolean }> = {
  // Delingen står med FESTs egne ord («Delbar i 2»), som sier mer enn ja.
  deling: { ikon: 'split', navn: 'Deling', egenTekst: true },
  knusing: { ikon: 'crush', navn: 'Knusing', egenTekst: false },
  apning: { ikon: 'capsule', navn: 'Åpning', egenTekst: false },
}

const STATUS: Record<Exclude<Handteringsvalg['status'], 'ukjent'>, { ikon: Ikonnavn; tekst: string }> = {
  ja: { ikon: 'yes', tekst: 'Ja' },
  nei: { ikon: 'no', tekst: 'Nei' },
  varierer: { ikon: 'na', tekst: 'Varierer' },
}

/**
 * Deling, knusing og åpning som små statusmerker, bare det FEST faktisk sier
 * (Atlas: `HandlingChip`). «Ukjent» vises ikke. Statusen står i tekst, ikke
 * bare i ikonet.
 */
export function Handteringsmerker({ handtering }: { handtering: Handtering }) {
  return (Object.keys(HANDLINGER) as (keyof Handtering)[]).map((handling) => {
    const valg = handtering[handling]
    if (valg.status === 'ukjent') return null
    const { ikon, navn, egenTekst } = HANDLINGER[handling]
    const status = STATUS[valg.status]
    const verdi = (egenTekst || valg.status === 'varierer') && valg.tekst ? valg.tekst : status.tekst
    return (
      <span key={handling} className="handteringsmerke" title={valg.tekst ?? undefined} data-ih="">
        <Ikon navn={ikon} className="handteringsmerke__ikon" />
        {navn}
        <span className="kun-skjermleser">: </span>
        <Ikon navn={status.ikon} className="handteringsmerke__status" />
        <span className="handteringsmerke__verdi">{verdi}</span>
      </span>
    )
  })
}
