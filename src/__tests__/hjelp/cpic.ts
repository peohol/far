/**
 * CPIC-radene testene bygger på, i formen appen leser dem.
 */
import { lesDiplotypegrunnlag, TOM_CPICKILDE, type Diplotypegrunnlag } from '../../cpic/lesing'
import { lesAllel, lesDiplotype, lesGen, lesGenresultat, lesGenresultatoppslag, type Lest } from '../../cpic/modell'

export type Rad = Record<string, unknown>

export function alle<T>(rader: Rad[], lesRad: (r: Rad) => Lest<T> | null): T[] {
  return rader.flatMap((r) => lesRad(r)?.data ?? [])
}

/**
 * Grunnlaget for ett gen i formen `les_cpic_diplotyper` gir, bygd av de
 * samme radene som synkroniseringen leser. At funksjonen gir det samme, er
 * testet mot databasen i `cpic.test.ts`.
 */
export function diplotypegrunnlagFra(rader: Record<string, Rad[]>, symbol: string): Diplotypegrunnlag {
  const genresultater = alle(rader.gene_result!, lesGenresultat).filter((r) => r.gen === symbol)
  const oppslag = alle(rader.gene_result_lookup!, lesGenresultatoppslag).filter((o) =>
    genresultater.some((r) => r.id === o.genresultat_id),
  )
  const diplotyper = alle(rader.gene_result_diplotype!, lesDiplotype)
  return lesDiplotypegrunnlag({
    kilde: TOM_CPICKILDE,
    gen: alle(rader.gene!, lesGen).find((g) => g.symbol === symbol) ?? null,
    genresultater,
    oppslag: oppslag.map((o) => ({
      ...o,
      diplotyper: diplotyper
        .filter((d) => d.oppslag_id === o.id)
        .map((d) => d.diplotype)
        .sort(),
    })),
    alleler: alle(rader.allele!, lesAllel)
      .filter((a) => a.gen === symbol)
      .map(({ navn, funksjon, klinisk_funksjon, aktivitetsverdi }) => ({ navn, funksjon, klinisk_funksjon, aktivitetsverdi })),
  })
}
