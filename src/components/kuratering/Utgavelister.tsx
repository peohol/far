import { useCallback, useEffect, useMemo, useState } from 'react'
import { kurateringsadresse, versjonsadresse } from '../../domain/rute'
import { tidspunkt } from '../../faginnhold/historikk'
import { useJevnligSjekk } from '../../hooks/useJevnligSjekk'
import { klient as supabase } from '../../auth/klient'
import { lagKurateringsklient, type Kurateringsklient } from '../../kuratering/klient'
import { ARTSNAVN, STATUSNAVN, erAktiv, versjonslinje, type Grensammendrag, type Versjonsinfo } from '../../kuratering/modell'
import { Button } from '../Button'
import { Bryter } from '../Bryter'
import { Modallag } from '../Modallag'
import { useFaginnholdskilde } from '../stoffside/Faginnholdskilde'
import '../../styles/kuratering.css'

type Lasting<T> = { status: 'laster' } | { status: 'feil'; feil: string } | { status: 'klar'; data: T }

/** Henter mens laget er åpent, på nytt hver gang det åpnes. */
function useApenHenting<T>(apen: boolean, hent: (() => Promise<T>) | null): Lasting<T> {
  const [tilstand, setTilstand] = useState<Lasting<T>>({ status: 'laster' })
  useEffect(() => {
    if (!apen || !hent) return
    let gjelder = true
    setTilstand({ status: 'laster' })
    hent().then(
      (data) => gjelder && setTilstand({ status: 'klar', data }),
      (e: unknown) => gjelder && setTilstand({ status: 'feil', feil: e instanceof Error ? e.message : String(e) }),
    )
    return () => {
      gjelder = false
    }
  }, [apen, hent])
  return tilstand
}

function Lastestatus({ tilstand }: { tilstand: Lasting<unknown> }) {
  if (tilstand.status === 'laster') return <p className="utgaveliste__tomt">Henter …</p>
  if (tilstand.status === 'feil') return <p className="utgavebanner__feil">Fikk ikke hentet: {tilstand.feil}</p>
  return null
}

/** Versjonene av en fagside, nyeste først, hver med lenke til versjonen. For alle innloggede. */
export function Versjonsliste({ apen, stoff, navn, onLukk }: { apen: boolean; stoff: string; navn: string; onLukk: () => void }) {
  const { kuratering } = useFaginnholdskilde()
  const hent = useMemo(() => (kuratering ? () => kuratering.versjoner(stoff) : null), [kuratering, stoff])
  const tilstand = useApenHenting<Versjonsinfo[]>(apen, hent)
  return (
    <Modallag apen={apen} tittel={`Versjoner av ${navn}`} ikon="history" onLukk={onLukk}>
      <Lastestatus tilstand={tilstand} />
      {tilstand.status === 'klar' &&
        (tilstand.data.length === 0 ? (
          <p className="utgaveliste__tomt">Fagsiden har ingen publiserte versjoner ennå.</p>
        ) : (
          <ul className="utgaveliste">
            {tilstand.data.map((v, i) => (
              <li key={v.nr}>
                <a className="utgaveliste__rad" href={versjonsadresse(stoff, v.nr)} onClick={onLukk}>
                  <span className="utgaveliste__hode">
                    Versjon {v.nr}
                    {i === 0 && ' (gjeldende)'}
                  </span>
                  <span className="utgaveliste__meta">{versjonslinje(v)}</span>
                  {v.endring?.oppsummering && <span className="utgaveliste__meta">{v.endring.oppsummering}</span>}
                </a>
              </li>
            ))}
          </ul>
        ))}
    </Modallag>
  )
}

