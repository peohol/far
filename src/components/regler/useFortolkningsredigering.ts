import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { regelplan } from '../../faginnhold/stoffside'
import { Samtidighetskonflikt, type Faginnholdslager } from '../../faginnhold/lagring'
import {
  INGEN_REGLER,
  type Regeldata,
  type Regelsettutgave,
  type Scenarioregelsettutgave,
  type Utgave,
} from '../../faginnhold/lesing'
import type { Tilstand } from '../../faginnhold/modell'
import { kommentarendringer, utenKommentarer } from '../../regler/kommentarer'
import type { Intervallregelsett } from '../../regler/modell'
import { scenariokommentarendringer, type Scenarioutkast } from '../../regler/scenarioredigering'
import { RUS_MODULER, rusModulFor, type RusModul } from '../../domain/rus'
import type { Laboratorieanalytt } from '../../domain/analyttkatalog'
import { THC_KODE } from '../../domain/thc'
import { lagreThcUtkast, type ThcRegelsettutgave, type ThcUtkast } from '../../faginnhold/thcregler'
import { useFaginnholdskilde } from '../stoffside/Faginnholdskilde'

export interface Regeltilstand {
  status: 'laster' | 'klar' | 'feil'
  /** Utkastet til reglene og kommentarene for analyttene. */
  regler: Regeldata
  feil: string | null
}

const IKKE_KLAR = 'Utkastet er ikke hentet ennå. Vent litt og prøv igjen.'

/** Scenariomodulene analyttene fortolkes i, hver én gang. */
function scenariomoduler(analytter: readonly Laboratorieanalytt[]): RusModul[] {
  const moduler = new Map<string, RusModul>()
  for (const { fortolkning } of analytter) {
    const modul = rusModulFor(fortolkning)
    if (modul) moduler.set(modul.id, modul)
  }
  return [...moduler.values()]
}

function modulMedId(id: string): RusModul | undefined {
  return RUS_MODULER.find((m) => m.id === id)
}

/** Sant når fortolkningen har regler å redigere: noe regelsett eller noen kommentar. */
export function harRegler(regler: Regeldata): boolean {
  return (
    Object.keys(regler.regelsett).length > 0 ||
    Object.keys(regler.scenarioregelsett).length > 0 ||
    regler.thcregelsett !== null
  )
}

/**
 * Redigeringen av fortolkningsreglene for analyttene i én fortolkningsmodul:
 * utkastet til regelsettene og kommentarene de peker på, det publiserte å
 * sammenligne med, og endringene som kan gjøres på dem.
 *
 * Alt lagres som utkast mot revisjonen brukeren så, og ingenting blir synlig
 * for andre før det publiseres. Reglene leses etter analyttkoden og modulen:
 * intervallreglene for hver kode, scenarioreglene for modulen når den
 * fortolkes med dem, og THC-syrereglene når en av kodene er THC-syre.
 */
