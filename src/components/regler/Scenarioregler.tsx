import { useCallback, useMemo, useState } from 'react'
import { Bevaringsomrade, useBevart } from '../../oppdatering/Bevaring'
import { rusModulFor, TOM_RUS_INNDATA, type RusInndata, type RusModul } from '../../domain/rus'
import type { Kommentaroppslag } from '../../domain/kommentarobjekt'
import type { Scenarioregelsett } from '../../domain/scenario'
import { beskrivRegelsett, type Scenariobeskrivelse } from '../../domain/scenariovisning'
import { revisjonsnokkel, type Scenarioregelsettutgave } from '../../faginnhold/lesing'
import { antall, ramsOpp } from '../../faginnhold/oppsummering'
import { kommentaroppslag } from '../../regler/kommentarer'
import { scenariofelter, tilScenarioutkast, utkastfelter, type Scenarioutkast } from '../../regler/scenarioredigering'
import { stoffadresse } from '../../domain/rute'
import type { Analyte } from '../../types'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Uthev } from '../Uthev'
import { seksjonsikon } from '../stoffside/panelvisning'
import { Detaljkort, Seksjon } from '../seksjoner/Seksjon'
import { kommentarnavnoppslag, Regelhistorikk, upubliserteFelt } from './Regelhistorikk'
import { Koder, provKjor, Scenariovilkar, Simulator } from './Scenariodeler'
import { Scenarioredigering } from './Scenarioredigering'
import { useScenarioreglerkilde } from './Scenarioreglerkilde'

/** Det redigeringen av scenarioreglene trenger: utkastet, det publiserte og lagringen. */
export interface Scenarioredigeringskilde {
  utgave: Scenarioregelsettutgave
  /** Det publiserte regelsettet, til å si hva som ikke er publisert ennå. */
  publisert: Scenarioregelsettutgave | null
  /**
   * Lagrer utkastet med kommentarene, mot det brukeren åpnet, eller mot
   * `grunnlag` når hen har sett en nyere utgave og valgt å lagre over den.
   */
  onLagre: (utkast: Scenarioutkast, grunnlag?: Scenarioregelsettutgave) => Promise<void>
  /** Utkastet slik det står i databasen nå, med kommentarene. */
  hentNyeste: () => Promise<Scenarioregelsettutgave | null>
}

/**
 * Regelsettet fortolkningsmodulen bruker for denne analytten, med navnene på
 * analyttene og kommentarene regelsettet viser til: det publiserte, eller
 * utkastet når `redigering` er gitt. `null` når modulen ikke fortolkes med
 * scenarioregler, eller reglene ikke er hentet.
 */
export function useScenarioreglerFor(
  fortolkning: Analyte | null,
  redigering: Scenarioredigeringskilde | null = null,
): ScenarioreglerProps | null {
  const { tilstand } = useScenarioreglerkilde()
  return useMemo(() => {
    const modul = fortolkning && rusModulFor(fortolkning)
    if (!modul) return null
    if (redigering) {
      const { utgave } = redigering
      return { modul, regelsett: utgave.regelsett.innhold, kommentarer: kommentaroppslag(utgave.kommentarer), redigering }
    }
    if (tilstand.status !== 'klar') return null
    const utgave = tilstand.regler.regelsett.get(modul.id)
    return utgave ? { modul, regelsett: utgave.innhold, kommentarer: tilstand.regler.kommentarer } : null
  }, [fortolkning, tilstand, redigering])
}

export interface ScenarioreglerProps {
  modul: RusModul
  regelsett: Scenarioregelsett
  /** Kommentarobjektene scenariene peker på. */
  kommentarer: Kommentaroppslag
  /** For administratorer i redigeringsmodus. Da er det utkastet som vises. */
  redigering?: Scenarioredigeringskilde
  /**
   * De andre stoffsidene som viser de samme reglene, fordi kodene deres
   * fortolkes i samme modul: oksazepam på diazepamsiden, morfin på
   * kodeinsiden. Én side per navn, med koden som åpner den.
   */
  delesMed?: readonly Delingsside[]
  /** Egen seksjons-ID når flere fortolkningsmoduler står på samme stoffside. */
  seksjonsid?: string
  /** Egen tittel når det må fremgå hvilken analytt regelsettet gjelder. */
  tittel?: string
}

/** En annen side som deler reglene og kommentarene. */
export interface Delingsside {
  navn: string
  /** Stoffets nøkkel i stoffregisteret. */
  slug: string
}

/**
 * Fortolkningsreglene på stoffsiden, for moduler som fortolkes med
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
 * simulatoren detaljkort i den (`docs/seksjoner.md`). I redigeringsmodus kan
 * administratorer endre grensene og tekstene, se hva som ikke er publisert og
 * åpne historikken — for regelsettet og for hver kommentar.
 */
