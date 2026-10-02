import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useBevart } from '../../oppdatering/Bevaring'
import { tomtDokument, type Riktekstdokument } from '../../faginnhold/riktekst'
import {
  arkiverDiskusjon,
  endreKommentar,
  hentDiskusjonstraad,
  merkDiskusjonSett,
  opprettKommentar,
  settHjerte,
  settTekst,
  settTittel,
  skjulInnhold,
  slettDiskusjon,
  slettKommentar,
} from '../../diskusjoner/api'
import {
  UKATEGORISERTE,
  kanSletteDiskusjon,
  type Diskusjonskategori,
  type Diskusjonsside as Side,
  type Diskusjonssider,
  type Diskusjonstraad,
} from '../../diskusjoner/modell'
import { TITTEL_MEST, tekstTilLagring, type Kommentar } from '../../traad/modell'
import { UnderOverskrift } from '../Overskriftsniva'
import { Riktekst } from '../stoffside/Riktekst'
import { Rikteksteditor } from '../stoffside/Rikteksteditor'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Forfatterbilde, useForfatternavn, useForfatterkontekst } from '../traad/Forfatterkontekst'
import { Kommentartraad, type Kommentarkanal } from '../traad/Kommentartraad'
import { Bekreftknapp, Hjerteknapp, Idehandling, Slettknapp, Tidspunkt } from '../traad/Smadeler'
import { Flytteskjema } from './Skjemaer'

const DATO = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

/** Hvor tråden står blant de andre i kategorien, for knappene som flytter den. */
export interface Plassering {
  indeks: number
  antall: number
}

/**
 * Én tråd i diskusjonsmenyen: overskriften, hvem som startet den og når, det
 * første innlegget, hjertene og kommentartråden.
 *
 * Alle kan endre overskriften, flytte tråden (også til en annen side) og legge
 * den i arkivet; bare den som skrev innlegget, kan endre det. Den som startet
 * tråden, kan slette den til noen andre har skrevet i den; en administrator
 * kan slette alle. En administrator kan også skjule innholdet i et innlegg
 * eller en kommentar, for eksempel pasientopplysninger som havnet der ved en
 * feil: teksten fjernes for godt, og en merknad står igjen.
 *
 * En arkivert tråd kan leses, men ikke endres, før den er hentet tilbake.
 *
 * Å åpne tråden merker den som sett. Kommentarene som var nye da den ble
 * åpnet, står merket som nye til man går ut av den.
 */
