import { useCallback, useMemo, useState } from 'react'
import type { Rute } from '../../domain/rute'
import { useHenting } from '../../hooks/useHenting'
import { versjonslinje } from '../../kuratering/modell'
import { Bevaringsomrade, useBevart } from '../../oppdatering/Bevaring'
import { Button } from '../Button'
import { Lukkeknapp } from '../Lukkeknapp'
import { ToppmenyInnhold } from '../toppmeny/Toppmenykilde'
import { Bekreftknapp } from '../traad/Smadeler'
import { useFaginnholdskilde } from '../stoffside/Faginnholdskilde'
import type { StoffsideProps } from '../stoffside/Stoffside'
import { Sidesammenligning, Utgavevisning } from './Utgavevisning'

export type Utgavesideprops = Pick<StoffsideProps, 'register' | 'katalog' | 'onApneFortolkning'> & {
  /** Går til en annen side i appen. */
  onGaaTil: (rute: Rute) => void
}

/**
 * En tidligere versjon av en fagside (`#/versjon/<stoff>/<nr>`), slik den var
 * publisert, for alle innloggede. Den kan sammenlignes med den gjeldende, og
 * en administrator kan ta den tilbake: det blir en gjenopprettingsgren som
 * forhåndsvises før den publiseres som en ny versjon.
 */
export function Versjonsside({ stoff, nr, ...props }: Utgavesideprops & { stoff: string; nr: number }) {
  return (
    <Bevaringsomrade navn={`versjon:${stoff}:${nr}`}>
      <Versjonsinnhold stoff={stoff} nr={nr} {...props} />
    </Bevaringsomrade>
  )
}

function Versjonsinnhold({ stoff, nr, onGaaTil, ...props }: Utgavesideprops & { stoff: string; nr: number }) {
  const { kuratering, kanRedigere } = useFaginnholdskilde()
  const hent = useCallback(async () => {
    if (!kuratering) throw new Error('Versjonene er ikke tilgjengelige her.')
    const [versjon, versjoner] = await Promise.all([kuratering.versjon(stoff, nr), kuratering.versjoner(stoff)])
    const siste = versjoner[0]
    const gjeldende = siste && siste.nr !== nr ? await kuratering.versjon(stoff, siste.nr) : versjon
    return { versjon, versjoner, gjeldende }
  }, [kuratering, stoff, nr])
  const { tilstand } = useHenting(hent)
  const [sammenligner, setSammenligner] = useBevart('sammenligner', false)
  const [feil, setFeil] = useState<string | null>(null)
  const tilSiden = useCallback(() => onGaaTil({ side: 'stoff', stoff }), [onGaaTil, stoff])

  const gjenopprett = useCallback(async () => {
    if (!kuratering) return
    setFeil(null)
    try {
      const gren = await kuratering.gjenopprettVersjon(stoff, nr)
      onGaaTil({ side: 'kuratering', gren: gren.id })
    } catch (e) {
      setFeil(e instanceof Error ? e.message : String(e))
    }
  }, [kuratering, stoff, nr, onGaaTil])

  const data = tilstand.status === 'klar' ? tilstand.data : null
  const nabo = useMemo(() => {
    const liste = data?.versjoner ?? []
    const i = liste.findIndex((v) => v.nr === nr)
    return { nyere: i > 0 ? liste[i - 1] : undefined, eldre: i >= 0 ? liste[i + 1] : undefined }
  }, [data, nr])

  if (!data?.versjon) {
    return (
      <section className="stoffside" aria-label="Versjon av fagsiden">
        <ToppmenyInnhold spor="lukk">
          <Lukkeknapp onLukk={tilSiden} />
        </ToppmenyInnhold>
        <div className="utgavebanner" role="status">
          <p className="utgavebanner__tittel">
            {tilstand.status === 'laster'
              ? 'Henter versjonen …'
              : tilstand.status === 'feil'
                ? `Fikk ikke hentet versjonen. ${tilstand.melding}`
                : `Fagsiden har ingen versjon ${nr}.`}
          </p>
        </div>
      </section>
    )
  }

  const { versjon, gjeldende } = data
  const erGjeldende = data.versjoner[0]?.nr === nr
  const navn = versjon.utgave.side.stoff?.navn ?? stoff
  const banner = (
    <div className="utgavebanner" role="status">
      <p className="utgavebanner__tittel">
        Versjon {nr} av fagsiden{erGjeldende ? ', den gjeldende' : ''}
      </p>
      <p className="utgavebanner__linje">{versjonslinje(versjon.versjon)}</p>
      {versjon.versjon.endring?.oppsummering && <p className="utgavebanner__linje">{versjon.versjon.endring.oppsummering}</p>}
      {!erGjeldende && (
        <p className="utgavebanner__linje">
          Slik siden var publisert da. Data fra FEST, ClinPGx, CPIC, PubChem og Farmakologiportalen vises som nå.
        </p>
      )}
      <div className="utgavebanner__handlinger">
        <Button variant="kant" onClick={tilSiden}>
          Til fagsiden
        </Button>
        {!erGjeldende && (
          <Button variant="kant" onClick={() => setSammenligner(true)}>
            Sammenlign med den gjeldende
          </Button>
        )}
        {nabo.eldre && (
          <Button variant="kant" onClick={() => onGaaTil({ side: 'versjon', stoff, nr: nabo.eldre!.nr })}>
            Eldre versjon
          </Button>
        )}
        {nabo.nyere && (
          <Button variant="kant" onClick={() => onGaaTil({ side: 'versjon', stoff, nr: nabo.nyere!.nr })}>
            Nyere versjon
          </Button>
        )}
        {kanRedigere && !erGjeldende && (
          <Bekreftknapp
            ikon="reset"
            tekst="Ta tilbake denne versjonen"
            bekreftTekst="Bekreft"
            bekreftEtikett={`Bekreft at versjon ${nr} tas tilbake`}
            onBekreft={() => void gjenopprett()}
          />
        )}
      </div>
      {kanRedigere && !erGjeldende && (
        <p className="utgavebanner__linje">
          Å ta tilbake en versjon publiserer ingenting ennå: du ser først hele siden og forskjellene, og publiserer etterpå.
        </p>
      )}
      {feil && (
        <p className="utgavebanner__feil" role="alert">
          {feil}
        </p>
      )}
    </div>
  )

  return (
    <>
      <Utgavevisning
        key={`${stoff}:${nr}`}
        stoff={stoff}
        utgave={versjon.utgave}
        navn={`versjon:${stoff}:${nr}`}
        banner={banner}
        onLukk={tilSiden}
        {...props}
      />
      <Sidesammenligning
        apen={sammenligner}
        tittel={`${navn}: versjon ${nr} mot den gjeldende`}
        for_={versjon.utgave}
        etter={gjeldende?.utgave ?? null}
        onLukk={() => setSammenligner(false)}
      />
    </>
  )
}
