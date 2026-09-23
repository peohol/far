import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { formatNumber, round } from '../../domain/bands'
import { regelsettband } from '../../domain/intervallregler'
import { endredeFelt, sammenlignFelter } from '../../faginnhold/historikk'
import { Samtidighetskonflikt } from '../../faginnhold/lagring'
import type { Utgave } from '../../faginnhold/lesing'
import { lesTallfelt, tallTilFelt } from '../../faginnhold/paneler'
import { KONSENTRASJONSNIVAER, MALEENHETER, type Intervallregelsett } from '../../regler/modell'
import {
  brukKommentar,
  delIntervall,
  egenKommentar,
  klargjor,
  kontrollerDeling,
  kontrollerRegelsett,
  ringstart,
  settCutoff,
  settCutoffKommentar,
  settDesimaler,
  settKommentartekst,
  settNiva,
  settRing,
  settSkillepunkt,
  slaSammen,
  steg,
} from '../../regler/redigering'
import { NIVANAVN, regelsettfelter } from '../../regler/visning'
import type { Level } from '../../types'
import { Button } from '../Button'
import { Tallfelt } from '../Tallfelt'
import { Endringsliste } from '../historikk/Historikkvindu'
import { Regelsimulator } from './Regeltabell'

export interface RegelredigeringProps {
  start: Intervallregelsett
  /** Lagrer utkastet, mot en nyere revisjon når brukeren har valgt å lagre over den. */
  onLagre: (innhold: Intervallregelsett, forventetRevisjon?: number) => Promise<void>
  /** Utkastet slik det står i databasen nå. */
  hentNyeste: () => Promise<Utgave<Intervallregelsett> | null>
  onAvbryt: () => void
}

/**
 * Redigeringen av et regelsett, i stedet for tabellen mens den pågår.
 *
 * Intervallene står nedenfra og opp med grensen mellom hver av dem som et
 * eget felt — en grense er delt av to naboer og endres derfor ett sted.
 * Kommentarene redigeres der de brukes; bruker flere intervaller den samme,
 * sies det, og intervallet kan få sin egen. Simulatoren under prøver utkastet
 * slik det står i skjemaet.
 *
 * Alt lagres som utkast i én revisjon. Har noen andre lagret i mellomtiden,
 * står det brukeren har gjort, og hen kan sammenligne med det de lagret før
 * hen velger.
 */
