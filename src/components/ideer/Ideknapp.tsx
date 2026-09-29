import { useCallback, useEffect, useState } from 'react'
import { hentIdeerMedNytt } from '../../ideer/api'
import { Ikonknapp } from '../Ikonknapp'
import { Ideer } from './Ideer'

/** Hvor ofte appen ser etter nye kommentarer på idéene mens den står åpen. */
const NYTT_HVER = 5 * 60_000

/**
 * Idéene, fra en egen knapp i toppmenyen. Har idéene kommentarer brukeren
 * ikke har sett, står det en prikk på knappen, og antallet i navnet dens.
 */
export function Ideknapp() {
  const [apen, setApen] = useState(false)
  /** Antall idéer med kommentarer brukeren ikke har sett. Sjekkes når appen og fanen åpnes, etter vinduet og jevnlig. */
  const [medNytt, setMedNytt] = useState(0)
  const sjekkNytt = useCallback(() => {
    hentIdeerMedNytt().then(setMedNytt, () => undefined)
  }, [])
  useEffect(() => {
    sjekkNytt()
    // Også mens appen står åpen: når fanen får fokus igjen, og jevnlig mens den er synlig.
    const naarSynlig = () => {
      if (document.visibilityState === 'visible') sjekkNytt()
    }
    const jevnlig = window.setInterval(naarSynlig, NYTT_HVER)
    window.addEventListener('focus', naarSynlig)
    document.addEventListener('visibilitychange', naarSynlig)
    return () => {
      window.clearInterval(jevnlig)
      window.removeEventListener('focus', naarSynlig)
      document.removeEventListener('visibilitychange', naarSynlig)
    }
  }, [sjekkNytt])
  const nytt = medNytt > 0 ? `nye kommentarer på ${medNytt === 1 ? 'én idé' : `${medNytt} idéer`}` : undefined

  // Fast identitet: `Modallag` kobler den til lukkehendelsen på dialogen.
  const lukk = useCallback(() => {
    setApen(false)
    sjekkNytt()
  }, [sjekkNytt])

  return (
    <div className="toppmeny__merket">
      <Ikonknapp
        ikon="idea"
        etikett={`Idéer${nytt ? ` (${nytt})` : ''}`}
        variant="stille"
        storrelse="liten"
        aria-haspopup="dialog"
        onClick={() => setApen(true)}
      />
      {nytt && <span className="nyprikk toppmeny__prikk" aria-hidden="true" />}
      <Ideer apen={apen} onLukk={lukk} />
    </div>
  )
}
