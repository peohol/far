import { useId, useState, type ReactNode } from 'react'
import type { Sideelement, Sidemodell } from '../../faginnhold/analyttside'
import type { Utgave } from '../../faginnhold/lesing'
import {
  DATAKORT,
  DOSEKOLONNER,
  ELEMENTTYPER,
  formaterIntervall,
  harVerdi,
  lesDosetabell,
  lesIntervallverdi,
  lesKinetikk,
  lesRiktekst,
  type Datakortdefinisjon,
  type Paneldefinisjon,
} from '../../faginnhold/paneler'
import { erTomt, tomtDokument } from '../../faginnhold/riktekst'
import { Button } from '../Button'
import { Referansepille } from '../referanser/Referansepille'
import { Riktekst } from './Riktekst'
import {
  DatakortSkjema,
  DosetabellSkjema,
  KinetikkSkjema,
  PanelkildeSkjema,
  TekstSkjema,
  type Skjemaresultat,
} from './Skjemaer'
import { Uthev } from '../Uthev'
import type { Analyttsidehandlinger } from './useAnalyttside'

/**
 * Panelene 2–7 på informasjonssiden, i lese- og redigeringsmodus.
 *
 * I lesemodus vises bare det som har innhold: siden skal leses som et
 * oppslagsverk. I redigeringsmodus står alle panelene og alle datakortene
 * fram, med diskrete knapper for å redigere, legge til, flytte og fjerne.
 */

export interface Panelkontekst {
  modell: Sidemodell
  redigerer: boolean
  handlinger: Analyttsidehandlinger
}

/** ID-en et element har på siden, så søket kan peke dit. */
export function elementAnker(id: string): string {
  return `element-${id}`
}

export function panelAnker(nokkel: string): string {
  return `panel-${nokkel}`
}

const DATOFORMAT = new Intl.DateTimeFormat('nb-NO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Oslo',
})
const TIDSFORMAT = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' })

/**
 * «Sist redigert av Ola Nordmann 22.09.2026 kl. 14:32», og hvor innholdet kom
 * fra når det ikke ble skrevet i appen: «… · Importert fra Psykofarmaka.pdf,
 * side 7».
 */
export function sistRedigert(utgave: Utgave<unknown>): string {
  const navn = [utgave.endret_av_fornavn, utgave.endret_av_etternavn].filter(Boolean).join(' ')
  const tid = new Date(utgave.endret_kl)
  const naar = Number.isNaN(tid.getTime()) ? '' : ` ${DATOFORMAT.format(tid)} kl. ${TIDSFORMAT.format(tid)}`
  const kilde = utgave.kilde ? ` · ${utgave.kilde}` : ''
  return `Sist redigert${navn ? ` av ${navn}` : ''}${naar}${kilde}`
}

function Sistredigert({ utgave }: { utgave: Utgave<unknown> }) {
  return <p className="sistredigert">{sistRedigert(utgave)}</p>
}

/* --- Rammen rundt et panel ------------------------------------------------ */

export function Panel({
  definisjon,
  kontekst,
  tomt,
  children,
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  /** Sant når panelet ikke har noe å vise. Da skjules det i lesemodus. */
  tomt: boolean
  children: ReactNode
}) {
  const overskrift = useId()
  const [kilder, setKilder] = useState(false)
  const { modell, redigerer, handlinger } = kontekst
  const panelreferanser = modell.panelreferanser[definisjon.nokkel] ?? []
  if (tomt && !redigerer) return null

  return (
    <section id={panelAnker(definisjon.nokkel)} className="kort kort--start infopanel" aria-labelledby={overskrift}>
      <div className="infopanel__hode">
        <h2 id={overskrift} className="infopanel__tittel">
          <Uthev tekst={definisjon.tittel} />
          {panelreferanser.length > 0 && <Referansepille ider={panelreferanser} niva="panel" />}
        </h2>
        {redigerer && !kilder && (
          <Button variant="subtle" className="redigeringsknapp" onClick={() => setKilder(true)}>
            Kilder for panelet
          </Button>
        )}
      </div>
      {kilder && (
        <PanelkildeSkjema
          tittel={definisjon.tittel}
          referanser={panelreferanser}
          onAvbryt={() => setKilder(false)}
          onLagre={async (ider) => {
            await handlinger.lagrePanelreferanser(definisjon.nokkel, ider)
            setKilder(false)
          }}
        />
      )}
      {tomt && redigerer && <p className="infopanel__tomt">Panelet har ikke noe innhold ennå.</p>}
      {children}
    </section>
  )
}

