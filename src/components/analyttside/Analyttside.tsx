import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Analyttkatalog } from '../../domain/analyttkatalog'
import { byggSidemodell, type Publiseringssteg } from '../../faginnhold/analyttside'
import { endredeFelt } from '../../faginnhold/historikk'
import type { Analyttsidedata, Regelsettutgave } from '../../faginnhold/lesing'
import { PANELER, lesKinetikk, panelFor } from '../../faginnhold/paneler'
import { indekserSide, sokeord } from '../../faginnhold/sok'
import { lagLiggerOver, skrivesIFelt } from '../../hooks/useKeyboard'
import type { Analyte } from '../../types'
import { Button } from '../Button'
import { StepBar } from '../StepBar'
import { BackIcon } from '../icons'
import { Referanseliste } from '../referanser/Referanseliste'
import { SeksjonsstyringKilde, skuffnokkel, useSeksjonsstyring } from '../seksjoner/Seksjonsstyring'
import { Sidereferanser } from '../referanser/Sidereferanser'
import { useFaginnholdskilde } from './Faginnholdskilde'
import { Identitetspanel, komponenterFor } from './Identitetspanel'
import { Datakortpanel, Kortpanel, Tabellpanel, Tekstpanel, type Panelkontekst } from './Paneler'
import { Redigeringskilde } from './Redigeringskontekst'
import { Sidesok } from './Sidesok'
import { Scenarioregler, useScenarioreglerFor } from '../regler/Scenarioregler'
import { Uthevingskilde } from '../Uthev'
import { Fortolkningsregler, regelsettfelterMedTekst } from '../regler/Fortolkningsregler'
import { losRegelsett } from '../../regler/kommentarer'
import { useAnalyttside, type Sidemodus } from './useAnalyttside'

export interface AnalyttsideProps {
  /** Analyttkoden fra adressen. */
  kode: string
  /** Seksjonen og eventuelt detaljkortet adressen peker på (se `src/domain/rute.ts`). */
  sted?: readonly string[]
  katalog: Analyttkatalog
  /** Åpner fortolkningsmodulen koden hører til. */
  onApneFortolkning: (analyte: Analyte) => void
  /** Tilbake til fortolkningen slik den sto. */
  onLukk: () => void
}

/**
 * Informasjonssiden for en analyttkode.
 *
 * Siden er et oppslagsverk: sju paneler i fast rekkefølge (se
 * `src/faginnhold/paneler.ts`), med referansene nummerert etter første
 * forekomst og listet nederst. Identiteten står alltid fram; de andre
 * panelene er seksjoner som åpnes og lukkes, med en kort oppsummering når de
 * er lukket (`src/components/seksjoner/`). En adresse med et sted etter koden
 * åpner seksjonen eller detaljkortet den peker på. Den åpnes fra sidemenyen, fra kodepillene i
 * fortolkningsmodulene og fra sin egen adresse, og har «Åpne fortolkning» for
 * veien tilbake til arbeidsflyten.
 *
 * Normalt står siden i lesemodus og viser det publiserte. Administratorer kan
 * slå på redigeringsmodus, som viser utkastet med diskrete knapper for å endre
 * det, og publiserer når de er ferdige.
 *
 * Tastene: `Escape` lukker siden, `/` går til søket på siden.
 */
export function Analyttside({ kode, sted, katalog, onApneFortolkning, onLukk }: AnalyttsideProps) {
  const oppforing = katalog.finn(kode)
  useEffect(() => {
    const forrige = document.title
    document.title = oppforing ? `${oppforing.sidenavn} (${oppforing.kode}) – OUSFAR` : `${kode} – OUSFAR`
    return () => {
      document.title = forrige
    }
  }, [kode, oppforing])

  useLukkMedEscape(onLukk)

  if (!oppforing) {
    return (
      <section className="steg analyttside" aria-labelledby="ukjent-analytt">
        <StepBar>
          <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onLukk}>
            Lukk
          </Button>
        </StepBar>
        <div className="kort kort--start">
          <h1 id="ukjent-analytt" className="identitet__navn">
            Fant ingen analytt med koden {kode}
          </h1>
          <p>Sjekk koden i adressen, eller finn analytten i menyen.</p>
        </div>
      </section>
    )
  }
  // Nøkkelen gir hver kode en frisk side: modus, søk, skjemaer og hvilke
  // seksjoner som er åpne, hører til siden.
  return (
    <SeksjonsstyringKilde key={oppforing.kode}>
      <Innhold
        kode={oppforing.kode}
        sted={sted}
        katalog={katalog}
        onApneFortolkning={onApneFortolkning}
        onLukk={onLukk}
      />
    </SeksjonsstyringKilde>
  )
}

