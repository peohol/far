# Diskusjonene

Leses når noe ved diskusjonsmenyen eller trådene på fagsidene og
fortolkningssidene skal endres. Diskusjonene er brukernes samtaler om en side;
de berører ikke den kliniske delen.

## Hvor det ligger

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_diskusjoner.sql` | Tabellene, radsikkerheten, rekkefølgen, funksjonene appen kaller, og varslene |
| `src/diskusjoner/modell.ts` | Sidene, lesingen av svarene, grupperingen, flyttingene, reglene for navn og emoji, og søket (rene funksjoner) |
| `src/diskusjoner/api.ts` | Kallene mot Supabase, om menyen holdes åpen og hvor bred den er (`diskusjoner.laast` og `diskusjoner.bredde` i brukerinnstillingene) |
| `src/components/diskusjoner/` | Menyen (`Diskusjonsmeny`), lista (`Diskusjonsoversikt`), én tråd (`Diskusjonsside`) og skjemaene |
| `src/hooks/useSortering.ts`, `src/styles/sortering.css` | Dra-og-slipp, felles med redigeringen av stoffregisteret |
| `src/traad/modell.ts`, `src/components/traad/` | Kommentartråden, felles med idéene |
| `src/styles/diskusjoner.css`, `src/styles/traad.css` | Utseendet |

Lenkene til en tråd, en idé eller en kommentar («Kopier lenke» og brikkene i
teksten) står i `docs/direktelenker.md`.

## Sidene

En side er en nøkkel: `stoff:<stoffets nøkkel>` for en fagside,
`fortolkning:<analyttens nøkkel>` for fortolkningen av én analytt og
`register:stoffregister` for helsiden for stoffregisteret
(`diskusjonssideFor`). Forsiden, søket og fortolkningen uten valgt analytt har
ingen diskusjoner. Fortolkningen av en analytt har sin egen adresse,
`#/fortolkning/<nøkkel>`, så et varsel kan lenke dit. Får en fagside ny nøkkel,
flytter trådene og kategoriene med.

## Hvem som får gjøre hva

- Alle innloggede lager, endrer, flytter, arkiverer og henter tilbake tråder, og
  lager, endrer, flytter og løser opp kategorier.
- En tråd kan flyttes til en annen side (en annen fagside eller fortolkning),
  sist i en kategori der eller i en ny, med kommentarene og hjertene
  (`flytt_diskusjon_til_side()`). Appen følger tråden dit.
- Den som startet en tråd, kan slette den så lenge den ikke er arkivert og
  ingen andre har skrevet i den; en kommentar som står igjen som «Slettet»,
  teller ikke. En administrator kan slette alle tråder, også arkiverte
  (`slett_diskusjon()`, `kanSletteDiskusjon`). Alt i tråden går med.
- En arkivert tråd kan leses, men er frosset til den er hentet tilbake, og står
  i arkivet nederst i lista. Arkivet er lukket til man åpner det.
- Alle kan endre overskriften; bare den som skrev tråden, endrer det første
  innlegget.
- Kommentarene er som under idéene (svar i svar, hjerter, «Slettet» der det er
  svar), men bare forfatteren endrer og sletter sin egen, også for
  administratorer. En administrator kan i stedet **skjule** en kommentar eller
  det første innlegget: teksten fjernes for godt, og plassen står med en merknad. Appen
  tilbyr ikke det i en arkivert tråd; den hentes tilbake først.

Trådene og kategoriene skrives gjennom funksjonene i migrasjonen, som holder
rekkefølgen tett (0, 1, 2 …). Kommentarene og hjertene skrives rett mot
tabellene.

## Kategoriene

Hver kategori har navn og én emoji, og begge er unike på siden (uten hensyn
til store og små bokstaver i navnet). Reglene står både i databasen (unike
indekser) og i `kategorinavnFeil`/`emojiFeil`, så skjemaet sier fra før
lagring. En kategori slettes ikke når den blir tom.

Å **løse opp** en kategori sletter den og legger trådene sist under
«🫧 Ukategoriserte» (kategori null). Den vises bare når den har tråder, tar
ikke imot nye tråder, og navnet og emojien er reservert. Trådene der dras ut
til en kategori, eller flyttes med valget på tråden.

## Menyen

