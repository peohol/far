import { useId, useState, type FormEvent, type ReactNode } from 'react'
import {
  DOSEKOLONNER,
  kontrollerIntervall,
  lesKontrolldato,
  lesTallfelt,
  medKontrolldato,
  ryddPreparater,
  tallTilFelt,
  tomDoserad,
  type Datakortdefinisjon,
  type Doserad,
  type Intervallverdi,
  type Kontrolldato,
} from '../../faginnhold/paneler'
import { erTomt, type Riktekstdokument } from '../../faginnhold/riktekst'
import { Samtidighetskonflikt } from '../../faginnhold/lagring'
import { Button } from '../Button'
import { Felt } from '../konto/Felt'
import { Referansevelger } from './Referansevelger'
import { Rikteksteditor } from './Rikteksteditor'

/**
 * Skjemaene for hver elementtype på informasjonssiden.
 *
 * Alle har samme ramme: feltene, kildene for kortet, «Lagre» og «Avbryt».
 * Lagringen går gjennom siden (`onLagre`), som sender innholdet til databasen
 * mot revisjonen brukeren åpnet. Har noen andre lagret i mellomtiden, blir
 * skjemaet stående med det brukeren skrev, og siden sier fra.
 */

/** Det et skjema lagrer: dataene i elementet og kildene for kortet. */
export interface Skjemaresultat<T> {
  data: T
  referanser: string[]
}

export interface SkjemaProps<T> {
  /** Navnet på det som redigeres, f.eks. «Referanseområde». */
  tittel: string
  start: T
  referanser: readonly string[]
  onLagre: (resultat: Skjemaresultat<T>) => Promise<void>
  onAvbryt: () => void
}

const KONFLIKT =
  'Noen andre har lagret dette i mellomtiden. Det du skrev, står fortsatt her — hent den nyeste utgaven øverst på siden før du lagrer igjen.'

/**
 * Rammen rundt feltene: kildene, knappene og feilmeldingene. `kontroller` gir
 * dataene som skal lagres, eller en feilmelding.
 */
function Skjemaramme<T>({
  tittel,
  referanser,
  onLagre,
  onAvbryt,
  kontroller,
  children,
}: Omit<SkjemaProps<T>, 'start'> & {
  kontroller: () => { data: T } | { feil: string }
  children: ReactNode
}) {
  const [kilder, setKilder] = useState<string[]>([...referanser])
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const overskrift = useId()

  const lagre = async (event: FormEvent) => {
    event.preventDefault()
    const resultat = kontroller()
    if ('feil' in resultat) {
      setFeil(resultat.feil)
      return
    }
    setLagrer(true)
    setFeil(null)
    try {
      await onLagre({ data: resultat.data, referanser: kilder })
    } catch (e) {
      setFeil(e instanceof Samtidighetskonflikt ? KONFLIKT : (e as Error).message)
      setLagrer(false)
    }
  }

  return (
    <form className="redigering" aria-labelledby={overskrift} onSubmit={(e) => void lagre(e)} noValidate>
      <p id={overskrift} className="redigering__tittel">
        Rediger: {tittel}
      </p>
      {children}
      <Referansevelger tittel="Kilder for hele kortet" valgte={kilder} onEndre={setKilder} />
      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onAvbryt}>
          Avbryt
        </Button>
        <Button type="submit" className="knapp--kompakt" disabled={lagrer}>
          {lagrer ? 'Lagrer …' : 'Lagre utkast'}
        </Button>
      </div>
    </form>
  )
}

/** Et vanlig tekstfelt, med appens felles feltkomponent. */
function Tekstfelt({
  merke,
  verdi,
  onEndre,
  inputMode,
}: {
  merke: string
  verdi: string
  onEndre: (v: string) => void
  inputMode?: 'decimal'
}) {
  return (
    <Felt
      merkelapp={merke}
      type="text"
      value={verdi}
      {...(inputMode && { inputMode })}
      onChange={(e) => onEndre(e.target.value)}
    />
  )
}

/**
 * Datoen innholdet sist ble kontrollert mot kilden panelet holdes à jour mot.
 * Den endres bare når brukeren endrer den, så en vanlig redigering ikke gir
 * inntrykk av at alt er kontrollert på nytt.
 */
