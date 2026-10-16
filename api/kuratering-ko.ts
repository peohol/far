/**
 * Kurateringsgrenene uten fagtekst, for kurateringskøen
 * (`docs/kurateringsko.md`). Logikken står i `src/kuratering/endepunkt.ts`.
 */
import { behandleKurateringsko } from '../src/kuratering/endepunkt.js'

export function POST(request: Request): Promise<Response> {
  return behandleKurateringsko(request, process.env)
}