`Diskusjonsmeny` står fast til høyre på sider med diskusjoner. Lukket er den en
smal stolpe med knappen som holder den åpen, og emojien til hver kategori med
et blått tall for tråder med noe nytt. Den åpnes mens pekeren er over den eller
fokus er i den, og står åpen mens en tråd eller et skjema er åpent. Å holde den
åpen lagres på brukeren og gjelder alle sider.

Åpen kan menyen gjøres bredere ved å dra i venstre kanten, eller med
piltastene når kanten har fokus (Shift for større steg, Home og End for
smalest og bredest; dobbeltklikk gir smalest). Den smaleste bredden er den
menyen hadde fra før; den bredeste lar siden bak beholde plass
(`--diskusjonspanel-minst` og `--diskusjonspanel-mest` i `diskusjoner.css`).
Bredden lagres på brukeren og gjelder alle sider. Håndtaket er felles
(`src/components/Breddehandtak.tsx`).

Overskriften, søket i lista og, i en tråd, «Alle tråder» og overskriften på
tråden står fast; bare det under ruller. Overskriften på tråden står i en
plass i menyen (`.diskusjonspanel__traadhode`) som `Diskusjonsside` legger den
i med en portal, med en hårlinje mot det som ruller og blyanten som endrer
den til høyre. «Ny tråd» og «Ny kategori» følger lista, men blir stående
nederst i menyen når lista er lengre enn den. På smale skjermer åpnes den over
siden fra knappen «Diskusjoner» i toppmenyen, eller av seg selv når et
varsel leder til en tråd. Mens fokus er i menyen, er den et
lag (`data-lag`), så appens hurtigtaster venter.

Knappen ved siden av «Hold åpen» viser menyen som **helside** over hele
vinduet (`data-helside`), med det som stod åpent — oversikten eller en tråd —
i en lesebredde midt på (`--diskusjonshelside`). Det er en tilstand over siden
som står, ikke en egen adresse. Escape eller den samme knappen
går tilbake til menyen, åpen som før. Så lenge er resten av appen `inert`
(`useRestenInert`) og menyen et lag, også uten fokus.

Det brukeren har åpent (tråd, skjema, søk, arkiv, helside) bevares med
`useBevart`, tråden og skjemaet per side.

Nytt er som under idéene: en tråd er ny når noen andre har skrevet den og den
aldri er åpnet, eller når andre har kommentert etter at den sist ble åpnet
(`diskusjonsoversikt()`, `merk_diskusjon_sett()`).

## Søket

Søket gjelder siden man står på, med de arkiverte. Hvert ord må stå i
overskriften, det første innlegget eller en kommentar (`sokIDiskusjoner`).
Tekstene hentes først når man søker (`diskusjonstekster()`).

## Dra-og-slipp

Kategoriene og trådene dras loddrett med `@peohol/smett`, et lag over dnd-kit,
også mellom kategoriene. Hvilke lister som tar imot hva, står i markeringen
(`data-slag` og `data-tar`; se `useSortering`). Tastaturet løfter en rad med
mellomrom og flytter den med piltastene. Alle flyttinger kan også gjøres med
knapper: «Flytt opp»/«Flytt ned» på kategoriene, og kategorivalget og
«Flytt opp»/«Flytt ned» inne i en tråd.

Når man drar mot kanten av lista, ruller lista, aldri siden bak menyen
(`holdRullingenInne`): dnd-kit ruller ellers også siden for noe som står fast.

React eier rekkefølgen i DOM-en. Når man slipper, venter `useSortering` til
dnd-kit er helt ferdig (også animasjonen), legger radene tilbake der React
tegnet dem og tegner den nye rekkefølgen fra tilstanden. Gjøres det før,
setter dnd-kit inn igjen en rad React har tatt bort.

Smett ligger som en pakket fil i `vendor/` (`peohol-smett-<versjon>.tgz`) og
hentes først når lista vises. En ny versjon: bygg og pakk den i Smett-repoet
(`npm pack`), legg filen i `vendor/`, pek `package.json` på den og kjør
`npm install`.

## Varslene

Tre kategorier, laget av utløsere i databasen (se `docs/varsler.md`):
`mine_diskusjoner`, `aktive_diskusjoner` og `favorittdiskusjoner`. Å åpne
tråden merker varslene om den lest.
