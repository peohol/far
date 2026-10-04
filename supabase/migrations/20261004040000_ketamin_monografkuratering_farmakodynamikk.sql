-- Oppfølging av monografkurateringen av ketamin: bredere kartlegging av farmakodynamiske mål.
-- Faglig litteraturgjennomgang utført i vanlig ChatGPT 04.10.2026.
-- De to eksisterende mekanismekortene fra forrige kuratering valideres, men endres ikke.

do $kuratering$
declare
  side uuid := intern.kuratering_start('ketamin');
  kilde constant text := 'Monografkuratering av ketamin 04.10.2026: utvidet farmakodynamisk kartlegging';
  forrige_kilde constant text := 'Monografkuratering av ketamin 03.10.2026: oppsummering, virkninger, farmakodynamikk, dosering, farmakokinetikk og avhengighet';
  nmdar uuid;
  hcn1 uuid;
  ref_opioid uuid;
  ref_m1 uuid;
  ref_nachr uuid;
  ref_na uuid;
  ref_sigma uuid;
  ref_trkb uuid;
begin
  if side is null then
    return;
  end if;
  if intern.kuratering_utfort(kilde) then
    raise notice 'Kurateringen er alt gjort.';
    return;
  end if;

  perform intern.kuratering_antall(side, 'farmakodynamikk', 'mekanismekort', 2);
  nmdar := intern.kuratering_element(
    side, 'farmakodynamikk', 'mekanismekort', '{"maal":"NMDA-reseptor"}'::jsonb, 1, forrige_kilde);
  hcn1 := intern.kuratering_element(
    side, 'farmakodynamikk', 'mekanismekort', '{"maal":"HCN1-kanaler"}'::jsonb, 1, forrige_kilde);

  ref_opioid := intern.kuratering_referanse(
    '{"tittel":"Structural basis of opioid receptor activation by PCP and ketamine","forfattere":"Jiang Q, Han J, Fine EJ, et al.","aar":"2026","lenke":"https://doi.org/10.1038/s41594-026-01839-y"}'::jsonb,
    kilde);
  ref_m1 := intern.kuratering_referanse(
    '{"tittel":"Inhibition by ketamine of muscarinic acetylcholine receptor function","forfattere":"Durieux ME","aar":"1995","lenke":"https://doi.org/10.1097/00000539-199507000-00012"}'::jsonb,
    kilde);
  ref_nachr := intern.kuratering_referanse(
    '{"tittel":"Ketamine and its preservative, benzethonium chloride, both inhibit human recombinant alpha7 and alpha4beta2 neuronal nicotinic acetylcholine receptors in Xenopus oocytes","forfattere":"Coates KM, Flood P","aar":"2001","lenke":"https://doi.org/10.1038/sj.bjp.0704315"}'::jsonb,
    kilde);
  ref_na := intern.kuratering_referanse(
    '{"tittel":"Blockade of voltage-operated neuronal and skeletal muscle sodium channels by S(+)- and R(-)-ketamine","forfattere":"Haeseler G, Tetzlaff D, Bufler J, et al.","aar":"2003","lenke":"https://doi.org/10.1213/01.ANE.0000052513.91900.D5"}'::jsonb,
    kilde);
  ref_sigma := intern.kuratering_referanse(
    '{"tittel":"Evaluation of sigma (sigma) receptors in the antidepressant-like effects of ketamine in vitro and in vivo","forfattere":"Robson MJ, Elliott M, Seminerio MJ, Matsumoto RR","aar":"2012","lenke":"https://doi.org/10.1016/j.euroneuro.2011.08.002"}'::jsonb,
    kilde);
  ref_trkb := intern.kuratering_referanse(
    '{"tittel":"Antidepressant drugs act by directly binding to TRKB neurotrophin receptors","forfattere":"Casarotto PC, Girych M, Fred SM, et al.","aar":"2021","lenke":"https://doi.org/10.1016/j.cell.2021.01.034"}'::jsonb,
    kilde);

  perform intern.kuratering_nytt(side, jsonb_build_object(
    'panel','farmakodynamikk','posisjon',2,'elementtype','mekanismekort',
    'data',$json$
{
      "maal":"μ-opioidreseptor (MOR)",
      "mekanisme":"partiell_agonisme",
      "dokument":{"type":"doc","content":[
        {"type":"paragraph","content":[{"type":"text","text":"Ketamin binder direkte i det ortosteriske setet til humane μ-opioidreseptorer og virker som partiell agonist i funksjonelle cAMP-assays. For S-ketamin ble pKi 5,08 og pEC50 5,08 rapportert; affiniteten er betydelig lavere enn for NMDA-reseptoren."}]},
        {"type":"paragraph","content":[{"type":"text","text":"Dette etablerer MOR som et reelt sekundærmål, men den kliniske betydningen for analgesi, antidepressiv effekt og forsterkende egenskaper er fortsatt uavklart og kan ikke utledes av bindingsdata alene."}]}
      ]}
    }
$json$::jsonb,
    'referanser',jsonb_build_array(ref_opioid)
  ), '{"maal":"μ-opioidreseptor (MOR)"}'::jsonb, kilde);

  perform intern.kuratering_nytt(side, jsonb_build_object(
    'panel','farmakodynamikk','posisjon',3,'elementtype','mekanismekort',
    'data',$json$
{
      "maal":"κ-opioidreseptor (KOR)",
      "mekanisme":"partiell_agonisme",
      "dokument":{"type":"doc","content":[
        {"type":"paragraph","content":[{"type":"text","text":"Ketamin binder direkte til humane κ-opioidreseptorer og virker som partiell agonist. For S-ketamin ble pKi 5,01 og pEC50 4,72 rapportert; også her er målpotensen klart lavere enn ved NMDA-reseptoren."}]},
        {"type":"paragraph","content":[{"type":"text","text":"I mus ble ketaminindusert antinocisepsjon blokkert av den selektive KOR-antagonisten aticaprant og av nalokson. Dette støtter funksjonell betydning in vivo, men dokumenterer ikke hvor stor rolle KOR har for kliniske effekter hos mennesker."}]}
      ]}
    }
$json$::jsonb,
    'referanser',jsonb_build_array(ref_opioid)
  ), '{"maal":"κ-opioidreseptor (KOR)"}'::jsonb, kilde);

  perform intern.kuratering_nytt(side, jsonb_build_object(
    'panel','farmakodynamikk','posisjon',4,'elementtype','mekanismekort',
    'data',$json$
{
      "maal":"M1-muskarinreseptor",
      "mekanisme":"antagonisme",
      "dokument":{"type":"doc","content":[
        {"type":"paragraph","content":[{"type":"text","text":"Ketamin hemmer M1-muskarinreseptormediert signalering direkte. I humane rekombinante M1-reseptorer uttrykt i Xenopus-oocytter var IC50 omtrent 5,7 µM, med nær komplett hemming ved høye konsentrasjoner."}]},
        {"type":"paragraph","content":[{"type":"text","text":"Studien dokumenterer funksjonell antagonisme, men ikke at hemmingen er kompetitiv. Bidraget til ketamins kliniske anestetiske, kognitive eller autonome effekter er ikke avklart."}]}
      ]}
    }
$json$::jsonb,
    'referanser',jsonb_build_array(ref_m1)
  ), '{"maal":"M1-muskarinreseptor"}'::jsonb, kilde);

  perform intern.kuratering_nytt(side, jsonb_build_object(
    'panel','farmakodynamikk','posisjon',5,'elementtype','mekanismekort',
    'data',$json$
{
      "maal":"α7-nikotinreseptor",
      "mekanisme":"antagonisme",
      "dokument":{"type":"doc","content":[
        {"type":"paragraph","content":[{"type":"text","text":"Rent racemisk ketamin hemmer humane rekombinante α7-nikotinreseptorer ikke-kompetitivt; IC50 var 20 ± 2 µM i Xenopus-oocytter. Dette ligger i et konsentrasjonsområde som kan overlappe anestetisk eksponering, men er klart svakere enn NMDA-reseptorblokkaden."}]},
        {"type":"paragraph","content":[{"type":"text","text":"Benzetoniumklorid, et konserveringsmiddel i enkelte ketaminpreparater, hemmer samme reseptor mer potent. Preparatspesifikk konserveringsmiddeleffekt skal derfor ikke tilskrives ketaminmolekylet."}]}
      ]}
    }
$json$::jsonb,
    'referanser',jsonb_build_array(ref_nachr)
  ), '{"maal":"α7-nikotinreseptor"}'::jsonb, kilde);

  perform intern.kuratering_nytt(side, jsonb_build_object(
    'panel','farmakodynamikk','posisjon',6,'elementtype','mekanismekort',
    'data',$json$
{
      "maal":"α4β2-nikotinreseptor",
      "mekanisme":"bruksavhengig_blokkering",
      "dokument":{"type":"doc","content":[
        {"type":"paragraph","content":[{"type":"text","text":"Ketamin hemmer humane rekombinante α4β2-nikotinreseptorer ikke-kompetitivt og på en spennings- og bruksavhengig måte. IC50 var 50 ± 4 µM, altså ved høyere konsentrasjoner enn for α7-reseptoren."}]},
        {"type":"paragraph","content":[{"type":"text","text":"Funnet dokumenterer en direkte kanalvirkning, men den relativt lave potensen gjør betydningen ved vanlig systemisk eksponering usikker."}]}
      ]}
    }
$json$::jsonb,
    'referanser',jsonb_build_array(ref_nachr)
  ), '{"maal":"α4β2-nikotinreseptor"}'::jsonb, kilde);

  perform intern.kuratering_nytt(side, jsonb_build_object(
    'panel','farmakodynamikk','posisjon',7,'elementtype','mekanismekort',
    'data',$json$
{
      "maal":"Spenningsstyrte Na+-kanaler",
      "mekanisme":"kanalblokkering",
      "dokument":{"type":"doc","content":[
        {"type":"paragraph","content":[{"type":"text","text":"Ketamin blokkerer spenningsstyrte Na+-kanaler direkte og med høyere affinitet for inaktivert enn hvilende kanaltilstand. I rekombinante nevronale og humane skjelettmuskelkanaler var blokkaden spenningsavhengig, med tydelig stereoselektivitet."}]},
        {"type":"paragraph","content":[{"type":"text","text":"Potensen var vesentlig lavere enn ved NMDA-reseptoren (IC50 i titalls til hundrevis av µM avhengig av kanaltype og membranpotensial). Mekanismen kan derfor være mest relevant ved høy lokal eksponering og bidraget til vanlige systemiske effekter er usikkert."}]}
      ]}
    }
$json$::jsonb,
    'referanser',jsonb_build_array(ref_na)
  ), '{"maal":"Spenningsstyrte Na+-kanaler"}'::jsonb, kilde);

  perform intern.kuratering_nytt(side, jsonb_build_object(
    'panel','farmakodynamikk','posisjon',8,'elementtype','mekanismekort',
    'data',$json$
{
      "maal":"σ1- og σ2-reseptorer",
      "mekanisme":"reseptorbinding",
      "dokument":{"type":"doc","content":[
        {"type":"paragraph","content":[{"type":"text","text":"Racemisk ketamin binder σ1- og σ2-reseptorer med mikromolar affinitet. I prekliniske modeller påvirket σ-reseptorantagonister enkelte cellulære effekter av ketamin, men blokkerte ikke den antidepressivlignende effekten i tvungen-svømming-test."}]},
        {"type":"paragraph","content":[{"type":"text","text":"Bindingen er derfor dokumentert, mens funksjonell retning og klinisk betydning hos mennesker er usikker."}]}
      ]}
    }
$json$::jsonb,
    'referanser',jsonb_build_array(ref_sigma)
  ), '{"maal":"σ1- og σ2-reseptorer"}'::jsonb, kilde);

  perform intern.kuratering_nytt(side, jsonb_build_object(
    'panel','farmakodynamikk','posisjon',9,'elementtype','mekanismekort',
    'data',$json$
{
      "maal":"TrkB-reseptor",
      "mekanisme":"reseptorbinding",
      "dokument":{"type":"doc","content":[
        {"type":"paragraph","content":[{"type":"text","text":"Direkte binding av ketamin og esketamin til TrkB er rapportert i cellulære og prekliniske systemer. I bindingsforsøk var Ki omtrent 12,3 µM for ketamin og 2,86 µM for esketamin, og bindingen ble koblet til fasilitering av BDNF-TrkB-signalering."}]},
        {"type":"paragraph","content":[{"type":"text","text":"Dette er en foreslått mekanisme for antidepressiv virkning, men den kausale og kliniske betydningen hos mennesker er fortsatt utilstrekkelig avklart. Kortet klassifiseres derfor som reseptorbinding fremfor etablert allosterisk modulering."}]}
      ]}
    }
$json$::jsonb,
    'referanser',jsonb_build_array(ref_trkb)
  ), '{"maal":"TrkB-reseptor"}'::jsonb, kilde);

  -- D2-reseptor og monoamintransportører ble vurdert særskilt, men ikke lagt inn:
  -- direkte funksjonelle studier er motstridende eller negative ved relevante konsentrasjoner.
end
$kuratering$;