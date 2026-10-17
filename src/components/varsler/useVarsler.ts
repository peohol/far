import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ENDRINGSLOGG } from '../../data/endringslogg'
import { useJevnligSjekk } from '../../hooks/useJevnligSjekk'
import {
  arkiverVarsler,
  gjenopprettVarsler,
  hentEndringsloggstatus,
  hentUleste,
  hentVarsler,
  hentVarselvalg,
  lagreEndringsloggstatus,
  lagreVarselvalg,
  lyttEtterOppfrisking,
  merkVarslerLest,
} from '../../varsler/api'
import {
  antallUleste,
  arkiverEndringer,
  endringsvarsler,
  etterKilde,
  gjenopprettEndringer,
  merkEndringerLest,
  samleVarsler,
  startstatus,
  type Databasevarsel,
  type Endringsloggstatus,
  type Ulesttall,
  type Varsel,
  type Varselkategori,
  type Varselliste,
  type Varselvalg,
} from '../../varsler/modell'

export interface Varselstatus {
  /** Uleste varsler i kategoriene brukeren har valgt: tallet på bjella. */
  antall: number
  /** Varslene brukeren har valgt, når lista er hentet (`hent`). */
  varsler: Varsel[] | null
  feil: string | null
  valg: Varselvalg
  hent: () => void
  merkLest: (varsel: Varsel) => void
  merkAlleLest: () => void
  /** Legger varslene i arkivet, og merker dem lest. */
  arkiver: (varsler: readonly Varsel[]) => void
  /** Henter varslene fram fra arkivet. */
  gjenopprett: (varsler: readonly Varsel[]) => void
  endreValg: (kategori: Varselkategori, pa: boolean) => void
}

/**
 * Varslene til den innloggede, samlet fra databasen og endringsloggen og
 * sortert etter valgene. Tallet på bjella hentes når appen og fanen åpnes og
 * jevnlig (`useJevnligSjekk`); hele lista når vinduet åpnes.
 */
export function useVarsler(): Varselstatus {
  const [uleste, setUleste] = useState<Ulesttall>({})
  const [liste, setListe] = useState<Varselliste | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const [valg, setValg] = useState<Varselvalg>({})
  const valgene = useRef(valg)
  valgene.current = valg
  /** Hvor langt brukeren er kommet i endringsloggen. `null` til den er hentet. */
  const [logg, setLogg] = useState<Endringsloggstatus | null>(null)
  const loggen = useRef(logg)
  loggen.current = logg
  /** Lagringene av statusen, etter hverandre, så den siste alltid lagres sist. */
  const lagringen = useRef<Promise<void>>(Promise.resolve())

  const sjekk = useCallback(() => {
    hentUleste().then(setUleste, () => undefined)
  }, [])
  useJevnligSjekk(sjekk)
  useEffect(() => lyttEtterOppfrisking(sjekk), [sjekk])

  // Valgene og endringsloggen hentes én gang. Første gang lagres der brukeren
  // begynner i loggen; uten svar vet vi ikke, og viser ingen føringer.
  useEffect(() => {
    let gjelder = true
    hentVarselvalg().then((v) => gjelder && setValg(v), () => undefined)
    hentEndringsloggstatus().then(
      (status) => {
        if (!gjelder) return
        if (status) return setLogg(status)
        const start = startstatus(ENDRINGSLOGG)
        setLogg(start)
        void lagreEndringsloggstatus(start).catch(() => undefined)
      },
      () => undefined,
    )
    return () => {
      gjelder = false
    }
  }, [])

  const hent = useCallback(() => {
    sjekk()
    hentVarsler().then(
      (ny) => {
        setListe(ny)
        setFeil(null)
      },
      (e: Error) => setFeil(e.message),
    )
  }, [sjekk])

  const endringer = useMemo(() => (logg ? endringsvarsler(ENDRINGSLOGG, logg) : []), [logg])

  /** Endrer hvor langt brukeren er kommet i endringsloggen, og lagrer det. */
  const endreLoggen = useCallback((versjoner: string[], endre: (status: Endringsloggstatus) => Endringsloggstatus) => {
    const naa = loggen.current
    if (!naa || versjoner.length === 0) return
    const ny = endre(naa)
    loggen.current = ny
    setLogg(ny)
    lagringen.current = lagringen.current.then(() => lagreEndringsloggstatus(ny)).catch(() => undefined)
  }, [])

  /**
   * Endrer varslene i lista med én gang, og i databasen etterpå. Svarer
   * databasen at ikke alle ble endret — et varsel har fått noe nytt imens —
   * hentes lista på nytt, så varselet står slik det er.
   */
  const endreIDatabasen = useCallback(
    (
      ider: string[],
      endring: Partial<Pick<Databasevarsel, 'lest' | 'arkivert'>>,
      lagre: (ider: string[], til: string) => Promise<void | readonly string[]>,
    ) => {
      if (!liste || ider.length === 0) return
      setListe({ ...liste, varsler: liste.varsler.map((v) => (ider.includes(v.id) ? { ...v, ...endring } : v)) })
      lagre(ider, liste.lest_kl).then(
        (endret) => (endret && endret.length < ider.length ? hent() : sjekk()),
        () => undefined,
      )
    },
    [liste, hent, sjekk],
  )

  const varsler = useMemo(() => (liste ? samleVarsler([...liste.varsler, ...endringer], valg) : null), [liste, endringer, valg])

  const lesVarsler = useCallback(
    (uleste: readonly Varsel[]) => {
      const { versjoner, ider } = etterKilde(uleste)
      endreLoggen(versjoner, (status) => merkEndringerLest(ENDRINGSLOGG, status, versjoner))
      endreIDatabasen(ider, { lest: true }, merkVarslerLest)
    },
    [endreLoggen, endreIDatabasen],
  )

  const merkLest = useCallback(
    (varsel: Varsel) => {
      if (!varsel.lest) lesVarsler([varsel])
    },
    [lesVarsler],
  )

  /** Merker det brukeren ser, lest: kategoriene som er slått av, står urørt. */
  const merkAlleLest = useCallback(() => lesVarsler((varsler ?? []).filter((v) => !v.lest)), [varsler, lesVarsler])

  const arkiver = useCallback(
    (valgte: readonly Varsel[]) => {
      const { versjoner, ider } = etterKilde(valgte.filter((v) => !v.arkivert))
      endreLoggen(versjoner, (status) => arkiverEndringer(ENDRINGSLOGG, status, versjoner))
      endreIDatabasen(ider, { lest: true, arkivert: true }, arkiverVarsler)
    },
    [endreLoggen, endreIDatabasen],
  )

  const gjenopprett = useCallback(
    (valgte: readonly Varsel[]) => {
      const { versjoner, ider } = etterKilde(valgte.filter((v) => v.arkivert))
      endreLoggen(versjoner, (status) => gjenopprettEndringer(status, versjoner))
      endreIDatabasen(ider, { arkivert: false }, (valgte) => gjenopprettVarsler(valgte))
    },
    [endreLoggen, endreIDatabasen],
  )

  const endreValg = useCallback((kategori: Varselkategori, pa: boolean) => {
    const neste = { ...valgene.current, [kategori]: pa }
    valgene.current = neste
    setValg(neste)
    void lagreVarselvalg(neste).catch(() => undefined)
  }, [])

  return {
    antall: antallUleste(uleste, endringer, valg),
    varsler,
    feil,
    valg,
    hent,
    merkLest,
    merkAlleLest,
    arkiver,
    gjenopprett,
    endreValg,
  }
}