export function Diskusjonsside({
  id,
  side,
  sider,
  kategorier,
  plassering,
  onEndret,
  onSett,
  onFlytt,
  onFlyttetTilSide,
  onSlettet,
}: {
  id: string
  /** Siden tråden står på. */
  side: Side
  /** Sidene tråden kan flyttes til. */
  sider: Diskusjonssider
  kategorier: readonly Diskusjonskategori[]
  /** Plassen i kategorien, eller `null` når tråden er arkivert eller uten kategori. */
  plassering: Plassering | null
  /** Noe ved tråden som lista viser, er endret. */
  onEndret: () => Promise<unknown>
  /** Tråden er åpnet og merket som sett. */
  onSett: (id: string) => void
  /** Flytt tråden til en plass i en kategori. */
  onFlytt: (kategori: string, indeks: number) => Promise<void>
  /** Tråden er flyttet til en annen side. */
  onFlyttetTilSide: (til: Side) => void
  /** Tråden er slettet. */
  onSlettet: () => void
}) {
  const { meg, admin } = useForfatterkontekst()
  const [traad, setTraad] = useState<Diskusjonstraad | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const [arbeider, setArbeider] = useState(false)
  const [sistSett, setSistSett] = useState<string | null | undefined>(undefined)
  const [endrerTittel, setEndrerTittel] = useBevart(`traad:${id}/endrer-tittel`, false)
  const [endrerTekst, setEndrerTekst] = useBevart(`traad:${id}/endrer-tekst`, false)
  const [flytter, setFlytter] = useBevart(`traad:${id}/flytter`, false)
  const overskrift = useRef<HTMLHeadingElement>(null)
  const kategoriId = useId()

  const hent = useCallback(async () => {
    try {
      const hentet = await hentDiskusjonstraad(id)
      if (!hentet) setFeil('Tråden finnes ikke lenger.')
      setTraad(hentet)
      return hentet
    } catch {
      setFeil('Fikk ikke hentet tråden.')
      return null
    }
  }, [id])

  useEffect(() => {
    void hent().then((hentet) => {
      if (!hentet) return
      setSistSett((forrige) => (forrige === undefined ? hentet.sist_sett : forrige))
      void merkDiskusjonSett(hentet).then(() => onSett(hentet.id), () => undefined)
    })
    // `onSett` følger lista og skal ikke hente tråden på nytt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hent])

  // Fokus på overskriften når tråden er hentet, så skjermlesere leser hvor man er.
  const lastet = traad !== null
  useEffect(() => {
    if (lastet) overskrift.current?.focus({ preventScroll: true })
  }, [lastet])

  const forfatter = useForfatternavn(traad?.forfatter_id ?? null)

  const kanal = useMemo<Kommentarkanal>(
    () => ({
      traad: id,
      opprett: (forelder, tekst) => opprettKommentar(id, forelder, tekst),
      endre: (kommentar, tekst) => endreKommentar(kommentar, tekst),
      slett: (kommentar) => slettKommentar(kommentar),
      // Ingen kan slette andres kommentarer i diskusjonene, heller ikke en administrator.
      adminSletter: false,
      skjul: (kommentar) => skjulInnhold(id, kommentar),
    }),
    [id],
  )

  /** Hjertet vises med én gang; går lagringen galt, hentes tråden på nytt. */
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

  /**
   * En endring av tråden. Feiler den, vises feilen og tråden hentes på nytt.
   * Med `ferdig` går man videre dit i stedet for å hente tråden igjen.
   */
  const utfor = async (handling: () => Promise<unknown>, ferdig?: () => void) => {
    if (arbeider) return false
    setArbeider(true)
    setFeil(null)
    try {
      await handling()
      if (ferdig) ferdig()
      else await Promise.all([hent(), onEndret()])
      return true
    } catch (e) {
      setFeil((e as Error).message)
      await hent()
      return false
    } finally {
      setArbeider(false)
    }
  }

  if (!traad) {
    return (
      <div className="diskusjonsside">
        {feil && (
          <p className="skjemafeil" role="alert">
            {feil}
          </p>
        )}
      </div>
    )
  }

  const arkivert = Boolean(traad.arkivert_kl)
  const eier = traad.forfatter_id === meg.id
  const kategori = kategorier.find((k) => k.id === traad.kategori_id)

  return (
    <article className="diskusjonsside" aria-labelledby={`diskusjon-${traad.id}`}>
      <header className="diskusjonsside__hode">
        {endrerTittel && !arkivert ? (
          <Tittelskjema
            tittel={traad.tittel}
            onAvbryt={() => setEndrerTittel(false)}
            onLagre={async (tittel) => {
              if (await utfor(() => settTittel(traad.id, tittel))) setEndrerTittel(false)
            }}
          />
        ) : (
          <h3 ref={overskrift} id={`diskusjon-${traad.id}`} className="diskusjonsside__tittel" tabIndex={-1}>
            {traad.tittel}
          </h3>
        )}
        <p className="forfatterlinje">
          <Forfatterbilde id={traad.forfatter_id} storrelse="liten" />
          <span className="forfatterlinje__navn">{forfatter}</span>
          <span aria-hidden="true">·</span>
          <Tidspunkt iso={traad.opprettet_kl} endret={traad.endret_kl} />
        </p>
      </header>

      {arkivert && traad.arkivert_kl && (
        <div className="idemerknad" role="note">
          <Ikon navn="arkiv" storrelse="ui" />
          <p>
            <strong>Arkivert {DATO.format(new Date(traad.arkivert_kl))}.</strong> Tråden kan leses, men ikke endres eller
            kommenteres.
          </p>
          <div className="idemerknad__handlinger">
            <Button
              variant="kant"
              icon={<Ikon navn="reset" storrelse="ui" />}
              disabled={arbeider}
              onClick={() => void utfor(() => arkiverDiskusjon(traad.id, false))}
            >
              Hent tilbake
            </Button>
          </div>
        </div>
      )}

      {endrerTekst && eier && !arkivert ? (
        <Tekstskjema
          id={traad.id}
          tekst={traad.tekst}
          onAvbryt={() => setEndrerTekst(false)}
          onLagre={async (tekst) => {
            if (await utfor(() => settTekst(traad.id, tekst))) setEndrerTekst(false)
          }}
        />
      ) : traad.skjult ? (
        <p className="kommentar__skjultmerknad">Innholdet er skjult av en administrator.</p>
      ) : (
        <UnderOverskrift niva={3}>
          <Riktekst dokument={traad.tekst} />
        </UnderOverskrift>
      )}

      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}

      <div className="idehandlinger">
        <Hjerteknapp antall={traad.hjerter} gitt={traad.mitt_hjerte} onVeksle={() => veksleHjerte(null)} hva="tråden" laast={arkivert} />
        {!arkivert && (
          <Idehandling ikon="edit" onClick={() => setEndrerTittel(true)}>
            Endre overskrift
          </Idehandling>
        )}
        {eier && !arkivert && !traad.skjult && (
          <Idehandling ikon="edit" onClick={() => setEndrerTekst(true)}>
            Rediger innlegget
          </Idehandling>
        )}
        {!arkivert && (
          <Bekreftknapp
            ikon="arkiv"
            tekst="Arkiver"
            bekreftTekst="Bekreft arkivering"
            etikett="Legg tråden i arkivet"
            bekreftEtikett="Bekreft at tråden legges i arkivet"
            onBekreft={() => void utfor(() => arkiverDiskusjon(traad.id, true))}
          />
        )}
        {!arkivert && (
          <Idehandling ikon="ext" aria-expanded={flytter} onClick={() => setFlytter(!flytter)}>
            Flytt til en annen side
          </Idehandling>
        )}
        {kanSletteDiskusjon(traad, meg.id, admin) && (
          <Slettknapp hva="tråden" onSlett={() => void utfor(() => slettDiskusjon(traad.id), onSlettet)} />
        )}
        {admin && !eier && !traad.skjult && !arkivert && (
          <Bekreftknapp
            ikon="skjul"
            tekst="Skjul"
            bekreftTekst="Bekreft skjuling"
            etikett="Skjul innholdet i innlegget"
            bekreftEtikett="Bekreft at innholdet i innlegget skjules for godt"
            onBekreft={() => void utfor(() => skjulInnhold(traad.id, null))}
          />
        )}
      </div>

      {/* Plassen på denne siden står i ro mens tråden flyttes til en annen. */}
      {flytter && !arkivert ? (
        <Flytteskjema id={traad.id} side={side} sider={sider} onAvbryt={() => setFlytter(false)} onFlyttet={onFlyttetTilSide} />
      ) : !arkivert && (
        <div className="diskusjonsside__plass">
          <label className="diskusjonsside__kategori" htmlFor={kategoriId}>
            <span className="kun-skjermleser">Kategori</span>
            <select
              id={kategoriId}
              className="felt__inndata"
              value={kategori?.id ?? ''}
              disabled={arbeider}
              onChange={(e) => e.target.value && void utfor(() => onFlytt(e.target.value, Number.MAX_SAFE_INTEGER))}
            >
              {!kategori && (
                <option value="" disabled>
                  {UKATEGORISERTE.emoji} {UKATEGORISERTE.navn}
                </option>
              )}
              {kategorier.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.emoji} {k.navn}
                </option>
              ))}
            </select>
          </label>
          {kategori && plassering && plassering.antall > 1 && (
            <>
              <Idehandling
                ikon="opp"
                onClick={() => plassering.indeks > 0 && void utfor(() => onFlytt(kategori.id, plassering.indeks - 1))}
              >
                Flytt opp
              </Idehandling>
              <Idehandling
                ikon="ned"
                onClick={() =>
                  plassering.indeks < plassering.antall - 1 && void utfor(() => onFlytt(kategori.id, plassering.indeks + 1))
                }
              >
                Flytt ned
              </Idehandling>
            </>
          )}
        </div>
      )}

      <Kommentartraad
        kanal={kanal}
        kommentarer={traad.kommentarer}
        sistSett={sistSett ?? null}
        onEndret={() => Promise.all([hent(), onEndret()])}
        onHjerte={veksleHjerte}
        laast={arkivert}
      />
    </article>
  )
}

