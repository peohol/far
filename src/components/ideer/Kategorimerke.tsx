import { KATEGORINAVN, type Idekategori } from '../../ideer/modell'

/**
 * Kategorien som merke, i samme toner som typemerkene i endringsloggen: fag
 * og funksjonalitet har hver sin farge, «annet» er nøytralt med kantlinje.
 */
const TONE: Record<Idekategori, string> = {
  fag: 'fag',
  funksjonalitet: 'funksjon',
  annet: 'omfang',
}

export function Kategorimerke({ kategori }: { kategori: Idekategori }) {
  return <span className={`loggmerke loggmerke--${TONE[kategori]}`}>{KATEGORINAVN[kategori]}</span>
}
