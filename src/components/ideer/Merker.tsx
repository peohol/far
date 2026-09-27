import { KATEGORINAVN, STATUSNAVN, type Idekategori, type Idestatus } from '../../ideer/modell'

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

/**
 * Statusen en administrator har gitt idéen: et nøytralt merke med en farget
 * prikk, så det ikke kan forveksles med kategorien eller en klinisk farge.
 */
export function Statusmerke({ status }: { status: Idestatus }) {
  return (
    <span className="statusmerke" data-status={status}>
      {STATUSNAVN[status]}
    </span>
  )
}
