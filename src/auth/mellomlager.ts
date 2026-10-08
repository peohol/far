/**
 * Et lite mellomlager i nettleseren (IndexedDB), til data appen kan vise med
 * én gang neste gang den åpnes, mens den kontrollerer om de er endret.
 *
 * Lageret er bare en hjelp: virker det ikke — en privat fane, en nettleser
 * uten IndexedDB, eller et lager som er fullt — leses ingenting og lagres
 * ingenting, uten feil. Det tømmes når brukeren logger ut
 * ({@link tomMellomlageret}), så det som er lagret, ikke blir liggende igjen
 * på en delt maskin.
 *
 * Modulen har ikke noe faglig innhold og ligger utenfor innloggingsveggen,
 * fordi utloggingen tømmer lageret.
 */

export interface Mellomlager {
  /** Verdien under nøkkelen, eller `undefined` når den ikke finnes eller ikke kan leses. */
  les(nokkel: string): Promise<unknown>
  /** Lagrer verdien under nøkkelen. Klarer den det ikke, skjer ingenting. */
  skriv(nokkel: string, verdi: unknown): Promise<void>
}

const DATABASE = 'ousfar-mellomlager'
const LAGER = 'verdier'

function indexedDb(): IDBFactory | null {
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB
  } catch {
    return null
  }
}

function svar<T>(foresporsel: IDBRequest<T>): Promise<T> {
  return new Promise((ok, feil) => {
    foresporsel.onsuccess = () => ok(foresporsel.result)
    foresporsel.onerror = () => feil(foresporsel.error)
  })
}

let apning: Promise<IDBDatabase | null> | null = null

function apne(): Promise<IDBDatabase | null> {
  const fabrikk = indexedDb()
  if (!fabrikk) return Promise.resolve(null)
  apning ??= new Promise<IDBDatabase | null>((ok) => {
    try {
      const foresporsel = fabrikk.open(DATABASE, 1)
      foresporsel.onupgradeneeded = () => foresporsel.result.createObjectStore(LAGER)
      foresporsel.onsuccess = () => {
        const db = foresporsel.result
        // En annen fane som tømmer lageret, skal ikke bli stående og vente på denne.
        db.onversionchange = () => {
          db.close()
          apning = null
        }
        ok(db)
      }
      foresporsel.onerror = () => ok(null)
      foresporsel.onblocked = () => ok(null)
    } catch {
      ok(null)
    }
  })
  return apning
}

async function iLageret<T>(modus: IDBTransactionMode, gjor: (lager: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await apne()
    if (!db) return undefined
    return await svar(gjor(db.transaction(LAGER, modus).objectStore(LAGER)))
  } catch {
    return undefined
  }
}

/** Mellomlageret i denne nettleseren. */
export const nettleserlager: Mellomlager = {
  les: (nokkel) => iLageret('readonly', (lager) => lager.get(nokkel)),
  skriv: async (nokkel, verdi) => {
    await iLageret('readwrite', (lager) => lager.put(verdi, nokkel))
  },
}

/** Sletter alt i mellomlageret. Brukes når brukeren logger ut. */
export async function tomMellomlageret(): Promise<void> {
  const fabrikk = indexedDb()
  if (!fabrikk) return
  try {
    const db = await apning
    db?.close()
  } catch {
    // Lageret kunne ikke åpnes; det slettes likevel under.
  }
  apning = null
  await new Promise<void>((ok) => {
    try {
      const foresporsel = fabrikk.deleteDatabase(DATABASE)
      foresporsel.onsuccess = () => ok()
      foresporsel.onerror = () => ok()
      foresporsel.onblocked = () => ok()
    } catch {
      ok()
    }
  })
}
