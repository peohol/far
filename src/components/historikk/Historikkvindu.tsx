import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import {
  beskrivHandling,
  forrigeSynlige,
  hvemOgNar,
  ordforskjell,
  sammenlignFelter,
  type Felt,
  type Feltendring,
  type Historikk,
} from '../../faginnhold/historikk'
import { Samtidighetskonflikt } from '../../faginnhold/lagring'
import { Button } from '../Button'
import { Modallag } from '../Modallag'
import { useFaginnholdskilde } from '../analyttside/Faginnholdskilde'

export interface HistorikkvinduProps<T> {
  apen: boolean
  /** Hva historikken gjelder, f.eks. «Referanseområde». */
  navn: string
  objekt: string
  /** Hvordan innholdet deles i felt for sammenligningen. */
  felter: (innhold: T) => Felt[]
  /** Revisjonen utkastet står på. Uten den kan ingenting gjenopprettes. */
  gjeldende?: number
  /** Gjenoppretter en tidligere revisjon som en ny. Utelatt for dem som bare leser. */
  onGjenopprett?: (fraRevisjon: number) => Promise<void>
  onLukk: () => void
}

type Visning = 'endringer' | 'side'

type Lasting<T> = { status: 'laster' } | { status: 'feil'; feil: string } | { status: 'klar'; historikk: Historikk<T> }

/**
 * Historikken til ett objekt: hver revisjon med hvem som gjorde hva og når,
 * og hva som ble endret.
 *
 * Sammenligningen har to visninger, som planen krever: endringene, med det
 * som er fjernet rødt og gjennomstreket og det som er lagt til grønt, og de to
 * revisjonene side om side. Innholdet sammenlignes felt for felt (se
 * `src/faginnhold/historikk.ts`); bare fritekst sammenlignes ord for ord.
 *
 * Administratorer kan gjenopprette en tidligere revisjon. Det lager en ny
 * revisjon med det gamle innholdet; ingenting slettes.
 */
export function Historikkvindu<T>({
  apen,
  navn,
  objekt,
  felter,
  gjeldende,
  onGjenopprett,
  onLukk,
}: HistorikkvinduProps<T>) {
  const { leser } = useFaginnholdskilde()
  const [lasting, setLasting] = useState<Lasting<T>>({ status: 'laster' })
  const [runde, setRunde] = useState(0)
  const [valgt, setValgt] = useState<number | null>(null)
  const [motRevisjon, setMotRevisjon] = useState<number | null | undefined>(undefined)
  const [visning, setVisning] = useState<Visning>('endringer')

  useEffect(() => {
    if (!apen) return
    let gjelder = true
    setLasting({ status: 'laster' })
    leser
      .lesHistorikk<T>(objekt)
      .then((historikk) => {
        if (!gjelder) return
        setLasting({ status: 'klar', historikk })
        setValgt(historikk.revisjoner.at(-1)?.revisjon ?? null)
        setMotRevisjon(undefined)
      })
      .catch((e: Error) => {
        if (gjelder) setLasting({ status: 'feil', feil: e.message })
      })
    return () => {
      gjelder = false
    }
  }, [apen, leser, objekt, runde])

  const historikk = lasting.status === 'klar' ? lasting.historikk : null
  const valgtBilde = historikk?.revisjoner.find((r) => r.revisjon === valgt) ?? null
  // Uten eget valg sammenlignes det med den nærmeste eldre revisjonen.
  const motBilde =
    historikk && valgt !== null
      ? motRevisjon === undefined
        ? forrigeSynlige(historikk, valgt)
        : (historikk.revisjoner.find((r) => r.revisjon === motRevisjon) ?? null)
      : null

  const endringer = useMemo(
    () => (valgtBilde ? sammenlignFelter(motBilde ? felter(motBilde.innhold) : [], felter(valgtBilde.innhold)) : []),
    [valgtBilde, motBilde, felter],
  )

  const velg = (revisjon: number) => {
    setValgt(revisjon)
    setMotRevisjon(undefined)
  }

  return (
    <Modallag apen={apen} tittel={`Historikk: ${navn}`} ikon="history" onLukk={onLukk} bred>
      {lasting.status === 'laster' && <p role="status">Henter historikken …</p>}
      {lasting.status === 'feil' && (
        <p className="skjemafeil" role="alert">
          Fikk ikke hentet historikken. {lasting.feil}
        </p>
      )}
      {historikk && (
        <div className="historikk">
          <Tidslinje historikk={historikk} valgt={valgt} gjeldende={gjeldende} onVelg={velg} />
          {valgtBilde ? (
            <div className="historikk__sammenligning">
              <Sammenligningsvalg
                historikk={historikk}
                valgt={valgtBilde.revisjon}
                mot={motBilde?.revisjon ?? null}
                onMot={setMotRevisjon}
                visning={visning}
                onVisning={setVisning}
              />
              {visning === 'endringer' ? (
                <Endringsliste endringer={endringer} forste={!motBilde} />
              ) : (
                <SideOmSide endringer={endringer} for_={motBilde?.revisjon ?? null} etter={valgtBilde.revisjon} />
              )}
              {onGjenopprett && gjeldende !== undefined && valgtBilde.revisjon !== gjeldende && (
                <Gjenoppretting
                  revisjon={valgtBilde.revisjon}
                  onGjenopprett={onGjenopprett}
                  onFerdig={() => setRunde((r) => r + 1)}
                />
              )}
            </div>
          ) : (
            <p>Ingen revisjoner å vise.</p>
          )}
        </div>
      )}
    </Modallag>
  )
}

