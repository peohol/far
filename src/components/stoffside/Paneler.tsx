import { useState, type ReactNode } from 'react'
import { Bevaringsomrade, useBevart } from '../../oppdatering/Bevaring'
import type { Sideelement, Sidemodell } from '../../faginnhold/stoffside'
import {
  ELEMENTTYPER,
  lesDosetabell,
  lesKinetikk,
  lesMekanismekort,
  lesRiktekst,
  mekanismekortTilData,
  type Kinetikkdata,
  type Mekanismekortdata,
  type Paneldefinisjon,
} from '../../faginnhold/paneler'
import { INGEN_EFFEKT, mekanismeFor, retningFor } from '../../faginnhold/mekanismer'
import { doseringskort } from '../../faginnhold/doseringskort'
import { OPPSUMMERINGSSKILLE, antall, forhandsvisning, kuttes, ramsOpp } from '../../faginnhold/oppsummering'
import { NODER, erTomt, klartekst, tomtDokument, type Riktekstdokument } from '../../faginnhold/riktekst'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Detaljkort, Seksjon, seksjonsanker } from '../seksjoner/Seksjon'
import { Skuffrutenett } from '../seksjoner/Skuffrutenett'
import { Referansefelt } from '../referanser/Referansefelt'
import { useSidereferanser } from '../referanser/Sidereferanser'
import { Riktekst } from './Riktekst'
import { DosetabellSkjema, KinetikkSkjema, MekanismekortSkjema, PanelkildeSkjema, TekstSkjema, type SkjemaProps } from './Skjemaer'
import type { Ikonnavn } from '../ikon/register'
import { Uthev } from '../Uthev'
import { Sistredigert } from '../historikk/Sistredigert'
import type { Stoffsidehandlinger } from './useStoffside'
import { kinetikkikon, mekanismeikon, seksjonsikon, tekstvisning } from './panelvisning'
import { Serumtabell } from './Serumtabell'
import '../../styles/monograf.css'

/**
 * Seksjonene på stoffsiden, i lese- og redigeringsmodus. Identiteten
 * og viktige data står alltid fram og har egne filer (`Identitetspanel.tsx`,
 * `ViktigeData.tsx`).
 *
 * Hvert panel er en seksjon som åpnes og lukkes (`src/components/seksjoner/`),
 * med en kort oppsummering av innholdet når den er lukket. Kortene i
 * farmakodynamikken, farmakokinetikken og farmakogenetikken er detaljkort i
 * et rutenett (`Skuffrutenett`).
 *
 * I lesemodus vises bare det som har innhold: siden skal leses som et
 * oppslagsverk. I redigeringsmodus står alle panelene fram, med diskrete
 * knapper for å redigere, legge til, flytte og fjerne.
 */

