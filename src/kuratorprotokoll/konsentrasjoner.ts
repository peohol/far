/**
 * Kontrollen av konsentrasjonene i en fagside, for kuratoren og kontrolløren
 * (`npm run kurator|kontrollor -- konsentrasjoner <gren>`,
 * `docs/kuratorprotokoll.md`): de merkede konsentrasjonene, med det som kan
 * hindre omregningen, og tall med en konsentrasjonsenhet som står i teksten
 * uten merking. Om et umerket tall skal merkes, avgjøres faglig
 * (protokollen sier hva som merkes).
 */
import { finnKonsentrasjoner, lesTekstkonsentrasjon } from '../enheter/konsentrasjon'
import { finnNoder, klartekst, konsentrasjonstekst, MERKER, NODER, type Riktekstnode } from '../faginnhold/riktekst'
import { FORBINDELSER, type Forbindelsesregister } from '../kjemi/forbindelser'

export interface Merketkonsentrasjon {
  /** Seksjonen og kortet: «tdm · Prøvetaking». */
  hvor: string
  /** Tallet og enheten som i kilden. */
  tekst: string
  forbindelse: string | null
  /** Det som hindrer eller begrenser omregningen. Tom når den kan regnes om til alle enhetene. */
  merknader: string[]
  /** Merkingen kan ikke brukes, og tallet vises som vanlig tekst. */
  feil: boolean
}

export interface Umerketkonsentrasjon {
  hvor: string
  tekst: string
  /** Teksten rundt, så tallet kan finnes igjen. */
  utdrag: string
}

export interface Konsentrasjonsrapport {
  merket: Merketkonsentrasjon[]
  umerket: Umerketkonsentrasjon[]
}

function erObjekt(verdi: unknown): verdi is Record<string, unknown> {
  return typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)
}

/** Teksten i et dokument som kan ha konsentrasjoner, avsnitt for avsnitt: uten kode og uten det som alt er merket. */
function tekstblokker(node: Riktekstnode): string[] {
  const innhold = node.content ?? []
  if (innhold.some((n) => n.type === NODER.tekst || n.type === NODER.konsentrasjon)) {
    // Et avsnitt eller en overskrift: de merkede tallene og koden skiller tekstbitene ad.
    return innhold
      .map((n) => (n.type === NODER.tekst && !n.marks?.some((m) => m.type === MERKER.kode) ? klartekst(n) : '\n'))
      .join('')
      .split('\n')
  }
  return innhold.flatMap(tekstblokker)
}

function hvorI(element: Record<string, unknown>): string {
  const data = erObjekt(element.data) ? element.data : {}
  const navn = [data.tittel, data.maal].find((v): v is string => typeof v === 'string' && v.trim() !== '')
  return [typeof element.panel === 'string' ? element.panel : '?', navn].filter(Boolean).join(' · ')
}

/**
 * Konsentrasjonene i elementene på fagsiden til `stoff` (innholdet slik
 * `les_stoff` gir det, eller elementene selv).
 */
export function konsentrasjonsrapport(
  stoff: string,
  elementer: readonly unknown[],
  register: Forbindelsesregister = FORBINDELSER,
): Konsentrasjonsrapport {
  const egne = new Set(register.forStoff(stoff).map((f) => f.nokkel))
  const rapport: Konsentrasjonsrapport = { merket: [], umerket: [] }
  for (const utgave of elementer) {
    const element = erObjekt(utgave) && erObjekt(utgave.innhold) ? utgave.innhold : utgave
    if (!erObjekt(element) || element.panel === 'fjernet') continue
    const hvor = hvorI(element)
    for (const dokument of finnNoder(element.data, NODER.dokument)) {
      for (const node of finnNoder(dokument, NODER.konsentrasjon)) rapport.merket.push(merket(node, hvor, egne, register))
      for (const blokk of tekstblokker(dokument)) {
        for (const funn of finnKonsentrasjoner(blokk)) {
          const utdrag = blokk.slice(Math.max(0, funn.start - 40), funn.slutt + 40).replace(/\s+/g, ' ').trim()
          rapport.umerket.push({ hvor, tekst: blokk.slice(funn.start, funn.slutt), utdrag })
        }
      }
    }
  }
  return rapport
}

function merket(node: Riktekstnode, hvor: string, egne: ReadonlySet<string>, register: Forbindelsesregister): Merketkonsentrasjon {
  const attrs = node.attrs ?? {}
  const tekst = konsentrasjonstekst(attrs)
  const forbindelse = typeof attrs.forbindelse === 'string' && attrs.forbindelse ? attrs.forbindelse : null
  const merknader: string[] = []
  const lest = lesTekstkonsentrasjon({
    verdi: typeof attrs.verdi === 'string' ? attrs.verdi : '',
    enhet: typeof attrs.enhet === 'string' ? attrs.enhet : '',
  })
  if (!lest) merknader.push('tallet eller enheten kan ikke leses, så tallet vises som vanlig tekst')
  const f = forbindelse ? register.finn(forbindelse) : undefined
  if (!forbindelse) merknader.push('forbindelsen er ikke oppgitt, så tallet regnes bare om innen masse eller stoffmengde')
  else if (!f) merknader.push(`forbindelsen «${forbindelse}» finnes ikke i src/data/forbindelser.ts`)
  else {
    if (!f.pubchem) merknader.push(`${f.navn} har ingen verifisert PubChem-kobling, så tallet regnes bare om innen masse eller stoffmengde`)
    if (!egne.has(f.nokkel)) merknader.push(`${f.navn} hører ikke til fagsiden; kontroller at det er riktig forbindelse`)
  }
  return { hvor, tekst, forbindelse, merknader, feil: !lest || Boolean(forbindelse && !f) }
}
