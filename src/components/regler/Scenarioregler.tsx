import { useMemo, useState } from 'react'
import { rusModulFor, TOM_RUS_INNDATA, type RusInndata, type RusModul, type RusPlassering } from '../../domain/rus'
import type { Kommentaroppslag } from '../../domain/kommentarobjekt'
import { RUS_KOMMENTARER, RUS_REGELSETT } from '../../domain/rusregelsett'
import {
  flettInn,
  kjorScenarier,
  verdifelter as verdifelterFor,
  type Scenarioregelsett,
  type Scenariotreff,
} from '../../domain/scenario'
import { beskrivForhold, beskrivRegelsett, formaterAndel, type Scenariobeskrivelse } from '../../domain/scenariovisning'
import type { Analyte } from '../../types'
import { Button } from '../Button'
import { Rusutfall } from '../Rusutfall'
import { Rusvalg } from '../Rusvalg'
import { Uthev } from '../Uthev'
import { Detaljkort, Seksjon } from '../seksjoner/Seksjon'
import { antall, ramsOpp } from '../../faginnhold/oppsummering'

/**
 * Regelsettet fortolkningsmodulen bruker for denne analytten, med navnene på
 * analyttene og kommentarene regelsettet viser til. `null` når modulen ikke
 * fortolkes med scenarioregler.
 */
export function scenarioreglerFor(fortolkning: Analyte): ScenarioreglerProps | null {
  const modul = rusModulFor(fortolkning)
  const regelsett = modul && RUS_REGELSETT.find((r) => r.modul === modul.id)
  return modul && regelsett ? { modul, regelsett, kommentarer: RUS_KOMMENTARER } : null
}

const OG = new Intl.ListFormat('nb', { type: 'conjunction' })

export interface ScenarioreglerProps {
  modul: RusModul
  regelsett: Scenarioregelsett
  /** Kommentarobjektene scenariene peker på. */
  kommentarer: Kommentaroppslag
}

/**
 * Fortolkningsreglene på analyttsiden, for moduler som fortolkes med
 * scenarioregler (`docs/scenarioregler.md`): grensene, scenariene — hva som er
 * påvist, vilkårene og utfallet — og kommentarene scenariene viser til,
 * nummerert, så hver står bare én gang.
 *
 * Har regelsettet mer enn ett scenario, følger en simulator: kryss av, fyll inn
 * tall, og se hvilket scenario som gjelder og hvilke kommentarer som havner på
 * hvilke koder. Simulatoren spør og svarer som fortolkningsmodulen, men har
 * ingenting å kopiere.
 *
 * Reglene er seksjonen `fortolkning` på siden, og kommentartekstene og
 * simulatoren detaljkort i den (`docs/seksjoner.md`).
 */
export function Scenarioregler({ modul, regelsett, kommentarer }: ScenarioreglerProps) {
  const beskrivelse = useMemo(() => beskrivRegelsett(regelsett, kommentarer), [regelsett, kommentarer])
  const [inndata, setInndata] = useState<RusInndata>(TOM_RUS_INNDATA)
  const treff = useMemo(() => provKjor(regelsett, kommentarer, inndata), [regelsett, kommentarer, inndata])
  const simulerbar = regelsett.scenarier.length > 1

  return (
    <Seksjon
      id="fortolkning"
      tittel={<Uthev tekst="Fortolkningsregler" />}
      oppsummering={ramsOpp([
        antall(beskrivelse.scenarier.length, 'scenario', 'scenarier'),
        ...beskrivelse.grenser.map((g) => `${g.navn}: ${g.prosent}`),
      ])}
      className="regler"
    >
      <p className="regler__ingress">
        <Uthev
          tekst={
            simulerbar
              ? `Slik kommenterer fortolkningen ${modul.navn}. Hvilke analytter som er påvist, avgjør hvilket scenario som gjelder.`
              : `Slik kommenterer fortolkningen ${modul.navn}.`
          }
        />
      </p>

      {beskrivelse.grenser.length > 0 && (
        <dl className="regler__grenser">
          {beskrivelse.grenser.map((g) => (
            <div key={g.nokkel} className="regler__grense">
              <dt>
                <Uthev tekst={g.navn} />
              </dt>
              <dd>{g.prosent}</dd>
            </div>
          ))}
        </dl>
      )}

      <ol className="scenarioliste">
        {beskrivelse.scenarier.map((b, i) => (
          <Scenariorad
            key={b.scenario.nokkel}
            nummer={i + 1}
            beskrivelse={b}
            truffet={treff?.scenario === b.scenario}
          />
        ))}
      </ol>

      <Detaljkort
        id="tekster"
        tittel={beskrivelse.tekster.length > 1 ? 'Kommentartekstene' : 'Kommentarteksten'}
        oppsummering={antall(beskrivelse.tekster.length, 'tekst', 'tekster')}
      >
        <ol className="regeltekster">
          {beskrivelse.tekster.map((t, i) => (
            <li key={t.id} className="regeltekst">
              <p className="regeltekst__nummer">
                Tekst {i + 1}
                {t.brukesAv > 1 && <span className="regeltekst__bruk"> · brukes i {t.brukesAv} scenarier</span>}
              </p>
              <p className="thc-kommentar">
                <Uthev tekst={t.tekst} />
              </p>
            </li>
          ))}
        </ol>
      </Detaljkort>

      {simulerbar && (
        <Simulator
          modul={modul}
          regelsett={regelsett}
          beskrivelse={beskrivelse.scenarier}
          inndata={inndata}
          treff={treff}
          onEndre={setInndata}
        />
      )}
    </Seksjon>
  )
}