/* --- Et redigerbart element ----------------------------------------------- */

/**
 * Ett element med lesevisningen, og i redigeringsmodus knappene rundt den.
 * `skjema` tegnes i stedet for visningen mens elementet redigeres.
 */
export function Redigerbar({
  navn,
  element,
  redigerer,
  visning,
  skjema,
  ekstra,
  leggTilTekst,
}: {
  navn: string
  element: Sideelement | null
  redigerer: boolean
  visning: ReactNode
  skjema: (lukk: () => void) => ReactNode
  /** Flere knapper, som «Flytt opp». */
  ekstra?: ReactNode
  /** Teksten på knappen når elementet ikke finnes ennå. */
  leggTilTekst?: string
}) {
  const [apen, setApen] = useState(false)
  if (apen) return <>{skjema(() => setApen(false))}</>
  return (
    <>
      {visning}
      {redigerer && (
        <div className="redigeringsrad">
          <Button variant="subtle" className="redigeringsknapp" aria-label={`${element ? 'Rediger' : 'Legg til'}: ${navn}`} onClick={() => setApen(true)}>
            {element ? 'Rediger' : (leggTilTekst ?? 'Legg til')}
          </Button>
          {ekstra}
          {element && <Sistredigert utgave={element.utgave} />}
        </div>
      )}
    </>
  )
}

function Kortreferanser({ element }: { element: Sideelement | null | undefined }) {
  if (!element || element.referanser.length === 0) return null
  return <Referansepille ider={element.referanser} niva="element" />
}

/* --- Panel 2: viktige data ------------------------------------------------ */

function Kortsymbol({ symbol }: { symbol: string }) {
  const [grunn, senket] = symbol.split('_')
  return (
    <span className="datakort__symbol">
      {grunn}
      {senket && <sub>{senket}</sub>}
    </span>
  )
}

