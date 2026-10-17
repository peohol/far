import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tidspunkt } from '../../faginnhold/historikk'
import { useHenting } from '../../hooks/useHenting'
import { forhandsvisningen, type Kurateringsklient } from '../../kuratering/klient'
import {
  ARTSNAVN,
  STATUSNAVN,
  agenttilstand,
  erAktiv,
  grenenErEndret,
  kanPubliseres,
  rundeUtenEndringer,
  type Aktivitet,
  type Grendetaljer,
  type Grenstatusdata,
} from '../../kuratering/modell'
import { Bevaringsomrade, useBevart } from '../../oppdatering/Bevaring'
import { Button } from '../Button'
import { Bryter } from '../Bryter'
import { Lukkeknapp } from '../Lukkeknapp'
import { Merke, type Merketone } from '../Merke'
import { ToppmenyInnhold } from '../toppmeny/Toppmenykilde'
import { Bekreftknapp } from '../traad/Smadeler'
import { useFaginnholdskilde } from '../stoffside/Faginnholdskilde'
import { Agentfolging, Agentindikator, FOLG_HVER, STATUS_HVER, useEndringene, useGrenstatus, useSlaAvVedRulling } from './Folgagenten'
import { Kommentartrader, apneTraader } from './Kommentartrader'
import { Sidesammenligning, Utgavevisning } from './Utgavevisning'
import type { Utgavesideprops } from './Versjonsside'

const STATUSTONE: Partial<Record<Grendetaljer['status'], Merketone>> = {
  godkjent: 'referanse',
  publisert: 'referanse',
  tilbakemelding: 'toksisk',
  blokkert: 'alvorlig',
  stanset: 'alvorlig',
}

/** «Kommentarer», med hvor mange som står åpne og sperrer. */
function kommentarknapp(gren: Grendetaljer): string {
  const { apne, sperrende } = apneTraader(gren.traader)
  if (apne === 0) return 'Kommentarer'
  return `Kommentarer (${apne} åpne${sperrende ? `, ${sperrende} sperrende` : ''})`
}

/** Merknadene en gjenoppretting fikk da den ble laget: det som står som nå. */
function merknader(gren: Grendetaljer): string[] {
  const apnet = gren.hendelser.find((h) => h.hendelse === 'apnet')
  const liste = apnet?.data?.merknader
  return Array.isArray(liste) ? liste.filter((m): m is string => typeof m === 'string') : []
}

/**
 * En kurateringsgren (`#/kuratering/<gren>`), for administratorene: siden
 * nøyaktig slik den blir publisert (prøvepubliseringen), forskjellene fra
 * versjonen den bygger på, kontrollrundene og det som hindrer publisering, og
 * handlingene de har — vurdere, publisere, stanse, gjenoppta og forkaste.
 * Databasen avgjør hva som er lov; knappene viser bare det som kan gå.
 */
export function Kurateringsside({ gren, ...props }: Utgavesideprops & { gren: string }) {
  return (
    <Bevaringsomrade navn={`kuratering:${gren}`}>
      <Kurateringsinnhold gren={gren} {...props} />
    </Bevaringsomrade>
  )
}

function Kurateringsinnhold({ gren: id, onGaaTil, ...props }: Utgavesideprops & { gren: string }) {
  const { kuratering } = useFaginnholdskilde()
  if (!kuratering) {
    return <Grenmelding tekst="Kurateringsgrenene er ikke tilgjengelige her." onLukk={() => onGaaTil({ side: 'stoffregister' })} />
  }
  return <Grenvisning gren={id} klient={kuratering} onGaaTil={onGaaTil} {...props} />
}

function Grenmelding({ tekst, onLukk }: { tekst: string; onLukk: () => void }) {
  return (
    <section className="stoffside" aria-label="Kurateringsgren">
      <ToppmenyInnhold spor="lukk">
        <Lukkeknapp onLukk={onLukk} />
      </ToppmenyInnhold>
      <div className="utgavebanner" role="status">
        <p className="utgavebanner__tittel">{tekst}</p>
      </div>
    </section>
  )
}

