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
   Navnet er det testene kjenner kurateringene igjen på. Hjelpefunksjonene (under) gjør kontrollene; skriv
   dem ikke for hånd. Hele migrasjonen er én transaksjon: stopper en kontroll,
   er ingenting endret.

3. **Test.** `npm test` kjører alle migrasjonene på en tom database uten
   kuratorprofil (`monografkuratering.test.ts`), og alle bygget på malen gjør
   da ingenting. Andre tester som setter opp kuratoren og sider på sin egen
   måte, hopper over kurateringene (`kjorMigrasjoner` i
   `src/__tests__/hjelp/testdatabase.ts`), siden preflighten deres gjelder
   produksjonen. Skal selve endringene prøves, bygges siden slik preflighten
   fant den i testen, som `monografkuratering.test.ts` gjør for malen, eller
   kjedene kjøres fra den første importen med `kurateringer: true`, som
   `kvetiapin-monograf.test.ts` gjør. Kjør også `npm run build`.

4. **Utrullingen** krever Peders uttrykkelige ja, med navnet på migrasjonen.
   Rull den ut med `apply_migration`, gi fila versjonen prosjektet
   registrerte, og kjør kontrollen av historikken (under). Den skal ikke gi
   noen rader.

5. **Etterpå endres migrasjonen aldri.** En retting er en ny migrasjon.

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

`npm run kontroller:migrasjoner` kontrollerer navnene på filene (14 sifre,
understrek, navn; én fil per versjon) og skriver en lesespørring som
sammenligner versjonen, navnet og innholdet i hver fil med det databasen har
registrert. Kjør spørringen med `execute_sql`. Ingen rader betyr at alt
stemmer; ellers sier hver rad hva som avviker, også når en fil har en annen
versjon enn den som ble registrert.

Avvik som er avklart, står i `KJENTE_AVVIK` i
`src/faginnhold/migrasjonshistorikk.ts`, med md5 av fila og av teksten som ble
kjørt, og hvorfor. De vises igjen om fila eller teksten endres.
