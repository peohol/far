import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Details } from './Details'
import { Pill } from './Pill'
import { StepBar } from './StepBar'
import { ManualCopy } from './ManualCopy'
import { Tallfelt } from './Tallfelt'
import { ThcForklaring } from './ThcForklaring'
import { ThcPlot } from './ThcPlot'
import { Tips } from './Tips'
import { BackIcon, CopyIcon, ResetIcon } from './icons'
import {
  beregnIrcak,
  formaterIrcak,
  fortolkThc,
  MAKS_DAGER_MELLOM,
  THC_KODE,
  TOM_THC_INNDATA,
  type Sikkerhetsmargin,
} from '../domain/thc'
import { erBekreftelse } from '../hooks/useKeyboard'
import { rullTilKort, useKortHopp } from '../hooks/useKortHopp'

const KOPIFEIL = 'Fikk ikke tilgang til utklippstavlen. Kopier teksten manuelt.'

/**
 * Stoppene på sikkerhetsmarginen, fra ingen margin til den strengeste. De står
 * i den rekkefølgen skalaen har dem, så plasseringen på skalaen er indeksen i
 * lista.
 */
const MARGINSTOPP: { verdi: Sikkerhetsmargin; merke: string }[] = [
  { verdi: 0.5, merke: 'Ingen' },
  { verdi: 0.9, merke: '90 %' },
  { verdi: 0.99, merke: '99 %' },
]

/**
 * Hva sikkerhetsmarginen er: først hvorfor en målt endring ikke er den sanne,
 * så hva marginen gjør med den. Ordlyden er eierens egen; bare de rette
 * anførselstegnene er satt inn, som ellers i appen.
 */
const MARGINTIPS = (
  <>
    <section className="tipsboble__bolk">
      <h3 className="tipsboble__tittel">Målinger ≠ sann verdi</h3>
      <p>
        Det er uunngåelig at det oppstår tilfeldige avvik mellom målinger og den sanne verdien.
      </p>
      <p>
        Fordi enkeltmålingene er usikre, vil også endringen mellom to prøver være usikre. Den
        målte endringen er altså forventet å avvike fra den sanne endringen.
      </p>
      <p>
        Det er 50/50 om endringen måles høyere eller lavere enn den sanne endringen. I
        halvparten av tilfellene vil grunnlaget vårt for fortolkning være for strengt – i den
        andre halvparten vil det være for snilt.
      </p>
    </section>
    <section className="tipsboble__bolk">
      <h3 className="tipsboble__tittel">Sikkerhetsmargin</h3>
      <p>
        Hvis vi tolker prøvene direkte med de målingene vi har, er vi 50 % sikre på at endringen
        vi bruker i fortolkningen, ikke er «for streng». «Ingen sikkerhetsmargin» betyr egentlig
        bare at vi ikke har gjort noe for å kompensere for måleusikkerhet.
      </p>
      <p>
        Men vi kan kompensere om vi ønsker. Ved hjelp av en statistisk modell av usikkerheten til
        endringen, kan vi justere endringstallet til et lavere tall. Dette øker ikke
        sannsynligheten for at fortolkningen vår er «riktig», men øker hvor sikre vi er på at vi
        ikke bruker et for strengt endringstall.
      </p>
      <p>
        Med 90 % sikkerhet (standard) justerer vi endringen som fortolkes så vi er 90 % sikre på
        at endringen vi fortolker, ikke er for stor. I 1 av 10 tilfeller vil vi altså bruke en for
        stor endring i fortolkningen – mot annethvert tilfelle hvis vi ikke hadde noen
        sikkerhetsmargin.
      </p>
      <p>
        Sikkerheten kan økes til 99 % i saker der man ønsker å være ekstra forsiktig, f.eks. i
        saker der et nytt inntak av cannabis kan få store konsekvenser for prøvegiver.
      </p>
    </section>
  </>
)

/** Fast id, så også skalaen kan peke på forklaringen over den. */
const MARGINTIPS_ID = 'thc-margintips'

/**
 * Banneret over sikkerhetsmarginen når forrige prøve fortolkes under
 * påvisningsgrensen. Ordlyden er eierens egen.
 */
const UNDER_CUTOFF_BANNER =
  'Fordi vi nå fortolker konsentrasjoner under påvisningsgrensen, legges større måleusikkerhet til grunn. ' +
  'Dette gjør fortolkningen mer forsiktig.'

export interface ThcStepProps {
  onBack: () => void
  /** Legger teksten på utklippstavlen. Usant når utklippstavlen er utilgjengelig. */
  copy: (text: string) => Promise<boolean>
  /** Viser kopikvitteringen ved elementet — samme blink som i båndsteget. */
  flashAt: (element: Element | null | undefined) => void
}

/**
 * Fortolkningsmodulen for THC-syre i urin. I motsetning til
 * kommentarkopieringen for psykofarmaka brukes den gjerne mange prøver på
 * rad, og flyten er lagt opp etter det: kommentaren regnes ut fortløpende
 * mens feltene fylles. Kopieringen kvitteres med blinket, ruller tilbake til
 * feltene og tilbyr nullstilling med ett tastetrykk, så neste prøve kan tas
 * fatt på uten omveier. Musehjulet og piltastene hopper mellom kortene i
 * stedet for å rulle jevnt.
 */
