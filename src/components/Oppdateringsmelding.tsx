import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useJevnligSjekk } from '../hooks/useJevnligSjekk'
import { oppdaterOgTaVare } from '../oppdatering/bevaring'
import { hentUtlagtBygg, nyVersjon, type Byggopplysninger } from '../oppdatering/versjon'
import { Ikon } from './ikon/Ikon'
import '../styles/oppdatering.css'

/** Hvor ofte appen spør om en ny versjon er lagt ut, mens fanen er synlig. */
export const SJEKK_VERSJON_HVER = 60_000

/**
 * Det øverste laget som står åpent: et modalt lag ligger over alt annet og
 * gjør resten av siden utilgjengelig, så meldingen må stå i det for å synes og
 * kunne trykkes på. Ellers står den i dokumentet.
 */
function useOversteLag(aktiv: boolean): HTMLElement | null {
  const [lag, setLag] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!aktiv) return
    const finn = () => {
      const apne = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
      setLag(apne[apne.length - 1] ?? document.body)
    }
    finn()
    const vakt = new MutationObserver(finn)
    vakt.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
    return () => vakt.disconnect()
  }, [aktiv])
  return aktiv ? lag : null
}

/**
 * Meldingen om at en ny versjon av appen er lagt ut, med «Oppdater nå».
 *
 * Appen spør jevnlig, og når fanen får fokus igjen, om versjonen som er lagt
 * ut, er en annen enn den som kjører (`src/oppdatering/versjon.ts`). En stille
 * designjustering gir ingen melding. Den spør også med én gang en del av appen
 * ikke lar seg laste, som skjer når filene til det gamle bygget er borte; da
 * holder det at bygget er et annet.
 *
 * Meldingen forsvinner ikke av seg selv og kan ikke lukkes: den gamle
 * versjonen skal ikke brukes videre. «Oppdater nå» tar vare på det brukeren
 * holder på med — vinduer som står åpne, skjemaer som er halvveis skrevet,
 * valgene i fortolkningen og hvor langt ned siden er rullet — og laster siden
 * på nytt med den nye versjonen, der det kommer tilbake (`src/oppdatering/`).
 *
 * Står den i appens rot, virker den også på innloggingssiden.
 */
export function Oppdateringsmelding({
  aktiv = !import.meta.env.DEV,
  hent = hentUtlagtBygg,
  oppdater = oppdaterOgTaVare,
}: {
  /** Av i utviklingsserveren, som ikke legger ut noen versjonsfil. */
  aktiv?: boolean
  hent?: () => Promise<Byggopplysninger | null>
  oppdater?: () => void
}) {
  const [ny, setNy] = useState<Byggopplysninger | null>(null)
  const [oppdaterer, setOppdaterer] = useState(false)

  const spor = useCallback(
    (alleBygg: boolean) => {
      if (!aktiv) return
      void hent().then((utlagt) => {
        const funnet = nyVersjon(utlagt, undefined, { alleBygg })
        if (funnet) setNy(funnet)
      })
    },
    [aktiv, hent],
  )
  const sjekk = useCallback(() => spor(false), [spor])
  useJevnligSjekk(sjekk, SJEKK_VERSJON_HVER)

  // En del av appen som ikke lar seg laste, er ofte en fil fra et bygg som er
  // byttet ut. Da spørres det med én gang, i stedet for ved neste runde, og
  // et hvilket som helst annet bygg er grunn nok, også en stille endring.
  useEffect(() => {
    const lastefeil = () => spor(true)
    window.addEventListener('vite:preloadError', lastefeil)
    return () => window.removeEventListener('vite:preloadError', lastefeil)
  }, [spor])

  const lag = useOversteLag(ny !== null)
  if (!ny || !lag) return null

  return createPortal(
    <div className="oppdateringsmelding" role="alert">
      <p className="oppdateringsmelding__tekst">
        <strong>En ny versjon av OUSFAR er klar{ny.versjon ? ` (${ny.versjon})` : ''}.</strong> Oppdater for å ta den i
        bruk. Det du holder på med, blir stående.
      </p>
      <button
        type="button"
        className="oppdateringsmelding__knapp"
        disabled={oppdaterer}
        onClick={() => {
          setOppdaterer(true)
          oppdater()
        }}
      >
        <Ikon navn="reset" storrelse="ui" />
        {oppdaterer ? 'Oppdaterer …' : 'Oppdater nå'}
      </button>
    </div>,
    lag,
  )
}
