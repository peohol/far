import { IKONER, type Ikonnavn } from '../ikon/register'

/**
 * Ikonet en kategori i stoffregisteret får: navnet i `ikon` når det finnes i
 * ikonregisteret, ellers ingen. Kategorien står da med navnet alene.
 */
export function kategoriikon(kategori: { ikon: string | null }): Ikonnavn | undefined {
  return kategori.ikon && kategori.ikon in IKONER ? (kategori.ikon as Ikonnavn) : undefined
}
