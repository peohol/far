import { Pill } from './Pill'
import { useTips } from './Tips'
import { metodebeskrivelse } from '../domain/analysemetoder'

export interface MetodepillerProps {
  /** Koden til analysemetoden, f.eks. «SPFA». */
  metode: string
  /** Kategorien innenfor metoden. Utelates når metoden ikke er delt opp. */
  kategori?: string
}

/**
 * Analysemetoden analytten rekvireres under, øverst i analyttkortet.
 *
 * Koden står alene i pillen, slik den står på rekvisisjonen og i svarrapporten;
 * hva den betyr henger på som et tips, siden ikke alle kodene sier seg selv.
 * Kategorien følger etter i sin egen farge, så de tre pilletypene i kortet —
 * metode, kategori og analyttkode — skilles på farge og ikke på plassering.
 *
 * Pillen er et tipsanker og får derfor et tabulatorstopp, slik `Tips` gir all
 * annen tekst med forklaring bak seg: forklaringen skal kunne hentes fram med
 * tastaturet og ikke bare med pekeren.
 */
export function Metodepiller({ metode, kategori }: MetodepillerProps) {
  const tips = useTips(metodebeskrivelse(metode))

  return (
    <div className="metodepiller">
      <Pill tone="metode" tabIndex={0} {...tips.props}>
        {metode}
      </Pill>
      {tips.forklaring}
      {kategori && <Pill tone="kategori">{kategori}</Pill>}
    </div>
  )
}
