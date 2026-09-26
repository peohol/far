import { useState, type ReactNode } from 'react'
import type { Sideelement, Sidemodell } from '../../faginnhold/analyttside'
import {
  ELEMENTTYPER,
  lesDosetabell,
  lesKinetikk,
  lesRiktekst,
  type Paneldefinisjon,
} from '../../faginnhold/paneler'
import { doseringskort } from '../../faginnhold/doseringskort'
import { OPPSUMMERINGSSKILLE, antall, forhandsvisning, ramsOpp } from '../../faginnhold/oppsummering'
import { NODER, erTomt, klartekst, tomtDokument, type Riktekstdokument } from '../../faginnhold/riktekst'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Detaljkort, Seksjon, seksjonsanker } from '../seksjoner/Seksjon'
import { Skuffrutenett } from '../seksjoner/Skuffrutenett'
import { Referansefelt } from '../referanser/Referansefelt'
import { useSidereferanser } from '../referanser/Sidereferanser'
import { Riktekst } from './Riktekst'
import { DosetabellSkjema, KinetikkSkjema, PanelkildeSkjema, TekstSkjema } from './Skjemaer'
import { Uthev } from '../Uthev'
import { Sistredigert } from '../historikk/Sistredigert'
import type { Analyttsidehandlinger } from './useAnalyttside'
import { kinetikkikon, seksjonsikon, tekstvisning } from './panelvisning'
import { Serumtabell } from './Serumtabell'
import '../../styles/monograf.css'

/**
 * Seksjonene på informasjonssiden, i lese- og redigeringsmodus. Identiteten
 * og viktige data står alltid fram og har egne filer (`Identitetspanel.tsx`,
 * `ViktigeData.tsx`).
 *
 * Hvert panel er en seksjon som åpnes og lukkes (`src/components/seksjoner/`),
 * med en kort oppsummering av innholdet når den er lukket. Kortene i
 * farmakokinetikken og farmakogenetikken er detaljkort i et rutenett
 * (`Skuffrutenett`).
 *
 * I lesemodus vises bare det som har innhold: siden skal leses som et
 * oppslagsverk. I redigeringsmodus står alle panelene fram, med diskrete
 * knapper for å redigere, legge til, flytte og fjerne.
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

export const panelAnker = seksjonsanker

/* --- Rammen rundt et panel ------------------------------------------------ */

export function Panel({
  definisjon,
  kontekst,
  tomt,
  oppsummering,
  children,
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  /** Sant når panelet ikke har noe å vise. Da skjules det i lesemodus. */
  tomt: boolean
  /** Det seksjonen viser når den er lukket. */
  oppsummering: string
  children: ReactNode
}) {
  const [kilder, setKilder] = useState(false)
  const { modell, redigerer, handlinger } = kontekst
  // De redaksjonelle redigeres her; feltet viser dem sammen med de automatiske.
  const panelreferanser = modell.panelreferanser[definisjon.nokkel] ?? []
  const feltreferanser = useSidereferanser().panelreferanser[definisjon.nokkel] ?? []
  if (tomt && !redigerer) return null

  return (
    <Seksjon
      id={definisjon.nokkel}
      className="infopanel"
      ikon={seksjonsikon(definisjon.nokkel)}
      tittel={<Uthev tekst={definisjon.tittel} />}
      oppsummering={tomt ? 'Ikke noe innhold ennå' : oppsummering}
      handlinger={
        redigerer && (
          <Button variant="kant" icon={<Ikon navn="refs" />} className="redigeringsknapp" onClick={() => setKilder(true)}>
            Kilder for panelet
          </Button>
        )
      }
    >
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
      <Referansefelt ider={feltreferanser} niva="panel" />
    </Seksjon>
  )
}

/** Oppsummeringen av en riktekst: avsnittene og punktene etter hverandre, «Tablett: 5–30 mg · Depotinjeksjon: …». */
function tekstoppsummering(dokument: Riktekstdokument): string {
  // En linje som leder inn i en liste («… tabletter):»), henger sammen med det første punktet.
  const linjer = ramsOpp(klartekst(dokument).split('\n')).split(OPPSUMMERINGSSKILLE)
  const tekst = linjer.reduce((samlet, linje) => (samlet === '' ? linje : `${samlet}${samlet.endsWith(':') ? ' ' : OPPSUMMERINGSSKILLE}${linje}`), '')
  return forhandsvisning(tekst)
}

/* --- Et redigerbart element ----------------------------------------------- */

