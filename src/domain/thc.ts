import type { Analyte } from '../types'

/**
 * THC-syre i urin som oppføring i appen: koden, analysemetoden og
 * søkeoppføringen. Fortolkningen står i `thcMotor.ts` og leser reglene og
 * tekstene som er publisert i databasen (`docs/thc-syre.md`).
 */

export const THC_KODE = 'IRCAK'

/**
 * Analysemetoden IRCAK rekvireres under. Modulen er hele metoden: IRCAK er
 * den eneste analytten i den, og den har ingen underkategorier.
 */
export const THC_ANALYSEMETODE = 'UCAK'

/**
 * THC-syre som søkbar oppføring i det vanlige analyttsøket. Velges den, går
 * appen til fortolkningsmodulen i stedet for til konsentrasjonsbåndene, så
 * feltene som bare gjelder båndene står tomme.
 */
export const THC_ANALYTT: Analyte = {
  kode: THC_KODE,
  navn: 'THC-syre',
  visningsnavn: 'THC-syre i urin',
  komponenter: [],
  gruppe: 'Rusmiddelanalyse',
  analysemetode: THC_ANALYSEMETODE,
  kategori: '',
  enhet: '',
  maleomrade: { tekst: '', deler: [] },
  aliaser: ['THC-COOH', 'cannabis'],
}

export function erThcAnalytt(analyte: Analyte): boolean {
  return analyte.kode === THC_KODE
}
