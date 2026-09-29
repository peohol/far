import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { publiseringsplan, tilReferanse, type Sideelement } from '../../faginnhold/stoffside'
import { Samtidighetskonflikt } from '../../faginnhold/lagring'
import {
  INGEN_REGLER,
  TOM_STOFFSIDE,
  type Regeldata,
  type Regelsettutgave,
  type Scenarioregelsettutgave,
  type Stoffsidedata,
  type Utgave,
} from '../../faginnhold/lesing'
import type { Infosideinnhold, Innholdselementinnhold, Referanseinnhold, Tilstand } from '../../faginnhold/modell'
import { kommentarendringer, utenKommentarer } from '../../regler/kommentarer'
import type { Intervallregelsett } from '../../regler/modell'
import { scenariokommentarendringer, type Scenarioutkast } from '../../regler/scenarioredigering'
import { RUS_MODULER, rusModulFor, type RusModul } from '../../domain/rus'
import { FJERNET, datakortGjelder, erEnkeltelement } from '../../faginnhold/paneler'
import type { Referanse } from '../../faginnhold/referanser'
import type { Laboratorieanalytt } from '../../domain/analyttkatalog'
import type { Stoff } from '../../domain/stoffregister'
import { THC_KODE } from '../../domain/thc'
import type { ThcRegelsett } from '../../domain/thcRegelsett'
import type { ThcTekster } from '../../domain/thcTekster'
import { thcEndringer } from '../../faginnhold/thcregler'
import { useFaginnholdskilde } from './Faginnholdskilde'

export type Sidemodus = 'lese' | 'rediger'

/** Det et innholdselement lagres med, utenom siden det står på. */
export interface Elementendring {
  panel: string
  elementtype: string
  posisjon: number
  data: Record<string, unknown>
  referanser: string[]
}

export interface Sidetilstand {
  status: 'laster' | 'klar' | 'feil'
  /** Monografien: stoffsiden i databasen. */
  data: Stoffsidedata
  /** Fortolkningsreglene for analyttene siden viser, i samme tilstand. */
  regler: Regeldata
  /**
   * Tilstanden `data` er lest fra. Står modusen nettopp byttet, er det den
   * forrige til den nye er hentet.
   */
  tilstand: Tilstand | null
  feil: string | null
}

const IKKE_KLAR = 'Utkastet er ikke hentet ennå. Vent litt og prøv igjen.'
const LAGT_INN_AV_ANDRE = 'Noen andre har lagt inn dette i mellomtiden.'

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

/**
 * En stoffside: monografien i den tilstanden modusen viser, fortolkningsreglene
 * for analyttene stoffet er primært stoff for, og endringene som kan gjøres på
 * dem.
 *
 * Lesemodus viser det publiserte — det alle innloggede ser. Redigeringsmodus
 * viser utkastet, og der lagres alt som utkast mot revisjonen brukeren så.
 * Ingenting blir synlig for andre før det publiseres.
 *
 * Monografien leses etter stoffets nøkkel, og ingenting annet. Reglene hører
 * til fortolkningssystemet og leses for seg etter analyttkoden og modulen
 * (`analytter`, fra koblingene i stoffregisteret). Et stoff i registeret som
 * ikke har noen side i databasen ennå, får den første gang noe lagres på den,
 * med stoffets navn og nøkkel.
 *
 * Scenarioreglene hentes bare til redigeringen: lesemodusen viser reglene appen
 * alt har hentet.
 */
