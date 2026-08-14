import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { ManualCopy } from './ManualCopy'
import { Pill } from './Pill'
import { Shortcut } from './Shortcut'
import { StepBar } from './StepBar'
import { Tallfelt } from './Tallfelt'
import { useTips } from './Tips'
import { BackIcon, CheckIcon, CopyIcon, PasteIcon } from './icons'
import {
  moduleKoder,
  viserKommentartekst,
  TOM_RUS_INNDATA,
  type RusModul,
  type RusPlassering,
} from '../domain/rus'
import { hoppFram, useKortHopp } from '../hooks/useKortHopp'
import { erBekreftelse, indexToDigit, skrivesIFelt, useKeyboard } from '../hooks/useKeyboard'

const KOPIFEIL = 'Fikk ikke tilgang til utklippstavlen. Kopier teksten manuelt.'

export interface RusStepProps {
  modul: RusModul
  onBack: () => void
  /** Tilbake til søket, klar for neste analytt. */
  onFinish: () => void
  /** Legger teksten på utklippstavlen. Usant når utklippstavlen er utilgjengelig. */
  copy: (text: string) => Promise<boolean>
  /** Viser kopikvitteringen ved elementet — samme blink som i båndsteget. */
  flashAt: (element: Element | null | undefined) => void
}

/**
 * Fortolkningsmodulen for stoffer med ruspotensial i serum.
 *
 * Kommentaren varierer ikke med konsentrasjonen, så det er ingenting å måle
 * her. Det som må avgjøres er hvilke av analyttene i modulen som er påvist:
 * det bestemmer hvilken kommentar som gjelder, og hvilken analyttkode
 * hovedkommentaren skal ligge på.
 *
 * Kommentarene kopieres én av gangen, i den rekkefølgen de skal limes inn.
 * `Enter` tar den neste som står for tur, og til slutt tilbake til søket, så
 * en hel kommentering går på tastaturet alene.
 */
