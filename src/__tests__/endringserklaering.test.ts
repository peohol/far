/**
 * Kontrollen av at en ny migrasjon som endrer faginnholdet, oppgir agenten, og
 * at en kuratering avsluttes med rapport (`src/faginnhold/endringserklaering.ts`).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { endrerInnhold, erklaringer, erklaringsfeil } from '../faginnhold/endringserklaering'
import { endringsfeil, lesMigrasjonsfil } from '../faginnhold/migrasjonshistorikk'

const FIL = '20261014000000_eksempel.sql'

describe('om en migrasjon endrer innhold', () => {
  it('ser kallene og skrivingen som endrer innhold', () => {
    expect(endrerInnhold(`select public.lagre_utkast('x', 1, '{}');`)).toBe(true)
    expect(endrerInnhold(`do $$ begin perform intern.kuratering_lagre(d, 1, '{}', k); end $$;`)).toBe(true)
    expect(endrerInnhold(`select bivirkninger.importer('{}'::jsonb);`)).toBe(true)
    expect(endrerInnhold(`update public.stoffplasseringer set posisjon = 1;`)).toBe(true)
    expect(endrerInnhold(`insert into objektrevisjoner select 1;`)).toBe(true)
    expect(endrerInnhold(`select public.slett_stoff_for_godt('x');`)).toBe(true)
  })

  it('lar definisjonene, kommentarene og andre tabeller være', () => {
    expect(endrerInnhold(`create function f() returns void language sql as $$ select public.lagre_utkast('x', 1, '{}') $$;`)).toBe(false)
    expect(endrerInnhold(`-- select public.publiser_utkast('x', 1);\nselect 1;`)).toBe(false)
    expect(endrerInnhold(`update public.oppgaver set status = 'utført';`)).toBe(false)
    expect(endrerInnhold(`create trigger t after update on public.stoffstatus for each row execute function f();`)).toBe(false)
    expect(endrerInnhold(`insert into public.endringsagenter (nokkel) values ('x');`)).toBe(false)
  })
})

describe('erklæringen', () => {
  it('leser agenten og filen', () => {
    expect(erklaringer(`select intern.endring_start('claude-code', '${FIL}', 'Rydder');`)).toEqual([
      { funksjon: 'endring_start', agent: 'claude-code', migrasjon: FIL },
    ])
  })

  it('godtar en innholdsendring som oppgir agenten med sitt eget filnavn', () => {
    const sql = `select intern.endring_start('claude-code', '${FIL}', 'Teknisk retting');\nselect public.lagre_utkast('x', 1, '{}');`
    expect(erklaringsfeil(FIL, sql)).toEqual([])
  })

  it('stopper en innholdsendring uten agent', () => {
    expect(erklaringsfeil(FIL, `select public.publiser_utkast('x', 1);`)).toEqual([
      expect.stringContaining(`${FIL}: endrer faginnhold uten å oppgi agenten`),
    ])
  })

  it('stopper en erklæring med en annen fil enn sin egen', () => {
    const sql = `select intern.endring_start('claude-code', '20261001000000_annen.sql', 'x');\nselect public.lagre_utkast('x', 1, '{}');`
    expect(erklaringsfeil(FIL, sql)).toEqual([expect.stringContaining('det skal være filnavnet til migrasjonen selv')])
  })

  it('krever rapporten i en kuratering', () => {
    const uten = `do $k$ declare side uuid := intern.kuratering_start('x'); begin perform intern.kuratering_lagre(side, 1, '{}', 'k'); end $k$;`
    expect(erklaringsfeil(FIL, uten)).toEqual([expect.stringContaining('er en kuratering uten rapport')])
    const med = uten.replace(
      'end $k$',
      `perform intern.kuratering_rapport('chatgpt-monografkurator', '${FIL}', '{}'::jsonb); end $k$`,
    )
    expect(erklaringsfeil(FIL, med)).toEqual([])
  })

  it('godtar malen for kurateringene slik den står', () => {
    const mal = readFileSync(new URL('../../supabase/maler/monografkuratering.sql', import.meta.url), 'utf8')
    const navn = /intern\.kuratering_rapport\(\s*'[^']+',\s*'([^']+)'/.exec(mal)?.[1]
    expect(navn).toBeDefined()
    expect(erklaringsfeil(navn!, mal)).toEqual([])
  })

  it('stopper en ny migrasjon uten agent i PR-kontrollen', () => {
    const grunn = [lesMigrasjonsfil('20261013000000_a.sql', 'select 1;')]
    const ny = lesMigrasjonsfil(FIL, `select public.lagre_utkast('x', 1, '{}');`)
    expect(endringsfeil(grunn, [...grunn, ny], { kjente: {} })).toEqual([expect.stringContaining('uten å oppgi agenten')])
  })
})
