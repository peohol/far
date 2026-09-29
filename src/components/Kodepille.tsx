import { useTips } from './Tips'
import { stoffadresseForAnalytt } from '../domain/koblinger'
import { STOFFREGISTER } from '../domain/stoffregister'

/**
 * En analyttkode i metalinjen til en fortolkningsmodul, som lenke til
 * stoffsiden for stoffet koden primært er koblet til i stoffregisteret —
 * HBUP til bupropion, DMI til diazepam. Koden er aldri en side selv. Har
 * koden ikke noe slikt stoff, står den som tekst: det finnes ingen fagside å
 * lenke til.
 *
 * Koden står i aksentfargen som de andre kodene i metalinjen, og er en vanlig
 * lenke: den kan klikkes, åpnes i en ny fane og bokmerkes, og `Enter` følger
 * den også når fortolkningsmodulen ellers tar tasten til å kopiere (se
 * `enterErLedig` i `src/domain/tastatur.ts`). Moduler med flere koder har én
 * lenke per kode, og hver fører til sitt stoff.
 */
export function Kodepille({ kode }: { kode: string }) {
  const stoff = STOFFREGISTER.primartStoffFor(kode)
  const adresse = stoffadresseForAnalytt(kode)
  const tips = useTips(`Åpne stoffsiden for ${stoff?.navn ?? kode}`, { skjermleser: false })
  if (!stoff || !adresse) return <span className="metalinje__kode">{kode}</span>
  return (
    <a
      href={adresse}
      className="metalinje__kode metalinje__lenke"
      aria-label={`${kode} – åpne stoffsiden for ${stoff.navn}`}
      {...tips.props}
    >
      {kode}
    </a>
  )
}
