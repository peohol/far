/**
 * Synkroniseringen av de strukturerte farmakogenetiske dataene fra CPIC: hver
 * uke fra Vercel (`GET`, tidspunktet står i `vercel.json`), og når en
 * administrator ber om det (`POST`). Logikken står i `src/cpic/endepunkt.ts`.
 */
import { behandleCpicSynk } from '../src/cpic/endepunkt.js'

export function GET(request: Request): Promise<Response> {
  return behandleCpicSynk(request, process.env)
}

export function POST(request: Request): Promise<Response> {
  return behandleCpicSynk(request, process.env)
}
