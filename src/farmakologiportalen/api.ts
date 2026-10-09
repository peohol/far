/**
 * Kallene mot Farmakologiportalen (`docs/farmakologiportalen.md`).
 *
 * Portalen er en WordPress-side; tabellene den viser, hentes av sidene selv
 * fra et JSON-API (`https://api.farmakologiportalen.no/api`) med en offentlig
 * nøkkel som står i portalens egne skript og sendes fra hver besøkendes
 * nettleser. OUSFAR bruker det samme API-et, ikke HTML-sidene, og henter hver
 * type som én liste: seks kall per synkronisering, ett om gangen med god
 * avstand.
 *
 * Portalen stenger for de fleste servere (Cloudflare); kallene går fra
 * OUSFARs server i Stockholm (Vercel, `arn1`), med tillatelse fra fagansvarlig
 * 8. oktober 2026.
 */
import { lagHofligHenting, type Hoflighetsvalg } from '../server/hofligHenting.js'

export const FP_API = 'https://api.farmakologiportalen.no/api'
export const FP_NETTSTED = 'https://farmakologiportalen.no'

/**
 * Den offentlige nøkkelen portalens sider bruker mot API-et
 * (`assets/components/component_single.js`). Ingen hemmelighet: den står i
 * hver side portalen serverer. Endrer portalen den, svarer API-et 401, og
 * synkroniseringen feiler uten å endre noe.
 */
export const FP_NOKKEL = '7a2211fa-1de4-4bab-abe3-4953be4ac285'

/** Minste tid mellom to kall: portalen har ingen oppgitt grense, så det er god margin. */
export const MINSTE_AVSTAND_MS = 2000

export const BRUKERAGENT = 'OUSFAR-datasynk/1.0 (+https://github.com/peohol/far)'

/** Adressen til en analyse, et laboratorium eller en komponent i portalen. */
export const fpUrl = {
  analyse: (id: string) => `${FP_NETTSTED}/analysis/?id=${encodeURIComponent(id)}`,
  laboratorium: (id: string) => `${FP_NETTSTED}/lab/?id=${encodeURIComponent(id)}`,
  komponent: (id: string) => `${FP_NETTSTED}/component/?id=${encodeURIComponent(id)}`,
}

export class FpFeil extends Error {
  constructor(
    melding: string,
    readonly status: number | null = null,
  ) {
    super(melding)
    this.name = 'FpFeil'
  }
}

export interface FpApi {
  /** Hele listen for en type, slik portalen ga den. */
  liste(sti: string): Promise<unknown[]>
}

export function lagFpApi(valg: Partial<Hoflighetsvalg> = {}): FpApi {
  const hent = lagHofligHenting({
    avstand: MINSTE_AVSTAND_MS,
    tidsgrense: 60_000,
    ...valg,
    hoder: { accept: 'application/json', 'user-agent': BRUKERAGENT, 'x-api-key': FP_NOKKEL, ...valg.hoder },
  })
  return {
    liste: async (sti) => {
      const res = await hent(`${FP_API}${sti}`)
      if (!res.ok) throw new FpFeil(`Farmakologiportalen svarte ${res.status} for ${sti}`, res.status)
      const svar = (await res.json().catch(() => {
        throw new FpFeil(`Farmakologiportalen ga ikke JSON for ${sti}`)
      })) as unknown
      if (!Array.isArray(svar)) throw new FpFeil(`Farmakologiportalen ga ikke en liste for ${sti}`)
      return svar
    },
  }
}
