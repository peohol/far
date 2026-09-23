# THC-syre i urin

Leses når noe ved fortolkningen av THC-syre (IRCAK) skal endres: motoren,
regelsettet, redigeringen eller fasiten. Planen står i
`docs/analyttsider-og-redigering.md` (arbeidspakke 7).

THC-syre er en egen regelmotor, ikke en variant av konsentrasjonsbåndene eller
scenarioene for analyttgruppene. Kurvene, måleusikkerheten og den dynamisk
sammensatte kommentaren passer ikke i de generelle modellene uten å bli
uleselige.

## Delene

| Hvor | Hva |
| --- | --- |
| `src/domain/thcRegelsett.ts` | Formen på regelsettet, tekstbolkene og valideringen |
| `src/domain/thcMotor.ts` | Motoren: fra inndata og regelsett til kommentar, konklusjon og tallgrunnlag |
| `src/domain/thcTall.ts` | Tall og datoer slik de tastes og skrives |
| `src/domain/thcPlot.ts` | Figuren med kurvene og de to prøvene |
| `src/domain/thc.ts` | Den opprinnelige modulen, med regnearkets konstanter i koden. Brukes av fortolkningen til byttet er gjort |
| `supabase/migrations/*_thc_regelsett*.sql` | Tabellene, valideringen på serveren, importen og rettingen av sifrene |
| `scripts/thc-import.ts` | SQL-en som importerte regelsettet |
| `src/__tests__/thcRegelsettlagring.test.ts` | Lagringen, prøvd mot en ekte database |
| `src/domain/__tests__/fasit/thc-regelsett-import.json` | Regelsettet slik det ble importert fra den opprinnelige modulen |
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
   denne prøven og konklusjonen. Vilkårene for hver bolk står i
   `THC_TEKSTBOLKER` og `velgTekstbolker`.

## Regelsettet

Alt som er fagkunnskap, står i regelsettet, ikke i koden:

| Del | Innhold | Invarianter |
| --- | --- | --- |
| Konverteringsfaktor | Fra kildedataenes enheter til IRCAK | > 0 |
| Kurver | Grønn, gul og rød: navn, a1, k1, a2, k2 (amplitudene i kildeenheter) | Alle > 0; grønn gir raskest og rød langsomst utskillelse |
| Måleusikkerhet | CV for THC-syre og kreatinin, faktor under cut-off | 0 < CV < 1; faktor ≥ 1 |
| Sikkerhetsmarginer | Margin og z, og hvilken som er standard | 0,5 ≤ margin < 1, stigende; z = Φ⁻¹(1 − margin) innenfor 1e-9; standarden finnes |
| Konsentrasjonsnivåer | Navn, nedre grense, om nivået tyder på nylig inntak | Det laveste uten grense, resten stigende; ulike navn |
| Bruksmønstre | Kurven hver konklusjon ligger over, for kronisk og ikke-kronisk bruk | Nytt inntak er en tregere kurve enn «vanskelig» |
| Varsel | Døgn mellom prøvene før varselet | Helt tall ≥ 1 |
| Tekster | Én tekst per bolk, med plassholderne `{nivå}` og `{forrige prøvedato}` | Ikke tom, uten mellomrom i endene; påkrevde plassholdere med, ukjente ikke |

Grensene er matematisk entydige: et nivå gjelder fra og med sin nedre grense
og opp til, men ikke med, neste nivås. Det er skillepunktet som lagres, én
gang, ikke to grenser som må holdes like.

z lagres ved siden av marginen fordi 1 − margin ikke kan regnes eksakt i
flyttall (1 − 0,99 er ikke 0,01). z-en regnearket bruker, er kontrollert mot
AS 241 (`normalkvantil`).

Bolkene bindes sammen med ett mellomrom. Tekstene lagres derfor uten
mellomrom i endene.

Den lilla kurven i regnearket («Kronisk, typisk») er ikke med: verken
konklusjonen eller figuren bruker den.

## Lagringen

Regelsettet er objekttypen `thc_regelsett` i faginnholdet
(`docs/faginnhold.md`), med utkast, publisering, revisjoner, gjenoppretting
og samtidighetskontroll derfra. Det finnes bare ett: en unik indeks per
tilstand, og `opprett_utkast` avvises når det alt finnes.

Delene har egne tabeller med kontroller på hver kolonne: `thc_regelsett`
(enkeltverdiene), `thc_kurver`, `thc_sikkerhetsmarginer`,
`thc_konsentrasjonsnivaer`, `thc_bruksmonstre` og `thc_tekstbolker`. Tallene
er `float8`, som i motoren. `intern.skriv_thc_regelsett` kontrollerer de samme
invariantene som `validerThcRegelsett`, med de samme meldingene der det lar
seg gjøre — også z mot AS 241 og kurverekkefølgen over det samme rutenettet.
Testene sender over 25 ugyldige regelsett til begge og krever at begge
avviser dem.

`les_thc_regelsett('publisert' | 'utkast')` gir regelsettet med revisjon og
hvem som sist endret det; utkastet bare til administratorer. Tabellene kan
ikke skrives direkte.

Øyeblikksbildet skal gi nøyaktig de samme flyttallene tilbake, og
`les_thc_regelsett` setter derfor selv `extra_float_digits` (se
`docs/faginnhold.md`).

**Importen** (`*_thc_regelsett_import.sql`, laget av `scripts/thc-import.ts`)
la regelsettet fra den opprinnelige modulen inn gjennom `opprett_utkast` og
`publiser_utkast`, som Peder, med kilden i revisjonen. Revisjon 1 fikk bare 15
sifre i tallene. Revisjon 2 (`*_thc_regelsett_flyttall.sql`) har alle, og er
lik `thc-regelsett-import.json` tall for tall. Det er den som er publisert.

## Fasiten

Motoren er skrevet slik at regnestykkene skjer i nøyaktig samme rekkefølge som
i den opprinnelige modulen, og gir samme resultat helt ned til siste siffer.
To sett tester holder det slik:

- `thcMotor.test.ts` kjører motoren med det importerte regelsettet over hele
  fasiten og krever samme kommentar tegn for tegn, samme konklusjon, samme
  varsel og samme mangler for hvert tilfelle, og samme SHA-256 over alt
  tallgrunnlaget og et utvalg figurer. Tilfellene ligger rett på, rett under og
  rett over hver kurvegrense (nabo-flyttallene) og skillepunktene mellom
  nivåene, i tillegg til IRCAK 0, under cut-off, ingen tidligere prøve,
  varselgrensen og ugyldige felt. Beskrivelsen står i `hjelp/thcFasit.ts`.
- `thcParitet.test.ts` kjører den opprinnelige modulen og motoren side om
  side på 20 000 tilfeldige inndata. Den fjernes sammen med den opprinnelige
  modulen; da står fasiten igjen.

Fasiten lages bare på nytt når den kliniske outputen endres med vilje, i samme
PR som endringen, og da med merket «Fag» i endringsloggen.
