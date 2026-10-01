import { useState, type FormEvent } from 'react'
import { useAutoerstatt } from '../../autoerstatt/Autoerstattkilde'
import { regelfeil, type Autoerstattregel } from '../../autoerstatt/regler'
import { useBevart } from '../../oppdatering/Bevaring'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Modallag } from '../Modallag'
import { Bekreftknapp } from '../traad/Smadeler'
import { Felt } from './Felt'

/** Regelen som fylles ut: en ny (`id` er `null`) eller en som endres. */
interface Utkast {
  id: string | null
  finn: string
  erstatt: string
}

/**
 * Autoerstatt-reglene, for administratorer: hva som byttes ut mens det
 * skrives i teksteditorene, og med hva. Reglene opprettes, endres og slettes
 * her; tilgangen avgjøres av radsikkerheten i databasen.
 */
export function Autoerstattregler({ apen, onLukk }: { apen: boolean; onLukk: () => void }) {
  const kilde = useAutoerstatt()
  // Regelen som skrives på, overlever en oppdatering av appen.
  const [utkast, setUtkast] = useBevart<Utkast | null>('autoerstatt-utkast', null)
  const [feil, setFeil] = useState<string | null>(null)
  const [arbeider, setArbeider] = useState(false)

  if (!kilde) return null
  const { regler } = kilde

  /** Gjør en endring i databasen og henter reglene på nytt, så alle editorene får dem. */
  const utfor = async (endring: () => Promise<void>): Promise<boolean> => {
    if (arbeider) return false
    setArbeider(true)
    setFeil(null)
    try {
      await endring()
      return true
    } catch (aarsak) {
      setFeil(aarsak instanceof Error ? aarsak.message : 'Noe gikk galt. Prøv igjen.')
      return false
    } finally {
      await kilde.hent()
      setArbeider(false)
    }
  }

  const lagre = async (hendelse: FormEvent) => {
    hendelse.preventDefault()
    if (!utkast) return
    const { id, finn, erstatt } = utkast
    const lokalFeil = regelfeil(finn, erstatt, regler.filter((r) => r.id !== id))
    if (lokalFeil) {
      setFeil(lokalFeil)
      return
    }
    const ok = await utfor(() => (id ? kilde.lager.endre(id, finn, erstatt) : kilde.lager.opprett(finn, erstatt)))
    if (ok) setUtkast(null)
  }

  const apneUtkast = (neste: Utkast) => {
    setFeil(null)
    setUtkast(neste)
  }

  const skjema = utkast && (
    <Regelskjema
      utkast={utkast}
      arbeider={arbeider}
      onEndre={setUtkast}
      onLagre={(h) => void lagre(h)}
      onAvbryt={() => {
        setFeil(null)
        setUtkast(null)
      }}
    />
  )

  return (
    <Modallag
      apen={apen}
      tittel="Autoerstatt"
      ikon="edit"
      bred
      onLukk={onLukk}
      handling={
        utkast?.id === null ? null : (
          <Button
            className="knapp--kompakt"
            icon={<Ikon navn="plus" />}
            onClick={() => apneUtkast({ id: null, finn: '', erstatt: '' })}
          >
            Ny regel
          </Button>
        )
      }
    >
      <p className="autoerstatt__ingress">
        Mens det skrives i teksteditorene, byttes teksten til venstre ut med teksten til høyre. Mellomrom teller med
        og vises som <Mellomrom />. Tilbaketasten rett etter en erstatning setter tilbake det som ble skrevet.
      </p>

      {utkast?.id === null && skjema}

      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}

      {regler.length === 0 ? (
        <p className="autoerstatt__tomt">Ingen regler ennå.</p>
      ) : (
        <ul className="autoerstatt__liste">
          {regler.map((regel) =>
            utkast?.id === regel.id ? (
              <li key={regel.id} className="autoerstatt__rad autoerstatt__rad--skjema">
                {skjema}
              </li>
            ) : (
              <Regelrad
                key={regel.id}
                regel={regel}
                arbeider={arbeider}
                onEndre={() => apneUtkast({ id: regel.id, finn: regel.finn, erstatt: regel.erstatt })}
                onSlett={() => void utfor(() => kilde.lager.slett(regel.id))}
              />
            ),
          )}
        </ul>
      )}
    </Modallag>
  )
}

