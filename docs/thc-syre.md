# THC-syre i urin

Leses når noe ved fortolkningen av THC-syre (IRCAK) skal endres: motoren,
reglene, tekstene eller fasiten. Planen står i
`docs/analyttsider-og-redigering.md` (arbeidspakke 7).

THC-syre er en egen regelmotor, ikke en variant av konsentrasjonsbåndene eller
scenarioene for analyttgruppene. Kurvene, måleusikkerheten og den dynamisk
sammensatte kommentaren passer ikke i de generelle modellene uten å bli
uleselige.

## Status

Motoren, reglene og tekstene finnes som kode og data i appen, med fasit mot
den opprinnelige modulen. Fortolkningen i appen bruker fortsatt den
opprinnelige modulen (`src/domain/thc.ts`). Lagring i Supabase, redigering og
byttet av datakilde er ikke gjort ennå.

## Delene

| Hvor | Hva |
| --- | --- |
| `src/domain/thcRegelsett.ts` | Reglene: formen, og den ene kontrollen av dem |
| `src/domain/thcTekster.ts` | Tekstbolkene: hva hver er, når den brukes, og kontrollen av dem |
| `src/domain/thcKurver.ts` | Kurveregningen, og beviset for at kurvene står i rekkefølge |
| `src/domain/thcMotor.ts` | Motoren: fra inndata, regler og tekster til kommentar, konklusjon og tallgrunnlag |
| `src/domain/thcTall.ts` | Tall og datoer slik de tastes og skrives |
| `src/domain/thcPlot.ts` | Figuren med kurvene og de to prøvene |
| `src/domain/thc.ts` | Den opprinnelige modulen, med regnearkets konstanter i koden. Brukes av fortolkningen |
| `src/domain/__tests__/fasit/thc-regelsett-import.json`, `thc-tekster-import.json` | Reglene og tekstene slik de står i den opprinnelige modulen |
| `src/domain/__tests__/fasit/thc-fasit.json` | Fasiten: utfallet av den opprinnelige modulen for over 4000 inndata |
| `scripts/lag-thc-fasit.ts` | Lager fasiten på nytt, bare ved bevisst klinisk endring |

## Fremgangsmåten

Kilden er regnearket `originaldata/THC-COOH.xlsm`, med eierens senere tillegg.

1. **Forrige prøve.** IRCAK tastes, eller — når forrige prøve lå under
   cut-off — UCAK og NKRE, og IRCAK regnes som UCAK/NKRE.
2. **Målt endring** er aktuell/forrige − 1.
3. **Korrigert endring** er aktuell/forrige · exp(z · logSD · u) − 1, der
   logSD = √(2 · (CV_THC² + CV_kreatinin²)), z er kvantilet for den valgte
   sikkerhetsmarginen, og u er faktoren for måleusikkerhet under cut-off
   (ellers 1).
4. **Forventet endring** per kurve: kurven leses av der forrige prøve ligger,
   og like mange døgn senere.
5. **Konklusjonen** avgjøres av hvor mange kurver, fra grønn og utover, den
   korrigerte endringen ligger over (strengt større enn), og av grensene for
   bruksmønsteret: ved kronisk bruk skiller gul «ikke nødvendigvis» fra
   «vanskelig å avgjøre», og rød «vanskelig» fra nytt inntak; uten kronisk
   bruk er det grønn og gul.
6. **IRCAK 0 i forrige prøve** gir alltid nytt inntak, uten tallgrunnlag.
7. **Kommentaren** settes sammen av tekstbolker etter konsentrasjonsnivået i
   denne prøven og konklusjonen. Hvilke bolker hver konklusjon gir, er en
   regel i motoren (`velgTekstbolker`); ordlyden står i tekstene.

## Regler og tekster er adskilt

Reglene avgjør konklusjonen. Tekstene er ordlyden kommentaren bygges av. De er
to adskilte ting, som prosjektets arkitekturregel om kommentar og regel krever:

- **Reglene** (`ThcRegelsett`) har ingen tekst som havner i kommentaren. De
  eneste ordene der er navnene på nivåene («lav», «middels høy», «høy»), som
  settes inn for plassholderen `{nivå}`, og navnene på kurvene i figuren.
- **Tekstene** (`ThcTekster`) er én tekst per bolk. Hver bolk har en fast
  rolle — nøkkelen, f.eks. `vanskelig` — og kan inneholde plassholderne
  `{nivå}` og `{forrige prøvedato}`, som fylles inn når kommentaren settes
  sammen. Hvilke plassholdere hver bolk må ha og kan ha, står i
  `THC_TEKSTBOLKER`.

Motoren tar imot begge, satt sammen og kontrollert, som en `ThcModell` fra
`lagThcModell`.