export function Regelredigering({ start, onLagre, hentNyeste, onAvbryt }: RegelredigeringProps) {
  const [regelsett, setRegelsett] = useState(start)
  /** Grensene slik de står i feltene, også mens et tall skrives. */
  const [grenser, setGrenser] = useState(() => start.skillepunkter.map(tallTilFelt))
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const [konflikt, setKonflikt] = useState<{ nyeste: Utgave<Intervallregelsett> | null } | null>(null)
  const tittel = useId()

  const band = useMemo(() => regelsettband(regelsett), [regelsett])

  /** En endring som flytter, legger til eller fjerner grenser. Feltene følger med. */
  const omforme = (neste: Intervallregelsett) => {
    setRegelsett(neste)
    setGrenser(neste.skillepunkter.map(tallTilFelt))
  }

  const endreGrense = (i: number, tekst: string) => {
    setGrenser((g) => g.map((t, j) => (j === i ? tekst : t)))
    const verdi = lesTallfelt(tekst)
    if (typeof verdi === 'number') setRegelsett((r) => settSkillepunkt(r, i, verdi))
  }

  const lagre = async (forventetRevisjon?: number) => {
    if (grenser.some((g) => typeof lesTallfelt(g) !== 'number')) {
      setFeil('Alle grensene må være tall.')
      return
    }
    const innhold = klargjor(regelsett)
    const kontroll = kontrollerRegelsett(innhold)
    if (kontroll) {
      setFeil(kontroll)
      return
    }
    setLagrer(true)
    setFeil(null)
    try {
      await onLagre(innhold, forventetRevisjon)
    } catch (e) {
      if (e instanceof Samtidighetskonflikt) setKonflikt({ nyeste: null })
      else setFeil((e as Error).message)
      setLagrer(false)
    }
  }

  const ring = ringstart(regelsett)
  const kanRinge = regelsett.intervaller.length > 1

  return (
    <form
      className="redigering regelredigering"
      aria-labelledby={tittel}
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        void lagre()
      }}
      noValidate
    >
      <p id={tittel} className="redigering__tittel">
        Rediger: Fortolkningsreglene for {regelsett.analyttkode}
      </p>

      <div className="feltrad">
        <Valgfelt
          merke="Enhet"
          verdi={regelsett.enhet}
          valg={MALEENHETER.map((e) => ({ verdi: e, tekst: e }))}
          onEndre={(enhet) => setRegelsett((r) => ({ ...r, enhet }))}
        />
        <Valgfelt
          merke="Desimaler i konsentrasjonen"
          verdi={String(regelsett.desimaler)}
          valg={[0, 1, 2, 3, 4, 5, 6].map((d) => ({ verdi: String(d), tekst: String(d) }))}
          onEndre={(d) => setRegelsett((r) => settDesimaler(r, Number(d)))}
        />
      </div>

      <ol className="regelredigering__intervaller">
        {regelsett.intervaller.map((_, i) => (
          <Intervallredigering
            key={i}
            regelsett={regelsett}
            indeks={i}
            etikett={`${band[i]?.label ?? ''} ${regelsett.enhet}`}
            onEndre={setRegelsett}
            onOmforme={omforme}
            grense={
              i < regelsett.skillepunkter.length ? (
                <Grensefelt
                  merke={`Grense mellom intervall ${i + 1} og ${i + 2}`}
                  hjelp={`Fra og med dette tallet gjelder intervall ${i + 2}.`}
                  verdi={grenser[i] ?? ''}
                  onEndre={(t) => endreGrense(i, t)}
                />
              ) : null
            }
          />
        ))}
      </ol>

      <fieldset className="regelredigering__gruppe">
        <legend>Ring rekvirent</legend>
        <Valgfelt
          merke="Ring rekvirent fra og med"
          verdi={ring ? String(ring.indeks) : ''}
          valg={[
            { verdi: '', tekst: 'Aldri' },
            ...band.slice(1).map((b, n) => ({ verdi: String(n + 1), tekst: `Intervall ${n + 2} (${b.label} ${regelsett.enhet})` })),
          ]}
          onEndre={(v) =>
            setRegelsett((r) => settRing(r, v === '' ? null : { indeks: Number(v), over: ringstart(r)?.over ?? false }))
          }
          disabled={!kanRinge}
        />
        {ring && ring.indeks > 0 && (
          <Ringegrensevalg regelsett={regelsett} indeks={ring.indeks} over={ring.over} onEndre={setRegelsett} />
        )}
      </fieldset>

      <Cutoffredigering regelsett={regelsett} band={band.map((b) => b.label)} onEndre={setRegelsett} />

      <Regelsimulator regelsett={regelsett} />

      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      {konflikt && (
        <Konflikt
          mine={regelsett}
          nyeste={konflikt.nyeste}
          onSammenlign={async () => setKonflikt({ nyeste: await hentNyeste() })}
          onLagreLikevel={(revisjon) => void lagre(revisjon)}
          onForkast={onAvbryt}
          lagrer={lagrer}
        />
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onAvbryt}>
          Avbryt
        </Button>
        <Button type="submit" className="knapp--kompakt" disabled={lagrer || konflikt !== null}>
          {lagrer ? 'Lagrer …' : 'Lagre utkast'}
        </Button>
      </div>
    </form>
  )
}

/* --- Ett intervall -------------------------------------------------------- */

