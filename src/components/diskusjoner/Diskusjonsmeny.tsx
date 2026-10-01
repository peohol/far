import { useCallback, useEffect, useId, useMemo, useRef, useState, type FocusEvent, type ReactNode } from 'react'
import type { Profil } from '@delt/profil'
import { Bevaringsomrade, useBevart } from '../../oppdatering/Bevaring'
import { hentAlleProfiler } from '../../auth/api'
import {
  flyttDiskusjonTil,
  flyttKategoriTil,
  hentBredde,
  hentDiskusjoner,
  hentDiskusjonstekster,
  hentLaast,
  lagreBredde,
  lagreLaast,
  losOppKategori,
} from '../../diskusjoner/api'
import {
  TOM_OVERSIKT,
  UKATEGORISERTE,
  adresseForSide,
  antallNye,
  flyttDiskusjon,
  flyttKategori,
  grupper,
  sokIDiskusjoner,
  type Diskusjonskategori,
  type Diskusjonsoversikt as Oversikt,
  type Diskusjonsside,
  type Diskusjonssider,
  type Diskusjonstekster,
} from '../../diskusjoner/modell'
import { useJevnligSjekk } from '../../hooks/useJevnligSjekk'
import { merketall } from '../../varsler/modell'
import { Breddehandtak, maalLengde } from '../Breddehandtak'
import { Ikon } from '../ikon/Ikon'
import { ToppmenyInnhold } from '../toppmeny/Toppmenykilde'
import { Toppmenyknapp } from '../toppmeny/Toppmenyknapp'
import { Forfatterkilde } from '../traad/Forfatterkontekst'
import { Diskusjonsoversikt, Traadknapp } from './Diskusjonsoversikt'
import { Diskusjonsside as Traadside } from './Diskusjonsside'
import { Kategoriskjema, Traadskjema } from './Skjemaer'
import { lyttEtterDiskusjon, taDiskusjon, visDiskusjon } from './diskusjonsvisning'
import '../../styles/diskusjoner.css'

/** Merket menyen bærer som `data-lag` mens fokus står i den (se `lagLiggerOver()`). */
export const DISKUSJON_LAG = 'diskusjoner'

/**
 * Hvordan menyen står, satt på rotelementet så resten av appen kan gi plass:
 * `smal` for kolonnen med emojiene, `laast` for hele menyen holdt åpen.
 */
const ROTMERKE = 'diskusjonsmeny'

/** Bredden brukeren har dratt menyen til, satt på rotelementet; `diskusjoner.css` holder den innenfor grensene. */
const BREDDEVARIABEL = '--diskusjonsbredde'
const settBredde = (bredde: number | null) => {
  const stil = document.documentElement.style
  if (bredde === null) stil.removeProperty(BREDDEVARIABEL)
  else stil.setProperty(BREDDEVARIABEL, `${bredde}px`)
}

type Visning =
  | { side: 'liste' }
  | { side: 'traad'; id: string }
  | { side: 'ny-traad'; kategori?: string }
  | { side: 'kategori'; id?: string }

const LISTE: Visning = { side: 'liste' }

/**
 * Diskusjonene på siden som står åpen — en fagside eller fortolkningen av én
 * analytt — i en fast meny til høyre.
 *
 * På brede flater står menyen som en smal kolonne med «Hold åpen» øverst og
 * emojien til hver kategori under, med et blått merke der noe er nytt. Når
 * pekeren kommer inn over den, åpner den seg, og den lukker seg igjen når
 * pekeren går ut — med mindre den holdes åpen, en tråd står åpen, eller noen
 * skriver i den. «Hold åpen» følger brukeren fra side til side og fra maskin
 * til maskin (brukerinnstillingen `diskusjoner.laast`), og da gir resten av
 * appen plass til den.
 *
 * Åpen kan menyen gjøres bredere ved å dra i venstre kanten (eller med
 * piltastene på den); bredden følger brukeren som «Hold åpen»
 * (`diskusjoner.bredde`). Den smaleste bredden er den menyen har fra før.
 *
 * På smale flater står en knapp i toppmenyen (dokken) i stedet, som åpner
 * menyen over siden.
 *
 * Mens fokus står i menyen, er den et lag over appen: tastene i fortolkningen
 * ligger i ro, så det som skrives her, ikke velger eller kopierer noe bak.
 */
