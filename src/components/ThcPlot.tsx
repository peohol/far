import { useMemo } from 'react'
import { byggGraf, formaterProsent } from '../domain/thcPlot'
import type { ThcGrafgrunnlag } from '../domain/thc'

/**
 * Visualiseringen av en fortolkning mot forrige prøve: de tre
 * utskillelseskurvene som prosentvis endring fra forrige prøve, med forrige
 * og denne prøven som punkter. Ligger den korrigerte endringen over en
 * kurve, har konsentrasjonen falt mindre enn kurven tilsier.
 *
 * Ren SVG i appens egne farger, så figuren følger temaet. Bare rutenett —
 * ingen ramme eller akselinjer — og tallene på y-aksen står til høyre.
 * Legenden ligger utenfor figuren, i vanlig HTML, slik at hvert kurvenavn
 * kan bære et tips om hva profilen står for.
 */

const BREDDE = 900
const HOYDE = 430

/** Luft rundt tegneflaten: dagene under, prosentene til høyre. */
const MARG = { topp: 26, hoyre: 100, bunn: 72, venstre: 24 }

/** Hva hver utskillelsesprofil står for — vises som tips på legenden. */
const PROFILTIPS: Record<'gronn' | 'gul' | 'rod', string> = {
  gronn:
    'Denne utskillelsesprofilen anses å være relativt representativ for brukere flest ved moderat bruk av cannabis, dog tregere enn det som vanligvis sees etter et enkeltinntak.',
  gul: 'Denne utskillelsesprofilen anses å være tregere enn det som kan sees etter et enkeltinntak. Den er trolig også noe tregere enn forventet – men fortsatt innenfor det som er mulig – hos de kroniske brukere.',
  rod: 'Dette er den mest ekstreme utskillelsesprofilen som noensinne har blitt dokumentert. Vi har per dags dato ikke sett eksempler på at THC-syre kan skilles ut saktere enn dette.',
}

export function ThcPlot({ grunnlag }: { grunnlag: ThcGrafgrunnlag }) {
  const graf = useMemo(() => byggGraf(grunnlag), [grunnlag])

  const venstre = MARG.venstre
  const hoyre = BREDDE - MARG.hoyre
  const topp = MARG.topp
  const bunn = HOYDE - MARG.bunn

  const x = (dag: number) => venstre + (dag / graf.xMaks) * (hoyre - venstre)
  const y = (prosent: number) =>
    topp + ((graf.yTopp - prosent) / (graf.yTopp - graf.yBunn)) * (bunn - topp)

  const yMerker: number[] = []
  for (let v = graf.yBunn; v <= graf.yTopp + 1e-6; v += graf.ySteg) yMerker.push(v)

  const xMerker: number[] = []
  for (let dag = 0; dag <= graf.xMaks + 1e-6; dag += graf.xSteg) xMerker.push(dag)

  return (
    <>
      <div className="thc-legende">
        {graf.kurver.map((kurve) => (
          // Tipset ligger som nabo til navnet, etter samme mønster som
          // kommentartipsene over båndknappene: navnet bærer pilen, tipset
          // spenner over hele legenden.
          <span key={kurve.tone} className="thc-legende__oppforing">
            <span
              className="thc-legende__punkt"
              tabIndex={0}
              aria-describedby={`thc-profiltips-${kurve.tone}`}
            >
              <span
                className={`thc-legende__strek thc-legende__strek--${kurve.tone}`}
                aria-hidden="true"
              />
              {/* Prikkestreken under navnet er hintet om at det er noe å
                  hente ved å holde pekeren over. */}
              <span className="thc-legende__navn">{kurve.navn}</span>
            </span>
            <span className="thc-profiltips" id={`thc-profiltips-${kurve.tone}`} role="tooltip">
              {PROFILTIPS[kurve.tone]}
            </span>
          </span>
        ))}
      </div>

      <svg
        className="thc-plot__figur"
        viewBox={`0 0 ${BREDDE} ${HOYDE}`}
        role="img"
        aria-label="Forventet prosentvis endring i IRCAK etter utskillelseskurvene, sammenlignet med denne prøven"
      >
        {yMerker.map((verdi) => (
          <g key={`y${verdi}`}>
            <line className="thc-plot__rute" x1={venstre} y1={y(verdi)} x2={hoyre} y2={y(verdi)} />
            <text className="thc-plot__verdi" x={hoyre + 12} y={y(verdi)} dominantBaseline="middle">
              {formaterProsent(verdi)}
            </text>
          </g>
        ))}

        {xMerker.map((dag) => (
          <g key={`x${dag}`}>
            <line className="thc-plot__rute" x1={x(dag)} y1={topp} x2={x(dag)} y2={bunn} />
            <text className="thc-plot__verdi" x={x(dag)} y={bunn + 26} textAnchor="middle">
              {Math.round(dag)}
            </text>
          </g>
        ))}

        {graf.kurver.map((kurve) => (
          <polyline
            key={kurve.navn}
            className={`thc-plot__kurve thc-plot__kurve--${kurve.tone}`}
            points={kurve.punkter.map((p) => `${x(p.dag).toFixed(1)},${y(p.prosent).toFixed(1)}`).join(' ')}
          />
        ))}

        {graf.punkter.map((punkt) => {
          // Etiketten legges på den siden av punktet der det er plass til den.
          const motVenstre = punkt.dag > graf.xMaks / 2
          const under = y(punkt.prosent) < topp + 24
          return (
            <g key={punkt.navn}>
              <circle className="thc-plot__punkt" cx={x(punkt.dag)} cy={y(punkt.prosent)} r={7} />
              <text
                className="thc-plot__etikett"
                x={x(punkt.dag) + (motVenstre ? -13 : 13)}
                y={y(punkt.prosent) + (under ? 27 : -13)}
                textAnchor={motVenstre ? 'end' : 'start'}
              >
                {punkt.navn}
              </text>
            </g>
          )
        })}

        <text
          className="thc-plot__akselnavn"
          x={(venstre + hoyre) / 2}
          y={HOYDE - 16}
          textAnchor="middle"
        >
          Dager siden forrige prøve
        </text>
      </svg>
    </>
  )
}
