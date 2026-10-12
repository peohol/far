import type { Ref } from 'react'
import { Button } from './Button'
import { Details } from './Details'
import { Tallfelt } from './Tallfelt'
import { ThcMarginforklaring } from './ThcMarginforklaring'
import { Trinnbryter } from './Trinnbryter'
import { Ikon } from './ikon/Ikon'
import {
  FORRIGE_PROVEFELT,
  forrigeProve,
  kortTidMellomProvene,
  tomThcProve,
  type ThcInndata,
  type ThcProve,
} from '../domain/thcMotor'
import type { ThcRegelsett } from '../domain/thcRegelsett'
import { beregnIrcak, dagerMellom, formaterIrcak } from '../domain/thcTall'
import { marginvalg } from '../domain/thcVisning'

/**
 * Banneret over sikkerhetsmarginen når forrige prøve fortolkes under
 * påvisningsgrensen. Ordlyden er eierens egen.
 */
const UNDER_CUTOFF_BANNER =
  'Fordi vi nå fortolker konsentrasjoner under påvisningsgrensen, legges større måleusikkerhet til grunn. ' +
  'Dette gjør fortolkningen mer forsiktig.'

export interface ThcSkjemaProps {
  inndata: ThcInndata
  onEndre: <K extends keyof ThcInndata>(felt: K, verdi: ThcInndata[K]) => void
  /** Reglene skjemaet fylles ut mot: sikkerhetsmarginene står der. */
  regler: ThcRegelsett
  /** Feltet som står først, og som får fokus når skjemaet åpnes eller nullstilles. */
  forsteFelt?: Ref<HTMLInputElement>
}

/**
 * Feltene i THC-syrefortolkningen: bruksmønsteret, forrige og denne prøven,
 * kort tid mellom dem, de tidligere prøvene i den samlede vurderingen og
 * sikkerhetsmarginen. Brukes både i fortolkningsmodulen og i simulatoren på
 * stoffsiden, så de spør på samme måte.
 */
