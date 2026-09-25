import { useCallback, useMemo, useState } from 'react'
import type { Regelsettutgave } from '../../faginnhold/lesing'
import { antall, ramsOpp } from '../../faginnhold/oppsummering'
import { losRegelsett } from '../../regler/kommentarer'
import type { Intervallregelsett, Intervallregelsettinnhold } from '../../regler/modell'
import { regelsettfelter, tekstene, visRingegrense } from '../../regler/visning'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { seksjonsikon } from '../analyttside/panelvisning'
import { Detaljkort, Seksjon, seksjonsanker } from '../seksjoner/Seksjon'
import { Uthev } from '../Uthev'
import { kommentarnavnoppslag, Regelhistorikk, upubliserteFelt } from './Regelhistorikk'
import { Regelredigering, type RegelredigeringProps } from './Regelredigering'
import { Regelsimulator, Regeltabell } from './Regeltabell'

/** Nøkkelen seksjonen har i adressen (`#/analytt/KODE/fortolkning`), som scenarioreglene. */
export const FORTOLKNING = 'fortolkning'

/** Ankeret seksjonen har på siden. */
export const FORTOLKNING_ANKER = seksjonsanker(FORTOLKNING)

/** Feltene oppsummeringene sammenligner, med tekstene regelsettet har slått opp. */
export function regelsettfelterMedTekst(regelsett: Intervallregelsett) {
  return regelsettfelter(regelsett, tekstene(regelsett))
}

/** Det en lukket seksjon sier om reglene: antall områder, ringegrensen og cut-off. */
export function regeloppsummering(regelsett: Intervallregelsettinnhold): string {
  const ringegrense = visRingegrense(regelsett)
  return ramsOpp([
    antall(regelsett.intervaller.length, 'område', 'områder'),
    ringegrense && `Ringegrense ${ringegrense}`,
    regelsett.cutoff && 'Cut-off',
  ])
}

/**
 * Fortolkningsreglene for koden, på informasjonssiden: seksjonen «Fortolkning»
 * med kommentaren hver konsentrasjon gir, og detaljkortet «Simulator» for å
 * prøve en verdi (se `docs/seksjoner.md`).
 *
 * Regelsettet er et eget objekt og ikke en del av informasjonssiden; det
 * vises her fordi det gjelder koden siden hører til. Kommentarene det peker
 * på, er egne objekter igjen. I redigeringsmodus kan administratorer endre
 * reglene og tekstene, se hva som ikke er publisert og åpne historikken — for
 * regelsettet og for hver kommentar.
 */
export function Fortolkningsregler({
  utgave,
  publisert,
  redigerer,
  onLagre,
  hentNyeste,
}: {
  utgave: Regelsettutgave | null
  /** Det publiserte regelsettet, til å si hva som ikke er publisert ennå. */
  publisert: Regelsettutgave | null
  redigerer: boolean
  onLagre: RegelredigeringProps['onLagre']
  hentNyeste: RegelredigeringProps['hentNyeste']
}) {
  const [redigeres, setRedigeres] = useState(false)
  const regelsett = useMemo(() => utgave && losRegelsett(utgave), [utgave])
  const publiserte = useMemo(() => publisert && losRegelsett(publisert), [publisert])
  const historikkfelter = useCallback(
    (innhold: Intervallregelsettinnhold) => regelsettfelter(innhold, kommentarnavnoppslag(utgave?.kommentarer ?? [])),
    [utgave],
  )
  if (!utgave || !regelsett) return null

  const redigeringsmodus = redigeres && redigerer

  return (
    <Seksjon
      id={FORTOLKNING}
      ikon={seksjonsikon(FORTOLKNING)}
      tittel={<Uthev tekst="Fortolkning" />}
      oppsummering={regeloppsummering(regelsett)}
      handlinger={
        redigerer &&
        !redigeres && (
          <Button variant="kant" icon={<Ikon navn="edit" />} className="redigeringsknapp" onClick={() => setRedigeres(true)}>
            Rediger reglene
          </Button>
        )
      }
      className="regler"
    >
      {redigeringsmodus ? (
        <Regelredigering
          key={[utgave.regelsett.revisjon, ...utgave.kommentarer.map((k) => k.revisjon)].join('-')}
          start={regelsett}
          onLagre={async (innhold, grunnlag) => {
            await onLagre(innhold, grunnlag)
            setRedigeres(false)
          }}
          hentNyeste={hentNyeste}
          onAvbryt={() => setRedigeres(false)}
        />
      ) : (
        <>
          <p className="regler__ingress">
            <Uthev tekst={`Kommentaren fortolkningen gir for ${regelsett.analyttkode}, etter målt konsentrasjon.`} />
          </p>
          <Regeltabell regelsett={regelsett} />
          <Detaljkort id="simulator" tittel={<Uthev tekst="Simulator" />} oppsummering="Prøv en konsentrasjon">
            <Regelsimulator regelsett={regelsett} />
          </Detaljkort>
        </>
      )}
      {redigerer && (
        <Regelhistorikk
          utgave={utgave.regelsett}
          type="intervallregelsett"
          felter={historikkfelter}
          upubliserte={upubliserteFelt(
            [utgave.regelsett, ...utgave.kommentarer],
            publiserte && regelsettfelterMedTekst(publiserte),
            regelsettfelterMedTekst(regelsett),
          )}
          kommentarer={utgave.kommentarer}
        />
      )}
    </Seksjon>
  )
}
