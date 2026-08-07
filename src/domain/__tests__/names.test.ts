import { describe, expect, it } from 'vitest'
import { analytes, findByCode } from '../analytes'
import { displayName, splitName } from '../names'
import type { Analyte } from '../../types'

function analyte(kode: string): Analyte {
  const funn = findByCode(kode)
  if (!funn) throw new Error(`Fant ikke ${kode} i datasettet`)
  return funn
}

describe('displayName', () => {
  it('fjerner «Sum: » foran sumanalysene', () => {
    expect(displayName(analyte('KARSUM'))).toBe(
      'Kariprazin + desmetylkariprazin + didesmetylkariprazin',
    )
    expect(displayName(analyte('AMTNORSUM'))).toBe('Amitriptylin + nortriptylin')
  })

  it('lar andre visningsnavn stå urørt', () => {
    expect(displayName(analyte('KVE'))).toBe('Kvetiapin')
    expect(displayName(analyte('PALI'))).toBe('Paliperidon (hydroksyrisperidon)')
    expect(displayName(analyte('HBUP'))).toBe('Hydroksybupropion (kun aktiv metabolitt)')
  })

  it('etterlater ingen «Sum» i datasettet', () => {
    for (const a of analytes) {
      expect(displayName(a).toLowerCase()).not.toContain('sum:')
    }
  })
})

describe('splitName', () => {
  it('skiller moderstoff fra metabolitter', () => {
    expect(splitName(analyte('KARSUM'))).toEqual({
      moderstoff: 'Kariprazin',
      metabolitter: ['desmetylkariprazin', 'didesmetylkariprazin'],
    })
  })

  it('gir enkeltanalytter hele navnet og ingen metabolitter', () => {
    expect(splitName(analyte('KVE'))).toEqual({ moderstoff: 'Kvetiapin', metabolitter: [] })
  })

  it('beholder skrivemåten fra kilden', () => {
    // «O-desmetylvenlafaksin» har stor O midt i et navn som ellers står med
    // liten forbokstav, og skal ikke normaliseres.
    expect(splitName(analyte('VENSUM')).metabolitter).toEqual(['O-desmetylvenlafaksin'])
  })

  it('setter alltid moderstoffet først i navnet', () => {
    for (const a of analytes) {
      const { moderstoff, metabolitter } = splitName(a)
      expect(a.navn.startsWith(moderstoff)).toBe(true)
      expect(moderstoff).not.toBe('')
      expect([moderstoff, ...metabolitter]).toHaveLength(a.komponenter.length)
    }
  })
})
