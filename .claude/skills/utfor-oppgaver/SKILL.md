---
name: utfor-oppgaver
description: Utfører de planlagte oppgavene i FAR som en administrator har merket «Klar til implementering», og merker dem «Utført». Kjøres med /utfor-oppgaver uten noe mer, eller når brukeren ber om å utføre, implementere eller gå løs på de planlagte oppgavene (f.eks. «Utfør de planlagte oppgavene»), eller viser til en planlagt oppgave med overskriften eller med nummer som OPG-007, også for å gjenoppta en avbrutt oppgave.
---

# Utfør de planlagte oppgavene

Planlagte oppgaver er idéer fra idévinduet i appen som en administrator har
overført og skrevet en prompt til. Hver har et nummer fra den ble overført,
vist som «OPG-007» (`nummer = 7`). Oppgaver med status `klar` er klare til å
utføres. Dette er en engangsøkt som administratoren følger live: spør når noe
er uklart, og vent på administratorens svar der reglene i `CLAUDE.md` krever
det, som før databaseendringer i produksjon. Det finnes ingen automatikk som
gjør dette i bakgrunnen, og det skal det heller ikke.

Oppdraget står i databasen, ikke i meldingen fra brukeren. `/utfor-oppgaver`
uten noe mer, eller en kort beskjed som «Utfør de planlagte oppgavene», er
nok: les alle oppgavene som er klare, med overskriften og hele prompten til
hver, og utfør dem. Nevner brukeren én eller flere oppgaver med overskriften
eller nummeret, gjør bare dem.

En oppgave går gjennom statusene Ikke påbegynt → Påbegynt → Klar til
implementering → Håndteres nå av en agent → Utført. Claude setter de to siste,
med migreringer administratoren godkjenner. Bakgrunnen står i `docs/ideer.md`
under «Arkivet og Planlagte oppgaver».

## 1. Les oppgavene

Bruk Supabase-MCP-en (`execute_sql`, som bare kan lese) mot prosjektet
`jfzqowsmjtthpbipnxnf`:

```sql
select o.nummer, o.id, o.tittel, o.status, o.prompt, o.tatt_kl, i.id as ide_id
from public.oppgaver o
join public.ideer i on i.id = o.ide_id
where o.status in ('klar', 'haandteres')
order by o.nummer;
```

- Uten noe mer gjelder oppdraget oppgavene med status `klar`.
- Oppgaver med status `haandteres` er tatt av en annen økt. Nevn dem kort
  (nummer, overskrift, siden når), men ikke rør dem.
- Nevner brukeren en oppgave som `haandteres`, er det en avbrutt oppgave som
  skal gjenopptas. Ta den ikke på nytt i steg 3. Finn arbeidet som alt er
  gjort, i grener og PR-er med nummeret (se steg 4), og fortsett derfra.

Prompten er oppdraget. Idéen og kommentartråden er bakgrunn, og kan leses når
prompten viser til dem eller er uklar:

```sql
select i.tekst, k.forelder_id, k.tekst as kommentar, k.opprettet_kl
from public.ideer i
left join public.idekommentarer k on k.ide_id = i.id and not k.slettet
where i.id = '<ide_id>'
order by k.opprettet_kl;
```

Finnes ingen oppgaver å gjøre, si det og stopp. Mangler Supabase-MCP-en, si at
den må kobles til, og stopp.

## 2. Gi tråden navn etter oppgavene

Så snart det er klart hvilke oppgaver som skal gjøres, får tråden eller økten
navnet deres i stedet for «utfor-oppgaver». Bruk det verktøyet økten har: i en
tråd i et Claude-prosjekt `set_thread_label`, ellers `set_session_title` i
Claude Code på nettet. Har økten ingen av dem, hopp over steget uten å si noe.

- Én oppgave: nummeret og overskriften, for eksempel «OPG-007 Varslingssystem».
- Flere: «Oppgaver: OPG-007, OPG-008». Blir navnet lengre enn 80 tegn, kort
  det ned til de første numrene og antallet resten, som «Oppgaver: OPG-007,
  OPG-008 + 3 til».
