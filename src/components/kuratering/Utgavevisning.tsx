import { useMemo, type ReactNode } from 'react'
import type { Sideutgavedata } from '../../kuratering/klient'
import { antallForskjeller, sammenlignSider } from '../../faginnhold/sidesammenligning'
import { Endringsliste } from '../historikk/Historikkvindu'
import { Modallag } from '../Modallag'
import { FaginnholdskildeProvider, useFaginnholdskilde, type Faginnholdskilde } from '../stoffside/Faginnholdskilde'
import { Stoffside, type StoffsideProps } from '../stoffside/Stoffside'
import '../../styles/kuratering.css'

/**
 * En utgave av en fagside som ikke er den gjeldende — en tidligere versjon
 * eller forhåndsvisningen av en kurateringsgren — vist som fagsiden selv, bare
 * til lesing. Siden og bivirkningene er utgavens; de automatiske dataene (FEST,
 * ClinPGx, CPIC, PubChem, Farmakologiportalen) er de samme som på siden nå.
 */
export function Utgavevisning({
  utgave,
  navn,
  banner,
  ...props
}: Omit<StoffsideProps, 'utgave' | 'sted'> & { utgave: Sideutgavedata; navn: string; banner: ReactNode }) {
  const kilde = useFaginnholdskilde()
  const egen = useMemo<Faginnholdskilde>(
    () => ({
      ...kilde,
      kanRedigere: false,
      leser: { ...kilde.leser, lesStoffside: async () => utgave.side },
      bivirkninger: { les: async () => utgave.bivirkninger },
    }),
    [kilde, utgave],
  )
  return (
    <FaginnholdskildeProvider kilde={egen}>
      <Stoffside {...props} utgave={{ navn, banner }} />
    </FaginnholdskildeProvider>
  )
}

/** Forskjellene mellom to utgaver av siden, felt for felt, i et eget lag. */
export function Sidesammenligning({
  apen,
  tittel,
  for_,
  etter,
  onLukk,
}: {
  apen: boolean
  tittel: string
  for_: Sideutgavedata | null
  etter: Sideutgavedata | null
  onLukk: () => void
}) {
  const endringer = useMemo(() => (for_ && etter ? sammenlignSider(for_, etter) : null), [for_, etter])
  return (
    <Modallag apen={apen} tittel={tittel} ikon="history" bred onLukk={onLukk}>
      {endringer ? (
        <>
          {antallForskjeller(endringer) > 0 && (
            <p className="utgaveliste__meta">{antallForskjeller(endringer)} felt er endret, lagt til eller fjernet.</p>
          )}
          <Endringsliste endringer={endringer} forste={false} />
        </>
      ) : (
        <p className="utgaveliste__tomt">Henter …</p>
      )}
    </Modallag>
  )
}
