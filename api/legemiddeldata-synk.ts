/**
 * Nattlig synkronisering av legemiddeldata fra FEST. Tidspunktet står i
 * `vercel.json`; logikken i `src/legemiddeldata/endepunkt.ts`.
 */
import { behandleSynk } from '../src/legemiddeldata/endepunkt'

export function GET(request: Request): Promise<Response> {
  return behandleSynk(request, process.env)
}
