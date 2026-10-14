-- Avgrenset kuratering av citalopram: klinisk ADH-merknad og påstandsnære kilder.
-- Egen Cipramil-SPC-import i foregående migrasjon; ingen endring av norske konsentrasjonsverdier.
do $citalopram_adh$
declare
  side uuid := intern.kuratering_start('citalopram');
  kilde constant text := 'Citalopram 14.10.2026: ADH-avvik og kildeplassering i reproduksjonskort';
  r_orion uuid;
  r_cipramil uuid;
  r_uktis uuid;
  r_embryo uuid;
  r_lactmed uuid;
  bivirkning uuid;
  gravid uuid;
  perinatal uuid;
  amming uuid;
begin
  if side is null then return; end if;
  if intern.kuratering_utfort(kilde) then return; end if;

  -- Preflight mot publisert innhold; stopp ved nyere utkast eller konflikt.
  perform intern.kuratering_antall(side, 'bivirkninger', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'graviditet_amming', 'kinetikkort', 4);
  gravid := intern.kuratering_element(side, 'graviditet_amming', 'kinetikkort', '{"tittel":"Graviditet"}', 3);
  perinatal := intern.kuratering_element(side, 'graviditet_amming', 'kinetikkort', '{"tittel":"Perinatal og neonatal påvirkning"}', 3);
  amming := intern.kuratering_element(side, 'graviditet_amming', 'kinetikkort', '{"tittel":"Amming"}', 3);

  -- DMP-originaler og uendrede autoritative kilder; slå opp ved lenke, aldri UUID.
  r_orion := intern.kuratering_referanse('{"tittel":"Citalopram Orion – preparatomtale (SPC)","forfattere":"Direktoratet for medisinske produkter","aar":"2025","lenke":"https://produktinformasjon.legemiddelsok.no/preparatomtaler/06-4252.pdf"}'::jsonb, kilde);
  r_cipramil := intern.kuratering_referanse('{"tittel":"Cipramil – preparatomtale (SPC)","forfattere":"Direktoratet for medisinske produkter","aar":"2024","lenke":"https://produktinformasjon.legemiddelsok.no/preparatomtaler/0000-08151.pdf"}'::jsonb, kilde);
  r_uktis := intern.kuratering_referanse('{"tittel":"Use of citalopram in pregnancy, version 4","forfattere":"UK Teratology Information Service","aar":"2026","lenke":"https://uktis.org/monographs/use-of-citalopram-in-pregnancy/"}'::jsonb, kilde);
  r_embryo := intern.kuratering_referanse('{"tittel":"Citalopram","forfattere":"Embryotox, Charité – Universitätsmedizin Berlin","aar":"2026","lenke":"https://www.embryotox.de/arzneimittel/details/ansicht/medikament/citalopram"}'::jsonb, kilde);
  r_lactmed := intern.kuratering_referanse('{"tittel":"Citalopram","forfattere":"Drugs and Lactation Database (LactMed)","aar":"2026","lenke":"https://www.ncbi.nlm.nih.gov/books/NBK501185/"}'::jsonb, kilde);

  -- Nytt redaksjonelt kort vises nedenfor de uendrede, kildefidele SPC-tabellene.
  perform intern.kuratering_nytt(side,
    jsonb_build_object(
      'panel', 'bivirkninger', 'posisjon', 0, 'elementtype', 'kinetikkort',
      'data', jsonb_build_object('tittel','ADH-sekresjon – motstridende SPC-ordlyd','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Citalopram Orion (SPC 01.04.2025) oppgir «Utilstrekkelig ADH-sekresjon» under endokrine bivirkninger med frekvens «ikke kjent», mens Cipramil (SPC 16.05.2024) oppgir «Uhensiktsmessig sekresjon av ADH» med samme frekvens.'), jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(r_orion, r_cipramil))))), jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Sistnevnte beskriver uhensiktsmessig ADH-virkning (SIADH), som kan bidra til hyponatremi. ADH-mangel er en annen tilstand, og Orions formulering fremstår derfor som en feil i preparatomtalen. Begge originale tabeller er gjengitt ordrett; de ulike formuleringene skal ikke tolkes som to uavhengige endokrine bivirkninger.'), jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(r_cipramil, r_orion)))))))),
      'referanser', '[]'::jsonb),
    '{"tittel":"ADH-sekresjon – motstridende SPC-ordlyd"}'::jsonb, kilde);

  -- Bevar innhold og tall, men siter separate påstander på riktig nivå.
  perform intern.kuratering_lagre(gravid, 3,
    jsonb_build_object('data', jsonb_build_object('tittel','Graviditet','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Store datamengder gir samlet ikke overbevisende holdepunkter for økt risiko for større eller kardiale misdannelser. Studier som har funnet kardiale signaler, angir små absolutte forskjeller, opptil omtrent 1,3 % mot rundt 1 % i bakgrunnsbefolkningen, og resultatene kan være påvirket av konfundering og metode.'), jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(r_uktis))))), jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Stabil behandling bør ikke stoppes eller byttes uten individuell vurdering av sykdoms- og tilbakefallsrisiko.'), jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(r_uktis, r_embryo)))))))), 'referanser', '[]'::jsonb), kilde);
  perform intern.kuratering_lagre(perinatal, 3,
    jsonb_build_object('data', jsonb_build_object('tittel','Perinatal og neonatal påvirkning','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Eksponering kort før fødsel kan gi forbigående neonatal tilpasnings-/seponeringssymptomer; Embryotox anslår slike symptomer hos to til tre av ti sent eksponerte barn, oftest milde og selvbegrensende innen én til to uker.'), jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(r_embryo))))), jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','For SSRI etter uke 20 anslår UKTIS absolutt PPHN-risiko til under 0,4 % mot 0,1–0,2 % i bakgrunnsbefolkningen.'), jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(r_uktis))))), jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Bruk siste måned kan øke postpartumblødning moderat, opptil RR omkring 1,3, men behandlingsendring må veies mot tilbakefall hos mor.'), jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(r_uktis)))))))), 'referanser', '[]'::jsonb), kilde);
  perform intern.kuratering_lagre(amming, 3,
    jsonb_build_object('data', jsonb_build_object('tittel','Amming','dokument',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Citalopram går over i morsmelk. Relativ spedbarnsdose er vanligvis omtrent 3–6 %, men høyere verdier forekommer; serumkonsentrasjonen hos barnet er oftest ikke målbar eller svært lav.'), jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(r_lactmed))))), jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Sporadisk døsighet, uro, søvn- eller ernæringsvansker er rapportert, men nødvendig behandling hos mor er ikke i seg selv grunn til å avslutte amming.'), jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(r_lactmed, r_embryo))))), jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Følg særlig nyfødte og premature for sedasjon/uro, matinntak og vektutvikling; ved nyoppstart kan sertralin foretrekkes når klinisk likeverdig.'), jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(r_lactmed, r_embryo)))))))), 'referanser', '[]'::jsonb), kilde);

  -- Påkrevd rapport: kontrolleres mot faktisk nytt/endret før den kan fullføre transaksjonen.
  perform intern.kuratering_rapport('chatgpt-monografkurator', '20261014090100_citalopram_monografkuratering_spc_og_kilder.sql', $rapport$
{
  "oppsummering": "Cipramil og Orion er sammenholdt; motstridende ADH-ordlyd er forklart, og reproduksjonskortene har presisere kildeplassering.",
  "seksjoner": [
    {
      "seksjon": "bivirkninger",
      "nytt": [
        "Redaksjonelt kort om motsigende ADH-terminologi i to preparatomtaler"
      ]
    },
    {
      "seksjon": "graviditet_amming",
      "endret": [
        "Graviditet: separate referanser for risikotall og behandlingsvurdering",
        "Perinatal påvirkning: separate referanser for neonatal tilpasning, PPHN og postpartumblødning",
        "Amming: separate referanser for eksponeringsdata, observerte reaksjoner og kliniske råd"
      ]
    }
  ],
  "nye_opplysninger": [
    "Cipramil 2024 og Citalopram Orion 2025 har ulik ordlyd for ADH-sekresjon; Originaltekstene beholdes separat"
  ],
  "korrigeringer": [
    "Orions «Utilstrekkelig ADH-sekresjon» er sannsynlig en feilformulering; klinisk sammenheng er SIADH/hyponatremi",
    "Kilder for ulike reproduksjonsutfall er nå knyttet til hver enkelt påstand"
  ],
  "kildegrunnlag": [
    "Cipramil – preparatomtale, DMP, revisjon 16.05.2024, lagt til; Orion, UKTIS, Embryotox og LactMed beholdt"
  ],
  "mangler": [
    "En eventuell regulatorisk korrigering av Orions original-SPC må håndteres hos preparatomtalens utsteder",
    "Autentisert PubChem- og Farmakologiportalen-runtime er separat teknisk oppfølging"
  ]
}
  $rapport$::jsonb);
end
$citalopram_adh$;