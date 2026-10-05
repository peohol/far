-- Fullforer monografkurateringen av kvetiapin etter utvidet kuratorkontrakt.
-- Bevarer etablerte norske referanse-/toksisitetskonsentrasjoner og tidligere kuraterte paneler.
-- Legger til toksisitet/forgiftning og graviditet/amming/reproduksjon, retter H1-typografi og kildebelegger indikasjon/interaksjoner.
do $kuratering$
declare
  side uuid := intern.kuratering_start('kvetiapin');
  kilde constant text := 'Monografkuratering av kvetiapin 04.10.2026: fullforing av toksisitet, graviditet, indikasjon og interaksjoner';
  sedasjon uuid;
  indikasjon uuid;
  interaksjoner uuid;
  k record;
  ref uuid;
  kilder jsonb := '{}'::jsonb;
  oppdatering jsonb;
  referanser jsonb;
begin
  if side is null then return; end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'Kurateringen er alt gjort.';
    return;
  end if;

  perform intern.kuratering_antall(side, 'virkninger', 'kinetikkort', 4);
  sedasjon := intern.kuratering_element(side, 'virkninger', 'kinetikkort', '{"tittel":"Sedasjon og søvnighet"}', 1,
    'Monografkuratering av kvetiapin 04.10.2026: oppsummering, virkninger og avhengighet');
  perform intern.kuratering_antall(side, 'toksisitet_forgiftning', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'graviditet_amming', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'indikasjon', 'riktekst', 1);
  indikasjon := intern.kuratering_element(side, 'indikasjon', 'riktekst', '{}'::jsonb, 2,
    'Tatt bort: datoen for kontroll mot Felleskatalogen');
  perform intern.kuratering_antall(side, 'interaksjoner', 'riktekst', 1);
  interaksjoner := intern.kuratering_element(side, 'interaksjoner', 'riktekst', '{}'::jsonb, 4,
    'Korrigering etter fersk monografkuratering: interaksjoner tilbakeført til tilstanden før kvetiapinkurateringen');

  create temporary table kvetiapin_fullforing_kilder(
    nokkel text primary key, tittel text, forfattere text, aar text, lenke text
  ) on commit drop;
  insert into kvetiapin_fullforing_kilder values
    ('spc','Seroquel Depot – preparatomtale','Direktoratet for medisinske produkter','2024','https://produktinformasjon.legemiddelsok.no/preparatomtaler/07-5214.pdf'),
    ('intox','Acute Quetiapine Intoxication: Relationship Between Ingested Dose, Serum Concentration, Clinical Severity and Pharmacokinetics','Dobravc Verbic M, et al.','2024','https://doi.org/10.3390/jox14040085'),
    ('postmortem','Postmortem Quetiapine Reference Concentrations in Brain and Blood','Skov L, Johansen SS, Linnet K','2015','https://doi.org/10.1093/jat/bkv072'),
    ('pregnancy','Perinatal Safety of Quetiapine During Pregnancy: A Systematic Review, Meta-Analysis, and Evidence Gaps','Alem GM, et al.','2026','https://doi.org/10.1097/JCP.0000000000002127'),
    ('lactmed','Quetiapine','Drugs and Lactation Database (LactMed)','2026','https://www.ncbi.nlm.nih.gov/books/NBK501087/'),
    ('milk','Quetiapine Excretion Into Human Breast Milk','Yazdani-Brojeni P, et al.','2018','https://doi.org/10.1097/JCP.0000000000000905'),
    ('interaction','Effects of cytochrome P450 3A modulators ketoconazole and carbamazepine on quetiapine pharmacokinetics','Grimm SW, et al.','2006','https://doi.org/10.1111/j.1365-2125.2005.02507.x');

  for k in select * from kvetiapin_fullforing_kilder order by nokkel loop
    ref := intern.kuratering_referanse(
      jsonb_build_object('tittel',k.tittel,'forfattere',k.forfattere,'aar',k.aar,'lenke',k.lenke), kilde);
    kilder := kilder || jsonb_build_object(k.nokkel, ref::text);
  end loop;

  perform intern.kuratering_lagre(sedasjon, 1, jsonb_build_object(
    'data', $json${"tittel":"Sedasjon og søvnighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Søvnighet og sedasjon er blant de mest fremtredende akutte effektene av kvetiapin. I en kryssrandomisert PET-studie hos seks friske menn ga én dose 25 mg et kortikalt histamin H"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorbelegg på omtrent 56–81 %, og reseptorbelegget korrelerte med subjektiv søvnighet."}]},{"type":"paragraph","content":[{"type":"text","text":"I kliniske studier ved bipolar og unipolar depresjon opptrådte somnolens vanligvis i løpet av de første tre behandlingsdagene. Kvetiapin kan derfor redusere årvåkenhet og påvirke bilkjøring og andre aktiviteter som krever oppmerksomhet, særlig tidlig i behandlingen og under doseøkning."}]}]}}$json$::jsonb
  ), kilde);

  perform intern.kuratering_lagre(indikasjon, 2, jsonb_build_object(
    'data', $json${"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin er godkjent til behandling av schizofreni, moderate til alvorlige maniske episoder ved bipolar lidelse, depressive episoder ved bipolar lidelse og forebygging av tilbakefall av maniske eller depressive episoder hos pasienter som tidligere har respondert på kvetiapin."}]},{"type":"paragraph","content":[{"type":"text","text":"Depotformuleringen er i tillegg godkjent som tilleggsbehandling ved depressive episoder hos pasienter med unipolar depresjon som har hatt suboptimal respons på antidepressiv monoterapi."}]}]}}$json$::jsonb,
    'referanser', jsonb_build_array(kilder->>'spc')
  ), kilde);

  perform intern.kuratering_lagre(interaksjoner, 4, jsonb_build_object(
    'data', $json${"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin er et sensitivt CYP3A4-substrat. Samtidig bruk av sterke CYP3A4-hemmere er kontraindisert; preparatomtalen nevner blant annet HIV-proteasehemmere, azol-antimykotika, erytromycin, klaritromycin og nefazodon. Grapefruktjuice skal unngås."}]},{"type":"paragraph","content":[{"type":"text","text":"Sterke enzyminduktorer kan redusere kvetiapineksponeringen kraftig. I farmakokinetiske studier økte ketokonazol eksponeringen markert, mens karbamazepin økte clearance og reduserte eksponeringen. Oppstart eller seponering av sterke CYP3A4-hemmere eller -induktorer kan derfor kreve valg av alternativ behandling eller nøye klinisk oppfølging."}]}]}}$json$::jsonb,
    'referanser', jsonb_build_array(kilder->>'spc', kilder->>'interaction')
  ), kilde);

  for oppdatering in select value from jsonb_array_elements($json$[
    {"panel":"toksisitet_forgiftning","posisjon":0,"elementtype":"kinetikkort","nokkel":{"tittel":"Toksisk dose og eksponering"},"data":{"tittel":"Toksisk dose og eksponering","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Alvorlighetsgraden ved akutt kvetiapinforgiftning øker med både inntatt dose og målt serumkonsentrasjon, men det finnes ingen enkelt dosegrense som sikkert skiller ukompliserte fra alvorlige forløp. I en nyere serie på 134 akutte forgiftninger var median rapportert dose 10 g; forfatterne foreslo inntak over 3 g som et praktisk varselnivå for økt risiko, ikke som en absolutt toksisk terskel."}]},{"type":"paragraph","content":[{"type":"text","text":"Depotformulering kan gi forsinket og mer langvarig toksisitet enn umiddelbar frisetting, og store depotinntak kan danne farmakobesoar."}]}]}},"refs":["intox","spc"]},
    {"panel":"toksisitet_forgiftning","posisjon":1,"elementtype":"kinetikkort","nokkel":{"tittel":"Toksiske konsentrasjoner"},"data":{"tittel":"Toksiske konsentrasjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Serumkonsentrasjonen kan støtte alvorlighetsvurderingen, men må tolkes sammen med tidspunkt etter inntak, formulering og klinikk. I serien med akutte forgiftninger var median maksimal konsentrasjon omtrent 4 mg/L, og forfatterne foreslo over 2 mg/L som et varselnivå for økt risiko for alvorlig forløp; dette er ikke en universell toksisitetsgrense."}]},{"type":"paragraph","content":[{"type":"text","text":"Postmortale blodkonsentrasjoner er matrise- og postmortemspesifikke og skal ikke brukes som serumgrenser hos levende pasienter. I en dansk postmortemserie var median blodkonsentrasjon 3,19 mg/kg når kvetiapin ble vurdert som medvirkende til dødsfallet, mot 0,15 mg/kg i ikke-medvirkende tilfeller."}]}]}},"refs":["intox","postmortem"]},
    {"panel":"toksisitet_forgiftning","posisjon":2,"elementtype":"kinetikkort","nokkel":{"tittel":"Klinisk forgiftningsbilde"},"data":{"tittel":"Klinisk forgiftningsbilde","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Forgiftningsbildet domineres av forsterkning av den kjente farmakologien: søvnighet/sedasjon, redusert bevissthet, takykardi og hypotensjon, ofte sammen med antikolinerge trekk. Forvirring, delirium og agitasjon kan også forekomme."}]},{"type":"paragraph","content":[{"type":"text","text":"Ved depotinntak kan maksimal sedasjon og pulsøkning komme forsinket, og oppvåkningen kan være forlenget."}]}]}},"refs":["spc","intox"]},
    {"panel":"toksisitet_forgiftning","posisjon":3,"elementtype":"kinetikkort","nokkel":{"tittel":"Alvorlige komplikasjoner"},"data":{"tittel":"Alvorlige komplikasjoner","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Alvorlig overdose kan gi koma, respirasjonsdepresjon, uttalt hypotensjon, QT-forlengelse, krampeanfall eller status epilepticus, rabdomyolyse og urinretensjon; dødsfall er rapportert."}]},{"type":"paragraph","content":[{"type":"text","text":"Risikoen for intensivbehov, intubasjon, vasopressorbehandling, QTc-forlengelse og kramper øker med dose og maksimal serumkonsentrasjon, men enkeltverdier kan ikke alene forutsi forløpet."}]}]}},"refs":["spc","intox"]},
    {"panel":"toksisitet_forgiftning","posisjon":4,"elementtype":"kinetikkort","nokkel":{"tittel":"Toksikokinetiske særtrekk"},"data":{"tittel":"Toksikokinetiske særtrekk","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Eliminasjonen kan være betydelig langsommere ved forgiftning enn ved terapeutisk bruk. I en nyere akuttserie var typisk terminal halveringstid omkring 16,5 timer, med ytterligere forlengelse ved svært høye konsentrasjoner."}]},{"type":"paragraph","content":[{"type":"text","text":"Depotpreparater kan gi forsinket absorpsjon og forlenget symptomvarighet. Ved store depotinntak er farmakobesoar beskrevet, noe som kan opprettholde absorpsjonen og gjøre vanlig ventrikkeltømming lite effektiv."}]}]}},"refs":["intox","spc"]},
    {"panel":"toksisitet_forgiftning","posisjon":5,"elementtype":"kinetikkort","nokkel":{"tittel":"Behandling ved forgiftning"},"data":{"tittel":"Behandling ved forgiftning","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Det finnes ingen spesifikk antidot."}]},{"type":"paragraph","content":[{"type":"text","text":"Preparatomtalen anbefaler å vurdere ventrikkelskylling ved alvorlig forgiftning tidlig etter inntak og aktivt kull. Ved refraktær hypotensjon bør adrenalin og dopamin unngås fordi beta-stimulering kan forverre hypotensjon ved kvetiapins alfa-blokade. Ved mistenkt depot-besoar kan bildediagnostikk og eventuell endoskopisk fjerning være aktuelt."}]}]}},"refs":["spc"]},
    {"panel":"graviditet_amming","posisjon":0,"elementtype":"kinetikkort","nokkel":{"tittel":"Graviditet"},"data":{"tittel":"Graviditet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Samlet observasjonsdata gir ikke holdepunkter for en tydelig økt risiko for større medfødte misdannelser ved kvetiapineksponering i svangerskapet. En systematisk oversikt og meta-analyse publisert i 2026 inkluderte 13 090 eksponerte graviditeter med misdannelsesutfall og fant en samlet forekomst av større misdannelser på 4,1 %, omtrent på nivå med bakgrunnsrisikoen."}]},{"type":"paragraph","content":[{"type":"text","text":"Evidensen er observasjonell og påvirkes av indikasjon og andre konfunderende faktorer. Preparatomtalen anbefaler bruk i graviditet bare når forventet nytte oppveier mulig risiko. Flere studier peker på en mulig doseavhengig sammenheng med svangerskapsdiabetes, slik at metabolsk oppfølging er relevant."}]}]}},"refs":["pregnancy","spc"]},
    {"panel":"graviditet_amming","posisjon":1,"elementtype":"kinetikkort","nokkel":{"tittel":"Perinatal og neonatal påvirkning"},"data":{"tittel":"Perinatal og neonatal påvirkning","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Eksponering for antipsykotika, inkludert kvetiapin, i tredje trimester kan gi neonatal påvirkning etter fødsel. Preparatomtalen beskriver risiko for ekstrapyramidale symptomer og/eller seponeringssymptomer som agitasjon, hypertoni eller hypotoni, tremor, somnolens, respirasjonsbesvær og ernæringsproblemer."}]},{"type":"paragraph","content":[{"type":"text","text":"Nyfødte som er eksponert sent i svangerskapet bør derfor observeres klinisk etter fødselen. Tilgjengelige data gir ikke grunnlag for å angi en presis individuell risiko."}]}]}},"refs":["spc","pregnancy"]},
    {"panel":"graviditet_amming","posisjon":2,"elementtype":"kinetikkort","nokkel":{"tittel":"Amming"},"data":{"tittel":"Amming","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin går over i morsmelk i lave mengder. LactMed oppsummerer at doser opp til 400 mg/døgn vanligvis gir en beregnet spedbarnsdose under 1 % av mors vektjusterte dose. I en serie på ni ammende kvinner var gjennomsnittlig relativ spedbarnsdose 0,16 % (0,04–0,35 %)."}]},{"type":"paragraph","content":[{"type":"text","text":"Publiserte spedbarnsutfall er begrensede, men gjennomgående betryggende. Ved amming anbefales observasjon for særlig søvnighet og normal utvikling, og nytte–risiko må vurderes individuelt."}]}]}},"refs":["lactmed","milk","spc"]},
    {"panel":"graviditet_amming","posisjon":3,"elementtype":"kinetikkort","nokkel":{"tittel":"Fertilitet og reproduksjon"},"data":{"tittel":"Fertilitet og reproduksjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Effekten av kvetiapin på human fertilitet er ikke fastslått. Hyperprolaktinemi og seksuell dysfunksjon er kjente mulige bivirkninger og kan være klinisk relevante for reproduktiv funksjon, men preparatomtalen gir ikke grunnlag for å kvantifisere en selvstendig fertilitetsrisiko hos mennesker."}]}]}},"refs":["spc"]}
  ]$json$::jsonb) loop
    select coalesce(jsonb_agg(to_jsonb(kilder->>x.nokkel) order by x.i),'[]'::jsonb)
      into referanser
      from jsonb_array_elements_text(oppdatering->'refs') with ordinality x(nokkel,i);

    select jsonb_set(
      oppdatering->'data',
      '{dokument,content}',
      coalesce(jsonb_agg(
        case
          when node->>'type' = 'paragraph' then
            jsonb_set(
              node,
              '{content}',
              coalesce(node->'content', '[]'::jsonb) || jsonb_build_array(
                jsonb_build_object('type','sitering','attrs',jsonb_build_object('referanser',referanser))
              )
            )
          else node
        end
        order by ord
      ), '[]'::jsonb)
    )
      into data
      from jsonb_array_elements(oppdatering#>'{data,dokument,content}') with ordinality n(node,ord);

    perform intern.kuratering_nytt(side, jsonb_build_object(
      'panel', oppdatering->>'panel',
      'posisjon', (oppdatering->>'posisjon')::integer,
      'elementtype', oppdatering->>'elementtype',
      'data', data,
      'referanser', referanser),
      oppdatering->'nokkel', kilde);
  end loop;
end
$kuratering$;