import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  DOSEKOLONNER,
  kontrollerIntervall,
  lesTallfelt,
  tallTilFelt,
  tomDoserad,
  type Datakortdefinisjon,
  type Doserad,
  type Intervallverdi,
  type KobletVirkestoff,
  type Legemiddelkoblingdata,
} from '../../faginnhold/paneler'
import { fold } from '../../faginnhold/sok'
import type { Virkestofftreff } from '../../legemiddeldata/lesing'
import { useFaginnholdskilde } from './Faginnholdskilde'
import { erTomt, type Riktekstdokument } from '../../faginnhold/riktekst'
import { Samtidighetskonflikt } from '../../faginnhold/lagring'
import { Button } from '../Button'
import type { Ikonnavn } from '../ikon/register'
import { Modallag } from '../Modallag'
import { Felt } from '../konto/Felt'
import { Referansevelger } from './Referansevelger'
import { Rikteksteditor } from './Rikteksteditor'

/**
 * Skjemaene for hver elementtype på informasjonssiden.
 *
 * Alle har samme ramme: et stort redigeringsvindu over siden, med feltene,
 * kildene for kortet og «Lagre» og «Avbryt» i en fot som står fast. Vinduet
 * gir feltene plass selv når det som redigeres, står i et smalt kort.
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
  /** Ikonet foran tittelen i redigeringsvinduet, som det redigerte har på siden. */
  ikon?: Ikonnavn
}

const KONFLIKT =
  'Noen andre har lagret dette i mellomtiden. Det du skrev, står fortsatt her — hent den nyeste utgaven øverst på siden før du lagrer igjen.'

/** Det første feltet i skjemaet, der fokus lander når vinduet åpnes. */
const FORSTE_FELT = '.redigering :is(input, textarea, [contenteditable="true"])'

/**
 * Redigeringsvinduet rundt feltene: kildene, knappene og feilmeldingene.
 * `kontroller` gir dataene som skal lagres, eller en feilmelding.
 *
 * Escape, lukkeknappen og et klikk utenfor lukker vinduet som «Avbryt» — men
 * er noe endret, spør vinduet først, så en tast for mye ikke koster det
 * brukeren skrev.
 */
