import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { publiseringsplan, tilReferanse, type Sideelement } from '../../faginnhold/analyttside'
import { Samtidighetskonflikt } from '../../faginnhold/lagring'
import {
  TOM_SIDE,
  type Analyttsidedata,
  type Regelsettutgave,
  type Scenarioregelsettutgave,
  type Utgave,
} from '../../faginnhold/lesing'
import type { Infosideinnhold, Innholdselementinnhold, Referanseinnhold, Tilstand } from '../../faginnhold/modell'
import { kommentarendringer, utenKommentarer } from '../../regler/kommentarer'
import type { Intervallregelsett } from '../../regler/modell'
import { scenariokommentarendringer, type Scenarioutkast } from '../../regler/scenarioredigering'
import { rusModulFor } from '../../domain/rus'
import { FJERNET, erEnkeltelement } from '../../faginnhold/paneler'
import type { Referanse } from '../../faginnhold/referanser'
import type { Katalogoppforing } from '../../domain/analyttkatalog'
import type { ThcRegelsett } from '../../domain/thcRegelsett'
import type { ThcTekster } from '../../domain/thcTekster'
import { thcEndringer } from '../../faginnhold/thcregler'
import { useFaginnholdskilde } from './Faginnholdskilde'

export type Sidemodus = 'lese' | 'rediger'

/**
 * Hvilken side: siden for en analyttkode i katalogen, eller siden for et stoff
 * som ikke har noen analyttkode, etter navnet.
 */
export type Sidenokkel = { type: 'kode'; oppforing: Katalogoppforing } | { type: 'stoff'; navn: string }

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
  data: Analyttsidedata
  /**
   * Tilstanden `data` er lest fra. Står modusen nettopp byttet, er det den
   * forrige til den nye er hentet.
   */
  tilstand: Tilstand | null
  feil: string | null
}

/** Regelsettene slik de er publisert, til å vise hva som endres før publiseringen. */
export interface Publiserteregler {
  regelsett: Regelsettutgave | null
  scenarioregelsett: Scenarioregelsettutgave | null
}

const INGEN_PUBLISERTE: Publiserteregler = { regelsett: null, scenarioregelsett: null }

const IKKE_KLAR = 'Utkastet er ikke hentet ennå. Vent litt og prøv igjen.'
const LAGT_INN_AV_ANDRE = 'Noen andre har lagt inn dette i mellomtiden.'

/**
 * En analyttside: innholdet i den tilstanden modusen viser, og endringene som
 * kan gjøres på den.
 *
 * Lesemodus viser det publiserte — det alle innloggede ser. Redigeringsmodus
 * viser utkastet, og der lagres alt som utkast mot revisjonen brukeren så.
 * Ingenting blir synlig for andre før det publiseres.
 *
 * Siden finnes ikke i databasen før noe er lagret på den første gang. Da
 * opprettes informasjonssiden og laboratorieanalytten av det de statiske
 * datasettene sier om koden: sidens navn og stoffene analysen omfatter.
 * Finnes en side med samme navn fra før — for eksempel som komponent i en
 * sumanalyse — brukes den. Et stoff uten analyttkode får bare
 * informasjonssiden, med navnet fra adressen; regelsett har det ikke.
 *
 * Fortolkes koden med scenarioregler, hentes regelsettet for modulen også,
 * men bare til redigeringen: lesemodusen viser reglene appen alt har hentet.
 */
