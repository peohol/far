import type { Legemiddelutvalg } from '../../legemiddeldata/lesing'

const DATO = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

function dato(tidspunkt: string | null): string | null {
  if (!tidspunkt) return null
  const d = new Date(tidspunkt)
  return Number.isNaN(d.getTime()) ? null : DATO.format(d)
}

/** Kildelinjen under det som kommer fra FEST: kilden, uttrekket og når kopien sist ble kontrollert. */
export function Festkilde({ utvalg, children }: { utvalg: Legemiddelutvalg; children?: string }) {
  return (
    <p className="preparater__kilde">
      {[
        'Kilde: FEST, Direktoratet for medisinske produkter',
        dato(utvalg.kildedato) && `uttrekk fra ${dato(utvalg.kildedato)}`,
        dato(utvalg.kontrollert_kl) && `sist kontrollert ${dato(utvalg.kontrollert_kl)}`,
      ]
        .filter(Boolean)
        .join(', ')}
      .{children && ` ${children}`}
    </p>
  )
}
