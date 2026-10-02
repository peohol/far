import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { byggStoffregister, stoffslug, type Registerstruktur, type Stoffregister } from '../domain/stoffregister'
import { erTomt, type Riktekstdokument } from '../faginnhold/riktekst'
import { useHenting } from '../hooks/useHenting'
import type { Registerlager } from './api'
import { endreStruktur, type Registerdatabase, type Registerendring } from './modell'

/**
 * Stoffregisteret i appen: datafilen, fagsidene og inndelingen i databasen,
 * og handlingene som endrer inndelingen, arkivet og papirkurven.
 *
 * Sidemenyen, helsiden (`#/stoffregister`) og fagsidene deler denne ene
 * kilden, så en endring ett sted vises de andre stedene med en gang. En
 * endring i inndelingen vises før databasen har svart; kallene går ett og ett
 * i den rekkefølgen de ble gjort, og når køen er tom, hentes det databasen
 * faktisk har. Sa databasen nei, avviser handlingen med meldingen, og det som
 * vises, rettes av hentingen. Registeret hentes på nytt når fanen blir synlig
 * igjen, så endringer fra andre kommer med.
 *
 * Når registeret er hentet første gang, ryddes papirkurven for det som har
 * ligget der i mer enn 30 dager (`rydd_stoffpapirkurven`).
 */
export interface Registerhandlinger {
  opprettKategori: (navn: string, forelder: string | null) => Promise<string>
  endreKategori: (kategori: string, navn: string) => Promise<void>
  flyttKategori: (kategori: string, forelder: string | null, indeks: number) => Promise<void>
  arkiverKategori: (kategori: string, arkivert: boolean) => Promise<void>
  slettKategori: (kategori: string) => Promise<void>
  plasserStoff: (stoff: string, fra: string | null, til: string | null) => Promise<void>
  arkiverStoff: (stoff: string, arkivert: boolean) => Promise<void>
  slettStoff: (stoff: string) => Promise<void>
  gjenopprettStoff: (stoff: string) => Promise<void>
  slettStoffForGodt: (stoff: string) => Promise<void>
  tomPapirkurven: () => Promise<number>
  /** En ny fagside, lagt i kategorien når den er gitt. Gir nøkkelen. `undefined` for andre enn administratorer. */
  opprettStoffside?: (navn: string, kategori: string | null) => Promise<string>
}

export interface Stoffregisterkilde {
  register: Stoffregister
  /** Den korte oppsummeringen av stoffet, fra fagsiden. `null` når den ikke er skrevet. */
  oppsummering: (slug: string) => Riktekstdokument | null
  handlinger: Registerhandlinger
  /** Om den innloggede er administrator: ser papirkurven og kan slette det som har innhold. */
  admin: boolean
  /** Meldingen når registeret ikke kunne hentes, ellers `null`. */
  feil: string | null
  hentPaNytt: () => void
}

interface Valg {
  lager: Registerlager
  admin: boolean
  /** Lager utkastet til en ny fagside. Bare for administratorer. */
  opprettSide?: (navn: string, slug: string) => Promise<void>
}

/** Det som vises: inndelingen databasen har, med endringene som er på vei. */
interface Lokal {
  grunnlag: Registerdatabase
  struktur: Registerstruktur
}

