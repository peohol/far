/**
 * Én kurateringsstatus per fagside (`src/kuratering/sidestatus.ts`), som både
 * kurateringsmenyen og fanen «Kurateringer» i stoffregisteret bygger på.
 * Innholdet er syntetisk.
 */
import { describe, expect, it } from 'vitest'
import { perFagside, sidekuratering, type Kurateringsrad } from '../kuratering/sidestatus'

const rad = (overstyr: Partial<Kurateringsrad>): Kurateringsrad => ({
  stoff: 'alfa',
  art: 'kuratering',
  status: 'publisert',
  opprettet_kl: '2026-10-01T08:00:00Z',
  ...overstyr,
})

describe('statusen til en fagside', () => {
  it('er kurateringen som pågår, også når siden er kuratert før', () => {
    const forste = rad({ publisert_kl: '2026-10-02T08:00:00Z' })
    const aktiv = rad({ status: 'klar', opprettet_kl: '2026-10-05T08:00:00Z' })
    const side = sidekuratering([forste, aktiv])!
    expect(side).toMatchObject({ fase: 'pagaar', aktiv, publisert: forste, gjeldende: aktiv, tidligere: [forste], kl: aktiv.opprettet_kl })
  })

  it('er den sist publiserte når ingen pågår, og teller alle publiseringene', () => {
    const forste = rad({ publisert_kl: '2026-10-02T08:00:00Z' })
    const andre = rad({ art: 'de_novo', opprettet_kl: '2026-10-03T08:00:00Z', publisert_kl: '2026-10-04T08:00:00Z' })
    const side = sidekuratering([andre, forste])!
    expect(side).toMatchObject({ fase: 'kuratert', publisert: andre, gjeldende: andre, antallPublisert: 2, kl: andre.publisert_kl })
    expect(side.tidligere).toEqual([forste])
  })

  it('er fortsatt kuratert når en senere kuratering er forkastet', () => {
    const publisert = rad({ publisert_kl: '2026-10-02T08:00:00Z' })
    const forkastet = rad({ status: 'arkivert', opprettet_kl: '2026-10-05T08:00:00Z', status_kl: '2026-10-06T08:00:00Z' })
    expect(sidekuratering([publisert, forkastet])).toMatchObject({ fase: 'kuratert', gjeldende: publisert, tidligere: [forkastet] })
  })

  it('er ikke kuratert med bare en forkastet kuratering, eller en publisert gjenoppretting', () => {
    const forkastet = rad({ status: 'arkivert', status_kl: '2026-10-02T08:00:00Z' })
    expect(sidekuratering([forkastet])).toMatchObject({ fase: 'ikke_kuratert', gjeldende: forkastet, kl: '' })
    const gjenoppretting = rad({ art: 'gjenoppretting', publisert_kl: '2026-10-02T08:00:00Z' })
    expect(sidekuratering([gjenoppretting])).toMatchObject({ fase: 'ikke_kuratert', publisert: null, antallPublisert: 0 })
  })

  it('pågår mens en gjenoppretting er åpen, og er kuratert av det som er publisert før', () => {
    const publisert = rad({ publisert_kl: '2026-10-02T08:00:00Z' })
    const gjenoppretting = rad({ art: 'gjenoppretting', status: 'arbeid', opprettet_kl: '2026-10-03T08:00:00Z' })
    expect(sidekuratering([publisert, gjenoppretting])).toMatchObject({ fase: 'pagaar', aktiv: gjenoppretting, publisert })
  })

  it('samler kurateringene per side', () => {
    const sider = perFagside([rad({ publisert_kl: '2026-10-02T08:00:00Z' }), rad({ stoff: 'beta', status: 'arbeid' })])
    expect([...sider.keys()]).toEqual(['alfa', 'beta'])
    expect(sider.get('beta')?.fase).toBe('pagaar')
    expect(sidekuratering([])).toBeNull()
  })
})
