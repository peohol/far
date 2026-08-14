import { describe, expect, it } from 'vitest'
import { feltetTarTegnene, fokustype, mellomromErLedig, type Fokusert } from '../tastatur'

const felt = (type: string, ekstra: Partial<Fokusert> = {}): Fokusert => ({
  tag: 'INPUT',
  type,
  ...ekstra,
})

describe('hva mellomrom lander på', () => {
  it('lar mellomrom bekrefte når ingenting har fokus', () => {
    expect(mellomromErLedig(null)).toBe(true)
    expect(mellomromErLedig({ tag: 'BODY' })).toBe(true)
  })

  it('holder mellomrom unna avkryssinger og radioknapper', () => {
    // Dette er den viktige: avkryssingene i modulene tas med Tab og
    // mellomrom, og den flyten skal ikke bli overtatt av bekreftelsen.
    expect(fokustype(felt('checkbox'))).toBe('veksling')
    expect(fokustype(felt('radio'))).toBe('veksling')
    expect(mellomromErLedig(felt('checkbox'))).toBe(false)
    expect(mellomromErLedig(felt('radio'))).toBe(false)
  })

  it('holder mellomrom unna knapper, lister og sammendrag', () => {
    for (const tag of ['BUTTON', 'SELECT', 'SUMMARY', 'A']) {
      expect(mellomromErLedig({ tag })).toBe(false)
    }
    expect(mellomromErLedig(felt('submit'))).toBe(false)
  })

  it('holder mellomrom unna tekst, så det blir et mellomrom i teksten', () => {
    expect(mellomromErLedig(felt('text'))).toBe(false)
    expect(mellomromErLedig(felt('search'))).toBe(false)
    expect(mellomromErLedig({ tag: 'TEXTAREA' })).toBe(false)
    expect(mellomromErLedig({ tag: 'DIV', redigerbart: true })).toBe(false)
    // Et felt uten oppgitt type er et tekstfelt, slik nettleseren leser det.
    expect(mellomromErLedig({ tag: 'INPUT' })).toBe(false)
  })

  it('lar mellomrom bekrefte i et konsentrasjonsfelt', () => {
    // Feltet tar bare tall, så mellomrom blir ikke stående som noe tegn og er
    // ledig til å kopiere kommentaren.
    expect(fokustype(felt('text', { tallfelt: true }))).toBe('tall')
    expect(mellomromErLedig(felt('text', { tallfelt: true }))).toBe(true)
    expect(mellomromErLedig(felt('number'))).toBe(true)
  })

  it('lar mellomrom bekrefte i dato- og skalafelt', () => {
    // Verken datoene i THC-modulen eller sikkerhetsmarginen tar imot et
    // mellomrom, og da skal tasten gjøre det samme som Enter der også.
    expect(mellomromErLedig(felt('date'))).toBe(true)
    expect(mellomromErLedig(felt('range'))).toBe(true)
  })

  it('leser store og små bokstaver likt', () => {
    expect(mellomromErLedig({ tag: 'button' })).toBe(false)
    expect(mellomromErLedig(felt('CHECKBOX'))).toBe(false)
  })
})

describe('hvor tegnene brukeren taster hører hjemme', () => {
  it('lar tallene skrives inn i felt som tar dem imot', () => {
    expect(feltetTarTegnene(felt('text', { tallfelt: true }))).toBe(true)
    expect(feltetTarTegnene(felt('text'))).toBe(true)
    expect(feltetTarTegnene({ tag: 'TEXTAREA' })).toBe(true)
  })

  it('lar tallene være hurtigtaster ellers', () => {
    // Tallene huker av analyttene i rusmiddelmodulen — men ikke mens et
    // konsentrasjonsfelt står fokusert.
    expect(feltetTarTegnene(null)).toBe(false)
    expect(feltetTarTegnene(felt('checkbox'))).toBe(false)
    expect(feltetTarTegnene({ tag: 'BUTTON' })).toBe(false)
  })
})
