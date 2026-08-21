import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from './Button'
import { ManualCopy } from './ManualCopy'
import { useTips } from './Tips'
import { CheckIcon, CopyIcon, PasteIcon } from './icons'
import type { Kommentarplassering } from '../domain/kommentar'
import { hoppFram } from '../hooks/useKortHopp'
import { erBekreftelse } from '../hooks/useKeyboard'

const KOPIFEIL = 'Fikk ikke tilgang til utklippstavlen. Kopier teksten manuelt.'

export interface KommentarflytProps {
  /** Kommentarene fortolkningen ga, i den rekkefølgen de skal limes inn. */
  plasseringer: Kommentarplassering[]
  /**
   * Teller opp for hver endring i skjemaet over. Kvitteringene hører til den
   * utgaven de ble gitt i, så et nytt svar setter dem tilbake av seg selv —
   * det som var kopiert gjaldt den forrige fortolkningen.
   */
  utgave: number
  /**
   * Sant når kommentarteksten skal stå framme i blokka. Er det noe å velge
   * mellom, kan valget bli feil, og den som limer inn skal kunne lese hva som
   * faktisk havner på utklippstavlen. Ellers henger teksten på kopiknappen
   * som et tips.
   */
  visTekst: boolean
  /** Legger teksten på utklippstavlen. Usant når utklippstavlen er utilgjengelig. */
  copy: (text: string) => Promise<boolean>
  /** Viser kopikvitteringen ved elementet — samme blink som i båndsteget. */
  flashAt: (element: Element | null | undefined) => void
  /** Tilbake til søket, klar for neste analytt. */
  onFinish: () => void
}

/**
 * Kommentarene en fortolkning ga, og kopieringen av dem.
 *
 * Kommentarene kopieres én av gangen, i den rekkefølgen de skal limes inn.
 * `Enter` tar den neste som står for tur, og til slutt tilbake til søket, så
 * en hel kommentering går på tastaturet alene. Flyten er felles for
 * fortolkningsmodulene, slik at den oppfører seg likt uansett hvilken av dem
 * man står i.
 */
