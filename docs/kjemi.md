# Kjemiske grunndata fra PubChem

Leses når noe som har med forbindelsene, koblingene til PubChem, synkroniseringen
eller seksjonen «Kjemiske grunndata» på fagsidene skal endres. Driftstatusen og
endringsloggen står i `docs/datakilder.md`.

## Forbindelser er ikke fagsider

En fagside handler om et virkestoff eller rusmiddel (`src/data/stoffregister.json`).
En **forbindelse** er det kjemiske stoffet en analyse faktisk måler, med sin egen
molekylvekt. Hver fagside har sin egen forbindelse, og metabolittene
laboratoriene måler, er egne forbindelser:

- flere forbindelser kan høre til samme fagside (citalopram og
  desmetylcitalopram; THC, THC-OH og THC-COOH; bupropion og hydroksybupropion);
- én forbindelse kan høre til flere fagsider (desmetylcitalopram til
  citalopram og escitalopram, nortriptylin som eget stoff og som metabolitt av
  amitriptylin).

Forbindelsene står i `src/data/forbindelser.ts`, med `stoffer` (fagsiden og
om forbindelsen er `selve_stoffet` eller en `metabolitt` der) og `form`:

| Form | Brukes for |
| --- | --- |
| `fri` | den frie basen, syren eller nøytrale forbindelsen, som laboratoriene oppgir konsentrasjonen for |
| `ion` | et ion som måles som sådan (litium) |
| `salt` | bare når laboratoriet faktisk oppgir saltet |

Molekylvekten som skal brukes i en omregning, er alltid den målte formens —
aldri saltet legemiddelet selges som (valproinsyre, ikke natriumvalproat;
GHB som fri syre, ikke natriumoksybat; kandesartan, ikke forløperen
kandesartancileksetil). `merknad` sier fra der det kan forveksles.

## Koblingen til PubChem

En forbindelse er koblet til én CID i PubChem (`pubchem`), med InChIKey og
formelen koblingen ble kontrollert mot, datoen og grunnlaget i en setning.
Koblingen endres bare i datafilen, i en PR; synkroniseringen legger aldri til
eller endrer noen.

Koblingene lages og kontrolleres med

```
npx vite-node scripts/kurer-forbindelser.ts -- [--alle] [--skriv] [nøkkel …]
```

som slår opp det engelske navnet i PubChem og kontrollerer treffet mot
uavhengige kilder (`src/kjemi/kurering.ts`). Et navnetreff alene er aldri nok:

1. PubChem må ha **nøyaktig én** forbindelse med navnet, og den må være én
   kovalent enhet (ikke et salt eller en blanding), med mindre formen er `salt`.
2. Minst én uavhengig kilde må ha samme InChIKey: ClinPGx' henvisning til
   PubChem (et salt der byttes med moderforbindelsen PubChem oppgir), eller
   ChEBI med samme navn. Navnene som slås opp der, er det engelske navnet,
   `synonymer` i datafilen og PubChems tittel på treffet; HTML-merking og greske
   bokstaver i ChEBIs navn regnes ikke med.
3. Har den uavhengige kilden samme skjelett (første blokk i InChIKey), men en
   annen stereokjemi eller protonering, godtas treffet bare når det er PubChems
   egen post for navnet (tittelen er navnet). Formelen og molekylvekten er da de
   samme, og forskjellen står i grunnlaget.

Alt annet blir `uavklart`, med grunnen og kandidatene, til noen har vurdert det.
Skriptet endrer aldri en kobling som står; avviker kontrollen fra den, skrives
avviket ut.

Kontrollert 8. oktober 2026: 135 av 136 forbindelser er koblet. Uavklart:

| Forbindelse | Hvorfor |
| --- | --- |
| Desmetylklomipramin | PubChem har én forbindelse for «desmethylclomipramine» (CID 622606, Norclomipramine), men verken ClinPGx eller ChEBI har den, så ingen uavhengig kilde bekrefter den |

## Synkroniseringen

`/api/pubchem-synk` (`src/kjemi/endepunkt.ts`, `synk.ts`) kjøres hver uke av
Vercel (`vercel.json`) og med «Hent nå» i «Datakilder». Én kjøring henter
egenskapene for alle de koblede forbindelsene (`POST
…/compound/cid/property/…`, høyst hundre CID-er per kall, alle kall gjennom én
kø med minst 250 ms mellom hvert; PubChem tillater fem i sekundet) og
kontrollerer hver:

- svaret må ha forbindelsen, og formelen, en molekylvekt som er et tall og en
  InChIKey med riktig form (`lesPubchemrad`);
- InChIKey og formelen må være de koblingen ble kontrollert mot. Er de ikke
  det, er det en **konflikt**: dataene fra før står, og koblingen må vurderes
  på nytt i datafilen.

Det som består, byttes inn, feilen noteres på resten og kjøringen avsluttes,
alt i én transaksjon (`pubchem_fullfor_synk`); er noe feilet, blir kjøringen
«delvis». Går noe galt der, er ingenting byttet inn. Mangler mer enn to
forbindelser (eller en tidel) i svaret eller kan de ikke leses, tyder det på en
feil hos PubChem eller et endret format, og da byttes ingenting inn.
Forbindelsene uten verifisert kobling står i kjøringen (`antall.uavklarte`) og
under «Til vurdering» i «Datakilder».

Kjøringen lager ingen commit og ingen migrasjon. Svaret slik det kom, lagres
ved siden av det OUSFAR leste (`raa`), med parserversjonen. En endring som bare
kommer av at OUSFAR leser svaret annerledes (samme svar, ny `PARSERVERSJON`),
logges som metadata med parserversjonene i sporet; en endring i formelen,
molekylvekten, InChIKey, ladningen, antall enheter eller stereokjemien er
klinisk, i tittelen, IUPAC-navnet og den monoisotopiske massen metadata.

## På fagsidene

Seksjonen «Kjemiske grunndata» (`src/components/stoffside/Kjemipanel.tsx`,
`src/kjemi/stoffside.ts`) står etter TDM og viser forbindelsene stoffet har —
selve stoffet først, så metabolittene — med molekylformelen, molekylvekten slik
PubChem oppgir den, CID med lenke og InChIKey. En forbindelse som ikke er koblet
eller ikke hentet ennå, står med det. PubChem er kilde i referansefeltet, med
når dataene sist ble kontrollert: den eldste av forbindelsene siden viser, så
en forbindelse en kjøring avviste, aldri ser nyere kontrollert ut enn den er.
Ingenting her redigeres.

Nettleseren leser bare kopien (`les_kjemi`), aldri PubChem.

## Koden

| Hvor | Hva |
| --- | --- |
| `src/data/forbindelser.ts`, `src/kjemi/forbindelser.ts` | Forbindelsene, koblingene og kontrollen av registeret |
| `src/kjemi/kurering.ts`, `scripts/kurer-forbindelser.ts` | Kontrollen som kobler en forbindelse til PubChem |
| `src/kjemi/pubchem.ts`, `src/server/hofligHenting.ts` | Kallene og lesingen av svarene; køen som holder avstanden |
| `src/kjemi/synk.ts`, `lager.ts`, `endepunkt.ts`, `api/pubchem-synk.ts` | Synkroniseringen |
| `supabase/migrations/*_pubchem.sql` | Skjemaet `pubchem`, funksjonene, endringsloggen og PubChem i `datakilder_status` |
| `src/kjemi/lesing.ts`, `stoffside.ts`, `referanser.ts` | Lesingen, visningen og referansen |
| `src/__tests__/kjemi.test.ts` | Alt over, med ekte svar fra PubChem (`data/pubchem/`) |
