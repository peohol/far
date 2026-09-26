import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Analyttkatalog } from '../../domain/analyttkatalog'
import { byggSidemodell, referanseunivers } from '../../faginnhold/analyttside'
import { PANELER } from '../../faginnhold/paneler'
import { indekserSide, sokeord } from '../../faginnhold/sok'
import { useLukkMedEscape } from '../../hooks/useLukkMedEscape'
import type { Analyte } from '../../types'
import { Button } from '../Button'
import { Ikonknapp } from '../Ikonknapp'
import { Lukkeknapp } from '../Lukkeknapp'
import { ToppmenyInnhold } from '../toppmeny/Toppmenykilde'
import { Toppmenyknapp } from '../toppmeny/Toppmenyknapp'
import { Referanseliste } from '../referanser/Referanseliste'
import { SeksjonsstyringKilde, skuffnokkel, useSeksjonsstyring } from '../seksjoner/Seksjonsstyring'
import { Sidereferanser } from '../referanser/Sidereferanser'
import { useFaginnholdskilde } from './Faginnholdskilde'
import { Identitetspanel, komponenterFor } from './Identitetspanel'
import { finnKobling, Preparatpanel, preparatsoketekster } from './Preparatpanel'
import { useLegemidler } from './useLegemidler'
import { Interaksjonspanel, interaksjonssoketekster } from './Interaksjonspanel'
import { useInteraksjoner } from './useInteraksjoner'
import { Kortpanel, Tabellpanel, Tekstpanel, type Panelkontekst } from './Paneler'
import { ViktigeData } from './ViktigeData'
import { Redigeringskilde } from './Redigeringskontekst'
import { Redigeringshandlinger } from './Redigeringslinje'
import { Sidesok } from './Sidesok'
import { Scenarioregler, useScenarioreglerFor } from '../regler/Scenarioregler'
import { useScenarioreglerkilde } from '../regler/Scenarioreglerkilde'
import { Uthevingskilde } from '../Uthev'
import { Fortolkningsregler } from '../regler/Fortolkningsregler'
import { Thcregler } from '../regler/Thcregler'
import { festreferanser } from '../../legemiddeldata/referanser'
import { slaSammenAutomatiske } from '../../faginnhold/referanser'
import { clinpgxreferanser } from '../../clinpgx/referanser'
import { FARMAKOGENETIKKPANEL, kobledeKjemikalier, koblingsgrunnlag } from '../../clinpgx/stoffside'
import { Farmakogenetikkpanel, farmakogenetikksoketekster } from './Farmakogenetikkpanel'
import { useFarmakogenetikk } from './useFarmakogenetikk'
import { useAnalyttside, type Sidemodus, type Sidenokkel } from './useAnalyttside'
import { analyttadresse } from '../../domain/rute'

interface Sideprops {
  /** Seksjonen og eventuelt detaljkortet adressen peker på (se `src/domain/rute.ts`). */
  sted?: readonly string[]
  katalog: Analyttkatalog
  /** Åpner fortolkningsmodulen koden hører til. */
  onApneFortolkning: (analyte: Analyte) => void
  /** Tilbake til fortolkningen slik den sto. */
  onLukk: () => void
}

export type AnalyttsideProps = Sideprops &
  (
    | {
        /** Analyttkoden fra adressen. */
        kode: string
        stoff?: undefined
      }
    | {
        /** Navnet på et stoff uten analyttkode, fra adressen. */
        stoff: string
        kode?: undefined
      }
  )

/**
 * Informasjonssiden for en analyttkode, eller for et stoff som ikke har noen
 * analyttkode (`stoff`, etter navnet). Har stoffet en side i katalogen, er det
 * siden for koden som vises, og adressen går dit.
 *
 * Siden er et oppslagsverk: panelene i fast rekkefølge (se
 * `src/faginnhold/paneler.ts`), med referansene nummerert etter første
 * forekomst og listet nederst. Identiteten og viktige data står alltid fram
 * øverst; de andre panelene er seksjoner som åpnes og lukkes, med en kort oppsummering når de
 * er lukket (`src/components/seksjoner/`). En adresse med et sted etter koden
 * åpner seksjonen eller detaljkortet den peker på. Den åpnes fra sidemenyen, fra kodepillene i
 * fortolkningsmodulene og fra sin egen adresse, og har «Åpne fortolkning» for
 * veien tilbake til arbeidsflyten.
 *
 * Normalt står siden i lesemodus og viser det publiserte. Administratorer kan
 * slå på redigeringsmodus, som viser utkastet med diskrete knapper for å endre
 * det, og publiserer når de er ferdige.
 *
 * Tastene: `Escape` lukker siden, `Ctrl + B` eller `Cmd + B` går til søket på
 * siden, og `Ctrl + K` eller `Cmd + K` til fagsøket i toppmenyen.
 */
