
do $k$
declare
  administrator uuid; side uuid; e record; k record; ref uuid; objekt uuid;
  n integer; data jsonb; kilder jsonb := '{}'::jsonb; oppdatering jsonb; referanser jsonb; forrige jsonb;
begin
  select id into administrator from public.profiles where username='peohol' and role='admin';
  if administrator is null then raise exception 'Fant ingen administrator peohol.'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',administrator,'role','authenticated')::text,true);

  select objekt_id into side from public.infosider where tilstand='publisert' and slug='kvetiapin';
  if side is null then raise exception 'Fant ikke publisert kvetiapinside.'; end if;

  if exists (
    select 1
    from public.innholdselementer t
    join public.objekttilstander u on u.objekt_id=t.objekt_id and u.tilstand='utkast'
    join public.objektrevisjoner r on r.objekt_id=t.objekt_id and r.revisjon=u.revisjon
    where t.tilstand='publisert' and t.infoside_id=side and t.panel='farmakodynamikk'
      and t.elementtype='mekanismekort' and t.data->>'maal'='5-HT2C-reseptor'
      and r.kilde='Monografikuratering av kvetiapin 02.10.2026: 5-HT2C-antagonisme lagt til etter funksjonelle data'
  ) then
    raise notice 'Korrigert kvetiapinkuratering er allerede publisert.';
    return;
  end if;

  select count(*) into n
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id=t.objekt_id and u.tilstand='utkast'
  join public.objekttilstander p on p.objekt_id=t.objekt_id and p.tilstand='publisert' and p.revisjon=u.revisjon
  join public.objektrevisjoner r on r.objekt_id=t.objekt_id and r.revisjon=u.revisjon
  where t.tilstand='publisert' and t.infoside_id=side and t.panel='farmakodynamikk'
    and t.elementtype='mekanismekort'
    and r.kilde='Monografikuratering av kvetiapin 01.10.2026: farmakodynamikk kildebelagt og funksjon skilt fra binding';
  if n<>9 then raise exception 'Forventet 9 PD-kort fra første kuratering, fant %.',n; end if;

  select count(*) into n
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id=t.objekt_id and u.tilstand='utkast'
  join public.objektrevisjoner r on r.objekt_id=t.objekt_id and r.revisjon=u.revisjon
  where t.tilstand='publisert' and t.infoside_id=side and t.panel='dosering' and t.elementtype='riktekst'
    and r.kilde='Monografikuratering av kvetiapin 01.10.2026: dosering oppdatert fra gjeldende IR- og depotpreparatomtaler';
  if n<>1 then raise exception 'Forventet dosering fra første kuratering, fant %.',n; end if;

  select count(*) into n
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id=t.objekt_id and u.tilstand='utkast'
  join public.objektrevisjoner r on r.objekt_id=t.objekt_id and r.revisjon=u.revisjon
  where t.tilstand='publisert' and t.infoside_id=side and t.panel='farmakokinetikk'
    and t.elementtype='kinetikkort'
    and r.kilde='Monografikuratering av kvetiapin 01.10.2026: farmakokinetikk kildebelagt og presisert';
  if n<>7 then raise exception 'Forventet 7 synlige PK-kort fra første kuratering, fant %.',n; end if;

  select count(*) into n
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id=t.objekt_id and u.tilstand='utkast'
  join public.objektrevisjoner r on r.objekt_id=t.objekt_id and r.revisjon=u.revisjon
  where t.tilstand='publisert' and t.infoside_id=side and t.panel='fjernet'
    and t.elementtype='kinetikkort' and t.data->>'tittel'='Annet'
    and r.kilde='Monografikuratering av kvetiapin 01.10.2026: uspesifikt Annet-kort erstattet av kildebelagte PK-kort';
  if n<>1 then raise exception 'Forventet fjernet Annet-kort fra første kuratering, fant %.',n; end if;

  create temporary table kk(nokkel text primary key,tittel text,forfattere text,aar text,lenke text) on commit drop;
  insert into kk values
    ('ir','Quetiapine Teva – preparatomtale','Direktoratet for medisinske produkter','2024','https://produktinformasjon.legemiddelsok.no/preparatomtaler/07-5148.pdf'),
    ('xr','Seroquel Depot – preparatomtale','Direktoratet for medisinske produkter','2024','https://produktinformasjon.legemiddelsok.no/preparatomtaler/07-5214.pdf'),
    ('dailymed','Quetiapine Tablets USP – full prescribing information','DailyMed, U.S. National Library of Medicine','','https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b519b924-2348-46ac-b9a2-c9c198257ea4'),
    ('jensen','N-desalkylquetiapine, a potent norepinephrine reuptake inhibitor and partial 5-HT1A agonist, as a putative mediator of quetiapine''s antidepressant activity','Jensen NH, Rodriguiz RM, Caron MG, Wetsel WC, Rothman RB, Roth BL','2008','https://doi.org/10.1038/sj.npp.1301646'),
    ('cross','Quetiapine and its metabolite norquetiapine: translation from in vitro pharmacology to in vivo efficacy in rodent models','Cross AJ, Widzowski D, Maciag C, Zacco A, Hudzik T, Liu J, Nyberg S, Wood MW','2016','https://doi.org/10.1111/bph.13346'),
    ('sato','Histamine H1 receptor occupancy by the new-generation antipsychotics olanzapine and quetiapine: a positron emission tomography study in healthy volunteers','Sato H, Ito C, Hiraoka K, et al.','2015','https://doi.org/10.1007/s00213-015-4002-2'),
    ('gefvert','D(2) and 5HT(2A) receptor occupancy of different doses of quetiapine in schizophrenia: a PET study','Gefvert O, Lundberg T, Wieselgren IM, et al.','2001','https://doi.org/10.1016/S0924-977X(00)00133-4'),
    ('devane','Clinical pharmacokinetics of quetiapine: an atypical antipsychotic','DeVane CL, Nemeroff CB','2001','https://doi.org/10.2165/00003088-200140070-00003'),
    ('figueroa','Pharmacokinetic profiles of extended release quetiapine fumarate compared with quetiapine immediate release','Figueroa C, Brecher M, Hamer-Maansson JE, Winter H','2009','https://doi.org/10.1016/j.pnpbp.2008.09.026'),
    ('li','Multiple dose pharmacokinetics of quetiapine and some of its metabolites in Chinese suffering from schizophrenia','Li K-Y, Li X, Cheng Z-N, Peng W-X, Zhang B-K, Li H-D','2004','https://pubmed.ncbi.nlm.nih.gov/15000896/'),
    ('hasselstrom','In vitro studies on quetiapine metabolism using the substrate depletion approach with focus on drug-drug interactions','Hasselstrøm J, Linnet K','2006','https://doi.org/10.1515/DMDI.2006.21.3-4.187'),
    ('bakken','Metabolism of the active metabolite of quetiapine, N-desalkylquetiapine in vitro','Bakken GV, Molden E, Knutsen K, Lunder N, Hermann M','2012','https://doi.org/10.1124/dmd.112.045237');

  for k in select * from kk order by nokkel loop
    ref:=null;
    select objekt_id into ref from public.referanser
      where tilstand='publisert' and not arkivert and lenke=k.lenke order by objekt_id limit 1;
    if ref is null then
      perform set_config('far.revisjonskilde','Monografikuratering av kvetiapin 02.10.2026: ny kilde etter uavhengig litteratursøk',true);
      ref := (public.opprett_utkast('referanse',jsonb_build_object('tittel',k.tittel,'forfattere',k.forfattere,'aar',k.aar,'lenke',k.lenke))).id;
      perform public.publiser_utkast(ref,1);
    end if;
    kilder:=kilder||jsonb_build_object(k.nokkel,ref::text);
  end loop;

  for oppdatering in select value from jsonb_array_elements($json$
  [
    {"fra":"5-HT2A-reseptor","mekanisme_fra":"antagonisme","data":{"maal":"5-HT2A-reseptor","mekanisme":"antagonisme","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin og norkvetiapin antagoniserer 5-HT2A-reseptorer. Funksjonelle in vitro-data viser antagonistisk aktivitet, og PET hos pasienter viser høyere 5-HT2A- enn D2-okkupasjon ved kliniske doser. Dette støtter 5-HT2A-antagonisme som en sentral del av den antipsykotiske reseptorprofilen."}]}]}},"kilder":["ir","cross","gefvert"]},
    {"fra":"D2-reseptor","mekanisme_fra":"antagonisme","data":{"maal":"D2-reseptor","mekanisme":"antagonisme","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin og norkvetiapin antagoniserer D2-reseptorer, men med lavere affinitet og funksjonell potens enn ved 5-HT2A. PET-studier viser relativt lav D2-okkupasjon ved klinisk effektive doser; dette er forenlig med kvetiapins lave tendens til vedvarende D2-blokade."}]}]}},"kilder":["ir","cross","gefvert"]},
    {"fra":"H1-reseptor","mekanisme_fra":"reseptorbinding","data":{"maal":"Histamin H1-reseptor","mekanisme":"antagonisme","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin har uttalt H1-antagonisme. I en human PET-studie etter 25 mg var kortikal H1-okkupasjon omtrent 56–81 % og korrelerte med subjektiv søvnighet. H1-antagonisme er derfor en godt underbygget mekanisme for sedasjon."}]}]}},"kilder":["ir","dailymed","sato"]},
    {"fra":"α1-adrenerg reseptor","mekanisme_fra":"reseptorbinding","data":{"maal":"α1-adrenerg reseptor","mekanisme":"antagonisme","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin antagoniserer α1-adrenerge reseptorer og har høy affinitet til dette reseptorsystemet. Regulatorisk produktinformasjon knytter α1-antagonismen til ortostatisk hypotensjon."}]}]}},"kilder":["ir","dailymed"]},
    {"fra":"α2-adrenerg reseptor","mekanisme_fra":"reseptorbinding","data":{"maal":"α2-adrenerg reseptor","mekanisme":"antagonisme","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin har antagonistisk aktivitet ved α2-adrenerge reseptorer; den norske preparatomtalen beskriver moderat affinitet. Den selvstendige kliniske betydningen av denne mekanismen er mindre avklart enn for α1-antagonismen."}]}]}},"kilder":["ir","dailymed"]},
    {"fra":"M1-, M3- og M5-reseptorer (norkvetiapin)","mekanisme_fra":"antagonisme","data":{"maal":"M1-, M3- og M5-reseptorer (norkvetiapin)","mekanisme":"antagonisme","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin har lav eller ingen vesentlig muskarin affinitet, mens norkvetiapin har moderat til høy affinitet. Norkvetiapin er funksjonelt vist som antagonist ved M1-, M3- og M5-reseptorer in vitro; dette kan bidra til antikolinerge effekter."}]}]}},"kilder":["ir","jensen"]},
    {"fra":"Noradrenalintransportør / NET (norkvetiapin)","mekanisme_fra":"reopptakshemming","data":{"maal":"Noradrenalintransportør / NET (norkvetiapin)","mekanisme":"reopptakshemming","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Norkvetiapin hemmer noradrenalintransportøren (NET) og dermed noradrenalinreopptak. Funksjonelle studier viser potent hemming, mens kvetiapin selv har svært svak eller ingen målbar NET-aktivitet. Mekanismen antas å bidra til den antidepressive effekten."}]}]}},"kilder":["ir","jensen","cross"]},
    {"fra":"5-HT1A-reseptor (norkvetiapin)","mekanisme_fra":"agonisme","data":{"maal":"5-HT1A-reseptor (kvetiapin og norkvetiapin)","mekanisme":"agonisme","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"5-HT1A-agonisme er funksjonelt dokumentert, særlig for norkvetiapin. Effikasigraden er assayavhengig: Jensen et al. beskrev norkvetiapin som partiell agonist, mens Cross et al. målte nær full agonistrespons for både kvetiapin og norkvetiapin. Kortet angir derfor agonisme uten å låse graden av intrinsisk aktivitet."}]}]}},"kilder":["ir","jensen","cross"]}
  ]$json$::jsonb) loop
    select t.objekt_id,u.revisjon,r.innhold into e
    from public.innholdselementer t
    join public.objekttilstander u on u.objekt_id=t.objekt_id and u.tilstand='utkast'
    join public.objekttilstander p on p.objekt_id=t.objekt_id and p.tilstand='publisert' and p.revisjon=u.revisjon
    join public.objektrevisjoner r on r.objekt_id=t.objekt_id and r.revisjon=u.revisjon
    where t.tilstand='publisert' and t.infoside_id=side and t.panel='farmakodynamikk'
      and t.elementtype='mekanismekort' and t.data->>'maal'=oppdatering->>'fra'
      and t.data->>'mekanisme'=oppdatering->>'mekanisme_fra'
    order by t.objekt_id limit 1;
    if not found then raise exception 'PD-kort % samsvarer ikke med første kuratering.',oppdatering->>'fra'; end if;
    select coalesce(jsonb_agg(to_jsonb(kilder->>x.nokkel) order by x.i),'[]'::jsonb) into referanser
      from jsonb_array_elements_text(oppdatering->'kilder') with ordinality x(nokkel,i);
    perform set_config('far.revisjonskilde','Monografikuratering av kvetiapin 02.10.2026: farmakodynamikk',true);
    perform public.lagre_utkast(e.objekt_id,e.revisjon,e.innhold||jsonb_build_object('data',oppdatering->'data','referanser',referanser));
    perform public.publiser_utkast(e.objekt_id,e.revisjon+1);
  end loop;

  select t.objekt_id,u.revisjon,r.innhold into e
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id=t.objekt_id and u.tilstand='utkast'
  join public.objekttilstander p on p.objekt_id=t.objekt_id and p.tilstand='publisert' and p.revisjon=u.revisjon
  join public.objektrevisjoner r on r.objekt_id=t.objekt_id and r.revisjon=u.revisjon
  where t.tilstand='publisert' and t.infoside_id=side and t.panel='farmakodynamikk'
    and t.elementtype='mekanismekort' and t.data->>'maal'='D1-reseptor' and t.data->>'mekanisme'='reseptorbinding'
  order by t.objekt_id limit 1;
  if not found then raise exception 'Fant ikke forventet D1-kort.'; end if;
  perform set_config('far.revisjonskilde','Monografikuratering av kvetiapin 02.10.2026: D1-kort utelatt etter ny evidensvurdering',true);
  perform public.lagre_utkast(e.objekt_id,e.revisjon,e.innhold||jsonb_build_object('panel','fjernet'));
  perform public.publiser_utkast(e.objekt_id,e.revisjon+1);

  perform set_config('far.revisjonskilde','Monografikuratering av kvetiapin 02.10.2026: 5-HT2C-antagonisme lagt til etter funksjonelle data',true);
  objekt := (public.opprett_utkast('innholdselement',jsonb_build_object(
    'infoside',side,'panel','farmakodynamikk','posisjon',1,'elementtype','mekanismekort',
    'data',$json$ {"maal":"5-HT2C-reseptor","mekanisme":"antagonisme","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin og norkvetiapin er 5-HT2C-antagonister in vitro. Kvetiapin har lav affinitet og lav funksjonell potens, mens norkvetiapin er tydelig mer potent. En rolle i antidepressiv effekt er foreslått fra prekliniske data, men den kliniske betydningen er ikke fastslått."}]}]}} $json$::jsonb,
    'referanser',jsonb_build_array(kilder->>'cross')))).id;
  perform public.publiser_utkast(objekt,1);

  select t.objekt_id,u.revisjon,r.innhold into e
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id=t.objekt_id and u.tilstand='utkast'
  join public.objekttilstander p on p.objekt_id=t.objekt_id and p.tilstand='publisert' and p.revisjon=u.revisjon
  join public.objektrevisjoner r on r.objekt_id=t.objekt_id and r.revisjon=u.revisjon
  where t.tilstand='publisert' and t.infoside_id=side and t.panel='dosering' and t.elementtype='riktekst'
  order by t.objekt_id limit 1;

  data := replace(replace($json$
  {"dokument":{"type":"doc","content":[
    {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Umiddelbar frisetting (IR)"}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Schizofreni"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Tas 2 ganger daglig. Total døgndose dag 1–4: 50, 100, 200 og 300 mg. Fra dag 4 titreres vanligvis til 300–450 mg/døgn; individuelt doseområde 150–750 mg/døgn."},{"type":"sitering","attrs":{"referanser":["__IR__"]}}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Moderat til alvorlig mani ved bipolar lidelse"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Tas 2 ganger daglig. Total døgndose dag 1–4: 100, 200, 300 og 400 mg. Videre økning til 800 mg/døgn innen dag 6 bør ikke overstige 200 mg/døgn. Effektivt doseområde 200–800 mg/døgn; vanlig effektiv dose 400–800 mg/døgn."},{"type":"sitering","attrs":{"referanser":["__IR__"]}}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Bipolar depresjon"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Tas 1 gang daglig ved sengetid. Døgndose dag 1–4: 50, 100, 200 og 300 mg. Anbefalt dose er 300 mg/døgn. Gruppenivådata viser ikke ytterligere fordel av 600 mg versus 300 mg, men enkelte kan ha nytte av 600 mg; doser over 300 mg skal initieres av lege med erfaring i behandling av bipolar lidelse. Ved toleranseproblemer kan reduksjon til 200 mg vurderes."},{"type":"sitering","attrs":{"referanser":["__IR__"]}}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Forebygging av tilbakefall ved bipolar lidelse"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Fortsett dosen som ga respons ved akuttbehandling, administrert 2 ganger daglig. Doseområdet er 300–800 mg/døgn; bruk laveste effektive vedlikeholdsdose."},{"type":"sitering","attrs":{"referanser":["__IR__"]}}]},
    {"type":"horizontalRule"},
    {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Depot (XR)"}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Schizofreni og moderat til alvorlig mani ved bipolar lidelse"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Tas 1 gang daglig utenom måltid, minst 1 time før mat. Start med 300 mg dag 1 og 600 mg dag 2. Anbefalt døgndose er 600 mg; ved klinisk behov kan dosen økes til 800 mg. Effektivt doseområde er 400–800 mg/døgn."},{"type":"sitering","attrs":{"referanser":["__XR__"]}}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Bipolar depresjon"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Tas ved sengetid. Døgndose dag 1–4: 50, 100, 200 og 300 mg. Anbefalt dose er 300 mg/døgn. Som for IR er det ikke vist ytterligere gruppenytte av 600 mg versus 300 mg, men enkelte kan ha nytte av 600 mg; reduksjon til 200 mg kan vurderes ved toleranseproblemer."},{"type":"sitering","attrs":{"referanser":["__XR__"]}}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Forebygging av tilbakefall ved bipolar lidelse"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Fortsett samme effektive dose 1 gang daglig ved sengetid. Doseområdet er 300–800 mg/døgn; bruk laveste effektive vedlikeholdsdose."},{"type":"sitering","attrs":{"referanser":["__XR__"]}}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Tilleggsbehandling ved unipolar depresjon"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Ved suboptimal respons på antidepressiv monoterapi: 50 mg/døgn dag 1–2 og 150 mg/døgn dag 3–4, ved sengetid. Bruk laveste effektive dose. Eventuell økning fra 150 til 300 mg/døgn skal bygge på individuell nytte–risiko-vurdering."},{"type":"sitering","attrs":{"referanser":["__XR__"]}}]},
    {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Bytte fra IR"}]},
    {"type":"paragraph","content":[{"type":"text","text":"Ved overgang fra IR 2 ganger daglig kan samme totale døgndose gis som depot 1 gang daglig; individuell dosejustering kan være nødvendig."},{"type":"sitering","attrs":{"referanser":["__XR__"]}}]},
    {"type":"horizontalRule"},
    {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Spesielle grupper og seponering"}]},
    {"type":"bulletList","content":[
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Eldre: langsommere titrering og lavere vedlikeholdsdose kan være nødvendig. Plasmaclearance er i gjennomsnitt 30–50 % lavere enn hos yngre. For depot er startdose 50 mg/døgn med økning i trinn på 50 mg. Ved unipolar depresjon hos eldre: 50 mg/døgn dag 1–3, 100 mg dag 4 og 150 mg dag 8; eventuell økning til 300 mg tidligst dag 22."},{"type":"sitering","attrs":{"referanser":["__IR__","__XR__"]}}]}]},
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Nedsatt leverfunksjon: start IR med 25 mg/døgn og øk med 25–50 mg/døgn; start depot med 50 mg/døgn og øk i trinn på 50 mg til effektiv dose."},{"type":"sitering","attrs":{"referanser":["__IR__","__XR__"]}}]}]},
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Nedsatt nyrefunksjon: dosejustering er ikke nødvendig."},{"type":"sitering","attrs":{"referanser":["__IR__","__XR__"]}}]}]},
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Barn og ungdom under 18 år: anbefales ikke brukt fordi dokumentasjonen ikke støtter rutinemessig bruk."},{"type":"sitering","attrs":{"referanser":["__IR__","__XR__"]}}]}]},
      {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Seponering: gradvis seponering over minst 1–2 uker anbefales; akutte seponeringssymptomer er beskrevet ved brå avslutning."},{"type":"sitering","attrs":{"referanser":["__IR__","__XR__"]}}]}]}
    ]}
  ]}}$json$,'__IR__',kilder->>'ir'),'__XR__',kilder->>'xr')::jsonb;
  perform set_config('far.revisjonskilde','Monografikuratering av kvetiapin 02.10.2026: dosering fra gjeldende norske preparatomtaler',true);
  perform public.lagre_utkast(e.objekt_id,e.revisjon,(e.innhold-'referanser')||jsonb_build_object('data',data));
  perform public.publiser_utkast(e.objekt_id,e.revisjon+1);

  for oppdatering in select value from jsonb_array_elements($json$
  [
    {"fra":"Absorpsjon og formulering","data":{"tittel":"Absorpsjon og formulering","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"IR absorberes raskt, og matinntak påvirker eksponeringen lite. Depot gir omtrent samme AUC som samme totale døgndose IR, men rundt 13 % lavere Cmax ved steady state. Et fettrikt måltid øker depot-Cmax omtrent 50 % og AUC omtrent 20 %, mens et lett måltid ikke har vesentlig effekt; depot skal derfor tas utenom måltid."}]}]}},"kilder":["ir","xr","devane","figueroa"]},
    {"fra":"tₘₐₓ","data":{"tittel":"tₘₐₓ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"IR: vanligvis 1–2 timer. Depot: omtrent 5–6 timer."}]}]}},"kilder":["devane","figueroa","xr"]},
    {"fra":"t½","data":{"tittel":"t½","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin: ca. 7 timer. Norkvetiapin: ca. 12 timer."}]}]}},"kilder":["ir","xr","devane"]},
    {"fra":"tₛₛ","data":{"tittel":"tₛₛ","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Steady state nås raskt. I en human flerdosestudie var steady state oppnådd innen omtrent 48 timer etter oppstart av 200 mg 2 ganger daglig."}]}]}},"kilder":["li"]},
    {"fra":"Proteinbinding","data":{"tittel":"Proteinbinding","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Omtrent 83 % av kvetiapin er bundet til plasmaproteiner."}]}]}},"kilder":["ir","devane"]},
    {"fra":"Vd","data":{"tittel":"Distribusjonsvolum","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin har stort tilsynelatende distribusjonsvolum. I en human flerdosestudie ved 200 mg 2 ganger daglig var V/F 672 ± 394 L, med betydelig interindividuell variasjon."}]}]}},"kilder":["li"]},
    {"fra":"Metabolisme og utskillelse","data":{"tittel":"Metabolisme og utskillelse","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin metaboliseres i stor grad i leveren. CYP3A4 står for hoveddelen av moderstoffets metabolisme og er hovedveien for dannelse av den aktive metabolitten norkvetiapin; CYP2D6 bidrar i mindre grad til moderstoffets totale metabolisme."}]},{"type":"paragraph","content":[{"type":"text","text":"Videre metabolisme av norkvetiapin er veiavhengig. Preparatomtalen beskriver CYP3A4 som en hovedvei, mens humane levermikrosom- og rekombinante enzymdata viser at CYP2D6 er sentral for 7-hydroksylering og kan bidra betydelig til videre clearance; CYP3A4 bidrar blant annet til sulfoxidering og andre metabolittveier."}]},{"type":"paragraph","content":[{"type":"text","text":"Mindre enn 5 % gjenfinnes som umetabolisert legemiddelrelatert materiale. Etter radiomerket dose utskilles omtrent 73 % i urin og 21 % i feces, hovedsakelig som metabolitter."}]}]}},"kilder":["ir","xr","hasselstrom","bakken"]}
  ]$json$::jsonb) loop
    select t.objekt_id,u.revisjon,r.innhold into e
    from public.innholdselementer t
    join public.objekttilstander u on u.objekt_id=t.objekt_id and u.tilstand='utkast'
    join public.objekttilstander p on p.objekt_id=t.objekt_id and p.tilstand='publisert' and p.revisjon=u.revisjon
    join public.objektrevisjoner r on r.objekt_id=t.objekt_id and r.revisjon=u.revisjon
    where t.tilstand='publisert' and t.infoside_id=side and t.panel='farmakokinetikk'
      and t.elementtype='kinetikkort' and t.data->>'tittel'=oppdatering->>'fra'
    order by t.objekt_id limit 1;
    if not found then raise exception 'PK-kort % samsvarer ikke med første kuratering.',oppdatering->>'fra'; end if;
    select coalesce(jsonb_agg(to_jsonb(kilder->>x.nokkel) order by x.i),'[]'::jsonb) into referanser
      from jsonb_array_elements_text(oppdatering->'kilder') with ordinality x(nokkel,i);
    perform set_config('far.revisjonskilde','Monografikuratering av kvetiapin 02.10.2026: farmakokinetikk',true);
    perform public.lagre_utkast(e.objekt_id,e.revisjon,e.innhold||jsonb_build_object('data',oppdatering->'data','referanser',referanser));
    perform public.publiser_utkast(e.objekt_id,e.revisjon+1);
  end loop;

  select t.objekt_id,u.revisjon,r.innhold into e
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id=t.objekt_id and u.tilstand='utkast'
  join public.objekttilstander p on p.objekt_id=t.objekt_id and p.tilstand='publisert' and p.revisjon=u.revisjon
  join public.objektrevisjoner r on r.objekt_id=t.objekt_id and r.revisjon=u.revisjon
  where t.tilstand='publisert' and t.infoside_id=side and t.panel='fjernet'
    and t.elementtype='kinetikkort' and t.data->>'tittel'='Annet'
  order by t.objekt_id limit 1;
  if not found then raise exception 'Fant ikke fjernet Annet-kort.'; end if;
  data := $json$ {"tittel":"Særpopulasjoner","dokument":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"Eldre har i gjennomsnitt 30–50 % lavere clearance enn voksne 18–65 år."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Ved alvorlig nedsatt nyrefunksjon er gjennomsnittlig plasmaclearance omtrent 25 % lavere, men individuelle verdier ligger innenfor normalområdet; preparatomtalen krever ikke dosejustering."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Ved stabil alkoholisk cirrhose er gjennomsnittlig plasmaclearance omtrent 25 % lavere. Høyere eksponering kan derfor forventes ved nedsatt leverfunksjon, og langsommere titrering/lavere startdose brukes."}]}
  ]}} $json$::jsonb;
  perform set_config('far.revisjonskilde','Monografikuratering av kvetiapin 02.10.2026: farmakokinetikk',true);
  perform public.lagre_utkast(e.objekt_id,e.revisjon,e.innhold||jsonb_build_object(
    'panel','farmakokinetikk','posisjon',7,'data',data,'referanser',jsonb_build_array(kilder->>'ir',kilder->>'xr')));
  perform public.publiser_utkast(e.objekt_id,e.revisjon+1);

  select t.objekt_id,u.revisjon,r.innhold into e
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id=t.objekt_id and u.tilstand='utkast'
  join public.objekttilstander p on p.objekt_id=t.objekt_id and p.tilstand='publisert' and p.revisjon=u.revisjon
  join public.objektrevisjoner r on r.objekt_id=t.objekt_id and r.revisjon=u.revisjon
  where t.tilstand='publisert' and t.infoside_id=side and t.panel='farmakogenetikk'
    and t.elementtype='kinetikkort' and t.data->>'tittel'='CYP3A4 og CYP2D6'
    and r.kilde='Monografikuratering av kvetiapin 02.10.2026: CYP3A4/CYP2D6 presisert etter ClinPGx og Bakken et al. 2012'
  order by t.objekt_id limit 1;
  if not found then raise exception 'Farmakogenetikk samsvarer ikke med første kuratering.'; end if;
  select innhold into forrige from public.objektrevisjoner where objekt_id=e.objekt_id and revisjon=e.revisjon-1;
  if forrige is null then raise exception 'Fant ikke forrige farmakogenetikk-revisjon.'; end if;
  perform set_config('far.revisjonskilde','Korrigering etter fersk monografikuratering: farmakogenetikk tilbakeført til tilstanden før kvetiapinkurateringen',true);
  perform public.lagre_utkast(e.objekt_id,e.revisjon,forrige);
  perform public.publiser_utkast(e.objekt_id,e.revisjon+1);

  select t.objekt_id,u.revisjon,r.innhold into e
  from public.innholdselementer t
  join public.objekttilstander u on u.objekt_id=t.objekt_id and u.tilstand='utkast'
  join public.objekttilstander p on p.objekt_id=t.objekt_id and p.tilstand='publisert' and p.revisjon=u.revisjon
  join public.objektrevisjoner r on r.objekt_id=t.objekt_id and r.revisjon=u.revisjon
  where t.tilstand='publisert' and t.infoside_id=side and t.panel='interaksjoner'
    and t.elementtype='riktekst'
    and r.kilde='Monografikuratering av kvetiapin 02.10.2026: CYP3A4-interaksjoner kildebelagt i Interaksjoner-panelet'
  order by t.objekt_id limit 1;
  if not found then raise exception 'Interaksjoner samsvarer ikke med første kuratering.'; end if;
  select innhold into forrige from public.objektrevisjoner where objekt_id=e.objekt_id and revisjon=e.revisjon-1;
  if forrige is null then raise exception 'Fant ikke forrige interaksjonsrevisjon.'; end if;
  perform set_config('far.revisjonskilde','Korrigering etter fersk monografikuratering: interaksjoner tilbakeført til tilstanden før kvetiapinkurateringen',true);
  perform public.lagre_utkast(e.objekt_id,e.revisjon,forrige);
  perform public.publiser_utkast(e.objekt_id,e.revisjon+1);
end
$k$;
