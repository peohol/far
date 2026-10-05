import { useMemo } from 'react'
import { Bevaringsomrade, useBevart } from '../../oppdatering/Bevaring'
import { THC_TEKSTBOLKER, THC_TEKSTNOKLER } from '../../domain/thcTekster'
import type { ThcModell } from '../../domain/thcMotor'
import { bruksmonsterbeskrivelse, marginmerke, nivaomrader, somProsent } from '../../domain/thcVisning'
import { revisjonsnokkel } from '../../faginnhold/lesing'
import { upublisert } from '../../faginnhold/stoffside'
import { antall, ramsOpp } from '../../faginnhold/oppsummering'
import { thcUtkastFra, tilThcModell, type ThcRegelsettutgave } from '../../faginnhold/thcregler'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Panelhode } from '../Panelhode'
import { Uthev } from '../Uthev'
import { seksjonsikon } from '../stoffside/panelvisning'
import { Sistredigert } from '../historikk/Sistredigert'
import { Detaljkort, Seksjon } from '../seksjoner/Seksjon'
import { FORTOLKNING } from './Fortolkningsregler'
import { Thcredigering, type ThcredigeringProps } from './Thcredigering'
import { Thcsimulator } from './Thcsimulator'

/**
 * Fortolkningsreglene for THC-syre i urin (IRCAK) på redigeringssiden for fortolkningen
 * (`docs/thc-syre.md`): nivåene, marginene, måleusikkerheten og kurvene
 * konklusjonen avgjøres av, tekstbolkene kommentaren settes sammen av, og en
 * simulator som fortolker med akkurat disse reglene.
 *
 * I lesemodus er det de publiserte reglene, i redigeringsmodus utkastet. Et
 * regelsett som ikke består kontrollen, vises med feilene i stedet. I
 * redigeringsmodus kan administratorer endre reglene og tekstene
 * ({@link Thcredigering}), se hva som ikke er publisert og åpne historikken.
 *
 * Reglene er seksjonen `fortolkning` på siden, og tekstene og simulatoren
 * detaljkort i den (`docs/seksjoner.md`).
 */
export function Thcregler({
  utgave,
  redigerer,
  onLagre,
  seksjonsid = FORTOLKNING,
  tittel = 'Fortolkningsregler',
  apenFraStart,
}: {
  utgave: ThcRegelsettutgave
  redigerer: boolean
  onLagre?: ThcredigeringProps['onLagre']
  /** Egen seksjons-ID når THC-syrereglene deler redigeringsside med et annet regelsett. */
  seksjonsid?: string
  /** Egen tittel når det må fremgå at reglene gjelder THC-syre i urin. */
  tittel?: string
  /** Seksjonen står åpen når den vises. */
  apenFraStart?: boolean
}) {
  const modell = useMemo(() => tilThcModell(utgave), [utgave])
  const start = useMemo(() => thcUtkastFra(utgave), [utgave])
  // En redigering som er i gang, overlever en oppdatering av appen.
  const [redigeres, setRedigeres] = useBevart(`thcregler:${utgave.regelsett.id}`, false)
  const redigeringsmodus = redigeres && redigerer && start && onLagre
  const upubliserte = redigerer
    ? [
        ...(upublisert(utgave.regelsett) ? ['reglene'] : []),
        ...utgave.kommentarer.filter(upublisert).map((k) => `«${k.innhold.navn}»`),
      ]
    : []

  return (
    <Seksjon
      id={seksjonsid}
      ikon={seksjonsikon(FORTOLKNING)}
      tittel={<Uthev tekst={tittel} />}
      oppsummering={
        modell.ok
          ? ramsOpp([
              antall(modell.modell.regler.konsentrasjonsnivaer.length, 'nivå', 'nivåer'),
              `Standardmargin ${marginmerke(modell.modell.regler.standard_sikkerhetsmargin)}`,
            ])
          : 'Reglene er ikke gyldige'
      }
      apenFraStart={apenFraStart}
      handlinger={
        redigerer &&
        start &&
        onLagre &&
        !redigeres && (
          <Button
            variant="kant"
            icon={<Ikon navn="edit" />}
            className="redigeringsknapp"
            onClick={() => setRedigeres(true)}
          >
            Rediger reglene
          </Button>
        )
      }
      className="regler"
    >
      {redigeringsmodus ? (
        // Utkastet tas vare på mot revisjonene det bygger på, og kommer bare
        // tilbake så lenge ingen andre har lagret i mellomtiden.
        <Bevaringsomrade navn={`thcregler:${utgave.regelsett.id}@${revisjonsnokkel(utgave)}`}>
          <Thcredigering
            key={revisjonsnokkel(utgave)}
            utgave={utgave}
            start={start}
            onLagre={async (regler, tekster) => {
              await onLagre(regler, tekster)
              setRedigeres(false)
            }}
            onAvbryt={() => setRedigeres(false)}
          />
        </Bevaringsomrade>
      ) : modell.ok ? (
        <Reglene modell={modell.modell} />
      ) : (
        <>
          <Panelhode ikon="fallback" tone="toksisk">
            Reglene er ikke gyldige
          </Panelhode>
          <ul className="mangelliste">
            {modell.feil.map((feil) => (
              <li key={feil}>{feil}</li>
            ))}
          </ul>
        </>
      )}
      {redigerer && (
        <div className="redigeringsrad regler__historikk">
          <Sistredigert utgave={utgave.regelsett} type="thc_regelsett" navn="THC-syrereglene" />
          {upubliserte.length > 0 && <p className="sistredigert">Ikke publisert: {upubliserte.join(', ')}.</p>}
        </div>
      )}
      {redigerer && (
        <Detaljkort
          id="kommentarhistorikk"
          tittel="Historikken for hver tekst"
          oppsummering={antall(utgave.kommentarer.length, 'tekst', 'tekster')}
        >
          <ul className="regler__kommentarhistorikk">
            {utgave.kommentarer.map((k) => (
              <li key={k.id}>
                <span className="sistredigert">{k.innhold.navn}: </span>
                <Sistredigert utgave={k} type="kommentar" navn={`Teksten «${k.innhold.navn}»`} />
              </li>
            ))}
          </ul>
        </Detaljkort>
      )}
    </Seksjon>
  )
}

