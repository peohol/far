import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { publiseringsplan, tilReferanse, type Sideelement } from '../../faginnhold/stoffside'
import { Samtidighetskonflikt } from '../../faginnhold/lagring'
import { TOM_STOFFSIDE, type Stoffsidedata, type Utgave } from '../../faginnhold/lesing'
import type { Infosideinnhold, Innholdselementinnhold, Referanseinnhold, Tilstand } from '../../faginnhold/modell'
import { FJERNET, enkeltnokkel } from '../../faginnhold/paneler'
import type { Referanse } from '../../faginnhold/referanser'
import type { Stoff } from '../../domain/stoffregister'
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
  /**
   * Tilstanden `data` er lest fra. Står modusen nettopp byttet, er det den
   * forrige til den nye er hentet.
   */
  tilstand: Tilstand | null
  feil: string | null
}

const IKKE_KLAR = 'Utkastet er ikke hentet ennå. Vent litt og prøv igjen.'
const LAGT_INN_AV_ANDRE = 'Noen andre har lagt inn dette i mellomtiden.'

/**
 * En stoffside: monografien i den tilstanden modusen viser, og endringene som
 * kan gjøres på den.
 *
 * Lesemodus viser det publiserte — det alle innloggede ser. Redigeringsmodus
 * viser utkastet, og der lagres alt som utkast mot revisjonen brukeren så.
 * Ingenting blir synlig for andre før det publiseres.
 *
 * Monografien leses etter stoffets nøkkel, og ingenting annet. Fortolkningsreglene
 * hører til fortolkningssystemet og redigeres på fortolkningssiden
 * (`useFortolkningsredigering`). Et stoff i registeret som ikke har noen side i
 * databasen ennå, får den første gang noe lagres på den, med stoffets navn og
 * nøkkel.
 */
export function useStoffside(stoff: Pick<Stoff, 'slug' | 'navn'>, modus: Sidemodus) {
  const { leser, lager } = useFaginnholdskilde()
  const tilstand: Tilstand = modus === 'rediger' ? 'utkast' : 'publisert'
  const { slug, navn } = stoff
  const [side, setSide] = useState<Sidetilstand>({
    status: 'laster',
    data: TOM_STOFFSIDE,
    tilstand: null,
    feil: null,
  })
  const [referansebase, setReferansebase] = useState<Referanse[]>([])
  const [konflikt, setKonflikt] = useState(false)
  const [runde, setRunde] = useState(0)
  /** Det siste som er lest, og fra hvilken tilstand, for endringene som trenger revisjonene. */
  const siste = useRef<Pick<Sidetilstand, 'tilstand' | 'data'>>({ tilstand: null, data: TOM_STOFFSIDE })

  const lesSide = useCallback((t: Tilstand) => leser.lesStoffside(slug, t), [leser, slug])

  useEffect(() => {
    let gjelder = true
    setSide((forrige) => ({ ...forrige, status: 'laster' }))
    lesSide(tilstand)
      .then((data) => {
        if (!gjelder) return
        siste.current = { tilstand, data }
        setSide({ status: 'klar', data, tilstand, feil: null })
      })
      .catch((e: Error) => {
        if (!gjelder) return
        siste.current = { tilstand: null, data: TOM_STOFFSIDE }
        setSide({ status: 'feil', data: TOM_STOFFSIDE, tilstand: null, feil: e.message })
      })
    return () => {
      gjelder = false
    }
  }, [lesSide, tilstand, runde])

  // Referansebasen trengs bare for å velge kilder — altså bare i redigeringen.
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
    return () => {
      gjelder = false
    }
  }, [leser, modus, runde])

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
  const utkastet = useCallback((): Pick<Sidetilstand, 'data'> => {
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
          // Et kort som bare kan stå én gang, og som noen andre la inn mens dette ble skrevet.
          const nokkel = enkeltnokkel(endring)
          if (!nokkel) throw feil
          const na = await lesSide('utkast')
          if (!na.elementer.some((e) => enkeltnokkel(e.innhold) === nokkel)) throw feil
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
    () => (modus === 'rediger' ? publiseringsplan(side.data) : []),
    [modus, side.data],
  )

  /**
   * Publiserer alt på siden som har upubliserte endringer, i den rekkefølgen
   * databasen krever. Stopper ved første feil; det som alt er publisert, står.
   */
  const publiser = useCallback(
    () =>
      endre(async () => {
        for (const steg of publiseringsplan(utkastet().data)) {
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
    konflikt,
    plan,
    lastInn,
    lagreElement,
    fjernElement,
    flyttElement,
    lagrePanelreferanser,
    opprettReferanse,
    gjenopprett,
    publiser,
  }
}

export type Stoffsidehandlinger = ReturnType<typeof useStoffside>