/**
 * Ett element med lesevisningen, og i redigeringsmodus knappene rundt den.
 * `skjema` er redigeringsvinduet, som legger seg over siden mens elementet
 * redigeres; visningen står bak det som før.
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
  return (
    <>
      {visning}
      {redigerer && (
        <div className="redigeringsrad">
          <Button
            variant="kant"
            icon={<Ikon navn={element ? 'edit' : 'plus'} />}
            className="redigeringsknapp"
            aria-label={`${element ? 'Rediger' : 'Legg til'}: ${navn}`}
            onClick={() => setApen(true)}
          >
            {element ? 'Rediger' : (leggTilTekst ?? 'Legg til')}
          </Button>
          {ekstra}
          {element && <Sistredigert utgave={element.utgave} type="innholdselement" navn={navn} />}
        </div>
      )}
      {apen && skjema(() => setApen(false))}
    </>
  )
}

/** Referansefeltet nederst i et kort, med kildene som gjelder hele kortet. */
function Kortreferanser({ element }: { element: Sideelement | null | undefined }) {
  if (!element || element.referanser.length === 0) return null
  return <Referansefelt ider={element.referanser} niva="element" />
}

/* --- Panel 3–5: én riktekst ----------------------------------------------- */

/** Rikteksten i et panel: elementet, dokumentet og om det er tomt. Et panel har høyst én. */
export function panelteksten(kontekst: Panelkontekst, nokkel: string) {
  const element =
    (kontekst.modell.paneler.get(nokkel) ?? []).find((e) => e.elementtype === ELEMENTTYPER.riktekst) ?? null
  const dokument = element ? lesRiktekst(element.data).dokument : tomtDokument()
  const tomt = !element || (erTomt(dokument) && element.referanser.length === 0)
  return { element, dokument, tomt, oppsummering: tekstoppsummering(dokument) }
}

export function Tekstpanel({ definisjon, kontekst }: { definisjon: Paneldefinisjon; kontekst: Panelkontekst }) {
  const tekst = panelteksten(kontekst, definisjon.nokkel)
  return (
    <Panel definisjon={definisjon} kontekst={kontekst} tomt={tekst.tomt} oppsummering={tekst.oppsummering}>
      <Paneltekst definisjon={definisjon} kontekst={kontekst} tekst={tekst} />
    </Panel>
  )
}

/**
 * Rikteksten i et panel, med knappen som redigerer den. I redigeringsmodus står
 * den fram også når panelet ikke har noen tekst ennå, med «Skriv tekst».
 */
