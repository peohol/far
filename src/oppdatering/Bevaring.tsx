import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { gjenopprettRulling, hentUtBevart, registrer, sePaBevart, settEier } from './bevaring'

/**
 * Tilstand som overlever en oppdatering til en ny versjon (se `bevaring.ts`).
 *
 * `useBevart` brukes som `useState`, med et navn. Et vindu som står åpent, et
 * skjema som er halvveis skrevet eller valgene i en fortolkning kommer da
 * tilbake som de var når brukeren har trykket «Oppdater nå».
 *
 * Navnet må være entydig i appen. Det settes sammen med områdene rundt
 * (`Bevaringsomrade`), så et skjema kan bruke korte navn som «tittel» og
 * «dokument» og likevel ikke blande seg med det samme skjemaet et annet sted:
 * stoffsiden er ett område, et element på den et annet inni det.
 */

const Omrade = createContext('')
const Eier = createContext<string | null>(null)

/**
 * Brukeren det som tas vare på inni, hører til. Står rundt appen når noen er
 * logget inn, så et bilde — verdiene og hvor langt siden var rullet — bare
 * kommer tilbake til den som tok det.
 */
export function Bevaringseier({ id, children }: { id: string | null; children: ReactNode }) {
  useEffect(() => settEier(id), [id])
  // Rulleplassene hører også til brukeren, så rullingen tilbake begynner først
  // her, og stopper når brukeren logger ut eller byttes ut.
  useEffect(() => gjenopprettRulling(id), [id])
  return <Eier.Provider value={id}>{children}</Eier.Provider>
}

/** Et område som navnene inni hører til, f.eks. én stoffside eller ett element på den. */
export function Bevaringsomrade({ navn, children }: { navn: string; children: ReactNode }) {
  const forelder = useContext(Omrade)
  return <Omrade.Provider value={forelder ? `${forelder}/${navn}` : navn}>{children}</Omrade.Provider>
}

/**
 * Hvordan en verdi som ikke er ren JSON, tas vare på og leses tilbake: et
 * `Map` som liste, eller en analytt som koden sin. `les` gir `undefined` når
 * det som ble tatt vare på, ikke lenger gir mening i den nye versjonen.
 */
export interface Bevaringsform<T> {
  lagre: (verdi: T) => unknown
  les: (lagret: unknown) => T | undefined
}

/** Samme slags verdi som utgangspunktet — det en ny versjon kan ha endret, slipper ikke inn. */
function sammeSlag(lagret: unknown, start: unknown): boolean {
  if (start === null || start === undefined) return true
  if (Array.isArray(start)) return Array.isArray(lagret)
  return typeof lagret === typeof start && lagret !== null
}

function tolk<T>(funnet: { verdi: unknown } | undefined, start: T, form?: Bevaringsform<T>): { verdi: T } | undefined {
  if (!funnet) return undefined
  if (form) {
    const verdi = form.les(funnet.verdi)
    return verdi === undefined ? undefined : { verdi }
  }
  return sammeSlag(funnet.verdi, start) ? { verdi: funnet.verdi as T } : undefined
}

/**
 * Som `useState`, men verdien tas vare på under `navn` når appen oppdateres,
 * og kommer tilbake i den nye versjonen. Med `null` som navn er det en vanlig
 * tilstand.
 *
 * Den tredje verdien er sann når utgangsverdien kom fra forrige versjon, så en
 * effekt som ellers nullstiller noe når et vindu åpnes, kan la det stå.
 *
 * Skifter navnet — som når et element får sin ID etter at utkastet er hentet —
 * ser den etter en bevart verdi under det nye navnet.
 */
export function useBevart<T>(
  navn: string | null,
  start: T | (() => T),
  form?: Bevaringsform<T>,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const omrade = useContext(Omrade)
  const eier = useContext(Eier)
  const nokkel = navn === null ? null : omrade ? `${omrade}/${navn}` : navn
  const [forste] = useState(() => {
    const utgangspunkt = typeof start === 'function' ? (start as () => T)() : start
    const bevart = nokkel === null ? undefined : tolk(sePaBevart(nokkel, eier), utgangspunkt, form)
    return bevart ? { verdi: bevart.verdi, gjenopprettet: true } : { verdi: utgangspunkt, gjenopprettet: false }
  })
  const [verdi, setVerdi] = useState<T>(forste.verdi)

  const siste = useRef(verdi)
  siste.current = verdi
  const formen = useRef(form)
  formen.current = form
  const startverdi = useRef(forste.verdi)

  // Verdien er hentet ut når komponenten står; i registeret ligger den så
  // lenge komponenten lever.
  const forrige = useRef(nokkel)
  useEffect(() => {
    if (nokkel === null) return
    if (forrige.current !== nokkel) {
      forrige.current = nokkel
      const bevart = tolk(sePaBevart(nokkel, eier), startverdi.current, formen.current)
      if (bevart) setVerdi(bevart.verdi)
    }
    hentUtBevart(nokkel)
    return registrer(nokkel, () => {
      const lagre = formen.current?.lagre
      return lagre ? lagre(siste.current) : siste.current
    })
  }, [nokkel, eier])

  return [verdi, setVerdi, forste.gjenopprettet]
}
