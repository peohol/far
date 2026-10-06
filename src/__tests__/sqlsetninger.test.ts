/** Delingen i setninger slik Supabase-CLI-en lagrer dem, og teksten uten kommentarer. */
import { describe, expect, it } from 'vitest'
import { cliSetninger, utenKommentarer } from '../faginnhold/sqlsetninger'

describe('setningene CLI-en lagrer', () => {
  // Tilfellene fra CLI-ens egne tester (legacy-sql-split.unit.test.ts, v2.117.0).
  it.each([
    ['SELECT 1; SELECT 2;', ['SELECT 1', 'SELECT 2']],
    ['SELECT 1;\n\n', ['SELECT 1']],
    ['SELECT 1', ['SELECT 1']],
    ["SELECT ';'; SELECT 2", ["SELECT ';'", 'SELECT 2']],
    ["SELECT 'a''; b'; SELECT 2", ["SELECT 'a''; b'", 'SELECT 2']],
    [
      'CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END; $$ LANGUAGE plpgsql; SELECT 2;',
      ['CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END; $$ LANGUAGE plpgsql', 'SELECT 2'],
    ],
    ['CREATE FUNCTION f() AS $a²$foo; bar$a²$ LANGUAGE sql;', ['CREATE FUNCTION f() AS $a²$foo', 'bar$a²$ LANGUAGE sql']],
    [
      "CREATE FUNCTION f() AS $body$ SELECT ';'; $body$ LANGUAGE sql; SELECT 2;",
      ["CREATE FUNCTION f() AS $body$ SELECT ';'; $body$ LANGUAGE sql", 'SELECT 2'],
    ],
    ['SELECT 1 -- a; b\n; SELECT 2', ['SELECT 1 -- a; b', 'SELECT 2']],
    ['SELECT 1 /* a; /* n; */ b; */; SELECT 2', ['SELECT 1 /* a; /* n; */ b; */', 'SELECT 2']],
    [
      'CREATE FUNCTION f() RETURNS int LANGUAGE sql BEGIN ATOMIC SELECT 1; SELECT 2; END; SELECT 3;',
      ['CREATE FUNCTION f() RETURNS int LANGUAGE sql BEGIN ATOMIC SELECT 1; SELECT 2; END', 'SELECT 3'],
    ],
  ])('%j', (sql, setninger) => {
    expect(cliSetninger(sql)).toEqual(setninger)
  })
})

describe('teksten uten kommentarer', () => {
  it('bytter linje- og blokkommentarer, også nøstede, mot et mellomrom', () => {
    expect(utenKommentarer('drop -- x\ntable /* a /* b */ c */ t;')).toBe('drop  \ntable   t;')
    expect(utenKommentarer('select 1; -- slutt')).toBe('select 1;  ')
  })

  it('lar strenger og navn i anførselstegn stå', () => {
    const sql = `select '-- ikke', 'a''/* ikke */', E'\\'-- ikke', "-- navn" from t`
    expect(utenKommentarer(sql)).toBe(sql)
    expect(utenKommentarer("select e'\\'' /* bort */")).toBe("select e'\\''  ")
  })
})
