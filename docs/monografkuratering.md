# Monografkuratering

Leses når en stoffmonografi (en fagside) skal oppdateres med en
datamigrasjon etter en kuratering. Hvordan sidene, revisjonene og
publiseringen er bygget, står i `docs/faginnhold.md`.

**Rollene.** Litteratursøket, kildevurderingen og teksten gjøres av
ChatGPT-monografkuratoren. Claude skriver ikke faginnhold i en kuratering, men
sørger for at det kuratoren har bestemt, lander trygt: migrasjonen, testene,
utrullingen og kontrollen av historikken.

## Arbeidsflyten

1. **Preflight i produksjonen.** Les sidens elementer slik de står nå, med
   `execute_sql` (som bare kan lese):

   ```sql
   select e.panel, e.elementtype, e.data->>'maal' as maal, e.data->>'tittel' as tittel,
     e.objekt_id, u.revisjon as utkast, p.revisjon as publisert, r.kilde
   from public.infosider s
   join public.innholdselementer e on e.infoside_id = s.objekt_id and e.tilstand = 'utkast'
   join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
   left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
   left join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
   where s.tilstand = 'publisert' and s.slug = '<stoff>'
   order by e.panel, e.posisjon, e.objekt_id;
   ```

   Panelet er det i utkastet; et element som er flyttet, men ikke publisert,
   har `utkast` høyere enn `publisert`.

   Noter antallet elementer per panel som endres, og for hvert element som
   endres: nøkkelen som skiller det ut (`maal` for et mekanismekort, `tittel`
   for et kinetikkort, ingen for en tekst som står alene i panelet), den
   publiserte revisjonen og kilden. Et element med utkast nyere enn det
   publiserte, eller to elementer med samme nøkkel, avklares før migrasjonen
   skrives.

2. **Migrasjonen.** Kopier `supabase/maler/monografkuratering.sql` til
   `supabase/migrations/<versjon>_<stoff>_monografkuratering.sql` (et tillegg:
   `…_monografkuratering_<hva>.sql`) og fyll inn preflighten og endringene.
   Testene kjenner kurateringene igjen på kallet til `intern.kuratering_start()`,
   men navnet er påkrevd for nye, og stoffet i navnet må være siden migrasjonen
   åpner (`intern.kuratering_start('<stoff>')`, én side per migrasjon); bare
   tre eldre kvetiapinmigrasjoner avviker (`KURATERINGER_MED_AVVIKENDE_NAVN` i
   `src/__tests__/hjelp/testdatabase.ts`), og den listen skal ikke vokse.
   Hjelpefunksjonene (under) gjør kontrollene; skriv
   dem ikke for hånd. Referanser slås opp med `kuratering_referanse`, aldri med
   id-en de har i produksjonen. Hele migrasjonen er én transaksjon: stopper en kontroll,
   er ingenting endret.

3. **Test.** `npm test` prøver en ny kuratering av seg selv, uten noe nytt
   testoppsett:

   - `monografkuratering.test.ts` kjører alle migrasjonene på en tom database
     uten kuratorprofil, der hver kuratering skal kjøre uten å endre noe, og
     kontrollerer navnet og siden.
   - `kurateringskjeden.test.ts` kjører hele kjeden én gang, i rekkefølge, fra
     den første importen med kuratoren på plass, slik produksjonen gjorde.
     Hver kuratering skal endre elementene på sin egen side og ingen andre,
     heller ikke en side den flytter et element fra (nye referanser alene
     teller ikke); siden skal stå uten upubliserte utkast og
     bare peke på publiserte referanser som finnes, én med hver lenke. Til
     slutt kjøres de som sjekker `kuratering_utfort` (som malen), på nytt, hver
     for seg, og skal ikke endre noe. En eldre kuratering uten den sjekken
     kjøres aldri på nytt.
   - Sluttresultatet for stoffet valideres i
     `src/__tests__/kurateringskjeden/<stoff>.ts`, som testen finner selv (se
     `kvetiapin.ts`): en standardeksport som får databasen etter hele kjeden og
     slår opp sidens elementer med `elementer(db, '<stoff>', '<panel>')` fra
     `hjelp/kurateringskjeden.ts`. Skriv den for det kuratoren har bestemt, og
     utvid den ved neste kuratering av samme stoff.

   Andre tester som setter opp kuratoren og sider på sin egen måte, hopper
   over kurateringene (`kjorMigrasjoner` i `src/__tests__/hjelp/testdatabase.ts`),
   siden preflighten deres gjelder produksjonen. Kjør også `npm run build`.