export function Analyttside(props: AnalyttsideProps) {
  const { sted, katalog, onApneFortolkning, onLukk } = props
  // Et stoff med en side i katalogen er siden for koden.
  const tilKode = props.stoff !== undefined ? katalog.kodeForSide(props.stoff) : undefined
  const kode = props.kode ?? tilKode
  const oppforing = kode ? katalog.finn(kode) : undefined
  const nokkel: Sidenokkel | null = oppforing
    ? { type: 'kode', oppforing }
    : props.stoff !== undefined
      ? { type: 'stoff', navn: props.stoff }
      : null

  useEffect(() => {
    if (tilKode) window.location.replace(analyttadresse(tilKode, sted ?? []))
  }, [tilKode, sted])

  useEffect(() => {
    const forrige = document.title
    document.title = oppforing
      ? `${oppforing.sidenavn} (${oppforing.kode}) – OUSFAR`
      : `${props.stoff ?? props.kode} – OUSFAR`
    return () => {
      document.title = forrige
    }
  }, [props.kode, props.stoff, oppforing])

  useLukkMedEscape(onLukk)

  if (!nokkel) {
    return <Ikkefunnet onLukk={onLukk}>Fant ingen analytt med koden {props.kode}</Ikkefunnet>
  }
  // Nøkkelen gir hver side en frisk tilstand: modus, søk, skjemaer og hvilke
  // seksjoner som er åpne, hører til siden.
  return (
    <SeksjonsstyringKilde key={nokkel.type === 'kode' ? nokkel.oppforing.kode : `stoff:${nokkel.navn.toLocaleLowerCase('nb')}`}>
      <Innhold nokkel={nokkel} sted={sted} katalog={katalog} onApneFortolkning={onApneFortolkning} onLukk={onLukk} />
    </SeksjonsstyringKilde>
  )
}

/** En side som ikke finnes. */
function Ikkefunnet({ onLukk, children }: { onLukk: () => void; children: ReactNode }) {
  return (
    <section className="steg analyttside" aria-labelledby="ukjent-analytt">
      <ToppmenyInnhold spor="handlinger">
        <Lukkeknapp onLukk={onLukk} />
      </ToppmenyInnhold>
      <div className="kort kort--start">
        <h1 id="ukjent-analytt" className="analytt__navn">
          {children}
        </h1>
        <p>Sjekk adressen, eller finn stoffet i menyen.</p>
      </div>
    </section>
  )
}