/** `Escape` lukker siden — men ikke fra et felt, et åpent skjema eller et lag over den. */
function useLukkMedEscape(onLukk: () => void) {
  const lukk = useRef(onLukk)
  lukk.current = onLukk
  useEffect(() => {
    const paaTast = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (lagLiggerOver() || skrivesIFelt()) return
      if (document.querySelector('.analyttside .redigering')) return
      event.preventDefault()
      lukk.current()
    }
    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [])
}

function Innhold({ kode, sted, katalog, onApneFortolkning, onLukk }: AnalyttsideProps) {
  const oppforing = katalog.finn(kode)!
  const { kanRedigere } = useFaginnholdskilde()
  const [modus, setModus] = useState<Sidemodus>('lese')
  const [sporring, setSporring] = useState('')
  const beholder = useRef<HTMLElement>(null)
  const overskrift = useId()

  const handlinger = useAnalyttside(oppforing, modus)
  const { side, referansebase, publisertRegelsett, konflikt, plan } = handlinger
  const modell = useMemo(() => byggSidemodell(side.data), [side.data])
  const navn = side.data.infoside?.innhold.navn ?? oppforing.sidenavn
  const komponenter = useMemo(() => komponenterFor(oppforing, side.data, katalog), [oppforing, side.data, katalog])
  // Knappene for å endre vises først når utkastet er hentet, så ingenting
  // lagres mot det publiserte som sto før redigeringen ble slått på.
  const redigerer = handlinger.kanEndres

  const dokumenter = useMemo(
    () => indekserSide({ kode: oppforing.kode, navn, komponenter: komponenter.map((k) => k.navn) }, modell),
    [oppforing.kode, navn, komponenter, modell],
  )
  const ord = useMemo(() => sokeord(sporring), [sporring])

  const kontekst: Panelkontekst = { modell, redigerer, handlinger }
  const redigeringsverdi = useMemo(
    () => ({ referansebase, opprettReferanse: handlinger.opprettReferanse, gjenopprett: handlinger.gjenopprett }),
    [referansebase, handlinger.opprettReferanse, handlinger.gjenopprett],
  )
  const regler = useScenarioreglerFor(oppforing.fortolkning)
  const harInnhold = modell.paneler.size > 0 || Object.keys(modell.panelreferanser).length > 0

  // En side som åpnes, begynner øverst, med fokus på navnet — så tastaturet og
  // skjermleseren står der siden begynner, og ikke igjen i menyen eller modulen.
  // Peker adressen på et sted på siden, åpnes det og rulles det dit i stedet.
  const styring = useSeksjonsstyring()
  const apne = styring?.apne
  const stedsnokkel = skuffnokkel(sted ?? [])
  const pekerPaaSted = useRef(stedsnokkel !== '')
  useEffect(() => {
    if (!pekerPaaSted.current) window.scrollTo({ top: 0 })
    document.getElementById(overskrift)?.focus({ preventScroll: true })
  }, [overskrift])
  // Nøkkelen, og ikke lista, avgjør om stedet er nytt: en ny adresse til det
  // samme stedet skal ikke rulle siden dit på nytt.
  const stedet = useRef(sted)
  stedet.current = sted
  useEffect(() => {
    if (stedsnokkel && stedet.current) apne?.(stedet.current)
  }, [stedsnokkel, apne])

  return (
    <section ref={beholder} className="analyttside" aria-labelledby={overskrift} data-modus={modus}>
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onLukk}>
          Lukk
        </Button>
        <Button variant="subtle" onClick={() => onApneFortolkning(oppforing.fortolkning)}>
          Åpne fortolkning
        </Button>
        {styring && (harInnhold || regler) && (
          <Button variant="subtle" onClick={() => styring.settAlle(!styring.alleApne)}>
            {styring.alleApne ? 'Lukk alle' : 'Åpne alle'}
          </Button>
        )}
        {kanRedigere && (
          <Button
            variant="subtle"
            aria-pressed={modus === 'rediger'}
            onClick={() => {
              // Den som redigerer, skal se hele siden: alt åpnes.
              if (modus === 'lese') styring?.settAlle(true)
              setModus(modus === 'rediger' ? 'lese' : 'rediger')
            }}
          >
            {modus === 'rediger' ? 'Avslutt redigering' : 'Rediger'}
          </Button>
        )}
      </StepBar>

      <Sidesok
        sporring={sporring}
        onEndre={setSporring}
        beholder={beholder}
        dokumenter={dokumenter}
        innholdsnokkel={side.data}
      />

      {modus === 'rediger' && (
        <Redigeringsstripe
          data={side.data}
          publisertRegelsett={publisertRegelsett}
          plan={plan}
          laster={!redigerer}
          onPubliser={handlinger.publiser}
        />
      )}
      {konflikt && (
        <div className="sidevarsel" role="alert">
          <p>Noen andre har endret siden mens du redigerte. Ingenting er skrevet over.</p>
          <Button variant="subtle" onClick={handlinger.lastInn}>
            Hent nyeste utgave
          </Button>
        </div>
      )}
      {side.status === 'feil' && (
        <div className="sidevarsel" role="alert">
          <p>Fikk ikke hentet innholdet på siden. {side.feil}</p>
          <Button variant="subtle" onClick={handlinger.lastInn}>
            Prøv igjen
          </Button>
        </div>
      )}

      <Uthevingskilde ord={ord}>
        <Sidereferanser nummerering={modell.nummerering} referanser={modell.referanser}>
          <Redigeringskilde verdi={redigeringsverdi}>
            <div className="analyttside__paneler" aria-busy={side.status === 'laster'}>
              {PANELER.map((definisjon) => {
                switch (definisjon.form) {
                  case 'identitet':
                    return (
                      <Identitetspanel
                        key={definisjon.nokkel}
                        definisjon={definisjon}
                        kontekst={kontekst}
                        oppforing={oppforing}
                        navn={navn}
                        komponenter={komponenter}
                        overskriftId={overskrift}
                      />
                    )
                  case 'datakort':
                    return <Datakortpanel key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} />
                  case 'tekst':
                    return <Tekstpanel key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} />
                  case 'kort':
                    return <Kortpanel key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} />
                  case 'tabell':
                    return <Tabellpanel key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} />
                }
              })}

              {!redigerer && side.status === 'klar' && !harInnhold && (
                <p className="analyttside__tom">Denne siden har ikke fått faginnhold ennå.</p>
              )}
              {regler && <Scenarioregler {...regler} />}
              <Fortolkningsregler
                utgave={side.data.regelsett}
                publisert={publisertRegelsett}
                redigerer={redigerer}
                onLagre={handlinger.lagreRegelsett}
                hentNyeste={handlinger.hentRegelsettutkast}
              />
              <Referanseliste />
            </div>
          </Redigeringskilde>
        </Sidereferanser>
      </Uthevingskilde>
    </section>
  )
}

