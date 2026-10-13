-- Forste fullstendige de novo-monografpilot for citalopram.
-- Den blinde evidensfasen ble last for eksisterende monografi og journal ble lest.
-- Norske serum- og toksisitetsgrenser, dose-serumtabell og automatiske lag bevares.

do $citalopram_de_novo$
declare
  side uuid := intern.kuratering_start('citalopram');
  kilde constant text := 'Citalopram de novo-pilot 13.10.2026: uavhengig evidens og adversarial kontroll';
  obj uuid;
  spc uuid;
  sertstudie uuid;
  depresjonsmeta uuid;
  tilbakefall uuid;
  panikkstudie uuid;
  panikkcochrane uuid;
  ocdstudie uuid;
  laboratoriehandbok uuid;
  uktis uuid;
  embryotox uuid;
  lactmed uuid;
  data jsonb;
  maal text;
begin
  if side is null then return; end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'Kurateringen er alt gjort.';
    return;
  end if;

  perform intern.kuratering_antall(side, 'farmakodynamikk', 'mekanismekort', 7);
  perform intern.kuratering_antall(side, 'virkninger', 'kinetikkort', 4);
  perform intern.kuratering_antall(side, 'tdm', 'kinetikkort', 3);
  perform intern.kuratering_antall(side, 'graviditet_amming', 'kinetikkort', 4);
  perform intern.kuratering_antall(side, 'avhengighet_toleranse', 'kinetikkort', 3);

  spc := intern.kuratering_referanse(
    '{"tittel":"Citalopram Orion – preparatomtale (SPC)","forfattere":"Direktoratet for medisinske produkter","aar":"2025","lenke":"https://produktinformasjon.legemiddelsok.no/preparatomtaler/06-4252.pdf"}',
    kilde);
  sertstudie := intern.kuratering_referanse(
    '{"tittel":"Molecular determinants for selective recognition of antidepressants in the human serotonin and norepinephrine transporters","forfattere":"Andersen J, Kristensen AS, Bang-Andersen B, Strømgaard K","aar":"2011","lenke":"https://pubmed.ncbi.nlm.nih.gov/21730142/"}',
    kilde);
  depresjonsmeta := intern.kuratering_referanse(
    '{"tittel":"Citalopram for major depressive disorder in adults: a systematic review and meta-analysis of published placebo-controlled trials","forfattere":"Apler A","aar":"2011","lenke":"https://doi.org/10.1136/bmjopen-2011-000106"}',
    kilde);
  tilbakefall := intern.kuratering_referanse(
    '{"tittel":"Citalopram in doses of 20-60 mg is effective in depression relapse prevention: a placebo-controlled 6 month study","forfattere":"Robert P, Montgomery SA","aar":"1995","lenke":"https://pubmed.ncbi.nlm.nih.gov/7622809/"}',
    kilde);
  panikkstudie := intern.kuratering_referanse(
    '{"tittel":"A controlled, prospective, 1-year trial of citalopram in the treatment of panic disorder","forfattere":"Lepola U, Wade A, Leinonen E, et al.","aar":"1998","lenke":"https://pubmed.ncbi.nlm.nih.gov/9818634/"}',
    kilde);
  panikkcochrane := intern.kuratering_referanse(
    '{"tittel":"Antidepressants versus placebo for panic disorder in adults","forfattere":"Bighelli I, Castellazzi M, Cipriani A, et al.","aar":"2018","lenke":"https://doi.org/10.1002/14651858.CD010676.pub2"}',
    kilde);
  ocdstudie := intern.kuratering_referanse(
    '{"tittel":"Citalopram 20 mg, 40 mg and 60 mg are all effective and well tolerated compared with placebo in obsessive-compulsive disorder","forfattere":"Montgomery SA, Kasper S, Stein DJ, et al.","aar":"2001","lenke":"https://pubmed.ncbi.nlm.nih.gov/11236072/"}',
    kilde);
  laboratoriehandbok := intern.kuratering_referanse(
    '{"tittel":"Citalopram – laboratoriehåndbok","forfattere":"Sykehuset Østfold","aar":"2026","lenke":"https://metodebok.no/emne/itd7GHaY/citalopram/laboratorieh%C3%A5ndbok-%28s%C3%98%29"}',
    kilde);
  uktis := intern.kuratering_referanse(
    '{"tittel":"Use of citalopram in pregnancy, version 4","forfattere":"UK Teratology Information Service","aar":"2026","lenke":"https://uktis.org/monographs/use-of-citalopram-in-pregnancy/"}',
    kilde);
  embryotox := intern.kuratering_referanse(
    '{"tittel":"Citalopram","forfattere":"Embryotox, Charité – Universitätsmedizin Berlin","aar":"2026","lenke":"https://www.embryotox.de/arzneimittel/details/ansicht/medikament/citalopram"}',
    kilde);
  lactmed := intern.kuratering_referanse(
    '{"tittel":"Citalopram","forfattere":"Drugs and Lactation Database (LactMed)","aar":"2026","lenke":"https://www.ncbi.nlm.nih.gov/books/NBK501185/"}',
    kilde);

  -- Behold bare den klinisk informative hovedmekanismen i live-panelet.
  obj := intern.kuratering_element(
    side, 'farmakodynamikk', 'mekanismekort',
    '{"maal":"Serotoninreopptak / SERT"}'::jsonb, 2);
  data := jsonb_build_object(
    'maal', 'Serotoninreopptak / SERT',
    'effekt', 'Hemmer reopptak',
    'mekanisme', 'reopptakshemming',
    'retning', 'ned',
    'kvalifikasjon', 'Potent og selektiv',
    'dokument', jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(jsonb_build_object(
        'type', 'paragraph',
        'content', jsonb_build_array(
          jsonb_build_object('type','text','text','Citalopram hemmer serotonintransportøren (SERT) og reduserer reopptaket av serotonin. I humane rekombinante transportørforsøk var affiniteten 4 nmol/L ved SERT og 1414 nmol/L ved NET; S-citalopram hadde omtrent 35 ganger høyere SERT-affinitet enn R-citalopram.'),
          jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(sertstudie)))
        )
      ))
    )
  );
  perform intern.kuratering_lagre(
    obj, 2, jsonb_build_object('data',data,'referanser','[]'::jsonb), kilde);

  foreach maal in array array[
    'Noradrenalinreopptak / NET',
    'Dopaminreopptak / DAT',
    'GABA-reopptak',
    'Muskarinreseptorer',
    'Histaminreseptorer',
    'Adrenerge reseptorer'
  ] loop
    obj := intern.kuratering_element(
      side, 'farmakodynamikk', 'mekanismekort',
      jsonb_build_object('maal',maal), 2);
    perform intern.kuratering_lagre(obj, 2, jsonb_build_object('panel','fjernet'), kilde);
  end loop;

  -- Direkte citalopramevidens og begrensninger ved depresjon.
  obj := intern.kuratering_element(
    side, 'virkninger', 'kinetikkort',
    '{"tittel":"Antidepressiv effekt"}'::jsonb, 1);
  data := jsonb_build_object('tittel','Antidepressiv effekt','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','I en systematisk oversikt over publiserte placebokontrollerte studier ved alvorlig depressiv episode var respons hyppigere med citalopram (RR 1,42; 95 % KI 1,17–1,73; fem studier, n=1010), mens gjennomsnittlig symptomforskjell var liten (Hedges g -0,27; 95 % KI -0,38 til -0,16; fem studier, n=1541). Remisjonsdata var utilstrekkelige. Rapporteringen var svak, sju av åtte studier var industrifinansiert, og upubliserte studier inngikk ikke.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(depresjonsmeta)))
      )),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Blant pasienter som først responderte åpent på citalopram, fikk 13,8 % tilbakefall med fortsatt behandling mot 24,3 % etter bytte til placebo over 24 uker (p=0,04). Det berikede seponeringsdesignet begrenser overførbarheten til alle pasienter.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(tilbakefall)))
      ))
    )
  ));
  perform intern.kuratering_lagre(obj,1,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  -- Eldre positiv studie balanseres mot den substansspesifikke Cochrane-analysen.
  obj := intern.kuratering_element(
    side, 'virkninger', 'kinetikkort',
    '{"tittel":"Effekt ved panikklidelse"}'::jsonb, 2);
  data := jsonb_build_object('tittel','Effekt ved panikklidelse','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','I den eldre femarmede studien ble 475 pasienter randomisert i den åtte uker lange akuttfasen. Deretter valgte 279 å fortsette blindet behandling i opptil ett år; 258 inngikk i effektanalysen og 179 fullførte 12 måneder. Langtidsresultatene var generelt bedre enn placebo for citalopram unntatt laveste dosegruppe, med best resultat ved 20–30 mg/døgn, men det store frafallet og den valgfrie fortsettelsen begrenser generaliserbarheten.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(panikkstudie)))
      )),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','I en senere Cochrane-oversikt viste den citalopramspesifikke analysen ingen sikker forskjell fra placebo for manglende respons (RR 0,82; 95 % KI 0,65–1,04; to studier, n=628; I²=78 %) eller manglende remisjon (RR 0,95; 95 % KI 0,76–1,19; én studie, n=251). Citalopram er godkjent ved panikklidelse, men heterogenitet, frafall og begrenset substansspesifikk presisjon gjør effektstørrelsen usikker.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(panikkcochrane,spc)))
      ))
    )
  ));
  perform intern.kuratering_lagre(obj,2,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  obj := intern.kuratering_element(
    side, 'virkninger', 'kinetikkort',
    '{"tittel":"Effekt ved tvangslidelse"}'::jsonb, 1);
  data := jsonb_build_object('tittel','Effekt ved tvangslidelse','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object(
      'type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','I en 12-ukers randomisert studie med 401 pasienter var respons, definert som minst 25 % bedring på Y-BOCS, 57,4 % ved 20 mg, 52 % ved 40 mg og 65 % ved 60 mg, mot 36,6 % med placebo. Dosene skilte seg ikke signifikant fra hverandre. Studien er eldre, og 60 mg/døgn overstiger dagens maksimale anbefalte dose på 40 mg/døgn.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(ocdstudie,spc)))
      )
    )))
  );
  perform intern.kuratering_lagre(obj,1,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  -- Norsk preanalytikk og bruksomrade for serumkonsentrasjonsmaling.
  obj := intern.kuratering_element(
    side, 'tdm', 'kinetikkort',
    '{"tittel":"Prøvetakingstidspunkt"}'::jsonb, 1);
  data := jsonb_build_object('tittel','Prøvetakingstidspunkt','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Ta serumprøve uten gel ved steady state, 12–24 timer etter siste dose. Oppgi dose, tidspunkt for siste dose og prøvetaking, samt relevante legemidler. Gel kan absorbere psykofarmaka og påvirke svaret.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(laboratoriehandbok)))
      )),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Måling er særlig aktuelt ved manglende effekt, spørsmål om etterlevelse, bivirkninger, forgiftning, interaksjoner, endret organfunksjon, sårbare grupper, farmakogenetiske avvik eller bruk av doser utenfor anbefalt område.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(laboratoriehandbok)))
      ))
    )
  ));
  perform intern.kuratering_lagre(obj,1,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  -- Nyere teratologikilder og absolutte risikotall erstatter eldre, mer kategoriske formuleringer.
  obj := intern.kuratering_element(
    side, 'graviditet_amming', 'kinetikkort',
    '{"tittel":"Graviditet"}'::jsonb, 2);
  data := jsonb_build_object('tittel','Graviditet','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object(
      'type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Store datamengder gir samlet ikke overbevisende holdepunkter for økt risiko for større eller kardiale misdannelser. Studier som har funnet kardiale signaler, angir små absolutte forskjeller, opptil omtrent 1,3 % mot rundt 1 % i bakgrunnsbefolkningen, og resultatene kan være påvirket av konfundering og metode. Stabil behandling bør ikke stoppes eller byttes uten individuell vurdering av sykdoms- og tilbakefallsrisiko.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(uktis,embryotox)))
      )
    )))
  );
  perform intern.kuratering_lagre(obj,2,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  obj := intern.kuratering_element(
    side, 'graviditet_amming', 'kinetikkort',
    '{"tittel":"Perinatal og neonatal påvirkning"}'::jsonb, 2);
  data := jsonb_build_object('tittel','Perinatal og neonatal påvirkning','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object(
      'type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Eksponering kort før fødsel kan gi forbigående neonatal tilpasnings-/seponeringssymptomer; Embryotox anslår slike symptomer hos to til tre av ti sent eksponerte barn, oftest milde og selvbegrensende innen én til to uker. For SSRI etter uke 20 anslår UKTIS absolutt PPHN-risiko til under 0,4 % mot 0,1–0,2 % i bakgrunnsbefolkningen. Bruk siste måned kan øke postpartumblødning moderat, opptil RR omkring 1,3, men behandlingsendring må veies mot tilbakefall hos mor.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(uktis,embryotox)))
      )
    )))
  );
  perform intern.kuratering_lagre(obj,2,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  obj := intern.kuratering_element(
    side, 'graviditet_amming', 'kinetikkort',
    '{"tittel":"Amming"}'::jsonb, 2);
  data := jsonb_build_object('tittel','Amming','dokument',jsonb_build_object(
    'type','doc','content',jsonb_build_array(jsonb_build_object(
      'type','paragraph','content',jsonb_build_array(
        jsonb_build_object('type','text','text','Citalopram går over i morsmelk. Relativ spedbarnsdose er vanligvis omtrent 3–6 %, men høyere verdier forekommer; serumkonsentrasjonen hos barnet er oftest ikke målbar eller svært lav. Sporadisk døsighet, uro, søvn- eller ernæringsvansker er rapportert, men nødvendig behandling hos mor er ikke i seg selv grunn til å avslutte amming. Følg særlig nyfødte og premature for sedasjon/uro, matinntak og vektutvikling; ved nyoppstart kan sertralin foretrekkes når klinisk likeverdig.'),
        jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',jsonb_build_array(embryotox,lactmed)))
      )
    )))
  );
  perform intern.kuratering_lagre(obj,2,jsonb_build_object('data',data,'referanser','[]'::jsonb),kilde);

  -- Molekylaer SERT-tilpasning dokumenterer ikke klinisk toleranse.
  -- Kortet tas ut av live-panelet; malrettet negativt sok dokumenteres i journalen.
  obj := intern.kuratering_element(
    side, 'avhengighet_toleranse', 'kinetikkort',
    '{"tittel":"Toleranseutvikling"}'::jsonb, 2);
  perform intern.kuratering_lagre(obj,2,jsonb_build_object('panel','fjernet'),kilde);

  perform intern.kuratering_rapport(
    'chatgpt-monografkurator',
    '20261013160000_citalopram_monografkuratering_de_novo_pilot.sql',
    $rapport$
    {
      "oppsummering": "Citalopram er fullstendig de novo-kuratert med direkte effektdata, presisert TDM og oppdatert graviditets- og ammedokumentasjon; svakt dokumenterte mekanisme- og toleransekort er fjernet.",
      "seksjoner": [
        {
          "seksjon": "farmakodynamikk",
          "endret": ["SERT-kortet er konsentrert til humane transportørdata med kvantifisert selektivitet"],
          "fjernet": ["Seks negative målkort uten selvstendig klinisk informasjonsverdi"]
        },
        {
          "seksjon": "virkninger",
          "endret": ["Antidepressiv effekt, tilbakefallsforebygging, panikklidelse og tvangslidelse er kvantifisert med begrensninger"]
        },
        {
          "seksjon": "tdm",
          "endret": ["Prøvetakingstidspunkt, prøvemateriale og kliniske indikasjoner for konsentrasjonsmåling er presisert"]
        },
        {
          "seksjon": "graviditet_amming",
          "endret": ["Graviditet, perinatal påvirkning og amming er oppdatert med teratologikilder og absoluttrisiko"]
        },
        {
          "seksjon": "avhengighet_toleranse",
          "fjernet": ["Toleranseutvikling, fordi molekylær SERT-tilpasning ikke dokumenterer klinisk toleranse"]
        }
      ],
      "nye_opplysninger": [
        "Direkte citaloprameffekt ved depresjon og tilbakefallsforebygging er kvantifisert",
        "Respons og remisjon ved panikklidelse er skilt med korrekte Cochrane-estimater",
        "Graviditets-, perinatal- og ammerisiko er oppdatert med nyere teratologikilder"
      ],
      "korrigeringer": [
        "Panikkstudien skiller nå mellom randomiserte, videreførte, effektanalyserte og fullførere",
        "60 mg-armen i OCD-studien er satt i kontekst mot dagens maksimale dose",
        "Udokumentert klinisk toleransefortolkning og seks lite informative negative målkort er fjernet"
      ],
      "kildegrunnlag": [
        "Andersen et al. 2011, Apler 2011, Robert og Montgomery 1995, Lepola et al. 1998, Bighelli et al. 2018 og Montgomery et al. 2001 er lagt til eller kontrollert",
        "Citalopram Orion SPC 2025, Sykehuset Østfold laboratoriehåndbok 2026, UKTIS 2026, Embryotox 2026 og LactMed 2026 er lagt til eller kontrollert"
      ],
      "mangler": [
        "Ingen skarp universell konsentrasjon-effektgrense",
        "Moderne substansspesifikk evidens ved panikklidelse og OCD er begrenset",
        "Menneskelige fertilitetsdata og robust citalopramspesifikk dokumentasjon for klinisk toleranse er begrenset"
      ],
      "lenker": ["https://github.com/peohol/far/pull/222"]
    }
    $rapport$::jsonb);
end
$citalopram_de_novo$;