- Endres utvalget senere, for eksempel fordi administratoren vil vente med én
  av dem, gi tråden nytt navn etter de oppgavene som faktisk gjøres.

## 3. Vis planen og ta oppgavene

List oppgavene med nummeret, overskriften (`oppgaver.tittel`) og én linje om
hva du forstår at prompten ber om. Si hvilke du vil gjøre sammen og hvilke hver
for seg. Er en prompt uklar eller motsier noe i appen, spør administratoren før
du gjør den oppgaven. Gjett ikke, og særlig ikke når det gjelder klinisk
innhold (se `CLAUDE.md`).

Før arbeidet begynner, tas oppgavene, så ingen annen økt kan ta de samme. Det
er en migrering som bare kaller `ta_oppgaver` med numrene:

```sql
-- OPG-007 «<tittel>» og OPG-008 «<tittel>» håndteres av en agent. Oppgavene
-- finnes bare i produksjon; i en ny database gjør migrasjonen ingenting.
select public.ta_oppgaver(array[7, 8]) where exists (select 1 from public.oppgaver);
```

- Be om administratorens ja i den samme meldingen som planen, med én ferdig
  setning å kopiere: «Ja, rull ut migrasjonen «oppgaver_tatt_opg_007_008» til
  produksjonsdatabasen i Supabase.» Navnet er `oppgaver_tatt_` og numrene.
- Rull den ut med `apply_migration` først etter det ja-et. Oppgavene står da
  som «Håndteres nå av en agent» i appen.
- Funksjonen tar alle eller ingen. Stopper den fordi en oppgave ikke er klar
  lenger (en annen økt har tatt den, eller administratoren har endret den), si
  hvilken, ta den ut av planen, og be om et nytt ja for resten.
- Legg fila i `supabase/migrations/` med versjonen prosjektet registrerte
  (`list_migrations`), uten linjeskift til slutt, så den er lik byte for byte.
  Den går i den første PR-en for oppgavene.

## 4. Utfør oppgavene

Følg `CLAUDE.md` som i alt annet arbeid: les koden først, test, og kjør
`npm test` og `npm run build`.

- Som standard blir hver oppgave én PR med én føring i endringsloggen. Oppgaver
  som henger tett sammen, kan dele PR og føring.
- Ha nummeret i grenen og i tittelen på PR-en, som `claude/opg-007-varsler` og
  «OPG-007: Varslingssystem», så en avbrutt oppgave kan finnes igjen.
- Databaseendringer rulles ut i produksjon først etter at administratoren har
  skrevet et eksplisitt ja som nevner migrasjonene.
- Må en oppgave legges fra seg uferdig, si at administratoren kan fortsette den
  i en ny økt med `/utfor-oppgaver OPG-007`, eller frigi den i appen så den er
  klar igjen.

## 5. Merk oppgaven utført

En oppgave er utført når endringen er slått sammen i `main`, slik at føringen i
endringsloggen er publisert. Da merkes den med en migrering som bare kaller
funksjonen `fullfor_oppgave` med nummeret. Appen kan ikke kalle den, så dette er
den eneste veien til «Utført». Versjonen lagres, og knappen «Se i
endringsloggen» leder dit.

```sql
-- OPG-007 «<tittel>» er utført i versjon <x.y.z>. Oppgavene finnes bare i
-- produksjon; i en ny database gjør migrasjonen ingenting.
select public.fullfor_oppgave(7, '<x.y.z>') where exists (select 1 from public.oppgaver);
```

- Én migrering kan merke flere oppgaver.
- Rull den ut med `apply_migration` (navn som `oppgaver_utfort_<x_y_z>`) først
  etter at administratoren har skrevet et eksplisitt ja som nevner den.
- Legg deretter fila i `supabase/migrations/` på samme måte som i steg 3. Den
  går i en egen liten PR, med en føring som har `utenVarsel: true`.
- Funksjonen stopper hvis oppgaven verken håndteres av en agent eller er klar,
  for eksempel hvis administratoren har flyttet den tilbake i mellomtiden. Si
  det, og merk den ikke.

Til slutt: oppsummer for administratoren hvilke oppgaver som ble utført, med
nummeret og versjonen hver av dem.