/** Ny overskrift på tråden, rett der overskriften står. */
function Tittelskjema({
  tittel: start,
  onAvbryt,
  onLagre,
}: {
  tittel: string
  onAvbryt: () => void
  onLagre: (tittel: string) => Promise<void>
}) {
  const [tittel, setTittel] = useState(start)
  const id = useId()
  return (
    <form
      className="diskusjonsside__tittelskjema"
      onSubmit={(e) => {
        e.preventDefault()
        if (tittel.trim()) void onLagre(tittel)
      }}
    >
      <label className="kun-skjermleser" htmlFor={id}>
        Overskrift
      </label>
      <input
        id={id}
        className="felt__inndata"
        value={tittel}
        maxLength={TITTEL_MEST}
        autoFocus
        onChange={(e) => setTittel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onAvbryt()
          }
        }}
      />
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onAvbryt}>
          Avbryt
        </Button>
        <Button type="submit" className="knapp--kompakt" disabled={!tittel.trim()}>
          Lagre
        </Button>
      </div>
    </form>
  )
}

/** Nytt første innlegg. Bare for den som skrev det. */
function Tekstskjema({
  id,
  tekst: start,
  onAvbryt,
  onLagre,
}: {
  id: string
  tekst: Riktekstdokument
  onAvbryt: () => void
  onLagre: (tekst: Riktekstdokument | null) => Promise<void>
}) {
  const [tekst, setTekst] = useBevart<Riktekstdokument>(`traad:${id}/tekst`, () => start ?? tomtDokument())
  return (
    <div className="kommentarskriver">
      <Rikteksteditor dokument={tekst} onEndre={setTekst} etikett="Innlegget" referanser={false} autofokus kompakt />
      <div className="skjema__knapper kommentarskriver__knapper">
        <Button variant="subtle" onClick={onAvbryt}>
          Avbryt
        </Button>
        <Button className="knapp--kompakt" onClick={() => void onLagre(tekstTilLagring(tekst))}>
          Lagre
        </Button>
      </div>
    </div>
  )
}
