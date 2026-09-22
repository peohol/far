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
import { maaGjennomOppsett, tilgangFor } from '../tilgang'

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

describe('tilgangFor', () => {
  it('venter mens økten avklares, så appen ikke blinker fram', () => {
    expect(tilgangFor({ klar: false, harOkt: false, profil: null })).toBe('venter')
    expect(tilgangFor({ klar: false, harOkt: true, profil: profil() })).toBe('venter')
  })

  it('krever innlogging uten økt', () => {
    expect(tilgangFor({ klar: true, harOkt: false, profil: null })).toBe('innlogging')
  })

  it('slipper en ferdig bruker inn i appen', () => {
    expect(tilgangFor({ klar: true, harOkt: true, profil: profil() })).toBe('app')
  })

  it('sender en ny bruker til førstegangsoppsettet', () => {
    const ny = profil({ must_change_password: true, onboarding_completed: false })
    expect(tilgangFor({ klar: true, harOkt: true, profil: ny })).toBe('oppsett')
  })

  it('holder brukeren i oppsettet så lenge passordet må byttes', () => {
    const tilbakestilt = profil({ must_change_password: true, onboarding_completed: true })
    expect(tilgangFor({ klar: true, harOkt: true, profil: tilbakestilt })).toBe('oppsett')
  })

  it('holder brukeren i oppsettet når det aldri ble fullført', () => {
    const halvveis = profil({ must_change_password: false, onboarding_completed: false })
    expect(tilgangFor({ klar: true, harOkt: true, profil: halvveis })).toBe('oppsett')
  })

  it('viser ikke appen når økten står, men profilen mangler', () => {
    expect(tilgangFor({ klar: true, harOkt: true, profil: null })).toBe('venter')
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
