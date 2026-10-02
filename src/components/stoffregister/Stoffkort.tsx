import { fortolkningForStoff } from '../../domain/koblinger'
import { stoffadresse } from '../../domain/rute'
import type { Analyttkatalog } from '../../domain/analyttkatalog'
import type { Registerstoff } from '../../domain/stoffregister'
import { klartekst } from '../../faginnhold/riktekst'
import { forhandsvisning } from '../../faginnhold/oppsummering'
import { useStoffregisterkilde } from '../../stoffregister/Stoffregisterkilde'
import type { Analyte } from '../../types'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Detaljkort } from '../seksjoner/Seksjon'
import { Riktekst } from '../stoffside/Riktekst'

export interface Stoffkortvalg {
  katalog: Analyttkatalog
  onApneFortolkning: (analyte: Analyte) => void
}

/**
 * Ett stoff på helsiden: et detaljkort som åpnes animert, som kortene på
 * fagsidene. Lukket viser det navnet og begynnelsen på oppsummeringen. Åpnet
 * viser det hele oppsummeringen, analysene stoffet er koblet til, og veien til
 * fagsiden og fortolkningen.
 *
 * Kortet er bare for å lese. Det som endrer stoffet — hvor det står, arkivet
 * og slettingen — gjøres i redigeringen (`Redigeringsbrett`). Oppsummeringen
 * skrives på fagsiden (panelet «Identitet»), ikke her.
 */
export function Stoffkort({
  id,
  stoff,
  katalog,
  onApneFortolkning,
}: Stoffkortvalg & {
  /** Kortets nøkkel i seksjonen. Et stoff kan stå flere steder i én kategori. */
  id: string
  stoff: Registerstoff
}) {
  const kilde = useStoffregisterkilde()
  if (!kilde) return null
  const tekst = kilde.oppsummering(stoff.slug)
  const fortolkning = fortolkningForStoff(stoff.slug, kilde.register, katalog)

  return (
    <Detaljkort
      id={id}
      className="stoffkort"
      tittel={stoff.navn}
      oppsummering={tekst ? forhandsvisning(klartekst(tekst)) : undefined}
    >
      {tekst ? (
        <div className="stoffkort__oppsummering">
          <Riktekst dokument={tekst} />
        </div>
      ) : (
        <p className="stoffkort__tom">Ingen oppsummering ennå. Den skrives på fagsiden.</p>
      )}
      {stoff.koder.length > 0 && <p className="stoffkort__koder">Analyser: {stoff.koder.join(' · ')}</p>}

      <div className="stoffkort__handlinger">
        <a className="knapp knapp--kant" href={stoffadresse(stoff.slug)}>
          <span className="knapp__ikon">
            <Ikon navn="indik" />
          </span>
          <span className="knapp__tekst">Åpne fagside</span>
        </a>
        {fortolkning && (
          <Button variant="kant" icon={<Ikon navn="interp" />} onClick={() => onApneFortolkning(fortolkning)}>
            Åpne fortolkning
          </Button>
        )}
      </div>
    </Detaljkort>
  )
}