function Skjemaramme<T>({
  tittel,
  referanser,
  onLagre,
  onAvbryt,
  kontroller,
  ikon = 'edit',
  meta = 'Rediger',
  kildetittel = 'Kilder for hele kortet',
  navn = `${meta}: ${tittel}`,
  bred,
  children,
}: Omit<SkjemaProps<T>, 'start'> & {
  kontroller: () => { data: T } | { feil: string }
  /** Linjen over tittelen i vinduet. */
  meta?: string
  /** Overskriften på kildevelgeren. */
  kildetittel?: string
  /** Navnet skjemaet har for hjelpemidler. Ellers «Rediger: tittelen». */
  navn?: string
  /** Bredere vindu, for felt som står side om side. */
  bred?: boolean
  children?: ReactNode
}) {
  const [kilder, setKilder] = useState<string[]>([...referanser])
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const [forlater, setForlater] = useState(false)
  const skjemaId = useId()

  // Det skjemaet ville lagret, som tekst: slik det var da vinduet åpnet, og nå.
  const signatur = () => JSON.stringify([kontroller(), kilder])
  const start = useRef<string | null>(null)
  start.current ??= signatur()

  // Der fokus stod da brukeren ville lukke, så «Fortsett å redigere» kan føre det tilbake.
  const fokusFor = useRef<HTMLElement | null>(null)
  const vedLukking = () => {
    if (lagrer) return false
    if (signatur() === start.current) return true
    if (!forlater && document.activeElement instanceof HTMLElement) fokusFor.current = document.activeElement
    setForlater(true)
    return false
  }
  const fortsett = () => {
    setForlater(false)
    // Knappen forsvinner; fokus går tilbake til feltet, eller til det første.
    requestAnimationFrame(() => {
      const tilbake = fokusFor.current?.isConnected ? fokusFor.current : document.querySelector<HTMLElement>(FORSTE_FELT)
      tilbake?.focus()
    })
  }

  const lagre = async (event: FormEvent) => {
    event.preventDefault()
    const resultat = kontroller()
    if ('feil' in resultat) {
      setFeil(resultat.feil)
      return
    }
    setLagrer(true)
    setFeil(null)
    setForlater(false)
    try {
      await onLagre({ data: resultat.data, referanser: kilder })
    } catch (e) {
      setFeil(e instanceof Samtidighetskonflikt ? KONFLIKT : (e as Error).message)
      setLagrer(false)
    }
  }

  return (
    <Modallag
      apen
      tittel={tittel}
      meta={meta}
      ikon={ikon}
      ark
      bred={bred}
      lukketekst="Lukk redigeringen"
      autofokus={FORSTE_FELT}
      onLukk={onAvbryt}
      vedLukking={vedLukking}
      fot={
        <>
          {feil && (
            <p className="skjemafeil" role="alert">
              {feil}
            </p>
          )}
          {forlater ? (
            <Forlatvarsel onForkast={onAvbryt} onFortsett={fortsett} />
          ) : (
            <div className="skjema__knapper redigering__knapper">
              <Button variant="subtle" onClick={onAvbryt}>
                Avbryt
              </Button>
              <Button type="submit" form={skjemaId} className="knapp--kompakt" disabled={lagrer}>
                {lagrer ? 'Lagrer …' : 'Lagre utkast'}
              </Button>
            </div>
          )}
        </>
      }
    >
      <form
        id={skjemaId}
        className="redigering"
        aria-label={navn}
        onSubmit={(e) => void lagre(e)}
        noValidate
      >
        {children}
        <Referansevelger tittel={kildetittel} valgte={kilder} onEndre={setKilder} />
      </form>
    </Modallag>
  )
}

