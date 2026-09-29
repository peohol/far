import { useRedigering } from '../stoffside/Redigeringskontekst'

/**
 * Teksten om en automatisk kilde, med merknaden om at den ikke kan redigeres
 * når siden står i redigering. I lesemodus er det ingenting å redigere, og
 * merknaden ville bare vært støy.
 */
export function useLaastMerknad(): (tekst: string) => string {
  const { redigerer } = useRedigering()
  return (tekst) => (redigerer ? `${tekst} · kan ikke redigeres` : tekst)
}
