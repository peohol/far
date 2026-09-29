import { useCallback, useEffect, useRef, useState } from 'react'
import { arkiverIde, gjenopprettIde, hentIdetraad, merkIdeSett, overforIde, settHjerte, slettIde } from '../../ideer/api'
import { idetilstand, slettesKl, type Idetraad, type Kommentar } from '../../ideer/modell'
import { Riktekst } from '../stoffside/Riktekst'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Forfatterbilde, useForfatternavn, useIdekontekst } from './Idekontekst'
import { Kategorimerke } from './Merker'
import { Kommentartraad } from './Kommentartraad'
import { Hjerteknapp, Idehandling, Slettknapp, Tidspunkt } from './Smadeler'

const DATO = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Én idé: overskriften, hvem som skrev den og når, beskrivelsen, hjertene og
 * kommentartråden. Forfatteren kan endre og slette idéen; en administrator
 * kan slette den, legge den i arkivet («Ikke aktuelt») eller overføre den til
 * Planlagte oppgaver.
 *
 * En arkivert eller overført idé er frosset: den kan leses, men ikke endres,
 * kommenteres eller gis hjerter. En administrator kan gjenopprette en
 * arkivert idé eller slette den for godt.
 *
 * Å åpne idéen merker den som sett. Kommentarene som var nye da den ble
 * åpnet, står merket som nye til man går ut av den.
 *
 * `innebygd`: idéen står inni en planlagt oppgave, som bakgrunn for den. Da
 * tar den ikke fokus og har ingen av handlingene for administratorer.
 */
export function Ideside({
  id,
  innebygd = false,
  onEndre,
  onSlettet,
  onArkivert,
  onOverfort,
  onOppgave,
}: {
  id: string
  innebygd?: boolean
  onEndre?: (ide: Idetraad) => void
  onSlettet?: () => void
  /** En administrator har lagt idéen i arkivet. */
  onArkivert?: (ide: Idetraad) => void
  /** En administrator har overført idéen; `oppgave` er ID-en til oppgaven. */
  onOverfort?: (ide: Idetraad, oppgave: string) => void
  /** Til oppgaven en overført idé ble til. */
  onOppgave?: (oppgave: string) => void
}) {
  const { meg, admin } = useIdekontekst()
  const [traad, setTraad] = useState<Idetraad | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const [arbeider, setArbeider] = useState(false)
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
      void merkIdeSett(hentet).catch(() => undefined)
    })
  }, [hent])

  // Fokus på overskriften når idéen er hentet, så skjermlesere leser hvor man er.
  const lastet = traad !== null
  useEffect(() => {
    if (lastet && !innebygd) tittel.current?.focus({ preventScroll: true })
  }, [lastet, innebygd])

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

  /** En handling som endrer hvor idéen står. Feiler den, står idéen der den stod. */
  const utfor = async (handling: () => Promise<void>) => {
    if (arbeider) return
    setArbeider(true)
    setFeil(null)
    try {
      await handling()
    } catch (e) {
      setFeil((e as Error).message)
      await hent()
    } finally {
      setArbeider(false)
    }
  }

  if (!traad) {
    return feil ? (
      <p className="skjemafeil" role="alert">
        {feil}
      </p>
    ) : null
  }

  const slett = () =>
    void utfor(async () => {
      await slettIde(traad.id)
      onSlettet?.()
    })

  const tilstand = idetilstand(traad)
  const laast = tilstand !== 'apen'
  const eier = traad.forfatter_id === meg.id
  const administrerer = admin && !innebygd
  const Overskrift = innebygd ? 'h4' : 'h3'

  return (
    <article className="ideside" data-innebygd={innebygd || undefined} aria-labelledby={`ide-${traad.id}`}>
      <header className="ideside__hode">
        <p className="ideside__merker">
          <Kategorimerke kategori={traad.kategori} />
        </p>
        <Overskrift ref={tittel} id={`ide-${traad.id}`} className="ideside__tittel" tabIndex={-1}>
          {traad.tittel}
        </Overskrift>
        <p className="forfatterlinje">
          <Forfatterbilde id={traad.forfatter_id} storrelse="liten" />
          <span className="forfatterlinje__navn">{forfatter}</span>
          <span aria-hidden="true">·</span>
          <Tidspunkt iso={traad.opprettet_kl} endret={traad.endret_kl} />
        </p>
      </header>

      {tilstand === 'arkivert' && traad.arkivert_kl && (
        <div className="idemerknad" role="note">
          <Ikon navn="arkiv" storrelse="ui" />
          <p>
            <strong>Ikke aktuelt.</strong> Idéen slettes automatisk {DATO.format(slettesKl(traad.arkivert_kl))}.
          </p>
          {administrerer && (
            <div className="idemerknad__handlinger">
              <Button
                variant="kant"
                icon={<Ikon navn="reset" storrelse="ui" />}
                disabled={arbeider}
                onClick={() =>
                  void utfor(async () => {
                    await gjenopprettIde(traad.id)
                    await hent()
                  })
                }
              >
                Gjenopprett
              </Button>
              <Slettknapp hva="idéen for godt" onSlett={slett} />
            </div>
          )}
        </div>
      )}

      {tilstand === 'overfort' && traad.oppgave && !innebygd && (
        <div className="idemerknad" role="note">
          <Ikon navn="oppgaver" storrelse="ui" />
          <p>
            <strong>Overført til planlagte oppgaver.</strong> Tråden er frosset.
          </p>
          {onOppgave && (
            <div className="idemerknad__handlinger">
              <Button variant="kant" icon={<Ikon navn="chev" storrelse="ui" />} onClick={() => onOppgave(traad.oppgave!.id)}>
                Gå til oppgaven
              </Button>
            </div>
          )}
        </div>
      )}

      {traad.tekst && <Riktekst dokument={traad.tekst} />}

      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}

      <div className="idehandlinger">
        <Hjerteknapp antall={traad.hjerter} gitt={traad.mitt_hjerte} onVeksle={() => veksleHjerte(null)} hva="idéen" laast={laast} />
        {eier && !laast && onEndre && (
          <Idehandling ikon="edit" onClick={() => onEndre(traad)}>
            Rediger
          </Idehandling>
        )}
        {!laast && (eier || admin) && !innebygd && <Slettknapp hva="idéen" onSlett={slett} />}
      </div>

      {administrerer && !laast && (
        <div className="idevalgknapper" role="group" aria-label="Hva skjer med idéen">
          <Button
            variant="kant"
            icon={<Ikon navn="no" storrelse="ui" />}
            disabled={arbeider}
            onClick={() =>
              void utfor(async () => {
                await arkiverIde(traad.id)
                onArkivert?.(traad)
              })
            }
          >
            Ikke aktuelt
          </Button>
          <Button
            variant="kant"
            icon={<Ikon navn="yes" storrelse="ui" />}
            disabled={arbeider}
            onClick={() =>
              void utfor(async () => {
                onOverfort?.(traad, await overforIde(traad.id))
              })
            }
          >
            Overfør til planlagte oppgaver
          </Button>
        </div>
      )}

      <Kommentartraad traad={traad} sistSett={sistSett ?? null} onEndret={hent} onHjerte={veksleHjerte} laast={laast} />
    </article>
  )
}