function Intervallredigering({
  regelsett,
  indeks,
  etikett,
  grense,
  onEndre,
  onOmforme,
}: {
  regelsett: Intervallregelsett
  indeks: number
  etikett: string
  /** Feltet for grensen over intervallet, eller `null` for det øverste. */
  grense: ReactNode
  onEndre: (neste: (r: Intervallregelsett) => Intervallregelsett) => void
  onOmforme: (neste: Intervallregelsett) => void
}) {
  const [deler, setDeler] = useState<string | null>(null)
  const [delefeil, setDelefeil] = useState<string | null>(null)
  const regel = regelsett.intervaller[indeks]!
  const kommentar = regelsett.kommentarer.find((k) => k.id === regel.kommentar)
  const brukere = kommentarbrukere(regelsett, regel.kommentar).filter((b) => b !== `intervall ${indeks + 1}`)
  const delesMedIntervall = regelsett.intervaller.some((r, i) => i !== indeks && r.kommentar === regel.kommentar)
  const andre = kommentarvalg(regelsett)
  const overst = indeks === regelsett.intervaller.length - 1

  const del = () => {
    const verdi = lesTallfelt(deler ?? '')
    const feil = typeof verdi === 'number' ? kontrollerDeling(regelsett, indeks, verdi) : 'Skriv grensen som et tall.'
    if (feil || typeof verdi !== 'number') {
      setDelefeil(feil)
      return
    }
    onOmforme(delIntervall(regelsett, indeks, verdi))
    setDeler(null)
    setDelefeil(null)
  }

  return (
    <li className="regelredigering__plass">
      <fieldset className={`regelredigering__intervall regelredigering__intervall--${regel.niva}`}>
        <legend>
          Intervall {indeks + 1}: {etikett}
        </legend>
        <div className="feltrad">
          <Valgfelt
            merke="Nivå"
            verdi={regel.niva}
            valg={KONSENTRASJONSNIVAER.map((n) => ({ verdi: n, tekst: NIVANAVN[n] }))}
            onEndre={(n) => onEndre((r) => settNiva(r, indeks, n as Level))}
          />
          {andre.length > 1 && (
            <Valgfelt
              merke="Bruker kommentaren til"
              verdi={regel.kommentar}
              valg={andre}
              onEndre={(id) => onOmforme(brukKommentar(regelsett, indeks, id))}
            />
          )}
        </div>
        <Tekstomrade
          merke="Kommentartekst"
          verdi={kommentar?.tekst ?? ''}
          hjelp={brukere.length > 0 ? `Samme tekst brukes også av ${oppramsing(brukere)}. Endringen gjelder alle.` : undefined}
          onEndre={(tekst) => onEndre((r) => settKommentartekst(r, regel.kommentar, tekst))}
        />
        {deler === null ? (
          <div className="redigeringsrad">
            {delesMedIntervall && (
              <Button variant="subtle" className="redigeringsknapp" onClick={() => onOmforme(egenKommentar(regelsett, indeks))}>
                Gi intervallet egen kommentar
              </Button>
            )}
            <Button variant="subtle" className="redigeringsknapp" onClick={() => setDeler('')}>
              Del intervallet
            </Button>
            {!overst && (
              <Button
                variant="subtle"
                className="redigeringsknapp"
                onClick={() => onOmforme(slaSammen(regelsett, indeks))}
              >
                Slå sammen med intervallet over
              </Button>
            )}
          </div>
        ) : (
          <div className="regelredigering__deling">
            <Grensefelt
              merke="Ny grense inne i intervallet"
              hjelp="Begge delene får regelen og kommentaren intervallet har nå."
              verdi={deler}
              onEndre={setDeler}
            />
            {delefeil && (
              <p className="skjemafeil" role="alert">
                {delefeil}
              </p>
            )}
            <div className="redigeringsrad">
              <Button variant="subtle" className="redigeringsknapp" onClick={() => setDeler(null)}>
                Avbryt
              </Button>
              <Button className="knapp--kompakt" onClick={del}>
                Del her
              </Button>
            </div>
          </div>
        )}
      </fieldset>
      {grense && <div className="regelredigering__grense">{grense}</div>}
    </li>
  )
}

/* --- Ringegrensen og cut-off --------------------------------------------- */

