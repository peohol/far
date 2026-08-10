import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Pill } from './Pill'
import { StepBar } from './StepBar'
import { ManualCopy } from './ManualCopy'
import { ThcPlot } from './ThcPlot'
import { BackIcon, CopyIcon, ResetIcon } from './icons'
import { fortolkThc, MAKS_DAGER_MELLOM, THC_KODE, TOM_THC_INNDATA } from '../domain/thc'

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
 * rad: kommentaren regnes ut fortløpende mens feltene fylles, kopieringen
 * kvitteres med blinket og modulen blir stående, klar til å nullstilles for
 * neste prøve.
 */
export function ThcStep({ onBack, copy, flashAt }: ThcStepProps) {
  const [inndata, setInndata] = useState(TOM_THC_INNDATA)
  const [failedCopy, setFailedCopy] = useState<string | null>(null)
  const forsteFelt = useRef<HTMLInputElement>(null)
  const kopierKnapp = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    forsteFelt.current?.focus()
  }, [])

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
    forsteFelt.current?.focus()
  }

  const kopier = async () => {
    if (kommentar === null) return
    if (await copy(kommentar)) {
      setFailedCopy(null)
      flashAt(kopierKnapp.current)
    } else {
      setFailedCopy(kommentar)
    }
  }

  // Visualiseringen trenger minst ett døgn mellom prøvene for å ha en
  // utvikling å vise.
  const graf = resultat.type === 'kommentar' && resultat.graf && resultat.graf.dager >= 1 ? resultat.graf : null

  return (
    <section className="steg steg--thc" aria-label="Fortolk THC-syre i urin">
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
        <Card align="start" className="analyttkort">
          <Pill tone="kode">{THC_KODE}</Pill>
          <h1 className="analytt__navn">THC-syre i urin</h1>
          <p className="thc-ingress">
            IRCAK er den kreatininkorrigerte THC-syrekonsentrasjonen fra labsystemet. Kommentaren
            under oppdaterer seg etter hvert som feltene fylles ut.
          </p>

          <div className="thc-skjema">
            <label className="avkryssing">
              <input
                type="checkbox"
                checked={inndata.kronisk}
                onChange={(e) => sett('kronisk', e.target.checked)}
              />
              Legg kronisk bruk til grunn
            </label>

            <div className="thc-prover">
              <fieldset className="thc-prove">
                <legend>Denne prøven</legend>
                <label className="thc-felt">
                  <span>IRCAK</span>
                  <input
                    ref={forsteFelt}
                    className="thc-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    value={inndata.aktuellVerdi}
                    onChange={(e) => sett('aktuellVerdi', e.target.value)}
                  />
                </label>
                <label className="thc-felt">
                  <span>Prøvedato</span>
                  <input
                    className="thc-input"
                    type="date"
                    value={inndata.aktuellDato}
                    onChange={(e) => sett('aktuellDato', e.target.value)}
                  />
                </label>
              </fieldset>

              <fieldset className="thc-prove">
                <legend>Forrige prøve</legend>
                <label className="avkryssing">
                  <input
                    type="checkbox"
                    checked={inndata.ingenTidligere}
                    onChange={(e) => sett('ingenTidligere', e.target.checked)}
                  />
                  Ingen tidligere prøve tilgjengelig
                </label>
                {!inndata.ingenTidligere && (
                  <>
                    <label className="thc-felt">
                      <span>IRCAK</span>
                      <input
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
                  </>
                )}
              </fieldset>
            </div>
          </div>
        </Card>

        <Card align="start" className="thc-resultat">
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
            </>
          )}

          <div className="thc-handling">
            <Button variant="subtle" icon={<ResetIcon />} onClick={nullstill}>
              Nullstill
            </Button>
            <Button
              ref={kopierKnapp}
              type="submit"
              icon={<CopyIcon />}
              shortcut="↵"
              disabled={kommentar === null}
            >
              Kopier kommentar
            </Button>
          </div>

          {failedCopy && <ManualCopy message={KOPIFEIL} comment={failedCopy} />}
        </Card>

        {graf && (
          <Card align="start" className="thc-plot">
            <h2 className="thc-resultat__merke">Visualisering</h2>
            <p className="thc-ingress">
              Kurvene viser forventet prosentvis nedgang fra forrige prøve ved sporadisk og kronisk
              bruk. Punktet for denne prøven er korrigert for måleusikkerhet.
            </p>
            <ThcPlot grunnlag={graf} />
          </Card>
        )}
      </form>
    </section>
  )
}
