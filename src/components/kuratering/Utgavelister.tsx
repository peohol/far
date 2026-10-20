import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { kurateringsadresse, versjonsadresse } from '../../domain/rute'
import { tidspunkt } from '../../faginnhold/historikk'
import { useJevnligSjekk } from '../../hooks/useJevnligSjekk'
import { klient as supabase } from '../../auth/klient'
import { lagKurateringsklient, type Kurateringsklient } from '../../kuratering/klient'
import { INNSTILLINGER } from '../../kurateringsko/innstillinger'
import {
  ANSVARLIGNAVN,
  ARTSNAVN,
  ROLLENAVN,
  STATUSNAVN,
  agentadresser,
  erAktiv,
  etterAnsvar,
  hvaSomVenter,
  versjonslinje,
  type Agentinfo,
  type Grensammendrag,
  type Versjonsinfo,
} from '../../kuratering/modell'
import { perFagside, sist, type Sidekuratering } from '../../kuratering/sidestatus'
import { useClipboard } from '../../hooks/useClipboard'
import { Button } from '../Button'
import { Bekreftknapp } from '../traad/Smadeler'
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

/**
 * Én fagside i lista: grenen statusen gjelder (hva, hvor langt den er kommet,
 * hva som venter, og lenken til den), og under den lenkene til de andre
 * grenene siden har hatt.
 */
function Grenrad({ side, onApne }: { side: Sidekuratering<Grensammendrag>; onApne?: () => void }) {
  const gren = side.gjeldende
  const venter = [...hvaSomVenter(gren), gren.aktivitet && erAktiv(gren.status) ? `Nå: ${gren.aktivitet.tekst}` : '']
  return (
    <>
      <a className="utgaveliste__rad" href={kurateringsadresse(gren.id)} onClick={onApne}>
        <span className="utgaveliste__hode">
          {gren.navn ?? gren.stoff} · {STATUSNAVN[gren.status]}
        </span>
        <span className="utgaveliste__meta">
          {[ARTSNAVN[gren.art], gren.formaal, `revisjon ${gren.revisjon}`, tidspunkt(gren.oppdatert_kl)].join(' · ')}
        </span>
        {gren.konflikt && <span className="utgaveliste__meta">Fagsiden er publisert på nytt etter at grenen ble laget.</span>}
        {venter.some(Boolean) && <span className="utgaveliste__meta">{venter.filter(Boolean).join(' · ')}</span>}
        {gren.status_grunn && erAktiv(gren.status) && <span className="utgaveliste__meta">Grunn: {gren.status_grunn}</span>}
      </a>
      {side.tidligere.length > 0 && (
        <p className="utgaveliste__tidligere">
          Tidligere:{' '}
          {side.tidligere.map((g, i) => (
            <span key={g.id}>
              {i > 0 && ', '}
              <a href={kurateringsadresse(g.id)} onClick={onApne}>
                {STATUSNAVN[g.status].toLowerCase()} {tidspunkt(g.publisert_kl ?? g.oppdatert_kl)}
              </a>
            </span>
          ))}
        </p>
      )}
    </>
  )
}

/** Fagsidene i en liste, hver én gang. */
function Sideliste({ sider, onApne }: { sider: readonly Sidekuratering<Grensammendrag>[]; onApne?: () => void }) {
  return (
    <ul className="utgaveliste">
      {sider.map((s) => (
        <li key={s.stoff}>
          <Grenrad side={s} onApne={onApne} />
        </li>
      ))}
    </ul>
  )
}

/** Hvor mange som venter på kontrolløren, og om køen da gir ut nye stoffer (`maks_til_kontroll`). */
function Kontrollbuffer({ antall }: { antall: number }) {
  const grense = INNSTILLINGER.maks_til_kontroll
  return (
    <p className="utgaveliste__tomt">
      {antall >= grense
        ? `${antall} venter på kontroll, så køen gir ikke ut nye stoffer før færre enn ${grense} gjør det. Rettinger gis ut som før.`
        : `${antall} venter på kontroll. Køen gir ut nye stoffer så lenge færre enn ${grense} venter.`}
    </p>
  )
}

/**
 * Arbeidsoversikten over kurateringsgrenene, for administratorene: de aktive
 * og de som er avsluttet de siste 30 dagene, eller alle. Hver fagside står én
 * gang, med én status (`src/kuratering/sidestatus.ts`): under den som har
 * neste handling når en gren pågår, ellers under «Avsluttet». De andre
 * grenene siden har hatt, lenkes fra raden.
 */
export function Kurateringsoversikt({ apen, klient: egen, onLukk }: { apen: boolean; klient?: Kurateringsklient; onLukk: () => void }) {
  const [alle, setAlle] = useState(false)
  // Klienten lages først når oversikten åpnes.
  const klient = useMemo(() => egen ?? (apen ? lagKurateringsklient(supabase()) : null), [egen, apen])
  const hent = useMemo(() => (klient ? () => klient.oversikt(alle ? { alle: true } : {}) : null), [klient, alle])
  const tilstand = useApenHenting<Grensammendrag[]>(apen, hent)
  const grupper = useMemo(() => {
    const sider = [...perFagside(tilstand.status === 'klar' ? tilstand.data : []).values()]
    const etterGren = new Map(sider.flatMap((s) => (s.aktiv ? [[s.aktiv.id, s] as const] : [])))
    return {
      aktive: etterAnsvar(sider.flatMap((s) => (s.aktiv ? [s.aktiv] : []))).map((g) => ({
        ansvarlig: g.ansvarlig,
        sider: g.grener.map((gren) => etterGren.get(gren.id)!),
      })),
      avsluttede: sider.filter((s) => !s.aktiv).sort((a, b) => sist(b.gjeldende) - sist(a.gjeldende)),
    }
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
          {grupper.aktive.length === 0 && (
            <>
              <h3 className="historikk__gruppetittel">Pågår</h3>
              <p className="utgaveliste__tomt">Ingen kurateringer pågår.</p>
            </>
          )}
          {grupper.aktive.map((gruppe) => (
            <section key={gruppe.ansvarlig} aria-label={ANSVARLIGNAVN[gruppe.ansvarlig]}>
              <h3 className="historikk__gruppetittel">
                {ANSVARLIGNAVN[gruppe.ansvarlig]} ({gruppe.sider.length})
              </h3>
              {gruppe.ansvarlig === 'kontrolloren' && <Kontrollbuffer antall={gruppe.sider.length} />}
              <Sideliste sider={gruppe.sider} onApne={onLukk} />
            </section>
          ))}
          {grupper.avsluttede.length > 0 && (
            <>
              <h3 className="historikk__gruppetittel">Avsluttet</h3>
              <Sideliste sider={grupper.avsluttede} onApne={onLukk} />
            </>
          )}
        </>
      )}
      {klient && <Agentene apen={apen} klient={klient} />}
    </Modallag>
  )
}

