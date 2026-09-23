/**
 * Utpakking av FEST-filen, som kommer som en zip med én XML-fil i.
 *
 * Bare det som trengs for den ene filen: sentralkatalogen leses for å finne
 * filen, dataene pakkes ut som en strøm, og lengden og kontrollsummen sjekkes
 * til slutt. En avkuttet eller skadet nedlasting gir dermed en feil i stedet
 * for et ufullstendig uttrekk.
 *
 * Bare for serveren: bruker Node sin `zlib`.
 */
import { createInflateRaw, crc32 } from 'node:zlib'
import { Readable } from 'node:stream'

const SLUTTPOST = 0x06054b50
const SENTRALPOST = 0x02014b50
const LOKALPOST = 0x04034b50

export interface Zipfil {
  navn: string
  /** Strømmen av tekst i filen, som UTF-8. Kaster til slutt om lengde eller kontrollsum ikke stemmer. */
  tekst: AsyncIterable<string>
}

/** Finner den første `.xml`-fila i arkivet (eller den første fila) og gir innholdet som tekst. */
export function pakkUt(zip: Buffer): Zipfil {
  const slutt = finnSluttpost(zip)
  const antall = zip.readUInt16LE(slutt + 10)
  let pos = zip.readUInt32LE(slutt + 16)

  const filer: { navn: string; metode: number; komprimert: number; lengde: number; crc: number; lokal: number }[] = []
  for (let i = 0; i < antall; i++) {
    if (zip.readUInt32LE(pos) !== SENTRALPOST) throw new Error('Zip-filen er skadet (sentralkatalogen).')
    const navnlengde = zip.readUInt16LE(pos + 28)
    const ekstra = zip.readUInt16LE(pos + 30)
    const kommentar = zip.readUInt16LE(pos + 32)
    filer.push({
      metode: zip.readUInt16LE(pos + 10),
      crc: zip.readUInt32LE(pos + 16),
      komprimert: zip.readUInt32LE(pos + 20),
      lengde: zip.readUInt32LE(pos + 24),
      lokal: zip.readUInt32LE(pos + 42),
      navn: zip.toString('utf8', pos + 46, pos + 46 + navnlengde),
    })
    pos += 46 + navnlengde + ekstra + kommentar
  }

  const fil = filer.find((f) => f.navn.toLowerCase().endsWith('.xml')) ?? filer[0]
  if (!fil) throw new Error('Zip-filen er tom.')
  if (fil.metode !== 8 && fil.metode !== 0) throw new Error(`Ukjent komprimering i zip-filen (${fil.metode}).`)
  if (zip.readUInt32LE(fil.lokal) !== LOKALPOST) throw new Error('Zip-filen er skadet (filhodet).')

  const start = fil.lokal + 30 + zip.readUInt16LE(fil.lokal + 26) + zip.readUInt16LE(fil.lokal + 28)
  const data = zip.subarray(start, start + fil.komprimert)
  if (data.length !== fil.komprimert) throw new Error('Zip-filen er avkuttet.')

  return { navn: fil.navn, tekst: tekststrom(data, fil.metode, fil.lengde, fil.crc) }
}

async function* tekststrom(data: Buffer, metode: number, lengde: number, crc: number): AsyncGenerator<string> {
  const kilde = metode === 0 ? Readable.from([data]) : Readable.from([data]).pipe(createInflateRaw())
  const dekoder = new TextDecoder('utf-8', { fatal: true })
  let lest = 0
  let sum = 0
  for await (const bit of kilde as AsyncIterable<Buffer>) {
    lest += bit.length
    sum = crc32(bit, sum)
    const tekst = dekoder.decode(bit, { stream: true })
    if (tekst) yield tekst
  }
  const rest = dekoder.decode()
  if (rest) yield rest
  if (lest !== lengde || sum >>> 0 !== crc >>> 0) throw new Error('Innholdet i zip-filen stemmer ikke med kontrollsummen.')
}

function finnSluttpost(zip: Buffer): number {
  // Sluttposten er 22 byte pluss en kommentar på opptil 65 535.
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === SLUTTPOST) return i
  }
  throw new Error('Filen er ikke en gyldig zip-fil.')
}
