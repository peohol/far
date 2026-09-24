import { useCallback, useRef, useState } from 'react'
import { oppsummerForm, type Preparatvisning } from '../../legemiddeldata/preparatmodell'
import { preparatkort, preparatsted } from '../../legemiddeldata/stoffside'
import { elementAnker } from '../analyttside/Paneler'
import { Ikon } from '../ikon/Ikon'
import { Detaljkort } from '../seksjoner/Seksjon'
import { Uthev } from '../Uthev'
import { formikonnavn } from './Merker'
import { Preparatmodal } from './Preparatmodal'
import { Styrkerutenett, type Preparatvalg } from './Styrkerutenett'

/**
 * Preparatene i seksjonen «Preparater»: legemiddelform → styrke → preparat →
 * preparatvindu (`docs/ux-reimagination.md`, del 9).
 *
 * Hver legemiddelform er et detaljkort som vises som en stor overskrift med
 * formens ikon (Atlas: `FormHeader`), så søket, direktelenker og regelen om
 * én åpen skuff per nivå gjelder som ellers. Inne i formen står styrkene som
 * kort, og et preparatnavn åpner preparatvinduet.
 */
export function Legemiddelformer({ visning, sidenavn }: { visning: Preparatvisning; sidenavn: string }) {
  const [valgt, setValgt] = useState<Preparatvalg | null>(null)
  // Fokuset går tilbake til preparatnavnet vinduet ble åpnet fra.
  const tilbake = useRef<HTMLElement | null>(null)
  const velg = useCallback((valg: Preparatvalg) => {
    tilbake.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setValgt(valg)
  }, [])
  const lukk = useCallback(() => {
    setValgt(null)
    tilbake.current?.focus()
  }, [])
  const preparat = valgt && visning.preparater.get(valgt.preparat)
  // Med bare én form er det ingenting å velge mellom.
  const apenFraStart = visning.former.length === 1

  return (
    <>
      <ul className="preparatformer">
        {visning.former.map((f) => (
          <li key={f.id}>
            <Detaljkort
              id={preparatkort(f.id)}
              className="preparatform"
              apenFraStart={apenFraStart}
              tittel={
                <>
                  <Ikon navn={formikonnavn(f.ikon)} className="preparatform__ikon" />
                  <Uthev tekst={f.form} />
                </>
              }
              oppsummering={oppsummerForm(f)}
            >
              <Styrkerutenett form={f} anker={elementAnker(preparatsted(f.id))} valgt={valgt} onVelg={velg} />
            </Detaljkort>
          </li>
        ))}
      </ul>
      {preparat && valgt && <Preparatmodal preparat={preparat} fraStyrke={valgt.styrke} sidenavn={sidenavn} onLukk={lukk} />}
    </>
  )
}
