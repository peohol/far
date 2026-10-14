# Evidensjournal – lurasidon

- **Oppgave:** `lurasidon-0002`
- **Modus:** de novo
- **Omfang:** full ordinær kuratering
- **Dekningsmodell:** 37 kontrollpunkter
- **Status:** blind protokoll låst før substansspesifikt kildesøk og før innsyn i eksisterende redaksjonelt innhold

## Låst blind evidensprotokoll

Eksisterende lurasidon-tekst, tidligere referanser og tidligere evidensjournal skal ikke leses før den blinde evidensinnhentingen og den adversarielle kontrollen er dokumentert og commit-et. Den maskinlesbare planen ligger i `docs/kurateringsjournal/lurasidon-dekning.json`.

### Kilde- og søkeplan

1. **Regulatorisk grunnlag:** norsk SPC/DMP, EMA/EPAR og FDA-label for identitet, indikasjoner, preparater, dosering, kontraindikasjoner, interaksjoner og sikkerhet.
2. **Kliniske virkninger:** sentrale randomiserte studier og systematiske oversikter/meta-analyser for schizofreni og andre relevante regulatoriske indikasjoner; absolutte og relative effektmål når de kan etterprøves.
3. **Farmakodynamikk:** regulatoriske dokumenter og originalkilder for reseptorprofil og plausibel mekanisme; mekanisme skal ikke fremstilles som dokumentert klinisk årsak.
4. **Farmakokinetikk:** matpåvirkning, biotilgjengelighet, Tmax, distribusjon, proteinbinding, CYP3A4-metabolisme, aktive metabolitter, eliminasjon, halveringstid og steady state.
5. **Interaksjoner og farmakogenetikk:** kliniske DDI-data og retningslinjer fra CPIC, DPWG/ClinPGx og FDA; fravær av handlingsbar PGx-anbefaling skal dokumenteres eksplisitt.
6. **TDM og laboratorieanalyse:** norske laboratoriekilder/Farmakologiportalen, AGNP og originale serumstudier; matriks, enhet, prøvetid og klinisk kontekst kontrolleres.
7. **Toksisitet:** Giftinformasjonen/Helsebiblioteket, regulatoriske kilder og originalserier/kasuistikker for dose, konsentrasjon, symptomer, komplikasjoner, tidsforløp og behandling.
8. **Graviditet, amming og fertilitet:** norsk SPC, LactMed, UKTIS/Embryotox og registre/originalstudier, med separat vurdering av neonatal påvirkning.
9. **Avhengighet og seponering:** regulatoriske kilder og klinisk litteratur om toleranse, rebound/seponeringsfenomener, misbrukspotensial og funksjonell mestringsavhengighet.
10. **Adversariell kontroll:** aktivt søk etter nullfunn, effekt-heterogenitet, akatisi/EPS, metabolsk og kardiell risiko, interessekonflikter og begrensninger i langtidsevidensen.

### Tall- og påstandskontroll

Alle tall skal få populasjon, endepunkt, tidsrom, sammenligning, estimat og usikkerhet når tilgjengelig. Påstander skal ha påstandsnær kilde. Direkte kopiering av formuleringer unngås. Serum- og plasmakonsentrasjoner blandes ikke, og norske referanseområder endres bare med eksplisitt kildegrunnlag.

### Fullføringskriterier

Samtlige 37 kontrollpunkter skal være vurdert som `dekket`, `ikke_relevant` eller eksplisitt begrunnet `kunne_ikke_verifiseres`. SPC- og runtimekontroll, dekningsvalidator, referansekontroll, migrasjonskontroll og relevante tester skal være bestått før utkast-PR meldes til køen.