export function RusStep({ modul, onBack, onFinish, copy, flashAt }: RusStepProps) {
  const [inndata, setInndata] = useState(TOM_RUS_INNDATA)
  const [failedCopy, setFailedCopy] = useState<string | null>(null)
  /** Merkene på kommentarene som alt er kopiert, så det synes hva som gjenstår. */
  const [kopierte, setKopierte] = useState<string[]>([])
  /**
   * Kopieringen som venter på kvittering: merket på kommentaren som ble lagt
   * på utklippstavlen, med et løpenummer så to like kopieringer etter
   * hverandre begge blinker. Se {@link kopier}.
   */
  const [kvittering, setKvittering] = useState<{ merke: string; nr: number } | null>(null)
  const kvitteringsnr = useRef(0)
  const seksjon = useRef<HTMLElement>(null)
  const resultatkort = useRef<HTMLElement>(null)
  const ferdigKnapp = useRef<HTMLButtonElement>(null)
  const forsteValg = useRef<HTMLInputElement>(null)

  useKortHopp(true, seksjon)

  // Første spørsmål får fokus, så avkryssingene kan tas med mellomrom og Tab
  // uten å måtte finne veien dit først. Har modulen ingenting å velge mellom,
  // er det ingenting å fokusere: Enter kopierer uansett hvor fokus står.
  useEffect(() => {
    forsteValg.current?.focus()
  }, [])

  const koder = useMemo(() => moduleKoder(modul), [modul])
  const enkelt = koder.length === 1
  const visTekst = viserKommentartekst(modul)

  // Én analytt betyr ingenting å velge mellom: den er påvist, ellers hadde
  // ikke analysen blitt kommentert.
  const pavist = enkelt ? koder : inndata.pavist
  const inn = { ...inndata, pavist }

  const verdifelter = modul.verdifelter(pavist)
  const resultat = modul.fortolk(inn)
  const plasseringer = resultat.type === 'kommentarer' ? resultat.plasseringer : []

  // Neste kommentar som står for tur. Den bærer Enter-merket, så det går fram
  // hvor tastetrykket lander.
  const neste = plasseringer.find((p) => !kopierte.includes(p.merke))
  const alleKopiert = plasseringer.length > 0 && neste === undefined

  /**
   * Teller opp for hver endring i skjemaet, så en kopiering som er underveis
   * kan se om den fortsatt gjelder. Se {@link kopier}.
   */
  const utgave = useRef(0)

  /** Et nytt svar gir en ny fortolkning, og setter kvitteringene tilbake. */
  const endret = () => {
    utgave.current += 1
    // Det som var kopiert gjaldt den forrige fortolkningen, og skal ikke bli
    // stående som kvittert.
    setKopierte([])
    setFailedCopy(null)
  }

  const settPavist = (kode: string, pa: boolean) => {
    setInndata((forrige) => ({
      ...forrige,
      pavist: pa ? [...forrige.pavist, kode] : forrige.pavist.filter((k) => k !== kode),
    }))
    endret()
  }

  const settVerdi = (kode: string, verdi: string) => {
    setInndata((forrige) => ({ ...forrige, verdier: { ...forrige.verdier, [kode]: verdi } }))
    endret()
  }

  /**
   * Tallene 1, 2 … huker av analyttene i «Påvist i denne prøven», så et helt
   * sett kan krysses av uten mus. Konsentrasjonsfeltene bruker de samme
   * tastene til å taste inn tall, så tastene slipper gjennom til dem der de
   * står fokusert i stedet for å huke av noe.
   */
  useKeyboard(
    enkelt
      ? {}
      : Object.fromEntries(
          modul.analytter.map((analytt, i) => [
            indexToDigit(i),
            (e: KeyboardEvent) => {
              if (skrivesIFelt()) return
              e.preventDefault()
              settPavist(analytt.kode, !pavist.includes(analytt.kode))
            },
          ]),
        ),
  )

  /**
   * Legger kommentaren på utklippstavlen og kvitterer for den.
   *
   * Utklippstavlen svarer først etter en tur innom nettleseren, og i mellomtiden
   * kan skjemaet ha fått et nytt svar. Da gjelder ikke lenger det som ble
   * kopiert: teksten på utklippstavlen hører til den forrige fortolkningen.
   * Uten sjekken under ville kvitteringen kommet tilbake på en kommentar som
   * ikke er kopiert, og Enter hoppet over den.
   *
   * Selve blinket settes i gang i {@link kvitter} og ikke her — det må vente
   * til kortet har lagt seg om etter kopieringen.
   */
  const kopier = async (plassering: RusPlassering) => {
    const denne = utgave.current
    const kopiert = await copy(plassering.tekst)
    if (denne !== utgave.current) return

    if (kopiert) {
      setFailedCopy(null)
      kvitteringsnr.current += 1
      setKvittering({ merke: plassering.merke, nr: kvitteringsnr.current })
      setKopierte((sa) => (sa.includes(plassering.merke) ? sa : [...sa, plassering.merke]))
    } else {
      setFailedCopy(plassering.tekst)
    }
  }

  /** Kopiknappene i resultatkortet, én per kommentar og i samme rekkefølge. */
  const kopiknapper = () =>
    Array.from(resultatkort.current?.querySelectorAll<HTMLElement>('.rus-plassering .knapp') ?? [])

  /**
   * Etter hver kopiering: hent fram knappen som nå står for tur, og fest
   * kvitteringen til knappen som ble brukt.
   *
   * Begge deler hører hjemme her og ikke i {@link kopier}. Merket «↵» flytter
   * seg først når kortet er tegnet på nytt, og «Ferdig»-knappen finnes ikke
   * før da — og knappen som står for tur er gjerne den brukeren ikke ser, enten
   * kommentaren ble kopiert fra feltene med et tastetrykk eller med et klikk på
   * knappen over. De to hentes fram i ett hopp, så det ene ikke skyver det
   * andre ut igjen. Blinket festes til slutt, når rullingen er unnagjort: det
   * ligger fast i vinduet og ville ellers blitt stående igjen der knappen sto.
   */
  useLayoutEffect(() => {
    if (!kvittering) return
    const knapper = kopiknapper()
    const brukt = knapper[plasseringer.findIndex((p) => p.merke === kvittering.merke)]
    const forTur = neste ? knapper[plasseringer.indexOf(neste)] : ferdigKnapp.current
    // Knappen som ble brukt står først: får ikke begge plass, er det den som
    // må være i bildet når blinket kommer.
    hoppFram(brukt, forTur)
    flashAt(brukt)
    // Kopieringen er det som skal kvitteres for; resten leses av slik kortet
    // står i det kvitteringen kommer.
  }, [kvittering])

  /**
   * `Enter` tar det neste steget i kommenteringen: kopierer kommentaren som
   * står for tur, og når alle er kopiert, tilbake til søket.
   *
   * Tasten fanges på vinduet før feltene og knappene ser den, slik den også
   * gjør i THC-modulen. Uten det ville en fokusert knapp trykket seg selv og
   * et fokusert felt sendt skjemaet. Mellomrom gjør det samme der tasten er
   * ledig — i konsentrasjonsfeltene, for eksempel — mens den fortsatt trykker
   * den knappen eller huker av den avkryssingen man står på
   * ({@link erBekreftelse}).
   */
  const paaBekreftelse = useRef<() => void>()
  paaBekreftelse.current = () => {
    if (neste) {
      void kopier(neste)
    } else if (alleKopiert) {
      onFinish()
    }
  }

  useEffect(() => {
    const lytt = (event: KeyboardEvent) => {
      if (!erBekreftelse(event)) return
      event.preventDefault()
      event.stopPropagation()
      paaBekreftelse.current?.()
    }
    window.addEventListener('keydown', lytt, true)
    return () => window.removeEventListener('keydown', lytt, true)
  }, [])

  return (
    <section className="steg steg--rus" aria-label={`Kommenter ${modul.navn}`} ref={seksjon}>
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onBack}>
          Bytt analytt
        </Button>
      </StepBar>

      <div className="rus">
        <Card align="start" className="analyttkort">
          <div className="rus-koder">
            {koder.map((kode) => (
              <Pill key={kode} tone="kode">
                {kode}
              </Pill>
            ))}
          </div>
          <h1 className="analytt__navn">{modul.navn}</h1>

          {!enkelt && (
            <fieldset className="rus-valg">
              <legend>Påvist i denne prøven</legend>
              <div className="thc-avkryssinger">
                {modul.analytter.map((analytt, i) => (
                  <label className="avkryssing" key={analytt.kode}>
                    <input
                      ref={i === 0 ? forsteValg : undefined}
                      type="checkbox"
                      checked={pavist.includes(analytt.kode)}
                      onChange={(e) => settPavist(analytt.kode, e.target.checked)}
                      aria-keyshortcuts={indexToDigit(i)}
                    />
                    {analytt.navn}
                    <span className="rus-valg__kode">{analytt.kode}</span>
                    <Shortcut>{indexToDigit(i)}</Shortcut>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {verdifelter.length > 0 && (
            <fieldset className="rus-valg">
              <legend>Målte konsentrasjoner</legend>
              {modul.verdihjelp && <p className="rus-hjelp">{modul.verdihjelp}</p>}
              <div className="rus-felter">
                {verdifelter.map((felt) => (
                  <label className="thc-felt" key={felt.kode}>
                    <span>
                      {felt.navn} ({felt.kode})
                    </span>
                    <Tallfelt
                      value={inndata.verdier[felt.kode] ?? ''}
                      onChange={(verdi) => settVerdi(felt.kode, verdi)}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </Card>

        <Card ref={resultatkort} align="start" className="rus-resultat">
          {resultat.type === 'mangler' && (
            <>
              <h2 className="thc-resultat__merke">Mangler</h2>
              <ul className="thc-mangler">
                {resultat.mangler.map((melding) => (
                  <li key={melding}>{melding}</li>
                ))}
              </ul>
            </>
          )}

          {/* Kilden har ingen standardkommentar for tilfellet, og sier at
              saken skal tas opp i plenum. Da skal det ikke ligge noe her til
              å kopiere — bare beskjed om hvorfor, og hva kilden sier. */}
          {resultat.type === 'plenum' && (
            <>
              <h2 className="thc-resultat__merke">Til plenum</h2>
              <p className="rus-plenum" role="note">
                {resultat.melding}
              </p>
              {resultat.veiledning.map((tekst) => (
                <p className="rus-veiledning" key={tekst}>
                  {tekst}
                </p>
              ))}
            </>
          )}

          {resultat.type === 'kommentarer' && (
            <>
              <h2 className="thc-resultat__merke">
                {plasseringer.length > 1 ? 'Kommentarer' : 'Kommentar'}
              </h2>
              {resultat.notiser.map((notis) => (
                <p className="thc-notis" role="note" key={notis}>
                  {notis}
                </p>
              ))}
              <ol className="rus-plasseringer">
                {plasseringer.map((plassering) => (
                  <Kommentar
                    key={plassering.merke}
                    plassering={plassering}
                    visTekst={visTekst}
                    // Er det bare én kommentar, er det ingenting å skille den
                    // fra, og merkelappen sier ikke mer enn korthodet alt gjør.
                    visMerke={plasseringer.length > 1}
                    kopiert={kopierte.includes(plassering.merke)}
                    staarForTur={neste === plassering}
                    onCopy={() => void kopier(plassering)}
                  />
                ))}
              </ol>

              {alleKopiert && (
                <div className="thc-handling">
                  <Button ref={ferdigKnapp} shortcut="↵" onClick={onFinish}>
                    Ferdig
                  </Button>
                </div>
              )}
            </>
          )}

          {failedCopy && <ManualCopy message={KOPIFEIL} comment={failedCopy} />}
        </Card>
      </div>
    </section>
  )
}

/**
 * Én kommentar med koden den skal limes inn på.
 *
 * Teksten henger alltid på kopiknappen som et tips. I samlemodulene står den
 * i tillegg framme: der avhenger kommentaren av hva brukeren har krysset av,
 * og da skal den som limer inn kunne lese hva som faktisk blir kopiert.
 */
function Kommentar({
  plassering,
  visTekst,
  visMerke,
  kopiert,
  staarForTur,
  onCopy,
}: {
  plassering: RusPlassering
  visTekst: boolean
  visMerke: boolean
  kopiert: boolean
  staarForTur: boolean
  onCopy: () => void
}) {
  const tips = useTips(plassering.tekst)

  return (
    <li className={`rus-plassering rus-plassering--${plassering.rolle}`}>
      {visMerke && <p className="rus-plassering__merke">{plassering.merke}</p>}

      <p className="rus-plassering__instruks">
        <PasteIcon className="limInn__ikon" />
        Lim inn på
      </p>
      <p className="rus-plassering__koder">
        {plassering.koder.map((kode) => (
          <span key={kode}>{kode}</span>
        ))}
      </p>

      {visTekst && <p className="thc-kommentar">{plassering.tekst}</p>}

      <div className="rus-plassering__handling">
        {kopiert && (
          <p className="rus-kopiert">
            <CheckIcon className="rus-kopiert__ikon" />
            Kopiert
          </p>
        )}
        <Button
          {...tips.props}
          // Knappene heter det samme; merket sier hvilken kommentar det er.
          aria-label={`Kopier ${plassering.merke.toLowerCase()}`}
          variant={staarForTur ? 'primary' : 'subtle'}
          icon={<CopyIcon />}
          shortcut={staarForTur ? '↵' : undefined}
          onClick={() => onCopy()}
        >
          Kopier
        </Button>
        {tips.forklaring}
      </div>
    </li>
  )
}