export function Scenarioregler({
  modul,
  regelsett,
  kommentarer,
  redigering,
  delesMed = [],
  seksjonsid = 'fortolkning',
  tittel = 'Fortolkningsregler',
}: ScenarioreglerProps) {
  const beskrivelse = useMemo(() => beskrivRegelsett(regelsett, kommentarer), [regelsett, kommentarer])
  const [inndata, setInndata] = useState<RusInndata>(TOM_RUS_INNDATA)
  // En redigering som er i gang, overlever en oppdatering av appen.
  const [redigeres, setRedigeres] = useBevart(`scenarioregler:${modul.id}`, false)
  const treff = useMemo(() => provKjor(regelsett, kommentarer, inndata), [regelsett, kommentarer, inndata])
  const simulerbar = regelsett.scenarier.length > 1
  const redigeringsmodus = redigeres && redigering
  const historikkfelter = useCallback(
    (innhold: Scenarioregelsett) => scenariofelter(innhold, kommentarnavnoppslag(redigering?.utgave.kommentarer ?? [])),
    [redigering],
  )

  return (
    <Seksjon
      id={seksjonsid}
      ikon={seksjonsikon('fortolkning')}
      tittel={<Uthev tekst={tittel} />}
      oppsummering={ramsOpp([
        antall(beskrivelse.scenarier.length, 'scenario', 'scenarier'),
        ...beskrivelse.grenser.map((g) => `${g.navn}: ${g.prosent}`),
      ])}
      handlinger={
        redigering &&
        !redigeres && (
          <Button variant="kant" icon={<Ikon navn="edit" />} className="redigeringsknapp" onClick={() => setRedigeres(true)}>
            Rediger reglene
          </Button>
        )
      }
      className="regler"
    >
      {delesMed.length > 0 && <Delingsmerknad sider={delesMed} redigering={Boolean(redigering)} />}
      {redigeringsmodus ? (
        // Utkastet tas vare på mot revisjonene det bygger på, og kommer bare
        // tilbake så lenge ingen andre har lagret i mellomtiden.
        <Bevaringsomrade navn={`scenarioregler:${modul.id}@${revisjonsnokkel(redigering.utgave)}`}>
          <Scenarioredigering
            key={revisjonsnokkel(redigering.utgave)}
            modul={modul}
            start={tilScenarioutkast(redigering.utgave)}
            onLagre={async (utkast, grunnlag) => {
              await redigering.onLagre(utkast, grunnlag)
              setRedigeres(false)
            }}
            hentNyeste={redigering.hentNyeste}
            onAvbryt={() => setRedigeres(false)}
          />
        </Bevaringsomrade>
      ) : (
        <>
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
                  <p className="kommentartekst">
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
        </>
      )}
      {redigering && (
        <Regelhistorikk
          utgave={redigering.utgave.regelsett}
          type="scenarioregelsett"
          felter={historikkfelter}
          upubliserte={upubliserteFelt(
            [redigering.utgave.regelsett, ...redigering.utgave.kommentarer],
            redigering.publisert && utkastfelter(tilScenarioutkast(redigering.publisert)),
            utkastfelter(tilScenarioutkast(redigering.utgave)),
          )}
          kommentarer={redigering.utgave.kommentarer}
        />
      )}
    </Seksjon>
  )
}

/**
 * Sier at reglene og kommentartekstene er de samme på de andre sidene, med
 * lenker dit. De er ett objekt i databasen, så det finnes bare ett sted å
 * redigere dem, uansett hvilken av sidene redaktøren står på.
 */
function Delingsmerknad({ sider, redigering }: { sider: readonly Delingsside[]; redigering: boolean }) {
  return (
    <p className="regler__deling">
      <Uthev tekst="Reglene og kommentartekstene er felles med " />
      {sider.map((s, i) => (
        <span key={s.slug}>
          {i > 0 && (i === sider.length - 1 ? ' og ' : ', ')}
          <a href={stoffadresse(s.slug)}>
            <Uthev tekst={s.navn} />
          </a>
        </span>
      ))}
      <Uthev
        tekst={
          redigering
            ? '. En endring her gjelder også der, og det er de samme tekstene som redigeres fra alle sidene.'
            : '.'
        }
      />
    </p>
  )
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
  const { utfall } = beskrivelse
  return (
    <li className={truffet ? 'scenario scenario--truffet' : 'scenario'} aria-current={truffet || undefined}>
      <p className="scenario__nummer">Scenario {nummer}</p>
      <Scenariovilkar beskrivelse={beskrivelse} />
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
