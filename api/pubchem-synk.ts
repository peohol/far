/**
 * Synkroniseringen av de kjemiske grunndataene fra PubChem: hver uke fra
 * Vercel (`GET`, tidspunktet står i `vercel.json`), og når en administrator ber
 * om det (`POST`). Logikken står i `src/kjemi/endepunkt.ts`.
 */
import { behandlePubchemSynk } from '../src/kjemi/endepunkt.js'

export function GET(request: Request): Promise<Response> {
  return behandlePubchemSynk(request, process.env)
}

export function POST(request: Request): Promise<Response> {
  return behandlePubchemSynk(request, process.env)
}