/** Spørsmålet når et skjema med endringer lukkes uten å lagres. */
function Forlatvarsel({ onForkast, onFortsett }: { onForkast: () => void; onFortsett: () => void }) {
  const fortsett = useRef<HTMLButtonElement>(null)
  useEffect(() => fortsett.current?.focus(), [])
  return (
    <div className="redigering__forlat" role="alert">
      <p className="redigering__forlattekst">Du har endringer som ikke er lagret.</p>
      <div className="skjema__knapper redigering__knapper">
        <Button variant="subtle" onClick={onForkast}>
          Forkast endringene
        </Button>
        <Button ref={fortsett} className="knapp--kompakt" onClick={onFortsett}>
          Fortsett å redigere
        </Button>
      </div>
    </div>
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

/* --- Koblingen til legemiddeldataene ------------------------------------- */

/** Navnet slik det sammenlignes med virkestoffene i FEST: uten det i parentes. */
export function navnForForslag(sidenavn: string): string {
  return sidenavn.replace(/\s*\(.*\)\s*$/, '').trim()
}

/**
 * Hvilke virkestoff i FEST siden viser preparatene for. Administratoren søker
 * og velger; et virkestoff med samme navn som siden er et forslag, som ikke
 * gjelder før det er valgt og lagret. Koblingen lagres med FESTs ID.
 */
export function LegemiddelkoblingSkjema(props: SkjemaProps<Legemiddelkoblingdata> & { sidenavn: string }) {
  const { legemidler } = useFaginnholdskilde()
  const [valgte, setValgte] = useState<KobletVirkestoff[]>(props.start.virkestoff)
  const forslag = navnForForslag(props.sidenavn)
  const [sok, setSok] = useState(props.start.virkestoff.length === 0 ? forslag : '')
  const [treff, setTreff] = useState<{ sok: string; liste: Virkestofftreff[] } | null>(null)
  const [sokefeil, setSokefeil] = useState<string | null>(null)
  const listeId = useId()

  useEffect(() => {
    if (!legemidler || sok.trim().length < 2) {
      setTreff(null)
      return
    }
    let gjelder = true
    const tidsur = setTimeout(() => {
      legemidler
        .sok(sok)
        .then((liste) => {
          if (!gjelder) return
          setTreff({ sok, liste })
          setSokefeil(null)
        })
        .catch((e: Error) => gjelder && setSokefeil(e.message))
    }, 200)
    return () => {
      gjelder = false
      clearTimeout(tidsur)
    }
  }, [legemidler, sok])

  const erValgt = (id: string) => valgte.some((v) => v.fest_id === id)
  const likSiden = (navn: string) => fold(navn) === fold(forslag)

  return (
    <Skjemaramme {...props} kontroller={() => ({ data: { virkestoff: valgte } })}>
      <div className="kobling">
        <p className="kobling__merke">Virkestoff i legemiddeldataene</p>
        {valgte.length === 0 ? (
          <p className="kobling__tom">Siden er ikke koblet. Uten kobling vises ingen preparater.</p>
        ) : (
          <ul className="kobling__valgte">
            {valgte.map((v) => (
              <li key={v.fest_id}>
                <span>{v.navn || v.fest_id}</span>
                <Button
                  variant="subtle"
                  className="redigeringsknapp"
                  aria-label={`Fjern koblingen til ${v.navn}`}
                  onClick={() => setValgte(valgte.filter((x) => x.fest_id !== v.fest_id))}
                >
                  Fjern
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Felt
          merkelapp="Søk etter virkestoff"
          type="search"
          value={sok}
          onChange={(e) => setSok(e.target.value)}
          onKeyDown={(e) => {
            // Enter i søket skal ikke lagre skjemaet.
            if (e.key === 'Enter') e.preventDefault()
          }}
          aria-controls={listeId}
          hjelp="Salter og estere tas med av seg selv når moderstoffet velges."
        />
        {sokefeil && (
          <p className="skjemafeil" role="alert">
            Søket feilet: {sokefeil}
          </p>
        )}
        <ul id={listeId} className="kobling__treff" aria-live="polite">
          {treff?.liste.length === 0 && <li className="kobling__tom">Ingen virkestoff heter «{treff.sok}».</li>}
          {treff?.liste.map((t) => (
            <li key={t.id}>
              <span className="kobling__navn">
                {t.navn}
                {likSiden(t.navn) && !erValgt(t.id) && <span className="kobling__forslag"> Forslag: samme navn som siden</span>}
              </span>
              <span className="kobling__detalj">
                {[
                  t.salt_av.length > 0 && `salt eller ester av ${t.salt_av.join(', ')}`,
                  `${t.preparater} ${t.preparater === 1 ? 'preparat' : 'preparater'}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <Button
                variant="subtle"
                className="redigeringsknapp"
                disabled={erValgt(t.id)}
                aria-label={`Koble siden til ${t.navn}`}
                onClick={() => setValgte([...valgte, { fest_id: t.id, navn: t.navn }])}
              >
                {erValgt(t.id) ? 'Valgt' : 'Velg'}
              </Button>
            </li>
          ))}
        </ul>
      </div>
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

export function TekstSkjema(props: SkjemaProps<{ dokument: Riktekstdokument }>) {
  const [dokument, setDokument] = useState(props.start.dokument)
  return (
    <Skjemaramme {...props} kontroller={() => ({ data: { dokument } })}>
      <Rikteksteditor dokument={props.start.dokument} onEndre={setDokument} etikett={props.tittel} />
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
    <Skjemaramme {...props} kontroller={kontroller} bred>
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
  return (
    <Skjemaramme
      tittel={tittel}
      meta="Kilder for panelet"
      navn={`Kilder for ${tittel}`}
      ikon="refs"
      kildetittel={`Kilder for hele panelet «${tittel}»`}
      referanser={referanser}
      kontroller={() => ({ data: null })}
      onAvbryt={onAvbryt}
      onLagre={({ referanser: ider }) => onLagre(ider)}
    />
  )
}
