# Laboratorieanalyser fra Farmakologiportalen

Leses når noe som har med koblingene til Farmakologiportalen, synkroniseringen
derfra eller seksjonen «Analyse ved norske laboratorier» på fagsidene skal
endres. Forbindelsene og molekylvektene står i `docs/kjemi.md`, driftstatusen
og endringsloggen i `docs/datakilder.md`.

## Kilden

Farmakologiportalen (farmakologiportalen.no) eies og driftes av Norsk forening
for klinisk farmakologi. Den viser analysene de norske laboratoriene for
klinisk farmakologi og rettstoksikologi tilbyr: laboratoriet, prøvematerialet,
analyttnavnet, metoden, måleområdet og enheten laboratoriet svarer ut i.

Sidene er en WordPress-side, men tabellene hentes av sidene selv fra et
JSON-API (`https://api.farmakologiportalen.no/api`) med en offentlig nøkkel som
står i portalens egne skript. OUSFAR bruker det samme API-et, ikke HTML-sidene:
seks lister (`units`, `sampletypes`, `institutions`, `labs`, `components`,
`analyses`), ett kall om gangen med minst to sekunder mellom
(`src/farmakologiportalen/api.ts`). Portalen stenger for de fleste servere
(Cloudflare), så kallene går fra OUSFARs server i Stockholm (Vercel, `arn1`),
med tillatelse fra Peder Holman 8. oktober 2026.

Navnene på redaktørene som har godkjent eller endret en post, bildene og
rekvisisjonene lagres ikke (`REDAKTORFELT`, `utenRaa` i `modell.ts`).

## Koblingen til portalen

En forbindelse i `src/data/forbindelser.ts` er koblet til én komponent i
portalen (`farmakologiportalen`: ID, navnet der, status, dato og grunnlaget).
Koblingen endres bare i datafilen, i en PR; synkroniseringen legger aldri til
eller endrer noen. Den lages og kontrolleres med

```
npx vite-node scripts/kurer-farmakologiportalen.ts -- --komponenter <fil> [--alle] [--skriv] [nøkkel …]
```

der `<fil>` er komponentlisten som JSON: OUSFARs kopi (`select jsonb_agg(raa)
from farmakologiportalen.komponent where utgatt_kl is null`) eller listen slik
portalen gir den. Skriptet kontrollerer hver forbindelse
(`src/farmakologiportalen/kurering.ts`):

1. Navnet (det norske, det engelske, `synonymer` og `fpnavn`) må gi nøyaktig
   én komponent som ikke er en gruppe- eller sumanalyse. Gir det flere, vinner
   den ene der hele navnet i portalen er et av navnene; ellers er koblingen
   uavklart. Et tvetydig navnetreff godtas aldri.
2. **Verifisert** når portalens CAS-nummer er blant PubChems synonymer for
   forbindelsen, eller molekylvekten er den samme (innen 0,15 g/mol). Er
   CAS-nummeret ukjent for PubChem-posten, slås det opp i PubChem: gir det
   samme skjelett (første blokk i InChIKey) eller samme formel, er koblingen
   verifisert.
3. **Usikker** når bare navnet stemmer: ingen CAS eller molekylvekt å
   kontrollere mot, eller CAS-nummeret peker på et annet stoff (det står i
   grunnlaget hva det peker på).
4. **Uavklart** når både CAS og molekylvekt er ulike, eller navnet ikke gir én
   komponent.

En usikker kobling vises, men måleområdene regnes ikke om mellom masse og
stoffmengde, og fagsiden sier fra.

Kontrollert 8. oktober 2026: 134 verifisert, 2 usikre, ingen uavklart.

| Forbindelse | Hvorfor usikker |
| --- | --- |
| 7-aminoflunitrazepam | Portalens CAS-nummer er 7-aminonitrazepams; molekylvekten er ikke oppgitt |
| Desmetylklomipramin | Ikke koblet til PubChem (`docs/kjemi.md`), så verken CAS eller molekylvekt kan kontrolleres |

## Synkroniseringen

`/api/farmakologiportalen-synk` (`src/farmakologiportalen/endepunkt.ts`,
`synk.ts`) kjøres hver natt kl. 04.40 UTC av GitHub Actions
(`.github/workflows/farmakologiportalen-synk.yml`, også manuelt med «Run
workflow») og med «Hent nå» i «Datakilder». Jobben logger inn med et
kortlivet OIDC-token fra GitHub, som serveren kontrollerer mot repoet,
`main` og arbeidsflyten (`githubkjoring` i `src/server/tilgang.ts`); ingen
hemmelighet ligger i GitHub. Én kjøring:

1. henter alle seks listene. Feiler ett kall, avbrytes kjøringen før noe er
   lastet inn;
2. kontrollerer formen: mangler et felt lesingen bygger på, i mer enn 5 % av
   radene, regnes formatet som endret, og ingenting byttes inn;
3. leser radene og regner ut en kontrollsum per type. Er den den samme som ved
   forrige bytte, med samme parser, lastes typen ikke inn på nytt;
4. lager rapporten til «Datakilder» (under);
5. ber databasen bytte inn alt i én transaksjon (`fp_fullfor_synk`). Hver type
   må ha minst 80 % av radene fra før (komponenter og analyser 90 %). Ellers,
   eller går noe galt, står det som lå der fra før, urørt.

