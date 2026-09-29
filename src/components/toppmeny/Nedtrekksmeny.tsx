import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
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
export function Nedtrekksmeny({ knapp: knappProps, etikett, lag, className, onApne, ved, children }: NedtrekksmenyProps) {
  const [apen, setApen] = useState(false)
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
    <div className={['nedtrekk', className].filter(Boolean).join(' ')}>
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
        {...(apen && { 'data-lag': lag })}
        onBlur={(event) => {
          // Tabulator ut av menyen lukker den, men lar fokus gå videre.
          if (apen && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
            if (event.relatedTarget !== knapp.current) lukk(false)
          }
        }}
      >
        {children(lukkMedFokus)}
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
