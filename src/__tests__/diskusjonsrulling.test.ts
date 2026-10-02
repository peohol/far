// @vitest-environment jsdom
/**
 * Rullingen når man drar mot kanten av diskusjonsmenyen: dnd-kit ruller også
 * siden bak en meny som står fast, og den skal stå i ro. Selve dra-og-slipp
 * prøves ikke her (se `useSortering`).
 */
import { describe, expect, it } from 'vitest'
import { holdRullingenInne } from '../hooks/useSortering'

describe('rullingen i menyen', () => {
  it('ruller menyens egne flater, men aldri siden', () => {
    const liste = document.createElement('div')
    const side = document.documentElement
    const rulling = { getScrollableElements: (): Set<Element> | null => new Set([liste, side]) }
    holdRullingenInne(rulling)
    expect([...rulling.getScrollableElements()!]).toEqual([liste])
  })

  it('lar det være når dnd-kit ikke har noe å rulle', () => {
    const rulling = { getScrollableElements: (): Set<Element> | null => null }
    holdRullingenInne(rulling)
    expect(rulling.getScrollableElements()).toBeNull()
  })
})
