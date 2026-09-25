import { useId, useMemo, useState, type FormEvent } from 'react'
import { lagThcModell } from '../../domain/thcMotor'
import {
  KURVEFARGE,
  THC_KURVEROLLER,
  normalkvantil,
  type ThcBruksmonster,
  type ThcKonsentrasjonsniva,
  type ThcKurve,
  type ThcKurverolle,
  type ThcRegelsett,
} from '../../domain/thcRegelsett'
import { THC_TEKSTBOLKER, THC_TEKSTNOKLER, type ThcTekster } from '../../domain/thcTekster'
import { marginmerke } from '../../domain/thcVisning'
import { Samtidighetskonflikt } from '../../faginnhold/lagring'
import { lesTallfelt, tallTilFelt } from '../../faginnhold/paneler'
import { thcEndringer, thcUtkastfeil, type ThcRegelsettutgave } from '../../faginnhold/thcregler'
import { Button } from '../Button'
import { Tallfelt } from '../Tallfelt'
import { Tekstomrade, Valgfelt } from './Regelfelter'
import { Thcsimulator } from './Thcsimulator'

export interface ThcredigeringProps {
  /** Utkastet redigeringen starter fra. */
  utgave: ThcRegelsettutgave
  start: { regler: ThcRegelsett; tekster: ThcTekster }
  /** Lagrer det som er endret som utkast, mot revisjonene i `utgave`. */
  onLagre: (regler: ThcRegelsett, tekster: ThcTekster) => Promise<void>
  onAvbryt: () => void
}

const KURVEFELT = ['a1', 'k1', 'a2', 'k2'] as const

/**
 * Redigeringen av THC-syrereglene og -tekstene, i stedet for oversikten mens
 * den pågår.
 *
 * Hvert tall står i sitt eget felt; prosentene som prosent. Et felt som ikke
 * røres, beholder tallet nøyaktig slik det er lagret. Feilene står samlet
 * mens det skrives — de samme som databasen ville avvist — og simulatoren
 * under fortolker med utkastet slik det står, så snart det er gyldig.
 *
 * Tekstene er kommentarene bolkene peker på, og lagres hver for seg; reglene
 * lagres bare når de er endret. Plassholderne i en tekst kan ikke endres.
 */