export function Paneltekst({
  definisjon,
  kontekst,
  tekst: { element, dokument, tomt },
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  tekst: ReturnType<typeof panelteksten>
}) {
  if (tomt && !kontekst.redigerer) return null
  return (
    <div className="infotekst" {...(element && { id: elementAnker(element.id) })}>
      <Redigerbar
        navn={definisjon.tittel}
        element={element}
        redigerer={kontekst.redigerer}
        leggTilTekst="Skriv tekst"
        visning={
          !tomt && (
            <>
              <Tekstvisning nokkel={definisjon.nokkel} dokument={dokument} />
              <Kortreferanser element={element} />
            </>
          )
        }
        skjema={(lukk) => (
          <TekstSkjema
            tittel={definisjon.tittel}
            ikon={seksjonsikon(definisjon.nokkel)}
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
  )
}

/** Teksten i et tekstpanel, som løpende tekst eller som kort (se `tekstvisning`). */
function Tekstvisning({ nokkel, dokument }: { nokkel: string; dokument: Riktekstdokument }) {
  const kort = tekstvisning(nokkel) === 'dosering' ? doseringskort(dokument) : null
  if (!kort) return <Riktekst dokument={dokument} />
  return (
    <ul className="dosekort">
      {kort.map(({ etikett, innhold }, i) => (
        <li key={i} className="dosekort__kort">
          {etikett && (
            <span className="dosekort__etikett">
              <Uthev tekst={etikett} />
              {/* Kolonet står i teksten, så den leses og kopieres som den er skrevet. */}
              <span className="kun-skjermleser">: </span>
            </span>
          )}
          <div className="dosekort__verdi" data-lang={klartekst({ type: NODER.dokument, content: innhold }).length > KORT_VERDI || undefined}>
            <Riktekst dokument={{ type: NODER.dokument, content: [{ type: NODER.avsnitt, content: innhold }] }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Lengste verdi som vises med store tall i et doseringskort; lengre tekst vises som lesetekst. */
const KORT_VERDI = 28

/* --- Kort med overskrift og tekst: farmakokinetikken og farmakogenetikken - */

/** Kortene med overskrift og tekst i et panel. */
export function kortelementer(kontekst: Panelkontekst, nokkel: string): Sideelement[] {
  return (kontekst.modell.paneler.get(nokkel) ?? []).filter((e) => e.elementtype === ELEMENTTYPER.kinetikk)
}

/** Oppsummeringen av kortene: titlene deres. */
export function kortoppsummering(elementer: readonly Sideelement[]): string {
  return ramsOpp(elementer.map((e) => lesKinetikk(e.data).tittel))
}

export function Kortpanel({ definisjon, kontekst }: { definisjon: Paneldefinisjon; kontekst: Panelkontekst }) {
  const elementer = kortelementer(kontekst, definisjon.nokkel)
  return (
    <Panel
      definisjon={definisjon}
      kontekst={kontekst}
      tomt={elementer.length === 0}
      oppsummering={kortoppsummering(elementer)}
    >
      <Redaksjonskort definisjon={definisjon} kontekst={kontekst} elementer={elementer} />
    </Panel>
  )
}

/**
 * Kortene i et panel av kort, som detaljkort i et rutenett, med knappene for
 * å legge til, flytte og fjerne i redigeringsmodus. `ettAlene` sier om et
 * eneste kort skal stå åpent fra start; det skal det ikke når seksjonen har
 * annet innhold ved siden av.
 */
export function Redaksjonskort({
  definisjon,
  kontekst,
  elementer,
  ettAlene = true,
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  elementer: readonly Sideelement[]
  ettAlene?: boolean
}) {
  const [nytt, setNytt] = useState(false)
  const [fjerner, setFjerner] = useState<string | null>(null)
  const { handlinger, redigerer } = kontekst

  return (
    <>
      {elementer.length > 0 && (
        <Skuffrutenett className="infokort">
          {elementer.map((element, i) => {
            const { tittel, dokument } = lesKinetikk(element.data)
            return (
              <li key={element.id} className="infokort__kort">
                <Detaljkort
                  id={element.id}
                  // Står det bare ett kort i seksjonen, er det ingenting å velge mellom.
                  apenFraStart={ettAlene && elementer.length === 1}
                  ikon={kinetikkikon(tittel)}
                  tittel={<Kinetikktittel tittel={tittel} />}
                  oppsummering={tekstoppsummering(dokument)}
                >
                  {/* Ankeret søket peker på står inne i detaljkortet, så å gå dit åpner også kortet. */}
                  <div id={elementAnker(element.id)} className="infokort__innhold">
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
                          ikon={kinetikkikon(tittel)}
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
                    <Kortreferanser element={element} />
                  </div>
                </Detaljkort>
              </li>
            )
          })}
        </Skuffrutenett>
      )}
      {redigerer && (
        <div className="redigeringsrad">
          <Button variant="kant" icon={<Ikon navn="plus" />} className="redigeringsknapp" onClick={() => setNytt(true)}>
            Legg til kort
          </Button>
        </div>
      )}
      {nytt && (
        <KinetikkSkjema
          tittel="Nytt kort"
          ikon={seksjonsikon(definisjon.nokkel)}
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
      )}
    </>
  )
}

/** Unicode-tegn for senket skrift, som i «tₘₐₓ» og «tₛₛ». */
const SENKET = /([\u2080-\u209c]+)/

/**
 * Overskriften på et kinetikkort, med senket skrift som `<sub>`: «tₘₐₓ» vises
 * og leses som t med «max» senket. Teksten er den samme.
 */
function Kinetikktittel({ tittel }: { tittel: string }) {
  return (
    <>
      {tittel.split(SENKET).map((del, i) =>
        i % 2 === 1 ? (
          <sub key={i}>
            <Uthev tekst={del.normalize('NFKC')} />
          </sub>
        ) : (
          del && <Uthev key={i} tekst={del} />
        ),
      )}
    </>
  )
}

/* --- Panel 7: tabellen ---------------------------------------------------- */

export function Tabellpanel({ definisjon, kontekst }: { definisjon: Paneldefinisjon; kontekst: Panelkontekst }) {
  const element =
    (kontekst.modell.paneler.get(definisjon.nokkel) ?? []).find((e) => e.elementtype === ELEMENTTYPER.dosetabell) ??
    null
  const { rader } = lesDosetabell(element?.data)

  return (
    <Panel
      definisjon={definisjon}
      kontekst={kontekst}
      tomt={rader.length === 0}
      oppsummering={ramsOpp(rader.map((r) => r.dose)) || antall(rader.length, 'rad', 'rader')}
    >
      <div className="dosetabell" {...(element && { id: elementAnker(element.id) })}>
        <Redigerbar
          navn={definisjon.tittel}
          element={element}
          redigerer={kontekst.redigerer}
          leggTilTekst="Lag tabell"
          visning={
            rader.length > 0 && (
              <>
                <Serumtabell rader={rader} tittel={definisjon.tittel} />
                <Kortreferanser element={element} />
              </>
            )
          }
          skjema={(lukk) => (
            <DosetabellSkjema
              tittel={definisjon.tittel}
              ikon={seksjonsikon(definisjon.nokkel)}
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
