import { useCallback, useEffect, useMemo, useState } from 'react'
import { klient } from '../../auth/klient'
import {
  endringstittel,
  feltendringer,
  feltnavn,
  jobbnavn,
  KILDEOPPSETT,
  lagDatakildeleser,
  sporlinje,
  vurderKilder,
  type Datakilde,
  type Datakildeleser,
  type Datakildestatus,
  type Kildevurdering,
  type Kjoringsstatus,
  type Tilstand,
} from '../../datakilder/status'
import { tidspunkt } from '../../faginnhold/historikk'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Merke, type Merketone } from '../Merke'
import { Modallag } from '../Modallag'
import '../../styles/datakilder.css'

const TILSTAND: Record<Tilstand, { tekst: string; tone: Merketone }> = {
  ok: { tekst: 'I orden', tone: 'referanse' },
  advarsel: { tekst: 'Se over', tone: 'toksisk' },
  feil: { tekst: 'Feilet', tone: 'alvorlig' },
}

const STATUSNAVN: Record<Kjoringsstatus, string> = {
  pagar: 'Pågår',
  fullfort: 'Fullført',
  delvis: 'Delvis',
  uendret: 'Uendret',
  feilet: 'Feilet',
}

/** Flest endringer som vises per kilde; de nyeste først. */
const MAKS_ENDRINGER = 50

/**
 * Driftstatusen for datakildene, for administratorer: hvordan siste henting
 * fra FEST, ClinPGx og CPIC gikk, de siste kjøringene, og hva som er endret —
 * i ClinPGx og CPIC de kliniske endringene først, metadataene på
 * forespørsel; i FEST antallet nye, endrede og utgåtte rader. «Hent nå» ber
 * serveren hente med en gang, som den planlagte jobben.
 *
 * Tilgangen avgjøres i databasen (`datakilder_status()` er bare for
 * administratorer); dette er bare visningen.
 */
export function Datakilder({ apen, onLukk, leser: egenLeser }: { apen: boolean; onLukk: () => void; leser?: Datakildeleser }) {
  // Klienten lages først når panelet åpnes.
  const leser = useMemo(() => egenLeser ?? (apen ? lagDatakildeleser(klient()) : null), [apen, egenLeser])
  const [status, setStatus] = useState<Datakildestatus | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const [henter, setHenter] = useState<Datakilde | null>(null)
  const [kvittering, setKvittering] = useState<Partial<Record<Datakilde, string>>>({})
  const [metadata, setMetadata] = useState(false)

  const les = useCallback(async () => {
    if (!leser) return
    try {
      setStatus(await leser.status())
      setFeil(null)
    } catch (e) {
      setFeil(e instanceof Error ? e.message : 'Fikk ikke hentet statusen.')
    }
  }, [leser])

  useEffect(() => {
    if (!apen) return
    setKvittering({})
    void les()
  }, [apen, les])

  const hentNa = async (kilde: Datakilde) => {
    if (!leser || henter) return
    setHenter(kilde)
    try {
      const svar = await leser.hentNa(kilde)
      setKvittering((k) => ({
        ...k,
        [kilde]: svar.status === 'feilet' ? `Hentingen feilet: ${svar.feil ?? 'ukjent feil'}` : `Hentingen er ferdig (${STATUSNAVN[svar.status as Kjoringsstatus] ?? svar.status}).`,
      }))
    } catch (e) {
      setKvittering((k) => ({ ...k, [kilde]: e instanceof Error ? e.message : 'Hentingen feilet.' }))
    } finally {
      setHenter(null)
      await les()
    }
  }

  const vurderinger = useMemo(() => (status ? vurderKilder(status) : []), [status])

  return (
    <Modallag apen={apen} tittel="Datakilder" ikon="reset" bred onLukk={onLukk}>
      <p className="datakilder__ingress">
        Legemiddeldata fra FEST og farmakogenetiske data fra ClinPGx og CPIC: hvordan siste henting gikk, og hva som
        er endret siden forrige. Ingenting her vises for andre enn administratorer.
      </p>
      <label className="datakilder__valg">
        <input type="checkbox" checked={metadata} onChange={(e) => setMetadata(e.target.checked)} />
        Vis også endringer i metadata
      </label>
      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      {!status && !feil && <p className="datakilder__tomt">Henter statusen …</p>}
      {vurderinger.map((v) => (
        <Kilde
          key={v.kilde}
          vurdering={v}
          metadata={metadata}
          henter={henter}
          kvittering={kvittering[v.kilde] ?? null}
          onHent={() => void hentNa(v.kilde)}
        />
      ))}
    </Modallag>
  )
}

