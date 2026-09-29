import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useBevart } from '../oppdatering/Bevaring'
import { Button } from './Button'
import { Card } from './Card'
import { Metalinje } from './Metalinje'
import { Panelhode } from './Panelhode'
import { StepBar } from './StepBar'
import { ManualCopy } from './ManualCopy'
import { ThcSkjema } from './ThcSkjema'
import { ThcKommentar, ThcVisualisering } from './ThcUtfall'
import { Ikon } from './ikon/Ikon'
import { THC_ANALYSEMETODE, THC_KODE } from '../domain/thc'
import { fortolkThc, tomThcInndata, type ThcModell, type ThcRegler } from '../domain/thcMotor'
import { erBekreftelse } from '../hooks/useKeyboard'
import { rullTilKort, useKortHopp } from '../hooks/useKortHopp'

export interface ThcStepProps {
  /** Reglene og tekstene som er publisert, eller hvorfor de ikke kan brukes ennå. */
  regler: ThcRegler
  onBack: () => void
  /** Legger teksten på utklippstavlen. Usant når utklippstavlen er utilgjengelig. */
  copy: (text: string) => Promise<boolean>
  /** Viser kopikvitteringen ved elementet — samme blink som i båndsteget. */
  flashAt: (element: Element | null | undefined) => void
}

/**
 * Fortolkningsmodulen for THC-syre i urin. Den fortolker med reglene og
 * tekstene som er publisert i databasen, og gir ingen kommentar før de er
 * hentet og har bestått kontrollen: mens de hentes, eller om de ikke kan
 * brukes, sier modulen fra i stedet.
 */
export function ThcStep({ regler, onBack, copy, flashAt }: ThcStepProps) {
  const seksjon = useRef<HTMLElement>(null)
  useKortHopp(true, seksjon)

  return (
    <section className="steg steg--thc" aria-label="Fortolk THC-syre i urin" ref={seksjon}>
      <StepBar onEsc={onBack}>Bytt analytt</StepBar>
      {regler.status === 'klar' ? (
        <ThcFortolkning modell={regler.modell} copy={copy} flashAt={flashAt} />
      ) : (
        <div className="thc">
          <Card align="start" className="analyttkort">
            <Korthode />
          </Card>
          <Card align="start" className="thc-resultat">
            {regler.status === 'feil' ? (
              <>
                <Panelhode ikon="fallback" tone="toksisk">
                  Reglene mangler
                </Panelhode>
                <ul className="mangelliste" role="alert">
                  <li>{regler.melding}</li>
                </ul>
                <Button variant="subtle" icon={<Ikon navn="reset" />} onClick={regler.provIgjen}>
                  Prøv igjen
                </Button>
              </>
            ) : (
              <>
                <Panelhode>Henter reglene</Panelhode>
                <p role="status">Fortolkningsreglene hentes …</p>
              </>
            )}
          </Card>
        </div>
      )}
    </section>
  )
}

/** Ikonet, koden og navnet øverst i modulen, med plass til en handling i hjørnet. */
function Korthode({ children }: { children?: ReactNode }) {
  return (
    <div className="thc-korthode">
      <span className="thc-korthode__ikon" data-ih="">
        <Ikon navn="cup" />
      </span>
      <div className="thc-korthode__tittel">
        <Metalinje koder={[THC_KODE]} metode={THC_ANALYSEMETODE} lenker />
        <h1 className="analytt__navn">THC-syre i urin</h1>
      </div>
      {children}
    </div>
  )
}

/**
 * Selve fortolkningen, med reglene klare. I motsetning til
 * kommentarkopieringen for psykofarmaka brukes den gjerne mange prøver på
 * rad, og flyten er lagt opp etter det: kommentaren regnes ut fortløpende
 * mens feltene fylles. Kopieringen kvitteres med blinket, ruller tilbake til
 * feltene og tilbyr nullstilling med ett tastetrykk, så neste prøve kan tas
 * fatt på uten omveier. Musehjulet og piltastene hopper mellom kortene i
 * stedet for å rulle jevnt.
 */
