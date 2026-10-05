-- Tillegg til monografkurateringen av kvetiapin.
-- Faglig litteraturgjennomgang utført i vanlig ChatGPT 04.10.2026.
-- Fyller bare tidligere tomme paneler og bevarer eksisterende farmakodynamikk, dosering, farmakokinetikk og farmakogenetikk.
-- Migrasjonen stopper dersom målpanelene er endret etter preflight.

do $kuratering$
declare
  side uuid := intern.kuratering_start('kvetiapin');
  kilde constant text := 'Monografkuratering av kvetiapin 04.10.2026: oppsummering, virkninger og avhengighet';
  k record;
  ref uuid;
  kilder jsonb := '{}'::jsonb;
  oppdatering jsonb;
  referanser jsonb;
  data jsonb;
begin
  if side is null then
    return;
  end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'Kurateringen er alt gjort.';
    return;
  end if;

  perform intern.kuratering_antall(side, 'identitet', 'riktekst', 0);
  perform intern.kuratering_antall(side, 'virkninger', 'kinetikkort', 0);
  perform intern.kuratering_antall(side, 'avhengighet_toleranse', 'kinetikkort', 0);

  create temporary table kvetiapin_tillegg_kilder(
    nokkel text primary key, tittel text, forfattere text, aar text, lenke text
  ) on commit drop;
  insert into kvetiapin_tillegg_kilder values
    ('spc_xr','Seroquel Depot – preparatomtale (SPC)','Direktoratet for medisinske produkter','2026','https://produktinformasjon.legemiddelsok.no/preparatomtaler/07-5214.pdf'),
    ('hutton','Quetiapine immediate release v. placebo for schizophrenia: systematic review, meta-analysis and reappraisal','Hutton P, Taylor PJ, Mulligan L, Tully S, Moncrieff J','2015','https://doi.org/10.1192/bjp.bp.114.154377'),
    ('kishi','Pharmacological treatment for bipolar mania: a systematic review and network meta-analysis of double-blind randomized controlled trials','Kishi T, Ikuta T, Matsuda Y, et al.','2022','https://doi.org/10.1038/s41380-021-01334-4'),
    ('suttajit','Quetiapine for acute bipolar depression: a systematic review and meta-analysis','Suttajit S, Srisurapanont M, Maneeton N, Maneeton B','2014','https://doi.org/10.2147/DDDT.S63779'),
    ('sato','Histamine H1 receptor occupancy by the new-generation antipsychotics olanzapine and quetiapine: a positron emission tomography study in healthy volunteers','Sato H, Ito C, Hiraoka K, et al.','2015','https://doi.org/10.1007/s00213-015-4002-2'),
    ('monahan','Quetiapine withdrawal: A systematic review','Monahan K, Cuzens-Sutton J, Siskind D, Kisely S','2021','https://doi.org/10.1177/0004867420965693'),
    ('vento','Quetiapine Abuse Fourteen Years Later: Where Are We Now? A Systematic Review','Vento AE, Kotzalidis GD, Cacciotti M, et al.','2020','https://doi.org/10.1080/10826084.2019.1668013'),
    ('jahnsen','Quetiapine, Misuse and Dependency: A Case-Series of Questions to a Norwegian Network of Drug Information Centers','Jahnsen JA, Widnes SF, Schjøtt J','2021','https://doi.org/10.2147/DHPS.S296515');

  for k in select * from kvetiapin_tillegg_kilder order by nokkel loop
    ref := intern.kuratering_referanse(
      jsonb_build_object('tittel',k.tittel,'forfattere',k.forfattere,'aar',k.aar,'lenke',k.lenke),
      kilde);
    kilder := kilder || jsonb_build_object(k.nokkel,ref::text);
  end loop;

  -- Kort oppsummering: syntese av den samlede vurderingen, med inline-siteringer.
  data := '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin er et annengenerasjons antipsykotikum med dokumentert effekt ved schizofreni og akutt mani, og har også antidepressiv effekt ved bipolar depresjon; depotformuleringen er i Norge i tillegg godkjent som tilleggsbehandling ved unipolar depresjon når antidepressiv monoterapi har gitt suboptimal respons."},{"type":"sitering","attrs":{"referanser":["__spc_xr__","__hutton__","__kishi__","__suttajit__"]}}]},{"type":"paragraph","content":[{"type":"text","text":"Søvnighet og sedasjon er en fremtredende del av virkningsprofilen og kan opptre allerede ved lave doser; graden varierer mellom personer og er ikke et mål på antipsykotisk effekt."},{"type":"sitering","attrs":{"referanser":["__spc_xr__","__sato__"]}}]},{"type":"paragraph","content":[{"type":"text","text":"Brå seponering kan gi et seponeringssyndrom med blant annet søvnløshet, gastrointestinale symptomer, svimmelhet og irritabilitet, og preparatomtalen anbefaler gradvis seponering over minst én til to uker."},{"type":"sitering","attrs":{"referanser":["__spc_xr__","__monahan__"]}}]},{"type":"paragraph","content":[{"type":"text","text":"Misbruk og avhengighetslignende bruk er dokumentert, særlig i selekterte grupper med tidligere rusproblemer og ved ikke-godkjent bruk for søvn, men tilgjengelige data gir ikke et pålitelig mål på addiksjonsrisikoen ved ordinær terapeutisk behandling."},{"type":"sitering","attrs":{"referanser":["__vento__","__jahnsen__"]}}]}]}}'::jsonb;
  data := replace(data::text, '__spc_xr__', kilder->>'spc_xr')::jsonb;
  data := replace(data::text, '__hutton__', kilder->>'hutton')::jsonb;
  data := replace(data::text, '__kishi__', kilder->>'kishi')::jsonb;
  data := replace(data::text, '__suttajit__', kilder->>'suttajit')::jsonb;
  data := replace(data::text, '__sato__', kilder->>'sato')::jsonb;
  data := replace(data::text, '__monahan__', kilder->>'monahan')::jsonb;
  data := replace(data::text, '__vento__', kilder->>'vento')::jsonb;
  data := replace(data::text, '__jahnsen__', kilder->>'jahnsen')::jsonb;
  perform intern.kuratering_nytt(side, jsonb_build_object(
    'panel','identitet','posisjon',0,'elementtype','riktekst',
    'data',data
  ), '{}'::jsonb, kilde);

  -- Observerbare humane virkninger og de dokumenterte adaptasjons-/addiksjonsfenomenene.
  for oppdatering in select value from jsonb_array_elements('[{"panel":"virkninger","posisjon":0,"elementtype":"kinetikkort","nokkel":{"tittel":"Antipsykotisk effekt"},"data":{"tittel":"Antipsykotisk effekt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ved schizofreni reduserer kvetiapin psykotiske symptomer sammenlignet med placebo, men den gjennomsnittlige korttidseffekten er beskjeden. En meta-analyse av 15 randomiserte studier fant en vektet forskjell i PANSS-totalskår på −6,5 poeng (95 % KI −8,9 til −4,0), tilsvarende SMD −0,33 (95 % KI −0,46 til −0,21), over 2–12 uker."}]},{"type":"paragraph","content":[{"type":"text","text":"Omtrent 21 personer måtte behandles for at én ekstra skulle oppnå minst 50 % reduksjon i PANSS sammenlignet med placebo. Mange av de eldre studiene hadde stort frafall, og effektestimatet ble mindre ved mer konservative antakelser om dem som avbrøt; tallene bør derfor tolkes med denne begrensningen."}]}]}},"refs":["hutton"]},{"panel":"virkninger","posisjon":1,"elementtype":"kinetikkort","nokkel":{"tittel":"Antimanisk effekt"},"data":{"tittel":"Antimanisk effekt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin har dokumentert effekt ved akutt mani. I en nettverksmeta-analyse av 72 dobbeltblinde randomiserte studier hos voksne var kvetiapin bedre enn placebo både for behandlingsrespons og reduksjon av maniske symptomer."}]},{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin var også blant legemidlene som hadde lavere samlet behandlingsavbrudd enn placebo i analysen. Effekten må vurderes sammen med doseavhengige bivirkninger og den enkelte pasients kliniske situasjon."}]}]}},"refs":["kishi","spc_xr"]},{"panel":"virkninger","posisjon":2,"elementtype":"kinetikkort","nokkel":{"tittel":"Antidepressiv effekt"},"data":{"tittel":"Antidepressiv effekt","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ved akutt bipolar depresjon fant en meta-analyse av 11 randomiserte studier (n=3 488) større reduksjon i depresjonsskår med kvetiapin enn med placebo: gjennomsnittsforskjell −4,66 poeng (95 % KI −5,59 til −3,73). Forskjellen var målbar fra uke 1."}]},{"type":"paragraph","content":[{"type":"text","text":"Studiene viste også bedring i blant annet funksjon, angst og søvn, men samtidig mer sedasjon, somnolens, svimmelhet og vektøkning. I Norge er depotkvetiapin godkjent både ved bipolar depresjon og som tilleggsbehandling ved unipolar depresjon etter suboptimal respons på antidepressiv monoterapi."}]}]}},"refs":["suttajit","spc_xr"]},{"panel":"virkninger","posisjon":3,"elementtype":"kinetikkort","nokkel":{"tittel":"Sedasjon og søvnighet"},"data":{"tittel":"Sedasjon og søvnighet","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Søvnighet og sedasjon er blant de mest fremtredende akutte effektene av kvetiapin. I en kryssrandomisert PET-studie hos seks friske menn ga én dose 25 mg et kortikalt histamin H"},{"type":"subscript","content":[{"type":"text","text":"1"}]},{"type":"text","text":"-reseptorbelegg på omtrent 56–81 %, og reseptorbelegget korrelerte med subjektiv søvnighet."}]},{"type":"paragraph","content":[{"type":"text","text":"I kliniske studier ved bipolar og unipolar depresjon opptrådte somnolens vanligvis i løpet av de første tre behandlingsdagene. Kvetiapin kan derfor redusere årvåkenhet og påvirke bilkjøring og andre aktiviteter som krever oppmerksomhet, særlig tidlig i behandlingen og under doseøkning."}]}]}},"refs":["sato","spc_xr"]},{"panel":"avhengighet_toleranse","posisjon":0,"elementtype":"kinetikkort","nokkel":{"tittel":"Toleranseutvikling"},"data":{"tittel":"Toleranseutvikling","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Det tydeligste kliniske tegnet på fysiologisk tilvenning gjelder den sedative effekten. Preparatomtalen angir at somnolens vanligvis oppstår i løpet av de to første behandlingsukene og vanligvis avtar eller forsvinner ved fortsatt behandling."}]},{"type":"paragraph","content":[{"type":"text","text":"Dette forløpet beskriver tilvenning til søvnighet. Det bør ikke uten videre generaliseres til andre virkninger eller tolkes som et tegn på addiksjon."}]}]}},"refs":["spc_xr"]},{"panel":"avhengighet_toleranse","posisjon":1,"elementtype":"kinetikkort","nokkel":{"tittel":"Abstinens, seponeringssyndrom og rebound-effekter"},"data":{"tittel":"Abstinens, seponeringssyndrom og rebound-effekter","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Brå seponering kan gi et seponeringssyndrom. Preparatomtalen beskriver særlig søvnløshet, kvalme, hodepine, diaré, oppkast, svimmelhet og irritabilitet; i placebokontrollerte studier falt hyppigheten signifikant én uke etter seponering. Gradvis seponering over minst én til to uker anbefales."}]},{"type":"paragraph","content":[{"type":"text","text":"En systematisk oversikt fant 13 publikasjoner, alle enkeltkasuistikker og gjennomgående av begrenset kvalitet. Rask seponering var assosiert med blant annet kvalme, oppkast, uro, rastløshet, svetting, irritabilitet, angst, dysfori, søvnforstyrrelse, takykardi, hypertensjon og svimmelhet; enkelte rapporter beskrev også seponeringsdyskinesi."}]},{"type":"paragraph","content":[{"type":"text","text":"Spesifikke rebound-fenomener er dårlig karakterisert. Tilbakekomst av psykotiske, maniske eller depressive symptomer etter avsluttet behandling skal derfor ikke i seg selv betegnes som rebound; det kan representere tilbakefall av grunnlidelsen."}]}]}},"refs":["spc_xr","monahan"]},{"panel":"avhengighet_toleranse","posisjon":2,"elementtype":"kinetikkort","nokkel":{"tittel":"Addiksjon"},"data":{"tittel":"Addiksjon","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ikke-medisinsk bruk, legemiddelsøkende atferd og avhengighetslignende bruk av kvetiapin er dokumentert. En systematisk oversikt fant at problematisk bruk særlig var rapportert hos personer med andre rusproblemer og i retts-/fengselspopulasjoner; sedative og angstdempende virkninger ble ofte omtalt som motiv for bruken."}]},{"type":"paragraph","content":[{"type":"text","text":"En norsk RELIS-serie på 54 henvendelser illustrerer den samme seleksjonen: 29 (54 %) gjaldt personer med tidligere avhengighetsproblematikk og 14 (26 %) omtalte ikke-godkjent bruk mot søvnvansker. Bare tre saker stilte et spesifikt spørsmål om pasientavhengighet, alle knyttet til søvnbruk, og materialet kunne ikke fastslå kvetiapins generelle addiksjonspotensial."}]},{"type":"paragraph","content":[{"type":"text","text":"Det er derfor rimelig med særlig oppmerksomhet ved tidligere rusproblemer og ikke-medisinsk eller ikke-avtalt bruk, men dagens evidens gir ikke grunnlag for å tallfeste addiksjonsrisikoen i en vanlig terapeutisk populasjon."}]}]}},"refs":["vento","jahnsen"]}]'::jsonb) loop
    select coalesce(jsonb_agg(to_jsonb(kilder->>x.nokkel) order by x.i),'[]'::jsonb)
      into referanser
      from jsonb_array_elements_text(oppdatering->'refs') with ordinality x(nokkel,i);

    perform intern.kuratering_nytt(side, jsonb_build_object(
      'panel',oppdatering->>'panel',
      'posisjon',(oppdatering->>'posisjon')::integer,
      'elementtype',oppdatering->>'elementtype',
      'data',oppdatering->'data',
      'referanser',referanser),
      oppdatering->'nokkel', kilde);
  end loop;

  -- «Lært mestringsavhengighet» opprettes ikke: det finnes data om søvn-/urodrevet bruk,
  -- men ikke tilstrekkelig kvetiapinspesifikk evidens for akkurat dette læringsfenomenet.
end
$kuratering$;
