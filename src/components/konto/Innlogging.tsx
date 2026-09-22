import { useState, type FormEvent } from 'react'
import { KONFIGURASJON_MANGLER } from '../../auth/klient'
import { useOkt } from '../../auth/okt'
import { Button } from '../Button'
import { Felt } from './Felt'

/**
 * Innloggingssiden.
 *
 * Bare brukernavn og passord. Det finnes ingen registrering og ingen
 * e-postflyt, så siden har heller ingen veier ut til slikt. Feilmeldingen er
 * den samme uansett hva som var galt — se `INNLOGGING_FEILET`.
 */
export function Innlogging() {
  const { loggInn, mangler } = useOkt()
  const [brukernavn, setBrukernavn] = useState('')
  const [passord, setPassord] = useState('')
  const [feil, setFeil] = useState<string | null>(null)
  const [arbeider, setArbeider] = useState(false)

  const send = async (hendelse: FormEvent) => {
    hendelse.preventDefault()
    if (arbeider) return
    setArbeider(true)
    setFeil(null)
    try {
      setFeil(await loggInn(brukernavn, passord))
    } catch {
      setFeil('Fikk ikke kontakt med brukerdatabasen. Prøv igjen.')
    } finally {
      setArbeider(false)
    }
  }

  if (mangler) {
    return (
      <p className="skjemafeil" role="alert">
        {KONFIGURASJON_MANGLER}
      </p>
    )
  }

  return (
    <form className="skjema" onSubmit={(hendelse) => void send(hendelse)}>
      <Felt
        merkelapp="Brukernavn"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        // Markøren skal stå i feltet med én gang; siden har ingenting annet.
        autoFocus
        value={brukernavn}
        onChange={(hendelse) => setBrukernavn(hendelse.target.value)}
      />
      <Felt
        merkelapp="Passord"
        type="password"
        name="password"
        autoComplete="current-password"
        value={passord}
        onChange={(hendelse) => setPassord(hendelse.target.value)}
      />

      {feil && (
        <p className="skjemafeil" role="alert">
          {feil}
        </p>
      )}

      <Button type="submit" disabled={arbeider}>
        {arbeider ? 'Logger inn …' : 'Logg inn'}
      </Button>
    </form>
  )
}
