import { createContext, useCallback, useContext, useMemo, useRef, useState, type HTMLAttributes, type RefObject } from 'react'
import { useFlytting } from '../../hooks/useFlytting'
import { rullFramNarApnet, useSeksjonsstyring } from './Seksjonsstyring'

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

/** Hvilket kort som står åpent i et rutenett som styrer seg selv, og det som åpner og lukker dem (se `useKortvalg`). */
export interface Kortvalg {
  /** Kortet som står åpent, eller `null` når alle er lukket. */
  apen: string | null
  /**
   * Et trykk på kortet `kort`: åpner det, så kortene flytter seg synlig og
   * siden ruller det fram, eller lukker det.
   */
  veksle: (id: string, apnes: boolean, kort: Element) => void
  /** Søket eller nettleseren skal vise noe i kortet: åpner det straks. */
  vis: (id: string) => void
}

/**
 * Kortene i et rutenett som styrer seg selv i stedet for å stå i styringen
 * for siden: underkortene (`Underkortrutenett`) og styrkene i «Preparater»
 * (`Styrkerutenett`). De åpnes og lukkes som detaljkortene i et
 * `Skuffrutenett`: bare ett står åpent, et trykk flytter kortene synlig
 * (`useFlytting`), og kortet brukeren åpner, rulles fram på samme måte som en
 * skuff (`rullFramNarApnet`). Søket og nettleseren som åpner et kort, gjør det
 * straks. Om et kort i det hele tatt kan åpnes, avgjør den som tegner det: et
 * kort uten mer å vise er fast.
 */
export function useKortvalg(liste: RefObject<HTMLElement>, apenFraStart: string | null = null): Kortvalg {
  const [apen, setApen] = useState<string | null>(apenFraStart)
  const husk = useFlytting(liste)
  const veksle = useCallback(
    (id: string, apnes: boolean, kort: Element) => {
      husk()
      if (apnes) rullFramNarApnet(kort)
      setApen(apnes ? id : null)
    },
    [husk],
  )
  return useMemo(() => ({ apen, veksle, vis: setApen }), [apen, veksle])
}
