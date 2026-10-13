import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useJevnligSjekk } from '../hooks/useJevnligSjekk'
import { oppdaterOgTaVare } from '../oppdatering/bevaring'
import { berortAvNyVersjon, gjeldendeSide, lyttEtterSide, vedRoligOyeblikk, ventPaaRo } from '../oppdatering/sider'
import { hentUtlagtBygg, KJORER, nyVersjon, type Byggopplysninger } from '../oppdatering/versjon'
import { Ikon } from './ikon/Ikon'
import '../styles/oppdatering.css'

/** Hvor ofte appen spør om en ny versjon er lagt ut, mens fanen er synlig. */
export const SJEKK_VERSJON_HVER = 60_000

/**
 * Hvor lenge brukeren må la appen være etter et rolig øyeblikk før den nye
 * versjonen tas i bruk i stillhet. Er hen i gang igjen før det, venter appen
 * til neste gang, så omlastingen ikke tar tastetrykk.
 */
export const STILLE_ETTER = 1_000

/** Oppdaterer i stillhet: det brukeren holdt på med, kommer tilbake, men ikke rulleplassen på siden hen forlot. */
const oppdaterIStillhet = () => oppdaterOgTaVare(undefined, { rulling: false })

/** En ny versjon som er funnet, og om den ble funnet fordi en del av appen ikke lot seg laste. */
interface Funnet {
  bygg: Byggopplysninger
  lastefeil: boolean
}

/**
 * Det øverste laget som står åpent: et modalt lag ligger over alt annet og
 * gjør resten av siden utilgjengelig, så meldingen må stå i det for å synes og
 * kunne trykkes på. Ellers står den i dokumentet.
 */
export function useOversteLag(aktiv: boolean): HTMLElement | null {
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
 * Meldingen står bare når den nye versjonen berører siden brukeren er på,
 * eller vinduet som står åpent over den (`src/oppdatering/sider.ts`), eller
 * når en del av appen ikke lar seg laste. Ellers tas versjonen i bruk i
 * stillhet i neste rolige øyeblikk — når brukeren går til en annen side eller
 * nullstiller fortolkningen — så sant hen ikke er i gang med noe igjen med én
 * gang etterpå, og ikke noe vindu står åpent. Går brukeren til en side den
 * berører, og er i gang før versjonen er tatt i bruk, kommer meldingen.
 *
 * Meldingen forsvinner ikke av seg selv og kan ikke lukkes: den gamle
 * versjonen skal ikke brukes videre på en side den berører. «Oppdater nå»
 * tar vare på det brukeren holder på med — vinduer som står åpne, skjemaer som
 * er halvveis skrevet, valgene i fortolkningen og hvor langt ned siden er
 * rullet — og laster siden på nytt med den nye versjonen, der det kommer
 * tilbake (`src/oppdatering/`). En oppdatering i stillhet tar vare på det
 * samme, bortsett fra rullingen.
 *
 * Står den i appens rot, virker den også på innloggingssiden.
 */
export function Oppdateringsmelding({
  aktiv = !import.meta.env.DEV,
  hent = hentUtlagtBygg,
  oppdater = oppdaterOgTaVare,
  oppdaterStille = oppdaterIStillhet,
  stilleEtter = STILLE_ETTER,
}: {
  /** Av i utviklingsserveren, som ikke legger ut noen versjonsfil. */
  aktiv?: boolean
  hent?: () => Promise<Byggopplysninger | null>
  oppdater?: () => void
  oppdaterStille?: () => void
  stilleEtter?: number
}) {
  const [ny, setNy] = useState<Funnet | null>(null)
  const [oppdaterer, setOppdaterer] = useState(false)
  /** Et rolig øyeblikk er nettopp kommet, og appen venter på å oppdatere i stillhet. */
  const [venter, setVenter] = useState(false)
  const side = useSyncExternalStore(lyttEtterSide, gjeldendeSide)

  const spor = useCallback(
    (alleBygg: boolean) => {
      if (!aktiv) return
      void hent().then((utlagt) => {
        const bygg = nyVersjon(utlagt, undefined, { alleBygg })
        if (!bygg) return
        setNy((forrige) => {
          const lastefeil = alleBygg || (forrige?.lastefeil ?? false)
          return forrige?.bygg.bygg === bygg.bygg && forrige.lastefeil === lastefeil ? forrige : { bygg, lastefeil }
        })
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

  // Når en ny versjon er funnet, tas den i bruk i stillhet i hvert rolige
  // øyeblikk der brukeren ikke er i gang igjen med én gang, og ikke noe vindu
  // står åpent. Det gjelder også når meldingen står.
  const harNy = ny !== null
  useEffect(() => {
    if (!harNy) return
    let avbryt: (() => void) | null = null
    const stopp = vedRoligOyeblikk(() => {
      avbryt?.()
      setVenter(true)
      avbryt = ventPaaRo(
        stilleEtter,
        () => {
          avbryt = null
          if (document.querySelector('dialog[open]')) setVenter(false)
          else oppdaterStille()
        },
        () => {
          avbryt = null
          setVenter(false)
        },
      )
    })
    return () => {
      stopp()
      avbryt?.()
    }
  }, [harNy, oppdaterStille, stilleEtter])

  const lag = useOversteLag(harNy)
  if (!ny || !lag) return null
  const vinduApent = lag !== document.body
  const berort = ny.lastefeil || berortAvNyVersjon(ny.bygg.endringer, KJORER.oppdatering, side, vinduApent)
  // Har brukeren trykket «Oppdater nå», blir meldingen stående til siden lastes.
  if (!oppdaterer && (venter || !berort)) return null

  return createPortal(
    <div className="oppdateringsmelding" role="alert">
      <p className="oppdateringsmelding__tekst">
        <strong>En ny versjon av OUSFAR er klar{ny.bygg.versjon ? ` (${ny.bygg.versjon})` : ''}.</strong> Oppdater
        for å ta den i bruk. Det du holder på med, blir stående.
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