/** Én gren i en liste: hva, hvor langt den er kommet, og lenken til den. */
function Grenrad({ gren, onApne }: { gren: Grensammendrag; onApne?: () => void }) {
  return (
    <a className="utgaveliste__rad" href={kurateringsadresse(gren.id)} onClick={onApne}>
      <span className="utgaveliste__hode">
        {gren.navn ?? gren.stoff} · {STATUSNAVN[gren.status]}
      </span>
      <span className="utgaveliste__meta">
        {[ARTSNAVN[gren.art], gren.formaal, `revisjon ${gren.revisjon}`, tidspunkt(gren.oppdatert_kl)].join(' · ')}
      </span>
      {gren.konflikt && <span className="utgaveliste__meta">Fagsiden er publisert på nytt etter at grenen ble laget.</span>}
      {gren.aktivitet && erAktiv(gren.status) && <span className="utgaveliste__meta">Nå: {gren.aktivitet.tekst}</span>}
    </a>
  )
}

/**
 * Arbeidsoversikten over kurateringsgrenene, for administratorene: de aktive
 * og de som er avsluttet de siste 30 dagene, eller alle.
 */
export function Kurateringsoversikt({ apen, klient: egen, onLukk }: { apen: boolean; klient?: Kurateringsklient; onLukk: () => void }) {
  const [alle, setAlle] = useState(false)
  // Klienten lages først når oversikten åpnes.
  const klient = useMemo(() => egen ?? (apen ? lagKurateringsklient(supabase()) : null), [egen, apen])
  const hent = useMemo(() => (klient ? () => klient.oversikt(alle ? { alle: true } : {}) : null), [klient, alle])
  const tilstand = useApenHenting<Grensammendrag[]>(apen, hent)
  const grupper = useMemo(() => {
    const liste = tilstand.status === 'klar' ? tilstand.data : []
    return { aktive: liste.filter((g) => erAktiv(g.status)), avsluttede: liste.filter((g) => !erAktiv(g.status)) }
  }, [tilstand])
  return (
    <Modallag
      apen={apen}
      tittel="Kurateringer"
      ikon="oppgaver"
      onLukk={onLukk}
      handling={
        <Bryter pa={alle} onEndre={setAlle}>
          Vis alle
        </Bryter>
      }
    >
      <Lastestatus tilstand={tilstand} />
      {tilstand.status === 'klar' && (
        <>
          <h3 className="historikk__gruppetittel">Pågår</h3>
          {grupper.aktive.length === 0 ? (
            <p className="utgaveliste__tomt">Ingen kurateringer pågår.</p>
          ) : (
            <ul className="utgaveliste">
              {grupper.aktive.map((g) => (
                <li key={g.id}>
                  <Grenrad gren={g} onApne={onLukk} />
                </li>
              ))}
            </ul>
          )}
          {grupper.avsluttede.length > 0 && (
            <>
              <h3 className="historikk__gruppetittel">Avsluttet</h3>
              <ul className="utgaveliste">
                {grupper.avsluttede.map((g) => (
                  <li key={g.id}>
                    <Grenrad gren={g} onApne={onLukk} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Modallag>
  )
}

/**
 * Meldingen øverst på fagsiden når den har en aktiv kurateringsgren, for
 * administratorene. Ses etter når siden åpnes og jevnlig mens den står åpen.
 */
export function Kurateringsbanner({ stoff }: { stoff: string }) {
  const { kuratering, kanRedigere } = useFaginnholdskilde()
  const [aktive, setAktive] = useState<Grensammendrag[]>([])
  const sjekk = useCallback(() => {
    if (!kuratering || !kanRedigere) return
    kuratering.oversikt({ stoff }).then(
      (liste) => setAktive(liste.filter((g) => erAktiv(g.status))),
      () => undefined,
    )
  }, [kuratering, kanRedigere, stoff])
  useJevnligSjekk(sjekk)
  const gren = aktive[0]
  if (!gren) return null
  return (
    <div className="utgavebanner" role="status">
      <p className="utgavebanner__linje">
        {ARTSNAVN[gren.art]} pågår i en egen arbeidsversjon: {STATUSNAVN[gren.status].toLowerCase()}, revisjon {gren.revisjon}.
        Ingenting av den er synlig her før den er godkjent og publisert.
      </p>
      <div className="utgavebanner__handlinger">
        <Button variant="kant" onClick={() => (window.location.hash = kurateringsadresse(gren.id))}>
          Åpne kurateringen
        </Button>
      </div>
    </div>
  )
}
