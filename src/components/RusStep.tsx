import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { ManualCopy } from './ManualCopy'
import { Pill } from './Pill'
import { StepBar } from './StepBar'
import { useTips } from './Tips'
import { BackIcon, CheckIcon, CopyIcon, PasteIcon } from './icons'
import {
  moduleKoder,
  viserKommentartekst,
  TOM_RUS_INNDATA,
  type RusModul,
  type RusPlassering,
} from '../domain/rus'
import { useKortHopp } from '../hooks/useKortHopp'

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
  const seksjon = useRef<HTMLElement>(null)
  const resultatkort = useRef<HTMLElement>(null)
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
   * Legger kommentaren på utklippstavlen og kvitterer for den.
   *
   * Utklippstavlen svarer først etter en tur innom nettleseren, og i mellomtiden
   * kan skjemaet ha fått et nytt svar. Da gjelder ikke lenger det som ble
   * kopiert: teksten på utklippstavlen hører til den forrige fortolkningen.
   * Uten sjekken under ville kvitteringen kommet tilbake på en kommentar som
   * ikke er kopiert, og Enter hoppet over den.
   */
  const kopier = async (plassering: RusPlassering, knapp: Element | null) => {
    const denne = utgave.current
    const kopiert = await copy(plassering.tekst)
    if (denne !== utgave.current) return

    if (kopiert) {
      setFailedCopy(null)
      flashAt(knapp)
      setKopierte((sa) => (sa.includes(plassering.merke) ? sa : [...sa, plassering.merke]))
    } else {
      setFailedCopy(plassering.tekst)
    }
  }

  /**
   * Enter tar det neste steget i kommenteringen: kopierer kommentaren som står
   * for tur, og når alle er kopiert, tilbake til søket.
   *
   * Tasten fanges på vinduet før feltene og knappene ser den, slik den også
   * gjør i THC-modulen. Uten det ville en fokusert knapp trykket seg selv og
   * et fokusert felt sendt skjemaet. `Space` trykker fortsatt den knappen eller
   * avkryssingen man står på, så alt lar seg betjene med tastaturet som før.
   */
  const paaEnter = useRef<() => void>()
  paaEnter.current = () => {
    if (neste) {
      // Kvitteringen skal blinke ved knappen som hører til kommentaren.
      // Knappene står i samme rekkefølge som kommentarene, én per kommentar.
      const knapper = resultatkort.current?.querySelectorAll('.rus-plassering .knapp')
      void kopier(neste, knapper?.[plasseringer.indexOf(neste)] ?? null)
    } else if (alleKopiert) {
      onFinish()
    }
  }

  useEffect(() => {
    const lytt = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      event.stopPropagation()
      paaEnter.current?.()
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
                    />
                    {analytt.navn}
                    <span className="rus-valg__kode">{analytt.kode}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {verdifelter.length > 0 && (
            <fieldset className="rus-valg">
              <legend>Målte konsentrasjoner</legend>
              <p className="rus-hjelp">{modul.verdihjelp}</p>
              <div className="rus-felter">
                {verdifelter.map((felt) => (
                  <label className="thc-felt" key={felt.kode}>
                    <span>
                      {felt.navn} ({felt.kode})
                    </span>
                    <input
                      className="thc-input"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      spellCheck={false}
                      value={inndata.verdier[felt.kode] ?? ''}
                      onChange={(e) => settVerdi(felt.kode, e.target.value)}
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
                    onCopy={(knapp) => void kopier(plassering, knapp)}
                  />
                ))}
              </ol>

              {alleKopiert && (
                <div className="thc-handling">
                  <Button shortcut="↵" onClick={onFinish}>
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
  onCopy: (knapp: Element | null) => void
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
          onClick={(e) => onCopy(e.currentTarget)}
        >
          Kopier
        </Button>
        {tips.forklaring}
      </div>
    </li>
  )
}