export function useFortolkningsredigering(analytter: readonly Laboratorieanalytt[]) {
  const { leser, lager } = useFaginnholdskilde()
  // Kodene og modulene som tekst, så en ny liste med de samme ikke leser alt på nytt.
  const kodeliste = analytter.map((a) => a.kode).join(' ')
  const koder = useMemo(() => (kodeliste ? kodeliste.split(' ') : []), [kodeliste])
  const modulliste = scenariomoduler(analytter)
    .map((m) => m.id)
    .join(' ')
  const moduler = useMemo(() => (modulliste ? modulliste.split(' ') : []), [modulliste])
  const [tilstand, setTilstand] = useState<Regeltilstand>({ status: 'laster', regler: INGEN_REGLER, feil: null })
  const [publisert, setPublisert] = useState<Regeldata>(INGEN_REGLER)
  const [konflikt, setKonflikt] = useState(false)
  const [runde, setRunde] = useState(0)
  /** Utkastet slik det sist ble lest, for endringene som trenger revisjonene. `null` til det er lest. */
  const siste = useRef<Regeldata | null>(null)

  /** Reglene for analyttene i én tilstand. */
  const lesRegler = useCallback(
    async (t: Tilstand): Promise<Regeldata> => {
      const [intervall, thcregelsett, scenario] = await Promise.all([
        Promise.all(koder.map(async (kode) => [kode, await leser.finnIntervallregelsett(kode, t)] as const)),
        koder.includes(THC_KODE) ? leser.lesThcRegelsett(t) : null,
        Promise.all(moduler.map(async (id) => [id, await leser.finnScenarioregelsett(id, t)] as const)),
      ])
      const utfylt = <T,>(par: readonly (readonly [string, T | null])[]) =>
        Object.fromEntries(par.filter((p): p is readonly [string, T] => p[1] !== null))
      return { regelsett: utfylt(intervall), thcregelsett, scenarioregelsett: utfylt(scenario) }
    },
    [leser, koder, moduler],
  )

  useEffect(() => {
    let gjelder = true
    setTilstand((forrige) => ({ ...forrige, status: 'laster' }))
    lesRegler('utkast')
      .then((regler) => {
        if (!gjelder) return
        siste.current = regler
        setTilstand({ status: 'klar', regler, feil: null })
      })
      .catch((e: Error) => {
        if (!gjelder) return
        siste.current = null
        setTilstand({ status: 'feil', regler: INGEN_REGLER, feil: e.message })
      })
    // Det publiserte trengs bare for å si hva som endres.
    lesRegler('publisert')
      .then((regler) => {
        if (gjelder) setPublisert(regler)
      })
      .catch(() => {
        if (gjelder) setPublisert(INGEN_REGLER)
      })
    return () => {
      gjelder = false
    }
  }, [lesRegler, runde])

  const lastInn = useCallback(() => {
    setKonflikt(false)
    setRunde((r) => r + 1)
  }, [])

  /** Kjører en endring, leser reglene på nytt, og sier fra om en konflikt. */
  const endre = useCallback(async <T,>(arbeid: () => Promise<T>): Promise<T> => {
    try {
      const svar = await arbeid()
      setRunde((r) => r + 1)
      return svar
    } catch (e) {
      if (e instanceof Samtidighetskonflikt) setKonflikt(true)
      throw e
    }
  }, [])

  /** Utkastet slik det sist ble lest. Endringene lagres alltid mot revisjonene i det. */
  const utkastet = useCallback((): Regeldata => {
    if (!siste.current) throw new Error(IKKE_KLAR)
    return siste.current
  }, [])

  /**
   * Lagrer regelsettet for koden og de nye og endrede kommentarene som utkast,
   * på én gang, mot revisjonene brukeren åpnet — eller mot `grunnlag` når
   * brukeren har sett en nyere utgave og velger å lagre over den. En konflikt
   * kastes videre til redigeringen, som lar brukeren sammenligne før noe
   * lagres.
   */
  const lagreRegelsett = useCallback(
    async (kode: string, innhold: Intervallregelsett, grunnlag?: Regelsettutgave) => {
      const apnet = utkastet().regelsett[kode]
      if (!apnet) throw new Error(IKKE_KLAR)
      const mot = grunnlag ?? apnet
      await lager.lagreIntervallregelsett(
        mot.regelsett.id,
        mot.regelsett.revisjon,
        utenKommentarer(innhold),
        kommentarendringer(innhold, mot.kommentarer, apnet.kommentarer),
      )
      setRunde((r) => r + 1)
    },
    [lager, utkastet],
  )

  /**
   * Lagrer THC-syrereglene og -tekstene som utkast: hver kommentar med endret
   * tekst, og regelsettet om reglene er endret, mot revisjonene brukeren
   * åpnet — eller mot `grunnlag` når brukeren har sett en nyere utgave og
   * velger å lagre over den. En konflikt kastes videre til redigeringen, som
   * for de andre regelsettene. Objektene lagres hver for seg; ble noe lagret
   * før konflikten, sier siden i tillegg fra at reglene bør hentes på nytt.
   */
  const lagreThcRegelsett = useCallback(
    async (utkast: ThcUtkast, grunnlag?: ThcRegelsettutgave) => {
      const mot = grunnlag ?? utkastet().thcregelsett
      if (!mot) throw new Error(IKKE_KLAR)
      let noeLagret = false
      const tellende: Pick<Faginnholdslager, 'lagreUtkast'> = {
        lagreUtkast: async (objekt, revisjon, innhold) => {
          const status = await lager.lagreUtkast(objekt, revisjon, innhold)
          noeLagret = true
          return status
        },
      }
      try {
        await lagreThcUtkast(tellende, mot, utkast)
      } catch (e) {
        if (noeLagret && e instanceof Samtidighetskonflikt) setKonflikt(true)
        throw e
      }
      setRunde((r) => r + 1)
    },
    [lager, utkastet],
  )

  /** THC-syrereglene slik utkastet står i databasen nå, til sammenligningen ved en konflikt. */
  const hentThcRegelsettutkast = useCallback(() => leser.lesThcRegelsett('utkast'), [leser])

  /** Regelsettet for koden slik utkastet står i databasen nå, til sammenligningen ved en konflikt. */
  const hentRegelsettutkast = useCallback((kode: string) => leser.finnIntervallregelsett(kode, 'utkast'), [leser])

  /**
   * Det samme for scenarioregelsettet til en modul: regelsettet og de nye og
   * endrede kommentarene sammen, mot revisjonene brukeren åpnet eller mot
   * `grunnlag`.
   */
  const lagreScenarioregelsett = useCallback(
    async (modulId: string, utkast: Scenarioutkast, grunnlag?: Scenarioregelsettutgave) => {
      const apnet = utkastet().scenarioregelsett[modulId]
      const modul = modulMedId(modulId)
      if (!apnet || !modul) throw new Error(IKKE_KLAR)
      const mot = grunnlag ?? apnet
      await lager.lagreScenarioregelsett(
        mot.regelsett.id,
        mot.regelsett.revisjon,
        utkast.regelsett,
        scenariokommentarendringer(utkast, modul.navn, mot.kommentarer, apnet.kommentarer),
      )
      setRunde((r) => r + 1)
    },
    [lager, utkastet],
  )

  /** Scenarioregelsettet til modulen slik utkastet står i databasen nå, til sammenligningen ved en konflikt. */
  const hentScenarioregelsettutkast = useCallback(
    (modulId: string) => leser.finnScenarioregelsett(modulId, 'utkast'),
    [leser],
  )

  /** Lager en ny revisjon av objektet med innholdet fra en tidligere. */
  const gjenopprett = useCallback(
    (utgave: Utgave<unknown>, fraRevisjon: number) =>
      endre(async () => {
        utkastet()
        await lager.gjenopprettRevisjon(utgave.id, utgave.revisjon, fraRevisjon)
      }),
    [endre, lager, utkastet],
  )

  const plan = useMemo(() => regelplan(tilstand.regler), [tilstand.regler])

  /**
   * Publiserer reglene og kommentarene som har upubliserte endringer,
   * kommentarene før regelsettet som peker på dem. Stopper ved første feil;
   * det som alt er publisert, står.
   */
  const publiser = useCallback(
    () =>
      endre(async () => {
        for (const steg of regelplan(utkastet())) {
          await lager.publiserUtkast(steg.id, steg.revisjon)
        }
      }),
    [endre, lager, utkastet],
  )

  return {
    tilstand,
    /**
     * Sant når utkastet er lest og kan endres. Mens reglene leses på nytt etter
     * en endring, står det som ble lest sist.
     */
    kanEndres: tilstand.status === 'klar' || (tilstand.status === 'laster' && siste.current !== null),
    publisert,
    konflikt,
    plan,
    lastInn,
    lagreRegelsett,
    hentRegelsettutkast,
    lagreScenarioregelsett,
    hentScenarioregelsettutkast,
    lagreThcRegelsett,
    hentThcRegelsettutkast,
    gjenopprett,
    publiser,
  }
}

export type Fortolkningsredigering = ReturnType<typeof useFortolkningsredigering>