export function Diskusjonsmeny({
  side,
  sidenavn,
  sider,
}: {
  side: Diskusjonsside
  sidenavn: string
  /** Sidene en tråd kan flyttes til. */
  sider: Diskusjonssider
}) {
  const [laast, setLaast] = useBevart('diskusjoner/laast', false)
  const [bredde, setBredde] = useBevart<number | null>('diskusjoner/bredde', null)
  const [mobilApen, setMobilApen] = useBevart('diskusjoner/mobil', false)
  const [svever, setSvever] = useState(false)
  const [fokus, setFokus] = useState(false)
  const [iTraad, setITraad] = useState(false)
  const meny = useRef<HTMLElement>(null)

  // «Hold åpen» er lagret på brukeren. Til det er hentet, gjelder det som stod.
  useEffect(() => {
    void hentLaast().then((lagret) => lagret !== null && setLaast(lagret), () => undefined)
  }, [setLaast])

  // Bredden er også lagret på brukeren.
  useEffect(() => {
    void hentBredde().then((lagret) => lagret !== null && setBredde(lagret), () => undefined)
  }, [setBredde])

  useEffect(() => {
    settBredde(bredde)
    return () => settBredde(null)
  }, [bredde])

  const lagreNyBredde = (ny: number) => {
    setBredde(ny)
    void lagreBredde(ny).catch(() => undefined)
  }

  const veksleLaas = () => {
    const ny = !laast
    setLaast(ny)
    void lagreLaast(ny).catch(() => undefined)
  }

  const apen = laast || svever || fokus || iTraad || mobilApen

  // Resten av appen gir plass til kolonnen, og til hele menyen når den holdes åpen.
  useEffect(() => {
    const rot = document.documentElement
    rot.dataset[ROTMERKE] = laast ? 'laast' : 'smal'
    return () => {
      delete rot.dataset[ROTMERKE]
    }
  }, [laast])

  // Et trykk utenfor lukker en meny som bare står åpen for øyeblikket.
  useEffect(() => {
    if (!svever && !mobilApen) return
    const utenfor = (event: PointerEvent) => {
      if (meny.current?.contains(event.target as Node)) return
      if ((event.target as Element | null)?.closest?.('.diskusjonsknapp')) return
      setSvever(false)
      setMobilApen(false)
    }
    document.addEventListener('pointerdown', utenfor)
    return () => document.removeEventListener('pointerdown', utenfor)
  }, [svever, mobilApen, setMobilApen])

  /**
   * Fokus holder menyen åpen når det står i et felt det skrives i, eller kom
   * dit med tastaturet. Et museklikk på en knapp i menyen skal ikke hindre at
   * den lukker seg når pekeren går ut.
   */
  const inn = (event: FocusEvent<HTMLElement>) => setFokus(holderApen(event.target))
  const ut = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setFokus(false)
  }

  // Et varsel som leder til en tråd, åpner menyen også på smale flater, der den ellers står skjult.
  const visVarslet = useCallback(() => setMobilApen(true), [setMobilApen])

  const lukk = () => {
    setSvever(false)
    setMobilApen(false)
    setFokus(false)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  return (
    <>
      <ToppmenyInnhold spor="handlinger">
        <Toppmenyknapp
          ikon="diskusjon"
          className="diskusjonsknapp"
          aria-expanded={mobilApen}
          onClick={() => setMobilApen((a) => !a)}
        >
          Diskusjoner
        </Toppmenyknapp>
      </ToppmenyInnhold>
      <aside
        ref={meny}
        className="diskusjonsmeny"
        aria-label={`Diskusjoner om ${sidenavn}`}
        data-apen={apen || undefined}
        data-laast={laast || undefined}
        data-mobil={mobilApen || undefined}
        {...(fokus && { 'data-lag': DISKUSJON_LAG })}
        onMouseEnter={() => setSvever(true)}
        onMouseLeave={() => setSvever(false)}
        onFocus={inn}
        onBlur={ut}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || event.defaultPrevented) return
          if ((event.target as HTMLElement).isContentEditable) return
          event.preventDefault()
          lukk()
        }}
      >
        {apen && (
          <Breddehandtak
            etikett="Bredden på diskusjonene"
            maal={() => ({
              bredde: maalLengde(meny.current!, 'var(--diskusjonspanel)'),
              minst: maalLengde(meny.current!, 'var(--diskusjonspanel-minst)'),
              mest: maalLengde(meny.current!, 'var(--diskusjonspanel-mest)'),
            })}
            onEndre={settBredde}
            onFerdig={lagreNyBredde}
          />
        )}
        <Bevaringsomrade navn={`diskusjoner:${side}`}>
          <Diskusjonsflate
            key={side}
            side={side}
            sidenavn={sidenavn}
            sider={sider}
            apen={apen}
            laast={laast}
            onLaas={veksleLaas}
            onApne={() => setSvever(true)}
            onLukk={lukk}
            onITraad={setITraad}
            onVarslet={visVarslet}
          />
        </Bevaringsomrade>
      </aside>
    </>
  )
}