function Ringegrensevalg({
  regelsett,
  indeks,
  over,
  onEndre,
}: {
  regelsett: Intervallregelsett
  indeks: number
  over: boolean
  onEndre: (neste: (r: Intervallregelsett) => Intervallregelsett) => void
}) {
  const navn = useId()
  const fra = regelsett.skillepunkter[indeks - 1]!
  const d = regelsett.desimaler
  const alternativer = [
    { over: false, tekst: `${formatNumber(fra, d)} ${regelsett.enhet} (grensen selv)` },
    {
      over: true,
      tekst: `${formatNumber(round(fra - steg(d), d), d)} ${regelsett.enhet} (ett steg under, for regler «over ringegrensen»)`,
    },
  ]
  return (
    <fieldset className="regelredigering__valg">
      <legend className="felt__merkelapp">Ringegrensen vises som</legend>
      {alternativer.map((a) => (
        <label key={String(a.over)} className="regler__avkryssing">
          <input
            type="radio"
            name={navn}
            checked={over === a.over}
            onChange={() => onEndre((r) => settRing(r, { indeks, over: a.over }))}
          />
          {a.tekst}
        </label>
      ))}
    </fieldset>
  )
}

function Cutoffredigering({
  regelsett,
  band,
  onEndre,
}: {
  regelsett: Intervallregelsett
  band: string[]
  onEndre: (neste: (r: Intervallregelsett) => Intervallregelsett) => void
}) {
  const { cutoff } = regelsett
  const innledning = cutoff && regelsett.kommentarer.find((k) => k.id === cutoff.innledning)
  return (
    <fieldset className="regelredigering__gruppe">
      <legend>Til stede under cut-off</legend>
      <label className="regler__avkryssing">
        <input type="checkbox" checked={cutoff !== null} onChange={(e) => onEndre((r) => settCutoff(r, e.target.checked))} />
        Har valget «Til stede under cut-off»
      </label>
      {cutoff && (
        <>
          <Tekstomrade
            merke="Innledning"
            verdi={innledning?.tekst ?? ''}
            hjelp="Settes foran kommentaren under, med mellomrom mellom."
            onEndre={(tekst) => onEndre((r) => settKommentartekst(r, cutoff.innledning, tekst))}
          />
          <Valgfelt
            merke="Settes foran kommentaren til"
            verdi={cutoff.kommentar}
            valg={kommentarvalg(regelsett, band)}
            onEndre={(id) => onEndre((r) => settCutoffKommentar(r, id))}
          />
        </>
      )}
    </fieldset>
  )
}

/* --- Konflikten ----------------------------------------------------------- */

function Konflikt({
  mine,
  nyeste,
  onSammenlign,
  onLagreLikevel,
  onForkast,
  lagrer,
}: {
  mine: Intervallregelsett
  nyeste: Utgave<Intervallregelsett> | null
  onSammenlign: () => Promise<void>
  onLagreLikevel: (revisjon: number) => void
  onForkast: () => void
  lagrer: boolean
}) {
  const [feil, setFeil] = useState<string | null>(null)
  const endringer = nyeste ? sammenlignFelter(regelsettfelter(nyeste.innhold), regelsettfelter(mine)) : []
  return (
    <div className="sidevarsel regelredigering__konflikt" role="alert">
      <p>
        Noen andre har lagret reglene mens du redigerte. Ingenting er skrevet over, og det du har gjort, står fortsatt
        her.
      </p>
      {nyeste ? (
        <>
          <p>
            Dette er forskjellen mellom det de lagret (revisjon {nyeste.revisjon}) og ditt. Rødt er deres, grønt er ditt
            {endredeFelt(regelsettfelter(nyeste.innhold), regelsettfelter(mine)).length === 0 && ' — de er like'}.
          </p>
          <Endringsliste endringer={endringer} forste={false} />
          <div className="skjema__knapper">
            <Button variant="subtle" onClick={onForkast}>
              Forkast mine endringer
            </Button>
            <Button className="knapp--kompakt" disabled={lagrer} onClick={() => onLagreLikevel(nyeste.revisjon)}>
              Lagre mine over deres
            </Button>
          </div>
        </>
      ) : (
        <div className="skjema__knapper">
          <Button variant="subtle" onClick={onForkast}>
            Forkast mine endringer
          </Button>
          <Button
            className="knapp--kompakt"
            onClick={() => onSammenlign().catch((e: Error) => setFeil(e.message))}
          >
            Sammenlign med deres
          </Button>
        </div>
      )}
      {feil && <p className="skjemafeil">{feil}</p>}
    </div>
  )
}

