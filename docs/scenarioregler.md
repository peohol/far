# Scenarioregler for sammensatte analyttgrupper

Leses når fortolkningen av rusmiddelmodulene — særlig analytter som vurderes
samlet — skal endres. Planen står i `docs/analyttsider-og-redigering.md`
(del 11 og arbeidspakke 6).

## Modellen

Et **scenarioregelsett** gjelder én fortolkningsmodul, f.eks.
`diazepamgruppen` med `DIAZ`, `DMI` og `OXA`. Det består av:

| Del | Hva |
| --- | --- |
| `analytter` | Modulens koder, i den rekkefølgen de vises |
| `forhold` | Navngitte forholdstall: summen av teller-kodene delt på summen av nevner-kodene, med en melding når nevneren er 0 |
| `parametere` | Navngitte grenser, lagret som andel (0,1 = 10 %) |
| `scenarier` | Nøyaktig hvilke analytter som er påvist, vilkår på forholdstallene, og utfallet |
| `verdihjelp` | Hvorfor modulen ber om konsentrasjoner |

Et **utfall** er enten kommentarer — hver med rolle (hoved/tillegg), merke,
kommentar-ID og kodene den limes inn på — og notiser, eller en eksplisitt
**manuell vurdering** med melding og veiledning og ingenting å kopiere.

## Kommentarene er egne objekter

Kommentar og regel er separate objekter (planen, del 2 og 11). En
kommentar — teksten som limes inn i pasientsvaret — er et eget objekt med
stabil ID (`src/domain/kommentarobjekt.ts`): et internt navn, ren tekst og
plassholderne teksten kan bruke. Formen er felles for alle regeltypene.
Scenarioreglene limer inn teksten slik den står og godtar ikke kommentarer
med plassholdere. Regelsettet inneholder ingen tekster, bare ID-ene
scenariene peker på. Motoren og valideringen får kommentarene å slå opp i ved siden av
regelsettet.

Dermed rettes en tekst ett sted, uten at regelen endres, og samme tekst kan
brukes av flere scenarier og flere regelsett. I Supabase er hvert regelsett
og hver kommentar sitt eget redigerbare objekt (se «Lagringen»).

Tekster i regelsettet kan vise en grense med `{nøkkel}`, som skrives ut i
prosent. Endres grensen, følger tekstene med.

## Reglene for et gyldig regelsett

`validerScenarioregelsett` i `src/domain/scenario.ts`:

- hver kombinasjon av påviste analytter har scenarier, og for hver
  kombinasjon gir hvert forholdstall — prøvd på 0, på hver grense, mellom
  grensene og over den høyeste — **nøyaktig ett** scenario. Da finnes ingen
  hull og ingen overlapp, og rekkefølgen på scenariene betyr ingenting.
- et forholdstall regnes bare av påviste analytter;
- hvert kommentarutfall har minst én hovedkommentar, entydige merker, og gir
  hver påvist analytt nøyaktig én kommentar;
- kommentarene scenariene viser til, finnes og har ingen plassholdere;
- grensene er tall større enn 0, og tekstene i regelsettet (meldinger,
  notiser, merker) er ikke tomme og viser bare til grenser som finnes.

En modul med bare én analytt regner den som påvist.

## Motoren

`kjorScenarier` tar regelsettet, kommentarene og det brukeren har svart,
og gir resultatet i samme form som `RusModul.fortolk` — pluss scenariet som
traff og forholdstallene, som simulatoren viser. Rekkefølgen:

1. Ingen påvist → be om avkrysning.
2. Scenariene for akkurat de påviste; konsentrasjonene deres forholdstall
   trenger, må være fylt inn.
3. En nevner på 0 gir forholdets melding.
4. Scenariet der alle vilkårene holder, gir utfallet.

## På analyttsiden

`src/components/regler/Scenarioregler.tsx` viser regelsettet på siden til
hver analytt i modulen: grensene, scenariene sortert etter hva som er påvist,
med vilkår og utfall, og kommentarene regelsettet viser til, nummerert, så
hver tekst står én gang (`src/domain/scenariovisning.ts`). Med mer enn ett scenario følger
«Prøv reglene», som bruker samme skjema (`Rusvalg`) og samme visning av
utfallet (`Rusutfall`) som fortolkningsmodulen, kjører `kjorScenarier` og
markerer scenariet som traff.

## Lagringen

Objekttypen `scenarioregelsett` (`supabase/migrations/*_scenarioregelsett.sql`)
har utkast, publisering, revisjoner og gjenoppretting som alt annet
faginnhold, og hele regelsettet står i hvert øyeblikksbilde. Delene ligger i
tabellene som begynner på `scenario`; en plassering peker på
`public.kommentarer` med kommentar-ID-en, og det publiserte regelsettet kan
bare peke på publiserte kommentarer. `intern.scenariofeil` validerer med
samme meldinger som `validerScenarioregelsett`, før noe lagres, og
`valider_scenarioregelsett` gir feilene uten å lagre, for redigeringen. En
modul har høyst ett regelsett, og en analyttkode hører til høyst ett.
`src/__tests__/scenarioregelsett.test.ts` sammenligner valideringen i
databasen med appens for dagens regelsett og et rutenett av endrede utgaver,
og prøver lagring, publisering, gjenoppretting, samtidighet og tilgang.

Dagens regler og tekster er importert og publisert
(`*_rusregler_import.sql`, laget med `scripts/rus-import.ts` fra det frosne
grunnlaget `src/domain/__tests__/fasit/rus-import.json`): tekstene som 31
kommentarobjekter og reglene som 17 regelsett som peker på dem.
`src/__tests__/rusimport.test.ts` kjører importen i testdatabasen og krever
at regelsettene, slik databasen gir dem tilbake, fortolker nøyaktig som
dagens moduler over hele paritetsrutenettet.

## Dagens regler

`src/domain/rusregelsett.ts` er dagens rusmiddelregler skrevet som
scenarioregelsett, og tekstene fra `rusmidler.json` som kommentarer
(`RUS_KOMMENTARER`, med ID-en `rad/nøkkel`).
`src/domain/__tests__/rusparitet.test.ts` kjører dem mot `rus.ts` for alle
kombinasjoner av påviste analytter og et rutenett av konsentrasjoner på, rett
under og rett over hver grense, og krever identisk resultat og at hvert
scenario blir truffet (`src/__tests__/hjelp/rusparitet.ts`). Filen er
importgrunnlaget og fjernes når fortolkningen leser regelsettene fra Supabase.
