# Supabase-laget

Tillegg til reglene i rotens `CLAUDE.md`. Gjelder alt under `supabase/`.

- Bakgrunnen for brukersystemet står i `docs/brukere.md`, og for det
  redigerbare faginnholdet i `docs/faginnhold.md`. Les den som gjelder før
  noe her endres.
- `src/__tests__/faginnhold.test.ts` kjører alle migrasjonene i en Postgres i
  minnet. En ny migrasjon må la seg kjøre der; bruker den noe fra Supabase som
  ikke er gjenskapt i `src/__tests__/hjelp/testdatabase.ts`, utvides det der.
- Migrasjoner er append-only. Filnavnene svarer til versjonene i prosjektets
  migrasjonshistorikk; endres et filnavn, kommer repoet ut av takt med
  prosjektet. En ny migrasjon får tidspunktet i UTC som versjon
  (`<14 sifre>_<navn>.sql`), nyere enn alle på `main`.
- Migrasjonene rulles ut til produksjonen av GitHub Actions når PR-en slås
  sammen, og historikken kontrolleres automatisk (`docs/migrasjoner.md`).
  Rull dem ikke ut selv; `apply_migration` er bare en reservevei, beskrevet
  der.
- Vurder risikoen før PR-en slås sammen. Nye eller utvidende skjemaendringer,
  kontrollerte datamigrasjoner og andre testede endringer med lav
  produksjonsrisiko slås sammen og rulles ut uten separat samtykke. Stopp for
  eksplisitt godkjenning ved reell risiko for vesentlig datatap, svekket
  sikkerhet/personvern, betydelig produksjonsnedetid eller vanskelig
  reversering. Eksempler er `drop table`, `drop column`, `truncate`, bred
  sletting, destruktiv omskriving uten pålitelig gjenoppretting, endringer i
  RLS/grants som kan åpne utilsiktet tilgang, eller operasjoner som kan holde
  lange eksklusive låser. At en migrasjon kan rulles tilbake er ikke nok hvis
  skade kan oppstå før tilbakeføring. Velg en tryggere løsning hvis den kan
  løse oppgaven. De destruktive setningene utrullingen kjenner igjen, stopper
  den til fila har merket `-- destruktiv-godkjent: <hvem, når, hva>`; skriv det
  bare etter en slik godkjenning.
- En datamigrasjon som endrer en stoffmonografi, bygges på malen i
  `maler/monografkuratering.sql` og hjelpefunksjonene den bruker
  (`docs/monografkuratering.md`).
- En migrasjon kan ikke slette sin egen rad i historikken: raden føres inn
  etter at SQL-en har kjørt. Skriv derfor aldri en «oppryddingsmigrasjon» som
  forsøker det — den etterlater nettopp den raden den skulle fjerne. Er en rad
  først der, hører den til, og da skrives fila for den.
- `execute_sql` gjennom MCP er skrivebeskyttet. Data som skal legges inn,
  går som en datamigrering, med fil her som alle andre.
- Prosjektet skriver flyttall med 15 sifre (`extra_float_digits = 0`). En
  funksjon som gjør `float8` om til tekst eller JSON som skal leses tilbake,
  setter `extra_float_digits = 1` selv.
- `functions/_delt/` leses også av appen, gjennom `@delt/...`. Den skal være
  ren TypeScript uten Deno-API-er og uten avhengigheter. Alt som bare hører
  til serveren, ligger i `functions/_edge/`.
- Reglene for brukernavn finnes både her og i SQL. Endres de, skal begge
  stedene endres i samme omgang — testen `src/__tests__/brukersystem.test.ts`
  kontrollerer at de stemmer overens.
- En privilegert klient skal aldri tas i bruk før den innloggede er
  autentisert, bruker-ID-en er lest fra JWT-en, rollen er slått opp
  server-side og inndataene er validert. `functions/_edge/kontekst.ts` gjør
  det i riktig rekkefølge; nye endepunkter skal bygges på den.
- Hemmelige nøkler hører hjemme i miljøet, aldri i repoet eller i noe som
  bygges inn i klienten.
