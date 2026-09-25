import { createContext, useContext, useRef, type HTMLAttributes } from 'react'
import { useFlytting } from '../../hooks/useFlytting'
import { useSeksjonsstyring } from './Seksjonsstyring'

/**
 * Detaljkort i et rutenett (`.skuffrutenett`, se `seksjoner.css`): de lukkede
 * kortene står side om side, og et åpnet kort tar hele bredden.
 *
 * Designregelen i appen er at kort i et rutenett åpnes, lukkes og flyttes
 * synlig: når brukeren åpner eller lukker et kort, vokser eller krymper det
 * dit det skal stå, og naboene glir til sine nye plasser (`useFlytting`), så
 * øyet kan følge hva som gikk hvor. Styrkene i «Preparater» følger den samme
 * regelen med sin egen visning (`Styrkerutenett`).
 *
 * Kortene får vite om rutenettet gjennom konteksten: et detaljkort i det tar
 * et opptak før det åpnes eller lukkes, og lar flyttingen stå for bevegelsen i
 * stedet for sin egen glidning. Søket og direktelenker åpner straks, som
 * ellers, og ved `prefers-reduced-motion` flytter ingenting seg.
 */
export function Skuffrutenett({ className, children, ...resten }: HTMLAttributes<HTMLUListElement>) {
  const liste = useRef<HTMLUListElement>(null)
  const husk = useFlytting(liste)
  // Rutenettet tegnes på nytt når et kort åpnes eller lukkes, så flyttingen
  // spilles av etter tegningen der kortene fikk sine nye plasser.
  useSeksjonsstyring()
  return (
    <Flytting.Provider value={husk}>
      <ul ref={liste} className={['skuffrutenett', className].filter(Boolean).join(' ')} {...resten}>
        {children}
      </ul>
    </Flytting.Provider>
  )
}

const Flytting = createContext<(() => void) | null>(null)

/**
 * Opptaket rutenettet kortet står i, tar før en endring, eller `null` utenfor
 * et rutenett.
 */
export function useRutenettflytting(): (() => void) | null {
  return useContext(Flytting)
}