/* --- Felles biter ----------------------------------------------------------- */

/** Hvem som bruker en kommentar: «intervall 2», «cut-off». */
function kommentarbrukere(regelsett: Intervallregelsett, id: string): string[] {
  const brukere = regelsett.intervaller.flatMap((r, i) => (r.kommentar === id ? [`intervall ${i + 1}`] : []))
  if (regelsett.cutoff?.kommentar === id) brukere.push('cut-off')
  return brukere
}

/** Kommentarene intervallene bruker, hver én gang, navngitt etter det første intervallet som bruker den. */
function kommentarvalg(regelsett: Intervallregelsett, band?: string[]): { verdi: string; tekst: string }[] {
  const sett = new Set<string>()
  const valg: { verdi: string; tekst: string }[] = []
  regelsett.intervaller.forEach((r, i) => {
    if (sett.has(r.kommentar)) return
    sett.add(r.kommentar)
    const intervaller = regelsett.intervaller.flatMap((s, j) => (s.kommentar === r.kommentar ? [j + 1] : []))
    const navn = `Intervall ${oppramsing(intervaller.map(String))}`
    valg.push({ verdi: r.kommentar, tekst: band ? `${navn} (${band[i]})` : navn })
  })
  return valg
}

function oppramsing(deler: string[]): string {
  if (deler.length < 2) return deler.join('')
  return `${deler.slice(0, -1).join(', ')} og ${deler.at(-1)}`
}

function Valgfelt({
  merke,
  verdi,
  valg,
  onEndre,
  disabled,
}: {
  merke: string
  verdi: string
  valg: { verdi: string; tekst: string }[]
  onEndre: (verdi: string) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="felt">
      <label className="felt__merkelapp" htmlFor={id}>
        {merke}
      </label>
      <select id={id} className="felt__inndata" value={verdi} disabled={disabled} onChange={(e) => onEndre(e.target.value)}>
        {valg.map((v) => (
          <option key={v.verdi} value={v.verdi}>
            {v.tekst}
          </option>
        ))}
      </select>
    </div>
  )
}

function Tekstomrade({
  merke,
  verdi,
  hjelp,
  onEndre,
}: {
  merke: string
  verdi: string
  hjelp?: string
  onEndre: (verdi: string) => void
}) {
  const id = useId()
  return (
    <div className="felt">
      <label className="felt__merkelapp" htmlFor={id}>
        {merke}
      </label>
      <textarea
        id={id}
        className="felt__inndata felt__inndata--flerlinje"
        rows={3}
        value={verdi}
        aria-describedby={hjelp ? `${id}-hjelp` : undefined}
        onChange={(e) => onEndre(e.target.value)}
      />
      {hjelp && (
        <span id={`${id}-hjelp`} className="felt__hjelp">
          {hjelp}
        </span>
      )}
    </div>
  )
}

function Grensefelt({
  merke,
  hjelp,
  verdi,
  onEndre,
}: {
  merke: string
  hjelp: string
  verdi: string
  onEndre: (verdi: string) => void
}) {
  const id = useId()
  return (
    <div className="felt">
      <label className="felt__merkelapp" htmlFor={id}>
        {merke}
      </label>
      <Tallfelt
        id={id}
        className="felt__inndata regelredigering__tall"
        value={verdi}
        aria-describedby={`${id}-hjelp`}
        onChange={onEndre}
      />
      <span id={`${id}-hjelp`} className="felt__hjelp">
        {hjelp}
      </span>
    </div>
  )
}
