import { useId, type ReactNode } from 'react'
import { DOSEKOLONNER, formaterTall, type Doserad } from '../../faginnhold/paneler'
import {
  REFERANSEOMRADEPROSJEKTET,
  lesSerumtabell,
  type Persentilkolonne,
  type Serumblokk,
} from '../../faginnhold/serumtabell'
import { fold } from '../../faginnhold/sok'
import { Uthev } from '../Uthev'

/**
 * Tabellen over serumkonsentrasjoner ved ulike doser, med samme oppbygning
 * som i kilden (`originaldata/Psykofarmaka.pdf`): én kolonne per dose og én
 * rad hver for antall prøver, 10-persentil, median og 90-persentil, én tabell
 * per stoff, og referanseområdeprosjektet i en egen liten tabell under.
 *
 * Tallene og tekstene er de lagrede, lest tilbake uten tap (`lesSerumtabell`).
 * Rader som ikke har den formen, vises som vanlige rader med kolonnene som er
 * i bruk. Tabellene er ekte HTML-tabeller med rad- og kolonneoverskrifter, og
 * på smale skjermer ruller de sidelengs med den første kolonnen stående.
 */
export function Serumtabell({ rader, tittel }: { rader: readonly Doserad[]; tittel: string }) {
  return (
    <div className="serumtabell">
      {lesSerumtabell(rader).map((blokk, i) => (
        <Blokk key={i} blokk={blokk} tittel={tittel} />
      ))}
    </div>
  )
}

function Blokk({ blokk, tittel }: { blokk: Serumblokk; tittel: string }) {
  switch (blokk.slag) {
    case 'persentiler':
      return <Persentiltabell blokk={blokk} />
    case 'prosjekt':
      return <Prosjekttabell blokk={blokk} />
    case 'rader':
      return <Radtabell rader={blokk.rader} tittel={tittel} />
  }
}

/** En tom celle der kilden ikke har noe tall, som i PDF-en. */
function Celle({ verdi }: { verdi: number | null }) {
  if (verdi === null) {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="kun-skjermleser">ikke oppgitt</span>
      </>
    )
  }
  return <Uthev tekst={formaterTall(verdi)} />
}

/** Rullefeltet rundt en tabell. Det kan nås med tastaturet, så det kan rulles uten mus. */
function Rull({ etikett, children }: { etikett: string; children: ReactNode }) {
  return (
    <div className="serumtabell__rull" role="region" aria-labelledby={etikett} tabIndex={0}>
      {children}
    </div>
  )
}

const PERSENTILRADER: readonly { felt: keyof Omit<Persentilkolonne, 'dose'>; tittel: (enhet: string) => string }[] = [
  { felt: 'antall', tittel: () => 'Antall prøver' },
  { felt: 'p10', tittel: (enhet) => `10-persentil (${enhet})` },
  { felt: 'median', tittel: (enhet) => `Median (${enhet})` },
  { felt: 'p90', tittel: (enhet) => `90-persentil (${enhet})` },
]

/** Kolonnen for alle dosene samlet, som står sist i kilden. */
function erSamlet(dose: string): boolean {
  return fold(dose) === 'alle'
}

function Persentiltabell({ blokk }: { blokk: Extract<Serumblokk, { slag: 'persentiler' }> }) {
  const overskrift = useId()
  // En rad der kilden ikke har et eneste tall, tas ikke med.
  const radene = PERSENTILRADER.filter(({ felt }) => blokk.kolonner.some((k) => k[felt] !== null))
  return (
    <section className="serumtabell__del" aria-labelledby={overskrift}>
      <header className="serumtabell__hode">
        <h3 id={overskrift} className="serumtabell__stoff">
          <Uthev tekst={blokk.stoff} />
        </h3>
        <p className="serumtabell__meta">
          <Uthev tekst={blokk.kilde} />
        </p>
      </header>
      <Rull etikett={overskrift}>
        <table className="serumtabell__tabell serumtabell__tabell--persentiler" aria-labelledby={overskrift}>
          <thead>
            <tr>
              <th scope="col">Dose</th>
              {blokk.kolonner.map((k, i) => (
                <th key={i} scope="col" className="serumtabell__dose" data-samlet={erSamlet(k.dose) || undefined}>
                  <Uthev tekst={k.dose} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {radene.map(({ felt, tittel }) => (
              <tr key={felt} data-felt={felt}>
                <th scope="row">{tittel(blokk.enhet)}</th>
                {blokk.kolonner.map((k, i) => (
                  <td key={i} data-samlet={erSamlet(k.dose) || undefined}>
                    <Celle verdi={k[felt]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Rull>
    </section>
  )
}

function Prosjekttabell({ blokk }: { blokk: Extract<Serumblokk, { slag: 'prosjekt' }> }) {
  const overskrift = useId()
  return (
    <section className="serumtabell__del serumtabell__del--prosjekt" aria-labelledby={overskrift}>
      <header className="serumtabell__hode">
        <h3 id={overskrift} className="serumtabell__stoff">
          <Uthev tekst={`${REFERANSEOMRADEPROSJEKTET.navn}, dose ${blokk.doser}`} />
        </h3>
        <p className="serumtabell__meta">
          <Uthev tekst={`(${REFERANSEOMRADEPROSJEKTET.sted})`} />
        </p>
      </header>
      <table className="serumtabell__tabell serumtabell__tabell--prosjekt" aria-labelledby={overskrift}>
        <tbody>
          <tr data-felt="p10">
            <th scope="row">10-persentil ({blokk.enhet})</th>
            <td>
              <Celle verdi={blokk.p10} />
            </td>
          </tr>
          <tr data-felt="p90">
            <th scope="row">90-persentil ({blokk.enhet})</th>
            <td>
              <Celle verdi={blokk.p90} />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

/** Rader som ikke er en persentiltabell, med kolonnene som faktisk er i bruk. */
function Radtabell({ rader, tittel }: { rader: readonly Doserad[]; tittel: string }) {
  const overskrift = useId()
  const kolonner = DOSEKOLONNER.filter(({ felt }) => rader.some((rad) => rad[felt] !== ''))
  return (
    <Rull etikett={overskrift}>
      <table className="serumtabell__tabell serumtabell__tabell--rader" aria-labelledby={overskrift}>
        <caption id={overskrift} className="kun-skjermleser">
          {tittel}
        </caption>
        <thead>
          <tr>
            {kolonner.map(({ felt, tittel: kolonne }) => (
              <th key={felt} scope="col">
                {kolonne}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rader.map((rad, i) => (
            <tr key={i}>
              {kolonner.map(({ felt }) => (
                <td key={felt}>
                  <Uthev tekst={rad[felt]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Rull>
  )
}
