import { useEffect, useId, useState, type FormEvent } from 'react'
import { useBevart } from '../../oppdatering/Bevaring'
import { tomtDokument, type Riktekstdokument } from '../../faginnhold/riktekst'
import { endreIde, opprettIde } from '../../ideer/api'
import {
  KATEGORIER,
  KATEGORINAVN,
  type Idekategori,
  type Idetraad,
} from '../../ideer/modell'
import { TITTEL_MEST, tekstTilLagring } from '../../traad/modell'
import { Rikteksteditor } from '../stoffside/Rikteksteditor'
import { Forlatvarsel } from '../stoffside/Skjemaer'
import { Button } from '../Button'
import { Felt } from '../konto/Felt'
import type { Skjemastatus } from './useForlatvakt'

/**
 * Skjemaet for en ny idé, eller for å endre en: kategori og overskrift må
 * fylles ut, beskrivelsen er valgfri og har den samme verktøyraden som
 * stoffsidene, uten referansene.
 */
export function Ideskjema({
  ide,
  kategori: startkategori,
  onStatus,
  forlater,
  onForkast,
  onFortsett,
  onAvbryt,
  onLagret,
}: {
  /** Idéen som endres. Uten: en ny idé. */
  ide?: Idetraad
  /** Kategorien en ny idé begynner med, når den ble startet fra en tom kategori. */
  kategori?: Idekategori
  /** Om skjemaet har endringer som ikke er lagret, eller lagrer nå. */
  onStatus: (status: Skjemastatus) => void
  /** Brukeren vil forlate skjemaet med endringer som ikke er lagret. */
  forlater: boolean
  onForkast: () => void
  onFortsett: () => void
  onAvbryt: () => void
  onLagret: (id: string) => void
}) {
  // Det som er skrevet, overlever en oppdatering av appen.
  const skjema = `skjema:${ide?.id ?? 'ny'}`
  const [kategori, setKategori] = useBevart<Idekategori | null>(`${skjema}/kategori`, ide?.kategori ?? startkategori ?? null)
  const [tittel, setTittel] = useBevart(`${skjema}/tittel`, ide?.tittel ?? '')
  const [tekst, setTekst] = useBevart<Riktekstdokument>(`${skjema}/tekst`, () => ide?.tekst ?? tomtDokument())
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const kategoriId = useId()
  const beskrivelseId = useId()

  // Det skjemaet ville lagret, slik det var da det åpnet, og nå. Utgangspunktet
  // tas vare på sammen med det som er skrevet, så et utkast som kom tilbake
  // etter en oppdatering, fortsatt regnes som ulagret.
  const signatur = JSON.stringify([kategori, tittel.trim(), tekstTilLagring(tekst)])
  const [start] = useBevart(`${skjema}/utgangspunkt`, signatur)
  const status: Skjemastatus = lagrer ? 'lagrer' : signatur !== start ? 'ulagret' : 'uendret'
  useEffect(() => onStatus(status), [status, onStatus])

  const lagre = async (event: FormEvent) => {
    event.preventDefault()
    const renTittel = tittel.trim()
    if (!kategori) return setFeil('Velg en kategori.')
    if (renTittel === '') return setFeil('Skriv en overskrift.')
    setFeil(null)
    // En lagring svarer også på spørsmålet om å forkaste.
    onFortsett()
    setLagrer(true)
    try {
      const innhold = { kategori, tittel: renTittel, tekst: tekstTilLagring(tekst) }
      if (ide) {
        await endreIde(ide.id, innhold)
        onLagret(ide.id)
      } else {
        onLagret(await opprettIde(innhold))
      }
    } catch (e) {
      setFeil((e as Error).message)
      setLagrer(false)
    }
  }

  return (
    <form className="ideskjema" onSubmit={(e) => void lagre(e)} noValidate aria-label={ide ? 'Endre idéen' : 'Ny idé'}>
      <fieldset className="ideskjema__kategorier" aria-describedby={feil ? `${kategoriId}-feil` : undefined}>
        <legend className="felt__merkelapp" id={kategoriId}>
          Kategori
        </legend>
        <div className="ideskjema__valg">
          {KATEGORIER.map((k) => (
            <label key={k} className="kategorivalg" data-kategori={k}>
              <input
                type="radio"
                name={kategoriId}
                value={k}
                checked={kategori === k}
                onChange={() => setKategori(k)}
              />
              <span>{KATEGORINAVN[k]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Felt
        merkelapp="Overskrift"
        value={tittel}
        maxLength={TITTEL_MEST}
        autoFocus={Boolean(ide) || Boolean(startkategori)}
        onChange={(e) => setTittel(e.target.value)}
      />

      <div className="felt">
        <span className="felt__merkelapp" id={beskrivelseId}>
          Beskrivelse
        </span>
        <Rikteksteditor dokument={tekst} onEndre={setTekst} etikett="Beskrivelse" referanser={false} fyll />
      </div>

      {feil && (
        <p className="skjemafeil" role="alert" id={`${kategoriId}-feil`}>
          {feil}
        </p>
      )}
      {forlater ? (
        <Forlatvarsel onForkast={onForkast} onFortsett={onFortsett} />
      ) : (
        <div className="skjema__knapper ideskjema__knapper">
          <Button variant="subtle" onClick={onAvbryt} disabled={lagrer}>
            Avbryt
          </Button>
          <Button type="submit" className="knapp--kompakt" disabled={lagrer}>
            {lagrer ? 'Lagrer …' : ide ? 'Lagre' : 'Publiser'}
          </Button>
        </div>
      )}
    </form>
  )
}