function Kontrolldatofelt({ kilde, verdi, onEndre }: { kilde: string; verdi: Kontrolldato; onEndre: (v: string) => void }) {
  return (
    <Felt
      merkelapp={`Sist kontrollert mot ${kilde}`}
      type="date"
      value={verdi}
      onChange={(e) => onEndre(e.target.value)}
    />
  )
}

const UGYLDIG_DATO = 'Datoen for kontrollen er ikke en gyldig dato.'

/** Datoen fra feltet, eller en feil når noe er fylt ut som ikke er en dato. */
function lesDatofelt(verdi: string): { dato: Kontrolldato } | { feil: string } {
  const dato = lesKontrolldato(verdi.trim())
  return verdi.trim() && !dato ? { feil: UGYLDIG_DATO } : { dato }
}

/* --- Preparatnavnene ------------------------------------------------------ */

export function PreparatSkjema(
  props: SkjemaProps<{ navn: string[]; kontrollert?: Kontrolldato }> & { kontrolleresMot?: string },
) {
  const [tekst, setTekst] = useState(props.start.navn.join('\n'))
  const [kontrollert, setKontrollert] = useState(props.start.kontrollert ?? '')
  const id = useId()
  const kontroller = () => {
    const dato = lesDatofelt(kontrollert)
    if ('feil' in dato) return dato
    return { data: medKontrolldato({ navn: ryddPreparater(tekst.split('\n')) }, dato.dato) }
  }
  return (
    <Skjemaramme {...props} kontroller={kontroller}>
      <label className="felt" htmlFor={id}>
        <span className="felt__merkelapp">Preparatnavn, ett per linje</span>
        <textarea
          id={id}
          className="felt__inndata felt__inndata--flerlinje"
          rows={5}
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          aria-describedby={`${id}-hjelp`}
        />
        <span id={`${id}-hjelp`} className="felt__hjelp">
          Navnene lagres hver for seg og vises alltid alfabetisk.
        </span>
      </label>
      {props.kontrolleresMot && (
        <Kontrolldatofelt kilde={props.kontrolleresMot} verdi={kontrollert} onEndre={setKontrollert} />
      )}
    </Skjemaramme>
  )
}

/* --- Datakortene ---------------------------------------------------------- */

export function DatakortSkjema(props: SkjemaProps<Intervallverdi> & { kort: Datakortdefinisjon }) {
  const [nedre, setNedre] = useState(tallTilFelt(props.start.nedre))
  const [ovre, setOvre] = useState(tallTilFelt(props.start.ovre))
  const [enhet, setEnhet] = useState(props.start.enhet)
  const [forbehold, setForbehold] = useState(props.start.forbehold)

  const kontroller = () => {
    const n = lesTallfelt(nedre)
    const o = lesTallfelt(ovre)
    if (n === undefined || o === undefined) return { feil: 'Grensene må være tall, f.eks. 10 eller 0,5.' }
    const verdi: Intervallverdi = { nedre: n, ovre: o, enhet: enhet.trim(), forbehold: forbehold.trim() }
    const feil = kontrollerIntervall(verdi)
    return feil ? { feil } : { data: verdi }
  }

  return (
    <Skjemaramme {...props} kontroller={kontroller}>
      <div className="feltrad">
        <Tekstfelt merke="Nedre grense" verdi={nedre} onEndre={setNedre} inputMode="decimal" />
        <Tekstfelt merke="Øvre grense" verdi={ovre} onEndre={setOvre} inputMode="decimal" />
        <Tekstfelt merke="Enhet" verdi={enhet} onEndre={setEnhet} />
      </div>
      <p className="felt__hjelp">
        Oppgi begge grensene for et område, eller bare den ene for en grense. Tom nedre og øvre grense
        betyr at kortet ikke vises.
      </p>
      <Tekstfelt merke="Forbehold" verdi={forbehold} onEndre={setForbehold} />
    </Skjemaramme>
  )
}

/* --- Rikteksten ----------------------------------------------------------- */

export function TekstSkjema(
  props: SkjemaProps<{ dokument: Riktekstdokument; kontrollert?: Kontrolldato }> & { kontrolleresMot?: string },
) {
  const [dokument, setDokument] = useState(props.start.dokument)
  const [kontrollert, setKontrollert] = useState(props.start.kontrollert ?? '')
  const kontroller = () => {
    const dato = lesDatofelt(kontrollert)
    return 'feil' in dato ? dato : { data: medKontrolldato({ dokument }, dato.dato) }
  }
  return (
    <Skjemaramme {...props} kontroller={kontroller}>
      <Rikteksteditor dokument={props.start.dokument} onEndre={setDokument} etikett={props.tittel} />
      {props.kontrolleresMot && (
        <Kontrolldatofelt kilde={props.kontrolleresMot} verdi={kontrollert} onEndre={setKontrollert} />
      )}
    </Skjemaramme>
  )
}

