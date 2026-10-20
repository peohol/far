/**
 * Feilene fra databasen slik appen viser dem (`src/auth/databasefeil.ts`): de
 * norske meldingene som de er, og en uventet feil med databasens kode og
 * melding etter den generelle, så den kan meldes videre.
 */
import { describe, expect, it } from 'vitest'
import { lesbarFeil, UVENTET_FEIL, uventetFeil } from '../auth/databasefeil'

describe('feilene fra databasen', () => {
  it('viser databasens norske meldinger som de er', () => {
    expect(lesbarFeil({ code: '22023', message: 'Fagsiden ligger ikke i papirkurven.' }).message).toBe(
      'Fagsiden ligger ikke i papirkurven.',
    )
  })

  it('gir en uventet feil den generelle meldingen med koden og databasens melding etter', () => {
    const feil = { code: '57014', message: 'canceling statement due to statement timeout' }
    expect(lesbarFeil(feil).message).toBe(`${UVENTET_FEIL} Teknisk feil: 57014 canceling statement due to statement timeout`)
  })

  it('gir bare den generelle meldingen når databasen ikke sa noe, og korter ned en lang melding', () => {
    expect(uventetFeil({})).toBe(UVENTET_FEIL)
    expect(uventetFeil({ message: '   ' })).toBe(UVENTET_FEIL)
    expect(uventetFeil({ code: 'XX000', message: 'x'.repeat(1000) }).length).toBe(`${UVENTET_FEIL} Teknisk feil: `.length + 300)
  })

  it('beholder meldingene for brudd på unike indekser og regler i tabellene', () => {
    expect(lesbarFeil({ code: '23505', message: 'duplicate key value violates unique constraint "navn_idx"' }, { navn_idx: 'Navnet er tatt.' }).message).toBe(
      'Navnet er tatt.',
    )
    expect(lesbarFeil({ code: '23514', message: 'new row violates check constraint' }).message).toMatch(/^Det som ble skrevet/)
  })
})