/** Innholdet i menyen for én side. Byttes ut når siden byttes, så ingenting henger igjen fra forrige. */
function Diskusjonsflate({
  side,
  sidenavn,
  sider,
  apen,
  laast,
  onLaas,
  onApne,
  onLukk,
  onITraad,
  onVarslet,
}: {
  side: Diskusjonsside
  sidenavn: string
  sider: Diskusjonssider
  apen: boolean
  laast: boolean
  onLaas: () => void
  onApne: () => void
  onLukk: () => void
  onITraad: (iTraad: boolean) => void
  /** En tråd et varsel ba om, er åpnet. */
  onVarslet: () => void
}) {
  const [oversikt, setOversikt] = useState<Oversikt | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const [visning, setVisning] = useBevart<Visning>('visning', LISTE)
  const [sok, setSok] = useBevart('sok', '')
  const [tekster, setTekster] = useState<Diskusjonstekster[] | null>(null)
  const [profiler, setProfiler] = useState<Profil[]>([])
  const kropp = useRef<HTMLDivElement>(null)
  const sokId = useId()

  const hent = useCallback(async () => {
    try {
      setOversikt(await hentDiskusjoner(side))
      setFeil(null)
    } catch {
      setFeil('Fikk ikke hentet diskusjonene.')
    }
  }, [side])
  useJevnligSjekk(useCallback(() => void hent(), [hent]))

  // Navnene og bildene til dem som skriver, hentes første gang menyen åpnes.
  const profilerHentet = useRef(false)
  useEffect(() => {
    if (!apen || profilerHentet.current) return
    profilerHentet.current = true
    void hentAlleProfiler().then(setProfiler, () => undefined)
  }, [apen])

  // Tekstene til søket hentes når det søkes, og på nytt når trådene er endret.
  const soker = sok.trim() !== ''
  useEffect(() => {
    if (!soker) return
    void hentDiskusjonstekster(side).then(setTekster, () => setTekster([]))
  }, [soker, side, oversikt])

  // En tråd et varsel ba om, åpnes når menyen for siden står.
  useEffect(() => {
    const apneVenter = () => {
      const id = taDiskusjon(side)
      if (!id) return
      setVisning({ side: 'traad', id })
      onVarslet()
    }
    apneVenter()
    return lyttEtterDiskusjon(apneVenter)
  }, [side, setVisning, onVarslet])

  // En åpen tråd holder menyen åpen.
  useEffect(() => {
    onITraad(visning.side !== 'liste')
    return () => onITraad(false)
  }, [visning.side, onITraad])

  const data = oversikt ?? TOM_OVERSIKT
  const gruppering = useMemo(() => grupper(data), [data])
  const kategorier = useMemo(() => gruppering.kategorier.map((g) => g.kategori), [gruppering])
  const treff = useMemo(() => (soker && tekster ? sokIDiskusjoner(sok, data.diskusjoner, tekster) : []), [soker, sok, data, tekster])

  const tilListe = () => {
    setVisning(LISTE)
    void hent()
  }
  const apneTraad = (id: string) => {
    setVisning({ side: 'traad', id })
    kropp.current?.scrollTo({ top: 0 })
  }

  /** Flyttingen vises med én gang og lagres etterpå. Går lagringen galt, hentes lista på nytt. */
  const lagreFlytting = async (endring: (o: Oversikt) => Oversikt, lagring: () => Promise<void>) => {
    setOversikt((o) => (o ? endring(o) : o))
    try {
      await lagring()
      setFeil(null)
    } catch (e) {
      setFeil((e as Error).message)
      await hent()
      throw e
    }
  }
  const flyttTraad = (id: string, kategori: string, indeks: number) =>
    lagreFlytting((o) => flyttDiskusjon(o, id, kategori, indeks), () => flyttDiskusjonTil(id, kategori, indeks))
  const flyttKat = (id: string, indeks: number) =>
    lagreFlytting((o) => flyttKategori(o, id, indeks), () => flyttKategoriTil(id, indeks))

  const merkSett = useCallback(
    (id: string) =>
      setOversikt((o) =>
        o ? { ...o, diskusjoner: o.diskusjoner.map((d) => (d.id === id ? { ...d, usett: false, nye_kommentarer: 0 } : d)) } : o,
      ),
    [],
  )

  const losOpp = async (kategori: Diskusjonskategori) => {
    try {
      await losOppKategori(kategori.id)
      await hent()
    } catch (e) {
      setFeil((e as Error).message)
    }
  }

  let innhold: ReactNode
  if (visning.side === 'traad') {
    const liste = gruppering.kategorier.find((g) => g.diskusjoner.some((d) => d.id === visning.id))?.diskusjoner
    const indeks = liste?.findIndex((d) => d.id === visning.id) ?? -1
    innhold = (
      <Traadside
        key={visning.id}
        id={visning.id}
        side={side}
        sider={sider}
        kategorier={kategorier}
        plassering={liste && indeks >= 0 ? { indeks, antall: liste.length } : null}
        onEndret={hent}
        onSett={merkSett}
        onFlytt={(kategori, til) => flyttTraad(visning.id, kategori, til)}
        onFlyttetTilSide={(til) => {
          // Tråden følges til siden den er flyttet til, der menyen åpner den.
          setVisning(LISTE)
          visDiskusjon(til, visning.id)
          window.location.hash = adresseForSide(til)
        }}
        onSlettet={tilListe}
      />
    )
  } else if (visning.side === 'ny-traad') {
    innhold = (
      <Traadskjema
        side={side}
        kategori={visning.kategori}
        kategorier={kategorier}
        onAvbryt={tilListe}
        onLagret={(id) => {
          void hent()
          apneTraad(id)
        }}
      />
    )
  } else if (visning.side === 'kategori') {
    innhold = (
      <Kategoriskjema
        side={side}
        kategori={kategorier.find((k) => k.id === visning.id)}
        kategorier={kategorier}
        onAvbryt={tilListe}
        onLagret={tilListe}
      />
    )
  } else if (soker) {
    innhold = !tekster ? (
      <p className="diskusjonsoversikt__tom">Søker …</p>
    ) : treff.length === 0 ? (
      <p className="diskusjonsoversikt__tom">Ingen tråder passer med søket.</p>
    ) : (
      <ul className="traadliste traadliste--treff" aria-label="Treff">
        {treff.map(({ diskusjon, utdrag }) => (
          <li key={diskusjon.id} className="traadrad" data-arkivert={diskusjon.arkivert_kl ? true : undefined}>
            <Traadknapp diskusjon={diskusjon} utdrag={utdrag} onApne={apneTraad} />
          </li>
        ))}
      </ul>
    )
  } else {
    innhold = (
      <Diskusjonsoversikt
        gruppering={gruppering}
        kategorier={kategorier}
        onApne={apneTraad}
        onNyTraad={(kategori) => setVisning({ side: 'ny-traad', kategori })}
        onNyKategori={() => setVisning({ side: 'kategori' })}
        onEndreKategori={(k) => setVisning({ side: 'kategori', id: k.id })}
        onLosOpp={(k) => void losOpp(k)}
        onFlyttKategori={(id, indeks) => void flyttKat(id, indeks).catch(() => undefined)}
        onFlyttTraad={(id, kategori, indeks) => void flyttTraad(id, kategori, indeks).catch(() => undefined)}
      />
    )
  }

  const nyeUten = antallNye(gruppering.ukategoriserte)

  return (
    <Forfatterkilde profiler={profiler}>
      {/* Kolonnen når menyen er lukket: «Hold åpen» og emojiene. */}
      <div className="diskusjonsstolpe" hidden={apen}>
        <Laasknapp laast={laast} onLaas={onLaas} />
        <button type="button" className="diskusjonsstolpe__knapp" aria-label="Vis diskusjonene" onClick={onApne}>
          <Ikon navn="diskusjon" storrelse="ui" />
        </button>
        <ul className="diskusjonsstolpe__kategorier">
          {gruppering.ukategoriserte.length > 0 && (
            <Stolpekategori emoji={UKATEGORISERTE.emoji} navn={UKATEGORISERTE.navn} nye={nyeUten} onApne={onApne} />
          )}
          {gruppering.kategorier.map(({ kategori, diskusjoner }) => (
            <Stolpekategori
              key={kategori.id}
              emoji={kategori.emoji}
              navn={kategori.navn}
              nye={antallNye(diskusjoner)}
              onApne={() => {
                onApne()
                setVisning(LISTE)
                setSok('')
                requestAnimationFrame(() =>
                  kropp.current?.querySelector(`[data-kategori="${kategori.id}"]`)?.scrollIntoView({ block: 'start' }),
                )
              }}
            />
          ))}
        </ul>
      </div>

      <div className="diskusjonspanel" hidden={!apen}>
        <div className="diskusjonspanel__topp">
          <h2 className="diskusjonspanel__tittel">
            <Ikon navn="diskusjon" storrelse="ui" />
            <span>Diskusjoner</span>
          </h2>
          <Laasknapp laast={laast} onLaas={onLaas} />
          <button type="button" className="diskusjonspanel__lukk" aria-label="Lukk diskusjonene" onClick={onLukk}>
            <Ikon navn="close" storrelse="ui" />
          </button>
        </div>
        <p className="diskusjonspanel__side">{sidenavn}</p>
        {/* Tilbake og søket står fast over det som rulles. */}
        {visning.side === 'traad' && (
          <button type="button" className="diskusjonspanel__tilbake" onClick={tilListe}>
            <Ikon navn="chev" storrelse="ui" />
            <span>Alle tråder</span>
          </button>
        )}
        {visning.side === 'liste' && (
          <div className="diskusjonspanel__sok">
            <label htmlFor={sokId} className="kun-skjermleser">
              Søk i trådene
            </label>
            <Ikon navn="search" storrelse="ui" />
            <input
              id={sokId}
              type="search"
              className="diskusjonspanel__sokefelt"
              placeholder="Søk i trådene"
              value={sok}
              onChange={(e) => setSok(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && sok) {
                  e.preventDefault()
                  setSok('')
                }
              }}
            />
          </div>
        )}
        {feil && (
          <p className="skjemafeil" role="alert">
            {feil}
          </p>
        )}
        <div ref={kropp} className="diskusjonspanel__kropp">
          {innhold}
        </div>
      </div>
    </Forfatterkilde>
  )
}

