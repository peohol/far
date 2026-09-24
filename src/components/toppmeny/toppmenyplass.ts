/**
 * Hvor langt ned i vinduet den faste toppmenyen rekker, i piksler. Det som
 * rulles fram med kode og ikke med `scroll-margin`, skal legge seg under
 * denne linja. 0 når appen står uten toppmeny.
 */
export function toppmenyensBunn(): number {
  const meny = document.querySelector('[data-toppmeny] nav')
  return meny ? Math.max(0, meny.getBoundingClientRect().bottom) : 0
}