Er ingenting endret, blir kjøringen «uendret». Kjøringen lager ingen commit
og ingen migrasjon. Rådataene lagres ved siden av det OUSFAR leste, med
parserversjonen; samme rådata med ny `PARSERVERSJON` logges som metadata.

Rapporten («Til vurdering» i «Datakilder»):

- en koblet komponent som er borte fra portalen, eller har fått et annet navn;
- en molekylvekt som er ulik i portalen og PubChem (omregningen bruker
  PubChems);
- koblingene som bare er kontrollert på navnet;
- prøvematerialer OUSFAR ikke kjenner, og enheter som ikke regnes om, blant
  analysene fagsidene viser;
- henvisninger som ikke henger sammen (en analyse til et laboratorium som ikke
  finnes), som telles, men ikke stopper byttet.

Hva i portalen som er klinisk og hva som er metadata i endringsloggen, står i
`docs/datakilder.md`.

## Prøvematerialene

Portalens prøvematerialer slås sammen til matriser i `provematerialer.ts`
(serum og plasma, fullblod, kapillærblod, erytrocytter, urin, spytt, hår,
spinalvæske, utåndingsluft, DNA). Den opprinnelige betegnelsen beholdes og
vises: har alle radene i en tabell samme prøvemateriale, er det tittelen
(«Serum»); ellers er matrisen tittelen, og hver rad sier sitt. Et
prøvemateriale OUSFAR ikke kjenner, får sin egen tabell med portalens navn.

## På fagsidene

Seksjonen «Analyse ved norske laboratorier» (`Laboratoriepanel.tsx`,
`src/farmakologiportalen/stoffside.ts`) står etter TDM og viser analysene for
forbindelsene stoffet har, og for gruppe- og sumanalysene som dekker dem. Med:
bare analyser som er aktive og synlige i portalen, ved laboratorier som er i
drift. Én tabell per matrise og analytt, med begge i tittelen («Serum ·
Desmetylcitalopram»), så det aldri er tvil om hva som er målt: selve stoffet
før metabolittene og gruppe- og sumanalysene. Kolonnene er Laboratorium,
Metode og Måleområde, og Bemerkning når et laboratorium svarer ut noe annet
enn en konsentrasjon (et kvalitativt svar, en enhet per kreatinin). Det står
ingen benevning ved siden av tallene: de er i den valgte enheten, eller har
enheten sin rett etter seg. Tabellene skal vises i hele bredden uten å rulle
sidelengs; på smale skjermer står bemerkningen under måleområdet.
Laboratoriet og måleområdet lenker til portalen.

Måleområdene vises i enheten brukeren velger (µg/L, nmol/L, µmol/L), med høyst
to gjeldende sifre, som `x—y`, «fra x» eller «opptil y»
(`src/enheter/konsentrasjon.ts`). Mellom masse og stoffmengde regnes de bare
om med molekylvekten fra PubChem og en verifisert kobling, og en sumanalyse
regnes aldri om mellom dem. Det som ikke kan regnes om, står som laboratoriet
oppga det, med enheten. Portalen er kilde i referansefeltet, med når dataene
sist ble kontrollert. Ingenting her redigeres.

Det globale fagsøket finner analysene på det tabellene viser: analytten,
laboratoriet og metoden (ikke helseforetaket, som ikke står i tabellene), og
treffet åpner seksjonen på fagsiden. Søket leser
de samme analysene som seksjonen, men bare navnene og metodene
(`les_laboratoriesok`), og leser dem på nytt bare etter en fullført henting
(`laboratorier` i `sokedata_versjoner`). Kan de ikke leses, sier søket fra, og
resten virker som før (`docs/faginnhold.md`).

Nettleseren leser bare kopien (`les_laboratorieanalyser`,
`les_laboratoriesok`), aldri portalen.

## Koden

| Hvor | Hva |
| --- | --- |
| `src/data/forbindelser.ts`, `src/kjemi/forbindelser.ts` | Koblingene og kontrollen av registeret |
| `src/farmakologiportalen/kurering.ts`, `scripts/kurer-farmakologiportalen.ts` | Kontrollen som kobler en forbindelse til portalen |
| `src/farmakologiportalen/api.ts`, `modell.ts`, `provematerialer.ts` | Kallene, lesingen av listene og matrisene |
| `src/farmakologiportalen/synk.ts`, `lager.ts`, `endepunkt.ts`, `api/farmakologiportalen-synk.ts` | Synkroniseringen |
| `.github/workflows/farmakologiportalen-synk.yml` | Den nattlige jobben |
| `supabase/migrations/*_farmakologiportalen.sql` | Skjemaet, funksjonene, endringsloggen og portalen i `datakilder_status` |
| `supabase/migrations/*_laboratoriesok.sql` | Søkedataene til det globale søket og versjonen deres |
| `src/enheter/konsentrasjon.ts` | Enhetene, omregningen og avrundingen |
| `src/farmakologiportalen/lesing.ts`, `stoffside.ts`, `referanser.ts` | Lesingen, visningen og referansen |
| `src/__tests__/farmakologiportalen.test.ts` | Alt over, med et utdrag av ekte data fra portalen (`data/farmakologiportalen/`) |
