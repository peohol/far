import type { MouseEvent } from 'react'
import { Metodepille } from './Metodepille'
import { Pill } from './Pill'
import { Shortcut } from './Shortcut'
import { useTips } from './Tips'
import { ANALYSEMETODER, AV_SNARVEI, metodesnarvei } from '../domain/analysemetoder'

/**
 * Filteret for søket: én rad med alle analysemetodene som piller, og «Alle»
 * lengst til venstre.
 *
 * Dette er stedet filteret settes, på hovedsiden der det virker — ellers bare
 * med Alt + tall. Sidemenyen er stoffregisteret og filtrerer ikke søket.
 *
 * Raden står alltid framme, så det aktive filteret kan leses av uten å åpne
 * noe: pillen som gjelder har metodens fargefyll, de andre bare en kant i
 * sin farge. Et glemt filter ser ellers ut som at en analytt ikke finnes.
 *
 * Et klikk tar ikke fokus fra søkefeltet, så man kan skrive videre med én
 * gang. Med tastaturet nås pillene med Tab som vanlige knapper.
 */

export interface FilterbytteProps {
  /** Metoden filteret står på. `null` når søket ikke er begrenset. */
  metodefilter: string | null
  /** `null` slår filteret av. */
  onFilter: (metode: string | null) => void
}

/** Ett valg i raden. `kode` er `null` for «Alle». */
interface Filtervalg {
  kode: string | null
  beskrivelse: string
  snarvei: string | null
}

/** «Alle» først, så metodene i den rekkefølgen registeret har dem. */
const VALG: Filtervalg[] = [
  { kode: null, beskrivelse: 'Søk i alle analysemetodene', snarvei: AV_SNARVEI },
  ...ANALYSEMETODER.map((m) => ({
    kode: m.kode,
    beskrivelse: m.beskrivelse,
    snarvei: metodesnarvei(m.kode),
  })),
]

export function Filterbytte({ metodefilter, onFilter }: FilterbytteProps) {
  return (
    <div className="sokfilter" role="group" aria-label="Begrens søket til analysemetode">
      {VALG.map((valg) => (
        <Filterpille
          key={valg.kode ?? ''}
          valg={valg}
          aktiv={valg.kode === metodefilter}
          onVelg={onFilter}
        />
      ))}
    </div>
  )
}

function Filterpille({
  valg,
  aktiv,
  onVelg,
}: {
  valg: Filtervalg
  aktiv: boolean
  onVelg: (metode: string | null) => void
}) {
  const { kode, beskrivelse, snarvei } = valg
  const tips = useTips(
    <>
      {beskrivelse}
      {snarvei && <Shortcut>{snarvei}</Shortcut>}
    </>,
    { skjermleser: false },
  )

  return (
    <button
      type="button"
      className="sokfilter__valg"
      aria-pressed={aktiv}
      aria-label={kode ? `${kode} – ${beskrivelse}` : 'Alle analysemetoder'}
      {...(snarvei && { 'aria-keyshortcuts': snarvei.replace(/ /g, '') })}
      // Fokus blir der det var, typisk i søkefeltet.
      onMouseDown={(event: MouseEvent) => event.preventDefault()}
      onClick={() => onVelg(kode)}
      {...tips.props}
    >
      {kode ? (
        <Metodepille metode={kode} />
      ) : (
        <Pill tone="metode" className="metodepille--alle">
          Alle
        </Pill>
      )}
    </button>
  )
}
