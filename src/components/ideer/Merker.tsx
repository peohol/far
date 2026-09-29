import { KATEGORINAVN, OPPGAVESTATUSNAVN, oppgavekode, type Idekategori, type Oppgavestatus } from '../../ideer/modell'

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
 * Statusen til en planlagt oppgave: et nøytralt merke med en farget prikk —
 * rød før arbeidet er begynt, gul når det er påbegynt, grønn når den er klar
 * til implementering og blå mens en agent håndterer den. Teksten sier alltid
 * det samme som fargen.
 */
export function Oppgavestatusmerke({ status }: { status: Oppgavestatus }) {
  return (
    <span className="statusmerke" data-status={status}>
      {OPPGAVESTATUSNAVN[status]}
    </span>
  )
}

/** Nummeret oppgaven omtales med, som «OPG-007». */
export function Oppgavekode({ nummer }: { nummer: number }) {
  return <span className="oppgavekode">{oppgavekode(nummer)}</span>
}
