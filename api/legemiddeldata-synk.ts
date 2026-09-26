/**
 * Synkroniseringen av legemiddeldata fra FEST: hver natt fra Vercel (`GET`,
 * tidspunktet står i `vercel.json`), og når en administrator ber om det
 * (`POST`). Logikken står i `src/legemiddeldata/endepunkt.ts`.
 */
import { behandleSynk } from '../src/legemiddeldata/endepunkt.js'

export function GET(request: Request): Promise<Response> {
  return behandleSynk(request, process.env)
}

export function POST(request: Request): Promise<Response> {
  return behandleSynk(request, process.env)
}