function Grenvisning({ gren: id, klient: kuratering, onGaaTil, ...props }: Utgavesideprops & { gren: string; klient: Kurateringsklient }) {
  const [revisjon, setRevisjon] = useBevart<number | null>('revisjon', null)
  const hent = useCallback(async () => {
    const gren = await kuratering.les(id, revisjon ?? undefined)
    // Versjonen revisjonen som vises bygger på; en eldre revisjon kan bygge på en eldre versjon.
    const grunnlag = await kuratering.versjon(gren.stoff, gren.grunnlag?.versjon?.nr ?? gren.grunnversjon)
    return { gren, grunnlag }
  }, [kuratering, id, revisjon])
  const { tilstand, hentPaNytt } = useHenting(hent)
  const [sammenligner, setSammenligner] = useBevart('sammenligner', false)
  const [kommenterer, setKommenterer] = useBevart('kommenterer', false)
  const [folg, setFolg] = useBevart('folg', false)
  const slaAvFolging = useCallback(() => setFolg(false), [setFolg])
  const { status, brutt } = useGrenstatus(kuratering, id, folg ? FOLG_HVER : STATUS_HVER)
  const lest = tilstand.status === 'klar' ? tilstand.data.gren : null

  // Noe nytt i grenen (en revisjon, en kommentar, en status): les den på nytt,
  // når den siste revisjonen vises. Én gang per nytt svar.
  const lestFor = useRef<string | null>(null)
  useEffect(() => {
    if (!lest || !status || revisjon !== null || !grenenErEndret(lest, status)) return
    const nokkel = `${status.endring}:${status.revisjon}:${status.status}:${status.runde}:${status.apne_sperrer}`
    if (lestFor.current === nokkel) return
    lestFor.current = nokkel
    hentPaNytt()
  }, [lest, status, revisjon, hentPaNytt])

  const visning = useMemo(() => (lest ? forhandsvisningen(lest) : null), [lest])
  const aktivitet = status?.aktivitet ?? lest?.aktivitet
  const endringene = useEndringene(visning)
  useSlaAvVedRulling(folg, slaAvFolging)

  if (tilstand.status !== 'klar') {
    return (
      <Grenmelding
        tekst={tilstand.status === 'feil' ? `Fikk ikke hentet kurateringsgrenen. ${tilstand.melding}` : 'Henter kurateringsgrenen …'}
        onLukk={() => onGaaTil({ side: 'stoffregister' })}
      />
    )
  }

  const { gren, grunnlag } = tilstand.data
  const tilSiden = () => onGaaTil({ side: 'stoff', stoff: gren.stoff })
  const vist = gren.grenrevisjon?.revisjon ?? 0
  const banner = (
    <>
      {/* En gren som er publisert eller forkastet, har ingen agent å følge. */}
      <Agentfolging
        pa={folg && erAktiv(gren.status)}
        arbeider={agenttilstand(status, brutt) === 'aktiv'}
        aktivitet={aktivitet}
        endringene={endringene}
      />
      <Grenbanner
        // Vurderingen og meldingene gjelder revisjonen som vises; en ny revisjon gir et nytt banner.
        key={vist}
        gren={gren}
        klient={kuratering}
        status={status}
        brutt={brutt}
        aktivitet={aktivitet}
        folg={folg}
        onFolg={setFolg}
        siste={revisjon === null || revisjon === gren.revisjon}
        onVelgRevisjon={setRevisjon}
        onSammenlign={() => setSammenligner(true)}
        onKommentarer={() => setKommenterer(true)}
        onEndret={hentPaNytt}
        onTilSiden={tilSiden}
        onGaaTil={onGaaTil}
      />
    </>
  )

  return (
    <>
      {visning ? (
        // Siden står mens revisjonene skifter, med de samme skuffene åpne, så den som følger agenten ser endringene der de skjer.
        <Utgavevisning stoff={gren.stoff} utgave={visning} navn={`kuratering:${gren.id}`} banner={banner} onLukk={tilSiden} {...props} />
      ) : (
        <section className="stoffside" aria-label="Kurateringsgren">
          <ToppmenyInnhold spor="lukk">
            <Lukkeknapp onLukk={tilSiden} />
          </ToppmenyInnhold>
          {banner}
        </section>
      )}
      <Sidesammenligning
        apen={sammenligner}
        tittel={`${gren.navn ?? gren.stoff}: versjon ${grunnlag?.versjon.nr ?? gren.grunnversjon} mot grenen`}
        for_={grunnlag?.utgave ?? null}
        etter={visning}
        onLukk={() => setSammenligner(false)}
      />
      <Kommentartrader
        apen={kommenterer}
        gren={gren}
        side={visning?.side ?? grunnlag?.utgave.side ?? null}
        klient={kuratering}
        onEndret={hentPaNytt}
        onLukk={() => setKommenterer(false)}
      />
    </>
  )
}