export function ThcStep({ onBack, copy, flashAt }: ThcStepProps) {
  const [inndata, setInndata] = useState(TOM_THC_INNDATA)
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
  const seksjon = useRef<HTMLElement>(null)
  const inndatakort = useRef<HTMLElement>(null)
  const resultatkort = useRef<HTMLElement>(null)

  // Kjører etter mount og etter hver nullstilling — begge ganger har DOM-en
  // allerede rukket å legge om hvilket felt refen peker på.
  useEffect(() => {
    forsteFelt.current?.focus()
  }, [fokusTeller])

  useKortHopp(true, seksjon)

  const resultat = useMemo(() => fortolkThc(inndata), [inndata])
  const kommentar = resultat.type === 'kommentar' ? resultat.kommentar : null

  // Avkryssingen står inne i «Forrige prøve», så den gjelder bare når det
  // finnes en forrige prøve å fortolke.
  const underCutoff = !inndata.ingenTidligere && inndata.forrigeUnderCutoff
  const beregnetIrcak = underCutoff ? beregnIrcak(inndata.forrigeUcak, inndata.forrigeNkre) : null

  // Stoppet skalaen står på. Stoppene dekker alle verdiene typen tillater,
  // så oppslaget treffer.
  const marginIndeks = MARGINSTOPP.findIndex((stopp) => stopp.verdi === inndata.sikkerhetsmargin)

  // Reserveteksten for manuell kopiering gjelder kommentaren slik den var da
  // kopieringen feilet. Endres noe i skjemaet, er den utdatert og må vekk —
  // en gammel kommentar skal ikke bli liggende kopierbar under en ny.
  const sett = <K extends keyof typeof inndata>(felt: K, verdi: (typeof inndata)[K]) => {
    setInndata((forrige) => ({ ...forrige, [felt]: verdi }))
    setFailedCopy(null)
  }

  const nullstill = () => {
    setInndata(TOM_THC_INNDATA)
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

  // Visualiseringen trenger minst ett døgn mellom prøvene for å ha en
  // utvikling å vise.
  const grunnlag =
    resultat.type === 'kommentar' && resultat.grunnlag && resultat.grunnlag.dager >= 1
      ? resultat.grunnlag
      : null
  const kategori = resultat.type === 'kommentar' ? resultat.kategori : 0

  return (
    <section className="steg steg--thc" aria-label="Fortolk THC-syre i urin" ref={seksjon}>
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onBack}>
          Bytt analytt
        </Button>
      </StepBar>

      <form
        className="thc"
        onSubmit={(e) => {
          e.preventDefault()
          void kopier()
        }}
      >
        <Card ref={inndatakort} align="start" className="analyttkort">
          <div className="thc-korthode">
            <Pill tone="kode">{THC_KODE}</Pill>
            <div className="thc-nullstillhjorne" data-nullstill>
              <Button variant="subtle" icon={<ResetIcon />} onClick={nullstill}>
                Nullstill
              </Button>
              {nullstillTips && (
                <p className="thc-nullstilltips" role="status">
                  Trykk <kbd className="hurtigtast">↵</kbd> for å nullstille nå
                </p>
              )}
            </div>
          </div>
          <h1 className="analytt__navn">THC-syre i urin</h1>

          <div className="thc-skjema">
            <div className="thc-avkryssinger">
              <label className="avkryssing">
                <input
                  type="checkbox"
                  checked={inndata.kronisk}
                  onChange={(e) => sett('kronisk', e.target.checked)}
                />
                Legg kronisk bruk til grunn
              </label>
              <label className="avkryssing">
                <input
                  type="checkbox"
                  checked={inndata.ingenTidligere}
                  onChange={(e) => sett('ingenTidligere', e.target.checked)}
                />
                Ingen tidligere prøve tilgjengelig
              </label>
            </div>

            <div className="thc-prover">
              {!inndata.ingenTidligere && (
                <fieldset className="thc-prove">
                  <legend>Forrige prøve</legend>
                  {/* Var urinen så fortynnet at THC-syre havnet under
                      påvisningsgrensen, svarer labsystemet «ikke påvist» og
                      regner ingen IRCAK. De to interne tallene tastes da i
                      stedet, og IRCAK regnes ut av dem. */}
                  <label className="avkryssing avkryssing--felt">
                    <input
                      type="checkbox"
                      checked={inndata.forrigeUnderCutoff}
                      onChange={(e) => sett('forrigeUnderCutoff', e.target.checked)}
                    />
                    Under cut-off
                  </label>
                  {inndata.forrigeUnderCutoff ? (
                    <>
                      <label className="thc-felt">
                        <span>UCAK (THC-syre)</span>
                        <Tallfelt
                          ref={forsteFelt}
                          value={inndata.forrigeUcak}
                          onChange={(verdi) => sett('forrigeUcak', verdi)}
                        />
                      </label>
                      <label className="thc-felt">
                        <span>NKRE (kreatinin)</span>
                        <Tallfelt
                          value={inndata.forrigeNkre}
                          onChange={(verdi) => sett('forrigeNkre', verdi)}
                        />
                      </label>
                      <p className="thc-beregnet" role="status">
                        Beregnet IRCAK:{' '}
                        <strong>
                          {beregnetIrcak === null ? '–' : formaterIrcak(beregnetIrcak)}
                        </strong>
                      </p>
                    </>
                  ) : (
                    <label className="thc-felt">
                      <span>IRCAK</span>
                      <Tallfelt
                        ref={forsteFelt}
                        value={inndata.forrigeVerdi}
                        onChange={(verdi) => sett('forrigeVerdi', verdi)}
                      />
                    </label>
                  )}
                  <label className="thc-felt">
                    <span>Prøvedato</span>
                    <input
                      className="thc-input"
                      type="date"
                      value={inndata.forrigeDato}
                      onChange={(e) => sett('forrigeDato', e.target.value)}
                    />
                  </label>
                </fieldset>
              )}

              <fieldset className="thc-prove">
                <legend>Denne prøven</legend>
                <label className="thc-felt">
                  <span>IRCAK</span>
                  <Tallfelt
                    ref={inndata.ingenTidligere ? forsteFelt : undefined}
                    value={inndata.aktuellVerdi}
                    onChange={(verdi) => sett('aktuellVerdi', verdi)}
                  />
                </label>
                {/* Uten en tidligere prøve å telle døgn mot brukes ikke datoen,
                    og da skal den heller ikke fylles ut. */}
                {!inndata.ingenTidligere && (
                  <label className="thc-felt">
                    <span>Prøvedato</span>
                    <input
                      className="thc-input"
                      type="date"
                      value={inndata.aktuellDato}
                      onChange={(e) => sett('aktuellDato', e.target.value)}
                    />
                  </label>
                )}
              </fieldset>
            </div>

            {/* Sikkerhetsmarginen gjelder bare sammenligningen mot forrige
                prøve, så uten en slik prøve er den ikke noe å ta stilling
                til — samme grunn som datoene skjules av. */}
            {!inndata.ingenTidligere && (
              <div className="thc-margin">
                {underCutoff && (
                  <p className="thc-banner" role="note">
                    {UNDER_CUTOFF_BANNER}
                  </p>
                )}
                <div className="thc-margin__hode">
                  <Tips forklaring={MARGINTIPS} id={MARGINTIPS_ID}>
                    Sikkerhetsmargin
                  </Tips>
                </div>
                <input
                  className="thc-margin__skala"
                  type="range"
                  min={0}
                  max={MARGINSTOPP.length - 1}
                  step={1}
                  value={marginIndeks}
                  aria-label="Sikkerhetsmargin"
                  aria-describedby={MARGINTIPS_ID}
                  aria-valuetext={MARGINSTOPP[marginIndeks]?.merke}
                  onChange={(e) => {
                    const stopp = MARGINSTOPP[Number(e.target.value)]
                    if (stopp) sett('sikkerhetsmargin', stopp.verdi)
                  }}
                />
                {/* Merkene er rene ledetekster — skalaen melder selv hvilket
                    stopp den står på, gjennom aria-valuetext. */}
                <div className="thc-margin__merker" aria-hidden="true">
                  {MARGINSTOPP.map((stopp, i) => (
                    <span
                      key={stopp.verdi}
                      className={`thc-margin__merke${i === marginIndeks ? ' thc-margin__merke--valgt' : ''}`}
                    >
                      {stopp.merke}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card ref={resultatkort} align="start" className="thc-resultat">
          {resultat.type === 'mangler' ? (
            <>
              <h2 className="thc-resultat__merke">Mangler</h2>
              <ul className="thc-mangler">
                {resultat.mangler.map((melding) => (
                  <li key={melding}>{melding}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2 className="thc-resultat__merke">Kommentar</h2>
              {resultat.forGammelForrige && (
                <p className="thc-notis" role="note">
                  Det er mer enn {MAKS_DAGER_MELLOM} dager mellom prøvene, og forrige prøve gir da
                  ikke grunnlag for sammenligning. Kommentaren fortolker bare denne prøven.
                </p>
              )}
              <p className="thc-kommentar">{resultat.kommentar}</p>
              <div className="thc-handling">
                <Button ref={kopierKnapp} type="submit" icon={<CopyIcon />} shortcut="↵">
                  Kopier kommentar
                </Button>
              </div>
            </>
          )}

          {failedCopy && <ManualCopy message={KOPIFEIL} comment={failedCopy} />}
        </Card>

        {grunnlag && (
          <Card align="start" className="thc-plot">
            <h2 className="thc-resultat__merke">Visualisering</h2>
            <ThcPlot grunnlag={grunnlag} />
            <Details summary="Forklaring">
              <ThcForklaring grunnlag={grunnlag} kategori={kategori} />
            </Details>
          </Card>
        )}
      </form>
    </section>
  )
}
