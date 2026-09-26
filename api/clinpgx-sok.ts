/**
 * Oppslaget i ClinPGx som administratorene bruker til å koble en stoffside.
 * Logikken står i `src/clinpgx/endepunkt.ts`.
 */
import { behandleClinpgxSok } from '../src/clinpgx/endepunkt.js'

export function GET(request: Request): Promise<Response> {
  return behandleClinpgxSok(request, process.env)
}
