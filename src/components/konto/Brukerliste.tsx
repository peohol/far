import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { brukernavnFeil, normaliserBrukernavn } from '@delt/brukernavn'
import { visningsnavn, type Profil } from '@delt/profil'
import {
  hentAlleProfiler,
  nyttMidlertidigPassord,
  opprettBruker,
  settRolle,
  type Midlertidig,
} from '../../auth/api'
import { useAvatarlenker } from '../../auth/avatarer'
import { useProfil } from '../../auth/okt'
import { maaGjennomOppsett } from '../../domain/tilgang'
import { useClipboard } from '../../hooks/useClipboard'
import { Button } from '../Button'
import { Ikon } from '../ikon/Ikon'
import { Merke } from '../Merke'
import { Modallag } from '../Modallag'
import { CheckIcon, CopyIcon, PlusIcon } from '../icons'
import { Avatar } from './Avatar'
import { Felt } from './Felt'

/**
 * Brukerlista.
 *
 * Alle innloggede ser hvem som finnes. Administratorer får i tillegg
 * knappene for å opprette en bruker, gi eller ta adminstatus og lage et nytt
 * midlertidig passord. Knappene er et grensesnitt, ikke en tilgangskontroll:
 * hver av handlingene går gjennom en Edge-funksjon som slår opp rollen på
 * nytt server-side.
 */
