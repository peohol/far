/**
 * Kurateringsgrenene for KI-agentene (`docs/kurateringsgrener.md`). Logikken
 * står i `src/kuratering/endepunkt.ts`.
 */
import { behandleKuratering } from '../src/kuratering/endepunkt.js'

export function POST(request: Request): Promise<Response> {
  return behandleKuratering(request, process.env)
}