/** Fokus som holder menyen åpen: i et felt det skrives i, eller kommet dit med tastaturet. */
function holderApen(element: HTMLElement): boolean {
  if (element.matches('input, select, textarea, [contenteditable="true"]')) return true
  try {
    return element.matches(':focus-visible')
  } catch {
    // En nettleser som ikke kjenner `:focus-visible`: bare feltene holder den åpen.
    return false
  }
}

/** «Hold åpen»: menyen står åpen til den slippes, på alle sider. */
function Laasknapp({ laast, onLaas }: { laast: boolean; onLaas: () => void }) {
  return (
    <button
      type="button"
      className="diskusjonsmeny__laas"
      aria-pressed={laast}
      aria-label="Hold diskusjonene åpne"
      title={laast ? 'Slipp diskusjonene' : 'Hold diskusjonene åpne'}
      onClick={onLaas}
    >
      <Ikon navn="feste" storrelse="ui" />
    </button>
  )
}

function Stolpekategori({ emoji, navn, nye, onApne }: { emoji: string; navn: string; nye: number; onApne: () => void }) {
  return (
    <li>
      <button
        type="button"
        className="diskusjonsstolpe__kategori"
        aria-label={nye > 0 ? `${navn}, ${nye} med nytt` : navn}
        title={navn}
        onClick={onApne}
      >
        <span aria-hidden="true">{emoji}</span>
        {nye > 0 && (
          <span className="nyttmerke nyttmerke--stolpe" aria-hidden="true">
            {merketall(nye)}
          </span>
        )}
      </button>
    </li>
  )
}