/**
 * KI-agentene som arbeider i grenene, med rollen, nøkkelen og når de sist
 * kalte inn. En administrator lager en ny nøkkel her, og den vises bare den
 * ene gangen, sammen med adressen ChatGPT kobles til med.
 */
function Agentene({ apen, klient }: { apen: boolean; klient: Kurateringsklient }) {
  const [runde, setRunde] = useState(0)
  // `runde` gir en ny henting etter en ny nøkkel.
  const hent = useMemo(() => (runde >= 0 ? () => klient.agenter() : null), [klient, runde])
  const tilstand = useApenHenting<Agentinfo[]>(apen, hent)
  // Nøkkelen holdes bare her, aldri i det som bevares over en oppdatering, og
  // glemmes når laget lukkes. Den vises utenfor lista, så den står mens lista
  // hentes på nytt, også om hentingen feiler. Hver lukking starter en ny
  // økt: et svar som kommer etter at laget er lukket, vises aldri.
  const [ny, setNy] = useState<{ agent: string; navn: string; nokkel: string } | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const okt = useRef(0)
  useEffect(() => {
    if (apen) return
    okt.current += 1
    setNy(null)
    setFeil(null)
  }, [apen])
  const lagNokkel = (a: Agentinfo) => {
    setFeil(null)
    const denne = okt.current
    const iDenneOkta = <T,>(f: (v: T) => void) => (v: T) => {
      if (okt.current === denne) f(v)
    }
    klient.nyAgentnokkel(a.agent).then(
      iDenneOkta((svar) => {
        setNy({ ...svar, navn: a.navn })
        setRunde((r) => r + 1)
      }),
      iDenneOkta((e: unknown) => setFeil(e instanceof Error ? e.message : String(e))),
    )
  }
  return (
    <>
      <h3 className="historikk__gruppetittel">Agentene</h3>
      {ny && <Nynokkel navn={ny.navn} nokkel={ny.nokkel} />}
      <Lastestatus tilstand={tilstand} />
      {feil && (
        <p className="utgavebanner__feil" role="alert">
          {feil}
        </p>
      )}
      {tilstand.status === 'klar' && (
        <ul className="utgaveliste" aria-label="Agentene">
          {tilstand.data.map((a) => (
            <li key={a.agent} className="utgaveliste__rad">
              <span className="utgaveliste__hode">
                {a.navn} · {a.roller.map((r) => ROLLENAVN[r]).join(', ')}
              </span>
              <span className="utgaveliste__meta">
                {[
                  a.har_nokkel ? `Nøkkel fra ${tidspunkt(a.nokkel_kl!)}` : 'Ingen nøkkel',
                  a.sist_sett_kl ? `sist sett ${tidspunkt(a.sist_sett_kl)}` : 'aldri sett',
                ].join(' · ')}
              </span>
              <span>
                <Bekreftknapp
                  ikon="key"
                  tekst={a.har_nokkel ? 'Lag ny nøkkel' : 'Lag nøkkel'}
                  bekreftTekst="Bekreft"
                  bekreftEtikett={`Bekreft ny nøkkel til ${a.navn}. ${a.har_nokkel ? 'Den gamle slutter å virke med en gang.' : ''}`.trim()}
                  onBekreft={() => lagNokkel(a)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Den nye nøkkelen og adressene, med kopiering. Vises bare til laget lukkes. */
function Nynokkel({ navn, nokkel }: { navn: string; nokkel: string }) {
  const kopier = useClipboard()
  const [kopiert, setKopiert] = useState<string | null>(null)
  const { http, mcp } = agentadresser(window.location.origin, nokkel)
  const felter = [
    { navn: 'Adressen til ChatGPT (MCP)', verdi: mcp },
    { navn: 'Nøkkelen', verdi: nokkel },
    { navn: 'Adressen for HTTP', verdi: http },
  ]
  return (
    <div className="utgavebanner__skjema" role="status">
      <p className="utgavebanner__linje">Ny nøkkel til {navn}. Den vises bare nå: kopier det agenten trenger før du lukker.</p>
      {felter.map((f) => (
        <div key={f.navn} className="utgavebanner__handlinger">
          <label>
            {f.navn} <input readOnly value={f.verdi} onFocus={(e) => e.target.select()} />
          </label>
          <Button variant="kant" aria-label={`Kopier ${f.navn.toLowerCase()}`} onClick={() => void kopier(f.verdi).then((ok) => setKopiert(ok ? f.navn : null))}>
            {kopiert === f.navn ? 'Kopiert' : 'Kopier'}
          </Button>
        </div>
      ))}
    </div>
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
