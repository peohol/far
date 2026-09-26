/**
 * Synkroniseringen av farmakogenetiske data fra ClinPGx: hver uke fra Vercel
 * (`GET`, tidspunktet står i `vercel.json`), og når en administrator ber om det
 * (`POST`). Logikken står i `src/clinpgx/endepunkt.ts`.
 */
import { behandleClinpgxSynk } from '../src/clinpgx/endepunkt.js'

export function GET(request: Request): Promise<Response> {
  return behandleClinpgxSynk(request, process.env)
}

export function POST(request: Request): Promise<Response> {
  return behandleClinpgxSynk(request, process.env)
}
