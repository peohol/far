import type { ReactNode } from 'react'
import type { Tekstdel } from '../faginnhold/mekanismer'
import { treffIntervaller } from '../faginnhold/sok'
import { TREFFKLASSE, useSokeord } from './Uthev'

/**
 * En tekst i deler, med de senkede som `<sub>` og søketreffene fremhevet.
 *
 * Treffene finnes i hele teksten før den deles, så et søk på «D2» eller
 * «5-HT2C» treffer også når subtypen står senket. Et treff over en grense
 * blir ett merke rundt begge delene: `<mark>D<sub>2</sub></mark>`.
 */
export function SenketTekst({ deler }: { deler: readonly Tekstdel[] }) {
  const ord = useSokeord()
  const tekst = deler.map((d) => d.tekst).join('')
  const treff = treffIntervaller(tekst, ord)

  // Delene mellom `fra` og `til`, som tekst eller `<sub>`.
  const bit = (fra: number, til: number): ReactNode[] => {
    const ut: ReactNode[] = []
    let start = 0
    for (const del of deler) {
      const slutt = start + del.tekst.length
      const a = Math.max(fra, start)
      const b = Math.min(til, slutt)
      if (a < b) {
        const t = del.tekst.slice(a - start, b - start)
        ut.push(del.senket ? <sub key={a}>{t}</sub> : t)
      }
      start = slutt
    }
    return ut
  }

  const ut: ReactNode[] = []
  let forrige = 0
  for (const [start, slutt] of treff) {
    if (start > forrige) ut.push(...bit(forrige, start))
    ut.push(
      <mark key={`treff-${start}`} className={TREFFKLASSE}>
        {bit(start, slutt)}
      </mark>,
    )
    forrige = slutt
  }
  ut.push(...bit(forrige, tekst.length))
  return <>{ut}</>
}
