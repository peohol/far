import { rusVerdifelter, TOM_RUS_INNDATA, type RusInndata, type RusModul, type RusPlassering } from '../../domain/rus'
import type { Kommentaroppslag } from '../../domain/kommentarobjekt'
import {
  flettInn,
  kjorScenarier,
  verdifelter as verdifelterFor,
  type Scenarioregelsett,
  type Scenariotreff,
} from '../../domain/scenario'
import { beskrivForhold, formaterAndel, type Scenariobeskrivelse } from '../../domain/scenariovisning'
import { ramsOpp } from '../../faginnhold/oppsummering'
import { Button } from '../Button'
import { Rusutfall } from '../Rusutfall'
import { Rusvalg } from '../Rusvalg'
import { Detaljkort } from '../seksjoner/Seksjon'

/**
 * Delene scenarioreglene på analyttsiden og redigeringen av dem har felles:
 * kodene, vilkårene i et scenario og simulatoren. Simulatoren prøver det
 * regelsettet den får — det publiserte, eller utkastet slik det står i
 * skjemaet.
 */

/** Kjører regelsettet, men lar et regelsett som ikke er gyldig, gi `null` i stedet for å velte siden. */
export function provKjor(
  regelsett: Scenarioregelsett,
  kommentarer: Kommentaroppslag,
  inndata: RusInndata,
): Scenariotreff | null {
  try {
    return kjorScenarier(regelsett, kommentarer, inndata)
  } catch {
    return null
  }
}

/** Hva som må være påvist og gjelde for at scenariet skal gjelde. */
export function Scenariovilkar({ beskrivelse }: { beskrivelse: Scenariobeskrivelse }) {
  const { pavist, ikkePavist, vilkar } = beskrivelse
  return (
    <div className="scenario__vilkar">
        <p>
          <span className="scenario__etikett">Påvist</span> <Koder koder={pavist} />
        </p>
        {ikkePavist.length > 0 && (
          <p>
            <span className="scenario__etikett">Ikke påvist</span> <Koder koder={ikkePavist} />
          </p>
        )}
        {vilkar.map((v) => (
          <p key={v}>
            <span className="scenario__etikett">Og</span> <span className="scenario__uttrykk">{v}</span>
          </p>
        ))}
    </div>
  )
}

const OG = new Intl.ListFormat('nb', { type: 'conjunction' })

/** Kodene som en liste: «DIAZ, DMI og OXA». */
export function Koder({ koder }: { koder: readonly string[] }) {
  const deler = OG.formatToParts(koder)
  return (
    <>
      {deler.map((del, i) =>
        del.type === 'element' ? (
          <code key={i} className="scenario__kode">
            {del.value}
          </code>
        ) : (
          del.value
        ),
      )}
    </>
  )
}

export function Simulator({
  modul,
  regelsett,
  beskrivelse,
  inndata,
  treff,
  onEndre,
  tittel = 'Prøv reglene',
}: {
  modul: RusModul
  regelsett: Scenarioregelsett
  beskrivelse: Scenariobeskrivelse[]
  inndata: RusInndata
  treff: Scenariotreff | null
  onEndre: (inndata: RusInndata) => void
  tittel?: string
}) {
  const felter = rusVerdifelter(modul, verdifelterFor(regelsett, inndata.pavist))
  const nummer = treff?.scenario ? beskrivelse.findIndex((b) => b.scenario === treff.scenario) + 1 : 0

  return (
    <Detaljkort
      id="simulator"
      tittel={tittel}
      oppsummering={ramsOpp(modul.analytter.map((a) => a.kode))}
      handlinger={
        <Button variant="subtle" className="redigeringsknapp" onClick={() => onEndre(TOM_RUS_INNDATA)}>
          Nullstill
        </Button>
      }
      className="simulator"
    >
      <p className="regler__ingress">
        Kryss av og fyll inn tall slik som i fortolkningen. Scenariet som gjelder, markeres i lista over.
      </p>
      <Rusvalg
        analytter={modul.analytter}
        pavist={inndata.pavist}
        verdifelter={felter}
        verdier={inndata.verdier}
        verdihjelp={flettInn(regelsett.verdihjelp, regelsett.parametere)}
        onPavist={(kode, pa) =>
          onEndre({
            ...inndata,
            pavist: pa ? [...inndata.pavist, kode] : inndata.pavist.filter((k) => k !== kode),
          })
        }
        onVerdi={(kode, verdi) => onEndre({ ...inndata, verdier: { ...inndata.verdier, [kode]: verdi } })}
      />

      <div className="simulator__resultat">
        <p className="simulator__scenario" role="status">
          {treff === null
            ? 'Regelsettet gir ikke nøyaktig ett scenario for dette svaret.'
            : nummer > 0
              ? `Scenario ${nummer} gjelder${[...treff.forhold]
                  .map(([nokkel, andel]) => {
                    const forhold = regelsett.forhold.find((f) => f.nokkel === nokkel)
                    return forhold ? `, ${beskrivForhold(forhold)} = ${formaterAndel(andel)}` : ''
                  })
                  .join('')}.`
              : 'Ingen scenario gjelder ennå.'}
        </p>
        {treff && (
          <Rusutfall
            resultat={treff.resultat}
            kommentarer={(plasseringer) => <Plasseringer plasseringer={plasseringer} />}
          />
        )}
      </div>
    </Detaljkort>
  )
}

/** Kommentarene simulatoren fant, med kodene de limes inn på — bare til å lese. */
function Plasseringer({ plasseringer }: { plasseringer: RusPlassering[] }) {
  return (
    <ol className="plasseringer">
      {plasseringer.map((p) => (
        <li key={p.merke} className={`plassering plassering--${p.rolle}`}>
          <div className="plassering__innhold">
            {plasseringer.length > 1 && <p className="plassering__merke">{p.merke}</p>}
            <p className="plassering__sted">
              <span className="plassering__instruks">Limes inn på</span>
              <span className="plassering__koder">
                {p.koder.map((kode) => (
                  <span key={kode}>{kode}</span>
                ))}
              </span>
            </p>
            <p className="kommentartekst">{p.tekst}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
