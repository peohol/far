import { referansetekst, type Referanse } from '../../faginnhold/referanser'
import { Uthev } from '../Uthev'

/**
 * Én referanse på Slaids-formen: «Tittel · Forfatter(e) · År · Lenke». Bare
 * lenken er klikkbar, og den åpnes i en ny fane. Søketreff på siden
 * fremheves (se `Uthev`).
 */
export function Referansetekst({ referanse }: { referanse: Referanse }) {
  const tekst = referansetekst(referanse)
  const lenke = referanse.lenke.trim()
  return (
    <>
      <Uthev tekst={tekst} />
      {tekst && lenke && ' · '}
      {lenke && (
        <a className="referanse__lenke" href={lenke} target="_blank" rel="noopener noreferrer">
          <Uthev tekst={lenke} />
        </a>
      )}
    </>
  )
}
