import type { ThcRegelsett } from '../../domain/thcRegelsett'
import {
  erNivadelt,
  kommentarerFor,
  THC_FELLES_SETNINGER,
  THC_KOMMENTARNOKLER,
  THC_SITUASJONER,
  THC_SITUASJONSINFO,
  THC_TEKSTBOLKER,
  type ThcKommentarnokkel,
  type ThcSituasjon,
  type ThcTekster,
  type ThcTekstnokkel,
} from '../../domain/thcTekster'
import { eksempelkommentar, EKSEMPELDATOER, nivaerForKommentar, nivaliste } from '../../domain/thcVisning'
import { Uthev } from '../Uthev'
import { Tekstomrade } from './Regelfelter'

/**
 * Kommentarene THC-syrefortolkningen gir, situasjon for situasjon, slik
 * oversikten og redigeringen viser dem: de felles setningene først, så hver
 * situasjon med når den brukes og kommentaren for hvert nivå. Kommentarene
 * vises ferdig satt sammen, med introsetningen først og spørsmålsetningen
 * sist der den hører til, så det synes nøyaktig hva som kopieres.
 */

/** Merket på kommentaren for en gruppe nivåer: «Lav og middels høy», «Høy». */
function nivamerke(regler: ThcRegelsett, nokkel: ThcKommentarnokkel): string {
  return nivaliste(nivaerForKommentar(regler, nokkel).map((n) => n.navn))
}

const EKSEMPEL = `Eksempel med prøvedatoene ${EKSEMPELDATOER.forrigeDato} (forrige) og ${EKSEMPELDATOER.tidligereDato} (enda tidligere).`

/** Oversikten over kommentarene, til å lese. */
export function Thckommentarer({ regler, tekster }: { regler: ThcRegelsett; tekster: ThcTekster }) {
  return (
    <ol className="regeltekster">
      {THC_FELLES_SETNINGER.map((nokkel) => (
        <li key={nokkel} className="regeltekst">
          <p className="regeltekst__nummer">{THC_TEKSTBOLKER[nokkel].tittel}</p>
          <p className="regler__ingress">
            <Uthev tekst={THC_TEKSTBOLKER[nokkel].brukes} />
          </p>
          <p className="kommentartekst">
            <Uthev tekst={tekster[nokkel]} />
          </p>
        </li>
      ))}
      {THC_SITUASJONER.map((situasjon) => (
        <li key={situasjon} className="regeltekst">
          <p className="regeltekst__nummer">{THC_SITUASJONSINFO[situasjon].tittel}</p>
          <p className="regler__ingress">
            <Uthev tekst={THC_SITUASJONSINFO[situasjon].brukes} />
          </p>
          {kommentarerFor(situasjon).map((nokkel) => (
            <div key={nokkel} className="thc-kommentar">
              {erNivadelt(situasjon) && <p className="thc-kommentar__niva">{nivamerke(regler, nokkel)}</p>}
              <p className="kommentartekst">
                <Uthev tekst={eksempelkommentar(regler, tekster, nokkel)} />
              </p>
            </div>
          ))}
        </li>
      ))}
      <li className="regeltekst">
        <p className="felt__hjelp">{EKSEMPEL}</p>
      </li>
    </ol>
  )
}

/** Hva en tekst må inneholde, i redigeringen: «Må inneholde {forrige prøvedato}.» */
function maInneholde(nokkel: ThcTekstnokkel): string {
  const { plassholdere } = THC_TEKSTBOLKER[nokkel]
  return plassholdere.length > 0 ? `Må inneholde ${plassholdere.join(' og ')}.` : ''
}

/** Redigeringen av de felles setningene og kommentarene. */
export function Thckommentarredigering({
  regler,
  tekster,
  onTekst,
  onSporsmalsetning,
}: {
  regler: ThcRegelsett
  tekster: ThcTekster
  onTekst: (nokkel: ThcTekstnokkel, tekst: string) => void
  /** Kommentarene som skal avsluttes med spørsmålsetningen, i fast rekkefølge. */
  onSporsmalsetning: (nokler: ThcKommentarnokkel[]) => void
}) {
  const settSporsmal = (nokkel: ThcKommentarnokkel, med: boolean) =>
    onSporsmalsetning(
      THC_KOMMENTARNOKLER.filter((n) => (n === nokkel ? med : regler.med_sporsmalsetning.includes(n))),
    )

  return (
    <>
      <fieldset className="regelredigering__gruppe">
        <legend>Felles setninger</legend>
        <p className="felt__hjelp">
          Står ett sted og brukes i alle kommentarene under. Endres en setning her, endres den overalt.
        </p>
        {THC_FELLES_SETNINGER.map((nokkel) => (
          <Tekstomrade
            key={nokkel}
            merke={THC_TEKSTBOLKER[nokkel].tittel}
            verdi={tekster[nokkel]}
            hjelp={`${THC_TEKSTBOLKER[nokkel].brukes} ${maInneholde(nokkel)}`.trim()}
            onEndre={(tekst) => onTekst(nokkel, tekst)}
          />
        ))}
      </fieldset>

      <fieldset className="regelredigering__gruppe">
        <legend>Kommentarene</legend>
        <p className="felt__hjelp">
          Skriv bare det som kommer etter introsetningen. Introsetningen settes alltid først, og
          spørsmålsetningen sist der det er huket av for den. {'{forrige prøvedato}'} blir datoen for forrige
          prøve, og {'{tidligere prøvedato}'} datoen for den enda tidligere prøven. Under hver kommentar står
          den slik den blir. {EKSEMPEL}
        </p>
        {THC_SITUASJONER.map((situasjon) => (
          <Situasjonsredigering
            key={situasjon}
            situasjon={situasjon}
            regler={regler}
            tekster={tekster}
            onTekst={onTekst}
            onSporsmal={settSporsmal}
          />
        ))}
      </fieldset>
    </>
  )
}

function Situasjonsredigering({
  situasjon,
  regler,
  tekster,
  onTekst,
  onSporsmal,
}: {
  situasjon: ThcSituasjon
  regler: ThcRegelsett
  tekster: ThcTekster
  onTekst: (nokkel: ThcTekstnokkel, tekst: string) => void
  onSporsmal: (nokkel: ThcKommentarnokkel, med: boolean) => void
}) {
  const { tittel, brukes } = THC_SITUASJONSINFO[situasjon]
  return (
    <fieldset className="thc-kommentarredigering">
      <legend>{tittel}</legend>
      <p className="felt__hjelp">{brukes}</p>
      {kommentarerFor(situasjon).map((nokkel) => (
        <div key={nokkel} className="thc-kommentar">
          <Tekstomrade
            merke={erNivadelt(situasjon) ? `${tittel}: ${nivamerke(regler, nokkel).toLowerCase()}` : tittel}
            verdi={tekster[nokkel]}
            hjelp={maInneholde(nokkel) || undefined}
            onEndre={(tekst) => onTekst(nokkel, tekst)}
          />
          <label className="avkryssing">
            <input
              type="checkbox"
              checked={regler.med_sporsmalsetning.includes(nokkel)}
              onChange={(e) => onSporsmal(nokkel, e.target.checked)}
            />
            Avslutt med spørsmålsetningen
          </label>
          <p className="thc-kommentar__eksempel">
            <span className="thc-kommentar__niva">Slik blir den: </span>
            {eksempelkommentar(regler, tekster, nokkel)}
          </p>
        </div>
      ))}
    </fieldset>
  )
}