function Regelrad({
  regel,
  arbeider,
  onEndre,
  onSlett,
}: {
  regel: Autoerstattregel
  arbeider: boolean
  onEndre: () => void
  onSlett: () => void
}) {
  const navn = `«${regel.finn}» til «${regel.erstatt}»`
  return (
    <li className="autoerstatt__rad">
      <Regelvisning finn={regel.finn} erstatt={regel.erstatt} />
      <span className="autoerstatt__knapper">
        <Button variant="kant" icon={<Ikon navn="edit" />} aria-label={`Endre regelen ${navn}`} disabled={arbeider} onClick={onEndre}>
          Endre
        </Button>
        <Bekreftknapp
          ikon="trash"
          tekst="Slett"
          bekreftTekst="Bekreft sletting"
          etikett={`Slett regelen ${navn}`}
          bekreftEtikett={`Bekreft sletting av regelen ${navn}`}
          onBekreft={onSlett}
        />
      </span>
    </li>
  )
}

function Regelskjema({
  utkast,
  arbeider,
  onEndre,
  onLagre,
  onAvbryt,
}: {
  utkast: Utkast
  arbeider: boolean
  onEndre: (utkast: Utkast) => void
  onLagre: (hendelse: FormEvent) => void
  onAvbryt: () => void
}) {
  // Feltene skal vise nøyaktig det som er skrevet: ingen retting, ingen trimming.
  const rene = { autoComplete: 'off', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } as const
  return (
    <form className="skjema autoerstatt__skjema" onSubmit={onLagre}>
      <div className="autoerstatt__felter">
        <Felt
          merkelapp="Når det skrives"
          {...rene}
          autoFocus
          value={utkast.finn}
          onChange={(e) => onEndre({ ...utkast, finn: e.target.value })}
        />
        <Felt
          merkelapp="Byttes det med"
          {...rene}
          value={utkast.erstatt}
          onChange={(e) => onEndre({ ...utkast, erstatt: e.target.value })}
        />
      </div>
      {(utkast.finn || utkast.erstatt) && (
        <p className="autoerstatt__forhandsvisning">
          Regelen blir: <Regelvisning finn={utkast.finn} erstatt={utkast.erstatt} />
        </p>
      )}
      <div className="skjema__knapper">
        <Button type="submit" disabled={arbeider}>
          {arbeider ? 'Lagrer …' : 'Lagre'}
        </Button>
        <Button variant="subtle" onClick={onAvbryt}>
          Avbryt
        </Button>
      </div>
    </form>
  )
}

/** En regel med mellomrommene synlige: «␣-␣ → ␣–␣». */
function Regelvisning({ finn, erstatt }: { finn: string; erstatt: string }) {
  return (
    <span className="autoerstatt__regel">
      <Synlig tekst={finn} />
      <span className="autoerstatt__pil" aria-label="til">
        →
      </span>
      <Synlig tekst={erstatt} />
    </span>
  )
}

/** Teksten i en regel, med hvert mellomrom vist som ␣. */
function Synlig({ tekst }: { tekst: string }) {
  return (
    <code className="autoerstatt__tekst" aria-label={tekst.replace(/ /g, ' mellomrom ').trim() || 'tomt'}>
      {[...tekst].map((tegn, i) => (tegn === ' ' ? <Mellomrom key={i} /> : tegn))}
    </code>
  )
}

function Mellomrom() {
  return (
    <span className="autoerstatt__mellomrom" aria-hidden="true">
      ␣
    </span>
  )
}
