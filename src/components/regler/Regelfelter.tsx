import { useId, useState } from 'react'
import { useAutoerstattFelt } from '../../autoerstatt/felt'
import { sammenlignFelter, type Felt } from '../../faginnhold/historikk'
import { Samtidighetskonflikt } from '../../faginnhold/lagring'
import { Button } from '../Button'
import { Tallfelt } from '../Tallfelt'
import { Endringsliste } from '../historikk/Historikkvindu'

/**
 * Det redigeringene av fortolkningsreglene har felles: feltene, lagringen med
 * samtidighetskontrollen og konflikten når noen andre har lagret i
 * mellomtiden. Intervallreglene (`Regelredigering`) og scenarioreglene
 * (`Scenarioredigering`) bruker de samme delene, så de oppfører seg likt.
 */

/* --- Lagringen og konflikten ---------------------------------------------- */

/**
 * Lagringen fra et redigeringsskjema. `onLagre` lagrer mot det brukeren
 * åpnet, eller mot `grunnlag` når hen har sett en nyere utgave og valgt å
 * lagre over den. Har noen andre lagret i mellomtiden, blir det en konflikt
 * der brukeren kan hente det nyeste og sammenligne; ingenting er skrevet
 * over, og skjemaet står som det var.
 */
export function useRegellagring<I, G>(
  onLagre: (innhold: I, grunnlag?: G) => Promise<void>,
  hentNyeste: () => Promise<G | null>,
) {
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const [konflikt, setKonflikt] = useState<{ nyeste: G | null } | null>(null)

  const lagre = async (innhold: I, grunnlag?: G) => {
    setLagrer(true)
    setFeil(null)
    try {
      await onLagre(innhold, grunnlag)
    } catch (e) {
      if (e instanceof Samtidighetskonflikt) setKonflikt({ nyeste: null })
      else setFeil((e as Error).message)
      setLagrer(false)
    }
  }

  const sammenlign = async () => setKonflikt({ nyeste: await hentNyeste() })

  return { feil, setFeil, lagrer, konflikt, lagre, sammenlign }
}

/**
 * Konflikten når noen andre har lagret reglene mens brukeren redigerte: hva
 * som er forskjellig, og valget mellom å forkaste sitt og å lagre over deres.
 * `sammenlign` gir revisjonen de lagret og feltene i deres og brukerens.
 */
export function Lagringskonflikt<G>({
  nyeste,
  sammenlign,
  onSammenlign,
  onLagreLikevel,
  onForkast,
  lagrer,
}: {
  nyeste: G | null
  sammenlign: (nyeste: G) => { revisjon: number; deres: Felt[]; mine: Felt[] }
  onSammenlign: () => Promise<void>
  onLagreLikevel: (grunnlag: G) => void
  onForkast: () => void
  lagrer: boolean
}) {
  const [feil, setFeil] = useState<string | null>(null)
  const forskjell = nyeste && sammenlign(nyeste)
  const endringer = forskjell ? sammenlignFelter(forskjell.deres, forskjell.mine) : []
  return (
    <div className="sidevarsel regelredigering__konflikt" role="alert">
      <p>
        Noen andre har lagret reglene mens du redigerte. Ingenting er skrevet over, og det du har gjort, står fortsatt
        her.
      </p>
      {nyeste && forskjell ? (
        <>
          <p>
            Dette er forskjellen mellom det de lagret (revisjon {forskjell.revisjon}) og ditt. Rødt er deres, grønt er
            ditt{endringer.every((e) => !e.endret) && ' — de er like'}.
          </p>
          <Endringsliste endringer={endringer} forste={false} />
          <div className="skjema__knapper">
            <Button variant="subtle" onClick={onForkast}>
              Forkast mine endringer
            </Button>
            <Button className="knapp--kompakt" disabled={lagrer} onClick={() => onLagreLikevel(nyeste)}>
              Lagre mine over deres
            </Button>
          </div>
        </>
      ) : (
        <div className="skjema__knapper">
          <Button variant="subtle" onClick={onForkast}>
            Forkast mine endringer
          </Button>
          <Button
            className="knapp--kompakt"
            onClick={() => onSammenlign().catch((e: Error) => setFeil(e.message))}
          >
            Sammenlign med deres
          </Button>
        </div>
      )}
      {feil && <p className="skjemafeil">{feil}</p>}
    </div>
  )
}

/* --- Feltene --------------------------------------------------------------- */

/** «1», «1 og 2», «1, 2 og 3». */
export function oppramsing(deler: string[]): string {
  if (deler.length < 2) return deler.join('')
  return `${deler.slice(0, -1).join(', ')} og ${deler.at(-1)}`
}

export function Valgfelt({
  merke,
  verdi,
  valg,
  onEndre,
  disabled,
}: {
  merke: string
  verdi: string
  valg: { verdi: string; tekst: string }[]
  onEndre: (verdi: string) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="felt">
      <label className="felt__merkelapp" htmlFor={id}>
        {merke}
      </label>
      <select id={id} className="felt__inndata" value={verdi} disabled={disabled} onChange={(e) => onEndre(e.target.value)}>
        {valg.map((v) => (
          <option key={v.verdi} value={v.verdi}>
            {v.tekst}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Tekstomrade({
  merke,
  verdi,
  hjelp,
  onEndre,
}: {
  merke: string
  verdi: string
  hjelp?: string
  onEndre: (verdi: string) => void
}) {
  // Høy nok til at en vanlig kommentar står helt uten å rulle.
  const rader = Math.max(3, Math.ceil(verdi.length / 85))
  const id = useId()
  const autoerstatt = useAutoerstattFelt<HTMLTextAreaElement>(onEndre)
  return (
    <div className="felt">
      <label className="felt__merkelapp" htmlFor={id}>
        {merke}
      </label>
      <textarea
        id={id}
        className="felt__inndata felt__inndata--flerlinje"
        rows={rader}
        value={verdi}
        aria-describedby={hjelp ? `${id}-hjelp` : undefined}
        {...autoerstatt}
      />
      {hjelp && (
        <span id={`${id}-hjelp`} className="felt__hjelp">
          {hjelp}
        </span>
      )}
    </div>
  )
}

export function Grensefelt({
  merke,
  hjelp,
  verdi,
  onEndre,
}: {
  merke: string
  hjelp: string
  verdi: string
  onEndre: (verdi: string) => void
}) {
  const id = useId()
  return (
    <div className="felt">
      <label className="felt__merkelapp" htmlFor={id}>
        {merke}
      </label>
      <Tallfelt
        id={id}
        className="felt__inndata regelredigering__tall"
        value={verdi}
        aria-describedby={`${id}-hjelp`}
        onChange={onEndre}
      />
      <span id={`${id}-hjelp`} className="felt__hjelp">
        {hjelp}
      </span>
    </div>
  )
}

export function Tekstfelt({
  merke,
  verdi,
  onEndre,
}: {
  merke: string
  verdi: string
  onEndre: (verdi: string) => void
}) {
  const id = useId()
  return (
    <div className="felt">
      <label className="felt__merkelapp" htmlFor={id}>
        {merke}
      </label>
      <input id={id} className="felt__inndata" type="text" value={verdi} onChange={(e) => onEndre(e.target.value)} />
    </div>
  )
}
