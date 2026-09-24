import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { useFlytting } from '../../hooks/useFlytting'
import { rullefart } from '../../hooks/useKortHopp'
import { oppsummerStyrke, type Formgruppe, type Styrkegruppe } from '../../legemiddeldata/preparatmodell'
import { Ikon } from '../ikon/Ikon'
import type { Ikonnavn } from '../ikon/register'
import { VIS_HENDELSE } from '../seksjoner/Seksjonsstyring'
import { Uthev } from '../Uthev'
import { formikonnavn, Preparatmerker } from './Merker'

/** Teksten på et styrkekort uten styrke i FEST. */
const UTEN_STYRKE = 'Uten oppgitt styrke'

export interface Preparatvalg {
  preparat: string
  /** Styrken preparatet ble åpnet fra. */
  styrke: string
}

/**
 * Styrkene i én legemiddelform som et rutenett av like store kort (Atlas:
 * `StrengthGrid` og `StrengthCard`). Ett kort per styrke, uansett hvor mange
 * preparater som har den. Bare ett kort står åpent: det fyller bredden og
 * lister preparatnavnene alfabetisk, og et navn åpner preparatvinduet.
 *
 * Preparatnavnene i et lukket kort står i dokumentet, skjult med
 * `hidden="until-found"`, så søket på siden og nettleserens eget søk finner
 * dem og åpner kortet (se `VIS_HENDELSE`).
 */
export function Styrkerutenett({
  form,
  anker,
  valgt,
  onVelg,
}: {
  form: Formgruppe
  /** ID-en søket peker på. */
  anker: string
  /** Preparatet som står i preparatvinduet. */
  valgt: Preparatvalg | null
  onVelg: (valg: Preparatvalg) => void
}) {
  // En form med én styrke har ingenting å velge mellom.
  const [apen, setApen] = useState<string | null>(form.styrker.length === 1 ? form.styrker[0]!.id : null)
  const ikon = formikonnavn(form.ikon)
  const rutenett = useRef<HTMLUListElement>(null)
  // Kortet brukeren åpnet, rulles fram når det har vokst ferdig.
  const rullTil = useRef(false)
  const husk = useFlytting(rutenett, {
    etter: () => {
      if (!rullTil.current) return
      rullTil.current = false
      rutenett.current
        ?.querySelector(':scope > [data-apen]')
        ?.scrollIntoView({ behavior: rullefart(), block: 'nearest' })
    },
  })
  // Et trykk flytter kortene synlig; søket som åpner et kort, gjør det straks.
  const veksle = useCallback(
    (id: string, apnes: boolean) => {
      husk()
      rullTil.current = apnes
      setApen(apnes ? id : null)
    },
    [husk],
  )

  return (
    <ul
      ref={rutenett}
      className="styrkerutenett"
      id={anker}
      aria-label={`Styrker, ${form.form.toLocaleLowerCase('nb')}`}
    >
      {form.styrker.map((s) => (
        <Styrkekort
          key={s.id}
          styrke={s}
          form={form.form}
          ikon={ikon}
          apen={apen === s.id}
          settApen={setApen}
          veksle={veksle}
          valgt={valgt?.styrke === s.id ? valgt.preparat : null}
          onVelg={(preparat) => onVelg({ preparat, styrke: s.id })}
        />
      ))}
    </ul>
  )
}

function Styrkekort({
  styrke,
  form,
  ikon,
  apen,
  settApen,
  veksle,
  valgt,
  onVelg,
}: {
  styrke: Styrkegruppe
  form: string
  ikon: Ikonnavn
  apen: boolean
  /** Hvilket kort i rutenettet som står åpent, straks; `null` lukker. */
  settApen: (id: string | null) => void
  /** Åpner eller lukker kortet med flytting, som et trykk gjør. */
  veksle: (id: string, apnes: boolean) => void
  valgt: string | null
  onVelg: (preparat: string) => void
}) {
  const id = useId()
  const innhold = useRef<HTMLDivElement>(null)
  const tekst = styrke.styrke || UTEN_STYRKE
  const antall = oppsummerStyrke(styrke)

  // Søket eller nettleseren fant noe i det lukkede kortet: åpne det, og la
  // dem rulle til treffet selv.
  const vis = useCallback(() => settApen(styrke.id), [settApen, styrke.id])
  useSkjultTilFunnet(innhold, apen, vis)

  return (
    <li
      className={['styrkekort', styrke.kombinasjon && 'styrkekort--lang'].filter(Boolean).join(' ')}
      data-apen={apen || undefined}
    >
      <button
        type="button"
        className="styrkekort__knapp"
        data-ih=""
        aria-expanded={apen}
        aria-controls={`${id}-innhold`}
        aria-describedby={`${id}-antall`}
        title={styrke.kombinasjon ? tekst : undefined}
        onClick={() => veksle(styrke.id, !apen)}
      >
        <Ikon navn={ikon} className="styrkekort__ikon" />
        <span className="styrkekort__tekst">
          <span className="styrkekort__styrke">
            <Uthev tekst={tekst} />
          </span>
          {styrke.presisering && (
            <span className="styrkekort__presisering">
              <Uthev tekst={styrke.presisering} />
            </span>
          )}
          {/* Antallet er beskrivelsen til knappen, ikke en del av navnet. */}
          <span id={`${id}-antall`} className="styrkekort__antall" aria-hidden="true">
            {apen ? `${form} · ${antall}` : antall}
          </span>
        </span>
        <span className="styrkekort__pil" aria-hidden="true">
          <Ikon navn="chev" />
        </span>
      </button>
      <div ref={innhold} id={`${id}-innhold`} className="styrkekort__innhold">
        <ul className="preparatrader" aria-label={`Preparater med ${tekst}`}>
          {styrke.preparater.map((p) => (
            <li key={p.preparat}>
              <button
                type="button"
                className="preparatrad"
                data-ih=""
                data-valgt={valgt === p.preparat || undefined}
                aria-haspopup="dialog"
                onClick={() => onVelg(p.preparat)}
              >
                <span className="preparatrad__navn">
                  <span className="preparatrad__tittel">
                    <Uthev tekst={p.navn} />
                  </span>
                  {p.produsenter.length > 0 && (
                    <span className="preparatrad__produsent">{p.produsenter.join(', ')}</span>
                  )}
                </span>
                {p.merker.length > 0 && (
                  <span className="preparatrad__merker">
                    <Preparatmerker merker={p.merker} />
                  </span>
                )}
                <span className="preparatrad__pil" aria-hidden="true">
                  <Ikon navn="chev" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}

/**
 * Skjuler innholdet i en lukket visning med `hidden="until-found"`, og åpner
 * visningen når nettleserens søk finner noe i den (`beforematch`) eller søket
 * på siden skal vise noe i den (`VIS_HENDELSE` fra `apneTil`).
 */
export function useSkjultTilFunnet(innhold: RefObject<HTMLElement>, apen: boolean, vis: () => void) {
  useLayoutEffect(() => {
    const el = innhold.current
    if (!el) return
    if (apen) el.removeAttribute('hidden')
    else el.setAttribute('hidden', 'until-found')
  }, [innhold, apen])

  useEffect(() => {
    const el = innhold.current
    if (!el) return
    // Nettleseren ruller til treffet straks etter hendelsen, så kortet må stå åpent før det.
    const funnet = () => flushSync(vis)
    el.addEventListener('beforematch', funnet)
    el.addEventListener(VIS_HENDELSE, vis)
    return () => {
      el.removeEventListener('beforematch', funnet)
      el.removeEventListener(VIS_HENDELSE, vis)
    }
  }, [innhold, vis])
}