export function Datakortpanel({ definisjon, kontekst }: { definisjon: Paneldefinisjon; kontekst: Panelkontekst }) {
  const elementer = kontekst.modell.paneler.get(definisjon.nokkel) ?? []
  const kort = DATAKORT.map((def, plass) => ({
    def: def as Datakortdefinisjon,
    plass,
    element: elementer.find((e) => e.elementtype === def.type) ?? null,
  }))
  const synlige = kort.filter(({ element }) => element && harVerdi(lesIntervallverdi(element.data)))

  return (
    <Panel definisjon={definisjon} kontekst={kontekst} tomt={synlige.length === 0}>
      <ul className="datakort">
        {(kontekst.redigerer ? kort : synlige).map(({ def, plass, element }) => {
          const verdi = lesIntervallverdi(element?.data)
          return (
            <li key={def.type} className="datakort__kort" {...(element && { id: elementAnker(element.id) })}>
              <h3 className="datakort__tittel">
                <Uthev tekst={def.tittel} />
                {def.symbol && <Kortsymbol symbol={def.symbol} />}
                <Kortreferanser element={element} />
              </h3>
              <Redigerbar
                navn={def.tittel}
                element={element}
                redigerer={kontekst.redigerer}
                visning={
                  harVerdi(verdi) ? (
                    <>
                      <p className="datakort__verdi">
                        <Uthev tekst={formaterIntervall(verdi)} />
                      </p>
                      {verdi.forbehold && (
                        <p className="datakort__forbehold">
                          <Uthev tekst={verdi.forbehold} />
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="datakort__tom">Ikke oppgitt</p>
                  )
                }
                skjema={(lukk) => (
                  <DatakortSkjema
                    kort={def}
                    tittel={def.tittel}
                    start={verdi}
                    referanser={element?.referanser ?? []}
                    onAvbryt={lukk}
                    onLagre={async ({ data, referanser }: Skjemaresultat<object>) => {
                      await kontekst.handlinger.lagreElement(element, {
                        panel: definisjon.nokkel,
                        elementtype: def.type,
                        posisjon: plass,
                        data: data as Record<string, unknown>,
                        referanser,
                      })
                      lukk()
                    }}
                  />
                )}
              />
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/* --- Panel 3–5: én riktekst ----------------------------------------------- */

export function Tekstpanel({ definisjon, kontekst }: { definisjon: Paneldefinisjon; kontekst: Panelkontekst }) {
  const elementer = (kontekst.modell.paneler.get(definisjon.nokkel) ?? []).filter(
    (e) => e.elementtype === ELEMENTTYPER.riktekst,
  )
  const element = elementer[0] ?? null
  const dokument = element ? lesRiktekst(element.data).dokument : tomtDokument()
  const tomt = !element || (erTomt(dokument) && element.referanser.length === 0)

  return (
    <Panel definisjon={definisjon} kontekst={kontekst} tomt={tomt}>
      <div className="infotekst" {...(element && { id: elementAnker(element.id) })}>
        <Redigerbar
          navn={definisjon.tittel}
          element={element}
          redigerer={kontekst.redigerer}
          leggTilTekst="Skriv tekst"
          visning={
            !tomt && (
              <>
                <Riktekst dokument={dokument} />
                <Kortreferanser element={element} />
              </>
            )
          }
          skjema={(lukk) => (
            <TekstSkjema
              tittel={definisjon.tittel}
              start={{ dokument }}
              referanser={element?.referanser ?? []}
              onAvbryt={lukk}
              onLagre={async ({ data, referanser }) => {
                await kontekst.handlinger.lagreElement(element, {
                  panel: definisjon.nokkel,
                  elementtype: ELEMENTTYPER.riktekst,
                  posisjon: 0,
                  data,
                  referanser,
                })
                lukk()
              }}
            />
          )}
        />
      </div>
    </Panel>
  )
}

/* --- Panel 6: kort med overskrift og tekst -------------------------------- */

export function Kortpanel({ definisjon, kontekst }: { definisjon: Paneldefinisjon; kontekst: Panelkontekst }) {
  const elementer = (kontekst.modell.paneler.get(definisjon.nokkel) ?? []).filter(
    (e) => e.elementtype === ELEMENTTYPER.kinetikk,
  )
  const [nytt, setNytt] = useState(false)
  const [fjerner, setFjerner] = useState<string | null>(null)
  const { handlinger, redigerer } = kontekst

  return (
    <Panel definisjon={definisjon} kontekst={kontekst} tomt={elementer.length === 0}>
      {elementer.length > 0 && (
        <ul className="infokort">
          {elementer.map((element, i) => {
            const { tittel, dokument } = lesKinetikk(element.data)
            return (
              <li key={element.id} id={elementAnker(element.id)} className="infokort__kort">
                <h3 className="infokort__tittel">
                  <Uthev tekst={tittel} />
                  <Kortreferanser element={element} />
                </h3>
                <Redigerbar
                  navn={tittel}
                  element={element}
                  redigerer={redigerer}
                  visning={<Riktekst dokument={dokument} />}
                  ekstra={
                    <>
                      {i > 0 && (
                        <Button variant="subtle" className="redigeringsknapp" aria-label={`Flytt opp: ${tittel}`} onClick={() => void handlinger.flyttElement(element, elementer, -1)}>
                          Flytt opp
                        </Button>
                      )}
                      {i < elementer.length - 1 && (
                        <Button variant="subtle" className="redigeringsknapp" aria-label={`Flytt ned: ${tittel}`} onClick={() => void handlinger.flyttElement(element, elementer, 1)}>
                          Flytt ned
                        </Button>
                      )}
                      {/* To trykk: et kort som fjernes, forsvinner fra utkastet og
                          hentes bare tilbake gjennom historikken. */}
                      {fjerner === element.id ? (
                        <Button
                          variant="subtle"
                          className="redigeringsknapp"
                          aria-label={`Bekreft: fjern ${tittel}`}
                          onClick={() => void handlinger.fjernElement(element)}
                        >
                          Bekreft fjerning
                        </Button>
                      ) : (
                        <Button
                          variant="subtle"
                          className="redigeringsknapp"
                          aria-label={`Fjern: ${tittel}`}
                          onClick={() => setFjerner(element.id)}
                        >
                          Fjern
                        </Button>
                      )}
                    </>
                  }
                  skjema={(lukk) => (
                    <KinetikkSkjema
                      tittel={tittel}
                      start={{ tittel, dokument }}
                      referanser={element.referanser}
                      onAvbryt={lukk}
                      onLagre={async ({ data, referanser }) => {
                        await handlinger.lagreElement(element, {
                          panel: definisjon.nokkel,
                          elementtype: ELEMENTTYPER.kinetikk,
                          posisjon: element.posisjon,
                          data,
                          referanser,
                        })
                        lukk()
                      }}
                    />
                  )}
                />
              </li>
            )
          })}
        </ul>
      )}
      {redigerer &&
        (nytt ? (
          <KinetikkSkjema
            tittel="Nytt kort"
            start={{ tittel: '', dokument: tomtDokument() }}
            referanser={[]}
            onAvbryt={() => setNytt(false)}
            onLagre={async ({ data, referanser }) => {
              await handlinger.lagreElement(null, {
                panel: definisjon.nokkel,
                elementtype: ELEMENTTYPER.kinetikk,
                posisjon: Math.max(-1, ...elementer.map((e) => e.posisjon)) + 1,
                data,
                referanser,
              })
              setNytt(false)
            }}
          />
        ) : (
          <div className="redigeringsrad">
            <Button variant="subtle" className="redigeringsknapp" onClick={() => setNytt(true)}>
              Legg til kort
            </Button>
          </div>
        ))}
    </Panel>
  )
}

/* --- Panel 7: tabellen ---------------------------------------------------- */

export function Tabellpanel({ definisjon, kontekst }: { definisjon: Paneldefinisjon; kontekst: Panelkontekst }) {
  const element =
    (kontekst.modell.paneler.get(definisjon.nokkel) ?? []).find((e) => e.elementtype === ELEMENTTYPER.dosetabell) ??
    null
  const { rader } = lesDosetabell(element?.data)
  const tittel = useId()

  return (
    <Panel definisjon={definisjon} kontekst={kontekst} tomt={rader.length === 0}>
      <div className="dosetabell" {...(element && { id: elementAnker(element.id) })}>
        <Redigerbar
          navn={definisjon.tittel}
          element={element}
          redigerer={kontekst.redigerer}
          leggTilTekst="Lag tabell"
          visning={
            rader.length > 0 && (
              <>
                <div className="dosetabell__rull">
                  <table className="dosetabell__tabell" aria-labelledby={tittel}>
                    <caption id={tittel} className="kun-skjermleser">
                      {definisjon.tittel}
                    </caption>
                    <thead>
                      <tr>
                        {DOSEKOLONNER.map(({ felt, tittel: kolonne }) => (
                          <th key={felt} scope="col">
                            {kolonne}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rader.map((rad, i) => (
                        <tr key={i}>
                          {DOSEKOLONNER.map(({ felt }) => (
                            <td key={felt}>
                              <Uthev tekst={rad[felt]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Kortreferanser element={element} />
              </>
            )
          }
          skjema={(lukk) => (
            <DosetabellSkjema
              tittel={definisjon.tittel}
              start={{ rader }}
              referanser={element?.referanser ?? []}
              onAvbryt={lukk}
              onLagre={async ({ data, referanser }) => {
                await kontekst.handlinger.lagreElement(element, {
                  panel: definisjon.nokkel,
                  elementtype: ELEMENTTYPER.dosetabell,
                  posisjon: 0,
                  data: data as unknown as Record<string, unknown>,
                  referanser,
                })
                lukk()
              }}
            />
          )}
        />
      </div>
    </Panel>
  )
}