export function ThcSkjema({ inndata, onEndre, regler, forsteFelt }: ThcSkjemaProps) {
  // Avkryssingen står inne i «Forrige prøve», så den gjelder bare når det
  // finnes en forrige prøve å fortolke.
  const underCutoff = !inndata.ingenTidligere && inndata.forrigeUnderCutoff
  const kortTid = kortTidMellomProvene(regler, inndata)
  const tidligere = inndata.tidligere ?? []
  // Den samlede vurderingen og de tidligere prøvene betyr ingenting når
  // prøvene ikke vurderes mot hverandre.
  const vurderes = !inndata.ingenTidligere && !(kortTid && inndata.kortTid)

  // Valgene på bryteren er regelsettets marginer, fra ingen margin til den
  // strengeste. Står skjemaet på en margin regelsettet ikke har, står bryteren
  // på ingen av dem, og fortolkningen sier fra.
  const marginer = regler.sikkerhetsmarginer.map(({ margin }) => ({
    verdi: margin,
    merke: marginvalg(margin),
  }))

  const endreForrige = <K extends keyof ThcProve>(felt: K, verdi: ThcProve[K]) =>
    onEndre(FORRIGE_PROVEFELT[felt], verdi as unknown as ThcInndata[(typeof FORRIGE_PROVEFELT)[K]])
  const settTidligere = (prover: ThcProve[]) => onEndre('tidligere', prover)

  return (
    <div className="thc-skjema">
      <div className="avkryssinger">
        <label className="avkryssing">
          <input
            type="checkbox"
            checked={inndata.kronisk}
            onChange={(e) => onEndre('kronisk', e.target.checked)}
          />
          Legg kronisk bruk til grunn
        </label>
        <label className="avkryssing">
          <input
            type="checkbox"
            checked={inndata.ingenTidligere}
            onChange={(e) => onEndre('ingenTidligere', e.target.checked)}
          />
          Ingen tidligere prøve tilgjengelig
        </label>
        {vurderes && (
          <label className="avkryssing">
            <input
              type="checkbox"
              checked={inndata.samletVurdering ?? false}
              onChange={(e) => {
                onEndre('samletVurdering', e.target.checked)
                // Den første tidligere prøven står klar når vurderingen slås på.
                if (e.target.checked && tidligere.length === 0) settTidligere([tomThcProve()])
              }}
            />
            Samlet vurdering med enda tidligere prøver
          </label>
        )}
      </div>

      <div className="thc-prover">
        {!inndata.ingenTidligere && (
          <Provefelter
            tittel="Forrige prøve"
            prove={forrigeProve(inndata)}
            onEndre={endreForrige}
            forsteFelt={forsteFelt}
          />
        )}

        <fieldset className="feltgruppe">
          <legend>Denne prøven</legend>
          <label className="skjemafelt">
            <span>IRCAK</span>
            <Tallfelt
              ref={inndata.ingenTidligere ? forsteFelt : undefined}
              value={inndata.aktuellVerdi}
              onChange={(verdi) => onEndre('aktuellVerdi', verdi)}
            />
          </label>
          {/* Uten en tidligere prøve å telle døgn mot brukes ikke datoen,
              og da skal den heller ikke fylles ut. */}
          {!inndata.ingenTidligere && (
            <label className="skjemafelt">
              <span>Prøvedato</span>
              <input
                className="inndatafelt"
                type="date"
                value={inndata.aktuellDato}
                onChange={(e) => onEndre('aktuellDato', e.target.value)}
              />
            </label>
          )}
        </fieldset>
      </div>

      {/* Prøvene ble tatt så tett at de kanskje ikke bør vurderes mot
          hverandre. Brukeren avgjør; avkryssingen er av til den hukes av. */}
      {kortTid && (
        <div className="notis notis--handling thc-korttid" role="note">
          <p>{kortTidtekst(inndata)}</p>
          <label className="avkryssing">
            <input
              type="checkbox"
              checked={inndata.kortTid ?? false}
              onChange={(e) => onEndre('kortTid', e.target.checked)}
            />
            Kort tid mellom prøvene
          </label>
        </div>
      )}

      {vurderes && inndata.samletVurdering && (
        <div className="thc-tidligere">
          <p className="thc-tidligere__ingress">
            Gir sammenligningen med forrige prøve «kan ikke fastslås», sammenlignes denne prøven også med
            prøvene under, fra den nærmeste og bakover.
          </p>
          <div className="thc-prover">
            {tidligere.map((prove, i) => (
              <Provefelter
                key={i}
                tittel={tidligere.length === 1 ? 'Tidligere prøve' : `Tidligere prøve ${i + 1}`}
                prove={prove}
                onEndre={(felt, verdi) =>
                  settTidligere(tidligere.map((p, j) => (j === i ? { ...p, [felt]: verdi } : p)))
                }
                onFjern={() => settTidligere(tidligere.filter((_, j) => j !== i))}
              />
            ))}
          </div>
          <div className="handlingsrad handlingsrad--start">
            <Button
              variant="kant"
              icon={<Ikon navn="plus" />}
              onClick={() => settTidligere([...tidligere, tomThcProve()])}
            >
              Legg til tidligere prøve
            </Button>
          </div>
        </div>
      )}

      {/* Sikkerhetsmarginen gjelder bare sammenligningen mot forrige
          prøve, så uten en slik prøve er den ikke noe å ta stilling
          til — samme grunn som datoene skjules av. */}
      {vurderes && (
        <div className="thc-margin">
          {underCutoff && (
            <p className="notis" role="note">
              {UNDER_CUTOFF_BANNER}
            </p>
          )}
          <p className="thc-margin__hode" aria-hidden="true">
            Sikkerhetsmargin
          </p>
          <Trinnbryter
            etikett="Sikkerhetsmargin"
            valg={marginer}
            verdi={inndata.sikkerhetsmargin}
            onVelg={(margin) => onEndre('sikkerhetsmargin', margin)}
          />
          <Details summary="Hva er sikkerhetsmarginen?" ikon="fallback">
            <ThcMarginforklaring regler={regler} />
          </Details>
        </div>
      )}
    </div>
  )
}

