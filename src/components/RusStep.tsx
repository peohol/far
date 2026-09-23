import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Kommentarliste } from './Kommentarliste'
import { Metodepille } from './Metodepille'
import { Kodepille } from './Kodepille'
import { Rusutfall } from './Rusutfall'
import { Rusvalg } from './Rusvalg'
import { StepBar } from './StepBar'
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
              <Kodepille key={kode} kode={kode} />
            ))}
          </div>
          <h1 className="analytt__navn">{modul.navn}</h1>

          <Rusvalg
            analytter={modul.analytter}
            pavist={pavist}
            verdifelter={verdifelter}
            verdier={inndata.verdier}
            verdihjelp={modul.verdihjelp}
            onPavist={settPavist}
            onVerdi={settVerdi}
            forsteValg={forsteValg}
            snarveier
          />
        </Card>

        <Card align="start" className="modul-resultat">
          <Rusutfall
            resultat={resultat}
            kommentarer={(plasseringer) => (
              <Kommentarliste
                plasseringer={plasseringer}
                utgave={utgave}
                visTekst={visTekst}
                copy={copy}
                flashAt={flashAt}
                onFinish={onFinish}
              />
            )}
          />
        </Card>
      </div>
    </section>
  )
}
