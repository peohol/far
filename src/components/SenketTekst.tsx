import type { Tekstdel } from '../faginnhold/mekanismer'
import { Uthev } from './Uthev'

/** En tekst i deler, med de senkede som `<sub>` og søketreffene fremhevet. */
export function SenketTekst({ deler }: { deler: readonly Tekstdel[] }) {
  return (
    <>
      {deler.map((del, i) =>
        del.senket ? (
          <sub key={i}>
            <Uthev tekst={del.tekst} />
          </sub>
        ) : (
          <Uthev key={i} tekst={del.tekst} />
        ),
      )}
    </>
  )
}
