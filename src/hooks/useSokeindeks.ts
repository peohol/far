import { useCallback, useRef, useState } from 'react'
import type { Manglende } from '../faginnhold/globaltSok'
import type { Sokeindeks } from '../faginnhold/sok'

/** Indeksen fagsøket søker i, med kildene som ikke kunne leses. */
export type Lestsokeindeks = Sokeindeks & { mangler?: Manglende }

/** Hvor gammel indeksen kan bli før `krev` ser etter endringer. */
export const SJEKK_ENDRINGER_ETTER_MS = 10 * 60_000

/** Hvor lenge `krev` venter før den prøver igjen å lese kildene som manglet. */
export const PROV_MANGLENDE_ETTER_MS = 30_000

const harMangler = (indeks: Lestsokeindeks) => Object.keys(indeks.mangler ?? {}).length > 0

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
 * `krev` henter den når den mangler, etter en feil, når `foreld` har sagt at
 * den kan være utdatert (en administrator kan ha publisert noe), når den er
 * eldre enn {@link SJEKK_ENDRINGER_ETTER_MS}, og når en kilde manglet og det er
 * gått {@link PROV_MANGLENDE_ETTER_MS}. Det som ikke er endret, hentes ikke på
 * nytt (`lesSokeindeks`), så det koster lite. En utdatert indeks blir stående
 * til den nye er hentet, så søket ikke blinker; en feil da beholder den gamle.
 * `foreld(true)` henter den nye med én gang, for det som alt viser indeksen og
 * ikke ber om den igjen (søkesiden), og `provIgjen` gjør det samme når
 * brukeren ber om det.
 */
export function useSokeindeks(hent: Sokeindekshenter): {
  tilstand: Sokeindekstilstand
  krev: () => void
  foreld: (hentNaa?: boolean) => void
  provIgjen: () => void
} {
  const [tilstand, setTilstand] = useState<Sokeindekstilstand>({ status: 'uhentet' })
  const status = useRef<Sokeindekstilstand['status']>('uhentet')
  const utdatert = useRef(false)
  // Når den siste indeksen kom, og om noe manglet i den.
  const hentet = useRef({ kl: 0, mangler: false })
  // Bare det siste svaret teller, om to hentinger skulle krysse hverandre.
  const siste = useRef(0)

  const krev = useCallback(() => {
    if (status.current === 'laster') return
    if (status.current === 'klar' && !utdatert.current) {
      const alder = Date.now() - hentet.current.kl
      if (alder < SJEKK_ENDRINGER_ETTER_MS && !(hentet.current.mangler && alder >= PROV_MANGLENDE_ETTER_MS)) return
    }
    const denne = (siste.current += 1)
    const hadde = status.current === 'klar'
    status.current = 'laster'
    utdatert.current = false
    if (!hadde) setTilstand({ status: 'laster' })
    // Det som manglet, hentes på nytt mens resten står.
    else if (hentet.current.mangler) setTilstand((t) => (t.status === 'klar' ? { ...t, henterMer: true } : t))
    const delvis = (indeks: Lestsokeindeks) => {
      if (denne === siste.current && !hadde) setTilstand({ status: 'klar', indeks, henterMer: true })
    }
    hent(delvis).then(
      (indeks) => {
        if (denne !== siste.current) return
        status.current = 'klar'
        hentet.current = { kl: Date.now(), mangler: harMangler(indeks) }
        setTilstand({ status: 'klar', indeks })
      },
      (feil: unknown) => {
        if (denne !== siste.current) return
        if (hadde) {
          status.current = 'klar'
          utdatert.current = true
          setTilstand((t) => (t.status === 'klar' ? { status: 'klar', indeks: t.indeks } : t))
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

  const provIgjen = useCallback(() => foreld(true), [foreld])

  return { tilstand, krev, foreld, provIgjen }
}
