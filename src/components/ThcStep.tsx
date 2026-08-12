import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Details } from './Details'
import { Pill } from './Pill'
import { StepBar } from './StepBar'
import { ManualCopy } from './ManualCopy'
import { ThcForklaring } from './ThcForklaring'
import { ThcPlot } from './ThcPlot'
import { BackIcon, CopyIcon, ResetIcon } from './icons'
import { fortolkThc, MAKS_DAGER_MELLOM, THC_KODE, TOM_THC_INNDATA } from '../domain/thc'
import { rullTilKort, useKortHopp } from '../hooks/useKortHopp'

const KOPIFEIL = 'Fikk ikke tilgang til utklippstavlen. Kopier teksten manuelt.'

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
  // finnes, ellers «Denne prøven». Refen flyttes derfor mellom de to inputene
  // etter hvilken som faktisk står øverst til venstre akkurat nå.
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
   * Enter gjør bare én ting i modulen: kopierer kommentaren. Det ene
   * unntaket er tilbudet om å nullstille, som står rett etter en kopiering —
   * da tar Enter tilbudet i stedet.
   *
   * Tasten fanges på vinduet, før feltene og knappene ser den, og
   * nettleserens egen håndtering avlyses. Uten det gjør Enter forskjellige
   * ting etter hvor fokus tilfeldigvis står: et datofelt åpner kalenderen
   * igjen, en fokusert knapp trykker seg selv, og et felt i skjemaet sender
   * skjemaet. Space trykker fortsatt knappen man står på, så alt lar seg
   * fremdeles betjene med tastaturet.
   *
   * Handlingen leses fra en ref, så lytteren settes opp én gang og overlever
   * at funksjonene bygges på nytt ved hver rendring.
   */
  const paaEnter = useRef<() => void>()
  paaEnter.current = nullstillTips ? nullstill : () => void kopier()

  useEffect(() => {
    const lytt = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      // Modifikatorkombinasjoner er nettleserens egne; de går gjennom.
      if (event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      event.stopPropagation()
      paaEnter.current?.()
    }
    window.addEventListener('keydown', lytt, true)
    return () => window.removeEventListener('keydown', lytt, true)
  }, [])

  // Tilbudet om å nullstille står til første handling: Enter tar det, alt
  // annet — en annen tast, et klikk, et rull — takker nei og rydder det bort.
  useEffect(() => {
    if (!nullstillTips) return
    const paaTast = (event: KeyboardEvent) => {
      // Enter tas av lytteren over.
      if (event.key === 'Enter') return
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
                  <label className="thc-felt">
                    <span>IRCAK</span>
                    <input
                      ref={forsteFelt}
                      className="thc-input"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      spellCheck={false}
                      value={inndata.forrigeVerdi}
                      onChange={(e) => sett('forrigeVerdi', e.target.value)}
                    />
                  </label>
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
                  <input
                    ref={inndata.ingenTidligere ? forsteFelt : undefined}
                    className="thc-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    value={inndata.aktuellVerdi}
                    onChange={(e) => sett('aktuellVerdi', e.target.value)}
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
