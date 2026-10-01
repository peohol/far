/**
 * Autoerstatt i vanlige tekstfelt (`textarea` og `input`), med de samme
 * reglene og den samme angringen som i rikteksteditoren (`editor.ts`).
 */
import { useCallback, type ChangeEvent, type KeyboardEvent } from 'react'
import { useAutoerstattregler } from './Autoerstattkilde'
import { finnRegel, MAKS_LENGDE, type Autoerstattregel, type Erstatning } from './regler'

type Tekstfelt = HTMLTextAreaElement | HTMLInputElement

/** Den siste erstatningen i hvert felt, med verdien rett etter, så den kan angres. */
const siste = new WeakMap<Tekstfelt, Erstatning & { verdi: string }>()

/**
 * Bytter ut det som står foran markøren når det nettopp skrevne tegnet
 * fullfører en regel. Gjøres i feltet selv, så markøren blir stående.
 * Gir sant når noe ble byttet.
 */
export function erstattIFelt(felt: Tekstfelt, inndatatype: string | undefined, regler: readonly Autoerstattregel[]): boolean {
  siste.delete(felt)
  if (inndatatype !== 'insertText' || felt.selectionStart === null || felt.selectionStart !== felt.selectionEnd) return false
  const markor = felt.selectionStart
  const regel = finnRegel(felt.value.slice(Math.max(0, markor - MAKS_LENGDE), markor), regler)
  if (!regel) return false
  const fra = markor - regel.finn.length
  felt.setRangeText(regel.erstatt, fra, markor, 'end')
  siste.set(felt, { fra, til: fra + regel.erstatt.length, original: regel.finn, verdi: felt.value })
  return true
}

/** Setter tilbake det som ble skrevet, når tilbaketasten trykkes rett etter en erstatning. */
export function angreIFelt(felt: Tekstfelt): boolean {
  const sist = siste.get(felt)
  siste.delete(felt)
  if (!sist || felt.value !== sist.verdi || felt.selectionStart !== sist.til || felt.selectionEnd !== sist.til) return false
  felt.setRangeText(sist.original, sist.fra, sist.til, 'end')
  return true
}

/**
 * `onChange` og `onKeyDown` for et tekstfelt med autoerstatt. `onEndre` får
 * verdien etter en eventuell erstatning.
 */
export function useAutoerstattFelt<T extends Tekstfelt>(onEndre: (verdi: string) => void) {
  const regler = useAutoerstattregler()
  const onChange = useCallback(
    (e: ChangeEvent<T>) => {
      erstattIFelt(e.target, (e.nativeEvent as InputEvent).inputType, regler())
      onEndre(e.target.value)
    },
    [onEndre, regler],
  )
  const onKeyDown = useCallback(
    (e: KeyboardEvent<T>) => {
      if (e.key !== 'Backspace' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (!angreIFelt(e.currentTarget)) return
      e.preventDefault()
      onEndre(e.currentTarget.value)
    },
    [onEndre],
  )
  return { onChange, onKeyDown }
}
