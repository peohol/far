/**
 * Innloggingsveggen.
 *
 * Dette er den eneste grensen som faktisk holder uinnloggede ute fra det
 * kliniske innholdet, og den kjøres på Vercels kant der den ikke kan prøves
 * ut lokalt. Den rene delen av den kontrolleres derfor her, i detalj: en
 * feillest informasjonskapsel eller en sti som ikke kjennes igjen, ville gjort
 * veggen til en tom gest uten at noe så feil ut.
 */
import { describe, expect, it } from 'vitest'
import {
  beskyttetSti,
  KLINISK_PAKKE,
  oktKakenavn,
  tilgangstokenFra,
} from '../../auth/vegg'

const KAKE = 'sb-jfzqowsmjtthpbipnxnf-auth-token'
const TOKEN = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxIn0.signatur'

/** En lagret økt, slik Supabase legger den i informasjonskapselen. */
function okt(ekstra: Record<string, unknown> = {}): string {
  return JSON.stringify({ access_token: TOKEN, token_type: 'bearer', ...ekstra })
}

/** Samme økt, kodet slik Supabase koder den. */
function base64okt(tekst = okt()): string {
  const bytes = new TextEncoder().encode(tekst)
  let binaer = ''
  for (const b of bytes) binaer += String.fromCharCode(b)
  const b64 = btoa(binaer).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `base64-${b64}`
}

describe('beskyttetSti', () => {
  it('beskytter den kliniske pakken', () => {
    expect(beskyttetSti(`/assets/${KLINISK_PAKKE}-D-WMECxY.js`)).toBe(true)
    expect(beskyttetSti(`/assets/${KLINISK_PAKKE}-abc123.js.map`)).toBe(true)
  })

  it('lar innloggingssiden og det den trenger stå åpent', () => {
    expect(beskyttetSti('/')).toBe(false)
    expect(beskyttetSti('/index.html')).toBe(false)
    expect(beskyttetSti('/favicon.svg')).toBe(false)
    expect(beskyttetSti('/assets/index-CtId6wQa.js')).toBe(false)
    expect(beskyttetSti('/assets/index-BOnFMxif.css')).toBe(false)
  })

  it('lar seg ikke lure av et navn som bare likner', () => {
    // Prefikset må stå fremst i stien, ikke hvor som helst i den.
    expect(beskyttetSti(`/annet/assets/${KLINISK_PAKKE}-abc.js`)).toBe(false)
    expect(beskyttetSti(`/assets/ikke-${KLINISK_PAKKE}-abc.js`)).toBe(false)
  })
})

describe('oktKakenavn', () => {
  it('utleder navnet av prosjektets URL', () => {
    expect(oktKakenavn('https://jfzqowsmjtthpbipnxnf.supabase.co')).toBe(KAKE)
  })

  it('gir hvert prosjekt sitt eget navn', () => {
    expect(oktKakenavn('https://etannet.supabase.co')).toBe('sb-etannet-auth-token')
  })

  it('nekter en URL den ikke kjenner igjen', () => {
    expect(() => oktKakenavn('ikke en url')).toThrow()
  })
})

describe('tilgangstokenFra', () => {
  it('finner tokenet i en vanlig økt', () => {
    expect(tilgangstokenFra(`${KAKE}=${encodeURIComponent(okt())}`, KAKE)).toBe(TOKEN)
  })

  it('finner tokenet i en kodet økt', () => {
    expect(tilgangstokenFra(`${KAKE}=${base64okt()}`, KAKE)).toBe(TOKEN)
  })

  it('setter sammen en økt som er delt i flere kapsler', () => {
    const hel = base64okt()
    const midt = Math.floor(hel.length / 2)
    const kakehode = `${KAKE}.0=${hel.slice(0, midt)}; ${KAKE}.1=${hel.slice(midt)}`
    expect(tilgangstokenFra(kakehode, KAKE)).toBe(TOKEN)
  })

  it('leser norske tegn riktig', () => {
    const medNavn = okt({ user: { fornavn: 'Bjørn', etternavn: 'Ødegård' } })
    expect(tilgangstokenFra(`${KAKE}=${base64okt(medNavn)}`, KAKE)).toBe(TOKEN)
  })

  it('finner kapselen blant andre kapsler', () => {
    const kakehode = `far:tema=moerkt; ${KAKE}=${base64okt()}; noe=annet`
    expect(tilgangstokenFra(kakehode, KAKE)).toBe(TOKEN)
  })

  it('slipper ingen gjennom uten kapsel', () => {
    expect(tilgangstokenFra(null, KAKE)).toBeNull()
    expect(tilgangstokenFra('', KAKE)).toBeNull()
    expect(tilgangstokenFra('far:tema=moerkt', KAKE)).toBeNull()
  })

  it('slipper ingen gjennom på en kapsel som ikke bærer en økt', () => {
    expect(tilgangstokenFra(`${KAKE}=tull`, KAKE)).toBeNull()
    expect(tilgangstokenFra(`${KAKE}=base64-@@@`, KAKE)).toBeNull()
    expect(tilgangstokenFra(`${KAKE}=${encodeURIComponent('{"noe":"annet"}')}`, KAKE)).toBeNull()
    expect(tilgangstokenFra(`${KAKE}=${encodeURIComponent('{"access_token":""}')}`, KAKE)).toBeNull()
    expect(tilgangstokenFra(`${KAKE}=${encodeURIComponent('{"access_token":42}')}`, KAKE)).toBeNull()
  })

  it('finner økten også om kapselen har fått et annet prosjektnavn', () => {
    // Navnet utledes to steder, og kan komme i utakt ved en oppgradering. Da
    // skal ingen stenges ute: det er signaturen på tokenet som slipper noen
    // inn, ikke navnet på kapselen. Se `kandidatnavn` i vegg.ts.
    expect(tilgangstokenFra(`sb-etannet-auth-token=${base64okt()}`, KAKE)).toBe(TOKEN)
  })

  it('leter ikke i kapsler som ikke har formen til en øktkapsel', () => {
    expect(tilgangstokenFra(`min-egen-kake=${base64okt()}`, KAKE)).toBeNull()
    expect(tilgangstokenFra(`sb-noe-annet=${base64okt()}`, KAKE)).toBeNull()
  })
})