## Reglene

| Del | Innhold | Invarianter |
| --- | --- | --- |
| Konverteringsfaktor | Fra kildedataenes enheter til IRCAK | > 0 |
| Kurver | Grønn, gul og rød: navn, a1, k1, a2, k2 (amplitudene i kildeenheter) | Alle > 0; grønn gir minst like rask utskillelse som gul, og gul som rød, for enhver forrige prøve og ethvert tidsrom |
| Måleusikkerhet | CV for THC-syre og kreatinin, faktor under cut-off | 0 < CV < 1; faktor ≥ 1 |
| Sikkerhetsmarginer | Margin og z, og hvilken som er standard | 0,5 ≤ margin < 1, stigende; z = Φ⁻¹(1 − margin) innenfor 1e-9; standarden finnes |
| Konsentrasjonsnivåer | Navn, nedre grense, om nivået tyder på nylig inntak | Det laveste uten grense, resten stigende; ulike navn |
| Bruksmønstre | Kurven hver konklusjon ligger over, for kronisk og ikke-kronisk bruk | Nytt inntak er en tregere kurve enn «vanskelig» |
| Varsel | Døgn mellom prøvene før varselet | Helt tall ≥ 1 |

Grensene er matematisk entydige: et nivå gjelder fra og med sin nedre grense
og opp til, men ikke med, neste nivås. Det er skillepunktet som lagres, én
gang, ikke to grenser som må holdes like.

z lagres ved siden av marginen fordi 1 − margin ikke kan regnes eksakt i
flyttall (1 − 0,99 er ikke 0,01). z-en regnearket bruker, er kontrollert mot
AS 241 (`normalkvantil`).

Den lilla kurven i regnearket («Kronisk, typisk») er ikke med: verken
konklusjonen eller figuren bruker den.

## Kontrollen

`validerThcRegelsett` er den ene kontrollen av reglene: alt over, også
kurvenes rekkefølge, står der, og en tom liste betyr at reglene kan brukes.
`validerThcTekster` gjør det samme for tekstene. Motoren tar bare imot en
`ThcModell`, og den fås bare fra `lagThcModell`, som kjører begge. Typene
(`GodkjentThcRegelsett`, `GodkjenteThcTekster`) gjør det umulig å gi motoren
noe som ikke er kontrollert.

**Kurvenes rekkefølge** er bevist for hele domenet motoren godtar — enhver
forrige prøve over 0 og ethvert tidsrom — ikke prøvd på utvalgte punkter.
Beviset står øverst i `thcKurver.ts`. Kort fortalt: kurve A forventer minst
like stor nedgang som kurve B fra enhver forrige prøve over ethvert tidsrom
hvis og bare hvis utskillelsesraten til A er minst like stor som B sin ved
hver konsentrasjon. Raten ved en konsentrasjon har en lukket form for
bi-eksponentielle kurver. Med samme rater avgjøres ulikheten direkte. Ellers
avgjøres den i endene av grenseverdiene, og i midten av en oppdeling som er et
bevis, fordi begge ratene stiger med konsentrasjonen. Et avvik oppgis med
hvor det er: ved lave eller høye konsentrasjoner, eller rundt en bestemt IRCAK.

For at motoren skal regne den samme modellen som beviset gjelder for, utvides
søket etter tidspunktet på kurven når forrige prøve ligger lenger ut enn
±1000 døgn. Det skjer bare for IRCAK langt under det laboratoriet kan måle.
Innenfor gir søket de samme tallene som før, bit for bit.

## Fasiten

Motoren er skrevet slik at regnestykkene skjer i nøyaktig samme rekkefølge som
i den opprinnelige modulen, og gir samme resultat helt ned til siste siffer.
To sett tester holder det slik:

- `thcMotor.test.ts` kjører motoren med de importerte reglene og tekstene over
  hele fasiten. Den krever samme kommentar tegn for tegn, samme konklusjon,
  samme varsel og samme mangler for hvert tilfelle, og samme SHA-256 over alt
  tallgrunnlaget og et utvalg figurer. Tilfellene ligger rett på, rett under
  og rett over hver kurvegrense (nabo-flyttallene) og skillepunktene mellom
  nivåene. De dekker også IRCAK 0, under cut-off, ingen tidligere prøve,
  varselgrensen og ugyldige felt. Beskrivelsen står i `hjelp/thcFasit.ts`.
- `thcParitet.test.ts` kjører den opprinnelige modulen og motoren side om
  side på 20 000 tilfeldige inndata. Den fjernes sammen med den opprinnelige
  modulen; da står fasiten igjen.

Fasiten lages bare på nytt når den kliniske outputen endres med vilje, i samme
PR som endringen, og da med merket «Fag» i endringsloggen.
