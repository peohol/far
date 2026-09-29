import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ENDRINGSLOGG } from '../../data/endringslogg'
import { useJevnligSjekk } from '../../hooks/useJevnligSjekk'
import {
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
  endringsvarsler,
  merkEndringerLest,
  samleVarsler,
  startstatus,
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

  const lesEndringer = useCallback((versjoner: string[]) => {
    const naa = loggen.current
    if (!naa || versjoner.length === 0) return
    const ny = merkEndringerLest(ENDRINGSLOGG, naa, versjoner)
    setLogg(ny)
    void lagreEndringsloggstatus(ny).catch(() => undefined)
  }, [])

  /** Merker lest i lista med én gang, og i databasen etterpå. */
  const lesIDatabasen = useCallback(
    (ider: string[] | null) => {
      if (!liste) return
      setListe({ ...liste, varsler: liste.varsler.map((v) => (ider === null || ider.includes(v.id) ? { ...v, lest: true } : v)) })
      merkVarslerLest(ider, liste.lest_kl).then(sjekk, () => undefined)
    },
    [liste, sjekk],
  )

  const merkLest = useCallback(
    (varsel: Varsel) => {
      if (varsel.lest) return
      if (varsel.kilde === 'endringslogg') lesEndringer([varsel.endring.versjon])
      else lesIDatabasen([varsel.id])
    },
    [lesEndringer, lesIDatabasen],
  )

  const merkAlleLest = useCallback(() => {
    lesEndringer(endringer.filter((e) => !e.lest).map((e) => e.endring.versjon))
    lesIDatabasen(null)
  }, [endringer, lesEndringer, lesIDatabasen])

  const endreValg = useCallback((kategori: Varselkategori, pa: boolean) => {
    const neste = { ...valgene.current, [kategori]: pa }
    valgene.current = neste
    setValg(neste)
    void lagreVarselvalg(neste).catch(() => undefined)
  }, [])

  const varsler = useMemo(() => (liste ? samleVarsler([...liste.varsler, ...endringer], valg) : null), [liste, endringer, valg])

  return {
    antall: antallUleste(uleste, endringer, valg),
    varsler,
    feil,
    valg,
    hent,
    merkLest,
    merkAlleLest,
    endreValg,
  }
}
