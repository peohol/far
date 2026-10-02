import { useId, useState } from 'react'
import { fortolkningForStoff } from '../../domain/koblinger'
import { stoffadresse } from '../../domain/rute'
import type { Analyttkatalog } from '../../domain/analyttkatalog'
import type { Registerstoff, Stoffregister } from '../../domain/stoffregister'
import { klartekst } from '../../faginnhold/riktekst'
import { forhandsvisning, ramsOpp } from '../../faginnhold/oppsummering'
import { useStoffregisterkilde } from '../../stoffregister/Stoffregisterkilde'
import { kanSletteStoff } from '../../stoffregister/modell'
import type { Analyte } from '../../types'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Detaljkort } from '../seksjoner/Seksjon'
import { useSeksjonsstyring } from '../seksjoner/Seksjonsstyring'
import { Riktekst } from '../stoffside/Riktekst'
import { Idehandling, Slettknapp } from '../traad/Smadeler'
import { Kategorialternativer } from './Kategorialternativer'
import { useRegisterhandling } from './Registerhandling'

export interface Stoffkortvalg {
  katalog: Analyttkatalog
  onApneFortolkning: (analyte: Analyte) => void
}

/**
 * Ett stoff på helsiden: et detaljkort som åpnes animert, som kortene på
 * fagsidene. Lukket viser det begynnelsen på oppsummeringen, eller kodene til
 * analysene stoffet er primært koblet til. Åpnet viser det hele
 * oppsummeringen, veien til fagsiden og fortolkningen, hvor stoffet står, og
 * knappene som arkiverer og sletter det.
 *
 * Oppsummeringen skrives på fagsiden (panelet «Identitet»), ikke her.
 */
export function Stoffkort({
  seksjon,
  id,
  stoff,
  katalog,
  onApneFortolkning,
}: Stoffkortvalg & {
  /** Seksjonen kortet står i. */
  seksjon: string
  /** Kortets nøkkel i seksjonen. Et stoff kan stå flere steder i én kategori. */
  id: string
  stoff: Registerstoff
}) {
  const kilde = useStoffregisterkilde()
  const { utfor } = useRegisterhandling()
  const apnet = useHarVaertApen([seksjon, id])
  if (!kilde) return null
  const { register, handlinger, admin } = kilde
  const tekst = kilde.oppsummering(stoff.slug)
  const fortolkning = fortolkningForStoff(stoff.slug, register, katalog)
  const slett = kanSletteStoff(stoff, admin)

  const arkiver = () =>
    void utfor(() => handlinger.arkiverStoff(stoff.slug, true), {
      melding: `${stoff.navn} er arkivert.`,
      angre: () => handlinger.arkiverStoff(stoff.slug, false),
    })
  // Den som slettet, kan angre det, også uten å se papirkurven.
  const slettStoff = () =>
    void utfor(() => handlinger.slettStoff(stoff.slug), {
      melding: `${stoff.navn} er slettet.`,
      angre: () => handlinger.gjenopprettStoff(stoff.slug),
    })

  return (
    <Detaljkort
      id={id}
      className="stoffkort"
      tittel={stoff.navn}
      oppsummering={tekst ? forhandsvisning(klartekst(tekst)) : ramsOpp(stoff.koder)}
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

      {apnet && (
        <>
          <Plasseringer stoff={stoff} register={register} />
          <div className="stoffkort__redigering">
            <Idehandling ikon="arkiv" onClick={arkiver}>
              Arkiver
            </Idehandling>
            {slett.lov && <Slettknapp hva={stoff.navn} onSlett={slettStoff} />}
          </div>
        </>
      )}
    </Detaljkort>
  )
}

/**
 * Om kortet er eller har vært åpent. Hvor stoffet står og knappene som endrer
 * det, tegnes først da: registeret har hundrevis av kort, og hvert har et
 * valg med alle kategoriene. Søket på siden trenger dem ikke.
 */
function useHarVaertApen(sti: readonly string[]): boolean {
  const apen = useSeksjonsstyring()?.tilstand(sti, false).apen ?? true
  const [vist, setVist] = useState(apen)
  if (apen && !vist) setVist(true)
  return apen || vist
}

/**
 * Hvor stoffet står: hver plass med en knapp som tar det ut derfra, og et valg
 * som legger det til i en kategori til. Det samme som å dra det i
 * redigeringen, men et stoff kan her stå flere steder, og det går uten å dra.
 */
function Plasseringer({ stoff, register }: { stoff: Registerstoff; register: Stoffregister }) {
  const kilde = useStoffregisterkilde()
  const { utfor } = useRegisterhandling()
  const velgId = useId()
  if (!kilde) return null
  const plasser = register.plasseringerFor(stoff.slug)
  const har = new Set(plasser.map((p) => p.id))
  const navn = (p: (typeof plasser)[number]) => [p.kategori, p.underkategori].filter(Boolean).join(' › ')

  return (
    <div className="stoffkort__plassering">
      <span className="stoffkort__etikett">Står i</span>
      {plasser.length === 0 && <span className="stoffkort__plass">Andre stoffer</span>}
      {plasser.map((p) => (
        <span key={p.id} className="stoffkort__plass">
          {navn(p)}
          <button
            type="button"
            className="stoffkort__fjern"
            aria-label={`Ta ${stoff.navn} ut av ${navn(p)}`}
            onClick={() => void utfor(() => kilde.handlinger.plasserStoff(stoff.slug, p.id, null))}
          >
            <Ikon navn="close" storrelse="ui" />
          </button>
        </span>
      ))}
      <label className="kun-skjermleser" htmlFor={velgId}>
        Legg {stoff.navn} til i en kategori
      </label>
      <select
        id={velgId}
        className="felt__inndata stoffkort__velg"
        value=""
        onChange={(e) => {
          const til = e.target.value
          if (til) void utfor(() => kilde.handlinger.plasserStoff(stoff.slug, null, til))
        }}
      >
        <option value="">Legg til i kategori …</option>
        <Kategorialternativer register={register} opptatt={har} />
      </select>
    </div>
  )
}
