import { useCallback, useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { Bevaringsomrade, useBevart } from '../../oppdatering/Bevaring'
import type { Analyttkatalog, Laboratorieanalytt } from '../../domain/analyttkatalog'
import { byggSidemodell, referanseunivers } from '../../faginnhold/stoffside'
import { PANELER } from '../../faginnhold/paneler'
import { indekserSide, sokeord, stoffidentitet } from '../../faginnhold/sok'
import { useLukkMedEscape } from '../../hooks/useLukkMedEscape'
import type { Analyte } from '../../types'
import { Button } from '../Button'
import { Favorittknapp } from '../Favorittknapp'
import { Ikonknapp } from '../Ikonknapp'
import { Lukkeknapp } from '../Lukkeknapp'
import { ToppmenyInnhold } from '../toppmeny/Toppmenykilde'
import { Toppmenyknapp } from '../toppmeny/Toppmenyknapp'
import { Referanseliste } from '../referanser/Referanseliste'
import { SeksjonsstyringKilde, skuffnokkel, useSeksjonsstyring } from '../seksjoner/Seksjonsstyring'
import { Sidereferanser } from '../referanser/Sidereferanser'
import { useFaginnholdskilde } from './Faginnholdskilde'
import { useFavoritter } from '../../favoritter/Favorittkilde'
import { useStoffregisterkilde } from '../../stoffregister/Stoffregisterkilde'
import { Fagsidebanner, Fagsidemeny } from '../stoffregister/Fagsidestatus'
import { Registerhandlingskilde } from '../stoffregister/Registerhandling'
import { Identitetspanel } from './Identitetspanel'
import { finnKobling, Preparatpanel, preparatsoketekster } from './Preparatpanel'
import { useLegemidler } from './useLegemidler'
import { Interaksjonspanel, interaksjonssoketekster } from './Interaksjonspanel'
import { useInteraksjoner } from './useInteraksjoner'
import { Kortpanel, Mekanismepanel, Tabellpanel, Tekstpanel, type Panelkontekst } from './Paneler'
import { ViktigeData } from './ViktigeData'
import { Redigeringskilde } from './Redigeringskontekst'
import { Redigeringshandlinger } from './Redigeringslinje'
import { Sidesok } from './Sidesok'
import { Scenarioregler, useScenarioreglerFor, type Delingsside } from '../regler/Scenarioregler'
import { useScenarioreglerkilde } from '../regler/Scenarioreglerkilde'
import { Uthevingskilde } from '../Uthev'
import { Fortolkningsregler } from '../regler/Fortolkningsregler'
import { Thcregler } from '../regler/Thcregler'
import { festreferanser } from '../../legemiddeldata/referanser'
import { slaSammenAutomatiske } from '../../faginnhold/referanser'
import { clinpgxlitteratur, clinpgxreferanser } from '../../clinpgx/referanser'
import { cpicreferanser } from '../../cpic/referanser'
import { FARMAKOGENETIKKPANEL, kobledeKjemikalier, koblingsgrunnlag } from '../../clinpgx/stoffside'
import { Farmakogenetikkpanel, farmakogenetikksoketekster } from './Farmakogenetikkpanel'
import { useBivirkninger, useCpic, useFarmakogenetikk } from './useFarmakogenetikk'
import { Bivirkningspanel, bivirkningssoketekster, harBivirkninger } from './Bivirkningspanel'
import { BIVIRKNINGSPANEL, bivirkningsreferanser } from '../../bivirkninger/referanser'
import { visningForKort } from '../../bivirkninger/stoffside'
import type { Visning } from '../../bivirkninger/modell'
import { useStoffside, type Sidemodus, type Stoffsidehandlinger } from './useStoffside'
import type { Stoff, Stoffregister } from '../../domain/stoffregister'
import {
  analytterForStoff,
  fortolkningForStoff,
  regelseksjoner,
  type Regelseksjon,
} from '../../domain/koblinger'
import { rusModulFor } from '../../domain/rus'
import { THC_KODE } from '../../domain/thc'
import type { Regeldata } from '../../faginnhold/lesing'

export interface StoffsideProps {
  /** Stoffets nøkkel fra adressen (`#/stoff/<nøkkel>`). */
  stoff: string
  /** Seksjonen og eventuelt detaljkortet adressen peker på (se `src/domain/rute.ts`). */
  sted?: readonly string[]
  /** Stoffregisteret, med stoffsidene i databasen. */
  register: Stoffregister
  /** Laboratorieanalyttene koblingene i registeret peker på. */
  katalog: Analyttkatalog
  /** Åpner fortolkningsmodulen analytten hører til. */
  onApneFortolkning: (analyte: Analyte) => void
  /** Tilbake til fortolkningen slik den sto. */
  onLukk: () => void
}

/**
 * Stoffsiden: den eneste fagsiden appen har. Hvert stoff i stoffregisteret har
 * én, etter nøkkelen, og den handler alltid om stoffet — aldri om en
 * laboratorieanalytt.
 *
 * Siden er et oppslagsverk: panelene i fast rekkefølge (se
 * `src/faginnhold/paneler.ts`), med referansene nummerert etter første
 * forekomst og listet nederst. Identiteten og viktige data står alltid fram
 * øverst; de andre panelene er seksjoner som åpnes og lukkes, med en kort
 * oppsummering når de er lukket (`src/components/seksjoner/`). En adresse med
 * et sted etter nøkkelen åpner seksjonen eller detaljkortet den peker på.
 *
 * Laboratorieanalyttene stoffet er koblet til i registeret, står som sekundær
 * informasjon i identitetspanelet. Fortolkningsreglene for analyttene stoffet
 * er primært stoff for, står nederst, lest for seg fra fortolkningssystemet
 * (`src/domain/koblinger.ts`). Har stoffet analytter i én fortolkningsmodul,
 * har siden «Åpne fortolkning» i toppmenyen; ellers åpnes hver fra koden sin.
 *
 * Normalt står siden i lesemodus og viser det publiserte. Administratorer kan
 * slå på redigeringsmodus, som viser utkastet med diskrete knapper for å endre
 * det, og publiserer når de er ferdige.
 *
 * Tastene: `Escape` lukker siden, `Ctrl + B` eller `Cmd + B` går til søket på
 * siden, og `Ctrl + K` eller `Cmd + K` til fagsøket i toppmenyen.
 */
export function Stoffside(props: StoffsideProps) {
  useLukkMedEscape(props.onLukk)
  // Nøkkelen gir hver side en frisk tilstand: modus, søk, skjemaer og hvilke
  // seksjoner som er åpne, hører til siden. Det samme tas vare på når appen
  // oppdateres, under sidens eget område.
  return (
    <Bevaringsomrade navn={`stoff:${props.stoff}`}>
      <SeksjonsstyringKilde key={props.stoff} bevares>
        <Registerhandlingskilde>
          <Innhold {...props} />
        </Registerhandlingskilde>
      </SeksjonsstyringKilde>
    </Bevaringsomrade>
  )
}

/** En side som ikke finnes. */
function Ikkefunnet({ onLukk, children }: { onLukk: () => void; children: ReactNode }) {
  return (
    <section className="steg stoffside" aria-labelledby="ukjent-stoff">
      <ToppmenyInnhold spor="handlinger">
        <Lukkeknapp onLukk={onLukk} />
      </ToppmenyInnhold>
      <div className="kort kort--start">
        <h1 id="ukjent-stoff" className="identitet__navn">
          {children}
        </h1>
        <p>Sjekk adressen, eller finn stoffet i menyen.</p>
      </div>
    </section>
  )
}

function Innhold({ stoff: slug, sted, register, katalog, onApneFortolkning, onLukk }: StoffsideProps) {
  const { kanRedigere } = useFaginnholdskilde()
  const favoritter = useFavoritter()
  const registerkilde = useStoffregisterkilde()
  const [modus, setModus] = useBevart<Sidemodus>('modus', 'lese')
  const [sporring, setSporring] = useBevart('sok', '')
  const beholder = useRef<HTMLElement>(null)
  const overskrift = useId()

  const kjent = register.finn(slug)
  const analytter = useMemo(() => analytterForStoff(slug, register, katalog), [slug, register, katalog])
  const primare = useMemo(() => analytter.filter((a) => a.kobling.primar).map((a) => a.analytt), [analytter])
  const seksjoner = useMemo(() => regelseksjoner(slug, register, katalog), [slug, register, katalog])
  const fortolkning = useMemo(() => fortolkningForStoff(slug, register, katalog), [slug, register, katalog])
  const stoffet = useMemo<Pick<Stoff, 'slug' | 'navn'>>(() => ({ slug, navn: kjent?.navn ?? slug }), [slug, kjent])
  const handlinger = useStoffside(stoffet, primare, modus)
  const { side, referansebase, publisert, konflikt, plan } = handlinger
  const modell = useMemo(() => byggSidemodell(side.data), [side.data])
  const navn = side.data.stoff?.navn ?? kjent?.navn ?? ''
  const kategorier = useMemo(() => register.kategorierFor(slug), [register, slug])
  const apneFortolkningFor = useCallback(
    (analytt: Laboratorieanalytt) => onApneFortolkning(analytt.fortolkning),
    [onApneFortolkning],
  )
  // Et stoff finnes når registeret har det, eller databasen har en side med nøkkelen.
  const finnes = Boolean(kjent || side.data.stoff)
  // Knappene for å endre vises først når utkastet er hentet, så ingenting
  // lagres mot det publiserte som sto før redigeringen ble slått på.
  const redigerer = handlinger.kanEndres

  useEffect(() => {
    if (!navn) return
    const forrige = document.title
    document.title = `${navn} – OUSFAR`
    return () => {
      document.title = forrige
    }
  }, [navn])

  const koblet = useMemo(() => finnKobling(modell).kobling.virkestoff.map((v) => v.fest_id), [modell])
  const legemidler = useLegemidler(koblet)
  const interaksjoner = useInteraksjoner(legemidler, koblet)
  const kjemikalier = useMemo(() => kobledeKjemikalier(modell), [modell])
  const farmakogenetikk = useFarmakogenetikk(kjemikalier)
  const pgx = farmakogenetikk.tilstand
  const cpic = useCpic(kjemikalier)
  const cpictilstand = cpic.tilstand
  const bivirkninger = useBivirkninger(slug).tilstand
  // Visningen av bivirkningene styrer også hvilke kort søket på siden peker på.
  const [bivirkningsvisning, setBivirkningsvisning] = useBevart<Visning>('bivirkningsvisning', 'frekvens')
  // Redaksjonelle og automatiske referanser (FEST, ClinPGx, CPIC og preparatomtalene) nummereres sammen.
  const univers = useMemo(
    () =>
      referanseunivers(
        modell,
        slaSammenAutomatiske(
          festreferanser(
            legemidler.status === 'klar' ? legemidler.utvalg : null,
            interaksjoner.status === 'klar' ? interaksjoner.oversikt : null,
          ),
          // CPIC står over ClinPGx i «Farmakogenetikk», og elementene nummereres i denne rekkefølgen.
          cpicreferanser(
            cpictilstand.status === 'klar' ? cpictilstand.visning : null,
            clinpgxlitteratur(pgx.status === 'klar' ? pgx.visning : null),
          ),
          clinpgxreferanser(pgx.status === 'klar' ? pgx.utvalg : null, pgx.status === 'klar' ? pgx.visning : null),
          bivirkningsreferanser(bivirkninger.status === 'klar' ? bivirkninger.utvalg : null),
        ),
      ),
    [modell, legemidler, interaksjoner, pgx, cpictilstand, bivirkninger],
  )
  const grunnlag = useMemo(
    () => koblingsgrunnlag(legemidler.status === 'klar' ? legemidler.utvalg : null, koblet),
    [legemidler, koblet],
  )

  const dokumenter = useMemo(
    () =>
      indekserSide(
        stoffidentitet({ slug, navn, aliaser: kjent?.aliaser ?? [] }, analytter),
        modell,
        [
          ...preparatsoketekster(legemidler),
          ...interaksjonssoketekster(interaksjoner),
          ...farmakogenetikksoketekster(pgx, cpictilstand),
          ...bivirkningssoketekster(bivirkninger, bivirkningsvisning),
        ],
      ),
    [slug, navn, kjent, analytter, modell, legemidler, interaksjoner, pgx, cpictilstand, bivirkninger, bivirkningsvisning],
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
  // Etter en publisering skal fortolkningen bruke de nye reglene.
  const { provIgjen: hentScenarioreglerPaNytt } = useScenarioreglerkilde()
  const harInnhold = modell.paneler.size > 0 || Object.keys(modell.panelreferanser).length > 0 || harBivirkninger(bivirkninger)

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
  // En lenke til en gruppe bivirkninger viser den visningen gruppen står i.
  const lenketVisning = sted?.[0] === BIVIRKNINGSPANEL ? visningForKort(sted[1]) : null
  useEffect(() => {
    if (lenketVisning) setBivirkningsvisning(lenketVisning)
  }, [stedsnokkel, lenketVisning, setBivirkningsvisning])

  if (side.status === 'klar' && !finnes) {
    return <Ikkefunnet onLukk={onLukk}>Fant ingen fagside for «{slug}»</Ikkefunnet>
  }
  // Papirkurven ser bare administratorene.
  if (register.status(slug) === 'papirkurv' && !registerkilde?.admin) {
    return <Ikkefunnet onLukk={onLukk}>Fagsiden er slettet</Ikkefunnet>
  }

  return (
    <section ref={beholder} className="stoffside" aria-labelledby={overskrift} data-modus={modus}>
      {/* Sidens handlinger står i toppmenyen (i dokken på smale flater). */}
      <ToppmenyInnhold spor="handlinger">
        {/* Mens siden redigeres, er det redigeringen som står i menyen; veien
            ut er «Avslutt redigering», og Escape lukker siden som før. */}
        {kanRedigere && modus === 'rediger' ? (
          <Redigeringshandlinger
            data={side.data}
            regler={side.regler}
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
            {fortolkning && (
              <Toppmenyknapp ikon="interp" variant="primar" onClick={() => onApneFortolkning(fortolkning)}>
                Åpne fortolkning
              </Toppmenyknapp>
            )}
            {favoritter && finnes && (
              <Favorittknapp stoff={slug} favoritt={favoritter.erFavoritt(slug)} onSett={favoritter.sett} />
            )}
            {kanRedigere && (
              <Ikonknapp ikon="edit" etikett="Rediger" aria-pressed="false" onClick={() => setModus('rediger')} />
            )}
            {finnes && <Fagsidemeny slug={slug} />}
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

      <Fagsidebanner slug={slug} />
      {modus === 'rediger' && redigerer && !side.data.infoside && (
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
            <div className="stoffside__paneler" aria-busy={side.status === 'laster'}>
              {PANELER.map((definisjon) => {
                switch (definisjon.form) {
                  case 'identitet':
                    return (
                      <Identitetspanel
                        key={definisjon.nokkel}
                        definisjon={definisjon}
                        navn={navn}
                        slug={slug}
                        analytter={analytter}
                        register={register}
                        kategorier={kategorier}
                        overskriftId={overskrift}
                        onApneFortolkning={apneFortolkningFor}
                        kontekst={kontekst}
                      />
                    )
                  case 'legemidler':
                    return (
                      <Preparatpanel
                        key={definisjon.nokkel}
                        definisjon={definisjon}
                        kontekst={kontekst}
                        sidenavn={navn}
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
                    return <ViktigeData key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} analytter={primare} />
                  case 'tekst':
                    return <Tekstpanel key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} />
                  case 'kort':
                    return definisjon.nokkel === FARMAKOGENETIKKPANEL ? (
                      <Farmakogenetikkpanel
                        key={definisjon.nokkel}
                        definisjon={definisjon}
                        kontekst={kontekst}
                        tilstand={pgx}
                        cpic={cpictilstand}
                        grunnlag={grunnlag}
                        sidenavn={navn}
                        sted={sted}
                        onHentet={farmakogenetikk.lesPaNytt}
                        onCpicHentet={cpic.lesPaNytt}
                      />
                    ) : definisjon.nokkel === BIVIRKNINGSPANEL ? (
                      <Bivirkningspanel
                        key={definisjon.nokkel}
                        definisjon={definisjon}
                        kontekst={kontekst}
                        tilstand={bivirkninger}
                        visning={bivirkningsvisning}
                        onVelgVisning={setBivirkningsvisning}
                      />
                    ) : (
                      <Kortpanel key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} />
                    )
                  case 'mekanismer':
                    return <Mekanismepanel key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} />
                  case 'tabell':
                    return <Tabellpanel key={definisjon.nokkel} definisjon={definisjon} kontekst={kontekst} />
                }
              })}

              {!redigerer && side.status === 'klar' && !harInnhold && (
                <p className="stoffside__tom">Denne siden har ikke fått faginnhold ennå.</p>
              )}
              {seksjoner.map((seksjon) => (
                <Regelseksjonsvisning
                  key={seksjon.seksjon}
                  seksjon={seksjon}
                  tittel={seksjoner.length > 1 ? `Fortolkningsregler – ${seksjon.fortolkning.visningsnavn}` : undefined}
                  slug={slug}
                  register={register}
                  katalog={katalog}
                  regler={side.regler}
                  publisert={publisert}
                  redigerer={redigerer}
                  handlinger={handlinger}
                />
              ))}
              <Referanseliste />
            </div>
          </Redigeringskilde>
        </Sidereferanser>
      </Uthevingskilde>
    </section>
  )
}

/**
 * Fortolkningsreglene for én modul på stoffsiden: scenarioreglene når modulen
 * fortolkes med dem, THC-syrereglene for IRCAK, og intervallreglene for hver
 * analytt som har et regelsett. Reglene er lest etter analyttkoden og modulen,
 * aldri gjennom stoffet.
 */
function Regelseksjonsvisning({
  seksjon,
  tittel,
  slug,
  register,
  katalog,
  regler,
  publisert,
  redigerer,
  handlinger,
}: {
  seksjon: Regelseksjon
  /** Tittelen når siden har regler for flere moduler. */
  tittel: string | undefined
  slug: string
  register: Stoffregister
  katalog: Analyttkatalog
  /** Reglene i tilstanden siden viser. */
  regler: Regeldata
  publisert: Regeldata
  redigerer: boolean
  handlinger: Stoffsidehandlinger
}) {
  const { fortolkning, analytter } = seksjon
  const modul = rusModulFor(fortolkning)
  // Scenarioreglene: i redigeringen utkastet, ellers de publiserte appen alt har.
  const utkast = modul ? regler.scenarioregelsett[modul.id] : undefined
  const { lagreScenarioregelsett, hentScenarioregelsettutkast } = handlinger
  const scenarioredigering = useMemo(
    () =>
      redigerer && utkast && modul
        ? {
            utgave: utkast,
            publisert: publisert.scenarioregelsett[modul.id] ?? null,
            onLagre: (u: Parameters<typeof lagreScenarioregelsett>[1], g?: Parameters<typeof lagreScenarioregelsett>[2]) =>
              lagreScenarioregelsett(modul.id, u, g),
            hentNyeste: () => hentScenarioregelsettutkast(modul.id),
          }
        : null,
    [redigerer, utkast, modul, publisert.scenarioregelsett, lagreScenarioregelsett, hentScenarioregelsettutkast],
  )
  const scenarioregler = useScenarioreglerFor(fortolkning, scenarioredigering)
  // De andre stoffene med analytter i samme modul deler reglene og kommentarene.
  const delesMed = useMemo(() => {
    const sider = new Map<string, Delingsside>()
    for (const analytt of katalog.oppforinger) {
      if (analytt.fortolkning !== fortolkning) continue
      const stoff = register.primartStoffFor(analytt.kode)
      if (stoff && stoff.slug !== slug) sider.set(stoff.slug, { navn: stoff.navn, slug: stoff.slug })
    }
    return [...sider.values()]
  }, [katalog, register, fortolkning, slug])
  const thc = analytter.some((a) => a.kode === THC_KODE) ? regler.thcregelsett : null

  return (
    <>
      {scenarioregler && (
        <Scenarioregler
          {...scenarioregler}
          delesMed={delesMed}
          seksjonsid={seksjon.seksjon}
          {...(tittel && { tittel })}
        />
      )}
      {thc && (
        <Thcregler
          utgave={thc}
          redigerer={redigerer}
          onLagre={handlinger.lagreThcRegelsett}
          seksjonsid={seksjon.seksjon}
          {...(tittel && { tittel })}
        />
      )}
      {analytter.map((analytt) => (
        <Fortolkningsregler
          key={analytt.kode}
          utgave={regler.regelsett[analytt.kode] ?? null}
          publisert={publisert.regelsett[analytt.kode] ?? null}
          redigerer={redigerer}
          onLagre={(innhold, grunnlag) => handlinger.lagreRegelsett(analytt.kode, innhold, grunnlag)}
          hentNyeste={() => handlinger.hentRegelsettutkast(analytt.kode)}
          seksjonsid={seksjon.seksjon}
          {...(tittel && { tittel })}
        />
      ))}
    </>
  )
}