export function useLagStoffregisterkilde({ lager, admin, opprettSide }: Valg): Stoffregisterkilde {
  const henting = useHenting(useCallback(() => lager.les(admin ? 'utkast' : 'publisert'), [lager, admin]))
  const { hentPaNytt } = henting
  const data = henting.tilstand.status === 'klar' ? henting.tilstand.data : null
  const [lokal, setLokal] = useState<Lokal | null>(null)
  // Et nytt svar fra databasen gjelder foran det som ble vist før det.
  const struktur = data && (lokal?.grunnlag === data ? lokal.struktur : data.struktur)

  const gjeldende = useRef<Lokal | null>(null)
  gjeldende.current = data && struktur ? { grunnlag: data, struktur } : null
  const underveis = useRef(0)
  const ko = useRef<Promise<unknown>>(Promise.resolve())

  const utfor = useCallback(
    <T,>(kall: () => Promise<T>, endring?: Registerendring): Promise<T> => {
      const naa = gjeldende.current
      if (endring && naa) {
        const neste = { grunnlag: naa.grunnlag, struktur: endreStruktur(naa.struktur, endring) }
        gjeldende.current = neste
        setLokal(neste)
      }
      underveis.current += 1
      const svar = ko.current.then(kall)
      ko.current = svar.catch(() => undefined)
      return svar.finally(() => {
        underveis.current -= 1
        if (underveis.current === 0) hentPaNytt()
      })
    },
    [hentPaNytt],
  )

  useEffect(() => {
    let aktuell = true
    lager.rydd().then(
      (antall) => {
        if (aktuell && antall > 0) hentPaNytt()
      },
      () => undefined,
    )
    const naarSynlig = () => {
      if (document.visibilityState === 'visible' && underveis.current === 0) hentPaNytt()
    }
    document.addEventListener('visibilitychange', naarSynlig)
    return () => {
      aktuell = false
      document.removeEventListener('visibilitychange', naarSynlig)
    }
  }, [lager, hentPaNytt])

  const handlinger = useMemo<Registerhandlinger>(
    () => ({
      opprettKategori: (navn, forelder) => utfor(() => lager.opprettKategori(navn, forelder)),
      endreKategori: (kategori, navn) =>
        utfor(() => lager.endreKategori(kategori, navn), { type: 'endre-kategori', kategori, navn: navn.trim() }),
      flyttKategori: (kategori, forelder, indeks) =>
        utfor(() => lager.flyttKategori(kategori, forelder, indeks), { type: 'flytt-kategori', kategori, forelder, indeks }),
      arkiverKategori: (kategori, arkivert) =>
        utfor(() => lager.arkiverKategori(kategori, arkivert), { type: 'arkiver-kategori', kategori, arkivert }),
      slettKategori: (kategori) => utfor(() => lager.slettKategori(kategori), { type: 'slett-kategori', kategori }),
      plasserStoff: (stoff, fra, til) =>
        utfor(() => lager.plasserStoff(stoff, fra, til), { type: 'plasser-stoff', stoff, fra, til }),
      arkiverStoff: (stoff, arkivert) =>
        utfor(() => lager.arkiverStoff(stoff, arkivert), { type: 'sett-status', stoff, status: arkivert ? 'arkivert' : null }),
      slettStoff: (stoff) => utfor(() => lager.slettStoff(stoff), { type: 'sett-status', stoff, status: 'papirkurv' }),
      gjenopprettStoff: (stoff) => utfor(() => lager.gjenopprettStoff(stoff), { type: 'sett-status', stoff, status: null }),
      slettStoffForGodt: (stoff) =>
        utfor(() => lager.slettStoffForGodt(stoff), { type: 'sett-status', stoff, status: 'fjernet' }),
      tomPapirkurven: () => utfor(() => lager.tomPapirkurven()),
      ...(opprettSide && {
        opprettStoffside: (navn: string, kategori: string | null) =>
          utfor(async () => {
            const slug = stoffslug(navn)
            if (!slug) throw new Error('Navnet må ha minst én bokstav eller ett tall.')
            await opprettSide(navn.trim(), slug)
            if (kategori) {
              // Siden er laget selv om plasseringen feiler: si det som det er.
              // Prøver man igjen, åpnes siden som alt finnes.
              try {
                await lager.plasserStoff(slug, null, kategori)
              } catch (e) {
                const grunn = e instanceof Error ? e.message : String(e)
                throw new Error(`Fagsiden «${navn.trim()}» er laget, men ble ikke lagt i kategorien: ${grunn} Den står under «Andre stoffer».`)
              }
            }
            return slug
          }),
      }),
    }),
    [lager, utfor, opprettSide],
  )

  const sider = data?.sider
  const register = useMemo(() => byggStoffregister(sider, undefined, struktur), [sider, struktur])
  const oppsummering = useMemo(() => {
    const perSlug = new Map((sider ?? []).map((s) => [s.slug, s.oppsummering]))
    return (slug: string) => {
      const dokument = perSlug.get(slug)
      return dokument && !erTomt(dokument) ? dokument : null
    }
  }, [sider])

  const feil = henting.tilstand.status === 'feil' ? henting.tilstand.melding : null
  return useMemo(
    () => ({ register, oppsummering, handlinger, admin, feil, hentPaNytt }),
    [register, oppsummering, handlinger, admin, feil, hentPaNytt],
  )
}

const Kontekst = createContext<Stoffregisterkilde | null>(null)

export function StoffregisterkildeProvider({ kilde, children }: { kilde: Stoffregisterkilde; children: ReactNode }) {
  return <Kontekst.Provider value={kilde}>{children}</Kontekst.Provider>
}

/** Registeret med handlingene, eller `null` utenfor en {@link StoffregisterkildeProvider} — da kan ingenting endres. */
export function useStoffregisterkilde(): Stoffregisterkilde | null {
  return useContext(Kontekst)
}
