import { createContext, useContext, useId, useMemo, type ReactNode } from 'react'
import {
  konsentrasjonIAlleEnheter,
  visKonsentrasjon,
  type Konsentrasjonsvisning,
  type Tekstkonsentrasjon,
  type Visningsenhet,
} from '../../enheter/konsentrasjon'
import { useMaleenhet } from '../../enheter/Maleenhet'
import { FORBINDELSER, type Forbindelse } from '../../kjemi/forbindelser'
import { molvekttekst } from '../../kjemi/stoffside'
import { useFestbarBoble } from '../../hooks/useFestbarBoble'
import { useBobleplassering } from '../Tips'
import { Uthev } from '../Uthev'
import '../../styles/konsentrasjon.css'

/**
 * Konsentrasjonene i fagtekstene: tallene kuratoren har merket, vist i
 * måleenheten brukeren har valgt (preferansen «Måleenhet»), med kilden og
 * alle enhetene i en boble ved tallet (`src/enheter/konsentrasjon.ts`).
 */

interface Konsentrasjonsdata {
  /** Molekylvektene fra PubChem, etter forbindelsens nøkkel, slik PubChem skriver dem. */
  molvekter: ReadonlyMap<string, string>
  /** Forbindelsene siden handler om, først i valget av forbindelse i editoren. */
  sideforbindelser: readonly Forbindelse[]
}

const Kontekst = createContext<Konsentrasjonsdata>({ molvekter: new Map(), sideforbindelser: [] })

/** Står rundt fagsiden. Uten den regnes tallene bare om innen masse eller stoffmengde. */
export function Konsentrasjonskilde({ children, ...data }: Konsentrasjonsdata & { children: ReactNode }) {
  const { molvekter, sideforbindelser } = data
  const verdi = useMemo(() => ({ molvekter, sideforbindelser }), [molvekter, sideforbindelser])
  return <Kontekst.Provider value={verdi}>{children}</Kontekst.Provider>
}

export function useKonsentrasjonskilde(): Konsentrasjonsdata {
  return useContext(Kontekst)
}

/** Konsentrasjonen fra nodens `attrs`, slik den er renset (`rensDokument`). */
export function lesKonsentrasjonsattrs(attrs: unknown): Tekstkonsentrasjon {
  const felt = (navn: string) => {
    const verdi = typeof attrs === 'object' && attrs !== null ? (attrs as Record<string, unknown>)[navn] : undefined
    return typeof verdi === 'string' ? verdi : ''
  }
  return { verdi: felt('verdi'), enhet: felt('enhet'), forbindelse: felt('forbindelse') || null }
}

/** Molekylvekten til forbindelsen, når den er kjent. */
function molvektFor(k: Tekstkonsentrasjon, molvekter: ReadonlyMap<string, string>): string | null {
  return k.forbindelse ? (molvekter.get(k.forbindelse) ?? null) : null
}

/** Konsentrasjonen i nodens `attrs` i enheten `valgt`, med molekylvektene siden kjenner. */
export function konsentrasjonIEnhet(attrs: unknown, valgt: Visningsenhet, molvekter: ReadonlyMap<string, string>): Konsentrasjonsvisning {
  const k = lesKonsentrasjonsattrs(attrs)
  const molvekt = molvektFor(k, molvekter)
  return visKonsentrasjon(k, valgt, molvekt === null ? null : Number(molvekt))
}

/**
 * En konsentrasjon i teksten, i den valgte enheten. Knappen viser at tallet
 * er regnet ut og ikke står fast; boblen (ved peker over, eller festet med et
 * klikk) viser tallet slik kilden oppga det, og det samme i hver av enhetene.
 */
