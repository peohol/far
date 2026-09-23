import { useId, useMemo, useState } from 'react'
import type { Referanseinnhold } from '../../faginnhold/modell'
import { formaterReferanse, type Referanse } from '../../faginnhold/referanser'
import { erTrygLenke } from '../../faginnhold/riktekst'
import { fold, sokeord } from '../../faginnhold/sok'
import { Button } from '../Button'
import { Referansetekst } from '../referanser/Referansetekst'
import { useRedigering } from './Redigeringskontekst'

/** Flest forslag som vises av gangen. */
const MAKS_FORSLAG = 8

export interface ReferansevelgerProps {
  /** Overskriften, f.eks. «Kilder for kortet». */
  tittel: string
  /** Referansene som er valgt, i rekkefølge. */
  valgte: readonly string[]
  onEndre: (ider: string[]) => void
}

/**
 * Valget av kilder for et panel, et kort eller en sitering i teksten.
 *
 * Kildene hentes fra den felles referansebasen, så samme referanse kan brukes
 * mange steder og rettes ett sted. Finnes den ikke, kan den legges inn her.
 * Arkiverte referanser kan ikke velges. Rekkefølgen er den de velges i; numrene
 * på siden regnes ut når den vises.
 */
export function Referansevelger({ tittel, valgte, onEndre }: ReferansevelgerProps) {
  const { referansebase } = useRedigering()
  const [sporring, setSporring] = useState('')
  const [ny, setNy] = useState(false)
  const sokId = useId()

  const perId = useMemo(() => new Map(referansebase.map((r) => [r.id, r])), [referansebase])
  const forslag = useMemo(() => {
    const ord = sokeord(sporring)
    if (ord.length === 0) return []
    return referansebase
      .filter((r) => !r.arkivert && !valgte.includes(r.id))
      .filter((r) => {
        const tekst = fold(formaterReferanse(r))
        return ord.every((o) => tekst.includes(o))
      })
      .slice(0, MAKS_FORSLAG)
  }, [referansebase, sporring, valgte])

  const leggTil = (id: string) => {
    onEndre([...valgte, id])
    setSporring('')
  }

  return (
    <fieldset className="referansevelger">
      <legend className="referansevelger__tittel">{tittel}</legend>

      {valgte.length > 0 ? (
        <ol className="referansevelger__valgte">
          {valgte.map((id, i) => {
            const referanse = perId.get(id)
            const navn = referanse ? formaterReferanse(referanse) : 'Ukjent referanse'
            return (
              <li key={id} className="referansevelger__valgt">
                <span className="referansevelger__tekst">
                  {referanse ? <Referansetekst referanse={referanse} /> : navn}
                </span>
                <span className="referansevelger__handlinger">
                  {i > 0 && (
                    <Button
                      variant="subtle"
                      aria-label={`Flytt opp: ${navn}`}
                      onClick={() => onEndre(bytt(valgte, i, i - 1))}
                    >
                      Opp
                    </Button>
                  )}
                  <Button
                    variant="subtle"
                    aria-label={`Fjern: ${navn}`}
                    onClick={() => onEndre(valgte.filter((v) => v !== id))}
                  >
                    Fjern
                  </Button>
                </span>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="referansevelger__tom">Ingen kilder valgt.</p>
      )}

      <label className="felt" htmlFor={sokId}>
        <span className="felt__merkelapp">Finn en referanse</span>
        <input
          id={sokId}
          className="felt__inndata"
          type="search"
          value={sporring}
          placeholder="Tittel, forfatter eller år"
          onChange={(e) => setSporring(e.target.value)}
          onKeyDown={(e) => {
            // Enter skal ikke sende skjemaet velgeren står i. Står det bare
            // ett forslag igjen, velges det.
            if (e.key !== 'Enter') return
            e.preventDefault()
            const [eneste] = forslag
            if (eneste && forslag.length === 1) leggTil(eneste.id)
          }}
        />
      </label>
      {sporring.trim() && (
        <ul className="referansevelger__forslag" aria-label="Referanser som passer">
          {forslag.map((referanse) => (
            <li key={referanse.id}>
              <button type="button" className="referansevelger__forslagsknapp" onClick={() => leggTil(referanse.id)}>
                <span className="kun-skjermleser">Legg til: </span>
                {formaterReferanse(referanse)}
              </button>
            </li>
          ))}
          {forslag.length === 0 && <li className="referansevelger__tom">Ingen referanser passer.</li>}
        </ul>
      )}

      {ny ? (
        <NyReferanse
          onLagret={(referanse) => {
            leggTil(referanse.id)
            setNy(false)
          }}
          onAvbryt={() => setNy(false)}
        />
      ) : (
        <Button variant="subtle" onClick={() => setNy(true)}>
          Ny referanse …
        </Button>
      )}
    </fieldset>
  )
}

function bytt<T>(liste: readonly T[], a: number, b: number): T[] {
  const kopi = [...liste]
  ;[kopi[a], kopi[b]] = [kopi[b]!, kopi[a]!]
  return kopi
}

const TOM_REFERANSE: Referanseinnhold = { tittel: '', forfattere: '', aar: '', lenke: '' }

/** Feilen i en ny referanse, eller `null` når den kan lagres. Samme regler som databasen. */
export function kontrollerReferanse(innhold: Referanseinnhold): string | null {
  if (!innhold.tittel.trim() && !innhold.forfattere.trim() && !innhold.lenke.trim()) {
    return 'Oppgi minst en tittel, en forfatter eller en lenke.'
  }
  if (innhold.lenke.trim() && !erTrygLenke(innhold.lenke)) {
    return 'Lenken må være en nettadresse som begynner med http:// eller https://.'
  }
  return null
}

const FELT: { navn: keyof Referanseinnhold; merke: string; type?: string }[] = [
  { navn: 'tittel', merke: 'Tittel' },
  { navn: 'forfattere', merke: 'Forfatter(e)' },
  { navn: 'aar', merke: 'År' },
  { navn: 'lenke', merke: 'Lenke', type: 'url' },
]

/**
 * Skjemaet for en ny referanse, på Slaids-formen. Den lagres som utkast i
 * referansebasen med én gang, så den kan velges; den publiseres sammen med
 * siden som bruker den.
 */
function NyReferanse({ onLagret, onAvbryt }: { onLagret: (r: Referanse) => void; onAvbryt: () => void }) {
  const { opprettReferanse } = useRedigering()
  const [innhold, setInnhold] = useState<Referanseinnhold>(TOM_REFERANSE)
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const id = useId()

  const lagre = async (event?: { preventDefault: () => void }) => {
    event?.preventDefault()
    const renset = {
      tittel: innhold.tittel.trim(),
      forfattere: innhold.forfattere.trim(),
      aar: innhold.aar.trim(),
      lenke: innhold.lenke.trim(),
    }
    const problem = kontrollerReferanse(renset)
    if (problem) {
      setFeil(problem)
      return
    }
    setLagrer(true)
    setFeil(null)
    try {
      onLagret(await opprettReferanse(renset))
    } catch (e) {
      setFeil((e as Error).message)
    } finally {
      setLagrer(false)
    }
  }

  // Ikke et eget <form>: velgeren står ofte inne i skjemaet for kortet, og
  // skjemaer kan ikke stå inni hverandre.
  return (
    <div className="nyreferanse" role="group" aria-labelledby={`${id}-overskrift`}>
      <p id={`${id}-overskrift`} className="nyreferanse__tittel">
        Ny referanse
      </p>
      {FELT.map((felt) => (
        <label key={felt.navn} className="felt" htmlFor={`${id}-${felt.navn}`}>
          <span className="felt__merkelapp">{felt.merke}</span>
          <input
            id={`${id}-${felt.navn}`}
            className="felt__inndata"
            type={felt.type ?? 'text'}
            value={innhold[felt.navn] as string}
            onChange={(e) => setInnhold({ ...innhold, [felt.navn]: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void lagre(e)
            }}
          />
        </label>
      ))}
      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onAvbryt}>
          Avbryt
        </Button>
        <Button onClick={() => void lagre()} disabled={lagrer}>
          Lagre referansen
        </Button>
      </div>
    </div>
  )
}