export function useAnalyttside(nokkel: Sidenokkel, modus: Sidemodus) {
  const { leser, lager } = useFaginnholdskilde()
  const tilstand: Tilstand = modus === 'rediger' ? 'utkast' : 'publisert'
  const oppforing = nokkel.type === 'kode' ? nokkel.oppforing : null
  const stoffnavn = nokkel.type === 'stoff' ? nokkel.navn : null
  const kode = oppforing?.kode ?? null
  const modul = useMemo(() => (oppforing ? (rusModulFor(oppforing.fortolkning) ?? null) : null), [oppforing])
  const [side, setSide] = useState<Sidetilstand>({ status: 'laster', data: TOM_SIDE, tilstand: null, feil: null })
  const [referansebase, setReferansebase] = useState<Referanse[]>([])
  const [publisert, setPublisert] = useState<Publiserteregler>(INGEN_PUBLISERTE)
  const [konflikt, setKonflikt] = useState(false)
  const [runde, setRunde] = useState(0)
  /** Det siste som er lest, og fra hvilken tilstand, for endringene som trenger revisjonene. */
  const siste = useRef<{ tilstand: Tilstand | null; data: Analyttsidedata }>({ tilstand: null, data: TOM_SIDE })

  /** Siden i én tilstand: gjennom koden når den har en, ellers etter navnet. */
  const lesSide = useCallback(
    (t: Tilstand) => (kode !== null ? leser.lesAnalyttside(kode, t) : leser.lesStoffside(stoffnavn ?? '', t)),
    [leser, kode, stoffnavn],
  )

  useEffect(() => {
    let gjelder = true
    setSide((forrige) => ({ ...forrige, status: 'laster' }))
    Promise.all([
      lesSide(tilstand),
      tilstand === 'utkast' && modul ? leser.finnScenarioregelsett(modul.id, tilstand) : null,
    ])
      .then(([side, scenarioregelsett]) => {
        if (!gjelder) return
        const data = { ...side, scenarioregelsett }
        siste.current = { tilstand, data }
        setSide({ status: 'klar', data, tilstand, feil: null })
      })
      .catch((e: Error) => {
        if (!gjelder) return
        siste.current = { tilstand: null, data: TOM_SIDE }
        setSide({ status: 'feil', data: TOM_SIDE, tilstand: null, feil: e.message })
      })
    return () => {
      gjelder = false
    }
  }, [leser, lesSide, modul, tilstand, runde])

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
    Promise.all([
      kode !== null ? leser.finnIntervallregelsett(kode, 'publisert') : null,
      modul ? leser.finnScenarioregelsett(modul.id, 'publisert') : null,
    ])
      .then(([regelsett, scenarioregelsett]) => {
        if (gjelder) setPublisert({ regelsett, scenarioregelsett })
      })
      .catch(() => {
        if (gjelder) setPublisert(INGEN_PUBLISERTE)
      })
    return () => {
      gjelder = false
    }
  }, [leser, modus, runde, kode, modul])

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
  const utkastet = useCallback((): Analyttsidedata => {
    if (siste.current.tilstand !== 'utkast') throw new Error(IKKE_KLAR)
    return siste.current.data
  }, [])

  /**
   * Informasjonssiden koden eller stoffet hører til, opprettet først om den
   * ikke finnes. Gir tilbake utkastet slik det står nå.
   */
  const sikreSide = useCallback(async (): Promise<Utgave<Infosideinnhold>> => {
    const data = utkastet()
    if (data.infoside && (data.analytt || !oppforing)) return data.infoside

    const navn = oppforing ? [...new Set([oppforing.sidenavn, ...oppforing.komponenter])] : [stoffnavn ?? '']
    const finnes = await leser.finnInfosider(navn, 'utkast')
    const perNavn = new Map(finnes.map((u) => [u.innhold.navn.toLocaleLowerCase('nb'), u]))
    const hent = async (n: string): Promise<Utgave<Infosideinnhold>> => {
      const kjent = perNavn.get(n.toLocaleLowerCase('nb'))
      if (kjent) return kjent
      const status = await lager.opprettUtkast('infoside', { navn: n })
      const ny: Utgave<Infosideinnhold> = {
        id: status.id,
        revisjon: status.revisjon ?? 1,
        publisert_revisjon: null,
        innhold: { navn: n },
        endret_av_fornavn: '',
        endret_av_etternavn: '',
        endret_kl: status.endret_kl ?? '',
      }
      perNavn.set(n.toLocaleLowerCase('nb'), ny)
      return ny
    }

    if (!oppforing) return hent(navn[0]!)
    const hovedside = await hent(oppforing.sidenavn)
    const komponenter: string[] = []
    for (const n of oppforing.komponenter) komponenter.push((await hent(n)).id)
    await lager.opprettUtkast('laboratorieanalytt', {
      kode: oppforing.kode,
      hovedside: hovedside.id,
      komponenter: komponenter.length > 0 ? komponenter : [hovedside.id],
    })
    return hovedside
  }, [leser, lager, oppforing, stoffnavn, utkastet])

  /**
   * Lagrer et element, eller oppretter det. Et kort som bare kan finnes én
   * gang på siden, er vernet i databasen; har noen andre lagt det inn i
   * mellomtiden, blir det en konflikt som ellers, ikke et kort nummer to.
   */
  const lagreElement = useCallback(
    (element: Sideelement | null, endring: Elementendring) =>
      endre(async () => {
        const hovedside = await sikreSide()
        const innhold: Innholdselementinnhold = { infoside: hovedside.id, ...endring }
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
            (e) => e.innhold.panel === endring.panel && e.innhold.elementtype === endring.elementtype,
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
        await lager.lagreUtkast(side.id, side.revisjon, { navn: side.innhold.navn, panelreferanser })
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
   * Lagrer regelsettet og de nye og endrede kommentarene som utkast, på én
   * gang, mot revisjonene brukeren åpnet — eller mot `grunnlag` når brukeren
   * har sett en nyere utgave og velger å lagre over den. En konflikt kastes
   * videre til redigeringen, som lar brukeren sammenligne før noe lagres.
   */
  const lagreRegelsett = useCallback(
    async (innhold: Intervallregelsett, grunnlag?: Regelsettutgave) => {
      const apnet = utkastet().regelsett
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
        const apnet = utkastet().thcregelsett
        if (!apnet) throw new Error(IKKE_KLAR)
        const { kommentarer, regelsett } = thcEndringer(apnet, regler, tekster)
        for (const k of kommentarer) await lager.lagreUtkast(k.id, k.revisjon, k.innhold)
        if (regelsett) await lager.lagreUtkast(regelsett.id, regelsett.revisjon, regelsett.innhold)
      }),
    [endre, lager, utkastet],
  )

  /** Regelsettet slik utkastet står i databasen nå, til sammenligningen ved en konflikt. */
  const hentRegelsettutkast = useCallback(
    async () => (kode !== null ? leser.finnIntervallregelsett(kode, 'utkast') : null),
    [leser, kode],
  )

  /**
   * Det samme for scenarioregelsettet: regelsettet og de nye og endrede
   * kommentarene sammen, mot revisjonene brukeren åpnet eller mot `grunnlag`.
   */
  const lagreScenarioregelsett = useCallback(
    async (utkast: Scenarioutkast, grunnlag?: Scenarioregelsettutgave) => {
      const apnet = utkastet().scenarioregelsett
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
    [lager, utkastet, modul],
  )

  /** Scenarioregelsettet slik utkastet står i databasen nå, til sammenligningen ved en konflikt. */
  const hentScenarioregelsettutkast = useCallback(
    async () => (modul ? leser.finnScenarioregelsett(modul.id, 'utkast') : null),
    [leser, modul],
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

  const plan = useMemo(() => (modus === 'rediger' ? publiseringsplan(side.data) : []), [modus, side.data])

  /**
   * Publiserer alt på siden som har upubliserte endringer, i den rekkefølgen
   * databasen krever. Stopper ved første feil; det som alt er publisert, står.
   */
  const publiser = useCallback(
    () =>
      endre(async () => {
        for (const steg of publiseringsplan(utkastet())) {
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

export type Analyttsidehandlinger = ReturnType<typeof useAnalyttside>
