/**
 * Synkroniseringen av laboratorieanalysene fra Farmakologiportalen: hver natt
 * fra GitHub Actions (`.github/workflows/farmakologiportalen-synk.yml`), og
 * når en administrator ber om det. Logikken står i
 * `src/farmakologiportalen/endepunkt.ts`.
 */
import { behandleFpSynk } from '../src/farmakologiportalen/endepunkt.js'

export function GET(request: Request): Promise<Response> {
  return behandleFpSynk(request, process.env)
}

export function POST(request: Request): Promise<Response> {
  return behandleFpSynk(request, process.env)
}
