import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PASSORD_MINST, passordFeil } from '@delt/passord'
import { navnFeil, normaliserNavn } from '@delt/profil'
import { fullforOppsett, lastOppAvatar } from '../../auth/api'
import { useOkt, useProfil } from '../../auth/okt'
import { Button } from '../Button'
import { Avatar } from './Avatar'
import { Bildevelgerlast } from './Bildevelgerlast'
import { Felt, Lastfelt } from './Felt'

/**
 * Førstegangsoppsettet.
 *
 * Så lenge kontoen står her, er den kliniske appen utilgjengelig. Passord,
 * fornavn og etternavn lagres i ett kall til en Edge-funksjon, som også er
 * den eneste som kan åpne kontoen: nettleseren har ikke rettigheter til å
 * sette `must_change_password` eller `onboarding_completed` selv.
 */
export function Forstegangsoppsett() {
  const profil = useProfil()
  const { settProfil, loggUt } = useOkt()
  const [fornavn, setFornavn] = useState(profil.first_name)
  const [etternavn, setEtternavn] = useState(profil.last_name)
  const [passord, setPassord] = useState('')
  const [gjentatt, setGjentatt] = useState('')
  const [bilde, setBilde] = useState<Blob | null>(null)
  const [feil, setFeil] = useState<string | null>(null)
  const [arbeider, setArbeider] = useState(false)

  // Forhåndsvisningen lever bare så lenge bildet er valgt.
  const forhandsvisning = useMemo(() => (bilde ? URL.createObjectURL(bilde) : null), [bilde])
  useEffect(() => {
    if (!forhandsvisning) return
    return () => URL.revokeObjectURL(forhandsvisning)
  }, [forhandsvisning])

  const send = async (hendelse: FormEvent) => {
    hendelse.preventDefault()
    if (arbeider) return

    const rentFornavn = normaliserNavn(fornavn)
    const rentEtternavn = normaliserNavn(etternavn)
    const lokalFeil =
      navnFeil(rentFornavn, 'Fornavn') ??
      navnFeil(rentEtternavn, 'Etternavn') ??
      passordFeil(passord) ??
      (passord === gjentatt ? null : 'De to passordene er ikke like.')
    if (lokalFeil) {
      setFeil(lokalFeil)
      return
    }

    setArbeider(true)
    setFeil(null)
    try {
      const sti = bilde ? await lastOppAvatar(profil.id, bilde) : null
      settProfil(
        await fullforOppsett({
          brukernavn: profil.username,
          passord,
          fornavn: rentFornavn,
          etternavn: rentEtternavn,
          avatarSti: sti,
        }),
      )
    } catch (aarsak) {
      setFeil(aarsak instanceof Error ? aarsak.message : 'Noe gikk galt. Prøv igjen.')
      setArbeider(false)
    }
  }

  return (
    <form className="skjema" onSubmit={(hendelse) => void send(hendelse)}>
      <p className="skjema__ingress">
        Velkommen. Før du kommer inn i OUSFAR må du velge ditt eget passord og fylle ut navnet
        ditt. Det midlertidige passordet slutter å virke med det samme.
      </p>

      <Lastfelt
        merkelapp="Brukernavn"
        verdi={profil.username}
        hjelp="Brukernavnet er fast og kan ikke endres."
      />

      <div className="skjema__rad">
        <Felt
          merkelapp="Fornavn"
          autoComplete="given-name"
          // Første felt som skal fylles ut.
          autoFocus
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

      <div className="skjema__bolk">
        <span className="skjema__bolktittel">Profilbilde (valgfritt)</span>
        <Bildevelgerlast
          visning={<Avatar profil={profil} lenke={forhandsvisning} storrelse="stor" />}
          onValgt={setBilde}
        />
      </div>

      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}

      <div className="skjema__knapper">
        <Button type="submit" disabled={arbeider}>
          {arbeider ? 'Lagrer …' : 'Lagre og åpne OUSFAR'}
        </Button>
        <Button variant="subtle" onClick={() => void loggUt()}>
          Logg ut
        </Button>
      </div>
    </form>
  )
}
