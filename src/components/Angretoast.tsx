import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Ikon } from './ikon/Ikon'
import '../styles/angretoast.css'

/** Hvor lenge det går an å angre. */
export const ANGREFRIST = 10_000

/**
 * Noe som alt er gjort, og som kan gjøres om: meldingen som står, og det som
 * snur det. `nokkel` er ny for hver handling, så fristen begynner på nytt.
 */
export interface Angring {
  nokkel: number
  melding: string
  angre: () => Promise<void>
}

/**
 * En melding nederst i et lag om det som nettopp ble gjort, med «Angre» i ti
 * sekunder. Streken under krymper mens tiden går. Handlingen er alt lagret;
 * «Angre» snur den. Når tiden er ute, eller den er angret, forsvinner meldingen.
 */
export function Angretoast({ angring, onFerdig }: { angring: Angring; onFerdig: () => void }) {
  const [angrer, setAngrer] = useState(false)
  /** Hvor mange ganger angringen har feilet; fristen og streken begynner på nytt for hver. */
  const [feil, setFeil] = useState(0)
  const ferdig = useRef(onFerdig)
  ferdig.current = onFerdig

  useEffect(() => {
    setAngrer(false)
    setFeil(0)
  }, [angring.nokkel])

  // Fristen står stille mens angringen pågår, så meldingen blir stående til
  // svaret er kommet. Feiler den, begynner fristen på nytt, så det går an å
  // prøve igjen.
  useEffect(() => {
    if (angrer) return
    const frist = window.setTimeout(() => ferdig.current(), ANGREFRIST)
    return () => window.clearTimeout(frist)
  }, [angring.nokkel, angrer])

  const angre = async () => {
    setAngrer(true)
    try {
      await angring.angre()
      ferdig.current()
    } catch {
      setFeil((n) => n + 1)
      setAngrer(false)
    }
  }

  return (
    <div className="angretoast" role="status" style={{ '--angrefrist': `${ANGREFRIST}ms` } as CSSProperties}>
      <span className="angretoast__melding">{feil > 0 ? 'Fikk ikke angret. Prøv igjen.' : angring.melding}</span>
      <button type="button" className="angretoast__knapp" disabled={angrer} onClick={() => void angre()}>
        <Ikon navn="reset" storrelse="ui" />
        {angrer ? 'Angrer …' : 'Angre'}
      </button>
      <span key={feil} className="angretoast__tid" data-venter={angrer || undefined} aria-hidden="true" />
    </div>
  )
}