/* --- Farmakokinetikken ---------------------------------------------------- */

export function KinetikkSkjema(props: SkjemaProps<{ tittel: string; dokument: Riktekstdokument }>) {
  const [tittel, setTittel] = useState(props.start.tittel)
  const [dokument, setDokument] = useState(props.start.dokument)
  const kontroller = () => {
    if (!tittel.trim()) return { feil: 'Kortet trenger en overskrift.' }
    if (erTomt(dokument)) return { feil: 'Kortet trenger en tekst.' }
    return { data: { tittel: tittel.trim(), dokument } }
  }
  return (
    <Skjemaramme {...props} kontroller={kontroller}>
      <Tekstfelt merke="Overskrift" verdi={tittel} onEndre={setTittel} />
      <Rikteksteditor dokument={props.start.dokument} onEndre={setDokument} etikett={tittel || props.tittel} />
    </Skjemaramme>
  )
}

/* --- Serumkonsentrasjonene ------------------------------------------------ */

export function DosetabellSkjema(props: SkjemaProps<{ rader: Doserad[] }>) {
  const [rader, setRader] = useState<Doserad[]>(props.start.rader.length > 0 ? props.start.rader : [tomDoserad()])
  const endre = (i: number, felt: keyof Doserad, verdi: string) =>
    setRader(rader.map((rad, j) => (j === i ? { ...rad, [felt]: verdi } : rad)))

  const kontroller = () => ({
    data: {
      rader: rader
        .map((rad) => ({
          dose: rad.dose.trim(),
          regime: rad.regime.trim(),
          konsentrasjon: rad.konsentrasjon.trim(),
          merknad: rad.merknad.trim(),
        }))
        .filter((rad) => DOSEKOLONNER.some(({ felt }) => rad[felt] !== '')),
    },
  })

  return (
    <Skjemaramme {...props} kontroller={kontroller}>
      {rader.map((rad, i) => (
        <fieldset key={i} className="doserad">
          <legend className="doserad__tittel">Rad {i + 1}</legend>
          <div className="feltrad">
            {DOSEKOLONNER.map(({ felt, tittel }) => (
              <Tekstfelt key={felt} merke={tittel} verdi={rad[felt]} onEndre={(v) => endre(i, felt, v)} />
            ))}
          </div>
          <Button
            variant="subtle"
            aria-label={`Fjern rad ${i + 1}`}
            onClick={() => setRader(rader.filter((_, j) => j !== i))}
          >
            Fjern raden
          </Button>
        </fieldset>
      ))}
      <Button variant="subtle" onClick={() => setRader([...rader, tomDoserad()])}>
        Legg til rad
      </Button>
    </Skjemaramme>
  )
}

/* --- Panelets kilder ------------------------------------------------------ */

/** Kildene for et helt panel. Lagres på informasjonssiden. */
export function PanelkildeSkjema({
  tittel,
  referanser,
  onLagre,
  onAvbryt,
}: {
  tittel: string
  referanser: readonly string[]
  onLagre: (ider: string[]) => Promise<void>
  onAvbryt: () => void
}) {
  const [kilder, setKilder] = useState<string[]>([...referanser])
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const lagre = async (event: FormEvent) => {
    event.preventDefault()
    setLagrer(true)
    setFeil(null)
    try {
      await onLagre(kilder)
    } catch (e) {
      setFeil(e instanceof Samtidighetskonflikt ? KONFLIKT : (e as Error).message)
      setLagrer(false)
    }
  }
  return (
    <form className="redigering" aria-label={`Kilder for ${tittel}`} onSubmit={(e) => void lagre(e)}>
      <Referansevelger tittel={`Kilder for hele panelet «${tittel}»`} valgte={kilder} onEndre={setKilder} />
      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onAvbryt}>
          Avbryt
        </Button>
        <Button type="submit" className="knapp--kompakt" disabled={lagrer}>
          {lagrer ? 'Lagrer …' : 'Lagre utkast'}
        </Button>
      </div>
    </form>
  )
}
