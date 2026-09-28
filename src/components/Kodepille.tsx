import { useTips } from './Tips'
import { kanoniskAnalyttkode } from '../domain/analyttkatalog'
import { analyttadresse } from '../domain/rute'

/**
 * En analyttkode i metalinjen til en fortolkningsmodul, som lenke til
 * informasjonssiden for koden.
 *
 * Koden står i aksentfargen som de andre kodene i metalinjen, og er en vanlig
 * lenke: den kan klikkes, åpnes i en ny fane og bokmerkes, og `Enter` følger
 * den også når fortolkningsmodulen ellers tar tasten til å kopiere (se
 * `enterErLedig` i `src/domain/tastatur.ts`). Moduler med flere koder har én
 * lenke per kode, og hver fører til sin egen side.
 */
export function Kodepille({ kode }: { kode: string }) {
  const tips = useTips(`Åpne informasjonssiden for ${kode}`, { skjermleser: false })
  return (
    <a
      href={analyttadresse(kanoniskAnalyttkode(kode))}
      className="metalinje__kode metalinje__lenke"
      aria-label={`${kode} – åpne informasjonssiden`}
      {...tips.props}
    >
      {kode}
    </a>
  )
}
