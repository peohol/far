-- Kvetiapin: kuratert farmakodynamikk, dosering og farmakokinetikk.
-- Kilder og faglige avgrensninger er gjennomgått på nytt 02.10.2026.
do $kvetiapin$
declare
  administrator uuid;
  side uuid;
  e record;
  n integer;
  data jsonb;
  kilder jsonb;
  oppdatering jsonb;
  referanser jsonb;

  ref_ir uuid;
  ref_xr uuid;
  ref_jensen uuid;
  ref_cross uuid;
  ref_devane uuid;
  ref_figueroa uuid;
  ref_li uuid;
  ref_clinpgx uuid;
  ref_bakken uuid;
  ref_dpwg uuid;
begin
  select p.id into administrator
  from public.profiles p
  where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet peohol, så kvetiapin-kurateringen hoppes over.';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);

  select s.objekt_id into side
  from public.infosider s
  where s.tilstand = 'publisert' and s.slug = 'kvetiapin';
  if side is null then
    raise exception 'Fant ikke publisert stoffside med slug kvetiapin.';
  end if;

  -- Preflight: kurateringen skal ikke overskrive senere redaksjonelle endringer.
  select count(*) into n
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
  join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
  join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
  where t.tilstand = 'publisert' and t.infoside_id = side
    and t.panel = 'farmakodynamikk' and t.elementtype = 'mekanismekort'
    and r.kilde = 'Farmakodynamikken strukturert som mekanismekort etter kartleggingen i docs/farmakodynamikk-kort-kartlegging.md'
    and t.data->>'maal' in (
      '5-HT2-reseptor', 'D1-reseptor', 'D2-reseptor', 'H1-reseptor', 'α1-reseptor', 'α2-reseptor',
      'Muskarinreseptorer (norkvetiapin)', 'Noradrenalintransportør / NET (norkvetiapin)', '5-HT1A-reseptor (norkvetiapin)'
    );
  if n <> 9 then
    raise exception 'Kvetiapin: forventet 9 uendrede mekanismekort, fant %.', n;
  end if;
  select count(*) into n from public.innholdselementer t
    where t.tilstand = 'publisert' and t.infoside_id = side
      and t.panel = 'farmakodynamikk' and t.elementtype = 'mekanismekort';
  if n <> 9 then
    raise exception 'Kvetiapin: farmakodynamikk har % mekanismekort totalt; kurateringen forventet 9.', n;
  end if;

  select count(*) into n
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
  join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
  join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
  where t.tilstand = 'publisert' and t.infoside_id = side
    and t.panel = 'dosering' and t.elementtype = 'riktekst'
    and r.kilde = 'Importert fra Psykofarmaka.pdf, side 49';
  if n <> 1 then
    raise exception 'Kvetiapin: forventet ett uendret doseringselement, fant %.', n;
  end if;

  select count(*) into n
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
  join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
  join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
  where t.tilstand = 'publisert' and t.infoside_id = side
    and t.panel = 'farmakokinetikk' and t.elementtype = 'kinetikkort'
    and r.kilde = 'Importert fra Psykofarmaka.pdf, side 49'
    and t.data->>'tittel' in ('Biotilgjengelighet', 'tₘₐₓ', 't½', 'tₛₛ', 'Proteinbinding', 'Vd', 'Eliminasjon', 'Annet');
  if n <> 8 then
    raise exception 'Kvetiapin: forventet 8 uendrede farmakokinetikkort etter seksjonsflyttingen, fant %.', n;
  end if;
  select count(*) into n from public.innholdselementer t
    where t.tilstand = 'publisert' and t.infoside_id = side
      and t.panel = 'farmakokinetikk' and t.elementtype = 'kinetikkort';
  if n <> 8 then
    raise exception 'Kvetiapin: farmakokinetikk har % kort totalt; kurateringen forventet 8 etter seksjonsflyttingen.', n;
  end if;

  -- CYP-kortet ble tidligere flyttet til Farmakogenetikk.
  select count(*) into n
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
  join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
  join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
  where t.tilstand = 'publisert' and t.infoside_id = side
    and t.panel = 'farmakogenetikk' and t.elementtype = 'kinetikkort'
    and t.data->>'tittel' = 'CYP-enzymer (substrat)'
    and r.kilde = 'Flyttet: fra farmakokinetikken til farmakogenetikken';
  if n <> 1 then
    raise exception 'Kvetiapin: forventet ett uendret CYP-kort i Farmakogenetikk, fant %.', n;
  end if;

  -- Interaksjonsteksten ble tidligere flyttet til Interaksjoner og gjort om til riktekst.
  select count(*) into n
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
  join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
  join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
  where t.tilstand = 'publisert' and t.infoside_id = side
    and t.panel = 'interaksjoner' and t.elementtype = 'riktekst'
    and r.kilde = 'Flyttet: fra kortet i farmakokinetikken til teksten øverst i interaksjonene';
  if n <> 1 then
    raise exception 'Kvetiapin: forventet én uendret redaksjonell interaksjonstekst, fant %.', n;
  end if;

  -- Referanser: gjenbruk globalt når samme tittel og lenke allerede finnes.
  select r.objekt_id into ref_ir from public.referanser r
   where r.tilstand = 'publisert' and not r.arkivert
     and r.tittel = 'Quetiapine Teva – preparatomtale'
     and r.lenke = 'https://produktinformasjon.legemiddelsok.no/preparatomtaler/07-5150.pdf'
   order by r.objekt_id limit 1;
  if ref_ir is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: norsk SPC fra Direktoratet for medisinske produkter', true);
    ref_ir := (public.opprett_utkast('referanse', '{"tittel":"Quetiapine Teva – preparatomtale","forfattere":"Direktoratet for medisinske produkter (SPC)","aar":"2026","lenke":"https://produktinformasjon.legemiddelsok.no/preparatomtaler/07-5150.pdf"}'::jsonb)).id;
    perform public.publiser_utkast(ref_ir, 1);
  end if;

  select r.objekt_id into ref_xr from public.referanser r
   where r.tilstand = 'publisert' and not r.arkivert
     and r.tittel = 'Quetiapine Accord – preparatomtale'
     and r.lenke = 'https://produktinformasjon.legemiddelsok.no/preparatomtaler/15-10695.pdf'
   order by r.objekt_id limit 1;
  if ref_xr is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: norsk SPC fra Direktoratet for medisinske produkter', true);
    ref_xr := (public.opprett_utkast('referanse', '{"tittel":"Quetiapine Accord – preparatomtale","forfattere":"Direktoratet for medisinske produkter (SPC)","aar":"2026","lenke":"https://produktinformasjon.legemiddelsok.no/preparatomtaler/15-10695.pdf"}'::jsonb)).id;
    perform public.publiser_utkast(ref_xr, 1);
  end if;

  select r.objekt_id into ref_jensen from public.referanser r
   where r.tilstand = 'publisert' and not r.arkivert
     and r.tittel = 'N-desalkylquetiapine, a potent norepinephrine reuptake inhibitor and partial 5-HT1A agonist, as a putative mediator of quetiapine''s antidepressant activity'
     and r.lenke = 'https://doi.org/10.1038/sj.npp.1301646'
   order by r.objekt_id limit 1;
  if ref_jensen is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: funksjonell farmakologistudie', true);
    ref_jensen := (public.opprett_utkast('referanse', '{"tittel":"N-desalkylquetiapine, a potent norepinephrine reuptake inhibitor and partial 5-HT1A agonist, as a putative mediator of quetiapine''s antidepressant activity","forfattere":"Jensen NH, Rodriguiz RM, Caron MG, Wetsel WC, Rothman RB, Roth BL","aar":"2008","lenke":"https://doi.org/10.1038/sj.npp.1301646"}'::jsonb)).id;
    perform public.publiser_utkast(ref_jensen, 1);
  end if;

  select r.objekt_id into ref_cross from public.referanser r
   where r.tilstand = 'publisert' and not r.arkivert
     and r.tittel = 'Quetiapine and its metabolite norquetiapine: translation from in vitro pharmacology to in vivo efficacy in rodent models'
     and r.lenke = 'https://doi.org/10.1111/bph.13346'
   order by r.objekt_id limit 1;
  if ref_cross is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: funksjonell farmakologistudie', true);
    ref_cross := (public.opprett_utkast('referanse', '{"tittel":"Quetiapine and its metabolite norquetiapine: translation from in vitro pharmacology to in vivo efficacy in rodent models","forfattere":"Cross AJ, Widzowski D, Maciag C, Zacco A, Hudzik T, Liu J, Nyberg S, Wood MW","aar":"2016","lenke":"https://doi.org/10.1111/bph.13346"}'::jsonb)).id;
    perform public.publiser_utkast(ref_cross, 1);
  end if;

  select r.objekt_id into ref_devane from public.referanser r
   where r.tilstand = 'publisert' and not r.arkivert
     and r.tittel = 'Clinical pharmacokinetics of quetiapine: an atypical antipsychotic'
     and r.lenke = 'https://doi.org/10.2165/00003088-200140070-00003'
   order by r.objekt_id limit 1;
  if ref_devane is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: human farmakokinetikk', true);
    ref_devane := (public.opprett_utkast('referanse', '{"tittel":"Clinical pharmacokinetics of quetiapine: an atypical antipsychotic","forfattere":"DeVane CL, Nemeroff CB","aar":"2001","lenke":"https://doi.org/10.2165/00003088-200140070-00003"}'::jsonb)).id;
    perform public.publiser_utkast(ref_devane, 1);
  end if;

  select r.objekt_id into ref_figueroa from public.referanser r
   where r.tilstand = 'publisert' and not r.arkivert
     and r.tittel = 'Pharmacokinetic profiles of extended release quetiapine fumarate compared with quetiapine immediate release'
     and r.lenke = 'https://doi.org/10.1016/j.pnpbp.2008.09.026'
   order by r.objekt_id limit 1;
  if ref_figueroa is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: sammenligning av IR- og depotfarmakokinetikk', true);
    ref_figueroa := (public.opprett_utkast('referanse', '{"tittel":"Pharmacokinetic profiles of extended release quetiapine fumarate compared with quetiapine immediate release","forfattere":"Figueroa C, Brecher M, Hamer-Maansson JE, Winter H","aar":"2009","lenke":"https://doi.org/10.1016/j.pnpbp.2008.09.026"}'::jsonb)).id;
    perform public.publiser_utkast(ref_figueroa, 1);
  end if;

  select r.objekt_id into ref_li from public.referanser r
   where r.tilstand = 'publisert' and not r.arkivert
     and r.tittel = 'Multiple dose pharmacokinetics of quetiapine and some of its metabolites in Chinese suffering from schizophrenia'
     and r.lenke = 'https://pubmed.ncbi.nlm.nih.gov/15000896/'
   order by r.objekt_id limit 1;
  if ref_li is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: human flerdose-farmakokinetikk', true);
    ref_li := (public.opprett_utkast('referanse', '{"tittel":"Multiple dose pharmacokinetics of quetiapine and some of its metabolites in Chinese suffering from schizophrenia","forfattere":"Li K-Y, Li X, Cheng Z-N, Peng W-X, Zhang B-K, Li H-D","aar":"2004","lenke":"https://pubmed.ncbi.nlm.nih.gov/15000896/"}'::jsonb)).id;
    perform public.publiser_utkast(ref_li, 1);
  end if;

  select r.objekt_id into ref_clinpgx from public.referanser r
   where r.tilstand = 'publisert' and not r.arkivert
     and r.tittel = 'Quetiapine Pathway, Pharmacokinetics'
     and r.lenke = 'https://www.clinpgx.org/pathway/PA166307081'
   order by r.objekt_id limit 1;
  if ref_clinpgx is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: oppdatert ClinPGx-PK-pathway', true);
    ref_clinpgx := (public.opprett_utkast('referanse', '{"tittel":"Quetiapine Pathway, Pharmacokinetics","forfattere":"ClinPGx","aar":"2026","lenke":"https://www.clinpgx.org/pathway/PA166307081"}'::jsonb)).id;
    perform public.publiser_utkast(ref_clinpgx, 1);
  end if;

  select r.objekt_id into ref_bakken from public.referanser r
   where r.tilstand = 'publisert' and not r.arkivert
     and r.tittel = 'Metabolism of the active metabolite of quetiapine, N-desalkylquetiapine in vitro'
     and r.lenke = 'https://doi.org/10.1124/dmd.112.045237'
   order by r.objekt_id limit 1;
  if ref_bakken is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: CYP2D6 og norkvetiapin', true);
    ref_bakken := (public.opprett_utkast('referanse', '{"tittel":"Metabolism of the active metabolite of quetiapine, N-desalkylquetiapine in vitro","forfattere":"Bakken GV, Molden E, Knutsen K, Lunder N, Hermann M","aar":"2012","lenke":"https://doi.org/10.1124/dmd.112.045237"}'::jsonb)).id;
    perform public.publiser_utkast(ref_bakken, 1);
  end if;

  select r.objekt_id into ref_dpwg from public.referanser r
   where r.tilstand = 'publisert' and not r.arkivert
     and r.tittel = 'Dutch Pharmacogenetics Working Group (DPWG) guideline for the gene-drug interaction between CYP2D6, CYP3A4 and CYP1A2 and antipsychotics'
     and r.lenke = 'https://doi.org/10.1038/s41431-023-01347-3'
   order by r.objekt_id limit 1;
  if ref_dpwg is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: klinisk farmakogenetikk', true);
    ref_dpwg := (public.opprett_utkast('referanse', '{"tittel":"Dutch Pharmacogenetics Working Group (DPWG) guideline for the gene-drug interaction between CYP2D6, CYP3A4 and CYP1A2 and antipsychotics","forfattere":"Beunk L, Nijenhuis M, Soree B, et al.","aar":"2024","lenke":"https://doi.org/10.1038/s41431-023-01347-3"}'::jsonb)).id;
    perform public.publiser_utkast(ref_dpwg, 1);
  end if;

  kilder := jsonb_build_object(
    'ir', ref_ir::text,
    'xr', ref_xr::text,
    'jensen', ref_jensen::text,
    'cross', ref_cross::text,
    'devane', ref_devane::text,
    'figueroa', ref_figueroa::text,
    'li', ref_li::text,
    'clinpgx', ref_clinpgx::text,
    'bakken', ref_bakken::text,
    'dpwg', ref_dpwg::text
  );

  -- Farmakodynamikk: skill binding fra funksjon og marker assayavhengig 5-HT1A-effikasi.
  for oppdatering in select value from jsonb_array_elements($json$
  [
    {"fra":"5-HT2-reseptor","mekanisme_fra":"antagonisme","data":{"maal":"5-HT2A-reseptor","mekanisme":"antagonisme","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin og norkvetiapin har 5-HT2A-antagonistisk aktivitet. Preparatomtalen beskriver høyere affinitet til 5-HT2 enn til D2, mens funksjonelle in vitro-data støtter antagonisme ved 5-HT2A."}]}]}},"kilder":["ir","jensen","cross"]},
    {"fra":"D1-reseptor","mekanisme_fra":"antagonisme","data":{"maal":"D1-reseptor","mekanisme":"reseptorbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin og norkvetiapin binder D1-reseptorer. Kildene dokumenterer affinitet tydeligere enn en klinisk viktig funksjonell D1-mekanisme, og kortet angir derfor binding fremfor antagonisme."}]}]}},"kilder":["ir","jensen"]},
    {"fra":"D2-reseptor","mekanisme_fra":"antagonisme","data":{"maal":"D2-reseptor","mekanisme":"antagonisme","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin og norkvetiapin har D2-antagonistisk aktivitet. Affiniteten er lavere enn ved 5-HT2-reseptorer; preparatomtalen knytter denne kombinerte antagonistprofilen til den antipsykotiske virkningen."}]}]}},"kilder":["ir","cross"]},
    {"fra":"H1-reseptor","mekanisme_fra":"antagonisme","data":{"maal":"H1-reseptor","mekanisme":"reseptorbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin og norkvetiapin har høy H1-affinitet. Funksjonell H1-antagonisme er vist for norkvetiapin in vitro; for samlet kvetiapineksponering er binding bedre direkte dokumentert i den aktuelle preparatomtalen."}]}]}},"kilder":["ir","jensen"]},
    {"fra":"α1-reseptor","mekanisme_fra":"antagonisme","data":{"maal":"α1-adrenerg reseptor","mekanisme":"reseptorbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin og norkvetiapin har høy affinitet til α1-adrenerge reseptorer. Norkvetiapin er vist som antagonist ved enkelte α1-subtyper in vitro, men den samlede funksjonelle profilen er mindre entydig enn reseptorbindingen."}]}]}},"kilder":["ir","jensen"]},
    {"fra":"α2-reseptor","mekanisme_fra":"antagonisme","data":{"maal":"α2-adrenerg reseptor","mekanisme":"reseptorbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Preparatomtalen beskriver moderat α2-adrenerg affinitet. Norkvetiapin viser antagonisme ved enkelte α2-subtyper in vitro, mens klinisk betydning er usikker."}]}]}},"kilder":["ir","jensen"]},
    {"fra":"Muskarinreseptorer (norkvetiapin)","mekanisme_fra":"reseptorbinding","data":{"maal":"M1-, M3- og M5-reseptorer (norkvetiapin)","mekanisme":"antagonisme","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin har lav eller ingen vesentlig muskarin affinitet, mens norkvetiapin har moderat til høy affinitet til flere muskarinreseptorer. Norkvetiapin er funksjonelt vist som antagonist ved M1, M3 og M5 in vitro; dette kan bidra til antikolinerge effekter."}]}]}},"kilder":["ir","jensen"]},
    {"fra":"Noradrenalintransportør / NET (norkvetiapin)","mekanisme_fra":"transporterhemming","data":{"maal":"Noradrenalintransportør / NET (norkvetiapin)","mekanisme":"reopptakshemming","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Norkvetiapin hemmer noradrenalintransportøren (NET) og dermed noradrenalinreopptak. Funksjonelle studier viser potent hemming; kvetiapin selv er omtrent 100 ganger svakere eller uten målbar NET-aktivitet avhengig av assaysystem."}]}]}},"kilder":["ir","jensen","cross"]},
    {"fra":"5-HT1A-reseptor (norkvetiapin)","mekanisme_fra":"partiell_agonisme","data":{"maal":"5-HT1A-reseptor (norkvetiapin)","mekanisme":"agonisme","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Norkvetiapin har funksjonell 5-HT1A-agonistisk aktivitet. Effikasien er assayavhengig: Jensen et al. klassifiserte virkningen som partiell agonisme, mens Cross et al. målte nær full agonistrespons i sitt assaysystem. Kortet angir derfor agonisme uten å låse effikasigraden."}]}]}},"kilder":["ir","jensen","cross"]}
  ]
  $json$::jsonb) loop
    select t.objekt_id, u.revisjon, r.innhold into e
    from public.innholdselementer t
    join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
    join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
    where t.tilstand = 'publisert' and t.infoside_id = side
      and t.panel = 'farmakodynamikk' and t.elementtype = 'mekanismekort'
      and t.data->>'maal' = oppdatering->>'fra'
      and t.data->>'mekanisme' = oppdatering->>'mekanisme_fra'
    order by t.objekt_id limit 1;
    if not found then
      raise exception 'Kvetiapin: mekanismekortet % er endret siden kurateringen ble laget.', oppdatering->>'fra';
    end if;

    select coalesce(jsonb_agg(to_jsonb(kilder->>x.nokkel) order by x.i), '[]'::jsonb) into referanser
    from jsonb_array_elements_text(oppdatering->'kilder') with ordinality x(nokkel, i);

    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: farmakodynamikk kildebelagt og funksjon skilt fra binding', true);
    perform public.lagre_utkast(
      e.objekt_id,
      e.revisjon,
      e.innhold || jsonb_build_object('data', oppdatering->'data', 'referanser', referanser)
    );
    perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);
  end loop;

  -- Dosering: indikasjonsspesifikke regimer for IR og depot fra gjeldende preparatomtaler.
  select t.objekt_id, u.revisjon, r.innhold into e
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
  join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
  join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
  where t.tilstand = 'publisert' and t.infoside_id = side
    and t.panel = 'dosering' and t.elementtype = 'riktekst'
  order by t.posisjon, t.objekt_id limit 1;

  data := $json$
  {"dokument":{"type":"doc","content":[
    {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Umiddelbar frisetting (IR)"}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Schizofreni"}]},
    {"type":"paragraph","content":[{"type":"text","text":"2 doser daglig. Døgndose dag 1–4: 50, 100, 200 og 300 mg. Vanlig vedlikehold 300–450 mg/døgn; individualiseres innen 150–750 mg/døgn."}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Bipolar mani"}]},
    {"type":"paragraph","content":[{"type":"text","text":"2 doser daglig. Døgndose dag 1–4: 100, 200, 300 og 400 mg. Videre økning til inntil 800 mg/døgn innen dag 6, maksimalt 200 mg per døgn. Vanlig effektiv dose 400–800 mg/døgn; doseområdet er 200–800 mg/døgn."}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Bipolar depresjon"}]},
    {"type":"paragraph","content":[{"type":"text","text":"1 dose ved sengetid. Døgndose dag 1–4: 50, 100, 200 og 300 mg. Anbefalt dose 300 mg/døgn; enkelte kan ha nytte av 600 mg. Doser >300 mg skal forskrives av lege med erfaring i bipolar lidelse; 200 mg kan vurderes ved tolerabilitetsproblemer."}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Forebygging av tilbakefall"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Fortsett dosen som ga respons, vanligvis 300–800 mg/døgn fordelt på 2 doser; bruk laveste effektive dose."}]},
    {"type":"horizontalRule"},
    {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Depot (XR)"}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Schizofreni og bipolar mani"}]},
    {"type":"paragraph","content":[{"type":"text","text":"1 dose daglig uten mat. 300 mg dag 1 og 600 mg dag 2. Anbefalt dose 600 mg/døgn; justeres vanligvis innen 400–800 mg/døgn, maksimalt 800 mg/døgn."}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Bipolar depresjon"}]},
    {"type":"paragraph","content":[{"type":"text","text":"1 dose ved sengetid. Døgndose dag 1–4: 50, 100, 200 og 300 mg. Anbefalt dose 300 mg/døgn; enkelte kan ha nytte av 600 mg. Samme forbehold som for IR gjelder for doser >300 mg og reduksjon til 200 mg."}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Forebygging av tilbakefall"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Fortsett effektiv dose ved sengetid, vanligvis 300–800 mg/døgn; bruk laveste effektive dose."}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Tilleggsbehandling ved unipolar depresjon"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Etter suboptimal respons på antidepressiv monoterapi: 50 mg/døgn dag 1–2 og 150 mg/døgn dag 3–4, ved sengetid. Bruk laveste effektive dose; eventuell økning fra 150 til 300 mg/døgn skal bygge på individuell nytte–risiko-vurdering."}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Bytte fra IR"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Ved overgang fra IR 2 ganger daglig kan samme totale døgndose gis som depot 1 gang daglig; individuell dosejustering kan være nødvendig."}]},
    {"type":"horizontalRule"},
    {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Spesielle grupper og seponering"}]},
    {"type":"bulletList","content":[
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Nedsatt leverfunksjon: start IR med 25 mg/døgn og øk 25–50 mg/døgn; start depot med 50 mg/døgn og øk i trinn på 50 mg."}]}]},
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Nedsatt nyrefunksjon: dosejustering er ikke nødvendig."}]}]},
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Eldre: langsommere titrering og lavere dose kan være nødvendig; plasmaclearance er i gjennomsnitt 30–50 % lavere. For depot er startdose 50 mg/døgn. Ved unipolar depresjon: 50 mg/døgn dag 1–3, 100 mg dag 4 og 150 mg dag 8; eventuell økning til 300 mg tidligst dag 22."}]}]},
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Barn og ungdom <18 år: anbefales ikke."}]}]},
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Seponering: gradvis nedtrapping over minst 1–2 uker anbefales."}]}]}
    ]}
  ]}}
  $json$::jsonb;

  perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: dosering oppdatert fra gjeldende IR- og depotpreparatomtaler', true);
  perform public.lagre_utkast(e.objekt_id, e.revisjon,
    e.innhold || jsonb_build_object('data', data, 'referanser', jsonb_build_array(ref_ir, ref_xr)));
  perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);

  -- Farmakokinetikk: oppdater eksisterende kort og legg referanse på hvert kort.
  for oppdatering in select value from jsonb_array_elements($json$
  [
    {"fra":"Biotilgjengelighet","data":{"tittel":"Absorpsjon og formulering","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"IR absorberes raskt, og matinntak påvirker eksponeringen lite. Depot gir omtrent samme AUC som tilsvarende total IR-dose, men ca. 13 % lavere Cmax og senere topp. Fettrikt måltid øker depot-Cmax ca. 50 % og AUC ca. 20 %; depot tas uten mat."}]}]}},"kilder":["ir","xr","devane","figueroa"]},
    {"fra":"tₘₐₓ","data":{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"IR: vanligvis 1–2 timer. Depot: omtrent 5–6 timer."}]}]}},"kilder":["devane","figueroa","xr"]},
    {"fra":"t½","data":{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin: ca. 7 timer. Norkvetiapin: ca. 12 timer."}]}]}},"kilder":["ir","xr","devane"]},
    {"fra":"tₛₛ","data":{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Steady state er observert innen omtrent 48 timer ved gjentatt dosering."}]}]}},"kilder":["li"]},
    {"fra":"Proteinbinding","data":{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ca. 83 %."}]}]}},"kilder":["ir","devane"]},
    {"fra":"Vd","data":{"tittel":"Vd","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Tilsynelatende distribusjonsvolum er stort; humane studier har rapportert omtrent 500–700 L, med betydelig interindividuell variasjon."}]}]}},"kilder":["devane","li"]},
    {"fra":"Eliminasjon","data":{"tittel":"Metabolisme og utskillelse","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Omfattende hepatisk metabolisme. Mindre enn 5 % utskilles uendret. Etter radiomerket dose gjenfinnes omtrent 73 % i urin og 21 % i feces, hovedsakelig som metabolitter."}]}]}},"kilder":["ir","xr","devane"]}
  ]
  ]
  $json$::jsonb) loop
    select t.objekt_id, u.revisjon, r.innhold into e
    from public.innholdselementer t
    join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
    join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
    where t.tilstand = 'publisert' and t.infoside_id = side
      and t.panel = 'farmakokinetikk' and t.elementtype = 'kinetikkort'
      and t.data->>'tittel' = oppdatering->>'fra'
    order by t.objekt_id limit 1;
    if not found then
      raise exception 'Kvetiapin: farmakokinetikkortet % er endret siden kurateringen ble laget.', oppdatering->>'fra';
    end if;

    select coalesce(jsonb_agg(to_jsonb(kilder->>x.nokkel) order by x.i), '[]'::jsonb) into referanser
    from jsonb_array_elements_text(oppdatering->'kilder') with ordinality x(nokkel, i);

    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: farmakokinetikk kildebelagt og presisert', true);
    perform public.lagre_utkast(e.objekt_id, e.revisjon,
      e.innhold || jsonb_build_object('data', oppdatering->'data', 'referanser', referanser));
    perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);
  end loop;

  -- CYP-kortet står i Farmakogenetikk etter seksjonsflyttingen.
  select t.objekt_id, u.revisjon, r.innhold into e
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
  join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
  join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
  where t.tilstand = 'publisert' and t.infoside_id = side
    and t.panel = 'farmakogenetikk' and t.elementtype = 'kinetikkort'
    and t.data->>'tittel' = 'CYP-enzymer (substrat)'
  order by t.objekt_id limit 1;
  if not found then
    raise exception 'Kvetiapin: CYP-kortet i Farmakogenetikk er endret siden kurateringen ble laget.';
  end if;
  data := $json$
  {"tittel":"CYP3A4 og CYP2D6","dokument":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"CYP3A4 er hovedenzymet for metabolismen av kvetiapin og danner blant annet den aktive metabolitten norkvetiapin. CYP2D6 har begrenset betydning for total clearance av moderstoffet, men bidrar til 7-hydroksylering og videre metabolisme av norkvetiapin."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Farmakogenetisk er CYP3A4 den klinisk handlingsrelevante veien. DPWG anbefaler ved kjent CYP3A4 poor metabolizer (PM) å velge et alternativ ved depresjon og bruke om lag 30 % av normaldosen ved andre indikasjoner. Evidensen er begrenset, og rutinemessig CYP3A4-genotyping før behandling anbefales ikke."}]},
    {"type":"paragraph","content":[{"type":"text","text":"CYP2D6-fenotype kan påvirke norkvetiapineksponering, men DPWG anbefaler ingen dose- eller behandlingsendring for CYP2D6–kvetiapin. ClinPGx' oppdaterte kvetiapin-PK-spor inkluderer CYP3A4 og CYP2D6."}]}
  ]}}
  $json$::jsonb;
  perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: CYP3A4/CYP2D6 presisert etter ClinPGx og Bakken et al. 2012', true);
  perform public.lagre_utkast(e.objekt_id, e.revisjon,
    e.innhold || jsonb_build_object('data', data, 'referanser', jsonb_build_array(ref_clinpgx, ref_dpwg, ref_bakken, ref_devane, ref_ir)));
  perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);

  -- Den redaksjonelle interaksjonsteksten står i eget panel etter seksjonsflyttingen.
  select t.objekt_id, u.revisjon, r.innhold into e
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
  join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
  join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
  where t.tilstand = 'publisert' and t.infoside_id = side
    and t.panel = 'interaksjoner' and t.elementtype = 'riktekst'
  order by t.posisjon, t.objekt_id limit 1;
  if not found then
    raise exception 'Kvetiapin: den redaksjonelle interaksjonsteksten er endret siden kurateringen ble laget.';
  end if;
  data := $json$
  {"dokument":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"Sterke CYP3A4-hemmere kan øke kvetiapineksponeringen betydelig og er kontraindisert i preparatomtalen. Enzyminduktorer kan øke clearance og redusere eksponeringen. Grapefrukt/grapefruktjuice skal unngås."}]}
  ]}}
  $json$::jsonb;
  perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: CYP3A4-interaksjoner kildebelagt i Interaksjoner-panelet', true);
  perform public.lagre_utkast(e.objekt_id, e.revisjon,
    e.innhold || jsonb_build_object('data', data, 'referanser', jsonb_build_array(ref_ir, ref_xr)));
  perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);

  -- Det gamle «Annet»-kortet var en løs samling av ratioopplysninger og dupliserende stoffinfo.
  -- Det tas av siden, men beholdes i historikken.
  select t.objekt_id, u.revisjon, r.innhold into e
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
  join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
  join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
  where t.tilstand = 'publisert' and t.infoside_id = side
    and t.panel = 'farmakokinetikk' and t.elementtype = 'kinetikkort' and t.data->>'tittel' = 'Annet'
  order by t.objekt_id limit 1;
  if not found then
    raise exception 'Kvetiapin: farmakokinetikkortet Annet er endret siden kurateringen ble laget.';
  end if;
  perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: uspesifikt Annet-kort erstattet av kildebelagte PK-kort', true);
  perform public.lagre_utkast(e.objekt_id, e.revisjon, jsonb_set(e.innhold, '{panel}', to_jsonb('fjernet'::text)));
  perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);
end
$kvetiapin$;