export function Brukerliste({ apen, onLukk }: { apen: boolean; onLukk: () => void }) {
  const meg = useProfil()
  const erAdmin = meg.role === 'admin'
  const [profiler, setProfiler] = useState<Profil[]>([])
  const [feil, setFeil] = useState<string | null>(null)
  const [laster, setLaster] = useState(false)
  const [oppretter, setOppretter] = useState(false)
  const [nyttBrukernavn, setNyttBrukernavn] = useState('')
  const [arbeider, setArbeider] = useState<string | null>(null)
  const [midlertidig, setMidlertidig] = useState<Midlertidig | null>(null)
  const lenker = useAvatarlenker(profiler)

  const hent = useCallback(async () => {
    setLaster(true)
    try {
      setProfiler(await hentAlleProfiler())
      setFeil(null)
    } catch {
      setFeil('Fikk ikke hentet brukerlista.')
    } finally {
      setLaster(false)
    }
  }, [])

  useEffect(() => {
    if (!apen) return
    setMidlertidig(null)
    setOppretter(false)
    setNyttBrukernavn('')
    void hent()
  }, [apen, hent])

  const opprett = async (hendelse: FormEvent) => {
    hendelse.preventDefault()
    if (arbeider) return

    const brukernavn = normaliserBrukernavn(nyttBrukernavn)
    const lokalFeil = brukernavnFeil(brukernavn)
    if (lokalFeil) {
      setFeil(lokalFeil)
      return
    }

    setArbeider('opprett')
    setFeil(null)
    try {
      setMidlertidig(await opprettBruker(brukernavn))
      setNyttBrukernavn('')
      setOppretter(false)
      await hent()
    } catch (aarsak) {
      setFeil(aarsak instanceof Error ? aarsak.message : 'Noe gikk galt. Prøv igjen.')
    } finally {
      setArbeider(null)
    }
  }

  const byttRolle = async (profil: Profil) => {
    if (arbeider) return
    setArbeider(profil.id)
    setFeil(null)
    try {
      await settRolle(profil.id, profil.role === 'admin' ? 'user' : 'admin')
      await hent()
    } catch (aarsak) {
      setFeil(aarsak instanceof Error ? aarsak.message : 'Noe gikk galt. Prøv igjen.')
    } finally {
      setArbeider(null)
    }
  }

  const nyttPassord = async (profil: Profil) => {
    if (arbeider) return
    setArbeider(profil.id)
    setFeil(null)
    try {
      setMidlertidig(await nyttMidlertidigPassord(profil.id))
      await hent()
    } catch (aarsak) {
      setFeil(aarsak instanceof Error ? aarsak.message : 'Noe gikk galt. Prøv igjen.')
    } finally {
      setArbeider(null)
    }
  }

  return (
    <Modallag
      apen={apen}
      tittel="Brukere"
      ikon="shield"
      bred
      onLukk={onLukk}
      handling={
        erAdmin && !oppretter ? (
          <Button className="knapp--kompakt" icon={<PlusIcon />} onClick={() => setOppretter(true)}>
            Opprett bruker
          </Button>
        ) : null
      }
    >
      {oppretter && (
        <form className="skjema" onSubmit={(hendelse) => void opprett(hendelse)}>
          <Felt
            merkelapp="Brukernavn"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            // Feltet er det eneste i skjemaet, og skjemaet åpnet nettopp.
            autoFocus
            value={nyttBrukernavn}
            hjelp="Brukeren får et midlertidig passord som vises én gang."
            onChange={(hendelse) => setNyttBrukernavn(hendelse.target.value)}
          />
          <div className="skjema__knapper">
            <Button type="submit" disabled={arbeider !== null}>
              {arbeider === 'opprett' ? 'Oppretter …' : 'Opprett'}
            </Button>
            <Button variant="subtle" onClick={() => setOppretter(false)}>
              Avbryt
            </Button>
          </div>
        </form>
      )}

      {midlertidig && (
        <Passordkvittering
          midlertidig={midlertidig}
          onLukk={() => setMidlertidig(null)}
        />
      )}

      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}

      {laster && profiler.length === 0 ? (
        <p className="brukerliste__tomt">Henter brukerne …</p>
      ) : (
        <ul className="brukerliste">
          {profiler.map((profil) => {
            const navn = visningsnavn(profil)
            return (
              <li key={profil.id} className="brukerrad">
                <Avatar
                  profil={profil}
                  lenke={profil.avatar_path ? (lenker.get(profil.avatar_path) ?? null) : null}
                />
                <span className="brukerrad__navn">
                  <span className="brukerrad__fullt">
                    {navn}
                    {profil.id === meg.id && <span className="brukerrad__deg"> (deg)</span>}
                  </span>
                  <span className="brukerrad__brukernavn">{profil.username}</span>
                </span>

                <span className="brukerrad__merker">
                  {profil.role === 'admin' ? (
                    <Merke tone="aksent" ikon={<Ikon navn="shield" />}>
                      Administrator
                    </Merke>
                  ) : (
                    <Merke>Bruker</Merke>
                  )}
                  {maaGjennomOppsett(profil) && <Merke tone="toksisk">Må bytte passord</Merke>}
                </span>

                {erAdmin && profil.id !== meg.id && (
                  <span className="brukerrad__knapper">
                    <Button
                      variant="kant"
                      icon={<Ikon navn="key" />}
                      aria-label={`Nytt passord for ${navn}`}
                      disabled={arbeider !== null}
                      onClick={() => void nyttPassord(profil)}
                    >
                      Nytt passord
                    </Button>
                    <Button
                      variant="kant"
                      icon={<Ikon navn="shield" />}
                      aria-label={`${profil.role === 'admin' ? 'Fjern admin' : 'Gjør til admin'}: ${navn}`}
                      disabled={arbeider !== null}
                      onClick={() => void byttRolle(profil)}
                    >
                      {profil.role === 'admin' ? 'Fjern admin' : 'Gjør til admin'}
                    </Button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Modallag>
  )
}

/**
 * Det midlertidige passordet, vist én gang.
 *
 * Det lagres ingen steder og kan ikke hentes fram igjen. Mistes det, lages et
 * nytt — derfor står advarselen like tydelig som passordet selv.
 */
function Passordkvittering({
  midlertidig,
  onLukk,
}: {
  midlertidig: Midlertidig
  onLukk: () => void
}) {
  const kopier = useClipboard()
  const [kopiert, setKopiert] = useState(false)

  useEffect(() => {
    setKopiert(false)
  }, [midlertidig])

  return (
    <div className="passordkvittering" role="alert">
      <p className="passordkvittering__tittel">
        <Ikon navn="key" storrelse="underpunkt" />
        <span>
          Midlertidig passord for <strong>{midlertidig.brukernavn}</strong>
        </span>
      </p>
      <p className="passordkvittering__passord">
        <code>{midlertidig.midlertidigPassord}</code>
        <Button
          className="knapp--kompakt"
          icon={kopiert ? <CheckIcon /> : <CopyIcon />}
          onClick={() => void kopier(midlertidig.midlertidigPassord).then(setKopiert)}
        >
          {kopiert ? 'Kopiert' : 'Kopier'}
        </Button>
      </p>
      <p className="passordkvittering__advarsel">
        Passordet vises bare nå. Gi det til brukeren, som må bytte det ved første innlogging.
        Blir det borte, må du lage et nytt.
      </p>
      <Button variant="kant" onClick={onLukk}>
        Jeg har notert passordet
      </Button>
    </div>
  )
}
