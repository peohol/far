import { useCallback, useEffect, useRef, useState } from 'react'
import { hentIdetraad, merkIdeSett, settHjerte, settIdestatus, slettIde } from '../../ideer/api'
import { STATUSER, STATUSNAVN, type Idestatus, type Idetraad, type Kommentar } from '../../ideer/modell'
import { Riktekst } from '../analyttside/Riktekst'
import { Forfatterbilde, useForfatternavn, useIdekontekst } from './Idekontekst'
import { Kategorimerke, Statusmerke } from './Merker'
import { Kommentartraad } from './Kommentartraad'
import { Hjerteknapp, Idehandling, Slettknapp, Tidspunkt, Valgrad } from './Smadeler'

/** Statusvalgene til en administrator: ingen status først. */
const STATUSVALG = ['ingen', ...STATUSER] as const
type Statusvalg = (typeof STATUSVALG)[number]
const STATUSVALGNAVN: Record<Statusvalg, string> = { ingen: 'Ingen', ...STATUSNAVN }

/**
 * Én idé: overskriften, hvem som skrev den og når, beskrivelsen, hjertene og
 * kommentartråden. Forfatteren kan endre og slette idéen; en administrator
 * kan slette den og gi den status.
 *
 * Å åpne idéen merker den som sett. Kommentarene som var nye da den ble
 * åpnet, står merket som nye til man går ut av den.
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
  /** Når idéen var sett før denne åpningen; `undefined` til den er hentet. */
  const [sistSett, setSistSett] = useState<string | null | undefined>(undefined)
  const tittel = useRef<HTMLHeadingElement>(null)

  const hent = useCallback(async () => {
    try {
      const hentet = await hentIdetraad(id)
      if (!hentet) setFeil('Idéen finnes ikke lenger.')
      setTraad(hentet)
      return hentet
    } catch {
      setFeil('Fikk ikke hentet idéen.')
      return null
    }
  }, [id])

  useEffect(() => {
    void hent().then((hentet) => {
      if (!hentet) return
      setSistSett((forrige) => (forrige === undefined ? hentet.sist_sett : forrige))
      void merkIdeSett(hentet.id).catch(() => undefined)
    })
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

  /** Statusen vises med én gang; går lagringen galt, hentes idéen på nytt. */
  const settStatus = (valg: Statusvalg) => {
    if (!traad) return
    const status: Idestatus | null = valg === 'ingen' ? null : valg
    setTraad({ ...traad, status })
    settIdestatus(traad.id, status).catch(() => void hent())
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
        <p className="ideside__merker">
          <Kategorimerke kategori={traad.kategori} />
          {traad.status && <Statusmerke status={traad.status} />}
        </p>
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

      {admin && (
        <Valgrad
          navn="Status"
          valg={STATUSVALG}
          valgt={traad.status ?? 'ingen'}
          etiketter={STATUSVALGNAVN}
          onVelg={settStatus}
        />
      )}

      <Kommentartraad
        traad={traad}
        sistSett={sistSett ?? null}
        onEndret={hent}
        onHjerte={veksleHjerte}
      />
    </article>
  )
}
