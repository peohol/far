import { useEffect, useId, useMemo } from 'react'
import { analytterForFortolkning } from '../../domain/koblinger'
import type { Analyttkatalog, Laboratorieanalytt } from '../../domain/analyttkatalog'
import { rusModulFor } from '../../domain/rus'
import { fortolkningssidenavn } from '../../diskusjoner/modell'
import { useLukkMedEscape } from '../../hooks/useLukkMedEscape'
import type { Analyte } from '../../types'
import { Button } from '../Button'
import { ToppmenyInnhold } from '../toppmeny/Toppmenykilde'
import { SeksjonsstyringKilde, useAdressested } from '../seksjoner/Seksjonsstyring'
import { Redigeringskilde, type Redigeringsverdi } from '../stoffside/Redigeringskontekst'
import { Redigeringshandlinger } from '../stoffside/Redigeringslinje'
import { Fortolkningsregler, FORTOLKNING } from './Fortolkningsregler'
import { Scenarioregler, useScenarioreglerFor } from './Scenarioregler'
import { Thcregler } from './Thcregler'
import { harRegler, useFortolkningsredigering, type Fortolkningsredigering as Redigering } from './useFortolkningsredigering'

export interface FortolkningsredigeringProps {
  /** Fortolkningsmodulen som redigeres: oppføringen søket i fortolkningen gir. */
  fortolkning: Analyte
  /** Delen av reglene, og eventuelt detaljkortet i den, adressen peker på. */
  sted?: readonly string[]
  /** Laboratorieanalyttene, så reglene for hver kode i modulen kan leses. */
  katalog: Analyttkatalog
  /** Etter en publisering, så fortolkningen henter de nye reglene. */
  onPublisert: () => void
  /** Tilbake til fortolkningen. */
  onAvslutt: () => void
}

const KAN_IKKE_LEGGE_INN_REFERANSER = () => Promise.reject(new Error('Fortolkningsreglene har ingen referanser.'))

/** Én del av reglene: scenarioreglene, THC-syrereglene eller intervallreglene for én kode. */
type Regeldel = { slag: 'scenario' } | { slag: 'thc' } | { slag: 'intervall'; analytt: Laboratorieanalytt }

/**
 * Redigeringen av reglene og kommentarene en fortolkning gir, for
 * administratorer: en egen side over fortolkningen (`#/fortolkning/<nøkkel>/rediger`),
 * åpnet med «Rediger» der.
 *
 * Siden viser utkastet til hver del av reglene modulen har — scenarioreglene,
 * THC-syrereglene og konsentrasjonsreglene for hver kode — som en seksjon med
 * reglene og kommentarene slik de står, og en knapp for å redigere akkurat
 * den delen. Alt lagres som utkast; toppmenyen sier hva som ikke er publisert,
 * publiserer det og går tilbake til fortolkningen, som på fagsidene.
 *
 * Delene er seksjoner på samme side, så bare én av dem står åpen om gangen, og
 * en adresse som `#/fortolkning/diaz-dmi-oxa/rediger/fortolkning-dmi` åpner
 * den ene.
 *
 * `Escape` går tilbake til fortolkningen, men ikke fra et felt eller et åpent
 * redigeringsskjema.
 */
export function Fortolkningsredigering(props: FortolkningsredigeringProps) {
  return (
    <SeksjonsstyringKilde>
      <Innhold {...props} />
    </SeksjonsstyringKilde>
  )
}