function Grenbanner({
  gren,
  klient,
  status,
  brutt,
  aktivitet,
  folg,
  onFolg,
  siste,
  onVelgRevisjon,
  onSammenlign,
  onKommentarer,
  onEndret,
  onTilSiden,
  onGaaTil,
}: {
  gren: Grendetaljer
  klient: Kurateringsklient
  status: Grenstatusdata | null
  brutt: boolean
  /** Det agenten sist sa den gjorde, fra statusen når den er nyere. */
  aktivitet: Aktivitet | undefined
  folg: boolean
  onFolg: (pa: boolean) => void
  /** Om den siste revisjonen vises; bare den kan vurderes og publiseres. */
  siste: boolean
  onVelgRevisjon: (revisjon: number | null) => void
  onSammenlign: () => void
  onKommentarer: () => void
  onEndret: () => void
  onTilSiden: () => void
  onGaaTil: Utgavesideprops['onGaaTil']
}) {
  const [begrunnelse, setBegrunnelse] = useBevart('begrunnelse', '')
  const [vurderer, setVurderer] = useBevart<'godkjent' | 'endringer' | null>('vurderer', null)
  const [feil, setFeil] = useState<string | null>(null)
  const [arbeider, setArbeider] = useState(false)
  const [melding, setMelding] = useState<string | null>(null)
  const r = gren.grenrevisjon
  const vist = r?.revisjon ?? 0

  const utfor = async (handling: () => Promise<unknown>, ferdig?: (svar: unknown) => void) => {
    setFeil(null)
    setArbeider(true)
    try {
      const svar = await handling()
      ferdig?.(svar)
      onEndret()
    } catch (e) {
      setFeil(e instanceof Error ? e.message : String(e))
    } finally {
      setArbeider(false)
    }
  }

  const publiser = () =>
    utfor(
      () => klient.publiser(gren.id, gren.revisjon),
      (svar) => {
        const s = svar as { ok: boolean; versjon?: number; feil?: string }
        if (s.ok) setMelding(`Publisert som versjon ${s.versjon} av fagsiden.`)
        else setFeil(`Publiseringen stoppet, og ingenting er publisert: ${s.feil ?? ''}`)
      },
    )

  // Hver vurdering har en begrunnelse, også en godkjenning: det er sporet av hva som er kontrollert.
  const vurder = (beslutning: 'godkjent' | 'endringer') => {
    if (!begrunnelse.trim()) {
      setFeil(beslutning === 'godkjent' ? 'Skriv kort hva som er kontrollert før du godkjenner.' : 'Skriv hva som må endres.')
      return
    }
    return utfor(
      () => klient.vurder(gren.id, gren.revisjon, beslutning, begrunnelse.trim()),
      () => {
        setVurderer(null)
        setBegrunnelse('')
      },
    )
  }

  const merk = merknader(gren)
  const tone = STATUSTONE[gren.status] ?? 'noytral'

  return (
    <div className="utgavebanner" role="status">
      <p className="utgavebanner__tittel">
        {ARTSNAVN[gren.art]}: {gren.formaal}
      </p>
      <p className="utgavebanner__linje">
        <Merke tone={tone}>{STATUSNAVN[gren.status]}</Merke>
        <span>
          Revisjon {vist}
          {vist !== gren.revisjon ? ` av ${gren.revisjon}` : ''} · bygger på versjon {gren.grunnversjon}
          {gren.runde > 0 ? ` · kontrollrunde ${gren.runde}${rundeUtenEndringer(gren) ? ', uten nye endringer' : ''}` : ''}
        </span>
        <span>{gren.kurator ?? gren.opprettet_av}</span>
        {r && <span>{tidspunkt(r.kl)}</span>}
      </p>
      {gren.status_grunn && <p className="utgavebanner__linje">{gren.status_grunn}</p>}
      {erAktiv(gren.status) && gren.kurator && (
        <p className="utgavebanner__linje">
          <Agentindikator status={status} brutt={brutt} />
          {aktivitet && (
            <span>
              {aktivitet.tekst} ({tidspunkt(aktivitet.kl)})
            </span>
          )}
          <Bryter pa={folg} onEndre={onFolg}>
            Følg agenten
          </Bryter>
        </p>
      )}
      {r?.melding && <p className="utgavebanner__linje">«{r.melding}»</p>}
      {!r?.forhandsvisning && r && (
        <p className="utgavebanner__feil">Revisjonen har ingen forhåndsvisning fordi prøvepubliseringen feilet: {r.teknisk?.feil}</p>
      )}
      {merk.length > 0 && (
        <ul className="utgavebanner__liste" aria-label="Merknader">
          {merk.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {erAktiv(gren.status) && gren.hindringer.length > 0 && (
        <ul className="utgavebanner__liste utgavebanner__liste--hindring" aria-label="Hindrer publisering">
          {gren.hindringer.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
      {gren.vurderinger.length > 0 && (
        <ul className="utgavebanner__liste" aria-label="Vurderingene">
          {gren.vurderinger.map((v, i) => (
            <li key={i}>
              Revisjon {v.revisjon}: {v.beslutning === 'godkjent' ? 'godkjent' : 'endringer etterspurt'} av {v.av}
              {v.begrunnelse ? ` – ${v.begrunnelse}` : ''}
            </li>
          ))}
        </ul>
      )}

      <div className="utgavebanner__handlinger">
        <Button variant="kant" onClick={onTilSiden}>
          Til fagsiden
        </Button>
        <Button variant="kant" onClick={onKommentarer}>
          {kommentarknapp(gren)}
        </Button>
        <Button variant="kant" onClick={onSammenlign} disabled={!r?.forhandsvisning}>
          Sammenlign med versjon {gren.grunnversjon}
        </Button>
        {gren.revisjon > 1 && (
          <label className="utgavebanner__linje">
            Revisjon
            <select value={vist} onChange={(e) => onVelgRevisjon(Number(e.target.value) === gren.revisjon ? null : Number(e.target.value))}>
              {Array.from({ length: gren.revisjon }, (_, i) => gren.revisjon - i).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {siste && gren.status === 'klar' && (
          <>
            <Button variant="kant" disabled={arbeider} onClick={() => setVurderer('godkjent')}>
              Godkjenn
            </Button>
            <Button variant="kant" disabled={arbeider} onClick={() => setVurderer('endringer')}>
              Be om endringer
            </Button>
          </>
        )}
        {siste && kanPubliseres(gren) && (
          <Button variant="primary" disabled={arbeider} onClick={() => void publiser()}>
            Publiser
          </Button>
        )}
        {erAktiv(gren.status) && gren.status !== 'stanset' && (
          <Button variant="kant" disabled={arbeider} onClick={() => void utfor(() => klient.stans(gren.id))}>
            Stans
          </Button>
        )}
        {gren.status === 'stanset' && (
          <Button variant="kant" disabled={arbeider} onClick={() => void utfor(() => klient.gjenoppta(gren.id))}>
            Gjenoppta
          </Button>
        )}
        {erAktiv(gren.status) && (
          <Bekreftknapp
            ikon="trash"
            tekst="Forkast grenen"
            bekreftTekst="Bekreft"
            bekreftEtikett="Bekreft at grenen forkastes. Fagsiden blir som den er."
            onBekreft={() => void utfor(() => klient.forkast(gren.id))}
          />
        )}
        {gren.publisert_versjon && (
          <Button variant="kant" onClick={() => onGaaTil({ side: 'versjon', stoff: gren.stoff, nr: gren.publisert_versjon! })}>
            Se versjon {gren.publisert_versjon}
          </Button>
        )}
      </div>

      {vurderer && (
        <form
          className="utgavebanner__skjema"
          onSubmit={(e) => {
            e.preventDefault()
            void vurder(vurderer)
          }}
        >
          <label>
            {vurderer === 'godkjent' ? 'Hva er kontrollert' : 'Hva må endres'}
            <textarea value={begrunnelse} onChange={(e) => setBegrunnelse(e.target.value)} required />
          </label>
          <div className="utgavebanner__handlinger">
            <Button type="submit" disabled={arbeider}>
              {vurderer === 'godkjent' ? `Godkjenn revisjon ${gren.revisjon}` : 'Send tilbake til kuratoren'}
            </Button>
            <Button variant="subtle" type="button" onClick={() => setVurderer(null)}>
              Avbryt
            </Button>
          </div>
        </form>
      )}
      {melding && <p className="utgavebanner__linje">{melding}</p>}
      {feil && (
        <p className="utgavebanner__feil" role="alert">
          {feil}
        </p>
      )}
    </div>
  )
}
