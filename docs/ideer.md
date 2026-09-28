# Idéene

Leses når noe ved idévinduet skal endres. Idéene er brukernes forslag til
OUSFAR, med hjerter og kommentartråder; de berører ikke den kliniske delen.

## Hvor det ligger

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_ideer.sql` | Tabellene, radsikkerheten, reglene for sletting og de to lesefunksjonene |
| `src/ideer/modell.ts` | Sorteringen, kommentartreet, tidspunktene og lesingen av svarene (rene funksjoner) |
| `src/ideer/api.ts` | Kallene mot Supabase |
| `src/components/ideer/` | Vinduet: lista, siden for én idé, skjemaet og tråden |
| `src/styles/ideer.css` | Utseendet |

Vinduet åpnes fra kontomenyen og bruker `Modallag`, med `tilbake` i hodet på
sidene inni det.

## Hvem som får gjøre hva

Alt håndheves av radsikkerheten og kolonnerettighetene i databasen:

- Alle innloggede leser alt, skriver idéer og kommentarer og gir hjerter.
- Forfatter og tidspunkt settes av databasen og kan ikke velges fra nettleseren.
- Bare forfatteren endrer en idé eller kommentar.
- Forfatteren eller en administrator sletter den.
- Et hjerte kan bare tas tilbake av den som ga det.
- Bare en administrator gir en idé status, gjennom `sett_idestatus()`.

## Sletting i tråden

En kommentar som har svar, slettes ikke helt. Teksten, forfatteren og hjertene
fjernes, og plassen står igjen som «Slettet», så svarene beholder
sammenhengen. Når det siste svaret under en slik kommentar forsvinner, ryddes
den bort, og det samme oppover i tråden. Det er utløsere i databasen som gjør
dette, så appen bare ber om å slette.

## Status og det nye

Statusen (`public.idestatus`) er valgfri og settes av en administrator. Å gi
status regnes ikke som å endre idéen.

`idebesok` husker når hver bruker sist åpnet hver idé. Siden merker idéen
som sett med tidspunktet tråden ble lest (`lest_kl` fra `idetraad()`), så en
kommentar som kom imellom, forblir ny (`merk_ide_sett()`). Kontomenyen ser
etter nytt når appen åpnes, når fanen får fokus og hvert femte minutt.
Kommentarer fra andre etter det er nye: `ideoversikt()` teller dem per idé,
`ideer_med_nytt()` teller idéene til prikken i kontomenyen, og `idetraad()`
gir tidspunktet, så siden kan merke dem «Ny». Regelen står også i
`erNyKommentar` i `modell.ts`; endres den ett sted, endres den begge.

## Sorteringen

Førstekriteriet (kategori eller bruker, aldri tid) gir overskriftene;
andrekriteriet og det tredje, som er det som er igjen, gir rekkefølgen under
dem. Tid står med de nyeste først. Valget lagres i `brukerinnstillinger` under
nøkkelen `ideer.sortering`, en liten tabell for valg som følger brukeren. Den
brukes også til andre slike valg, som temaet (`tema`, se `hooks/useKontotema.ts`);
lesing og skriving går gjennom `auth/innstillinger.ts`.

## Riktekst

Beskrivelsen og kommentarene bruker den samme editoren som stoffsidene,
med `referanser={false}`: verktøyraden har ikke referanseknappen, og
siteringer fjernes når teksten leses (`rensIdetekst`).