function Kilde({
  vurdering: v,
  metadata,
  henter,
  kvittering,
  onHent,
}: {
  vurdering: Kildevurdering
  metadata: boolean
  henter: Datakilde | null
  kvittering: string | null
  onHent: () => void
}) {
  const { versjonsnavn, visVersjon, endringslogg } = KILDEOPPSETT[v.kilde]
  const tilstand = TILSTAND[v.tilstand]

  return (
    <section className="datakilde" aria-labelledby={`datakilde-${v.kilde}`}>
      <header className="datakilde__hode">
        <h3 id={`datakilde-${v.kilde}`} className="datakilde__navn">
          {v.navn}
        </h3>
        <Merke tone={tilstand.tone}>{tilstand.tekst}</Merke>
        <Button
          variant="kant"
          icon={<Ikon navn="reset" />}
          disabled={henter !== null}
          aria-label={`Hent fra ${v.navn} nå`}
          onClick={onHent}
        >
          {henter === v.kilde ? 'Henter …' : 'Hent nå'}
        </Button>
      </header>
      <p className="datakilde__melding">{v.melding}</p>
      <p className="skjemakvittering" role="status">
        {kvittering}
      </p>

      <dl className="datakilde__fakta">
        <div>
          <dt>Siste vellykkede henting</dt>
          <dd>{v.sistVellykketKl ? tidspunkt(v.sistVellykketKl) : '–'}</dd>
        </div>
        {v.kilde === 'cpic' && (
          <div>
            <dt>Release</dt>
            <dd>{v.release ?? '–'}</dd>
          </div>
        )}
        <div>
          <dt>{versjonsnavn}</dt>
          <dd>{v.versjon ? (visVersjon?.(v.versjon) ?? v.versjon) : '–'}</dd>
        </div>
      </dl>

      {v.kjoringer.length > 0 && (
        <details className="datakilde__bolk">
          <summary>Siste kjøringer</summary>
          <table className="datakilde__tabell">
            <thead>
              <tr>
                <th scope="col">Startet</th>
                <th scope="col">Status</th>
                <th scope="col">Utløst av</th>
                {endringslogg ? (
                  <>
                    <th scope="col">Kliniske</th>
                    <th scope="col">Metadata</th>
                  </>
                ) : (
                  <>
                    <th scope="col">Nye</th>
                    <th scope="col">Endrede</th>
                    <th scope="col">Utgåtte</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {v.kjoringer.map((k) => (
                <tr key={k.id}>
                  <td>{tidspunkt(k.startet_kl)}</td>
                  <td title={k.feil ?? undefined}>{STATUSNAVN[k.status]}</td>
                  <td>{k.utlost_av === 'manuell' ? 'Administrator' : jobbnavn(v.intervall)}</td>
                  {endringslogg ? (
                    <>
                      <td>{k.endringer.klinisk}</td>
                      <td>{k.endringer.metadata}</td>
                    </>
                  ) : (
                    <>
                      <td>{k.rader?.nye ?? '–'}</td>
                      <td>{k.rader?.endrede ?? '–'}</td>
                      <td>{k.rader?.utgatte ?? '–'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {endringslogg ? (
        <Endringsliste endringer={v.endringer} metadata={metadata} />
      ) : (
        <p className="datakilder__tomt">
          Endringene i {v.navn} logges ikke enkeltvis; kjøringene over viser hvor mange rader som ble nye, endret eller
          utgått.
        </p>
      )}
    </section>
  )
}

/** De loggede endringene fra en kilde, de kliniske først og metadataene når de slås på. */
function Endringsliste({ endringer, metadata }: { endringer: Kildevurdering['endringer']; metadata: boolean }) {
  const synlige = endringer.filter((e) => metadata || e.niva === 'klinisk' || e.art === 'grunnlag')
  return (
    <>
      <h4 className="datakilde__undertittel">{metadata ? 'Endringer' : 'Kliniske endringer'}</h4>
      {synlige.length === 0 ? (
        <p className="datakilder__tomt">Ingen {metadata ? '' : 'kliniske '}endringer er logget.</p>
      ) : (
        <ul className="endringsliste">
          {synlige.slice(0, MAKS_ENDRINGER).map((e) => {
            const felt = feltendringer(e)
            const spor = sporlinje(e)
            return (
              <li key={e.id} className={`endringsrad endringsrad--${e.niva}`}>
                <span className="endringsrad__hode">
                  <span className="endringsrad__tittel">{endringstittel(e)}</span>
                  {e.art !== 'grunnlag' && <Merke tone={e.niva === 'klinisk' ? 'aksent' : 'noytral'}>{e.niva === 'klinisk' ? 'Klinisk' : 'Metadata'}</Merke>}
                  <span className="endringsrad__tid">{tidspunkt(e.registrert_kl)}</span>
                </span>
                <span className="endringsrad__etikett">{e.etikett}</span>
                {e.felt.length > 0 && <span className="endringsrad__felt">Felt: {e.felt.map(feltnavn).join(', ')}</span>}
                {spor && <span className="endringsrad__spor">{spor}</span>}
                {felt.length > 0 && (
                  <details className="endringsrad__detaljer">
                    <summary>Før og etter</summary>
                    <dl>
                      {felt.map((f) => (
                        <div key={f.felt}>
                          <dt>{f.felt}</dt>
                          <dd>
                            <span className="endringsrad__foer">
                              <span className="endringsrad__verdinavn">Før</span> {f.foer}
                            </span>
                            <span className="endringsrad__etter">
                              <span className="endringsrad__verdinavn">Etter</span> {f.etter}
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {synlige.length > MAKS_ENDRINGER && (
        <p className="datakilder__tomt">Viser de {MAKS_ENDRINGER} nyeste av {synlige.length}.</p>
      )}
    </>
  )
}
