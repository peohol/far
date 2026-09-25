import type { ReactNode } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Details } from './Details'
import { Panelhode } from './Panelhode'
import { ThcForklaring } from './ThcForklaring'
import { ThcPlot } from './ThcPlot'
import { Ikon } from './ikon/Ikon'
import type { ThcResultat } from '../domain/thcMotor'
import type { ThcRegelsett } from '../domain/thcRegelsett'

/**
 * Utfallet av en THC-fortolkning, slik fortolkningsmodulen og simulatoren på
 * analyttsiden viser det: kommentaren eller det som mangler, og kurvene med
 * forklaringen. Modulen legger til kopieringen; simulatoren har ingenting å
 * kopiere.
 */

export function ThcKommentar({
  resultat,
  regler,
  onIngenTidligere,
  handling,
}: {
  resultat: ThcResultat
  regler: ThcRegelsett
  /** Huker av «Ingen tidligere prøve». Uten den står varselet uten knapp. */
  onIngenTidligere?: () => void
  /** Det som står under kommentaren, som kopiknappen. */
  handling?: ReactNode
}) {
  if (resultat.type === 'mangler') {
    return (
      <>
        <Panelhode ikon="fallback" tone="toksisk">
          Mangler
        </Panelhode>
        <ul className="mangelliste">
          {resultat.mangler.map((melding) => (
            <li key={melding}>{melding}</li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <>
      <Panelhode ikon="interp">Kommentar</Panelhode>
      {resultat.langtMellomProvene && (
        <div className="notis notis--handling" role="note">
          <p>
            Det er mer enn {regler.varsel_dager_mellom} dager mellom prøvene. Vurder å huke av «Ingen
            tidligere prøve tilgjengelig».
          </p>
          {onIngenTidligere && (
            <Button variant="kant" icon={<Ikon navn="done" />} onClick={onIngenTidligere}>
              Huk av nå
            </Button>
          )}
        </div>
      )}
      <p className="kommentartekst">{resultat.kommentar}</p>
      {handling}
    </>
  )
}

/** Grunnlaget kurvene og forklaringen tegnes fra: fortolkningen mot en forrige prøve minst ett døgn før. */
function grafgrunnlag(resultat: ThcResultat) {
  return resultat.type === 'kommentar' && resultat.grunnlag && resultat.grunnlag.dager >= 1
    ? { grunnlag: resultat.grunnlag, konklusjon: resultat.konklusjon }
    : null
}

/** Kurvene med forklaringen under, når det er noe å tegne. */
export function ThcKurvebilde({ resultat, regler }: { resultat: ThcResultat; regler: ThcRegelsett }) {
  const graf = grafgrunnlag(resultat)
  if (!graf) return null
  return (
    <>
      <ThcPlot grunnlag={graf.grunnlag} regler={regler} />
      <Details summary="Forklaring" ikon="fallback">
        <ThcForklaring grunnlag={graf.grunnlag} konklusjon={graf.konklusjon} regler={regler} />
      </Details>
    </>
  )
}

/** Kurvene og forklaringen som eget panel i fortolkningsmodulen. */
export function ThcVisualisering({ resultat, regler }: { resultat: ThcResultat; regler: ThcRegelsett }) {
  if (!grafgrunnlag(resultat)) return null
  return (
    <Card align="start" className="thc-plot">
      <Panelhode ikon="hl">Visualisering</Panelhode>
      <ThcKurvebilde resultat={resultat} regler={regler} />
    </Card>
  )
}
