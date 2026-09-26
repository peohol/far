import { useCallback, useRef, useState } from 'react'
import type { Sokeindeks } from '../faginnhold/sok'

/** Indeksen fagsøket søker i, med feilen fra legemiddeldataene når de manglet. */
export type Lestsokeindeks = Sokeindeks & { festfeil?: string }

/** Henter indeksen. `delvis` får indekser over det som alt er lest, før den endelige. */
export type Sokeindekshenter = (delvis: (indeks: Lestsokeindeks) => void) => Promise<Lestsokeindeks>

export type Sokeindekstilstand =
  | { status: 'uhentet' }
  | { status: 'laster' }
  /** `henterMer` mens indeksen bare har en del av fagstoffet, og resten er på vei. */
  | { status: 'klar'; indeks: Lestsokeindeks; henterMer?: boolean }
  | { status: 'feil'; melding: string }

/**
 * Indeksen over alt publisert fagstoff, hentet første gang noen trenger den:
 * når fagsøket får fokus, søkesiden åpnes, eller appen har tid til overs etter
 * at den er åpnet (`krev` fra `useNaarLedig`). Fortolkningen venter aldri på den.
 *
 * Mens den hentes, kan det søkes i det som alt er lest (`henterMer`). En
 * utdatert indeks som hentes på nytt, blir derimot stående hel til den nye er
 * ferdig; de delvise indeksene hoppes da over.
 *
 * `krev` henter den når den mangler, etter en feil, eller når `foreld` har
 * sagt at den kan være utdatert (en administrator kan ha publisert noe). En
 * utdatert indeks blir stående til den nye er hentet, så søket ikke blinker;
 * en feil da beholder den gamle. `foreld(true)` henter den nye med én gang,
 * for det som alt viser indeksen og ikke ber om den igjen (søkesiden).
 */
export function useSokeindeks(hent: Sokeindekshenter): {
  tilstand: Sokeindekstilstand
  krev: () => void
  foreld: (hentNaa?: boolean) => void
} {
  const [tilstand, setTilstand] = useState<Sokeindekstilstand>({ status: 'uhentet' })
  const status = useRef<Sokeindekstilstand['status']>('uhentet')
  const utdatert = useRef(false)
  // Bare det siste svaret teller, om to hentinger skulle krysse hverandre.
  const siste = useRef(0)

  const krev = useCallback(() => {
    if (status.current === 'laster' || (status.current === 'klar' && !utdatert.current)) return
    const denne = (siste.current += 1)
    const hadde = status.current === 'klar'
    status.current = 'laster'
    utdatert.current = false
    if (!hadde) setTilstand({ status: 'laster' })
    const delvis = (indeks: Lestsokeindeks) => {
      if (denne === siste.current && !hadde) setTilstand({ status: 'klar', indeks, henterMer: true })
    }
    hent(delvis).then(
      (indeks) => {
        if (denne !== siste.current) return
        status.current = 'klar'
        setTilstand({ status: 'klar', indeks })
      },
      (feil: unknown) => {
        if (denne !== siste.current) return
        if (hadde) {
          status.current = 'klar'
          utdatert.current = true
          return
        }
        status.current = 'feil'
        setTilstand({ status: 'feil', melding: feil instanceof Error ? feil.message : String(feil) })
      },
    )
  }, [hent])

  const foreld = useCallback(
    (hentNaa = false) => {
      utdatert.current = true
      if (hentNaa) krev()
    },
    [krev],
  )

  return { tilstand, krev, foreld }
}
