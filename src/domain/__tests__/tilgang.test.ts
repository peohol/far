/**
 * Portvakten foran appen.
 *
 * Reglene her avgjør om den kliniske appen i det hele tatt tegnes opp, og de
 * er lette å ødelegge uten å merke det: en bruker som slipper forbi
 * passordbyttet, eller en innloggingsside som blinker fram for én som
 * allerede er inne.
 */
import { describe, expect, it } from 'vitest'
import type { Profil } from '@delt/profil'
import { maaGjennomOppsett, tilgangFor, type Oktstatus } from '../tilgang'

function profil(endringer: Partial<Profil> = {}): Profil {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    username: 'ola.nordmann',
    first_name: 'Ola',
    last_name: 'Nordmann',
    role: 'user',
    avatar_path: null,
    must_change_password: false,
    onboarding_completed: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...endringer,
  }
}

/** Oktstatus der bare det som prøves ut, skrives ned. */
function status(endringer: Partial<Oktstatus>): Oktstatus {
  return { klar: true, harOkt: true, profil: profil(), profilfeil: false, ...endringer }
}

describe('tilgangFor', () => {
  it('venter mens økten avklares, så appen ikke blinker fram', () => {
    expect(tilgangFor(status({ klar: false, harOkt: false, profil: null }))).toBe('venter')
    expect(tilgangFor(status({ klar: false }))).toBe('venter')
  })

  it('krever innlogging uten økt', () => {
    expect(tilgangFor(status({ harOkt: false, profil: null }))).toBe('innlogging')
  })

  it('slipper en ferdig bruker inn i appen', () => {
    expect(tilgangFor(status({}))).toBe('app')
  })

  it('sender en ny bruker til førstegangsoppsettet', () => {
    const ny = profil({ must_change_password: true, onboarding_completed: false })
    expect(tilgangFor(status({ profil: ny }))).toBe('oppsett')
  })

  it('holder brukeren i oppsettet så lenge passordet må byttes', () => {
    const tilbakestilt = profil({ must_change_password: true, onboarding_completed: true })
    expect(tilgangFor(status({ profil: tilbakestilt }))).toBe('oppsett')
  })

  it('holder brukeren i oppsettet når det aldri ble fullført', () => {
    const halvveis = profil({ must_change_password: false, onboarding_completed: false })
    expect(tilgangFor(status({ profil: halvveis }))).toBe('oppsett')
  })

  it('viser ikke appen når økten står, men profilen ikke er hentet ennå', () => {
    expect(tilgangFor(status({ profil: null }))).toBe('venter')
  })

  it('sier fra når profilen ikke lot seg hente, i stedet for å vente evig', () => {
    // Uten dette skillet ville en kortvarig nettfeil etterlatt brukeren på en
    // tom skjerm: oppslaget prøves ikke om igjen av seg selv.
    expect(tilgangFor(status({ profil: null, profilfeil: true }))).toBe('feil')
  })

  it('lar en feil gå foran en profil som ligger igjen fra før', () => {
    expect(tilgangFor(status({ profilfeil: true }))).toBe('feil')
  })

  it('krever innlogging framfor å melde feil når økten er borte', () => {
    expect(tilgangFor(status({ harOkt: false, profil: null, profilfeil: true }))).toBe(
      'innlogging',
    )
  })
})

describe('maaGjennomOppsett', () => {
  it('er av for en ferdig konto', () => {
    expect(maaGjennomOppsett(profil())).toBe(false)
  })

  it('slår til på hvert av de to flaggene hver for seg', () => {
    expect(maaGjennomOppsett(profil({ must_change_password: true }))).toBe(true)
    expect(maaGjennomOppsett(profil({ onboarding_completed: false }))).toBe(true)
  })
})