export function Thcredigering({ utgave, start, onLagre, onAvbryt }: ThcredigeringProps) {
  const [regler, setRegler] = useState(start.regler)
  const [tekster, setTekster] = useState(start.tekster)
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const tittel = useId()

  const utkastfeil = useMemo(() => thcUtkastfeil(utgave, regler, tekster), [utgave, regler, tekster])
  const modell = useMemo(() => {
    if (utkastfeil.length > 0) return null
    const m = lagThcModell(regler, tekster)
    return m.ok ? m.modell : null
  }, [utkastfeil, regler, tekster])
  const endringer = useMemo(() => thcEndringer(utgave, regler, tekster), [utgave, regler, tekster])
  const antallEndret = endringer.kommentarer.length + (endringer.regelsett ? 1 : 0)

  const lagre = async () => {
    if (utkastfeil.length > 0) return
    if (antallEndret === 0) {
      onAvbryt()
      return
    }
    setLagrer(true)
    setFeil(null)
    try {
      await onLagre(regler, tekster)
    } catch (e) {
      setFeil(
        e instanceof Samtidighetskonflikt
          ? 'Noen andre har lagret reglene eller tekstene mens du redigerte, så ikke alt ble lagret. ' +
              'Det du har skrevet, står her til du velger «Hent nyeste utgave» øverst på siden; ' +
              'ta vare på det du trenger først.'
          : (e as Error).message,
      )
      setLagrer(false)
    }
  }

  const sett = <K extends keyof ThcRegelsett>(felt: K, verdi: ThcRegelsett[K]) =>
    setRegler((r) => ({ ...r, [felt]: verdi }))
  /**
   * Teller hver gang et nivå eller en margin legges til eller fjernes. Feltene
   * holder teksten sin selv, så de settes opp på nytt fra tallene da.
   */
  const [omforminger, setOmforminger] = useState(0)
  const omform = <K extends keyof ThcRegelsett>(felt: K, verdi: ThcRegelsett[K]) => {
    sett(felt, verdi)
    setOmforminger((n) => n + 1)
  }

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
        Rediger: Fortolkningsreglene for THC-syre i urin
      </p>

      <fieldset className="regelredigering__gruppe">
        <legend>Konsentrasjonsnivåer</legend>
        {regler.konsentrasjonsnivaer.map((niva, i) => (
          <Nivaredigering
            key={`${omforminger}-${i}`}
            niva={niva}
            nummer={i + 1}
            laveste={i === 0}
            onEndre={(ny) =>
              sett(
                'konsentrasjonsnivaer',
                regler.konsentrasjonsnivaer.map((n, j) => (j === i ? ny : n)),
              )
            }
            onFjern={
              regler.konsentrasjonsnivaer.length > 1 && i > 0
                ? () =>
                    omform(
                      'konsentrasjonsnivaer',
                      regler.konsentrasjonsnivaer.filter((_, j) => j !== i),
                    )
                : undefined
            }
          />
        ))}
        <div className="redigeringsrad">
          <Button
            variant="subtle"
            className="redigeringsknapp"
            onClick={() =>
              omform('konsentrasjonsnivaer', [
                ...regler.konsentrasjonsnivaer,
                { navn: '', nedre: NaN, nylig_inntak: false },
              ])
            }
          >
            Legg til nivå
          </Button>
        </div>
      </fieldset>

      <fieldset className="regelredigering__gruppe">
        <legend>Sikkerhetsmargin</legend>
        <div className="feltrad">
          {regler.sikkerhetsmarginer.map((m, i) => (
            <Tallinndata
              key={`${omforminger}-${i}`}
              merke={`Margin ${i + 1} (%)`}
              verdi={m.margin}
              skala={100}
              onEndre={(margin) =>
                setRegler((r) => ({
                  ...r,
                  sikkerhetsmarginer: r.sikkerhetsmarginer.map((n, j) =>
                    j === i ? { margin, z: Number.isFinite(margin) ? normalkvantil(1 - margin) : NaN } : n,
                  ),
                  // Standarden følger marginen den står på.
                  standard_sikkerhetsmargin:
                    r.standard_sikkerhetsmargin === m.margin ? margin : r.standard_sikkerhetsmargin,
                }))
              }
            />
          ))}
          <Valgfelt
            merke="Standard"
            verdi={String(regler.sikkerhetsmarginer.findIndex((m) => m.margin === regler.standard_sikkerhetsmargin))}
            valg={[
              { verdi: '-1', tekst: 'Velg' },
              ...regler.sikkerhetsmarginer.map((m, i) => ({
                verdi: String(i),
                tekst: Number.isFinite(m.margin) ? marginmerke(m.margin) : `Margin ${i + 1}`,
              })),
            ]}
            onEndre={(v) => {
              const valgt = regler.sikkerhetsmarginer[Number(v)]
              if (valgt) sett('standard_sikkerhetsmargin', valgt.margin)
            }}
          />
        </div>
        <p className="felt__hjelp">50 % betyr ingen margin. Marginene står stigende.</p>
        <div className="redigeringsrad">
          <Button
            variant="subtle"
            className="redigeringsknapp"
            onClick={() => omform('sikkerhetsmarginer', [...regler.sikkerhetsmarginer, { margin: NaN, z: NaN }])}
          >
            Legg til margin
          </Button>
          {regler.sikkerhetsmarginer.length > 1 && (
            <Button
              variant="subtle"
              className="redigeringsknapp"
              onClick={() => omform('sikkerhetsmarginer', regler.sikkerhetsmarginer.slice(0, -1))}
            >
              Fjern den siste marginen
            </Button>
          )}
        </div>
      </fieldset>

      <fieldset className="regelredigering__gruppe">
        <legend>Måleusikkerhet</legend>
        <div className="feltrad">
          <Tallinndata
            merke="CV for THC-syre (%)"
            verdi={regler.maleusikkerhet.cv_thc}
            skala={100}
            onEndre={(cv_thc) => sett('maleusikkerhet', { ...regler.maleusikkerhet, cv_thc })}
          />
          <Tallinndata
            merke="CV for kreatinin (%)"
            verdi={regler.maleusikkerhet.cv_kreatinin}
            skala={100}
            onEndre={(cv_kreatinin) => sett('maleusikkerhet', { ...regler.maleusikkerhet, cv_kreatinin })}
          />
          <Tallinndata
            merke="Faktor under cut-off"
            verdi={regler.maleusikkerhet.faktor_under_cutoff}
            onEndre={(faktor_under_cutoff) => sett('maleusikkerhet', { ...regler.maleusikkerhet, faktor_under_cutoff })}
          />
        </div>
      </fieldset>

      <fieldset className="regelredigering__gruppe">
        <legend>Kurvene som avgjør konklusjonen</legend>
        <Bruksmonsterredigering
          navn="Kronisk bruk"
          monster={regler.bruksmonstre.kronisk}
          onEndre={(kronisk) => sett('bruksmonstre', { ...regler.bruksmonstre, kronisk })}
        />
        <Bruksmonsterredigering
          navn="Enkeltinntak"
          monster={regler.bruksmonstre.ikke_kronisk}
          onEndre={(ikke_kronisk) => sett('bruksmonstre', { ...regler.bruksmonstre, ikke_kronisk })}
        />
        <div className="feltrad">
          <Tallinndata
            merke="Varsel ved mer enn (dager mellom prøvene)"
            verdi={regler.varsel_dager_mellom}
            onEndre={(dager) => sett('varsel_dager_mellom', dager)}
          />
        </div>
      </fieldset>

      <fieldset className="regelredigering__gruppe">
        <legend>Utskillelseskurvene</legend>
        {THC_KURVEROLLER.map((rolle) => (
          <Kurveredigering
            key={rolle}
            rolle={rolle}
            kurve={regler.kurver[rolle]}
            onEndre={(kurve) => sett('kurver', { ...regler.kurver, [rolle]: kurve })}
          />
        ))}
        <div className="feltrad">
          <Tallinndata
            merke="Konverteringsfaktor"
            verdi={regler.konverteringsfaktor}
            onEndre={(faktor) => sett('konverteringsfaktor', faktor)}
          />
        </div>
      </fieldset>

      <fieldset className="regelredigering__gruppe">
        <legend>Tekstbolkene</legend>
        {THC_TEKSTNOKLER.map((nokkel) => {
          const { tittel: bolk, brukes, plassholdere } = THC_TEKSTBOLKER[nokkel]
          return (
            <Tekstomrade
              key={nokkel}
              merke={bolk}
              verdi={tekster[nokkel]}
              hjelp={plassholdere.length > 0 ? `${brukes} Må inneholde ${plassholdere.join(' og ')}.` : brukes}
              onEndre={(tekst) => setTekster((t) => ({ ...t, [nokkel]: tekst }))}
            />
          )
        })}
      </fieldset>

      {utkastfeil.length > 0 ? (
        <div className="sidevarsel" role="alert">
          <p>Dette må rettes før utkastet kan lagres:</p>
          <ul className="mangelliste">
            {utkastfeil.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : (
        modell && <Thcsimulator modell={modell} />
      )}

      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onAvbryt}>
          Avbryt
        </Button>
        <Button type="submit" className="knapp--kompakt" disabled={lagrer || utkastfeil.length > 0}>
          {lagrer ? 'Lagrer …' : 'Lagre utkast'}
        </Button>
      </div>
    </form>
  )
}

