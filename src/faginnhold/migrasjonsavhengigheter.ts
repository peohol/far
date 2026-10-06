/**
 * Hva migrasjonskontrollen i CI og utrullingen til produksjonen avhenger av, og
 * om en PR berører noe av det (`docs/migrasjoner.md`). CI hopper over
 * migrasjonskontrollen når den ikke gjør det; testene og bygget kjører alltid.
 *
 * `src/__tests__/migrasjonsavhengigheter.test.ts` holder lista i takt med koden:
 * alt arbeidsflytene kjører, og alt det importerer, må stå her, og alt
 * utrullingen starter på (`on.push.paths` i `produksjonsmigrering.yml`) likeså.
 */

/** Filer, og mapper med alt under seg (`<mappe>/**`). */
export const AVHENGIGHETER: readonly string[] = [
  'supabase/migrations/**',
  // Leses av Supabase-CLI-en når utrullingen lenker prosjektet og kjører `db push`.
  'supabase/config.toml',
  '.github/workflows/ci.yml',
  '.github/workflows/produksjonsmigrering.yml',
  'scripts/kontroller-migrasjoner.ts',
  'scripts/produksjonsmigrering.ts',
  'scripts/migrasjonsmappe.ts',
  'scripts/berorer-migrasjoner.ts',
  'src/faginnhold/migrasjonshistorikk.ts',
  'src/faginnhold/sqlsetninger.ts',
  'src/faginnhold/migrasjonsavhengigheter.ts',
]

/**
 * Delene av pakkefilene skriptene avhenger av: kommandoene og versjonene av
 * Supabase-CLI-en og `vite-node`, som kjører dem. Resten av filene, som
 * appens versjonsnummer, endres i nesten hver PR og gjelder ikke migrasjonene.
 */
export const PAKKEDELER: Readonly<Record<string, readonly (readonly string[])[]>> = {
  'package.json': [
    ['scripts', 'kontroller:migrasjoner'],
    ['scripts', 'produksjonsmigrering'],
    ['scripts', 'berorer:migrasjoner'],
  ],
  'package-lock.json': [
    ['packages', 'node_modules/supabase'],
    ['packages', 'node_modules/vite-node'],
  ],
}

/** Om fila er en av avhengighetene (eller ligger i en av mappene). */
export function erAvhengighet(fil: string, avhengigheter = AVHENGIGHETER): boolean {
  return avhengigheter.some((a) => (a.endsWith('/**') ? fil.startsWith(a.slice(0, -2)) : fil === a))
}

/** Verdien på stien i JSON-teksten; `undefined` når fila mangler, og teksten selv når den ikke kan leses som JSON. */
function del(tekst: string | undefined, sti: readonly string[]): unknown {
  if (tekst === undefined) return undefined
  try {
    return sti.reduce<unknown>((v, n) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[n] : undefined), JSON.parse(tekst))
  } catch {
    return tekst
  }
}

/**
 * Hvorfor endringene berører migrasjonene: én linje per avhengighet som er
 * endret, og ingen når de ikke gjør det. `les` gir fila slik den står før
 * (`'før'`) og etter (`'etter'`) endringene, eller `undefined` når den ikke finnes.
 */
export function berorteAvhengigheter(
  endrede: readonly string[],
  les: (hvor: 'før' | 'etter', fil: string) => string | undefined,
  avhengigheter = AVHENGIGHETER,
  pakkedeler = PAKKEDELER,
): string[] {
  return endrede.flatMap((fil) => {
    if (erAvhengighet(fil, avhengigheter)) return [fil]
    const stier = pakkedeler[fil]
    if (!stier) return []
    const [foer, etter] = [les('før', fil), les('etter', fil)]
    return stier
      .filter((sti) => JSON.stringify(del(foer, sti)) !== JSON.stringify(del(etter, sti)))
      .map((sti) => `${fil}: ${sti.join(' → ')}`)
  })
}