function ThcFortolkning({
  modell,
  copy,
  flashAt,
}: {
  modell: ThcModell
  copy: ThcStepProps['copy']
  flashAt: ThcStepProps['flashAt']
}) {
  const { regler } = modell
  // Det som er fylt inn, overlever en oppdatering av appen.
  const [inndata, setInndata] = useBevart('fortolkning/thc', () => tomThcInndata(regler))
  const [failedCopy, setFailedCopy] = useState<string | null>(null)
  /** Sant rett etter en kopiering: tilbudet om å nullstille med Enter står. */
  const [nullstillTips, setNullstillTips] = useState(false)
  /** Tikker for hver nullstilling, så fokuseringen under kan kjøre på nytt. */
  const [fokusTeller, setFokusTeller] = useState(0)
  // Feltet som skal ha fokus er det først synlige — «Forrige prøve» når det
  // finnes, ellers «Denne prøven», og under påvisningsgrensen er det UCAK som
  // står først. Refen flyttes derfor mellom feltene etter hvilket som faktisk
  // står øverst til venstre akkurat nå.
  const forsteFelt = useRef<HTMLInputElement>(null)
  const kopierKnapp = useRef<HTMLButtonElement>(null)
  const inndatakort = useRef<HTMLElement>(null)
  const resultatkort = useRef<HTMLElement>(null)

  // Kjører etter mount og etter hver nullstilling — begge ganger har DOM-en
  // allerede rukket å legge om hvilket felt refen peker på.
  useEffect(() => {
    forsteFelt.current?.focus()
  }, [fokusTeller])

  const resultat = useMemo(() => fortolkThc(inndata, modell), [inndata, modell])
  const kommentar = resultat.type === 'kommentar' ? resultat.kommentar : null

  // Reserveteksten for manuell kopiering gjelder kommentaren slik den var da
  // kopieringen feilet. Endres noe i skjemaet, er den utdatert og må vekk —
  // en gammel kommentar skal ikke bli liggende kopierbar under en ny.
  const sett = <K extends keyof typeof inndata>(felt: K, verdi: (typeof inndata)[K]) => {
    setInndata((forrige) => ({ ...forrige, [felt]: verdi }))
    setFailedCopy(null)
  }

  const nullstill = () => {
    setInndata(tomThcInndata(regler))
    setFailedCopy(null)
    setNullstillTips(false)
    // Fokuseringen skjer i effekten over, ikke her direkte: refen kan bytte
    // felt idet «Ingen tidligere prøve» nullstilles, og DOM-en er ikke
    // oppdatert med det nye feltet før React har rukket å rendre på nytt.
    setFokusTeller((t) => t + 1)
  }

  const kopier = async () => {
    if (kommentar === null) return
    if (await copy(kommentar)) {
      setFailedCopy(null)
      flashAt(kopierKnapp.current)
      // Tilbake til feltene, med nullstilling ett tastetrykk unna: neste
      // prøve er det vanlige neste steget.
      rullTilKort(inndatakort.current)
      setNullstillTips(true)
    } else {
      setFailedCopy(kommentar)
    }
  }

  /**
   * Bekreftelsen gjør bare én ting i modulen: kopierer kommentaren. Det ene
   * unntaket er tilbudet om å nullstille, som står rett etter en kopiering —
   * da tar den tilbudet i stedet.
   *
   * Tasten fanges på vinduet, før feltene og knappene ser den, og
   * nettleserens egen håndtering avlyses. Uten det gjør `Enter` forskjellige
   * ting etter hvor fokus tilfeldigvis står: et datofelt åpner kalenderen
   * igjen, en fokusert knapp trykker seg selv, og et felt i skjemaet sender
   * skjemaet. Mellomrom gjør det samme som `Enter` der tasten er ledig — i
   * IRCAK-feltene, for eksempel — mens den fortsatt trykker den knappen eller
   * huker av den avkryssingen man står på, og folder ut «Forklaring»
   * ({@link erBekreftelse}).
   *
   * Handlingen leses fra en ref, så lytteren settes opp én gang og overlever
   * at funksjonene bygges på nytt ved hver rendring.
   */
  const paaBekreftelse = useRef<() => void>()
  paaBekreftelse.current = nullstillTips ? nullstill : () => void kopier()

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

  // Tilbudet om å nullstille står til første handling: en bekreftelse tar det,
  // alt annet — en annen tast, et klikk, et rull — takker nei og rydder det
  // bort.
  useEffect(() => {
    if (!nullstillTips) return
    const paaTast = (event: KeyboardEvent) => {
      // Bekreftelsen tas av lytteren over.
      if (erBekreftelse(event)) return
      setNullstillTips(false)
    }
    const paaPeker = (event: PointerEvent) => {
      // Selve nullstill-knappen svarer for seg; tipset skal ikke lukke seg
      // i hånden på den.
      if ((event.target as Element).closest('[data-nullstill]')) return
      setNullstillTips(false)
    }
    const paaHjul = () => setNullstillTips(false)
    window.addEventListener('keydown', paaTast, true)
    window.addEventListener('pointerdown', paaPeker, true)
    window.addEventListener('wheel', paaHjul, { capture: true, passive: true })
    return () => {
      window.removeEventListener('keydown', paaTast, true)
      window.removeEventListener('pointerdown', paaPeker, true)
      window.removeEventListener('wheel', paaHjul, { capture: true })
    }
  }, [nullstillTips])

  return (
    <form
      className="thc"
      onSubmit={(e) => {
        e.preventDefault()
        void kopier()
      }}
    >
      <Card ref={inndatakort} align="start" className="analyttkort">
        <Korthode>
          <div className="thc-nullstillhjorne" data-nullstill>
            <Button variant="kant" icon={<Ikon navn="reset" />} onClick={nullstill}>
              Nullstill
            </Button>
            {nullstillTips && (
              <p className="thc-nullstilltips" role="status">
                Trykk <kbd className="hurtigtast">↵</kbd> for å nullstille nå
              </p>
            )}
          </div>
        </Korthode>
        <ThcSkjema inndata={inndata} onEndre={sett} regler={regler} forsteFelt={forsteFelt} />
      </Card>

      <Card ref={resultatkort} align="start" className="thc-resultat">
        <ThcKommentar
          resultat={resultat}
          regler={regler}
          onIngenTidligere={() => sett('ingenTidligere', true)}
          handling={
            <div className="handlingsrad handlingsrad--start">
              <Button ref={kopierKnapp} type="submit" icon={<Ikon navn="copy" />} shortcut="↵">
                Kopier kommentar
              </Button>
            </div>
          }
        />
        {failedCopy && <ManualCopy comment={failedCopy} />}
      </Card>

      <ThcVisualisering resultat={resultat} regler={regler} />
    </form>
  )
}
