/**
 * Kurateringsgrenene som MCP-verktøy, for ChatGPT og andre MCP-klienter
 * (`docs/kurateringsgrener.md`). Logikken står i `src/kuratering/endepunkt.ts`.
 */
import { behandleKurateringMcp } from '../src/kuratering/endepunkt.js'

export function POST(request: Request): Promise<Response> {
  return behandleKurateringMcp(request, process.env)
}

export function GET(request: Request): Promise<Response> {
  return behandleKurateringMcp(request, process.env)
}
