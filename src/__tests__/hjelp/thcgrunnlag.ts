import importertRegelsett from '../../domain/__tests__/fasit/thc-regelsett-import.json'
import importerteTekster from '../../domain/__tests__/fasit/thc-tekster-import.json'
import { lagThcModell, type ThcModell } from '../../domain/thcMotor'
import type { ThcRegelsett } from '../../domain/thcRegelsett'
import { plassholdereI, type Kommentarinnhold } from '../../domain/kommentarobjekt'
import { THC_TEKSTBOLKER, THC_TEKSTNOKLER, type ThcTekstbolker, type ThcTekster } from '../../domain/thcTekster'
import type { Utgave } from '../../faginnhold/lesing'
import type { ThcRegelsettutgave } from '../../faginnhold/thcregler'

/**
 * THC-syreregelsettet og tekstene slik de er publisert i Supabase, for testene
 * som ikke har en database: det de ble importert fra, som
 * `thcRegelsettlagring.test.ts` viser at databasen gir tilbake uendret.
 */
export const THC_REGELSETT = importertRegelsett as ThcRegelsett
export const THC_TEKSTER = importerteTekster as ThcTekster

function modell(): ThcModell {
  const m = lagThcModell(THC_REGELSETT, THC_TEKSTER)
  if (!m.ok) throw new Error(m.feil.join('\n'))
  return m.modell
}

export const THC_MODELL = modell()

function utgave<T>(id: string, innhold: T, revisjon = 1, publisert: number | null = revisjon): Utgave<T> {
  return {
    id,
    revisjon,
    publisert_revisjon: publisert,
    innhold,
    endret_av_fornavn: 'Syntetisk',
    endret_av_etternavn: 'Redaktør',
    endret_kl: '2026-09-25T08:00:00Z',
  }
}

/**
 * Regelsettet og tekstene slik databasen gir dem: reglene med en kommentar
 * per tekstbolk. `regler` og `tekster` erstatter det publiserte.
 */
export function thcRegelsettutgave({
  regler = THC_REGELSETT,
  tekster = THC_TEKSTER,
}: { regler?: ThcRegelsett; tekster?: ThcTekster } = {}): ThcRegelsettutgave {
  const tekstbolker = Object.fromEntries(THC_TEKSTNOKLER.map((n) => [n, `thc-${n}`])) as ThcTekstbolker
  return {
    regelsett: utgave('thc-regelsett', { ...regler, tekstbolker }, 3),
    kommentarer: THC_TEKSTNOKLER.map((n) =>
      utgave<Kommentarinnhold>(`thc-${n}`, {
        navn: `THC-syre: ${THC_TEKSTBOLKER[n].tittel}`,
        tekst: tekster[n],
        plassholdere: plassholdereI(tekster[n]),
      }),
    ),
  }
}