export interface Panelkontekst {
  modell: Sidemodell
  redigerer: boolean
  handlinger: Stoffsidehandlinger
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
  const [kilder, setKilder] = useBevart(`kilder:${definisjon.nokkel}`, false)
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
        <Bevaringsomrade navn={`kilder:${definisjon.nokkel}`}>
          <PanelkildeSkjema
            tittel={definisjon.tittel}
            referanser={panelreferanser}
            onAvbryt={() => setKilder(false)}
            onLagre={async (ider) => {
              await handlinger.lagrePanelreferanser(definisjon.nokkel, ider)
              setKilder(false)
            }}
          />
        </Bevaringsomrade>
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
 *
 * Et vindu som står åpent, og det som er skrevet i det, overlever en
 * oppdatering av appen — men bare mot den samme revisjonen av elementet, så et
 * gammelt utkast aldri lagres over noe andre har lagret i mellomtiden.
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
  const skjemanavn = `rediger:${element ? `${element.id}@${element.utgave.revisjon}` : navn}`
  const [apen, setApen] = useBevart(skjemanavn, false)
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
      {apen && <Bevaringsomrade navn={skjemanavn}>{skjema(() => setApen(false))}</Bevaringsomrade>}
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

/* --- Kortseriene: farmakodynamikken, farmakokinetikken og de andre ------ */

/**
 * Hvordan en elementtype vises og redigeres som kort i en kortserie: hodet
 * på det lukkede kortet, innholdet i det åpnede, og skjemaet. Kinetikkortene
 * og mekanismekortene deler resten — rutenettet, knappene for å legge til,
 * flytte og fjerne, og kildene nederst.
 */
interface Korttype<T> {
  elementtype: string
  les: (data: unknown) => T
  tilData: (kort: T) => Record<string, unknown>
  /** Et nytt, tomt kort. */
  tomt: () => T
  /** Navnet på kortet i knappene og redigeringsvinduet. */
  navn: (kort: T) => string
  ikon: (kort: T) => Ikonnavn | undefined
  tittel: (kort: T) => ReactNode
  oppsummering: (kort: T) => ReactNode
  /** Klassen på detaljkortet, f.eks. for retningen på et mekanismekort. */
  klasse?: (kort: T) => string | undefined
  visning: (kort: T) => ReactNode
  /**
   * Om det åpnede kortet viser mer enn oppsummeringen. Bare da kan kortet
   * åpnes (utenom i redigeringsmodus); ellers er det et fast kort som viser
   * `fast` rett under tittelen.
   */
  harMer: (kort: T) => boolean
  /** Det et fast kort viser under tittelen. Visningen når ikke annet er sagt. */
  fast?: (kort: T) => ReactNode
  Skjema: (props: SkjemaProps<T>) => ReactNode
}

const KINETIKKORT: Korttype<Kinetikkdata> = {
  elementtype: ELEMENTTYPER.kinetikk,
  les: lesKinetikk,
  tilData: (kort) => ({ ...kort }),
  tomt: () => ({ tittel: '', dokument: tomtDokument() }),
  navn: (kort) => kort.tittel,
  ikon: (kort) => kinetikkikon(kort.tittel),
  tittel: (kort) => <Kinetikktittel tittel={kort.tittel} />,
  oppsummering: (kort) => tekstoppsummering(kort.dokument),
  visning: (kort) => <Riktekst dokument={kort.dokument} />,
  // Får teksten plass i oppsummeringen, er det ikke mer å vise; da står den i sin helhet i det faste kortet.
  harMer: (kort) => kuttes(klartekst(kort.dokument)),
  Skjema: KinetikkSkjema,
}

/** Kortene av en type i et panel, i rekkefølge. */
function kortAvType(kontekst: Panelkontekst, nokkel: string, elementtype: string): Sideelement[] {
  return (kontekst.modell.paneler.get(nokkel) ?? []).filter((e) => e.elementtype === elementtype)
}

/** Kortene med overskrift og tekst i et panel. */
export function kortelementer(kontekst: Panelkontekst, nokkel: string): Sideelement[] {
  return kortAvType(kontekst, nokkel, ELEMENTTYPER.kinetikk)
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
 * Kinetikkortene i et panel, som detaljkort i et rutenett. `ettAlene` sier om
 * et eneste kort skal stå åpent fra start; det skal det ikke når seksjonen
 * har annet innhold ved siden av.
 */
export function Redaksjonskort(props: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  elementer: readonly Sideelement[]
  ettAlene?: boolean
}) {
  return <Kortserie {...props} type={KINETIKKORT} />
}

/**
 * En serie kort i et panel, som detaljkort i et rutenett, med knappene for å
 * legge til, flytte og fjerne i redigeringsmodus.
 */
function Kortserie<T>({
  definisjon,
  kontekst,
  elementer,
  type,
  ettAlene = true,
  leggTilTekst = 'Legg til kort',
}: {
  definisjon: Paneldefinisjon
  kontekst: Panelkontekst
  elementer: readonly Sideelement[]
  type: Korttype<T>
  ettAlene?: boolean
  leggTilTekst?: string
}) {
  const [nytt, setNytt] = useBevart(`nytt:${definisjon.nokkel}`, false)
  const [fjerner, setFjerner] = useState<string | null>(null)
  const { handlinger, redigerer } = kontekst
  const { Skjema } = type

  return (
    <>
      {elementer.length > 0 && (
        <Skuffrutenett className="infokort">
          {elementer.map((element, i) => {
            const kort = type.les(element.data)
            const navn = type.navn(kort)
            // Kortet åpnes bare når det har mer å vise. Redaktøren åpner det for å komme til knappene.
            if (!redigerer && !type.harMer(kort)) {
              return (
                <li key={element.id} className="infokort__kort">
                  <Detaljkort id={element.id} kanApnes={false} ikon={type.ikon(kort)} tittel={type.tittel(kort)} className={type.klasse?.(kort)}>
                    <div id={elementAnker(element.id)} className="infokort__innhold">
                      {(type.fast ?? type.visning)(kort)}
                      <Kortreferanser element={element} />
                    </div>
                  </Detaljkort>
                </li>
              )
            }
            return (
              <li key={element.id} className="infokort__kort">
                <Detaljkort
                  id={element.id}
                  // Står det bare ett kort i seksjonen, er det ingenting å velge mellom.
                  apenFraStart={ettAlene && elementer.length === 1}
                  ikon={type.ikon(kort)}
                  tittel={type.tittel(kort)}
                  oppsummering={type.oppsummering(kort)}
                  className={type.klasse?.(kort)}
                >
                  {/* Ankeret søket peker på står inne i detaljkortet, så å gå dit åpner også kortet. */}
                  <div id={elementAnker(element.id)} className="infokort__innhold">
                    <Redigerbar
                      navn={navn}
                      element={element}
                      redigerer={redigerer}
                      visning={type.visning(kort)}
                      ekstra={
                        <>
                          {i > 0 && (
                            <Button variant="subtle" className="redigeringsknapp" aria-label={`Flytt opp: ${navn}`} onClick={() => void handlinger.flyttElement(element, elementer, -1)}>
                              Flytt opp
                            </Button>
                          )}
                          {i < elementer.length - 1 && (
                            <Button variant="subtle" className="redigeringsknapp" aria-label={`Flytt ned: ${navn}`} onClick={() => void handlinger.flyttElement(element, elementer, 1)}>
                              Flytt ned
                            </Button>
                          )}
                          {/* To trykk: et kort som fjernes, forsvinner fra utkastet og
                              hentes bare tilbake gjennom historikken. */}
                          {fjerner === element.id ? (
                            <Button
                              variant="subtle"
                              className="redigeringsknapp"
                              aria-label={`Bekreft: fjern ${navn}`}
                              onClick={() => void handlinger.fjernElement(element)}
                            >
                              Bekreft fjerning
                            </Button>
                          ) : (
                            <Button
                              variant="subtle"
                              className="redigeringsknapp"
                              aria-label={`Fjern: ${navn}`}
                              onClick={() => setFjerner(element.id)}
                            >
                              Fjern
                            </Button>
                          )}
                        </>
                      }
                      skjema={(lukk) => (
                        <Skjema
                          tittel={navn}
                          ikon={type.ikon(kort) ?? seksjonsikon(definisjon.nokkel)}
                          start={kort}
                          referanser={element.referanser}
                          onAvbryt={lukk}
                          onLagre={async ({ data, referanser }) => {
                            await handlinger.lagreElement(element, {
                              panel: definisjon.nokkel,
                              elementtype: type.elementtype,
                              posisjon: element.posisjon,
                              data: type.tilData(data),
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
            {leggTilTekst}
          </Button>
        </div>
      )}
      {nytt && (
        <Bevaringsomrade navn={`nytt:${definisjon.nokkel}`}>
          <Skjema
            tittel="Nytt kort"
            ikon={seksjonsikon(definisjon.nokkel)}
            start={type.tomt()}
            referanser={[]}
            onAvbryt={() => setNytt(false)}
            onLagre={async ({ data, referanser }) => {
              await handlinger.lagreElement(null, {
                panel: definisjon.nokkel,
                elementtype: type.elementtype,
                posisjon: Math.max(-1, ...elementer.map((e) => e.posisjon)) + 1,
                data: type.tilData(data),
                referanser,
              })
              setNytt(false)
            }}
          />
        </Bevaringsomrade>
      )}
    </>
  )
}

/* --- Farmakodynamikken: mekanismekortene --------------------------------- */

const MEKANISMEKORT: Korttype<Mekanismekortdata> = {
  elementtype: ELEMENTTYPER.mekanisme,
  les: lesMekanismekort,
  tilData: mekanismekortTilData,
  tomt: () => ({
    maal: '',
    effekt: '',
    mekanisme: null,
    retning: 'ukjent',
    kvalifikasjon: '',
    merknad: '',
    dokument: tomtDokument(),
  }),
  navn: (kort) => kort.maal,
  ikon: (kort) => mekanismeikon(kort.mekanisme),
  tittel: (kort) => <Uthev tekst={kort.maal} />,
  oppsummering: (kort) => <Mekanismeeffekt kort={kort} />,
  klasse: (kort) =>
    ['mekanismekort', `mekanismekort--${retningFor(kort.retning).tone}`, kort.mekanisme === INGEN_EFFEKT && 'mekanismekort--ingen']
      .filter(Boolean)
      .join(' '),
  visning: (kort) => <Mekanismedetaljer kort={kort} />,
  // Effekten står alt på det lukkede kortet, og mekanismetypen og retningen gir ikonet og fargen.
  harMer: (kort) => Boolean(kort.merknad) || !erTomt(kort.dokument),
  fast: (kort) => (
    <p className="mekanismekort__fast">
      <Mekanismeeffekt kort={kort} medDetaljer />
    </p>
  ),
  Skjema: MekanismekortSkjema,
}

/**
 * Oppsummeringen av farmakodynamikken: målene stoffet virker på. Målene der
 * kilden sier at stoffet ikke har noen effekt, tas med bare når det ikke er
 * noe annet.
 */
export function mekanismeoppsummering(elementer: readonly Sideelement[]): string {
  const kort = elementer.map((e) => lesMekanismekort(e.data))
  const virker = kort.filter((k) => k.mekanisme !== INGEN_EFFEKT)
  return ramsOpp((virker.length > 0 ? virker : kort).map((k) => k.maal))
}

/**
 * Farmakodynamikken: ett mekanismekort per mål og mekanisme. En riktekst
 * som står i panelet fra før kortene kom (fra en import), vises under
 * kortene, så ingenting skjules; datamigreringen gjorde alle de gamle
 * tekstene om til kort.
 */
export function Mekanismepanel({ definisjon, kontekst }: { definisjon: Paneldefinisjon; kontekst: Panelkontekst }) {
  const elementer = kortAvType(kontekst, definisjon.nokkel, ELEMENTTYPER.mekanisme)
  const tekst = panelteksten(kontekst, definisjon.nokkel)
  return (
    <Panel
      definisjon={definisjon}
      kontekst={kontekst}
      tomt={elementer.length === 0 && tekst.tomt}
      oppsummering={mekanismeoppsummering(elementer) || tekst.oppsummering}
    >
      <Kortserie definisjon={definisjon} kontekst={kontekst} elementer={elementer} type={MEKANISMEKORT} leggTilTekst="Legg til mekanismekort" />
      {!tekst.tomt && <Paneltekst definisjon={definisjon} kontekst={kontekst} tekst={tekst} />}
    </Panel>
  )
}

/**
 * Effekten på det lukkede kortet: effekten, og kvalifikasjonen dempet etter
 * den. På et fast kort (`medDetaljer`) kan teksten fremheves av søket, og
 * mekanismetypen og retningen, som ellers står i det åpnede kortet, leses av
 * skjermleseren.
 */
function Mekanismeeffekt({ kort, medDetaljer = false }: { kort: Mekanismekortdata; medDetaljer?: boolean }) {
  const tekst = (verdi: string) => (medDetaljer ? <Uthev tekst={verdi} /> : verdi)
  return (
    <>
      <span className="mekanismekort__effekt">{tekst(kort.effekt)}</span>
      {kort.kvalifikasjon && <span className="mekanismekort__kvalifikasjon"> · {tekst(kort.kvalifikasjon)}</span>}
      {medDetaljer && (
        // Gjennom `Uthev`, så søket på siden finner kortet også på mekanismen og retningen.
        <span className="kun-skjermleser">
          {'. Mekanisme: '}
          <Uthev tekst={mekanismeFor(kort.mekanisme)?.navn ?? 'Ikke angitt'} />
          {'. Retning: '}
          <Uthev tekst={retningFor(kort.retning).navn} />.
        </span>
      )}
    </>
  )
}

/**
 * Det åpnede kortet: effekten, mekanismetypen og retningen, så merknaden og
 * den utdypende teksten. Retningen står alltid i tekst; fargen følger den.
 */
function Mekanismedetaljer({ kort }: { kort: Mekanismekortdata }) {
  const retning = retningFor(kort.retning)
  const mekanisme = mekanismeFor(kort.mekanisme)
  return (
    <div className="mekanismekort__detaljer">
      <dl className="mekanismekort__fakta">
        <div>
          <dt>Effekt</dt>
          <dd>
            <Uthev tekst={kort.effekt} />
            {kort.kvalifikasjon && (
              <span className="mekanismekort__kvalifikasjon">
                {' · '}
                <Uthev tekst={kort.kvalifikasjon} />
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Mekanisme</dt>
          <dd>
            <Uthev tekst={mekanisme?.navn ?? 'Ikke angitt'} />
          </dd>
        </div>
        <div>
          <dt>Retning</dt>
          <dd className="mekanismekort__retning">
            <span className="mekanismekort__symbol" aria-hidden="true">
              {retning.symbol}
            </span>
            <Uthev tekst={retning.navn} />
          </dd>
        </div>
      </dl>
      {kort.merknad && (
        <p className="mekanismekort__merknad">
          <Uthev tekst={kort.merknad} />
        </p>
      )}
      {!erTomt(kort.dokument) && <Riktekst dokument={kort.dokument} />}
    </div>
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