4. **Utrullingen.** Når preflight og testene er bestått, slås PR-en sammen, og
   GitHub Actions ruller migrasjonen ut til produksjonen og kontrollerer
   historikken (`docs/migrasjoner.md`). En ordinær monografkuratering trenger
   ikke noe eget samtykke; sammenslåingen er godkjenningen. Hvis migrasjonen
   avviker fra den vanlige malen og innebærer vesentlig risiko for datatap,
   sikkerhet/personvern, produksjonstilgjengelighet eller vanskelig reversering,
   gjelder den risikobaserte godkjenningsregelen i `CLAUDE.md`. Preflighten
   gjelder produksjonen slik den er når migrasjonen kjøres: endres siden før
   PR-en slås sammen, stopper migrasjonen uten å endre noe, og må skrives på
   nytt. `apply_migration` direkte er bare en reservevei (`docs/migrasjoner.md`).

5. **Etterpå endres migrasjonen aldri.** En retting er en ny migrasjon.

## Seksjonene med faste kort

«Toksisitet og forgiftning» (`toksisitet_forgiftning`), «Graviditet, amming
og reproduksjon» (`graviditet_amming`) og «Avhengighet, toleranse og
tilbakeslagseffekter» (`avhengighet_toleranse`) har faste kort
(`docs/faginnhold.md`). Et kort i dem er et `kinetikkort` med nøyaktig den
faste overskriften i `data.tittel`, nøkkelen `{"tittel": "…"}` og `posisjon`
lik plassen i lista (`fasteKort` i `src/faginnhold/paneler.ts`). Hvert kan
stå én gang; databasen avviser et kort nummer to. Kildene står på kortet
(`referanser`) og inline som siteringer, som ellers.

Redaksjonelle rammer for kuratoren:

- Et kort skrives bare når stoffet har relevant dokumentasjon. Ingen
  standardtekst for å fylle en seksjon; det som mangler, står tomt og vises
  ikke.
- «Behandling ved forgiftning» er stoffspesifikke tiltak, antidoter og
  andre særlige behandlingsforhold, ikke generell ABC- eller
  akuttmedisinsk behandling.
- Tallene i viktige data (toksisk område, alvorlig/dødelig intoksikasjon)
  flyttes eller dupliseres ikke. Toksisitetskortene kan utdype dem og sette
  dem i kontekst, men er egne redaksjonelle elementer.

## Hjelpefunksjonene

`supabase/migrations/*_monografkuratering_hjelpere.sql`, med rettingene i
`*_monografkuratering_hjelpere_retting.sql`, `*_referanselenke.sql` og `*_arkiverte_utkast.sql`, i skjemaet `intern`, som ingen av
API-rollene når.

| Funksjon | Hva den gjør |
| --- | --- |
| `kuratering_start(slug)` | Logger inn som kuratoren (`peohol`), låser elementene og referansene mot andre endringer til migrasjonen er ferdig, og gir siden. Uten kuratorprofil gir den `null`, og migrasjonen gjør ingenting, også når en tidligere migrasjon har laget siden på en fersk database uten profiler. Finnes siden og andre profiler, men ikke kuratoren, stopper den |
| `kuratering_utfort(kilde)` | Om kurateringen med denne kilden alt er gjort |
| `kuratering_antall(side, panel, elementtype, n)` | Panelet har nøyaktig `n` elementer av typen, utkast medregnet |
| `kuratering_element(side, panel, elementtype, nøkkel, revisjon[, kilde])` | Det ene elementet der `data` inneholder nøkkelen: publisert, uten upublisert utkast, på revisjonen (og med kilden) preflighten fant. Låst til migrasjonen er ferdig |
| `kuratering_lagre(objekt, revisjon, endring, kilde)` | Innholdet i revisjonen med endringen (feltene på øverste nivå, som `data`, `referanser` eller `panel`), lagret og publisert med kilden i historikken |
| `kuratering_nytt(side, innhold, nøkkel, kilde)` | Et nytt, publisert element, bare når ingen har nøkkelen fra før |
| `kuratering_referanse(innhold, kilde)` | Den publiserte referansen med lenken (renset for mellomrom), eller en ny. Stopper hvis lenken står på flere referanser (utkast og arkiverte utkast medregnet), eller på en der utkastet ikke er publisert, har en annen lenke eller en arkivering. En referanse som er arkivert og publisert slik, er lagt bort og telles ikke |

Et element fjernes ved å flytte det til panelet `fjernet`
(`kuratering_lagre(objekt, revisjon, '{"panel": "fjernet"}', kilde)`), så
historikken står.

Det som gikk galt før, og som funksjonene stopper:

- et oppslag med `order by objekt_id limit 1` som valgte et tilfeldig av to
  like kort, eller et redaksjonelt kort som var lagt til ved siden av;
- en endring som ikke var bundet til revisjonen preflighten så, og kunne
  skrive over en redigering som kom imellom;
- en sperre for manglende kuratorprofil som stoppet hele kjeden på en tom
  database.

## Kontrollen av historikken

Utrullingen kontrollerer historikken før og etter. Spørringen
`npm run kontroller:migrasjoner` skriver, og de avklarte avvikene i
`KJENTE_AVVIK`, er beskrevet i `docs/migrasjoner.md`.