/* --- Tidslinjen ----------------------------------------------------------- */

function Tidslinje({
  historikk,
  valgt,
  gjeldende,
  onVelg,
}: {
  historikk: Historikk<unknown>
  valgt: number | null
  gjeldende?: number
  onVelg: (revisjon: number) => void
}) {
  const synlige = new Set(historikk.revisjoner.map((r) => r.revisjon))
  return (
    <ol className="historikk__tidslinje" aria-label="Revisjonene, nyeste først">
      {[...historikk.hendelser].reverse().map((hendelse) => {
        const kanVelges = synlige.has(hendelse.revisjon)
        const tekst = (
          <>
            <span className="historikk__handling">
              {hendelse.handling === 'publisert'
                ? `Publisert revisjon ${hendelse.revisjon}`
                : `Revisjon ${hendelse.revisjon}: ${beskrivHandling(hendelse).toLowerCase()}`}
              {hendelse.revisjon === gjeldende && hendelse.handling !== 'publisert' && ' (utkastet nå)'}
            </span>
            <span className="historikk__hvem">{hvemOgNar(hendelse)}</span>
            {hendelse.kilde && <span className="historikk__kilde">{hendelse.kilde}</span>}
          </>
        )
        return (
          <li key={`${hendelse.handling}-${hendelse.revisjon}`} className={`historikk__hendelse historikk__hendelse--${hendelse.handling}`}>
            {kanVelges ? (
              <button
                type="button"
                className="historikk__velg"
                aria-pressed={hendelse.revisjon === valgt}
                onClick={() => onVelg(hendelse.revisjon)}
              >
                {tekst}
              </button>
            ) : (
              <div className="historikk__velg">{tekst}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* --- Hva som sammenlignes, og hvordan ------------------------------------ */

function Sammenligningsvalg({
  historikk,
  valgt,
  mot,
  onMot,
  visning,
  onVisning,
}: {
  historikk: Historikk<unknown>
  valgt: number
  mot: number | null
  onMot: (revisjon: number | null) => void
  visning: Visning
  onVisning: (visning: Visning) => void
}) {
  const id = useId()
  const eldre = historikk.revisjoner.filter((r) => r.revisjon < valgt).reverse()
  return (
    <div className="historikk__valg">
      <div className="historikk__mot">
        <label htmlFor={id}>
          Revisjon {valgt} sammenlignet med
        </label>
        <select
          id={id}
          className="felt__inndata"
          value={mot ?? ''}
          onChange={(e) => onMot(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">ingenting (vis alt)</option>
          {eldre.map((r) => (
            <option key={r.revisjon} value={r.revisjon}>
              revisjon {r.revisjon}
            </option>
          ))}
        </select>
      </div>
      <div className="historikk__visning" role="group" aria-label="Visning">
        <Button variant="subtle" className="knapp--kompakt" aria-pressed={visning === 'endringer'} onClick={() => onVisning('endringer')}>
          Endringer
        </Button>
        <Button variant="subtle" className="knapp--kompakt" aria-pressed={visning === 'side'} onClick={() => onVisning('side')}>
          Side om side
        </Button>
      </div>
    </div>
  )
}

/* --- Visningene ----------------------------------------------------------- */

/** Teksten i et felt med det som er fjernet eller lagt til, merket. `side` velger hvilken side som vises. */
function Feltverdi({ endring, side }: { endring: Feltendring; side: 'for' | 'etter' | 'begge' }) {
  const { for: for_, etter } = endring
  if (!endring.endret) return <>{etter}</>
  if (endring.tekst && for_ !== null && etter !== null) {
    return (
      <>
        {ordforskjell(for_, etter).map((del, i) => {
          if (del.slag === 'lik') return <span key={i}>{del.tekst}</span>
          if (del.slag === 'fjernet') return side === 'etter' ? null : <del key={i}>{del.tekst}</del>
          return side === 'for' ? null : <ins key={i}>{del.tekst}</ins>
        })}
      </>
    )
  }
  return (
    <>
      {side !== 'etter' && for_ !== null && <del>{for_}</del>}
      {side === 'begge' && for_ !== null && etter !== null && ' '}
      {side !== 'for' && etter !== null && <ins>{etter}</ins>}
    </>
  )
}

/** Feltene med gruppene sine som mellomtitler, i rekkefølge. */
function grupper(endringer: readonly Feltendring[]): { gruppe: string | undefined; endringer: Feltendring[] }[] {
  const ut: { gruppe: string | undefined; endringer: Feltendring[] }[] = []
  for (const e of endringer) {
    const siste = ut.at(-1)
    if (siste && siste.gruppe === e.gruppe) siste.endringer.push(e)
    else ut.push({ gruppe: e.gruppe, endringer: [e] })
  }
  return ut
}

/**
 * Feltene som er endret, med det fjernede rødt og gjennomstreket og det nye
 * grønt. `forste` viser alle feltene som de er, uten noe å sammenligne med.
 */
export function Endringsliste({ endringer, forste }: { endringer: Feltendring[]; forste: boolean }) {
  const vises = forste ? endringer : endringer.filter((e) => e.endret)
  if (vises.length === 0) return <p className="historikk__ingen">Ingen forskjeller.</p>
  return (
    <div className="historikk__endringer">
      {grupper(vises).map(({ gruppe, endringer: felt }, i) => (
        <section key={`${gruppe ?? ''}-${i}`} className="historikk__gruppe">
          {gruppe && <h3 className="historikk__gruppetittel">{gruppe}</h3>}
          <dl className="historikk__felt">
            {felt.map((e) => (
              <div key={e.nokkel} className="historikk__rad">
                <dt>{e.navn}</dt>
                <dd>{forste ? e.etter : <Feltverdi endring={e} side="begge" />}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

function SideOmSide({ endringer, for_, etter }: { endringer: Feltendring[]; for_: number | null; etter: number }) {
  return (
    <div className="dosetabell__rull">
      <table className="dosetabell__tabell historikk__tabell">
        <thead>
          <tr>
            <th scope="col">Felt</th>
            <th scope="col">{for_ === null ? 'Før' : `Revisjon ${for_}`}</th>
            <th scope="col">Revisjon {etter}</th>
          </tr>
        </thead>
        <tbody>
          {endringer.map((e) => (
            <tr key={e.nokkel} className={e.endret ? 'historikk__endret' : undefined}>
              <th scope="row">{e.gruppe ? `${e.gruppe}: ${e.navn}` : e.navn}</th>
              <td>{e.endret ? <Feltverdi endring={e} side="for" /> : e.for}</td>
              <td>{e.endret ? <Feltverdi endring={e} side="etter" /> : e.etter}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* --- Gjenopprettingen ----------------------------------------------------- */

function Gjenoppretting({
  revisjon,
  onGjenopprett,
  onFerdig,
}: {
  revisjon: number
  onGjenopprett: (fra: number) => Promise<void>
  onFerdig: () => void
}) {
  const [bekrefter, setBekrefter] = useState(false)
  const [arbeider, setArbeider] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)

  useEffect(() => {
    setBekrefter(false)
    setFeil(null)
  }, [revisjon])

  const gjenopprett = useCallback(async () => {
    setArbeider(true)
    setFeil(null)
    try {
      await onGjenopprett(revisjon)
      setBekrefter(false)
      onFerdig()
    } catch (e) {
      setFeil(
        e instanceof Samtidighetskonflikt
          ? 'Noen andre har endret dette i mellomtiden. Lukk historikken og hent den nyeste utgaven først.'
          : (e as Error).message,
      )
    } finally {
      setArbeider(false)
    }
  }, [onGjenopprett, onFerdig, revisjon])

  if (!bekrefter) {
    return (
      <div className="skjema__knapper historikk__gjenopprett">
        <Button className="knapp--kompakt" onClick={() => setBekrefter(true)}>
          Gjenopprett revisjon {revisjon}
        </Button>
      </div>
    )
  }
  return (
    <div className="publisering historikk__gjenopprett">
      <p>
        Dette lager en ny revisjon av utkastet med alt innholdet fra revisjon {revisjon}. Ingenting slettes, og det blir
        ikke synlig for andre før det publiseres.
      </p>
      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={() => setBekrefter(false)}>
          Avbryt
        </Button>
        <Button className="knapp--kompakt" disabled={arbeider} onClick={() => void gjenopprett()}>
          {arbeider ? 'Gjenoppretter …' : 'Gjenopprett nå'}
        </Button>
      </div>
    </div>
  )
}
