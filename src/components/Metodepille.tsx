import { Pill } from './Pill'
import { useTips } from './Tips'
import { metodebeskrivelse, metodefarger } from '../domain/analysemetoder'

export interface MetodepilleProps {
  /** Koden til analysemetoden, f.eks. «SPFA». */
  metode: string
  /** Kategorien innenfor metoden. Utelates når metoden ikke er delt opp. */
  kategori?: string
}

/**
 * Analysemetoden en analytt rekvireres under, som én pille: «SPFA ›
 * Antidepressiver».
 *
 * Metoden og kategorien hører sammen — kategorien betyr ingenting uten
 * metoden den ligger i — så de deler pille i stedet for å stå som to.
 * Pillen bærer metodens egen farge, den samme som skuffen i sidemenyen og
 * menyknappen når filteret står på metoden, slik at fargen alene sier hvilken
 * analyse dette er.
 *
 * Koden sier ikke alltid seg selv, så beskrivelsen henger på som et tips.
 * Pillen er derfor et tipsanker og får et tabulatorstopp, slik `Tips` gir all
 * annen tekst med forklaring bak seg: forklaringen skal kunne hentes fram med
 * tastaturet og ikke bare med pekeren.
 */
export function Metodepille({ metode, kategori }: MetodepilleProps) {
  const tips = useTips(metodebeskrivelse(metode))

  return (
    <>
      <Pill tone="metode" style={metodefarger(metode)} tabIndex={0} {...tips.props}>
        <span className="metodepille__kode">{metode}</span>
        {kategori && (
          <>
            <span className="metodepille__skille" aria-hidden="true">
              ›
            </span>
            <span className="metodepille__kategori">{kategori}</span>
          </>
        )}
      </Pill>
      {tips.forklaring}
    </>
  )
}
