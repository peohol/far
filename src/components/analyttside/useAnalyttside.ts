import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { publiseringsplan, tilReferanse, type Sideelement } from '../../faginnhold/analyttside'
import { Samtidighetskonflikt } from '../../faginnhold/lagring'
import { TOM_SIDE, type Analyttsidedata, type Utgave } from '../../faginnhold/lesing'
import type { Infosideinnhold, Innholdselementinnhold, Referanseinnhold, Tilstand } from '../../faginnhold/modell'
import { FJERNET } from '../../faginnhold/paneler'
import type { Referanse } from '../../faginnhold/referanser'
import type { Katalogoppforing } from '../../domain/analyttkatalog'
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
  data: Analyttsidedata
  feil: string | null
}

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
 * sumanalyse — brukes den.
 */
export function useAnalyttside(oppforing: Katalogoppforing, modus: Sidemodus) {
  const { leser, lager } = useFaginnholdskilde()
  const tilstand: Tilstand = modus === 'rediger' ? 'utkast' : 'publisert'
  const [side, setSide] = useState<Sidetilstand>({ status: 'laster', data: TOM_SIDE, feil: null })
  const [referansebase, setReferansebase] = useState<Referanse[]>([])
  const [konflikt, setKonflikt] = useState(false)
  const [runde, setRunde] = useState(0)
  /** Det siste som er lest, for endringene som trenger revisjonene. */
  const siste = useRef<Analyttsidedata>(TOM_SIDE)

  useEffect(() => {
    let gjelder = true
    setSide((forrige) => ({ ...forrige, status: 'laster' }))
    leser
      .lesAnalyttside(oppforing.kode, tilstand)
      .then((data) => {
        if (!gjelder) return
        siste.current = data
        setSide({ status: 'klar', data, feil: null })
      })
      .catch((e: Error) => {
        if (!gjelder) return
        siste.current = TOM_SIDE
        setSide({ status: 'feil', data: TOM_SIDE, feil: e.message })
      })
    return () => {
      gjelder = false
    }
  }, [leser, oppforing.kode, tilstand, runde])

  // Referansebasen trengs bare for å velge kilder, altså bare i redigeringen.
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
   * Informasjonssiden koden hører til, opprettet først om den ikke finnes.
   * Gir tilbake utkastet slik det står nå.
   */
  const sikreSide = useCallback(async (): Promise<Utgave<Infosideinnhold>> => {
    const data = siste.current
    if (data.analytt && data.infoside) return data.infoside

    const navn = [...new Set([oppforing.sidenavn, ...oppforing.komponenter])]
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

    const hovedside = await hent(oppforing.sidenavn)
    const komponenter: string[] = []
    for (const n of oppforing.komponenter) komponenter.push((await hent(n)).id)
    await lager.opprettUtkast('laboratorieanalytt', {
      kode: oppforing.kode,
      hovedside: hovedside.id,
      komponenter: komponenter.length > 0 ? komponenter : [hovedside.id],
    })
    return hovedside
  }, [leser, lager, oppforing])

  const lagreElement = useCallback(
    (element: Sideelement | null, endring: Elementendring) =>
      endre(async () => {
        const hovedside = await sikreSide()
        const innhold: Innholdselementinnhold = { infoside: hovedside.id, ...endring }
        if (element) await lager.lagreUtkast(element.id, element.utgave.revisjon, innhold)
        else await lager.opprettUtkast('innholdselement', innhold)
      }),
    [endre, sikreSide, lager],
  )

  /** Tar kortet bort fra siden. Det slettes ikke; se `FJERNET`. */
  const fjernElement = useCallback(
    (element: Sideelement) =>
      endre(() =>
        lager.lagreUtkast(element.id, element.utgave.revisjon, { ...element.utgave.innhold, panel: FJERNET }),
      ),
    [endre, lager],
  )

  /**
   * Flytter kortet ett hakk i panelet. Kortene nummereres fortløpende på nytt,
   * og bare de som får ny plass, lagres.
   */
  const flyttElement = useCallback(
    (element: Sideelement, naboer: readonly Sideelement[], retning: -1 | 1) =>
      endre(async () => {
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
    [endre, lager],
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

  const plan = useMemo(() => (modus === 'rediger' ? publiseringsplan(side.data) : []), [modus, side.data])

  /**
   * Publiserer alt på siden som har upubliserte endringer, i den rekkefølgen
   * databasen krever. Stopper ved første feil; det som alt er publisert, står.
   */
  const publiser = useCallback(
    () =>
      endre(async () => {
        for (const steg of publiseringsplan(siste.current)) {
          await lager.publiserUtkast(steg.id, steg.revisjon)
        }
      }),
    [endre, lager],
  )

  return {
    side,
    referansebase,
    konflikt,
    plan,
    lastInn,
    lagreElement,
    fjernElement,
    flyttElement,
    lagrePanelreferanser,
    opprettReferanse,
    publiser,
  }
}

export type Analyttsidehandlinger = ReturnType<typeof useAnalyttside>
