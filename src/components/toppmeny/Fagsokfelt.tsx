import { forwardRef, useEffect, useId, useImperativeHandle, useRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { erSokesnarvei } from '../../hooks/useKeyboard'
import { Ikon } from '../ikon/Ikon'
import { Shortcut } from '../Shortcut'

/** Snarveien som henter fagsøket fram, som den står i merket i feltet. */
export const FAGSOK_SNARVEI = 'Ctrl + K'

/**
 * Ctrl + K, eller Cmd + K på macOS. Et redigeringsfelt (riktekst) og et lag
 * over appen går foran: der kan kombinasjonen ha en egen jobb.
 */
export function erFagsokSnarvei(event: KeyboardEvent): boolean {
  return erSokesnarvei(event, 'k')
}

export interface FagsokfeltProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'children'> {
  verdi: string
  onEndre: (verdi: string) => void
  /** Rullegardinen med treff, som legges rett under feltet. */
  children?: ReactNode
}

/**
 * Feltet for globalt fagsøk i toppmenyen. Det søker i stoffmonografene, og er
 * noe annet enn analyttsøket som driver fortolkningen.
 *
 * Dette er skallet: feltet, plassen og snarveien. Søket selv og rullegardinen
 * kobles til utenfra (se `docs/designsystem.md`).
 */
export const Fagsokfelt = forwardRef<HTMLInputElement | null, FagsokfeltProps>(function Fagsokfelt(
  { verdi, onEndre, children, placeholder = 'Søk i fagstoff', ...rest },
  ref,
) {
  const id = useId()
  const felt = useRef<HTMLInputElement>(null)
  useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(ref, () => felt.current, [])

  useEffect(() => {
    const paaTast = (event: KeyboardEvent) => {
      if (!erFagsokSnarvei(event)) return
      // Nettleseren har sin egen Ctrl + K (adresselinja); her er det søket.
      event.preventDefault()
      felt.current?.focus()
      felt.current?.select()
    }
    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [])

  return (
    <div className="fagsok" role="search">
      <label className="fagsok__felt" htmlFor={id} data-ih="">
        <Ikon navn="search" storrelse="ui" />
        <span id={`${id}-navn`} className="kun-skjermleser">
          Søk i fagstoffet
        </span>
        <input
          ref={felt}
          id={id}
          aria-labelledby={`${id}-navn`}
          type="search"
          className="fagsok__input"
          placeholder={placeholder}
          autoComplete="off"
          aria-keyshortcuts="Control+K Meta+K"
          value={verdi}
          onChange={(e) => onEndre(e.target.value)}
          {...rest}
        />
        <Shortcut always>{FAGSOK_SNARVEI}</Shortcut>
      </label>
      {children}
    </div>
  )
})
