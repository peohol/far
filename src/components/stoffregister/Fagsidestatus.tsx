import { useBevart } from '../../oppdatering/Bevaring'
import { useStoffregisterkilde } from '../../stoffregister/Stoffregisterkilde'
import { kanSletteStoff } from '../../stoffregister/modell'
import { Button } from '../Button'
import { Menyvalg, Nedtrekksmeny } from '../toppmeny/Nedtrekksmeny'
import { Bekreftknapp } from '../traad/Smadeler'
import { useRegisterhandling } from './Registerhandling'
import { slettesForGodt } from './papirkurv'
import { Versjonsliste } from '../kuratering/Utgavelister'
import { useValgfriFaginnholdskilde } from '../stoffside/Faginnholdskilde'

/**
 * Fagsidens plass i stoffregisteret, på selve siden: menyen som arkiverer og
 * sletter den, og meldingen øverst når den er arkivert eller ligger i
 * papirkurven. Reglene er de samme som på helsiden (`kanSletteStoff`).
 */

/**
 * «Mer» i toppmenyen: versjonene av fagsiden, og å arkivere eller slette den.
 * Ingenting når siden ikke har noen av delene.
 */
export function Fagsidemeny({ slug, navn }: { slug: string; navn?: string }) {
  const kilde = useStoffregisterkilde()
  const kuratering = useValgfriFaginnholdskilde()?.kuratering
  const { utfor } = useRegisterhandling()
  const [versjoner, setVersjoner] = useBevart('versjoner', false)
  const stoff = kilde?.register.menystoff(slug)
  const register = kilde && stoff && kilde.register.status(slug) === 'aktiv' ? { ...kilde, stoff } : null
  if (!register && !kuratering) return null
  const slett = register ? kanSletteStoff(register.stoff, register.admin) : null
  return (
    <>
      <Nedtrekksmeny
        knapp={{ ikon: 'more', etikett: 'Mer for fagsiden', variant: 'myk' }}
        etikett="Mer for fagsiden"
        lag="fagsidemeny"
      >
        {(lukk) => (
          <ul className="nedtrekk__valg">
            {kuratering && (
              <li>
                <Menyvalg
                  ikon="history"
                  tekst="Versjoner"
                  onClick={() => {
                    lukk()
                    setVersjoner(true)
                  }}
                />
              </li>
            )}
            {register && (
              <li>
                <Menyvalg
                  ikon="arkiv"
                  tekst="Arkiver fagsiden"
                  onClick={() => {
                    lukk()
                    void utfor(() => register.handlinger.arkiverStoff(slug, true), {
                      melding: `${register.stoff.navn} er arkivert.`,
                      angre: () => register.handlinger.arkiverStoff(slug, false),
                    })
                  }}
                />
              </li>
            )}
            {register && slett?.lov && (
              <li>
                <Menyvalg
                  ikon="trash"
                  tekst="Slett fagsiden"
                  {...(register.admin && { hint: 'Til papirkurven' })}
                  onClick={() => {
                    lukk()
                    void utfor(() => register.handlinger.slettStoff(slug), {
                      melding: `${register.stoff.navn} er slettet.`,
                      angre: () => register.handlinger.gjenopprettStoff(slug),
                    })
                  }}
                />
              </li>
            )}
          </ul>
        )}
      </Nedtrekksmeny>
      {kuratering && (
        <Versjonsliste apen={versjoner} stoff={slug} navn={navn || stoff?.navn || slug} onLukk={() => setVersjoner(false)} />
      )}
    </>
  )
}

/** Meldingen øverst på en arkivert fagside, eller en i papirkurven (som bare administratorer ser). */
export function Fagsidebanner({ slug }: { slug: string }) {
  const kilde = useStoffregisterkilde()
  const { utfor } = useRegisterhandling()
  if (!kilde) return null
  const { register, handlinger } = kilde
  const status = register.status(slug)
  if (status === 'arkivert') {
    const rad = register.arkiv.find((s) => s.slug === slug)
    return (
      <div className="sidevarsel" role="status">
        <p>
          Fagsiden er arkivert{rad?.endret_av ? ` av ${rad.endret_av}` : ''}. Den står ikke i stoffregisteret eller i
          søket før den hentes tilbake.
        </p>
        <Button variant="subtle" onClick={() => void utfor(() => handlinger.arkiverStoff(slug, false))}>
          Hent tilbake
        </Button>
      </div>
    )
  }
  if (status === 'papirkurv') {
    const rad = register.papirkurv.find((s) => s.slug === slug)
    return (
      <div className="sidevarsel" role="status">
        <p>
          Fagsiden ligger i papirkurven{rad ? ` og slettes for godt ${slettesForGodt(rad.endret_kl)}` : ''}. Bare
          administratorer ser den.
        </p>
        <Button variant="subtle" onClick={() => void utfor(() => handlinger.gjenopprettStoff(slug))}>
          Gjenopprett
        </Button>
        <Bekreftknapp
          ikon="trash"
          tekst="Slett for godt"
          bekreftTekst="Bekreft"
          bekreftEtikett="Bekreft at fagsiden slettes for godt"
          onBekreft={() => void utfor(() => handlinger.slettStoffForGodt(slug))}
        />
      </div>
    )
  }
  return null
}
