import { useCallback, useEffect, useRef, useState } from 'react'
import { hentIdetraad, settHjerte, slettIde } from '../../ideer/api'
import type { Idetraad, Kommentar } from '../../ideer/modell'
import { Riktekst } from '../analyttside/Riktekst'
import { Forfatterbilde, useForfatternavn, useIdekontekst } from './Idekontekst'
import { Kategorimerke } from './Kategorimerke'
import { Kommentartraad } from './Kommentartraad'
import { Hjerteknapp, Idehandling, Slettknapp, Tidspunkt } from './Smadeler'

/**
 * Én idé: overskriften, hvem som skrev den og når, beskrivelsen, hjertene og
 * kommentartråden. Forfatteren kan endre og slette idéen; en administrator
 * kan slette den.
 */
export function Ideside({
  id,
  onEndre,
  onSlettet,
}: {
  id: string
  onEndre: (ide: Idetraad) => void
  onSlettet: () => void
}) {
  const { meg, admin } = useIdekontekst()
  const [traad, setTraad] = useState<Idetraad | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const tittel = useRef<HTMLHeadingElement>(null)

  const hent = useCallback(async () => {
    try {
      const hentet = await hentIdetraad(id)
      if (!hentet) setFeil('Idéen finnes ikke lenger.')
      setTraad(hentet)
    } catch {
      setFeil('Fikk ikke hentet idéen.')
    }
  }, [id])

  useEffect(() => {
    void hent()
  }, [hent])

  // Fokus på overskriften når idéen er hentet, så skjermlesere leser hvor man er.
  const lastet = traad !== null
  useEffect(() => {
    if (lastet) tittel.current?.focus({ preventScroll: true })
  }, [lastet])

  const forfatter = useForfatternavn(traad?.forfatter_id ?? null)

  /**
   * Hjertet vises med én gang; lagringen går etter. Går den galt, hentes
   * tråden på nytt, så det som vises, er det som er lagret.
   */
  const veksleHjerte = (kommentar: Kommentar | null) => {
    if (!traad) return
    const gitt = !(kommentar ?? traad).mitt_hjerte
    const vend = <T extends { mitt_hjerte: boolean; hjerter: number }>(x: T): T => ({
      ...x,
      mitt_hjerte: gitt,
      hjerter: x.hjerter + (gitt ? 1 : -1),
    })
    setTraad(
      kommentar
        ? { ...traad, kommentarer: traad.kommentarer.map((k) => (k.id === kommentar.id ? vend(k) : k)) }
        : vend(traad),
    )
    settHjerte(traad.id, kommentar?.id ?? null, meg.id, gitt).catch(() => void hent())
  }

  const slett = async () => {
    try {
      await slettIde(id)
      onSlettet()
    } catch (e) {
      setFeil((e as Error).message)
    }
  }

  if (!traad) {
    return feil ? (
      <p className="skjemafeil" role="alert">
        {feil}
      </p>
    ) : null
  }

  const eier = traad.forfatter_id === meg.id

  return (
    <article className="ideside" aria-labelledby={`ide-${traad.id}`}>
      <header className="ideside__hode">
        <Kategorimerke kategori={traad.kategori} />
        <h3 ref={tittel} id={`ide-${traad.id}`} className="ideside__tittel" tabIndex={-1}>
          {traad.tittel}
        </h3>
        <p className="forfatterlinje">
          <Forfatterbilde id={traad.forfatter_id} storrelse="liten" />
          <span className="forfatterlinje__navn">{forfatter}</span>
          <span aria-hidden="true">·</span>
          <Tidspunkt iso={traad.opprettet_kl} endret={traad.endret_kl} />
        </p>
      </header>

      {traad.tekst && <Riktekst dokument={traad.tekst} />}

      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}

      <div className="idehandlinger">
        <Hjerteknapp antall={traad.hjerter} gitt={traad.mitt_hjerte} onVeksle={() => veksleHjerte(null)} hva="idéen" />
        {eier && (
          <Idehandling ikon="edit" onClick={() => onEndre(traad)}>
            Rediger
          </Idehandling>
        )}
        {(eier || admin) && <Slettknapp hva="idéen" onSlett={() => void slett()} />}
      </div>

      <Kommentartraad traad={traad} onEndret={hent} onHjerte={veksleHjerte} />
    </article>
  )
}
