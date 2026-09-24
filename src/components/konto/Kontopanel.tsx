import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PASSORD_MINST, passordFeil } from '@delt/passord'
import { navnFeil, normaliserNavn } from '@delt/profil'
import { byttPassord, lagreEgenProfil, lastOppAvatar } from '../../auth/api'
import { useAvatarlenker } from '../../auth/avatarer'
import { useOkt, useProfil } from '../../auth/okt'
import { Button } from '../Button'
import { Modallag } from '../Modallag'
import { Ikon } from '../ikon/Ikon'
import { Avatar } from './Avatar'
import { Bildevelgerlast } from './Bildevelgerlast'
import { Felt, Lastfelt } from './Felt'

/**
 * Kontoen din: navn, profilbilde, passord og veien ut.
 *
 * Brukernavnet vises, men kan ikke endres — verken her eller noe annet sted.
 * Passordbyttet går på den økten som allerede er autentisert, og trenger
 * hverken e-post eller ny innlogging.
 */
export function Kontopanel({ apen, onLukk }: { apen: boolean; onLukk: () => void }) {
  const profil = useProfil()
  const { settProfil, loggUt } = useOkt()
  const lenker = useAvatarlenker([profil])

  const [fornavn, setFornavn] = useState(profil.first_name)
  const [etternavn, setEtternavn] = useState(profil.last_name)
  const [bilde, setBilde] = useState<Blob | null>(null)
  const [profilfeil, setProfilfeil] = useState<string | null>(null)
  const [profilkvittering, setProfilkvittering] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)

  const [passord, setPassord] = useState('')
  const [gjentatt, setGjentatt] = useState('')
  const [passordfeilmelding, setPassordfeilmelding] = useState<string | null>(null)
  const [passordkvittering, setPassordkvittering] = useState<string | null>(null)
  const [bytter, setBytter] = useState(false)

  // Hver åpning begynner med profilen slik den står nå, uten gamle
  // kvitteringer og halvutfylte passordfelter fra forrige gang.
  //
  // Det er åpningen som utløser dette, og bare den. Sto profilen i
  // avhengighetene, ville en vellykket lagring — som nettopp endrer profilen
  // — tørket bort kvitteringen for lagringen i samme øyeblikk.
  useEffect(() => {
    if (!apen) return
    setFornavn(profil.first_name)
    setEtternavn(profil.last_name)
    setBilde(null)
    setProfilfeil(null)
    setProfilkvittering(null)
    setPassord('')
    setGjentatt('')
    setPassordfeilmelding(null)
    setPassordkvittering(null)
  }, [apen])

  const forhandsvisning = useMemo(() => (bilde ? URL.createObjectURL(bilde) : null), [bilde])
  useEffect(() => {
    if (!forhandsvisning) return
    return () => URL.revokeObjectURL(forhandsvisning)
  }, [forhandsvisning])

  const lagreProfil = async (hendelse: FormEvent) => {
    hendelse.preventDefault()
    if (lagrer) return

    const rentFornavn = normaliserNavn(fornavn)
    const rentEtternavn = normaliserNavn(etternavn)
    const lokalFeil = navnFeil(rentFornavn, 'Fornavn') ?? navnFeil(rentEtternavn, 'Etternavn')
    if (lokalFeil) {
      setProfilfeil(lokalFeil)
      setProfilkvittering(null)
      return
    }

    setLagrer(true)
    setProfilfeil(null)
    setProfilkvittering(null)
    try {
      const sti = bilde ? await lastOppAvatar(profil.id, bilde) : undefined
      settProfil(
        await lagreEgenProfil(profil.id, {
          first_name: rentFornavn,
          last_name: rentEtternavn,
          ...(sti ? { avatar_path: sti } : {}),
        }),
      )
      setBilde(null)
      setProfilkvittering('Opplysningene er lagret.')
    } catch (aarsak) {
      setProfilfeil(aarsak instanceof Error ? aarsak.message : 'Noe gikk galt. Prøv igjen.')
    } finally {
      setLagrer(false)
    }
  }

  const byttPassordet = async (hendelse: FormEvent) => {
    hendelse.preventDefault()
    if (bytter) return

    const lokalFeil =
      passordFeil(passord) ?? (passord === gjentatt ? null : 'De to passordene er ikke like.')
    if (lokalFeil) {
      setPassordfeilmelding(lokalFeil)
      setPassordkvittering(null)
      return
    }

    setBytter(true)
    setPassordfeilmelding(null)
    setPassordkvittering(null)
    try {
      await byttPassord(passord)
      setPassord('')
      setGjentatt('')
      setPassordkvittering('Passordet er byttet. Det nye gjelder fra nå.')
    } catch (aarsak) {
      setPassordfeilmelding(
        aarsak instanceof Error ? aarsak.message : 'Noe gikk galt. Prøv igjen.',
      )
    } finally {
      setBytter(false)
    }
  }

  const gjeldendeBilde =
    forhandsvisning ?? (profil.avatar_path ? (lenker.get(profil.avatar_path) ?? null) : null)

  return (
    <Modallag apen={apen} tittel="Kontoen din" ikon="user" onLukk={onLukk}>
      <form className="skjema" onSubmit={(hendelse) => void lagreProfil(hendelse)}>
        <Lastfelt
          merkelapp="Brukernavn"
          verdi={profil.username}
          hjelp="Brukernavnet er fast og kan ikke endres."
        />

        <div className="skjema__rad">
          <Felt
            merkelapp="Fornavn"
            autoComplete="given-name"
            value={fornavn}
            onChange={(hendelse) => setFornavn(hendelse.target.value)}
          />
          <Felt
            merkelapp="Etternavn"
            autoComplete="family-name"
            value={etternavn}
            onChange={(hendelse) => setEtternavn(hendelse.target.value)}
          />
        </div>

        <div className="skjema__bolk">
          <span className="skjema__bolktittel">Profilbilde</span>
          <Bildevelgerlast
            visning={<Avatar profil={profil} lenke={gjeldendeBilde} storrelse="stor" />}
            onValgt={setBilde}
          />
        </div>

        {profilfeil && (
          <p className="skjemafeil" role="alert">
            {profilfeil}
          </p>
        )}
        <p className="skjemakvittering" role="status">
          {profilkvittering}
        </p>

        <Button type="submit" disabled={lagrer}>
          {lagrer ? 'Lagrer …' : 'Lagre'}
        </Button>
      </form>

      <hr className="skille" />

      <form className="skjema" onSubmit={(hendelse) => void byttPassordet(hendelse)}>
        <span className="skjema__bolktittel">Bytt passord</span>
        <div className="skjema__rad">
          <Felt
            merkelapp="Nytt passord"
            type="password"
            autoComplete="new-password"
            value={passord}
            hjelp={`Minst ${PASSORD_MINST} tegn.`}
            onChange={(hendelse) => setPassord(hendelse.target.value)}
          />
          <Felt
            merkelapp="Gjenta passordet"
            type="password"
            autoComplete="new-password"
            value={gjentatt}
            onChange={(hendelse) => setGjentatt(hendelse.target.value)}
          />
        </div>

        {passordfeilmelding && (
          <p className="skjemafeil" role="alert">
            {passordfeilmelding}
          </p>
        )}
        <p className="skjemakvittering" role="status">
          {passordkvittering}
        </p>

        <Button type="submit" disabled={bytter}>
          {bytter ? 'Bytter …' : 'Bytt passord'}
        </Button>
      </form>

      <hr className="skille" />

      <Button variant="kant" icon={<Ikon navn="logout" />} onClick={() => void loggUt()}>
        Logg ut
      </Button>
    </Modallag>
  )
}
