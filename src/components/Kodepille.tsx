import { useTips } from './Tips'
import { analyttadresse } from '../domain/rute'

/**
 * En analyttkode i en fortolkningsmodul, som lenke til informasjonssiden for
 * koden.
 *
 * Pillen ser ut som de andre kodepillene og er en vanlig lenke: den kan
 * klikkes, åpnes i en ny fane og bokmerkes, og `Enter` følger den også når
 * fortolkningsmodulen ellers tar tasten til å kopiere (se `enterErLedig` i
 * `src/domain/tastatur.ts`). Moduler med flere koder har én pille per kode, og
 * hver fører til sin egen side.
 */
export function Kodepille({ kode }: { kode: string }) {
  const tips = useTips(`Åpne informasjonssiden for ${kode}`, { skjermleser: false })
  return (
    <a
      href={analyttadresse(kode)}
      className="pille pille--kode pille--lenke"
      aria-label={`${kode} – åpne informasjonssiden`}
      {...tips.props}
    >
      <span className="pille__verdi">{kode}</span>
    </a>
  )
}
