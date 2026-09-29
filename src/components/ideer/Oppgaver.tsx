import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Profil } from '@delt/profil'
import { hentAlleProfiler } from '../../auth/api'
import { hentOppgaver } from '../../ideer/api'
import type { Oppgave } from '../../ideer/oppgaver'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Modallag } from '../Modallag'
import { Idekilde } from './Idekontekst'
import { veksleSkuff } from './Ideskuff'
import { Oppgaveliste } from './Oppgaveliste'
import { Oppgaveside } from './Oppgaveside'
import { useForlatvakt } from './useForlatvakt'
import '../../styles/ideer.css'

/**
 * Planlagte oppgaver: idéene en administrator har overført fra Idéer, under
 * statusene «Ikke påbegynt», «Påbegynt», «Klar til implementering» og
 * «Håndteres nå av en agent», og de utførte i en skuff nederst.
 *
 * Alle kan lese. Bare en administrator arbeider med oppgavene: skriver
 * prompten en språkmodell skal utføre oppgaven etter, merker den klar, eller
 * flytter den tilbake til idéene. Claude tar oppgaven når arbeidet begynner,
 * og merker den utført når det er gjort (se `.claude/skills/utfor-oppgaver`).
 */
type Visning = { side: 'liste' } | { side: 'oppgave'; id: string }

const LISTE: Visning = { side: 'liste' }

export function Oppgaver({
  apen,
  oppgave,
  onLukk,
  onIdeer,
}: {
  apen: boolean
  /** Oppgaven laget åpnes på, som fra et kort i Idéer. Ellers lista. */
  oppgave?: string
  onLukk: () => void
  /** Til Idéer. */
  onIdeer: () => void
}) {
  const [visning, setVisning] = useState<Visning>(LISTE)
  const [oppgaver, setOppgaver] = useState<Oppgave[]>([])
  const [profiler, setProfiler] = useState<Profil[]>([])
  const [feil, setFeil] = useState<string | null>(null)
  const [apneSkuffer, setApneSkuffer] = useState<ReadonlySet<string>>(new Set())
  const vakt = useForlatvakt()
  const { nullstill } = vakt
  /** Teller åpningene, så hver åpning begynner med sidene montert på nytt. */
  const [apning, setApning] = useState(0)
  const rot = useRef<HTMLDivElement>(null)
  /** Kortet man gikk inn på, så tilbake lander på det. */
  const fra = useRef<string | null>(null)

  const hentListe = useCallback(async () => {
    try {
      setOppgaver(await hentOppgaver())
      setFeil(null)
    } catch {
      setFeil('Fikk ikke hentet oppgavene.')
    }
  }, [])

  // Hver åpning begynner på lista, eller på oppgaven laget ble åpnet på, uten
  // endringer som ble forkastet sist.
  useEffect(() => {
    if (!apen) return
    nullstill()
    setApning((n) => n + 1)
    fra.current = oppgave ?? null
    setVisning(oppgave ? { side: 'oppgave', id: oppgave } : LISTE)
    setApneSkuffer(new Set())
    void hentListe()
    void hentAlleProfiler().then(setProfiler, () => undefined)
  }, [apen, oppgave, hentListe, nullstill])

  const gaaTil = (neste: Visning) => {
    vakt.nullstill()
    setVisning(neste)
  }

  const tilListe = () => {
    void hentListe()
    gaaTil(LISTE)
  }

  // En ny side begynner øverst; lista med fokus på kortet man kom fra, i skuffen om det står der.
  useLayoutEffect(() => {
    const boks = rot.current?.closest<HTMLElement>('.modallag__kropp')
    if (boks) boks.scrollTop = 0
    if (visning.side !== 'liste' || !fra.current) return
    const kort = [...(rot.current?.querySelectorAll<HTMLElement>('[data-oppgave]') ?? [])].find((el) => el.dataset.oppgave === fra.current)
    kort?.focus({ preventScroll: true })
    kort?.scrollIntoView({ block: 'nearest' })
  }, [visning, oppgaver])

  const apneOppgave = (id: string) => {
    fra.current = id
    gaaTil({ side: 'oppgave', id })
  }

  return (
    <Modallag
      apen={apen}
      tittel="Planlagte oppgaver"
      ikon="oppgaver"
      tilbake={visning.side === 'liste' ? undefined : { etikett: 'Tilbake til oppgavene', onTilbake: () => vakt.forlat(tilListe) }}
      onLukk={onLukk}
      vedLukking={vakt.vedLukking(onLukk)}
      handling={
        visning.side === 'liste' ? (
          <Button variant="subtle" className="knapp--kompakt" icon={<Ikon navn="idea" />} onClick={onIdeer}>
            Idéer
          </Button>
        ) : null
      }
    >
      <Idekilde profiler={profiler}>
        <div ref={rot} className="idevindu" key={`${apning}:${visning.side === 'oppgave' ? visning.id : visning.side}`}>
          {feil && visning.side === 'liste' && (
            <p className="skjemafeil" role="alert">
              {feil}
            </p>
          )}
          {visning.side === 'liste' && (
            <Oppgaveliste
              oppgaver={oppgaver}
              onApne={apneOppgave}
              apneSkuffer={apneSkuffer}
              onVeksleSkuff={(navn) => setApneSkuffer((apne) => veksleSkuff(apne, navn))}
            />
          )}
          {visning.side === 'oppgave' && (
            <Oppgaveside
              id={visning.id}
              onStatus={vakt.setStatus}
              forlater={vakt.forlater}
              onForkast={vakt.forkast}
              onFortsett={vakt.fortsett}
              onFlyttetTilbake={() => {
                fra.current = null
                tilListe()
              }}
              onEndret={hentListe}
            />
          )}
        </div>
      </Idekilde>
    </Modallag>
  )
}
