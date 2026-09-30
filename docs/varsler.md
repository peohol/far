# Varslene

Leses når noe ved bjella, varselvinduet eller hva som gir varsel skal endres.
Varslene berører ikke fortolkningen; de forteller bare at noe er endret.

## Hvor det ligger

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_varsler.sql` | Tabellen, utløserne som lager varslene, og funksjonene som leser og merker dem lest |
| `supabase/migrations/*_favorittvarsler*.sql` | Varslene om endringer på favorittsidene, og hvordan hendelsene leses |
| `supabase/migrations/*_nye_ideer_varsler.sql` | Varslene om nye idéer |
| `supabase/migrations/*_diskusjoner.sql` | Varslene om diskusjonene (se `docs/diskusjoner.md`) |
| `src/varsler/modell.ts` | Kategoriene, valgene, føringene i endringsloggen som varsler, sorteringen og tekstene (rene funksjoner) |
| `src/varsler/api.ts` | Kallene mot Supabase og brukerinnstillingene |
| `src/components/varsler/` | Bjella (`Varselknapp`), tilstanden (`useVarsler`) og vinduet (`Varsler`) |
| `src/styles/varsler.css` | Vinduet. Tallet på bjella står i `toppmeny.css` |

## Kategoriene

| Kategori | Når | Kan slås av |
| --- | --- | --- |
| `fortolkning` | En kommentar eller et regelsett publiseres, eller en føring i endringsloggen har `endrerFortolkning` | Nei |
| `mine_ideer` | Noen kommenterer en idé du skrev, eller svarer på en kommentar du skrev | Nei |
| `aktive_ideer` | Noen kommenterer en idé du har kommentert, uten at det er et svar til deg | Ja, på som standard |
| `nye_ideer` | Noen skriver en ny idé | Ja, av som standard |
| `mine_diskusjoner` | Noen kommenterer en tråd du startet, eller svarer på en kommentar du skrev i en tråd | Nei |
| `aktive_diskusjoner` | Noen kommenterer en tråd du har kommentert, uten at det er et svar til deg | Ja, på som standard |
| `funksjonalitet` | En ny føring i endringsloggen | Ja, på som standard |
| `favoritter` | Noen publiserer endringer på en fagside du har som favoritt | Ja, av som standard |
| `favorittdiskusjoner` | Noen starter en ny tråd på en fagside du har som favoritt | Ja, av som standard |

Kategoriene står i `VARSELKATEGORIER`. Hver har en `gruppe` fra
`VARSELGRUPPER` (Fortolkning, Idéer, Diskusjoner, Favorittsider, Appen):
innstillingene viser gruppene i den rekkefølgen, hver med ikon og overskrift
og kategoriene sine under. Ikonene for gruppene står i `Varsler.tsx`. En ny
kategori får en gruppe; den trenger ingen ny gruppe med mindre den gjelder
noe helt annet. De som lages av databasen, er de
samme som `public.varselkategori`; en test passer på at de stemmer. En ny
kategori legges til med `alter type public.varselkategori add value` i en egen
migrasjon, og sist i `DATABASEKATEGORIER`. Utløseren som bruker den, skrives i
plpgsql, siden den nye verdien ikke kan brukes før migrasjonen er ferdig.
Brukerens valg lagres i `brukerinnstillinger` under `varsler.valg`, og
databasen lager varsler i alle kategoriene: det er appen som viser dem
brukeren har valgt. Å slå en kategori av og på igjen gir dem tilbake.

## Varslene i databasen

Utløsere lager varslene når noe skjer, gjennom `intern.varsle()`. Den som
gjorde det, varsles ikke.

- **Idékommentarer** (`idekommentarer_varsle`): idéens forfatter og den som
  fikk svar får `mine_ideer`, de andre som har kommentert i tråden
  `aktive_ideer`.
- **Nye idéer** (`ideer_varsle`): alle andre enn den som skrev idéen, får
  `nye_ideer`, ett varsel per idé. Det er lest når idéen åpnes, som varslene
  om kommentarene.
- **Diskusjonskommentarer** (`diskusjonskommentarer_varsle`): som
  idékommentarene, med `mine_diskusjoner` og `aktive_diskusjoner`.
- **Nye tråder** (`diskusjoner_varsle`): en ny tråd på en fagside gir
  `favorittdiskusjoner` til dem som har siden som favoritt, ett varsel per
  tråd. Å åpne tråden merker varslene om den lest.
- **Fortolkningen** (`objektpubliseringer_varsle`): hver publisering av en
  kommentar eller et regelsett (`intern.er_fortolkning`) varsler alle andre.
  Et utkast som lagres, varsler ingen: varselet kommer når endringen er
  publisert.

Uleste varsler om det samme er **ett varsel**: ett om fortolkningen, og ett
per idé eller tråd og kategori (`gruppe`). En ny hendelse legges i det uleste varselet;
når varselet er lest, begynner neste på et nytt. Samme fortolkningsobjekt
står bare én gang, med den siste publiseringen.

Hendelsene lagrer ID-er, og navnene slås opp når varslene leses
(`mine_varsler()`): en kommentar med navnet sitt, et regelsett med
analyttkodene, og analyttkoden reglene står under på stoffsiden, så varselet
kan lenke dit. En idékommentar som er slettet, forsvinner fra varselet, og et
varsel uten hendelser vises ikke. Slettes idéen, går varslene med.

`mine_varsler()` gir alle uleste og de leste fra de siste 30 dagene
(`intern.varselfrist()`, og `VARSELFRIST_DAGER` i appen), med `lest_kl`.
`merk_varsler_lest(varsler, til)` merker dem lest slik de var da lista ble
lest, så et varsel som har fått noe nytt imens, står ulest. Den rydder også
bort leste varsler eldre enn fristen. Å åpne en idé (`merk_ide_sett`) merker
varslene om den lest. `uleste_varsler()` teller de uleste per kategori, til
tallet på bjella. Tabellen kan bare leses, og bare egne rader.

## Endringsloggen

Føringene i `src/data/endringslogg.ts` er varsler i appen, ikke i databasen:
de kommer med appen selv. Hvor langt brukeren er kommet, lagres i
`brukerinnstillinger` under `varsler.endringslogg`: `fra` (føringene til og
med denne er historie) og `lest` (de nyere som er lest). Første gang
begynner brukeren rett før den nyeste føringen, så den er et varsel og resten
ikke. `merkEndringerLest` flytter `fra` forbi de eldste leste som har passert
fristen, så lista over leste ikke vokser.

En føring er `funksjonalitet`, eller `fortolkning` når den har
`endrerFortolkning: true` (se `docs/endringslogg.md`). En føring med
`utenVarsel: true` merkes ikke i appen, er ikke noe varsel og ber ingen
oppdatere siden. En stille designjustering har ingen føring i det hele tatt.

## Bjella og vinduet

`Varselknapp` står rett til venstre for profilbildet. Tallet er de uleste i
de valgte kategoriene, med «9+» over ni, og hentes når appen og fanen åpnes og
hvert femte minutt (`useJevnligSjekk`, som idémenyen også bruker), og når
noe annet i appen ber om det (`oppfriskVarsler`, når Idéer lukkes).

Vinduet viser de uleste under «Nye» og resten under «Tidligere». Et varsel
leder dit det gjelder, og er lest når man går dit: idéen (`visIde`, som
`Ideknapp` hører etter), tråden på siden den står på (`visDiskusjon`, som
`Diskusjonsmeny` hører etter), føringen i endringsloggen (`visEndringslogg`) eller
reglene på stoffsiden. «Merk som lest» og «Merk alle som lest» gjør det
samme uten å gå noe sted; «Merk alle som lest» gjelder bare kategoriene brukeren har slått på. Tannhjulet åpner innstillingene, der de
obligatoriske kategoriene står låst.

## Favorittene

Når en redaktør publiserer endringer på en fagside, får alle som har stoffet
som favoritt (`stoffavoritter`, etter nøkkelen) et varsel, unntatt redaktøren.
Det er publiseringen som varsler, ikke lagringen: utkastene underveis varsler
ingen, så varselet kommer først når redigeringen er ferdig.

Utløseren på `objektpubliseringer` (`intern.varsle_favoritter`) ser på sidens
objekter og finner delene som er endret (`intern.endrede_sidedeler`):

- et innholdselement: panelet det står i, og panelet det sto i før, hver på sin
  side (et kort som fjernes, flyttes til `fjernet`, som ikke telles; et kort
  som flyttes til en annen side, er en endring på begge);
- siden selv: `navn` når navnet eller nøkkelen er endret, og panelene der
  panelreferansene er endret;
- en referanse som er endret: panelene der de publiserte sidene siterer den.

Gruppen er `favoritter:<sidens ID>`, så alt som publiseres på en side før
brukeren har lest varselet, blir ett varsel. Hendelsene har `side` og `deler`;
`mine_varsler` gir siden med navnet og nøkkelen slik de er nå
(`intern.varselside`). Vinduet viser «Ola Nordmann endret Litium» med delene
under, i sidens rekkefølge, og lenker til den første delen som er et sted på
siden. Reglene siden viser, varsles som endringer i fortolkningen.