export function Kommentarflyt({
  plasseringer,
  utgave,
  visTekst,
  copy,
  flashAt,
  onFinish,
}: KommentarflytProps) {
  /** Merkene på kommentarene som er kopiert, og utgaven de gjaldt. */
  const [kvitterte, setKvitterte] = useState<{ utgave: number; merker: string[] }>({
    utgave,
    merker: [],
  })
  /** Kommentaren som må kopieres for hånd, og utgaven den gjaldt. */
  const [feilet, setFeilet] = useState<{ utgave: number; tekst: string } | null>(null)
  /**
   * Kopieringen som venter på blinket: merket på kommentaren som ble lagt på
   * utklippstavlen, med et løpenummer så to like kopieringer etter hverandre
   * begge blinker. Se {@link kopier}.
   */
  const [blink, setBlink] = useState<{ utgave: number; merke: string; nr: number } | null>(null)
  const blinknr = useRef(0)
  const liste = useRef<HTMLOListElement>(null)
  const ferdigKnapp = useRef<HTMLButtonElement>(null)

  // Alt som er kvittert for hører til den utgaven det ble kvittert i. Er
  // fortolkningen en annen nå, gjelder det ikke lenger.
  const kopierte = kvitterte.utgave === utgave ? kvitterte.merker : []
  const feilKopi = feilet?.utgave === utgave ? feilet.tekst : null

  // Neste kommentar som står for tur. Den bærer Enter-merket, så det går fram
  // hvor tastetrykket lander.
  const neste = plasseringer.find((p) => !kopierte.includes(p.merke))
  const alleKopiert = plasseringer.length > 0 && neste === undefined

  /**
   * Legger kommentaren på utklippstavlen og kvitterer for den.
   *
   * Utklippstavlen svarer først etter en tur innom nettleseren, og i mellomtiden
   * kan skjemaet ha fått et nytt svar. Da gjelder ikke lenger det som ble
   * kopiert: teksten på utklippstavlen hører til den forrige fortolkningen.
   * Kvitteringen føres derfor på utgaven kopieringen startet i, og vises bare
   * så lenge den utgaven fortsatt er den som gjelder.
   *
   * Selve blinket settes i gang i {@link useLayoutEffect} og ikke her — det må
   * vente til kortet har lagt seg om etter kopieringen.
   */
  const kopier = async (plassering: Kommentarplassering) => {
    const denne = utgave
    if (!(await copy(plassering.tekst))) {
      setFeilet({ utgave: denne, tekst: plassering.tekst })
      return
    }

    setFeilet(null)
    blinknr.current += 1
    setBlink({ utgave: denne, merke: plassering.merke, nr: blinknr.current })
    setKvitterte((sa) => {
      // En kopiering som ble innhentet av en nyere skal ikke skrive over den.
      if (sa.utgave > denne) return sa
      const merker = sa.utgave === denne ? sa.merker : []
      if (merker.includes(plassering.merke)) return sa
      return { utgave: denne, merker: [...merker, plassering.merke] }
    })
  }

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
    if (!blink || blink.utgave !== utgave) return
    const knapper = Array.from(
      liste.current?.querySelectorAll<HTMLElement>('.plassering .knapp') ?? [],
    )
    const brukt = knapper[plasseringer.findIndex((p) => p.merke === blink.merke)]
    const forTur = neste ? knapper[plasseringer.indexOf(neste)] : ferdigKnapp.current
    // Knappen som ble brukt står først: får ikke begge plass, er det den som
    // må være i bildet når blinket kommer.
    hoppFram(brukt, forTur)
    flashAt(brukt)
    // Kopieringen er det som skal kvitteres for; resten leses av slik kortet
    // står i det kvitteringen kommer.
  }, [blink])

  /**
   * `Enter` tar det neste steget i kommenteringen: kopierer kommentaren som
   * står for tur, og når alle er kopiert, tilbake til søket.
   *
   * Tasten fanges på vinduet før feltene og knappene ser den, slik den også
   * gjør i THC-modulen. Uten det ville en fokusert knapp trykket seg selv og
   * et fokusert felt sendt skjemaet. Mellomrom gjør det samme der tasten er
   * ledig — i konsentrasjonsfeltene, for eksempel — mens den fortsatt trykker
   * den knappen eller huker av den avkryssingen man står på
   * ({@link erBekreftelse}). Er det ingenting å kopiere, slippes tasten
   * gjennom: da skal en fokusert knapp trykkes som ellers i appen.
   */
  const paaBekreftelse = useRef<() => boolean>()
  paaBekreftelse.current = () => {
    if (neste) {
      void kopier(neste)
      return true
    }
    if (alleKopiert) {
      onFinish()
      return true
    }
    return false
  }

  useEffect(() => {
    const lytt = (event: KeyboardEvent) => {
      if (!erBekreftelse(event)) return
      if (!paaBekreftelse.current?.()) return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', lytt, true)
    return () => window.removeEventListener('keydown', lytt, true)
  }, [])

  return (
    <>
      {/* Kommentarene i den rekkefølgen de skal limes inn. Nummereringen fra
          <ol> vises ikke — merkelappen over hver kommentar sier hva den er —
          men den gir rekkefølgen mening for skjermlesere. */}
      <ol className="plasseringer" ref={liste}>
        {plasseringer.map((plassering) => (
          <Kommentar
            key={plassering.merke}
            plassering={plassering}
            visTekst={visTekst}
            // Er det bare én kommentar, er det ingenting å skille den fra, og
            // merkelappen sier ikke mer enn korthodet alt gjør.
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

      {feilKopi && <ManualCopy message={KOPIFEIL} comment={feilKopi} />}
    </>
  )
}

/**
 * Én kommentar med koden den skal limes inn på.
 *
 * Teksten henger alltid på kopiknappen som et tips, og står i tillegg framme
 * når fortolkningen avhenger av noe brukeren har svart: da skal den som limer
 * inn kunne lese hva som faktisk blir kopiert.
 */
function Kommentar({
  plassering,
  visTekst,
  visMerke,
  kopiert,
  staarForTur,
  onCopy,
}: {
  plassering: Kommentarplassering
  visTekst: boolean
  visMerke: boolean
  kopiert: boolean
  staarForTur: boolean
  onCopy: () => void
}) {
  const tips = useTips(plassering.tekst)

  return (
    <li className={`plassering plassering--${plassering.rolle}`}>
      {visMerke && <p className="plassering__merke">{plassering.merke}</p>}

      <p className="plassering__instruks">
        <PasteIcon className="limInn__ikon" />
        Lim inn på
      </p>
      <p className="plassering__koder">
        {plassering.koder.map((kode) => (
          <span key={kode}>{kode}</span>
        ))}
      </p>

      {visTekst && <p className="thc-kommentar">{plassering.tekst}</p>}

      <div className="plassering__handling">
        {kopiert && (
          <p className="kopiert">
            <CheckIcon className="kopiert__ikon" />
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
