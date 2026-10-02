import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useSkjuling } from '../../hooks/useSkjuling'
import { Ikon } from '../ikon/Ikon'
import type { Ikonnavn } from '../ikon/register'
import { Ikonknapp, type IkonknappProps } from '../Ikonknapp'

export interface NedtrekksmenyProps {
  /** Knappen i toppmenyen som åpner menyen. */
  knapp: Omit<IkonknappProps, 'onClick' | 'aria-expanded' | 'aria-controls'>
  /** Navnet på menyen for skjermlesere, og hva den heter som lag (`data-lag`). */
  etikett: string
  lag: string
  className?: string
  /** Kalles hver gang menyen åpnes. */
  onApne?: () => void
  /** Noe som står ved knappen, som prikken for noe nytt. */
  ved?: ReactNode
  /**
   * Innholdet tegnes først når menyen åpnes. For menyer som står mange
   * steder på en side, som ved hvert stoff i redigeringen av stoffregisteret.
   */
  lat?: boolean
  /** Innholdet. `lukk` lukker menyen og gir fokus tilbake til knappen. */
  children: (lukk: () => void) => ReactNode
}

/**
 * En nedtrekksmeny fra en rund knapp i toppmenyen: kontoen og adminmenyen.
 *
 * Menyen er et lag over appen, som sidemenyen: `data-lag` holder appens egne
 * taster i ro mens den står åpen. Escape, et klikk utenfor eller fokus som
 * går ut av den lukker den, og fokus går tilbake til knappen.
 */
export function Nedtrekksmeny({ knapp: knappProps, etikett, lag, className, onApne, ved, lat = false, children }: NedtrekksmenyProps) {
  const [apen, setApen] = useState(false)
  const rot = useRef<HTMLDivElement>(null)
  const knapp = useRef<HTMLButtonElement>(null)
  const meny = useRef<HTMLDivElement>(null)
  const menyId = useId()

  const lukk = useCallback((tilbake = true) => {
    setApen(false)
    if (tilbake) knapp.current?.focus()
  }, [])
  const lukkMedFokus = useCallback(() => lukk(), [lukk])

  // Fokus inn i menyen når den åpnes, på det første valget.
  useEffect(() => {
    if (apen) meny.current?.querySelector<HTMLElement>('button')?.focus()
  }, [apen])

  useEffect(() => {
    if (!apen) return
    const paaTast = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      lukk()
    }
    // Et trykk utenfor lukker uten å flytte fokus: det går dit brukeren trykket.
    const paaTrykk = (event: PointerEvent) => {
      const mal = event.target as Node
      if (meny.current?.contains(mal) || knapp.current?.contains(mal)) return
      lukk(false)
    }
    window.addEventListener('keydown', paaTast)
    window.addEventListener('pointerdown', paaTrykk)
    return () => {
      window.removeEventListener('keydown', paaTast)
      window.removeEventListener('pointerdown', paaTrykk)
    }
  }, [apen, lukk])

  return (
    <div
      ref={rot}
      className={['nedtrekk', className].filter(Boolean).join(' ')}
      onBlur={(event) => {
        // Fokus som går ut av menyen og knappen, med tabulator fram eller
        // tilbake, lukker menyen, men får gå dit det skulle.
        if (apen && !rot.current?.contains(event.relatedTarget as Node | null)) lukk(false)
      }}
    >
      <Ikonknapp
        ref={knapp}
        {...knappProps}
        aria-expanded={apen}
        aria-controls={menyId}
        onClick={() => {
          if (apen) return lukk()
          setApen(true)
          onApne?.()
        }}
      />
      {ved}

      <div
        ref={meny}
        id={menyId}
        className="nedtrekk__panel"
        role="group"
        aria-label={etikett}
        hidden={!apen}
        // Et trykk på noe som ikke tar fokus i panelet, som navnet, holder
        // fokus i menyen i stedet for å slippe det ut av den.
        tabIndex={-1}
        {...(apen && { 'data-lag': lag })}
      >
        {(apen || !lat) && children(lukkMedFokus)}
      </div>
    </div>
  )
}

export interface MenyvalgProps {
  ikon: Ikonnavn
  tekst: string
  /** En kort merknad til høyre, som «Admin». */
  hint?: string
  /** Noe nytt venter bak valget, og det får en prikk med denne teksten. */
  nytt?: string
  onClick: () => void
  /** Valget folder ut en skuff under seg (se `Menyskuff`). */
  utvidet?: boolean
  kontrollerer?: string
}

/** Ett valg i en nedtrekksmeny: ikon, tekst og eventuelt et hint eller en pil. */
export function Menyvalg({ ikon, tekst, hint, nytt, onClick, utvidet, kontrollerer }: MenyvalgProps) {
  const skuff = utvidet !== undefined
  return (
    <button
      type="button"
      className="nedtrekk__valgknapp"
      data-ih=""
      onClick={onClick}
      {...(skuff && { 'aria-expanded': utvidet, 'aria-controls': kontrollerer })}
    >
      <Ikon navn={ikon} storrelse="ui" />
      <span className="nedtrekk__tekst">{tekst}</span>
      {nytt && <span className="nyprikk" role="img" aria-label={nytt} />}
      {hint && <span className="nedtrekk__hint">{hint}</span>}
      {skuff && (
        <span className="nedtrekk__pil" aria-hidden="true">
          <Ikon navn="chev" storrelse={11} />
        </span>
      )}
    </button>
  )
}

export interface MenyskuffProps {
  ikon: Ikonnavn
  tekst: string
  apen: boolean
  onVeksle: () => void
  children: ReactNode
}

/**
 * Et valg i en nedtrekksmeny som folder ut en skuff med flere valg under seg,
 * som «Preferanser» i kontomenyen. Skuffen glir opp og igjen som skuffene
 * ellers i appen (`useSkjuling`), og lukket innhold nås ikke med tabulator.
 */
export function Menyskuff({ ikon, tekst, apen, onVeksle, children }: MenyskuffProps) {
  const kropp = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const id = useId()
  useSkjuling(kropp, inner, apen)
  return (
    <li className="nedtrekk__skuff" data-apen={apen || undefined}>
      <Menyvalg ikon={ikon} tekst={tekst} utvidet={apen} kontrollerer={id} onClick={onVeksle} />
      <div ref={kropp} className="nedtrekk__skuffkropp">
        <div ref={inner} id={id} className="nedtrekk__skuffinner">
          {children}
        </div>
      </div>
    </li>
  )
}
