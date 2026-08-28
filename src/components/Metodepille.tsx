import { Pill } from './Pill'
import { metodefarger } from '../domain/analysemetoder'

export interface MetodepilleProps {
  /** Koden til analysemetoden, f.eks. «SPFA». */
  metode: string
  /** Kategorien innenfor metoden. Utelates når metoden ikke er delt opp. */
  kategori?: string
}

/**
 * Analysemetoden en analytt rekvireres under, som én pille: «SPFA ›
 * Antipsykotika».
 *
 * Metoden og kategorien hører sammen — kategorien betyr ingenting uten
 * metoden den ligger i — så de deler pille i stedet for å stå som to.
 * Pillen bærer metodens egen farge, den samme som skuffen i sidemenyen og
 * menyknappen når filteret står på metoden, slik at fargen alene sier hvilken
 * analyse dette er.
 *
 * Koden står alene, uten forklaring bak seg: de som kommenterer analysene
 * kjenner kodene sine, og en boble som gjentar dem ville bare vært i veien.
 * Hva koden betyr, står i sidemenyen for den som trenger det.
 */
export function Metodepille({ metode, kategori }: MetodepilleProps) {
  return (
    <Pill tone="metode" style={metodefarger(metode)}>
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
  )
}
