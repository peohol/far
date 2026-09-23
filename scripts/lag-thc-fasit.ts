/**
 * Lager fasiten for THC-syremodulen på nytt: `npx vite-node scripts/lag-thc-fasit.ts`.
 *
 * Kjøres bare når den kliniske outputen endres med vilje — fasiten er det som
 * beskytter den. Se `src/domain/__tests__/hjelp/thcFasit.ts`.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  fortolkThc,
  forventetEndring,
  korreksjonsfaktor,
  KURVE_GRONN,
  KURVE_GUL,
  KURVE_ROD,
  beregnIrcak,
  lesTall,
  dagerMellom,
  USIKKERHET_UNDER_CUTOFF,
  type Sikkerhetsmargin,
} from '../src/domain/thc'
import { byggGraf } from '../src/domain/thcPlot'
import {
  fasitSomTekst,
  fasittilfeller,
  lagFasit,
  type FasitInndata,
  type FasitUtfall,
} from '../src/domain/__tests__/hjelp/thcFasit'

function kurvetreff(inn: FasitInndata): number[] {
  const forrige = inn.forrigeUnderCutoff ? beregnIrcak(inn.forrigeUcak, inn.forrigeNkre) : lesTall(inn.forrigeVerdi)
  if (!forrige) return []
  const dager = dagerMellom(inn.forrigeDato, inn.aktuellDato)
  const faktor = korreksjonsfaktor(
    inn.sikkerhetsmargin as Sikkerhetsmargin,
    inn.forrigeUnderCutoff ? USIKKERHET_UNDER_CUTOFF : 1,
  )
  return [KURVE_GRONN, KURVE_GUL, KURVE_ROD].map(
    (k) => ((1 + forventetEndring(forrige, dager, k)) * forrige) / faktor,
  )
}

function utfall(inn: FasitInndata): FasitUtfall {
  const r = fortolkThc({ ...inn, sikkerhetsmargin: inn.sikkerhetsmargin as Sikkerhetsmargin })
  if (r.type === 'mangler') return r
  return {
    type: 'kommentar',
    kommentar: r.kommentar,
    konklusjon: inn.ingenTidligere
      ? 'uten_forrige'
      : r.kategori >= 4
        ? 'nytt_inntak'
        : r.kategori === 3
          ? 'vanskelig'
          : 'ikke_nodvendigvis',
    langtMellomProvene: r.merEnn30Dager,
    grunnlag: r.grunnlag,
  }
}

const inndata = fasittilfeller(kurvetreff)
const fasit = lagFasit(inndata, inndata.map(utfall), byggGraf)
const fil = fileURLToPath(new URL('../src/domain/__tests__/fasit/thc-fasit.json', import.meta.url))
writeFileSync(fil, fasitSomTekst(fasit))
console.log(`${fasit.tilfeller.length} tilfeller, ${fasit.kommentarer.length} ulike kommentarer`)
