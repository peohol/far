import type { Utdrag } from '../../faginnhold/sok'

/** Teksten med treffene fra søket i `<mark>`. */
export function Markert({ tekst, treff }: Utdrag) {
  const deler: React.ReactNode[] = []
  let fra = 0
  for (const [start, slutt] of treff) {
    if (start > fra) deler.push(tekst.slice(fra, start))
    deler.push(
      <mark key={start} className="sokemerke">
        {tekst.slice(start, slutt)}
      </mark>,
    )
    fra = slutt
  }
  if (fra < tekst.length) deler.push(tekst.slice(fra))
  return <>{deler}</>
}