/**
 * Hva et publiseringssteg gjelder, slik det står i oppsummeringen. For
 * regelsettet står også hva som er endret siden det som er publisert.
 */
export function beskrivSteg(
  steg: Publiseringssteg,
  data: Analyttsidedata,
  publisertRegelsett: Regelsettutgave | null = null,
): string {
  switch (steg.slag) {
    case 'intervallregelsett': {
      const regelsett = data.regelsett
      const navn = `Fortolkningsreglene for ${regelsett?.regelsett.innhold.analyttkode ?? 'koden'}`
      if (!regelsett || !publisertRegelsett) return navn
      const endret = endredeFelt(
        regelsettfelterMedTekst(losRegelsett(publisertRegelsett)),
        regelsettfelterMedTekst(losRegelsett(regelsett)),
      )
      return endret.length > 0 ? `${navn} (${endret.join(', ')})` : navn
    }
    case 'kommentar': {
      const kommentar = data.regelsett?.kommentarer.find((k) => k.id === steg.id)
      return `Kommentar: ${kommentar?.innhold.navn ?? 'en kommentar fortolkningsreglene bruker'}`
    }
    case 'referanse': {
      const referanse = data.referanser.find((r) => r.id === steg.id)
      return `Referanse: ${referanse?.innhold.tittel || referanse?.innhold.forfattere || 'uten tittel'}`
    }
    case 'komponent': {
      const side = data.komponenter.find((k) => k.id === steg.id)
      return `Siden for ${side?.innhold.navn ?? 'en komponent'}`
    }
    case 'infoside':
      return `Siden ${data.infoside?.innhold.navn ?? ''} og kildene for panelene`.replace('  ', ' ')
    case 'laboratorieanalytt':
      return `Analyttkoden ${data.analytt?.innhold.kode ?? ''}`
    case 'innholdselement': {
      const element = data.elementer.find((e) => e.id === steg.id)
      if (!element) return 'Et kort'
      const panel = panelFor(element.innhold.panel)
      const tittel = lesKinetikk(element.innhold.data).tittel
      if (!panel) return tittel ? `Fjernet: ${tittel}` : 'Et fjernet kort'
      return [panel.tittel, tittel].filter(Boolean).join(' › ')
    }
  }
}

