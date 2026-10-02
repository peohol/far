# Idéene

Leses når noe ved idévinduet skal endres. Idéene er brukernes forslag til
OUSFAR, med hjerter og kommentartråder; de berører ikke den kliniske delen.

## Hvor det ligger

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_ideer*.sql` | Tabellene, radsikkerheten, reglene for sletting og frysing, og funksjonene |
| `src/ideer/modell.ts` | Sorteringen, arkivet og lesingen av svarene (rene funksjoner) |
| `src/ideer/oppgaver.ts` | Planlagte oppgaver: lesingen og grupperingen etter status |
| `src/ideer/api.ts` | Kallene mot Supabase |
| `src/components/ideer/` | Vinduene: Idéer (lista, én idé, skjemaet) og Planlagte oppgaver |
| `src/traad/modell.ts`, `src/components/traad/` | Kommentartråden, felles med diskusjonene (`docs/diskusjoner.md`): treet, tidspunktene, hjertene og det nye |
| `src/styles/ideer.css`, `src/styles/traad.css` | Utseendet |
| `.claude/skills/utfor-oppgaver/` | Hvordan Claude utfører oppgavene og merker dem utført |

Lenkene til en tråd, en idé eller en kommentar («Kopier lenke» og brikkene i
teksten) står i `docs/direktelenker.md`.

Idéer og Planlagte oppgaver åpnes fra idémenyen i toppmenyen (`Ideknapp`, en
`Nedtrekksmeny` med ett valg for hvert), og hvert av lagene har en knapp øverst
til det andre. Begge bruker `Modallag`, med `tilbake` i hodet på sidene inni.
`Ideknapp` eier begge lagene, og bare ett står åpent om gangen.

## Hvem som får gjøre hva

Alt håndheves av radsikkerheten og kolonnerettighetene i databasen:

- Alle innloggede leser alt, skriver idéer og kommentarer og gir hjerter.
- Forfatter og tidspunkt settes av databasen og kan ikke velges fra nettleseren.
- Bare forfatteren endrer en idé eller kommentar.
- Forfatteren eller en administrator sletter den.
- Et hjerte kan bare tas tilbake av den som ga det.
- Bare en administrator arkiverer, gjenoppretter og overfører idéer, og
  arbeider med oppgavene. Det går gjennom funksjonene nedenfor; tabellen
  `oppgaver` kan bare leses direkte.
- En arkivert eller overført idé er frosset (`ide_er_apen()`): ingen kan endre
  den, kommentere, gi hjerter eller slette noe i tråden. Forfatteren kan heller
  ikke slette den. En administrator kan slette en arkivert idé; en overført
  kan ingen slette.

## Sletting i tråden

En kommentar som har svar, slettes ikke helt. Teksten, forfatteren og hjertene
fjernes, og plassen står igjen som «Slettet», så svarene beholder
sammenhengen. Når det siste svaret under en slik kommentar forsvinner, ryddes
den bort, og det samme oppover i tråden. Det er utløsere i databasen som gjør
dette, så appen bare ber om å slette.

## Arkivet og Planlagte oppgaver

En åpen idé har to veier ut av lista, og begge velges av en administrator på
siden for idéen. Valget gjøres med én gang, og en melding nederst i vinduet
har «Angre» i ti sekunder (`Angretoast`). Angre bruker de samme funksjonene
som snur valget.

**Ikke aktuelt** (`arkiver_ide()`) setter `arkivert_kl`. Idéen står i skuffen
«Ikke aktuelt» nederst i lista, og alle kan lese den. En administrator kan
gjenopprette den (`gjenopprett_ide()`) i 60 dager, eller slette den. Etter 60
dager er den borte fra lesefunksjonene, og `rydd_idearkiv()` sletter den.
Appen kaller den når Idéer åpnes, så det trengs ingen jobb i bakgrunnen.
Fristen står både i `intern.arkivfrist()` og i `ARKIVFRIST_DAGER`.

**Overfør til planlagte oppgaver** (`overfor_ide()`) lager en rad i
`oppgaver`. Idéen står i skuffen «Planlagte oppgaver» i lista, og et kort der
åpner oppgaven. Oppgaven får idéens overskrift, men har sin egen
(`oppgaver.tittel`) som en administrator kan endre. Det er den oppgaven vises
og omtales med; idéen beholder sin. Oppgaven får også et løpenummer når den
overføres (`oppgaver.nummer`, vist som «OPG-001»), så den kan omtales og
gjenopptas med det hele veien. `overfor_ide()` gir neste nummer fra sekvensen
`intern.oppgavenummer`. Et nummer gis aldri igjen, heller ikke når oppgaven
flyttes tilbake, så en migrering som nevner det, kan ikke treffe en annen
oppgave. En oppgave går gjennom disse statusene:

1. `ikke_paabegynt`: rett etter overføringen.
2. `under_arbeid` («Påbegynt»): fra første gang overskriften eller prompten
   lagres (`lagre_oppgave()`).
3. `klar`: satt av en administrator (`sett_oppgave_klar()`), og bare med en
   prompt. Blir prompten tømt, er den påbegynt igjen.
4. `haandteres` («Håndteres nå av en agent»): satt av Claude med
   `ta_oppgaver(numre)` når arbeidet begynner, med `tatt_kl`. Alle numrene tas,
   eller ingen, så to økter kan ikke ta samme oppgave. Imens kan oppgaven ikke
   endres, merkes eller flyttes; en administrator kan frigi den
   (`frigi_oppgave()`), så den er klar igjen.
5. `utfort`: satt av Claude med `fullfor_oppgave(nummer, versjon)` når arbeidet
   er slått sammen, med versjonen i endringsloggen.

`ta_oppgaver()` og `fullfor_oppgave()` kan ingen i appen kalle. De kjøres som
migreringer etter administratorens ja (`*_oppgaver_tatt_*.sql` og
`*_oppgaver_utfort_*.sql`). Oppgavene de nevner, finnes bare i produksjon, så
migreringene gjør ingenting i en database uten oppgaver.

Prompten er ren tekst: den skal leses av en språkmodell. Ved overføringen
starter den med idéens beskrivelse, gjort om til ren tekst av
`intern.riktekst_som_tekst()`: avsnitt med en tom linje mellom, punkter med
«- » eller «1. » foran, og lenker med adressen i parentes. Har idéen ingen
beskrivelse, blir prompten overskriften. `flytt_oppgave_tilbake()`
er den eneste måten å fjerne en oppgave på, og gjør idéen åpen igjen. En
utført oppgave kan ikke endres eller flyttes. Idéen kan ikke slettes så lenge
den er en oppgave. Det gjelder også når brukeren som skrev den, slettes i
Supabase: det stoppes, så oppgaven ikke forsvinner med brukeren.

En utført oppgave har en knapp til føringen i endringsloggen. Den bruker
`visEndringslogg()` (`components/endringsloggvisning.ts`), som åpner loggen over
laget med føringen utfoldet. Knappen står bare når versjonen er publisert i
appen.

Slik Claude utfører oppgavene, står i skillen
`.claude/skills/utfor-oppgaver/`, som administratoren kjører med
`/utfor-oppgaver` i Claude Code.

## Det nye

`idebesok` husker når hver bruker sist åpnet hver idé. Siden merker idéen
som sett med tidspunktet tråden ble lest (`lest_kl` fra `idetraad()`), så en
kommentar som kom imellom, forblir ny (`merk_ide_sett()`). Idémenyen ser
etter nytt når appen åpnes, når fanen får fokus og hvert femte minutt.
Kommentarer fra andre etter det er nye: `ideoversikt()` teller dem per idé,
`ideer_med_nytt()` teller idéene til prikken på idémenyen og valget «Idéer», og `idetraad()`
gir tidspunktet, så siden kan merke dem «Ny». Regelen står også i
`erNyKommentar` i `src/traad/modell.ts`; endres den ett sted, endres den begge.

Varslene om nye kommentarer (bjella i toppmenyen) lages av databasen og står
i `docs/varsler.md`. Å åpne en idé merker også dem lest.

## Sorteringen

Førstekriteriet (kategori eller bruker, aldri tid) gir overskriftene;
andrekriteriet og det tredje, som er det som er igjen, gir rekkefølgen under
dem. Bare de åpne idéene står under overskriftene. Gruppert etter kategori
har hver kategori en knapp for en ny idé under den nederste, som starter
skjemaet med kategorien valgt. Tid står med de nyeste først. Valget lagres i `brukerinnstillinger` under
nøkkelen `ideer.sortering`, en liten tabell for valg som følger brukeren. Den
brukes også til andre slike valg, som temaet (`tema`, se `hooks/useKontotema.ts`);
lesing og skriving går gjennom `auth/innstillinger.ts`.

## Riktekst

Beskrivelsen og kommentarene bruker den samme editoren som stoffsidene,
med `referanser={false}`: verktøyraden har ikke referanseknappen, og
siteringer fjernes når teksten leses (`rensIdetekst`). Den har knappen «Direktelenke» (`direktelenker`), som
diskusjonene.
