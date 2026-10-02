import { useStoffregisterkilde } from '../../stoffregister/Stoffregisterkilde'
import { kanSletteStoff } from '../../stoffregister/modell'
import { Button } from '../Button'
import { Menyvalg, Nedtrekksmeny } from '../toppmeny/Nedtrekksmeny'
import { Bekreftknapp } from '../traad/Smadeler'
import { useRegisterhandling } from './Registerhandling'
import { slettesForGodt } from './papirkurv'

/**
 * Fagsidens plass i stoffregisteret, på selve siden: menyen som arkiverer og
 * sletter den, og meldingen øverst når den er arkivert eller ligger i
 * papirkurven. Reglene er de samme som på helsiden (`kanSletteStoff`).
 */

/** «Mer» i toppmenyen: arkiver eller slett fagsiden. Ingenting når siden ikke kan noen av delene. */
export function Fagsidemeny({ slug }: { slug: string }) {
  const kilde = useStoffregisterkilde()
  const { utfor } = useRegisterhandling()
  const stoff = kilde?.register.menystoff(slug)
  if (!kilde || !stoff || kilde.register.status(slug) !== 'aktiv') return null
  const { handlinger, admin } = kilde
  const slett = kanSletteStoff(stoff, admin)
  return (
    <Nedtrekksmeny
      knapp={{ ikon: 'more', etikett: 'Mer for fagsiden', variant: 'myk' }}
      etikett="Mer for fagsiden"
      lag="fagsidemeny"
    >
      {(lukk) => (
        <ul className="nedtrekk__valg">
          <li>
            <Menyvalg
              ikon="arkiv"
              tekst="Arkiver fagsiden"
              onClick={() => {
                lukk()
                void utfor(() => handlinger.arkiverStoff(slug, true), {
                  melding: `${stoff.navn} er arkivert.`,
                  angre: () => handlinger.arkiverStoff(slug, false),
                })
              }}
            />
          </li>
          {slett.lov && (
            <li>
              <Menyvalg
                ikon="trash"
                tekst="Slett fagsiden"
                {...(admin && { hint: 'Til papirkurven' })}
                onClick={() => {
                  lukk()
                  void utfor(() => handlinger.slettStoff(slug), {
                    melding: `${stoff.navn} er slettet.`,
                    angre: () => handlinger.gjenopprettStoff(slug),
                  })
                }}
              />
            </li>
          )}
        </ul>
      )}
    </Nedtrekksmeny>
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