/**
 * Stripa øverst i redigeringsmodus: hva modusen betyr, og publiseringen.
 * Før noe publiseres, vises hva som vil bli synlig for alle.
 */
function Redigeringsstripe({
  data,
  publisertRegelsett,
  plan,
  laster,
  onPubliser,
}: {
  data: Analyttsidedata
  publisertRegelsett: Regelsettutgave | null
  plan: Publiseringssteg[]
  /** Sant mens utkastet hentes etter at redigeringen er slått på. */
  laster: boolean
  onPubliser: () => Promise<void>
}) {
  const [bekrefter, setBekrefter] = useState(false)
  const [publiserer, setPubliserer] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [ferdig, setFerdig] = useState(false)
  const tittel = useId()

  const publiser = async () => {
    setPubliserer(true)
    setFeil(null)
    try {
      await onPubliser()
      setFerdig(true)
      setBekrefter(false)
    } catch (e) {
      setFeil((e as Error).message)
    } finally {
      setPubliserer(false)
    }
  }

  return (
    <div className="redigeringsstripe" role="region" aria-labelledby={tittel}>
      <p id={tittel} className="redigeringsstripe__tekst">
        <strong>Redigeringsmodus.</strong> Du ser utkastet. Endringene blir synlige for andre først når de
        publiseres.
      </p>
      {!data.analytt && !laster && (
        <p className="redigeringsstripe__tekst">Siden opprettes i databasen første gang du lagrer noe på den.</p>
      )}
      {laster ? (
        <p className="redigeringsstripe__tekst" role="status">
          Henter utkastet …
        </p>
      ) : plan.length === 0 ? (
        <p className="redigeringsstripe__tekst" role="status">
          {ferdig ? 'Alt er publisert.' : 'Ingen upubliserte endringer.'}
        </p>
      ) : bekrefter ? (
        <div className="publisering">
          <p className="redigeringsstripe__tekst">Dette blir publisert og synlig for alle:</p>
          <ul className="publisering__liste">
            {plan.map((steg) => (
              <li key={steg.id}>{beskrivSteg(steg, data, publisertRegelsett)}</li>
            ))}
          </ul>
          {feil && (
            <p className="skjemafeil" role="alert">
              {feil}
            </p>
          )}
          <div className="skjema__knapper">
            <Button variant="subtle" onClick={() => setBekrefter(false)}>
              Avbryt
            </Button>
            <Button className="knapp--kompakt" disabled={publiserer} onClick={() => void publiser()}>
              {publiserer ? 'Publiserer …' : 'Publiser nå'}
            </Button>
          </div>
        </div>
      ) : (
        <Button className="knapp--kompakt" onClick={() => setBekrefter(true)}>
          Publiser endringene ({plan.length})
        </Button>
      )}
    </div>
  )
}
