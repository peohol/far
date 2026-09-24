import { useId, useState } from 'react'
import { lesTallfelt } from '../../faginnhold/paneler'
import { regelsettvalg } from '../../domain/valg'
import type { Intervallregelsett } from '../../regler/modell'
import {
  HANDLINGSNAVN,
  NIVANAVN,
  simuler,
  visRingegrense,
  type Proveverdi,
  type Simulering,
} from '../../regler/visning'
import { Tallfelt } from '../Tallfelt'
import { bandIkon } from '../bandikon'
import { Ikon } from '../ikon/Ikon'

/**
 * Reglene i et regelsett som en tabell: konsentrasjonen, kommentaren den gir,
 * og om rekvirenten skal ringes. Radene er de samme knappene steg 2 viser, i
 * samme rekkefølge og med samme farger, og «Til stede under cut-off» står
 * sist når regelsettet har den.
 */
export function Regeltabell({ regelsett }: { regelsett: Intervallregelsett }) {
  const ringegrense = visRingegrense(regelsett)
  return (
    <>
      <div className="dosetabell__rull">
        <table className="dosetabell__tabell regler__tabell">
          <thead>
            <tr>
              <th scope="col">Konsentrasjon ({regelsett.enhet})</th>
              <th scope="col">Kommentar</th>
              <th scope="col">Ekstra handling</th>
            </tr>
          </thead>
          <tbody>
            {regelsettvalg(regelsett).map((valg) => (
              <tr key={valg.key}>
                <th scope="row" className={`regler__intervall regler__intervall--${valg.tone}`}>
                  <Ikon navn={bandIkon(valg)} />
                  {valg.label}
                </th>
                <td>{valg.kommentar}</td>
                <td>{valg.ring ? HANDLINGSNAVN.ring_rekvirent : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ringegrense && <p className="regler__merknad">Ringegrense: {ringegrense}</p>}
    </>
  )
}

/**
 * Svaret simulatoren gir, eller `null`. Mens grensene redigeres, kan de stå
 * i feil rekkefølge; da gir ikke regelsettet noe svar før de er rettet.
 */
function proev(regelsett: Intervallregelsett, verdi: Proveverdi | null | undefined): Simulering | null {
  if (verdi === null || verdi === undefined) return null
  try {
    return simuler(regelsett, verdi)
  } catch {
    return null
  }
}

/**
 * Simulatoren: en målt konsentrasjon inn, og ut regelen den treffer,
 * kommentaren og handlingen — nøyaktig det steg 2 ville gitt. Med
 * «Til stede under cut-off» prøves det valget i stedet.
 */
export function Regelsimulator({ regelsett }: { regelsett: Intervallregelsett }) {
  const [tekst, setTekst] = useState('')
  const [cutoff, setCutoff] = useState(false)
  const felt = useId()
  const verdi = lesTallfelt(tekst)
  const brukCutoff = cutoff && regelsett.cutoff !== null
  const svar = proev(regelsett, brukCutoff ? 'cutoff' : verdi)
  const regel = svar?.intervall !== null && svar?.intervall !== undefined ? regelsett.intervaller[svar.intervall] : null

  return (
    <div className="regler__simulator" role="group" aria-labelledby={`${felt}-tittel`}>
      <p id={`${felt}-tittel`} className="redigering__tittel">
        Prøv en verdi
      </p>
      <div className="regler__proverad">
        <div className="felt">
          <label className="felt__merkelapp" htmlFor={felt}>
            Målt konsentrasjon (<span className="enhet">{regelsett.enhet}</span>)
          </label>
          <Tallfelt id={felt} className="felt__inndata" value={tekst} onChange={setTekst} disabled={brukCutoff} />
        </div>
        {regelsett.cutoff && (
          <label className="regler__avkryssing">
            <input type="checkbox" checked={cutoff} onChange={(e) => setCutoff(e.target.checked)} />
            Til stede under cut-off
          </label>
        )}
      </div>
      <p className="regler__svar" aria-live="polite">
        {svar ? (
          <>
            <span className={`regler__intervall regler__intervall--${svar.valg.tone}`}>
              {brukCutoff ? svar.valg.label : `${svar.valg.label} ${regelsett.enhet}`}
              {regel && ` · ${NIVANAVN[regel.niva]}`}
            </span>
            <span className="regler__kommentar">{svar.valg.kommentar}</span>
            <span className="regler__handling">
              {svar.valg.ring ? `${HANDLINGSNAVN.ring_rekvirent}.` : 'Ingen ekstra handling.'}
            </span>
          </>
        ) : verdi === undefined ? (
          'Skriv et tall.'
        ) : (
          'Skriv en konsentrasjon for å se hvilken regel den treffer.'
        )}
      </p>
    </div>
  )
}
