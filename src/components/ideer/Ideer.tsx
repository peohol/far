import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Profil } from '@delt/profil'
import { hentAlleProfiler } from '../../auth/api'
import { hentIdeer, hentSortering, lagreSortering } from '../../ideer/api'
import { STANDARDSORTERING, type Ide, type Idekategori, type Idetraad, type Sortering } from '../../ideer/modell'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Modallag } from '../Modallag'
import { Idekilde } from './Idekontekst'
import { Ideliste } from './Ideliste'
import { Ideside } from './Ideside'
import { Ideskjema, type Skjemastatus } from './Ideskjema'
import '../../styles/ideer.css'

/**
 * Idéene, fra idéknappen i toppmenyen: et lag over appen der alle brukerne kan legge inn
 * idéer, gi hjerter og kommentere.
 *
 * Laget har tre sider: lista med idéene som kort, én idé med beskrivelsen og
 * kommentartråden, og skjemaet for en ny eller endret idé. Tilbakeknappen i
 * hodet går til lista, der fokus står på kortet man kom fra.
 */
type Visning =
  | { side: 'liste' }
  | { side: 'ide'; id: string }
  | { side: 'skjema'; ide?: Idetraad; kategori?: Idekategori }

const LISTE: Visning = { side: 'liste' }

export function Ideer({ apen, onLukk }: { apen: boolean; onLukk: () => void }) {
  const [visning, setVisning] = useState<Visning>(LISTE)
  const [ideer, setIdeer] = useState<Ide[]>([])
  const [profiler, setProfiler] = useState<Profil[]>([])
  const [sortering, setSortering] = useState<Sortering>(STANDARDSORTERING)
  const [feil, setFeil] = useState<string | null>(null)
  const [skjemastatus, setSkjemastatus] = useState<Skjemastatus>('uendret')
  /** Det som skal skje om brukeren forkaster et skjema med endringer. */
  const [forlater, setForlater] = useState<(() => void) | null>(null)
  const rot = useRef<HTMLDivElement>(null)
  /** Hvor lista stod, og kortet man gikk inn på, så tilbake lander samme sted. */
  const listeplass = useRef<{ rulling: number; ide: string | null }>({ rulling: 0, ide: null })

  const hentListe = useCallback(async () => {
    try {
      setIdeer(await hentIdeer())
      setFeil(null)
    } catch {
      setFeil('Fikk ikke hentet idéene.')
    }
  }, [])

  // Hver åpning begynner på lista, med alt hentet på nytt.
  useEffect(() => {
    if (!apen) return
    setVisning(LISTE)
    listeplass.current = { rulling: 0, ide: null }
    void hentListe()
    void hentAlleProfiler().then(setProfiler, () => undefined)
    void hentSortering().then(setSortering, () => undefined)
  }, [apen, hentListe])

  const kropp = () => rot.current?.closest<HTMLElement>('.modallag__kropp') ?? null

  const gaaTil = (neste: Visning) => {
    if (visning.side === 'liste') listeplass.current.rulling = kropp()?.scrollTop ?? 0
    setSkjemastatus('uendret')
    setForlater(null)
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

  /**
   * Skjemaet med endringer spør før det forlates, enten det er tilbake eller
   * ut. Mens det lagrer, blir det stående til svaret har kommet.
   */
  const forlat = (handling: () => void) => {
    if (visning.side !== 'skjema' || skjemastatus === 'uendret') handling()
    else if (skjemastatus === 'ulagret') setForlater(() => handling)
  }

  const endreSortering = (neste: Sortering) => {
    setSortering(neste)
    void lagreSortering(neste).catch(() => undefined)
  }

  const apneIde = (id: string) => {
    listeplass.current.ide = id
    gaaTil({ side: 'ide', id })
  }

  const tilbake =
    visning.side === 'liste'
      ? undefined
      : { etikett: 'Tilbake til idéene', onTilbake: () => forlat(visning.side === 'skjema' && visning.ide ? () => gaaTil({ side: 'ide', id: visning.ide!.id }) : tilListe) }

  return (
    <Modallag
      apen={apen}
      tittel="Idéer"
      ikon="idea"
      tilbake={tilbake}
      onLukk={onLukk}
      vedLukking={() => {
        if (visning.side !== 'skjema' || skjemastatus === 'uendret') return true
        if (skjemastatus === 'ulagret') setForlater(() => onLukk)
        return false
      }}
      handling={
        visning.side === 'liste' ? (
          <Button className="knapp--kompakt" icon={<Ikon navn="plus" />} onClick={() => gaaTil({ side: 'skjema' })}>
            Ny idé
          </Button>
        ) : null
      }
    >
      <Idekilde profiler={profiler}>
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
            />
          )}
          {visning.side === 'ide' && (
            <Ideside
              id={visning.id}
              onEndre={(ide) => gaaTil({ side: 'skjema', ide })}
              onSlettet={() => {
                listeplass.current.ide = null
                tilListe()
              }}
            />
          )}
          {visning.side === 'skjema' && (
            <Ideskjema
              ide={visning.ide}
              kategori={visning.kategori}
              onStatus={setSkjemastatus}
              forlater={forlater !== null}
              onForkast={() => forlater?.()}
              onFortsett={() => setForlater(null)}
              onAvbryt={() => (visning.ide ? gaaTil({ side: 'ide', id: visning.ide.id }) : tilListe())}
              onLagret={(id) => {
                listeplass.current.ide = id
                gaaTil({ side: 'ide', id })
              }}
            />
          )}
        </div>
      </Idekilde>
    </Modallag>
  )
}