function Reglene({ modell }: { modell: ThcModell }) {
  const { regler, tekster } = modell
  const { maleusikkerhet } = regler

  return (
    <>
      <p className="regler__ingress">
        <Uthev
          tekst={
            'Slik kommenterer fortolkningen THC-syre i urin. Konsentrasjonen i prøven gir nivået i åpningen. ' +
            'Endringen fra forrige prøve korrigeres for måleusikkerhet og sammenlignes med tre ' +
            'utskillelseskurver; hvilke kurver den ligger over, avgjør konklusjonen.'
          }
        />
      </p>

      <dl className="regler__grenser">
        {nivaomrader(regler).map(({ navn, omrade }) => (
          <Grense key={navn} navn={`Nivå «${navn}»`} verdi={omrade} />
        ))}
      </dl>
      <dl className="regler__grenser">
        <Grense
          navn="Sikkerhetsmarginer"
          verdi={regler.sikkerhetsmarginer.map((m) => marginmerke(m.margin)).join(' · ')}
        />
        <Grense navn="Standard" verdi={marginmerke(regler.standard_sikkerhetsmargin)} />
        <Grense navn="Måleusikkerhet THC-syre" verdi={`${somProsent(maleusikkerhet.cv_thc)} %`} />
        <Grense navn="Kreatinin" verdi={`${somProsent(maleusikkerhet.cv_kreatinin)} %`} />
        <Grense navn="Under cut-off" verdi={`${somProsent(maleusikkerhet.faktor_under_cutoff - 1)} % høyere`} />
        <Grense navn="Varsel ved mer enn" verdi={antall(regler.varsel_dager_mellom, 'dag', 'dager')} />
      </dl>
      <dl className="regler__monstre">
        <div>
          <dt>Kronisk bruk</dt>
          <dd>{bruksmonsterbeskrivelse(regler, true)}</dd>
        </div>
        <div>
          <dt>Enkeltinntak</dt>
          <dd>{bruksmonsterbeskrivelse(regler, false)}</dd>
        </div>
      </dl>

      <Detaljkort id="tekster" tittel="Tekstbolkene" oppsummering={antall(THC_TEKSTNOKLER.length, 'bolk', 'bolker')}>
        <ol className="regeltekster">
          {THC_TEKSTNOKLER.map((nokkel) => (
            <li key={nokkel} className="regeltekst">
              <p className="regeltekst__nummer">{THC_TEKSTBOLKER[nokkel].tittel}</p>
              <p className="regler__ingress">
                <Uthev tekst={THC_TEKSTBOLKER[nokkel].brukes} />
              </p>
              <p className="kommentartekst">
                <Uthev tekst={tekster[nokkel]} />
              </p>
            </li>
          ))}
        </ol>
      </Detaljkort>

      <Thcsimulator modell={modell} />
    </>
  )
}

function Grense({ navn, verdi }: { navn: string; verdi: string }) {
  return (
    <div className="regler__grense">
      <dt>
        <Uthev tekst={navn} />
      </dt>
      <dd>{verdi}</dd>
    </div>
  )
}
