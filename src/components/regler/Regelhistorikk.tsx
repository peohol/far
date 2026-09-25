import type { Kommentarinnhold } from '../../domain/kommentarobjekt'
import { upublisert } from '../../faginnhold/analyttside'
import { endredeFelt, type Felt } from '../../faginnhold/historikk'
import type { Utgave } from '../../faginnhold/lesing'
import type { Innhold } from '../../faginnhold/modell'
import { antall } from '../../faginnhold/oppsummering'
import { Sistredigert } from '../historikk/Sistredigert'
import { Detaljkort } from '../seksjoner/Seksjon'

type Regelsettype = 'intervallregelsett' | 'scenarioregelsett'

/**
 * Hva i regelsettet og kommentarene det bruker som ikke er publisert, som
 * navnene på feltene. `publisert` er feltene i det publiserte, eller `null`
 * når regelsettet aldri er publisert.
 */
export function upubliserteFelt(utgaver: readonly Utgave<unknown>[], publisert: Felt[] | null, utkast: Felt[]): string[] {
  if (!utgaver.some(upublisert)) return []
  return publisert ? endredeFelt(publisert, utkast) : ['Hele regelsettet']
}

/**
 * Det en administrator ser under fortolkningsreglene i redigeringsmodus:
 * «Sist redigert» for regelsettet, med historikken bak, hva som ikke er
 * publisert, og historikken for hver kommentar regelsettet bruker. Felles for
 * intervallreglene og scenarioreglene.
 */
export function Regelhistorikk<T extends Regelsettype>({
  utgave,
  type,
  felter,
  upubliserte,
  kommentarer,
}: {
  utgave: Utgave<Innhold[T]>
  type: T
  /** Feltene historikken sammenligner, med navnene på kommentarene. */
  felter: (innhold: Innhold[T]) => Felt[]
  upubliserte: string[]
  kommentarer: readonly Utgave<Kommentarinnhold>[]
}) {
  return (
    <>
      <div className="redigeringsrad regler__historikk">
        <Sistredigert utgave={utgave} type={type} navn="Fortolkningsreglene" felter={felter} />
        {upubliserte.length > 0 && <p className="sistredigert">Ikke publisert: {upubliserte.join(', ')}.</p>}
      </div>
      <Detaljkort
        id="kommentarhistorikk"
        tittel="Historikken for hver kommentar"
        oppsummering={antall(kommentarer.length, 'kommentar', 'kommentarer')}
      >
        <ul className="regler__kommentarhistorikk">
          {kommentarer.map((k) => (
            <li key={k.id}>
              <span className="sistredigert">{k.innhold.navn}: </span>
              <Sistredigert utgave={k} type="kommentar" navn={`Kommentaren «${k.innhold.navn}»`} />
            </li>
          ))}
        </ul>
      </Detaljkort>
    </>
  )
}

/** Navnene på kommentarene, som regelsettets egen historikk viser i stedet for tekstene. */
export function kommentarnavnoppslag(kommentarer: readonly Utgave<Kommentarinnhold>[]): (id: string) => string {
  const navn = new Map(kommentarer.map((k) => [k.id, k.innhold.navn]))
  return (id) => navn.get(id) ?? 'En kommentar regelsettet ikke bruker nå'
}
