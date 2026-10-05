import { useId, useMemo, useState, type FormEvent } from 'react'
import { useBevart, type Bevaringsform } from '../../oppdatering/Bevaring'
import { TOM_RUS_INNDATA, type RusInndata, type RusModul } from '../../domain/rus'
import { fraProsent, somProsent, type Scenarioregelsett } from '../../domain/scenario'
import { beskrivForhold, beskrivRegelsett, type Scenariobeskrivelse } from '../../domain/scenariovisning'
import type { Scenarioregelsettutgave } from '../../faginnhold/lesing'
import {
  brukKommentar,
  egenKommentar,
  klargjorScenarioutkast,
  kommentarbrukere,
  kontrollerScenarioutkast,
  lesbarFeil,
  settGrense,
  settGrensenavn,
  settKommentartekst,
  settMelding,
  settNullmelding,
  settTekstliste,
  settVerdihjelp,
  tilScenarioutkast,
  utkastfelter,
  type Scenarioutkast,
  type Tekstliste,
} from '../../regler/scenarioredigering'
import { Button } from '../Button'
import {
  Grensefelt,
  Lagringskonflikt,
  oppramsing,
  Tekstfelt,
  Tekstomrade,
  useRegellagring,
  Valgfelt,
} from './Regelfelter'
import { Koder, provKjor, Scenariovilkar, Simulator } from './Scenariodeler'

export interface ScenarioredigeringProps {
  modul: RusModul
  start: Scenarioutkast
  onLagre: (utkast: Scenarioutkast, grunnlag?: Scenarioregelsettutgave) => Promise<void>
  hentNyeste: () => Promise<Scenarioregelsettutgave | null>
  onAvbryt: () => void
}

/** Grensene i feltene, tatt vare på som par når appen oppdateres. */
const TEKSTKART: Bevaringsform<Map<string, string>> = {
  lagre: (kart) => [...kart],
  les: (lagret) =>
    Array.isArray(lagret) && lagret.every((par) => Array.isArray(par) && par.every((del) => typeof del === 'string'))
      ? new Map(lagret as [string, string][])
      : undefined,
}

/** En endring i regelsettet, slik skjemaet gjør dem. */
type Endring = (regelsett: Scenarioregelsett) => Scenarioregelsett

/** Tekstene i en valgliste: begynnelsen av teksten er nok til å kjenne den igjen. */
function forkort(tekst: string): string {
  return tekst.length > 70 ? `${tekst.slice(0, 70).trimEnd()} …` : tekst
}

/**
 * Redigeringen av scenarioreglene for en modul, i stedet for scenariolista
 * mens den pågår.
 *
 * Det som kan endres, er det en fagperson skriver og justerer: grensene,
 * hjelpeteksten og meldingene, og i hvert scenario tekstene — kommentarene,
 * notisene og den manuelle vurderingen. Hva som er påvist og vilkårene i
 * scenariene står fast (`docs/scenarioregler.md`).
 *
 * Kommentarene redigeres der de brukes; brukes samme tekst flere steder,
 * sies det, og plasseringen kan få sin egen tekst eller bruke en annen.
 * Simulatoren under prøver utkastet slik det står i skjemaet. Før noe lagres,
 * kontrolleres utkastet slik databasen gjør det: hver kombinasjon av påviste
 * analytter og forholdstall skal gi nøyaktig ett scenario.
 *
 * Regelsettet og de nye og endrede kommentarene lagres som utkast på én gang.
 * Har noen andre lagret i mellomtiden, står det brukeren har gjort, og hen kan
 * sammenligne med det de lagret før hen velger.
 */
