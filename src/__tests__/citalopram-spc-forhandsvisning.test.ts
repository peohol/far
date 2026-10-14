/**
 * Full kontroll av den konkrete Cipramil-importen gjennom samme
 * importvalidering og forhåndsvisningsmodell som import-CLI-en bruker.
 * Faglig originalkontroll av SPC-tabellen dokumenteres separat i journalen.
 */
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { importoversikt, importrapport } from '../bivirkninger/forhandsvisning'
import { kontrollerImport } from '../bivirkninger/import'

it('forhåndsviser den originale Cipramil-importen uten å endre databasen', () => {
  const fil = new URL('../../supabase/import/bivirkninger/citalopram--cipramil-tabletter.json', import.meta.url)
  const importdata: unknown = JSON.parse(readFileSync(fil, 'utf8'))
  const kontroll = kontrollerImport(importdata)
  expect(kontroll.ok, kontroll.ok ? '' : kontroll.feil.join('\n')).toBe(true)
  if (!kontroll.ok) return

  const oversikt = importoversikt(kontroll.import)
  expect(oversikt.antall).toBe(84)
  expect(oversikt.antallFotnoter).toBe(2)
  expect(oversikt.tabeller).toHaveLength(1)
  expect(oversikt.tabeller[0]!.perOrgansystem).toHaveLength(18)
  expect(oversikt.tabeller[0]!.perFrekvens.map((f) => f.antall).reduce((a, b) => a + b, 0)).toBe(84)

  const forhåndsvisning = importrapport(kontroll.import, { slag: 'ingen' })
  expect(forhåndsvisning).toContain('84 bivirkninger i alt')
  expect(forhåndsvisning).toContain('2 fotnoter')
  expect(forhåndsvisning).toContain('Uhensiktsmessig sekresjon av ADH')
  expect(forhåndsvisning).toContain('Førstegangsimport:')
})