export function Konsentrasjon({ attrs }: { attrs: Record<string, unknown> }) {
  const k = lesKonsentrasjonsattrs(attrs)
  const { enhet: valgt } = useMaleenhet()
  const { molvekter } = useKonsentrasjonskilde()
  const forbindelse = k.forbindelse ? (FORBINDELSER.finn(k.forbindelse) ?? null) : null
  const molvekt = molvektFor(k, molvekter)
  const vist = konsentrasjonIEnhet(attrs, valgt, molvekter)
  const bobleId = useId()
  const { apen, feste, knapp } = useFestbarBoble()

  return (
    <span {...feste} className="konsentrasjon-feste">
      <button
        {...knapp}
        type="button"
        className="konsentrasjon"
        data-omregnet={vist.omregnet || undefined}
        aria-controls={apen ? bobleId : undefined}
        aria-haspopup="true"
      >
        <span className="konsentrasjon__tall">
          <Uthev tekst={vist.tekst} />
        </span>{' '}
        <span className="konsentrasjon__enhet">{vist.enhet}</span>
        <span className="kun-skjermleser">, vis alle enheter</span>
      </button>
      {apen && knapp.ref.current && (
        <Konsentrasjonsboble
          id={bobleId}
          anker={knapp.ref.current}
          konsentrasjon={k}
          valgt={valgt}
          forbindelse={forbindelse}
          molvekt={molvekt}
        />
      )}
    </span>
  )
}

function Konsentrasjonsboble({
  id,
  anker,
  konsentrasjon: k,
  valgt,
  forbindelse,
  molvekt,
}: {
  id: string
  anker: HTMLElement
  konsentrasjon: Tekstkonsentrasjon
  valgt: Visningsenhet
  forbindelse: Forbindelse | null
  molvekt: string | null
}) {
  const rader = konsentrasjonIAlleEnheter(k, molvekt === null ? null : Number(molvekt))
  const mangler = rader.some((r) => r.tekst === null)
  // Boblen måles på nytt bare når tallene i den endres, ikke ved hver tegning.
  const { boble, innhold, klasser, stil } = useBobleplassering<HTMLSpanElement>(anker, rader.map((r) => r.tekst).join('\n'))
  // Spenn med roller, ikke en tabell: tallet står inne i et avsnitt, der bare
  // tekstnivå-elementer er gyldige.
  return (
    <span ref={boble} id={id} className={`${klasser} tipsboble--interaktiv konsentrasjonsboble`} style={stil}>
      <span ref={innhold} className="tipsboble__innhold konsentrasjonsboble__innhold">
        {forbindelse && (
          <span className="konsentrasjonsboble__forbindelse">
            {forbindelse.navn}
            {molvekt && <span className="konsentrasjonsboble__molvekt"> · {molvekttekst(molvekt)}</span>}
          </span>
        )}
        <span className="konsentrasjonsboble__tabell" role="table" aria-label="Konsentrasjonen i alle enheter">
          <span role="row" className="konsentrasjonsboble__rad konsentrasjonsboble__rad--kilde">
            <span role="rowheader">I kilden</span>
            <span role="cell">
              {k.verdi} {k.enhet}
            </span>
          </span>
          {rader.map((r) => (
            <span
              key={r.enhet}
              role="row"
              className="konsentrasjonsboble__rad"
              aria-current={r.enhet === valgt || undefined}
            >
              <span role="rowheader">{r.enhet}</span>
              <span role="cell" className={r.tekst === null ? 'konsentrasjonsboble__mangler' : undefined}>
                {r.tekst ?? 'kan ikke regnes om'}
              </span>
            </span>
          ))}
        </span>
        <span className="konsentrasjonsboble__merknad">
          {mangler
            ? forbindelse
              ? 'Mellom masse og stoffmengde trengs molekylvekten fra PubChem, og den er ikke hentet for forbindelsen.'
              : 'Mellom masse og stoffmengde trengs molekylvekten, og forbindelsen er ikke oppgitt.'
            : 'Omregnede tall har høyst to gjeldende sifre.'}
        </span>
      </span>
    </span>
  )
}
