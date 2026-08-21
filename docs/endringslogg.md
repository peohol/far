# Loggføringsprotokoll

Leses som **siste steg før en PR er klar til å slås sammen** — ikke underveis i
arbeidet. Da er det klart hva endringen faktisk ble, og føringen kan skrives én
gang i stedet for å måtte rettes for hver push.

## 1. Har denne grenen alt en føring?

Det skal være **nøyaktig én føring per PR**, uansett hvor mange pushes den har.

```
git show origin/main:src/data/endringslogg.ts | grep -m1 versjon
```

Er den øverste versjonen der ulik den øverste i arbeidstreet, ligger føringen
alt inne på grenen: **rediger den**. Legg aldri til en føring nummer to.

## 2. Skriv føringen

Øverst i `src/data/endringslogg.ts`. Nyest først.

```ts
{
  versjon: '1.1.0',
  dato: '2026-09-03',        // ISO. Datoen PR-en slås sammen.
  sammendrag: 'Én ekstremt kort linje om hva som ble gjort',
  typer: ['Funksjonalitet'],
  omfang: 'Mindre omfang',
  punkter: [
    'Det konkrete, i vanlig språk.',
    'Ett punkt per ting brukeren vil merke.',
  ],
}
```

## 3. Hvilket tall som økes

| Ledd | Når |
| --- | --- |
| MAJOR | Arbeidsflyten legges om slik at den som kan appen må lære den på nytt, eller fortolkningsgrunnlaget byttes ut. Sjelden. |
| MINOR | Appen kan noe den ikke kunne før: ny modul, ny kategori, ny valgmulighet, ny snarvei. |
| PATCH | Retting eller justering av noe som fantes fra før — utseende, ordlyd, tastaturdetaljer, og feil i eksisterende fortolkning. |

Ledd til høyre nullstilles: `0.5.4` → `0.6.0` → `1.0.0`.

## 4. Merker

**Type** — én eller flere:

| Merke | Gjelder |
| --- | --- |
| `Design / layout` | Utseende, plassering, luft, farger, ordlyd i grensesnittet |
| `Funksjonalitet` | Hva appen gjør: taster, flyt, felt, navigasjon |
| `Fag` | Analytter, enheter, grenser, formler, fortolkningsregler, kommentartekster |

`Fag` settes når endringen **kan endre kommentaren eller vurderingen** — også
når den bare retter opp noe som var feil.

**Omfang** — ett merke, vurdert skjønnsmessig. Beskrivelsene er veiledende:

| Merke | Omtrent |
| --- | --- |
| `Minimalt omfang` | Én detalj, merkes bare om man ser etter |
| `Mindre omfang` | Én tydelig endring, ett sted |
| `Moderat omfang` | Flere steder, eller noe man legger merke til med én gang |
| `Større omfang` | Endrer hvordan man arbeider i appen |
| `Betydelig omfang` | Ny modul eller kategori, eller noe som preger hele appen |

## 5. Språk

Føringen leses av legene som bruker appen. Skriv som til en kollega, ikke som
til en utvikler: ingen filnavn, funksjonsnavn, klassenavn eller
PR-nummer. `sammendrag` er én linje og tåler å være abstrakt; `punkter` er det
konkrete.

## 6. Fullfør

1. Sett `version` i `package.json` lik den nye versjonen, og oppdater låsefila
   med den: `npm install --package-lock-only`. Uten det blir versjonen stående
   igjen to steder i `package-lock.json`.
2. Kjør `npm test`. Testen i `src/domain/__tests__/versjon.test.ts` kontrollerer
   rekkefølge, datoer, merker og at `package.json` og `package-lock.json`
   stemmer.

## Vedlikehold

Filen vokser med rundt femten linjer per PR. Blir den upraktisk lang — over
noen hundre føringer — deles den per år (`src/data/endringslogg/2026.ts`) og
settes sammen igjen i `src/data/endringslogg.ts`. Ingenting annet trenger å
endres, siden appen bare leser `ENDRINGSLOGG`.