function Nivaredigering({
  niva,
  nummer,
  laveste,
  onEndre,
  onFjern,
}: {
  niva: ThcKonsentrasjonsniva
  nummer: number
  laveste: boolean
  onEndre: (niva: ThcKonsentrasjonsniva) => void
  onFjern?: () => void
}) {
  const id = useId()
  return (
    <div className="feltrad">
      <div className="felt">
        <label className="felt__merkelapp" htmlFor={id}>
          Nivå {nummer}
        </label>
        <input
          id={id}
          className="felt__inndata"
          value={niva.navn}
          onChange={(e) => onEndre({ ...niva, navn: e.target.value })}
        />
      </div>
      {!laveste && (
        <Tallinndata
          merke={`Nivå ${nummer} fra og med (IRCAK)`}
          verdi={niva.nedre ?? NaN}
          onEndre={(nedre) => onEndre({ ...niva, nedre })}
        />
      )}
      <label className="avkryssing">
        <input
          type="checkbox"
          checked={niva.nylig_inntak}
          onChange={(e) => onEndre({ ...niva, nylig_inntak: e.target.checked })}
        />
        Tyder på nylig inntak
      </label>
      {onFjern && (
        <Button variant="subtle" className="redigeringsknapp" onClick={onFjern}>
          Fjern nivå {nummer}
        </Button>
      )}
    </div>
  )
}

