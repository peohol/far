/**
 * Profilfeltene.
 *
 * Navnene vises ved siden av profilbildet overalt i appen, og stien til
 * bildet er det Storage-policyene måler mot: den må være brukerens egen
 * mappe, ellers slipper ikke opplastingen gjennom.
 */
import { describe, expect, it } from 'vitest'
import {
  AVATAR_BOTTE,
  AVATAR_STORRELSE,
  avatarSti,
  erRolle,
  initialer,
  NAVN_MEST,
  navnFeil,
  normaliserNavn,
  ROLLER,
  visningsnavn,
} from '@delt/profil'

describe('roller', () => {
  it('har bare de to rollene systemet trenger', () => {
    expect([...ROLLER]).toEqual(['user', 'admin'])
  })

  it('kjenner igjen en rolle, og avviser alt annet', () => {
    expect(erRolle('user')).toBe(true)
    expect(erRolle('admin')).toBe(true)
    expect(erRolle('superadmin')).toBe(false)
    expect(erRolle('Admin')).toBe(false)
    expect(erRolle(null)).toBe(false)
    expect(erRolle(1)).toBe(false)
  })
})

describe('normaliserNavn', () => {
  it('fjerner mellomrom rundt og slår sammen doble', () => {
    expect(normaliserNavn('  Kari   Marie  ')).toBe('Kari Marie')
    expect(normaliserNavn('Nordmann')).toBe('Nordmann')
  })

  it('beholder store bokstaver — navn skrives som de skrives', () => {
    expect(normaliserNavn('Ola-Kristian')).toBe('Ola-Kristian')
  })
})

describe('navnFeil', () => {
  it('krever at feltet er fylt ut, med merkelappen i meldingen', () => {
    expect(navnFeil('', 'Fornavn')).toBe('Fornavn må fylles ut.')
    expect(navnFeil('', 'Etternavn')).toBe('Etternavn må fylles ut.')
  })

  it('godtar et vanlig navn', () => {
    expect(navnFeil('Kari', 'Fornavn')).toBeNull()
  })

  it('setter en øvre lengde, og godtar den akkurat', () => {
    expect(navnFeil('a'.repeat(NAVN_MEST), 'Fornavn')).toBeNull()
    expect(navnFeil('a'.repeat(NAVN_MEST + 1), 'Fornavn')).toContain(`høyst ${NAVN_MEST}`)
  })
})

describe('avatarSti', () => {
  it('legger bildet i brukerens egen mappe', () => {
    const id = '11111111-2222-4333-8444-555555555555'
    expect(avatarSti(id)).toBe(`${id}/avatar.webp`)
    expect(avatarSti(id).split('/')[0]).toBe(id)
  })

  it('gir samme sti hver gang, så et nytt bilde erstatter det gamle', () => {
    const id = '11111111-2222-4333-8444-555555555555'
    expect(avatarSti(id)).toBe(avatarSti(id))
  })

  it('lagrer kvadratisk i bøtta migrasjonen setter opp', () => {
    expect(AVATAR_BOTTE).toBe('avatarer')
    expect(AVATAR_STORRELSE).toBe(512)
  })
})

describe('visningsnavn og initialer', () => {
  const grunnlag = { first_name: 'Kari', last_name: 'Nordmann', username: 'kari.nordmann' }

  it('viser fornavn og etternavn', () => {
    expect(visningsnavn(grunnlag)).toBe('Kari Nordmann')
    expect(initialer(grunnlag)).toBe('KN')
  })

  it('faller tilbake på brukernavnet før navnet er fylt ut', () => {
    const ny = { first_name: '', last_name: '', username: 'kari.nordmann' }
    expect(visningsnavn(ny)).toBe('kari.nordmann')
    expect(initialer(ny)).toBe('K')
  })

  it('takler at bare det ene navnet er fylt ut', () => {
    expect(visningsnavn({ ...grunnlag, last_name: '' })).toBe('Kari')
    expect(initialer({ ...grunnlag, last_name: '' })).toBe('K')
  })
})
