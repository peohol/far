import { useEffect, useId, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { rullefart } from '../hooks/useKortHopp'
import { Ikon } from './ikon/Ikon'

/**
 * Hvor lenge det ventes før en nyåpnet skuff hentes fram i bildet. Litt mer
 * enn `--fart-glid`, så høyden er ferdig glidd ut når det måles.
 */
const ETTER_GLIDNING = 300

/** Det loggene legger fokus på når de åpnes: overskriften i den første føringen. */
export const FORSTE_FORING = '.loggskuff__tittel'

/**
 * Én føring i en logg: appens endringslogg over versjonene og endringsloggen
 * for en side. Overskriften er knappen som åpner, og innholdet glir opp og
 * igjen med `grid-template-rows: 0fr ↔ 1fr` — den eneste måten å gli mot en
 * ukjent høyde på uten å måle den, og den samme som `Details` bruker ellers i
 * appen.
 *
 * Her holder ren CSS, fordi skuffen styres av React og innholdet aldri
 * fjernes: det er nettopp `<details>` som må ha hjelp, siden nettleseren
 * skjuler innholdet momentant når `open` går bort. Lukket skuff settes usynlig
 * med `visibility`, slik at teksten i den heller ikke nås med tabulator eller
 * skjermleser. Stilene står i `endringslogg.css`.
 */
export function Loggskuff({
  apen,
  onVeksle,
  merking,
  sammendrag,
  merker,
  children,
  ...rest
}: {
  apen: boolean
  onVeksle: () => void
  /** Den lille linjen øverst: dato, versjon, hvem. */
  merking: ReactNode
  sammendrag: ReactNode
  merker?: ReactNode
  /** Det som står i skuffen når den er åpen. */
  children: ReactNode
} & Omit<HTMLAttributes<HTMLLIElement>, 'children'>) {
  const id = useId()
  const rad = useRef<HTMLLIElement>(null)

  // En skuff som åpnes nederst i lista skal ikke bli stående utenfor bildet.
  // Rullingen venter til glidningen er over — først da vet vi hvor høy den ble.
  useEffect(() => {
    if (!apen) return
    const el = rad.current
    if (!el) return
    const frist = window.setTimeout(() => el.scrollIntoView({ behavior: rullefart(), block: 'nearest' }), ETTER_GLIDNING)
    return () => window.clearTimeout(frist)
  }, [apen])

  return (
    <li ref={rad} className="loggskuff" data-apen={apen ? 'ja' : 'nei'} {...rest}>
      <button type="button" className="loggskuff__tittel" aria-expanded={apen} aria-controls={id} onClick={onVeksle}>
        <span className="loggskuff__linje">
          <span className="loggskuff__merking">{merking}</span>
          <span className="loggskuff__pil" aria-hidden="true">
            <Ikon navn="chev" storrelse={11} />
          </span>
        </span>
        <span className="loggskuff__sammendrag">{sammendrag}</span>
        {merker && <span className="loggskuff__merker">{merker}</span>}
      </button>

      <div id={id} className="loggskuff__kropp">
        <div className="loggskuff__inner">{children}</div>
      </div>
    </li>
  )
}