const KURVEVALG = THC_KURVEROLLER.map((rolle) => ({ verdi: rolle, tekst: `Den ${KURVEFARGE[rolle]}` }))

function Bruksmonsterredigering({
  navn,
  monster,
  onEndre,
}: {
  navn: string
  monster: ThcBruksmonster
  onEndre: (monster: ThcBruksmonster) => void
}) {
  return (
    <div className="feltrad">
      <Valgfelt
        merke={`${navn}: vanskelig å avgjøre over`}
        verdi={monster.vanskelig_over}
        valg={KURVEVALG}
        onEndre={(v) => onEndre({ ...monster, vanskelig_over: v as ThcKurverolle })}
      />
      <Valgfelt
        merke={`${navn}: nytt inntak over`}
        verdi={monster.nytt_inntak_over}
        valg={KURVEVALG}
        onEndre={(v) => onEndre({ ...monster, nytt_inntak_over: v as ThcKurverolle })}
      />
    </div>
  )
}

function Kurveredigering({
  rolle,
  kurve,
  onEndre,
}: {
  rolle: ThcKurverolle
  kurve: ThcKurve
  onEndre: (kurve: ThcKurve) => void
}) {
  const id = useId()
  const farge = KURVEFARGE[rolle]
  return (
    <div className="feltrad">
      <div className="felt">
        <label className="felt__merkelapp" htmlFor={id}>
          Den {farge} kurven
        </label>
        <input
          id={id}
          className="felt__inndata"
          value={kurve.navn}
          onChange={(e) => onEndre({ ...kurve, navn: e.target.value })}
        />
      </div>
      {KURVEFELT.map((felt) => (
        <Tallinndata
          key={felt}
          merke={`${felt} (den ${farge})`}
          verdi={kurve[felt]}
          onEndre={(verdi) => onEndre({ ...kurve, [felt]: verdi })}
        />
      ))}
    </div>
  )
}

/**
 * Et tallfelt for en verdi i regelsettet. Teksten står slik den skrives;
 * tallet går videre bare når det kan leses, ellers som NaN, som kontrollen
 * melder. Et felt som ikke røres, sender ingenting, så det lagrede tallet
 * står urørt helt ned til siste siffer.
 */
function Tallinndata({
  merke,
  verdi,
  skala = 1,
  onEndre,
}: {
  merke: string
  verdi: number
  /** 100 for et felt som viser en andel som prosent. */
  skala?: number
  onEndre: (verdi: number) => void
}) {
  const id = useId()
  // Prosentene rundes for visningen, så 0,2 står som 20 og ikke som
  // 20,000000000000004; tallet selv endres ikke før feltet gjør det.
  const [tekst, setTekst] = useState(() =>
    Number.isFinite(verdi) ? tallTilFelt(skala === 1 ? verdi : Math.round(verdi * skala * 1e9) / 1e9) : '',
  )
  return (
    <div className="felt">
      <label className="felt__merkelapp" htmlFor={id}>
        {merke}
      </label>
      <Tallfelt
        id={id}
        className="felt__inndata regelredigering__tall"
        value={tekst}
        onChange={(t) => {
          setTekst(t)
          const tall = lesTallfelt(t)
          onEndre(typeof tall === 'number' ? tall / skala : NaN)
        }}
      />
    </div>
  )
}
