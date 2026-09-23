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
stabil ID (`src/domain/kommentarobjekt.ts`): ren tekst, uten mellomrom i
endene. Regelsettet inneholder ingen tekster, bare ID-ene scenariene peker
på. Motoren og valideringen får kommentarene å slå opp i ved siden av
regelsettet.

Dermed rettes en tekst ett sted, uten at regelen endres, og samme tekst kan
brukes av flere scenarier og flere regelsett. Foreløpig finnes regelsettene
og kommentarene bare i koden (se «Dagens regler»); lagringen i Supabase, der
de blir hver sine redigerbare objekter, er ikke laget ennå.

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
- kommentarene scenariene viser til, finnes;
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

## Dagens regler

`src/domain/rusregelsett.ts` er dagens rusmiddelregler skrevet som
scenarioregelsett, og tekstene fra `rusmidler.json` som kommentarer
(`RUS_KOMMENTARER`, med ID-en `rad/nøkkel`).
`src/domain/__tests__/rusparitet.test.ts` kjører dem mot `rus.ts` for alle
kombinasjoner av påviste analytter og et rutenett av konsentrasjoner på, rett
under og rett over hver grense, og krever identisk resultat og at hvert
scenario blir truffet. Filen er importgrunnlaget og fjernes når fortolkningen
leser regelsettene fra Supabase.
