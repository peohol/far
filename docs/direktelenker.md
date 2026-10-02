# Direktelenkene

Leses når noe ved lenkene til en diskusjon, en idé eller en kommentar skal
endres: «Kopier lenke», brikkene i teksten, forhåndsvisningen eller knappen
«Direktelenke» i verktøyraden.

## Hvor det ligger

| Hvor | Hva |
| --- | --- |
| `supabase/migrations/*_direktelenker.sql` | `direktelenke(slag, id, kommentar)`: det en lenke peker på, med siden, overskriften, forfatteren, et utdrag og kommentaren; `null` når det ikke finnes eller ikke er lov å se |
| `src/direktelenker/mal.ts` | Formen på lenkene og lesingen av dem (rene funksjoner, ingen import fra resten av appen) |
| `src/direktelenker/modell.ts` | Lesingen av svaret, delene i navnet på brikken og utdraget |
| `src/direktelenker/api.ts` | Kallet, husket i et minutt |
| `src/components/direktelenker/` | Kopier-knappen, brikken med forhåndsvisningen, panelet i verktøyraden, meldingen og navigasjonen |
| `src/styles/direktelenker.css` | Utseendet |

## Lenkene

`#/diskusjon/<id>`, `#/ide/<id>`, og for en kommentar
`#/diskusjon/<id>/<kommentar>` og `#/ide/<id>/<kommentar>`. Lenken er hele
adressen til appen med dette etter `#`. Bare lenker til samme app godtas.

Når appen åpnes med en slik adresse, eller den limes inn i en åpen app, leser
`useRute` lenken, setter adressen tilbake til siden man står på, og
`apneDirektelenke` åpner målet: en diskusjon går til siden tråden hører til og
åpner den i diskusjonsmenyen (`visDiskusjon`), en idé åpnes i Idéer
(`visIde`). Har et skjema i Idéer eller Planlagte oppgaver endringer som
ikke er lagret, spør det først, som tilbakeknappen (`forlatIdelagene`,
`useMeldVakt`). Kommentaren lenken peker på, rulles frem, åpnes om den står under
en lukket gren, og uthevet en liten stund (`fremhev` på `Kommentartraad`).
Finnes ikke målet lenger, sier `Lenkemelding` det.

## Brikkene

En direktelenke i teksten er noden `direktelenke` i rikteksten, med `slag`,
`id`, `kommentar` og `etikett`. Etiketten er navnet slik det var da lenken ble
satt inn (side · emoji og overskrift · kommentar fra …), og brukes i ren tekst,
i søket og når målet ikke kan hentes. Ellers viser brikken navnet slik det er
nå. Peker den på noe som er borte, er den overstreket og gjør ingenting.

Alle editorer kjenner noden, så en brikke ikke forsvinner fra en tekst; bare
editorene med `direktelenker` (diskusjonene og idéene) har knappen som setter
dem inn. Knappen godtar bare en lenke som `malFraLenke` kjenner igjen og som
`direktelenke` finner, og viser hva den peker på før den settes inn.