function Innhold({ nokkel, sted, katalog, onApneFortolkning, onLukk }: Sideprops & { nokkel: Sidenokkel }) {
  const oppforing = nokkel.type === 'kode' ? nokkel.oppforing : null
  const { kanRedigere } = useFaginnholdskilde()
  const [modus, setModus] = useState<Sidemodus>('lese')
  const [sporring, setSporring] = useState('')
  const beholder = useRef<HTMLElement>(null)
  const overskrift = useId()

  const handlinger = useAnalyttside(nokkel, modus)
  const { side, referansebase, publisert, konflikt, plan } = handlinger
  const modell = useMemo(() => byggSidemodell(side.data), [side.data])
  const navn = side.data.infoside?.innhold.navn ?? oppforing?.sidenavn ?? (nokkel.type === 'stoff' ? nokkel.navn : '')
  const komponenter = useMemo(
    () => (oppforing ? komponenterFor(oppforing, side.data, katalog) : []),
    [oppforing, side.data, katalog],
  )
  // Et stoff som viser seg å være hovedside for en kode appen kjenner, hører
  // til siden for koden.
  const tilKode = !oppforing && side.data.analytt ? katalog.finn(side.data.analytt.innhold.kode)?.kode : undefined
  useEffect(() => {
    if (tilKode) window.location.replace(analyttadresse(tilKode, sted ?? []))
  }, [tilKode, sted])
  // Et stoff uten side finnes ikke for andre enn redaktørene, som kan lage den.
  const finnes = oppforing ? side.data.analytt !== null : side.data.infoside !== null
  // Knappene for å endre vises først når utkastet er hentet, så ingenting
  // lagres mot det publiserte som sto før redigeringen ble slått på.
  const redigerer = handlinger.kanEndres

  const koblet = useMemo(() => finnKobling(modell).kobling.virkestoff.map((v) => v.fest_id), [modell])
  const legemidler = useLegemidler(koblet)
  const interaksjoner = useInteraksjoner(legemidler, koblet)
  const kjemikalier = useMemo(() => kobledeKjemikalier(modell), [modell])
  const farmakogenetikk = useFarmakogenetikk(kjemikalier)
  const pgx = farmakogenetikk.tilstand
  // Redaksjonelle og automatiske referanser (FEST og ClinPGx) nummereres sammen.
  const univers = useMemo(
    () =>
      referanseunivers(
        modell,
        slaSammenAutomatiske(
          festreferanser(
            legemidler.status === 'klar' ? legemidler.utvalg : null,
            interaksjoner.status === 'klar' ? interaksjoner.oversikt : null,
          ),
          clinpgxreferanser(pgx.status === 'klar' ? pgx.utvalg : null, pgx.status === 'klar' ? pgx.visning : null),
        ),
      ),
    [modell, legemidler, interaksjoner, pgx],
  )
  const grunnlag = useMemo(
    () => koblingsgrunnlag(legemidler.status === 'klar' ? legemidler.utvalg : null, koblet),
    [legemidler, koblet],
  )

  const dokumenter = useMemo(
    () =>
      indekserSide(
        { ...(oppforing && { kode: oppforing.kode }), navn, komponenter: komponenter.map((k) => k.navn) },
        modell,
        [...preparatsoketekster(legemidler), ...interaksjonssoketekster(interaksjoner), ...farmakogenetikksoketekster(pgx)],
      ),
    [oppforing, navn, komponenter, modell, legemidler, interaksjoner, pgx],
  )
  const ord = useMemo(() => sokeord(sporring), [sporring])

  const kontekst: Panelkontekst = { modell, redigerer, handlinger }
  const redigeringsverdi = useMemo(
    () => ({
      redigerer,
      referansebase,
      opprettReferanse: handlinger.opprettReferanse,
      gjenopprett: handlinger.gjenopprett,
    }),
    [redigerer, referansebase, handlinger.opprettReferanse, handlinger.gjenopprett],
  )
  // Scenarioreglene: i redigeringen utkastet, ellers de publiserte appen alt har.
  const utkastregler = side.data.scenarioregelsett
  const scenarioredigering = useMemo(
    () =>
      redigerer && utkastregler
        ? {
            utgave: utkastregler,
            publisert: publisert.scenarioregelsett,
            onLagre: handlinger.lagreScenarioregelsett,
            hentNyeste: handlinger.hentScenarioregelsettutkast,
          }
        : null,
    [redigerer, utkastregler, publisert.scenarioregelsett, handlinger.lagreScenarioregelsett, handlinger.hentScenarioregelsettutkast],
  )
  const regler = useScenarioreglerFor(oppforing?.fortolkning ?? null, scenarioredigering)
  // Etter en publisering skal fortolkningen bruke de nye reglene.
  const { provIgjen: hentScenarioreglerPaNytt } = useScenarioreglerkilde()
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

  if (!oppforing && !kanRedigere && side.status === 'klar' && !finnes) {
    return <Ikkefunnet onLukk={onLukk}>Fant ingen stoffside som heter {navn}</Ikkefunnet>
  }

  return (
    <section ref={beholder} className="analyttside" aria-labelledby={overskrift} data-modus={modus}>
      {/* Sidens handlinger står i toppmenyen (i dokken på smale flater). */}
      <ToppmenyInnhold spor="handlinger">
        {/* Mens siden redigeres, er det redigeringen som står i menyen; veien
            ut er «Avslutt redigering», og Escape lukker siden som før. */}
        {kanRedigere && modus === 'rediger' ? (
          <Redigeringshandlinger
            data={side.data}
            publisert={publisert}
            plan={plan}
            laster={!redigerer}
            onPubliser={async () => {
              await handlinger.publiser()
              hentScenarioreglerPaNytt()
            }}
            onAvslutt={() => setModus('lese')}
          />
        ) : (
          <>
            {oppforing && (
              <Toppmenyknapp
                ikon="interp"
                variant="primar"
                onClick={() => onApneFortolkning(oppforing.fortolkning)}
              >
                Åpne fortolkning
              </Toppmenyknapp>
            )}
            {kanRedigere && (
              <Ikonknapp ikon="edit" etikett="Rediger" aria-pressed="false" onClick={() => setModus('rediger')} />
            )}
            <Lukkeknapp onLukk={onLukk} />
          </>
        )}
      </ToppmenyInnhold>

      {/* Søket på siden står også i toppmenyen, foran handlingene. */}
      <ToppmenyInnhold spor="sidesok">
        <Sidesok
          sporring={sporring}
          onEndre={setSporring}
          beholder={beholder}
          dokumenter={dokumenter}
          innholdsnokkel={side.data}
        />
      </ToppmenyInnhold>

      {modus === 'rediger' && redigerer && !finnes && (
        <p className="redigeringsstripe">Siden opprettes i databasen første gang du lagrer noe på den.</p>
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
        <Sidereferanser
          nummerering={univers.nummerering}
          referanser={univers.referanser}
          panelreferanser={univers.panelreferanser}
        >
          <Redigeringskilde verdi={redigeringsverdi}>
            <div className="analyttside__paneler" aria-busy={side.status === 'laster'}>
              {PANELER.map((definisjon) => {
                switch (definisjon.form) {
                  case 'identitet':
                    return (
                      <Identitetspanel
                        key={definisjon.nokkel}
                        definisjon={definisjon}
                        oppforing={oppforing}
                        navn={navn}
                        komponenter={komponenter}
                        overskriftId={overskrift}
                      />
                    )
                  case 'legemidler':
                    return (
                      <Preparatpanel
                        key={definisjon.nokkel}
                        definisjon={definisjon}
                        kontekst={kontekst}
                        sidenavn={oppforing?.sidenavn ?? navn}
                        legemidler={legemidler}
                      />
                    )
                  case 'interaksjoner':
                    return (
                      <Interaksjonspanel
                        key={definisjon.nokkel}
                        definisjon={definisjon}
                        kontekst={kontekst}
                        koblet={koblet.length > 0}
                        interaksjoner={interaksjoner}
                      />
                    )
                  case 'datakort':
                    return <ViktigeData key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} />
                  case 'tekst':
                    return <Tekstpanel key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} />
                  case 'kort':
                    return definisjon.nokkel === FARMAKOGENETIKKPANEL ? (
                      <Farmakogenetikkpanel
                        key={definisjon.nokkel}
                        definisjon={definisjon}
                        kontekst={kontekst}
                        tilstand={pgx}
                        grunnlag={grunnlag}
                        sidenavn={oppforing?.sidenavn ?? navn}
                        onHentet={farmakogenetikk.lesPaNytt}
                      />
                    ) : (
                      <Kortpanel key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} />
                    )
                  case 'tabell':
                    return <Tabellpanel key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} />
                }
              })}

              {!redigerer && side.status === 'klar' && !harInnhold && (
                <p className="analyttside__tom">Denne siden har ikke fått faginnhold ennå.</p>
              )}
              {regler && <Scenarioregler {...regler} />}
              {side.data.thcregelsett && (
                <Thcregler
                  utgave={side.data.thcregelsett}
                  redigerer={redigerer}
                  onLagre={handlinger.lagreThcRegelsett}
                />
              )}
              <Fortolkningsregler
                utgave={side.data.regelsett}
                publisert={publisert.regelsett}
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