/** Kjører regelsettet, men lar et regelsett som ikke er gyldig, gi `null` i stedet for å velte siden. */
function provKjor(
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

function Scenariorad({
  nummer,
  beskrivelse,
  truffet,
}: {
  nummer: number
  beskrivelse: Scenariobeskrivelse
  truffet: boolean
}) {
  const { pavist, ikkePavist, vilkar, utfall } = beskrivelse
  return (
    <li className={truffet ? 'scenario scenario--truffet' : 'scenario'} aria-current={truffet || undefined}>
      <p className="scenario__nummer">Scenario {nummer}</p>
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
      {utfall.type === 'manuell' ? (
        <div className="scenario__utfall">
          <p className="scenario__manuell">
            <Uthev tekst={utfall.melding} />
          </p>
          {utfall.veiledning.map((tekst) => (
            <p key={tekst} className="rus-veiledning">
              <Uthev tekst={tekst} />
            </p>
          ))}
        </div>
      ) : (
        <div className="scenario__utfall">
          <ul className="scenario__plasseringer">
            {utfall.plasseringer.map((p) => (
              <li key={p.merke}>
                <Uthev tekst={p.merke} />: tekst {p.tekstnummer} på <Koder koder={p.koder} />
              </li>
            ))}
          </ul>
          {utfall.notiser.map((notis) => (
            <p key={notis} className="scenario__notis">
              <Uthev tekst={notis} />
            </p>
          ))}
        </div>
      )}
    </li>
  )
}

function Koder({ koder }: { koder: readonly string[] }) {
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

function Simulator({
  modul,
  regelsett,
  beskrivelse,
  inndata,
  treff,
  onEndre,
}: {
  modul: RusModul
  regelsett: Scenarioregelsett
  beskrivelse: Scenariobeskrivelse[]
  inndata: RusInndata
  treff: Scenariotreff | null
  onEndre: (inndata: RusInndata) => void
}) {
  const navn = new Map(modul.analytter.map((a) => [a.kode, a.navn]))
  const felter = verdifelterFor(regelsett, inndata.pavist).map((kode) => ({ kode, navn: navn.get(kode) ?? kode }))
  const nummer = treff?.scenario ? beskrivelse.findIndex((b) => b.scenario === treff.scenario) + 1 : 0

  return (
    <Detaljkort
      id="simulator"
      tittel="Prøv reglene"
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
          {plasseringer.length > 1 && <p className="plassering__merke">{p.merke}</p>}
          <p className="plassering__instruks">Limes inn på</p>
          <p className="plassering__koder">
            {p.koder.map((kode) => (
              <span key={kode}>{kode}</span>
            ))}
          </p>
          <p className="thc-kommentar">{p.tekst}</p>
        </li>
      ))}
    </ol>
  )
}