/** Banneret om kort tid: «Prøvene er tatt samme dag.» eller «Det er bare 2 dager mellom prøvene.» */
function kortTidtekst(inndata: ThcInndata): string {
  const dager = dagerMellom(inndata.forrigeDato, inndata.aktuellDato)
  const mellom = dager === 0 ? 'Prøvene er tatt samme dag.' : `Det er bare ${dager === 1 ? '1 dag' : `${dager} dager`} mellom prøvene.`
  return (
    `${mellom} Er det så kort tid at prøvene ikke kan vurderes mot hverandre, huk av for kort tid. ` +
    'Da sammenlignes de ikke, og kommentaren sier det.'
  )
}

/**
 * Feltene for én tidligere prøve: IRCAK, eller UCAK og NKRE når den lå under
 * cut-off, og prøvedatoen. Brukes for forrige prøve og for prøvene i den
 * samlede vurderingen.
 */
function Provefelter({
  tittel,
  prove,
  onEndre,
  onFjern,
  forsteFelt,
}: {
  tittel: string
  prove: ThcProve
  onEndre: <K extends keyof ThcProve>(felt: K, verdi: ThcProve[K]) => void
  onFjern?: () => void
  forsteFelt?: Ref<HTMLInputElement>
}) {
  const beregnetIrcak = prove.underCutoff ? beregnIrcak(prove.ucak, prove.nkre) : null
  return (
    <fieldset className="feltgruppe">
      <legend>{tittel}</legend>
      {/* Var urinen så fortynnet at THC-syre havnet under
          påvisningsgrensen, svarer labsystemet «ikke påvist» og
          regner ingen IRCAK. De to interne tallene tastes da i
          stedet, og IRCAK regnes ut av dem. */}
      <label className="avkryssing avkryssing--felt">
        <input
          type="checkbox"
          checked={prove.underCutoff}
          onChange={(e) => onEndre('underCutoff', e.target.checked)}
        />
        Under cut-off
      </label>
      {prove.underCutoff ? (
        <>
          <div className="feltrad feltrad--par">
            <label className="skjemafelt">
              <span>UCAK (THC-syre)</span>
              <Tallfelt ref={forsteFelt} value={prove.ucak} onChange={(verdi) => onEndre('ucak', verdi)} />
            </label>
            <label className="skjemafelt">
              <span>NKRE (kreatinin)</span>
              <Tallfelt value={prove.nkre} onChange={(verdi) => onEndre('nkre', verdi)} />
            </label>
          </div>
          <p className="thc-beregnet" role="status">
            Beregnet IRCAK: <strong>{beregnetIrcak === null ? '–' : formaterIrcak(beregnetIrcak)}</strong>
          </p>
        </>
      ) : (
        <label className="skjemafelt">
          <span>IRCAK</span>
          <Tallfelt ref={forsteFelt} value={prove.verdi} onChange={(verdi) => onEndre('verdi', verdi)} />
        </label>
      )}
      <label className="skjemafelt">
        <span>Prøvedato</span>
        <input
          className="inndatafelt"
          type="date"
          value={prove.dato}
          onChange={(e) => onEndre('dato', e.target.value)}
        />
      </label>
      {onFjern && (
        <div className="handlingsrad handlingsrad--start">
          <Button variant="subtle" icon={<Ikon navn="close" />} onClick={onFjern}>
            Fjern {tittel.toLowerCase()}
          </Button>
        </div>
      )}
    </fieldset>
  )
}
