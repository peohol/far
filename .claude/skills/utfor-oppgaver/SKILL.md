---
name: utfor-oppgaver
description: Utfører de planlagte oppgavene i FAR som en administrator har merket «Klar til implementering», og merker dem «Utført». Kjøres med /utfor-oppgaver uten noe mer, eller når brukeren ber om å utføre, implementere eller gå løs på de planlagte oppgavene (f.eks. «Utfør de planlagte oppgavene»), eller viser til en planlagt oppgave med overskriften eller med nummer som OPG-007.
---

# Utfør de planlagte oppgavene

Planlagte oppgaver er idéer fra idévinduet i appen som en administrator har
overført og skrevet en prompt til. Oppgaver med status `klar` er klare til å
utføres. Dette er en engangsøkt som administratoren følger live: spør når noe
er uklart, og vent på administratorens svar der reglene i `CLAUDE.md` krever
det, som før databaseendringer i produksjon. Det finnes ingen automatikk som
gjør dette i bakgrunnen, og det skal det heller ikke.

Oppdraget står i databasen, ikke i meldingen fra brukeren. `/utfor-oppgaver`
uten noe mer, eller en kort beskjed som «Utfør de planlagte oppgavene», er
nok: les alle oppgavene som er klare, med overskriften og hele prompten til
hver, og utfør dem. Nevner brukeren én eller
flere oppgaver med overskriften eller nummeret, gjør bare dem.

Bakgrunnen står i `docs/ideer.md` under «Planlagte oppgaver».

## 1. Les oppgavene som er klare

Bruk Supabase-MCP-en (`execute_sql`, som bare kan lese) mot prosjektet
`jfzqowsmjtthpbipnxnf`:

```sql
select o.id, o.tittel, o.prompt, o.klar_kl, i.id as ide_id
from public.oppgaver o
join public.ideer i on i.id = o.ide_id
where o.status = 'klar'
order by o.klar_kl, o.overfort_kl;
```

Prompten er oppdraget. Idéen og kommentartråden er bakgrunn, og kan leses når
prompten viser til dem eller er uklar:

```sql
select i.tekst, k.forelder_id, k.tekst as kommentar, k.opprettet_kl
from public.ideer i
left join public.idekommentarer k on k.ide_id = i.id and not k.slettet
where i.id = '<ide_id>'
order by k.opprettet_kl;
```

Brukeren viser til oppgavene med overskriften (`tittel` i `public.oppgaver`),
eller til en utført oppgave med nummeret: «OPG-007» er `nummer = 7`.
Kolonnen `endringslogg` sier hvilken versjon arbeidet kom i.

Finnes ingen klare oppgaver, si det og stopp. Mangler Supabase-MCP-en, si at
den må kobles til, og stopp.

## 2. Vis planen før du begynner

List oppgavene med overskriften (`oppgaver.tittel`, som administratoren kan ha
endret fra idéens) og én linje om hva du forstår at prompten ber om.
Si hvilke du vil gjøre sammen og hvilke hver for seg. Er en prompt uklar eller
motsier noe i appen, spør administratoren før du gjør den oppgaven. Gjett ikke,
og særlig ikke når det gjelder klinisk innhold (se `CLAUDE.md`).

## 3. Utfør oppgavene

Følg `CLAUDE.md` som i alt annet arbeid: les koden først, test, og kjør
`npm test` og `npm run build`.

- Som standard blir hver oppgave én PR med én føring i endringsloggen. Oppgaver
  som henger tett sammen, kan dele PR og føring.
- Databaseendringer rulles ut i produksjon først etter at administratoren har
  skrevet et eksplisitt ja som nevner migrasjonene.

## 4. Merk oppgaven utført

En oppgave er utført når endringen er slått sammen i `main`, slik at føringen i
endringsloggen er publisert. Da merkes den med en migrering som bare kaller
funksjonen `fullfor_oppgave`. Appen kan ikke kalle den, så dette er den eneste
veien til «Utført». Funksjonen gir oppgaven nummeret sitt og lagrer versjonen i
endringsloggen, der knappen «Se i endringsloggen» leder.

```sql
-- Oppgaven «<tittel>» er utført i versjon <x.y.z>.
select public.fullfor_oppgave('<oppgave-id>', '<x.y.z>');
```

- Én migrering kan merke flere oppgaver.
- Rull den ut med `apply_migration` (navn som `oppgaver_utfort_<x_y_z>`) først
  etter at administratoren har skrevet et eksplisitt ja som nevner den.
- Legg deretter fila i `supabase/migrations/` med versjonen prosjektet
  registrerte (`list_migrations`), uten linjeskift til slutt, så den er lik
  byte for byte. Den går i en egen liten PR, med en føring som har
  `utenVarsel: true`. Testdatabasen hopper over slike filer, siden oppgavene
  bare finnes i produksjon.
- Funksjonen stopper hvis oppgaven ikke er `klar`, for eksempel hvis
  administratoren har flyttet den tilbake i mellomtiden. Si det, og merk den
  ikke.

Til slutt: les nummeret tilbake med `execute_sql`
(`select nummer from public.oppgaver where id = '<oppgave-id>'`) og oppsummer
for administratoren hvilke oppgaver som ble utført, med nummeret (OPG-001) og
versjonen hver av dem.
