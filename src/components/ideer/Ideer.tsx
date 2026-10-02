import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import { Bevaringsomrade, useBevart } from '../../oppdatering/Bevaring'
import type { Profil } from '@delt/profil'
import { hentAlleProfiler } from '../../auth/api'
import { flyttOppgaveTilbake, gjenopprettIde, hentIdeer, hentSortering, lagreSortering, ryddIdearkiv } from '../../ideer/api'
import { STANDARDSORTERING, type Ide, type Idekategori, type Idetraad, type Sortering } from '../../ideer/modell'
import { Angretoast, type Angring } from '../Angretoast'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Modallag } from '../Modallag'
import { Forfatterkilde } from '../traad/Forfatterkontekst'
import type { Fremheving } from '../traad/Kommentartraad'
import { Ideliste } from './Ideliste'
import { Ideside } from './Ideside'
import { Ideskjema } from './Ideskjema'
import { veksleSkuff } from './Ideskuff'
import { useForlatvakt, useMeldVakt, type Forlat } from './useForlatvakt'
import '../../styles/ideer.css'

/**
 * Idéene, fra idéknappen i toppmenyen: et lag over appen der alle brukerne kan legge inn
 * idéer, gi hjerter og kommentere.
 *
 * Laget har tre sider: lista med idéene som kort, én idé med beskrivelsen og
 * kommentartråden, og skjemaet for en ny eller endret idé. Tilbakeknappen i
 * hodet går til lista, der fokus står på kortet man kom fra.
 *
 * En administrator kan legge en idé i arkivet («Ikke aktuelt») eller overføre
 * den til Planlagte oppgaver, som er et eget lag (`Oppgaver`). Begge kan
 * angres i ti sekunder fra meldingen nederst i laget.
 */
type Visning =
  | { side: 'liste' }
  | { side: 'ide'; id: string }
  | { side: 'skjema'; ide?: Idetraad; kategori?: Idekategori }

const LISTE: Visning = { side: 'liste' }