function Innhold({ fortolkning, sted, katalog, onPublisert, onAvslutt }: FortolkningsredigeringProps) {
  useLukkMedEscape(onAvslutt)
  const pekerPaaSted = useAdressested(sted)
  const overskrift = useId()
  const analytter = useMemo(() => analytterForFortolkning(fortolkning, katalog), [fortolkning, katalog])
  const redigering = useFortolkningsredigering(analytter)
  const { tilstand, publisert, konflikt, plan, kanEndres } = redigering
  const { regler } = tilstand
  const modul = rusModulFor(fortolkning)
  const navn = fortolkningssidenavn(fortolkning)

  useEffect(() => {
    const forrige = document.title
    document.title = `Rediger: ${navn} – OUSFAR`
    return () => {
      document.title = forrige
    }
  }, [navn])

  // Siden begynner øverst, med fokus på overskriften — eller på stedet adressen peker på.
  useEffect(() => {
    if (!pekerPaaSted) window.scrollTo({ top: 0 })
    document.getElementById(overskrift)?.focus({ preventScroll: true })
  }, [overskrift, pekerPaaSted])

  const redigeringsverdi = useMemo<Redigeringsverdi>(
    () => ({
      redigerer: true,
      referansebase: [],
      opprettReferanse: KAN_IKKE_LEGGE_INN_REFERANSER,
      gjenopprett: redigering.gjenopprett,
    }),
    [redigering.gjenopprett],
  )

  const deler = useMemo<Regeldel[]>(
    () => [
      ...(modul && regler.scenarioregelsett[modul.id] ? [{ slag: 'scenario' as const }] : []),
      ...(regler.thcregelsett ? [{ slag: 'thc' as const }] : []),
      ...analytter.filter((a) => regler.regelsett[a.kode]).map((analytt) => ({ slag: 'intervall' as const, analytt })),
    ],
    [modul, regler, analytter],
  )
  // Én del står åpen med en gang; flere har hver sin tittel og adresse på siden.
  const ene = deler.length === 1

  return (
    <section className="stoffside fortolkningsredigering" aria-labelledby={overskrift}>
      <ToppmenyInnhold spor="handlinger">
        <Redigeringshandlinger
          regler={regler}
          publisert={publisert}
          plan={plan}
          laster={!kanEndres}
          onPubliser={async () => {
            await redigering.publiser()
            onPublisert()
          }}
          onAvslutt={onAvslutt}
        />
      </ToppmenyInnhold>

      <header className="identitet">
        <p className="metalinje">Rediger fortolkningen</p>
        <h1 id={overskrift} className="identitet__navn" tabIndex={-1}>
          {navn}
        </h1>
        <p className="regler__ingress">
          Velg reglene eller kommentarene du vil endre. Endringene lagres som utkast og gjelder i fortolkningen først
          når de er publisert.
        </p>
      </header>

      {konflikt && (
        <div className="sidevarsel" role="alert">
          <p>Noen andre har endret reglene mens du redigerte. Ingenting er skrevet over.</p>
          <Button variant="subtle" onClick={redigering.lastInn}>
            Hent nyeste utgave
          </Button>
        </div>
      )}
      {tilstand.status === 'feil' && (
        <div className="sidevarsel" role="alert">
          <p>Fikk ikke hentet reglene. {tilstand.feil}</p>
          <Button variant="subtle" onClick={redigering.lastInn}>
            Prøv igjen
          </Button>
        </div>
      )}

      <Redigeringskilde verdi={redigeringsverdi}>
        <div className="stoffside__paneler" aria-busy={tilstand.status === 'laster'}>
          {kanEndres &&
            deler.map((del) => (
              <Regeldelvisning
                key={del.slag === 'intervall' ? del.analytt.kode : del.slag}
                del={del}
                fortolkning={fortolkning}
                redigering={redigering}
                ene={ene}
              />
            ))}
          {tilstand.status === 'klar' && !harRegler(regler) && (
            <p className="stoffside__tom">Denne fortolkningen har ingen regler eller kommentarer som kan redigeres her.</p>
          )}
        </div>
      </Redigeringskilde>
    </section>
  )
}

/** Én del av reglene som en seksjon med redigeringen sin. */
function Regeldelvisning({
  del,
  fortolkning,
  redigering,
  ene,
}: {
  del: Regeldel
  fortolkning: Analyte
  redigering: Redigering
  /** Delen er den eneste på siden. */
  ene: boolean
}) {
  const { tilstand, publisert } = redigering
  const { regler } = tilstand
  switch (del.slag) {
    case 'scenario':
      return <Scenariodel fortolkning={fortolkning} redigering={redigering} ene={ene} />
    case 'thc':
      return regler.thcregelsett ? (
        <Thcregler
          utgave={regler.thcregelsett}
          redigerer
          onLagre={redigering.lagreThcRegelsett}
          apenFraStart={ene}
          {...(!ene && { seksjonsid: `${FORTOLKNING}-thc`, tittel: 'Fortolkningsregler – THC-syre i urin' })}
        />
      ) : null
    case 'intervall': {
      const { kode } = del.analytt
      return (
        <Fortolkningsregler
          utgave={regler.regelsett[kode] ?? null}
          publisert={publisert.regelsett[kode] ?? null}
          redigerer
          onLagre={(innhold, grunnlag) => redigering.lagreRegelsett(kode, innhold, grunnlag)}
          hentNyeste={() => redigering.hentRegelsettutkast(kode)}
          apenFraStart={ene}
          {...(!ene && { seksjonsid: `${FORTOLKNING}-${kode.toLowerCase()}`, tittel: `Fortolkningsregler – ${kode}` })}
        />
      )
    }
  }
}

/** Scenarioreglene modulen fortolkes med, i utkastet. */
function Scenariodel({ fortolkning, redigering, ene }: { fortolkning: Analyte; redigering: Redigering; ene: boolean }) {
  const modul = rusModulFor(fortolkning)
  const { tilstand, publisert, lagreScenarioregelsett, hentScenarioregelsettutkast } = redigering
  const utkast = modul ? tilstand.regler.scenarioregelsett[modul.id] : undefined
  const kilde = useMemo(
    () =>
      utkast && modul
        ? {
            utgave: utkast,
            publisert: publisert.scenarioregelsett[modul.id] ?? null,
            onLagre: (u: Parameters<typeof lagreScenarioregelsett>[1], g?: Parameters<typeof lagreScenarioregelsett>[2]) =>
              lagreScenarioregelsett(modul.id, u, g),
            hentNyeste: () => hentScenarioregelsettutkast(modul.id),
          }
        : null,
    [utkast, modul, publisert.scenarioregelsett, lagreScenarioregelsett, hentScenarioregelsettutkast],
  )
  const scenarioregler = useScenarioreglerFor(fortolkning, kilde)
  if (!scenarioregler) return null
  return (
    <Scenarioregler
      {...scenarioregler}
      apenFraStart={ene}
      {...(!ene && { seksjonsid: `${FORTOLKNING}-scenarier`, tittel: `Fortolkningsregler – ${scenarioregler.modul.navn}` })}
    />
  )
}