export function Scenarioredigering({ modul, start, onLagre, hentNyeste, onAvbryt }: ScenarioredigeringProps) {
  const [utkast, setUtkast] = useBevart('utkast', start)
  /** Grensene i prosent slik de står i feltene, også mens et tall skrives. */
  const [grenser, setGrenser] = useBevart(
    'grenser',
    () => new Map(start.regelsett.parametere.map((p) => [p.nokkel, somProsent(p.verdi)])),
    TEKSTKART,
  )
  const [kontrollfeil, setKontrollfeil] = useState<string[]>([])
  const [inndata, setInndata] = useState<RusInndata>(TOM_RUS_INNDATA)
  const lagring = useRegellagring(onLagre, hentNyeste)
  const tittel = useId()

  const { regelsett, tekster } = utkast
  const beskrivelse = useMemo(() => beskrivRegelsett(regelsett, tekster), [regelsett, tekster])
  const numre = useMemo(
    () => new Map(beskrivelse.scenarier.map((b, i) => [b.scenario.nokkel, i + 1])),
    [beskrivelse],
  )
  const tekstnummer = useMemo(() => new Map(beskrivelse.tekster.map((t, i) => [t.id, i + 1])), [beskrivelse])
  const treff = useMemo(() => provKjor(regelsett, tekster, inndata), [regelsett, tekster, inndata])

  const endre = (endring: Endring) => setUtkast((u) => ({ ...u, regelsett: endring(u.regelsett) }))
  const endreGrense = (nokkel: string, tekst: string) => {
    setGrenser((g) => new Map(g).set(nokkel, tekst))
    const andel = fraProsent(tekst)
    if (andel !== null) endre((r) => settGrense(r, nokkel, andel))
  }

  /** Grensene kan vises i tekstene med `{nøkkel}`; det sies der det kan brukes. */
  const flettehjelp =
    regelsett.parametere.length > 0
      ? `Skriv ${oppramsing(regelsett.parametere.map((p) => `{${p.nokkel}}`))} for å vise grensen.`
      : undefined

  const lagre = async (grunnlag?: Scenarioregelsettutgave) => {
    if (regelsett.parametere.some((p) => fraProsent(grenser.get(p.nokkel) ?? '') === null)) {
      setKontrollfeil(['Alle grensene må være tall.'])
      return
    }
    const klar = klargjorScenarioutkast(utkast)
    const feil = kontrollerScenarioutkast(klar, (id) => `Tekst ${tekstnummer.get(id) ?? '?'}`).map((f) =>
      lesbarFeil(f, klar.regelsett, numre),
    )
    setKontrollfeil(feil)
    if (feil.length === 0) await lagring.lagre(klar, grunnlag)
  }

  return (
    <form
      className="redigering regelredigering"
      aria-labelledby={tittel}
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        void lagre()
      }}
      noValidate
    >
      <p id={tittel} className="redigering__tittel">
        Rediger: Fortolkningsreglene for {modul.navn}
      </p>

      {regelsett.parametere.length > 0 && (
        <fieldset className="regelredigering__gruppe">
          <legend>Grenser</legend>
          {regelsett.parametere.map((p) => (
            <div key={p.nokkel} className="regelredigering__valg regelredigering__grensepar">
              <Tekstfelt merke="Navn på grensen" verdi={p.navn} onEndre={(navn) => endre((r) => settGrensenavn(r, p.nokkel, navn))} />
              <div className="regelredigering__grenseverdi">
                <Grensefelt
                merke={`${p.navn || 'Grensen'} i prosent`}
                hjelp={`Vises i tekstene med {${p.nokkel}}. Skriv for eksempel 10 eller 12,5.`}
                verdi={grenser.get(p.nokkel) ?? ''}
                onEndre={(t) => endreGrense(p.nokkel, t)}
                />
              </div>
            </div>
          ))}
        </fieldset>
      )}

      {regelsett.forhold.length > 0 && (
        <fieldset className="regelredigering__gruppe">
          <legend>Konsentrasjonene</legend>
          <Tekstomrade
            merke="Hvorfor konsentrasjonene trengs (kan stå tom)"
            verdi={regelsett.verdihjelp}
            hjelp={flettehjelp}
            onEndre={(t) => endre((r) => settVerdihjelp(r, t))}
          />
          {regelsett.forhold.map((f) => (
            <Tekstomrade
              key={f.nokkel}
              merke={`Melding når ${beskrivForhold(f)} ikke kan regnes ut`}
              verdi={f.nullmelding}
              hjelp={flettehjelp}
              onEndre={(t) => endre((r) => settNullmelding(r, f.nokkel, t))}
            />
          ))}
        </fieldset>
      )}

      <ol className="regelredigering__intervaller">
        {beskrivelse.scenarier.map((b, i) => (
          <Scenarioskjema
            key={b.scenario.nokkel}
            nummer={i + 1}
            beskrivelse={b}
            utkast={utkast}
            numre={numre}
            tekstnummer={tekstnummer}
            flettehjelp={flettehjelp}
            truffet={treff?.scenario === b.scenario}
            onEndre={endre}
            onUtkast={setUtkast}
          />
        ))}
      </ol>

      {regelsett.scenarier.length > 1 && (
        <Simulator
          modul={modul}
          regelsett={regelsett}
          beskrivelse={beskrivelse.scenarier}
          inndata={inndata}
          treff={treff}
          onEndre={setInndata}
          tittel="Prøv utkastet"
        />
      )}

      {kontrollfeil.length > 0 && (
        <div className="skjemafeil" role="alert">
          <p>Utkastet er ikke lagret:</p>
          <ul>
            {kontrollfeil.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {lagring.feil && (
        <p className="skjemafeil" role="alert">
          {lagring.feil}
        </p>
      )}
      {lagring.konflikt && (
        <Lagringskonflikt
          nyeste={lagring.konflikt.nyeste}
          sammenlign={(nyeste) => ({
            revisjon: nyeste.regelsett.revisjon,
            deres: utkastfelter(tilScenarioutkast(nyeste)),
            mine: utkastfelter(utkast),
          })}
          onSammenlign={lagring.sammenlign}
          onLagreLikevel={(grunnlag) => void lagre(grunnlag)}
          onForkast={onAvbryt}
          lagrer={lagring.lagrer}
        />
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onAvbryt}>
          Avbryt
        </Button>
        <Button type="submit" className="knapp--kompakt" disabled={lagring.lagrer || lagring.konflikt !== null}>
          {lagring.lagrer ? 'Lagrer …' : 'Lagre utkast'}
        </Button>
      </div>
    </form>
  )
}

/* --- Ett scenario ------------------------------------------------------------ */

function Scenarioskjema({
  nummer,
  beskrivelse,
  utkast,
  numre,
  tekstnummer,
  flettehjelp,
  truffet,
  onEndre,
  onUtkast,
}: {
  nummer: number
  beskrivelse: Scenariobeskrivelse
  utkast: Scenarioutkast
  numre: ReadonlyMap<string, number>
  tekstnummer: ReadonlyMap<string, number>
  flettehjelp: string | undefined
  truffet: boolean
  onEndre: (endring: Endring) => void
  onUtkast: (endring: (u: Scenarioutkast) => Scenarioutkast) => void
}) {
  const { scenario } = beskrivelse
  const { utfall } = scenario
  const nokkel = scenario.nokkel
  const liste = (hvilken: Tekstliste) => (tekster: string[]) => onEndre((r) => settTekstliste(r, nokkel, hvilken, tekster))

  return (
    <li className="regelredigering__plass">
      <fieldset
        className={truffet ? 'regelredigering__intervall scenario--truffet' : 'regelredigering__intervall'}
        aria-current={truffet || undefined}
      >
        <legend>Scenario {nummer}</legend>
        <Scenariovilkar beskrivelse={beskrivelse} />
        {utfall.type === 'manuell' ? (
          <>
            <Tekstomrade
              merke="Melding om manuell vurdering"
              verdi={utfall.melding}
              hjelp={flettehjelp}
              onEndre={(t) => onEndre((r) => settMelding(r, nokkel, t))}
            />
            <Tekstlisteredigering
              merke="Veiledning"
              leggTil="Legg til veiledning"
              tekster={utfall.veiledning}
              hjelp={flettehjelp}
              onEndre={liste('veiledning')}
            />
          </>
        ) : (
          <>
            {utfall.plasseringer.map((p) => (
              <Plasseringsskjema
                key={p.merke}
                scenario={nokkel}
                merke={p.merke}
                koder={p.koder}
                kommentar={p.kommentar}
                utkast={utkast}
                numre={numre}
                tekstnummer={tekstnummer}
                onEndre={onEndre}
                onUtkast={onUtkast}
              />
            ))}
            <Tekstlisteredigering
              merke="Notis"
              leggTil="Legg til notis"
              tekster={utfall.notiser}
              hjelp={flettehjelp}
              onEndre={liste('notiser')}
            />
          </>
        )}
      </fieldset>
    </li>
  )
}

/** Én kommentar i utfallet: hvilken tekst den bruker, og teksten. */
function Plasseringsskjema({
  scenario,
  merke,
  koder,
  kommentar,
  utkast,
  numre,
  tekstnummer,
  onEndre,
  onUtkast,
}: {
  scenario: string
  merke: string
  koder: string[]
  kommentar: string
  utkast: Scenarioutkast
  numre: ReadonlyMap<string, number>
  tekstnummer: ReadonlyMap<string, number>
  onEndre: (endring: Endring) => void
  onUtkast: (endring: (u: Scenarioutkast) => Scenarioutkast) => void
}) {
  const andre = kommentarbrukere(utkast.regelsett, kommentar).filter((b) => b.scenario !== scenario || b.merke !== merke)
  const brukere = [
    ...andre.filter((b) => b.scenario === scenario).map((b) => `«${b.merke}» i samme scenario`),
    ...(andre.some((b) => b.scenario !== scenario) ? [`scenario ${scenarierMed(andre, numre, scenario)}`] : []),
  ]
  // Tekstene regelsettet bruker, nummerert som i visningen og med hvor de
  // brukes, og dem redigeringen har sett, så et valg kan gjøres om.
  const valg = [...utkast.tekster.entries()]
    .map(([id, tekst]) => ({ id, tekst, nummer: tekstnummer.get(id) }))
    .sort((a, b) => (a.nummer ?? Infinity) - (b.nummer ?? Infinity))
    .map(({ id, tekst, nummer }) => {
      const bruk = kommentarbrukere(utkast.regelsett, id)
      return {
        verdi: id,
        tekst: nummer
          ? `Tekst ${nummer} (scenario ${scenarierMed(bruk, numre)}): ${forkort(tekst)}`
          : `Ikke i bruk: ${forkort(tekst)}`,
      }
    })

  return (
    <fieldset className="regelredigering__valg regelredigering__plassering">
      <legend className="felt__merkelapp">
        {merke} · limes inn på <Koder koder={koder} />
      </legend>
      {valg.length > 1 && (
        <Valgfelt
          merke="Bruker teksten"
          verdi={kommentar}
          valg={valg}
          onEndre={(id) => onEndre((r) => brukKommentar(r, scenario, merke, id))}
        />
      )}
      <Tekstomrade
        merke="Kommentartekst"
        verdi={utkast.tekster.get(kommentar) ?? ''}
        hjelp={
          brukere.length > 0
            ? `Samme tekst brukes også i ${oppramsing(brukere)}. Endringen gjelder alle.`
            : undefined
        }
        onEndre={(tekst) => onUtkast((u) => settKommentartekst(u, kommentar, tekst))}
      />
      {brukere.length > 0 && (
        <div className="redigeringsrad">
          <Button variant="subtle" className="redigeringsknapp" onClick={() => onUtkast((u) => egenKommentar(u, scenario, merke))}>
            Gi kommentaren egen tekst
          </Button>
        </div>
      )}
    </fieldset>
  )
}

/** Scenariene i lista som nummer, i rekkefølge og hvert én gang: «1, 4 og 8». */
function scenarierMed(
  bruk: readonly { scenario: string }[],
  numre: ReadonlyMap<string, number>,
  utenom?: string,
): string {
  const tall = [...new Set(bruk.filter((b) => b.scenario !== utenom).map((b) => numre.get(b.scenario) ?? 0))]
  return oppramsing(tall.sort((a, b) => a - b).map(String))
}

/** Notisene eller veiledningen: en tekst per linje, som kan fjernes og legges til. */
function Tekstlisteredigering({
  merke,
  leggTil,
  tekster,
  hjelp,
  onEndre,
}: {
  merke: string
  leggTil: string
  tekster: string[]
  hjelp: string | undefined
  onEndre: (tekster: string[]) => void
}) {
  return (
    <>
      {tekster.map((tekst, i) => {
        const navn = tekster.length > 1 ? `${merke} ${i + 1}` : merke
        return (
          <div key={i} className="regelredigering__valg">
            <Tekstomrade
              merke={navn}
              verdi={tekst}
              hjelp={hjelp}
              onEndre={(t) => onEndre(tekster.map((x, j) => (j === i ? t : x)))}
            />
            <div className="redigeringsrad">
              <Button
                variant="subtle"
                className="redigeringsknapp"
                aria-label={`Fjern ${navn.toLowerCase()}`}
                onClick={() => onEndre(tekster.filter((_, j) => j !== i))}
              >
                Fjern
              </Button>
            </div>
          </div>
        )
      })}
      <div className="redigeringsrad">
        <Button variant="subtle" className="redigeringsknapp" onClick={() => onEndre([...tekster, ''])}>
          {leggTil}
        </Button>
      </div>
    </>
  )
}
