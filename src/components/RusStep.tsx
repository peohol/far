import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Kommentarliste } from './Kommentarliste'
import { Metodepille } from './Metodepille'
import { Pill } from './Pill'
import { Shortcut } from './Shortcut'
import { StepBar } from './StepBar'
import { Tallfelt } from './Tallfelt'
import { BackIcon } from './icons'
import {
  moduleKoder,
  viserKommentartekst,
  RUS_ANALYSEMETODE,
  TOM_RUS_INNDATA,
  type RusModul,
} from '../domain/rus'
import { useKortHopp } from '../hooks/useKortHopp'
import { indexToDigit, skrivesIFelt, useKeyboard } from '../hooks/useKeyboard'

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
 * Selve kopieringen av kommentarene er felles for fortolkningsmodulene og
 * ligger i {@link Kommentarliste}.
 */
export function RusStep({ modul, onBack, onFinish, copy, flashAt }: RusStepProps) {
  const [inndata, setInndata] = useState(TOM_RUS_INNDATA)
  /**
   * Teller opp for hver endring i skjemaet. Et nytt svar gir en ny
   * fortolkning, og det som var kopiert gjaldt den forrige.
   */
  const [utgave, setUtgave] = useState(0)
  const seksjon = useRef<HTMLElement>(null)
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

  const settPavist = (kode: string, pa: boolean) => {
    setInndata((forrige) => ({
      ...forrige,
      pavist: pa ? [...forrige.pavist, kode] : forrige.pavist.filter((k) => k !== kode),
    }))
    setUtgave((sa) => sa + 1)
  }

  const settVerdi = (kode: string, verdi: string) => {
    setInndata((forrige) => ({ ...forrige, verdier: { ...forrige.verdier, [kode]: verdi } }))
    setUtgave((sa) => sa + 1)
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

  return (
    <section className="steg steg--rus" aria-label={`Kommenter ${modul.navn}`} ref={seksjon}>
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onBack}>
          Bytt analytt
        </Button>
      </StepBar>

      <div className="modul">
        <Card align="start" className="analyttkort">
          <Metodepille metode={RUS_ANALYSEMETODE} kategori={modul.kategori} />
          <div className="modul-koder">
            {koder.map((kode) => (
              <Pill key={kode} tone="kode">
                {kode}
              </Pill>
            ))}
          </div>
          <h1 className="analytt__navn">{modul.navn}</h1>

          {!enkelt && (
            <fieldset className="modul-valg">
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
                    <span className="modul-valg__kode">{analytt.kode}</span>
                    <Shortcut>{indexToDigit(i)}</Shortcut>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {verdifelter.length > 0 && (
            <fieldset className="modul-valg">
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

        <Card align="start" className="modul-resultat">
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
                {resultat.plasseringer.length > 1 ? 'Kommentarer' : 'Kommentar'}
              </h2>
              {resultat.notiser.map((notis) => (
                <p className="thc-notis" role="note" key={notis}>
                  {notis}
                </p>
              ))}

              <Kommentarliste
                plasseringer={resultat.plasseringer}
                utgave={utgave}
                visTekst={visTekst}
                copy={copy}
                flashAt={flashAt}
                onFinish={onFinish}
              />
            </>
          )}
        </Card>
      </div>
    </section>
  )
}