export function useStoffside(stoff: Pick<Stoff, 'slug' | 'navn'>, analytter: readonly Laboratorieanalytt[], modus: Sidemodus) {
  const { leser, lager } = useFaginnholdskilde()
  const tilstand: Tilstand = modus === 'rediger' ? 'utkast' : 'publisert'
  const { slug, navn } = stoff
  // Kodene og modulene som tekst, så en ny liste med de samme ikke leser alt på nytt.
  const kodeliste = analytter.map((a) => a.kode).join(' ')
  const koder = useMemo(() => (kodeliste ? kodeliste.split(' ') : []), [kodeliste])
  const modulliste = scenariomoduler(analytter)
    .map((m) => m.id)
    .join(' ')
  const moduler = useMemo(() => (modulliste ? modulliste.split(' ') : []), [modulliste])
  const [side, setSide] = useState<Sidetilstand>({
    status: 'laster',
    data: TOM_STOFFSIDE,
    regler: INGEN_REGLER,
    tilstand: null,
    feil: null,
  })
  const [referansebase, setReferansebase] = useState<Referanse[]>([])
  const [publisert, setPublisert] = useState<Regeldata>(INGEN_REGLER)
  const [konflikt, setKonflikt] = useState(false)
  const [runde, setRunde] = useState(0)
  /** Det siste som er lest, og fra hvilken tilstand, for endringene som trenger revisjonene. */
  const siste = useRef<Pick<Sidetilstand, 'tilstand' | 'data' | 'regler'>>({
    tilstand: null,
    data: TOM_STOFFSIDE,
    regler: INGEN_REGLER,
  })

  const lesSide = useCallback((t: Tilstand) => leser.lesStoffside(slug, t), [leser, slug])

  /** Reglene for analyttene i én tilstand; scenarioreglene bare når de trengs. */
  const lesRegler = useCallback(
    async (t: Tilstand, medScenarioregler: boolean): Promise<Regeldata> => {
      const [intervall, thcregelsett, scenario] = await Promise.all([
        Promise.all(koder.map(async (kode) => [kode, await leser.finnIntervallregelsett(kode, t)] as const)),
        koder.includes(THC_KODE) ? leser.lesThcRegelsett(t) : null,
        medScenarioregler
          ? Promise.all(moduler.map(async (id) => [id, await leser.finnScenarioregelsett(id, t)] as const))
          : [],
      ])
      const utfylt = <T,>(par: readonly (readonly [string, T | null])[]) =>
        Object.fromEntries(par.filter((p): p is readonly [string, T] => p[1] !== null))
      return { regelsett: utfylt(intervall), thcregelsett, scenarioregelsett: utfylt(scenario) }
    },
    [leser, koder, moduler],
  )

  useEffect(() => {
    let gjelder = true
    setSide((forrige) => ({ ...forrige, status: 'laster' }))
    Promise.all([lesSide(tilstand), lesRegler(tilstand, tilstand === 'utkast')])
      .then(([data, regler]) => {
        if (!gjelder) return
        siste.current = { tilstand, data, regler }
        setSide({ status: 'klar', data, regler, tilstand, feil: null })
      })
      .catch((e: Error) => {
        if (!gjelder) return
        siste.current = { tilstand: null, data: TOM_STOFFSIDE, regler: INGEN_REGLER }
        setSide({ status: 'feil', data: TOM_STOFFSIDE, regler: INGEN_REGLER, tilstand: null, feil: e.message })
      })
    return () => {
      gjelder = false
    }
  }, [lesSide, lesRegler, tilstand, runde])

  // Referansebasen trengs bare for å velge kilder, og de publiserte
  // regelsettene bare for å si hva som endres — altså bare i redigeringen.
  useEffect(() => {
    if (modus !== 'rediger') return
    let gjelder = true
    leser
      .lesReferanser('utkast')
      .then((utgaver) => {
        if (gjelder) setReferansebase(utgaver.map(tilReferanse))
      })
      .catch(() => {
        if (gjelder) setReferansebase([])
      })
    lesRegler('publisert', true)
      .then((regler) => {
        if (gjelder) setPublisert(regler)
      })
      .catch(() => {
        if (gjelder) setPublisert(INGEN_REGLER)
      })
    return () => {
      gjelder = false
    }
  }, [leser, lesRegler, modus, runde])

  const lastInn = useCallback(() => {
    setKonflikt(false)
    setRunde((r) => r + 1)
  }, [])

  /** Kjører en endring, leser siden på nytt, og sier fra om en konflikt. */
  const endre = useCallback(
    async <T,>(arbeid: () => Promise<T>): Promise<T> => {
      try {
        const svar = await arbeid()
        setRunde((r) => r + 1)
        return svar
      } catch (e) {
        if (e instanceof Samtidighetskonflikt) setKonflikt(true)
        throw e
      }
    },
    [],
  )

  /**
   * Utkastet slik det sist ble lest. Endringene lagres alltid mot utkastets
   * revisjoner, aldri mot det publiserte som sto før modusen ble byttet.
   */
  const utkastet = useCallback((): Pick<Sidetilstand, 'data' | 'regler'> => {
    if (siste.current.tilstand !== 'utkast') throw new Error(IKKE_KLAR)
    return siste.current
  }, [])

  /**
   * Stoffsiden i databasen, opprettet med stoffets navn og nøkkel først om den
   * ikke finnes. Gir tilbake utkastet slik det står nå.
   */
  const sikreSide = useCallback(async (): Promise<Utgave<Infosideinnhold>> => {
    const { data } = utkastet()
    if (data.infoside) return data.infoside
    const innhold: Infosideinnhold = { navn, slug }
    const status = await lager.opprettUtkast('infoside', innhold)
    return {
      id: status.id,
      revisjon: status.revisjon ?? 1,
      publisert_revisjon: null,
      innhold,
      endret_av_fornavn: '',
      endret_av_etternavn: '',
      endret_kl: status.endret_kl ?? '',
    }
  }, [lager, navn, slug, utkastet])

  /**
   * Lagrer et element, eller oppretter det. Et kort som bare kan finnes én
   * gang på siden, er vernet i databasen; har noen andre lagt det inn i
   * mellomtiden, blir det en konflikt som ellers, ikke et kort nummer to.
   */
  const lagreElement = useCallback(
    (element: Sideelement | null, endring: Elementendring) =>
      endre(async () => {
        const side = await sikreSide()
        const innhold: Innholdselementinnhold = { infoside: side.id, ...endring }
        if (element) {
          await lager.lagreUtkast(element.id, element.utgave.revisjon, innhold)
          return
        }
        try {
          await lager.opprettUtkast('innholdselement', innhold)
        } catch (feil) {
          if (!erEnkeltelement(endring.elementtype)) throw feil
          const na = await lesSide('utkast')
          const finnes = na.elementer.some(
            (e) =>
              e.innhold.panel === endring.panel &&
              e.innhold.elementtype === endring.elementtype &&
              datakortGjelder(e.innhold.data) === datakortGjelder(endring.data),
          )
          if (!finnes) throw feil
          throw Object.assign(new Samtidighetskonflikt(null, null), { message: LAGT_INN_AV_ANDRE })
        }
      }),
    [endre, sikreSide, lager, lesSide],
  )

  /** Tar kortet bort fra siden. Det slettes ikke; se `FJERNET`. */
  const fjernElement = useCallback(
    (element: Sideelement) =>
      endre(() => {
        utkastet()
        return lager.lagreUtkast(element.id, element.utgave.revisjon, { ...element.utgave.innhold, panel: FJERNET })
      }),
    [endre, lager, utkastet],
  )

  /**
   * Flytter kortet ett hakk i panelet. Kortene nummereres fortløpende på nytt,
   * og bare de som får ny plass, lagres.
   */
  const flyttElement = useCallback(
    (element: Sideelement, naboer: readonly Sideelement[], retning: -1 | 1) =>
      endre(async () => {
        utkastet()
        const rekke = [...naboer]
        const fra = rekke.findIndex((e) => e.id === element.id)
        const til = fra + retning
        if (fra === -1 || til < 0 || til >= rekke.length) return
        ;[rekke[fra], rekke[til]] = [rekke[til]!, rekke[fra]!]
        for (const [posisjon, e] of rekke.entries()) {
          if (e.posisjon === posisjon) continue
          await lager.lagreUtkast(e.id, e.utgave.revisjon, { ...e.utgave.innhold, posisjon })
        }
      }),
    [endre, lager, utkastet],
  )

  const lagrePanelreferanser = useCallback(
    (panel: string, ider: string[]) =>
      endre(async () => {
        const side = await sikreSide()
        const panelreferanser = { ...(side.innhold.panelreferanser ?? {}) }
        if (ider.length > 0) panelreferanser[panel] = ider
        else delete panelreferanser[panel]
        await lager.lagreUtkast(side.id, side.revisjon, { navn: side.innhold.navn, slug: side.innhold.slug, panelreferanser })
      }),
    [endre, sikreSide, lager],
  )

  const opprettReferanse = useCallback(
    async (innhold: Referanseinnhold): Promise<Referanse> => {
      const status = await lager.opprettUtkast('referanse', innhold)
      const referanse: Referanse = { ...innhold, id: status.id }
      setReferansebase((base) => [...base, referanse])
      return referanse
    },
    [lager],
  )

  /**
   * Lagrer regelsettet for koden og de nye og endrede kommentarene som utkast,
   * på én gang, mot revisjonene brukeren åpnet — eller mot `grunnlag` når
   * brukeren har sett en nyere utgave og velger å lagre over den. En konflikt
   * kastes videre til redigeringen, som lar brukeren sammenligne før noe
   * lagres.
   */
  const lagreRegelsett = useCallback(
    async (kode: string, innhold: Intervallregelsett, grunnlag?: Regelsettutgave) => {
      const apnet = utkastet().regler.regelsett[kode]
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
   * åpnet. Står noe av det på en nyere revisjon, blir det en konflikt som
   * ellers, og siden leses på nytt.
   */
  const lagreThcRegelsett = useCallback(
    (regler: ThcRegelsett, tekster: ThcTekster) =>
      endre(async () => {
        const apnet = utkastet().regler.thcregelsett
        if (!apnet) throw new Error(IKKE_KLAR)
        const { kommentarer, regelsett } = thcEndringer(apnet, regler, tekster)
        for (const k of kommentarer) await lager.lagreUtkast(k.id, k.revisjon, k.innhold)
        if (regelsett) await lager.lagreUtkast(regelsett.id, regelsett.revisjon, regelsett.innhold)
      }),
    [endre, lager, utkastet],
  )

  /** Regelsettet for koden slik utkastet står i databasen nå, til sammenligningen ved en konflikt. */
  const hentRegelsettutkast = useCallback((kode: string) => leser.finnIntervallregelsett(kode, 'utkast'), [leser])

  /**
   * Det samme for scenarioregelsettet til en modul: regelsettet og de nye og
   * endrede kommentarene sammen, mot revisjonene brukeren åpnet eller mot
   * `grunnlag`.
   */
  const lagreScenarioregelsett = useCallback(
    async (modulId: string, utkast: Scenarioutkast, grunnlag?: Scenarioregelsettutgave) => {
      const apnet = utkastet().regler.scenarioregelsett[modulId]
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

  const plan = useMemo(
    () => (modus === 'rediger' ? publiseringsplan(side.data, side.regler) : []),
    [modus, side.data, side.regler],
  )

  /**
   * Publiserer alt på siden som har upubliserte endringer, i den rekkefølgen
   * databasen krever. Stopper ved første feil; det som alt er publisert, står.
   */
  const publiser = useCallback(
    () =>
      endre(async () => {
        const { data, regler } = utkastet()
        for (const steg of publiseringsplan(data, regler)) {
          await lager.publiserUtkast(steg.id, steg.revisjon)
        }
      }),
    [endre, lager, utkastet],
  )

  return {
    side,
    /**
     * Sant når utkastet er lest og kan endres. Mens det hentes etter at
     * redigeringen er slått på, vises siden uten redigeringsknapper.
     */
    kanEndres: modus === 'rediger' && side.tilstand === 'utkast',
    referansebase,
    publisert,
    konflikt,
    plan,
    lastInn,
    lagreElement,
    fjernElement,
    flyttElement,
    lagrePanelreferanser,
    opprettReferanse,
    lagreRegelsett,
    hentRegelsettutkast,
    lagreScenarioregelsett,
    hentScenarioregelsettutkast,
    lagreThcRegelsett,
    gjenopprett,
    publiser,
  }
}

export type Stoffsidehandlinger = ReturnType<typeof useStoffside>