export function Ideer({
  apen,
  ide,
  kommentar,
  nr,
  vakt: meldTil,
  onLukk,
  onOppgaver,
}: {
  apen: boolean
  /** Idéen laget åpnes på, som fra et varsel. Ellers begynner det på lista. */
  ide?: string
  /** Kommentaren under idéen en direktelenke peker på. */
  kommentar?: string
  /** Ny for hver gang laget bes om å åpne idéen, også når den alt står åpen. */
  nr?: number
  /** Får vakten for skjemaet mens laget står åpent (`useMeldVakt`). */
  vakt?: MutableRefObject<Forlat | null>
  onLukk: () => void
  /** Til Planlagte oppgaver, eventuelt rett til én oppgave. */
  onOppgaver: (oppgave?: string) => void
}) {
  // Siden i laget, og det som skrives på den, overlever en oppdatering av appen.
  const [visning, setVisning, visningGjenopprettet] = useBevart<Visning>('ideer', LISTE)
  const [ideer, setIdeer] = useState<Ide[]>([])
  const [profiler, setProfiler] = useState<Profil[]>([])
  const [sortering, setSortering] = useState<Sortering>(STANDARDSORTERING)
  const [feil, setFeil] = useState<string | null>(null)
  const [apneSkuffer, setApneSkuffer] = useState<ReadonlySet<string>>(new Set())
  const [angring, setAngring] = useState<Angring | null>(null)
  const [fremhev, setFremhev] = useState<Fremheving | null>(null)
  const vakt = useForlatvakt()
  const { nullstill } = vakt
  useMeldVakt(apen, vakt.forlat, meldTil)
  const rot = useRef<HTMLDivElement>(null)
  /** Hvor lista stod, og kortet man gikk inn på, så tilbake lander samme sted. */
  const listeplass = useRef<{ rulling: number; ide: string | null }>({ rulling: 0, ide: null })
  /** Laget stod åpent da appen ble oppdatert: den første åpningen fortsetter der den var. */
  const fortsetter = useRef(visningGjenopprettet)

  const hentListe = useCallback(async () => {
    try {
      setIdeer(await hentIdeer())
      setFeil(null)
    } catch {
      setFeil('Fikk ikke hentet idéene.')
    }
  }, [])

  // Hver åpning begynner på lista, eller på idéen laget ble åpnet på, med alt
  // hentet på nytt. Arkivet ryddes for idéer som har passert fristen, før
  // lista hentes. Stod laget åpent da appen ble oppdatert, fortsetter det der
  // det var.
  useEffect(() => {
    if (!apen) {
      fortsetter.current = false
      setAngring(null)
      return
    }
    if (!fortsetter.current) {
      nullstill()
      setVisning(ide ? { side: 'ide', id: ide } : LISTE)
      setFremhev(ide && kommentar ? { kommentar, nr: nr ?? Date.now() } : null)
      setApneSkuffer(new Set())
      listeplass.current = { rulling: 0, ide: ide ?? null }
    }
    // Bare den første åpningen fortsetter; en ny idé mens laget står åpent, vises.
    fortsetter.current = false
    void ryddIdearkiv()
      .catch(() => undefined)
      .then(hentListe)
    void hentAlleProfiler().then(setProfiler, () => undefined)
    void hentSortering().then(setSortering, () => undefined)
    // `kommentar` følger `nr`, som er ny for hver lenke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apen, ide, nr, hentListe, nullstill])

  const kropp = () => rot.current?.closest<HTMLElement>('.modallag__kropp') ?? null

  const gaaTil = (neste: Visning) => {
    if (visning.side === 'liste') listeplass.current.rulling = kropp()?.scrollTop ?? 0
    vakt.nullstill()
    setFremhev(null)
    setVisning(neste)
  }

  // En ny side begynner øverst; lista begynner der den slapp, med fokus på kortet.
  useLayoutEffect(() => {
    const boks = kropp()
    if (!boks) return
    if (visning.side !== 'liste') {
      boks.scrollTop = 0
      return
    }
    boks.scrollTop = listeplass.current.rulling
    const { ide } = listeplass.current
    if (!ide) return
    const kort = [...(rot.current?.querySelectorAll<HTMLElement>('[data-ide]') ?? [])].find((el) => el.dataset.ide === ide)
    kort?.focus({ preventScroll: true })
  }, [visning])

  const tilListe = () => {
    void hentListe()
    gaaTil(LISTE)
  }

  const endreSortering = (neste: Sortering) => {
    setSortering(neste)
    void lagreSortering(neste).catch(() => undefined)
  }

  const apneIde = (id: string) => {
    listeplass.current.ide = id
    gaaTil({ side: 'ide', id })
  }

  /** Idéen har fått en ny plass: tilbake til lista, med «Angre» nederst. */
  const flyttet = (melding: string, angre: () => Promise<void>) => {
    setAngring({
      nokkel: Date.now(),
      melding,
      angre: async () => {
        await angre()
        await hentListe()
      },
    })
    listeplass.current.ide = null
    tilListe()
  }

  const tilbake =
    visning.side === 'liste'
      ? undefined
      : {
          etikett: 'Tilbake til idéene',
          onTilbake: () =>
            vakt.forlat(visning.side === 'skjema' && visning.ide ? () => gaaTil({ side: 'ide', id: visning.ide!.id }) : tilListe),
        }

  return (
    <Modallag
      apen={apen}
      tittel="Idéer"
      ikon="idea"
      tilbake={tilbake}
      onLukk={onLukk}
      vedLukking={vakt.vedLukking(onLukk)}
      handling={
        visning.side === 'liste' ? (
          <>
            <Button variant="subtle" className="knapp--kompakt" icon={<Ikon navn="oppgaver" />} onClick={() => onOppgaver()}>
              Planlagte oppgaver
            </Button>
            <Button className="knapp--kompakt" icon={<Ikon navn="plus" />} onClick={() => gaaTil({ side: 'skjema' })}>
              Ny idé
            </Button>
          </>
        ) : null
      }
      fot={angring ? <Angretoast key={angring.nokkel} angring={angring} onFerdig={() => setAngring(null)} /> : undefined}
    >
      <Forfatterkilde profiler={profiler}>
        <Bevaringsomrade navn="ideer">
          <div ref={rot} className="idevindu" key={visning.side === 'ide' ? visning.id : visning.side}>
            {feil && visning.side === 'liste' && (
              <p className="skjemafeil" role="alert">
                {feil}
              </p>
            )}
            {visning.side === 'liste' && (
              <Ideliste
                ideer={ideer}
                sortering={sortering}
                onSortering={endreSortering}
                onApne={apneIde}
                onNy={(kategori) => gaaTil({ side: 'skjema', kategori })}
                onOppgave={onOppgaver}
                apneSkuffer={apneSkuffer}
                onVeksleSkuff={(navn) => setApneSkuffer((apne) => veksleSkuff(apne, navn))}
              />
            )}
            {visning.side === 'ide' && (
              <Ideside
                id={visning.id}
                fremhev={fremhev}
                onEndre={(ide) => gaaTil({ side: 'skjema', ide })}
                onSlettet={() => {
                  listeplass.current.ide = null
                  tilListe()
                }}
                onArkivert={(ide) => flyttet('Idéen er lagt i «Ikke aktuelt».', () => gjenopprettIde(ide.id))}
                onOverfort={(_ide, oppgave) => flyttet('Idéen er overført til planlagte oppgaver.', () => flyttOppgaveTilbake(oppgave))}
                onOppgave={onOppgaver}
              />
            )}
            {visning.side === 'skjema' && (
              <Ideskjema
                ide={visning.ide}
                kategori={visning.kategori}
                onStatus={vakt.setStatus}
                forlater={vakt.forlater}
                onForkast={vakt.forkast}
                onFortsett={vakt.fortsett}
                onAvbryt={() => (visning.ide ? gaaTil({ side: 'ide', id: visning.ide.id }) : tilListe())}
                onLagret={(id) => {
                  listeplass.current.ide = id
                  gaaTil({ side: 'ide', id })
                }}
              />
            )}
          </div>
        </Bevaringsomrade>
      </Forfatterkilde>
    </Modallag>
  )
}
