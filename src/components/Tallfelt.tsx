import { forwardRef, type InputHTMLAttributes } from 'react'
import { renskTall } from '../domain/tallfelt'

export interface TallfeltProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** Verdien slik den står i feltet. */
  value: string
  /** Kalles med den nye verdien når det som tastes er et tall. */
  onChange: (verdi: string) => void
}

/**
 * Feltet for en målt konsentrasjon.
 *
 * Feltet tar tall og bare tall: bokstaver, mellomrom og fortegn slipper ikke
 * inn, verken tastet eller limt inn ({@link renskTall}). Det gjør to ting for
 * flyten. Verdien som står i feltet er alltid et tall, så en konsentrasjon
 * ikke kan bli lest som «mangler» fordi et tegn har sneket seg med. Og
 * mellomrom er ledig til å bekrefte, slik `Enter` gjør ellers i appen —
 * `src/domain/tastatur.ts` kjenner feltet igjen på `data-tallfelt`.
 *
 * Feltet er med vilje ikke `type="number"`: da avviser nettleseren komma som
 * desimaltegn i de fleste språkinnstillinger, og «0,5» ville blitt til «05».
 * Her godtas både komma og punktum, som ellers i appen.
 */
export const Tallfelt = forwardRef<HTMLInputElement, TallfeltProps>(function Tallfelt(
  { value, onChange, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={className ? `thc-input ${className}` : 'thc-input'}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      data-tallfelt="ja"
      value={value}
      onChange={(e) => {
        const rensket = renskTall(e.target.value)
        // Avvist innskriving: verdien blir stående som den var. React setter
        // feltet tilbake av seg selv når tilstanden ikke endrer seg.
        if (rensket !== null) onChange(rensket)
      }}
      {...rest}
    />
  )
})
