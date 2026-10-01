/**
 * Lagringen av et valg som kan endres mange ganger raskt (`lagreSisteValg`):
 * lagringene går én og én, og når flere venter, sendes bare det siste, så
 * databasen aldri ender med et eldre valg enn det brukeren ser.
 */
import { describe, expect, it, vi } from 'vitest'

const sendt: unknown[] = []
const ventende: Array<() => void> = []
vi.mock('../auth/klient', () => ({
  klient: () => ({
    from: () => ({
      upsert: ({ verdi }: { verdi: unknown }) =>
        new Promise((ferdig) => {
          sendt.push(verdi)
          ventende.push(() => ferdig({ error: null }))
        }),
    }),
  }),
}))

const { lagreSisteValg } = await import('../auth/innstillinger')

const slippNeste = async () => {
  ventende.shift()?.()
  await new Promise((r) => setTimeout(r, 0))
}

describe('lagreSisteValg', () => {
  it('sender én og én, og hopper over valg som er gått ut før de ble sendt', async () => {
    const lagre = lagreSisteValg<number>('meny.bredde')
    const forste = lagre(500)
    await new Promise((r) => setTimeout(r, 0))
    const andre = lagre(516)
    const tredje = lagre(532)
    await new Promise((r) => setTimeout(r, 0))
    expect(sendt).toEqual([500])
    await slippNeste()
    // 516 ble aldri sendt: 532 kom før det var dens tur.
    expect(sendt).toEqual([500, 532])
    await slippNeste()
    await Promise.all([forste, andre, tredje])
    expect(sendt).toEqual([500, 532])
  })
})
