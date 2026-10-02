-- Kvetiapin: farmakogenetisk fritekst og korrekt senket reseptorsubtype i farmakodynamisk brødtekst.
-- Tillegg etter monografikurateringen 02.10.2026; tidligere kjørte migrasjoner endres ikke.
do $kvetiapin_farmakogenetikk$
declare
  administrator uuid;
  side uuid;
  e record;
  oppdatering jsonb;
  ref_dpwg uuid;
  ref_cyp3a4_22 uuid;
  ref_solhaug uuid;
  objekt uuid;
begin
  select p.id into administrator
  from public.profiles p
  where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise exception 'Fant ingen administrator med brukernavnet peohol.';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);

  select s.objekt_id into side
  from public.infosider s
  where s.tilstand = 'publisert' and s.slug = 'kvetiapin';
  if side is null then
    raise exception 'Fant ikke publisert stoffside med slug kvetiapin.';
  end if;

  if exists (
    select 1
    from public.innholdselementer t
    join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
    join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
    where t.tilstand = 'publisert'
      and t.infoside_id = side
      and t.panel = 'farmakogenetikk'
      and t.elementtype = 'riktekst'
      and r.kilde = 'Monografikuratering av kvetiapin 02.10.2026: farmakogenetisk fritekst'
  ) then
    raise notice 'Kvetiapins farmakogenetiske fritekst og typografi er allerede oppdatert.';
    return;
  end if;

  for oppdatering in select value from jsonb_array_elements('[{"maal":"5-HT2A-reseptor","kilde":"Monografikuratering av kvetiapin 02.10.2026: farmakodynamikk","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin og norkvetiapin antagoniserer 5-HT"},{"type":"text","text":"2A","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer. Funksjonelle in vitro-data viser antagonistisk aktivitet, og PET hos pasienter viser høyere 5-HT"},{"type":"text","text":"2A","marks":[{"type":"subscript"}]},{"type":"text","text":"- enn D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-okkupasjon ved kliniske doser. Dette støtter 5-HT"},{"type":"text","text":"2A","marks":[{"type":"subscript"}]},{"type":"text","text":"-antagonisme som en sentral del av den antipsykotiske reseptorprofilen."}]}]}},{"maal":"5-HT2C-reseptor","kilde":"Monografikuratering av kvetiapin 02.10.2026: 5-HT2C-antagonisme lagt til etter funksjonelle data","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin og norkvetiapin er 5-HT"},{"type":"text","text":"2C","marks":[{"type":"subscript"}]},{"type":"text","text":"-antagonister in vitro. Kvetiapin har lav affinitet og lav funksjonell potens, mens norkvetiapin er tydelig mer potent. En rolle i antidepressiv effekt er foreslått fra prekliniske data, men den kliniske betydningen er ikke fastslått."}]}]}},{"maal":"D2-reseptor","kilde":"Monografikuratering av kvetiapin 02.10.2026: farmakodynamikk","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin og norkvetiapin antagoniserer D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer, men med lavere affinitet og funksjonell potens enn ved 5-HT"},{"type":"text","text":"2A","marks":[{"type":"subscript"}]},{"type":"text","text":". PET-studier viser relativt lav D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-okkupasjon ved klinisk effektive doser; dette er forenlig med kvetiapins lave tendens til vedvarende D"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-blokade."}]}]}},{"maal":"Histamin H1-reseptor","kilde":"Monografikuratering av kvetiapin 02.10.2026: farmakodynamikk","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin har uttalt H"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-antagonisme. I en human PET-studie etter 25 mg var kortikal H"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-okkupasjon omtrent 56–81 % og korrelerte med subjektiv søvnighet. H"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-antagonisme er derfor en godt underbygget mekanisme for sedasjon."}]}]}},{"maal":"α1-adrenerg reseptor","kilde":"Monografikuratering av kvetiapin 02.10.2026: farmakodynamikk","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin antagoniserer α"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-adrenerge reseptorer og har høy affinitet til dette reseptorsystemet. Regulatorisk produktinformasjon knytter α"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-antagonismen til ortostatisk hypotensjon."}]}]}},{"maal":"α2-adrenerg reseptor","kilde":"Monografikuratering av kvetiapin 02.10.2026: farmakodynamikk","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin har antagonistisk aktivitet ved α"},{"type":"text","text":"2","marks":[{"type":"subscript"}]},{"type":"text","text":"-adrenerge reseptorer; den norske preparatomtalen beskriver moderat affinitet. Den selvstendige kliniske betydningen av denne mekanismen er mindre avklart enn for α"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-antagonismen."}]}]}},{"maal":"M1-, M3- og M5-reseptorer (norkvetiapin)","kilde":"Monografikuratering av kvetiapin 02.10.2026: farmakodynamikk","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Kvetiapin har lav eller ingen vesentlig muskarin affinitet, mens norkvetiapin har moderat til høy affinitet. Norkvetiapin er funksjonelt vist som antagonist ved M"},{"type":"text","text":"1","marks":[{"type":"subscript"}]},{"type":"text","text":"-, M"},{"type":"text","text":"3","marks":[{"type":"subscript"}]},{"type":"text","text":"- og M"},{"type":"text","text":"5","marks":[{"type":"subscript"}]},{"type":"text","text":"-reseptorer in vitro; dette kan bidra til antikolinerge effekter."}]}]}},{"maal":"5-HT1A-reseptor (kvetiapin og norkvetiapin)","kilde":"Monografikuratering av kvetiapin 02.10.2026: farmakodynamikk","dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"5-HT"},{"type":"text","text":"1A","marks":[{"type":"subscript"}]},{"type":"text","text":"-agonisme er funksjonelt dokumentert, særlig for norkvetiapin. Effikasigraden er assayavhengig: Jensen et al. beskrev norkvetiapin som partiell agonist, mens Cross et al. målte nær full agonistrespons for både kvetiapin og norkvetiapin. Kortet angir derfor agonisme uten å låse graden av intrinsisk aktivitet."}]}]}}]'::jsonb) loop
    select t.objekt_id, u.revisjon, r.innhold into e
    from public.innholdselementer t
    join public.objekttilstander u on u.objekt_id = t.objekt_id and u.tilstand = 'utkast'
    join public.objekttilstander p on p.objekt_id = t.objekt_id and p.tilstand = 'publisert' and p.revisjon = u.revisjon
    join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = u.revisjon
    where t.tilstand = 'publisert'
      and t.infoside_id = side
      and t.panel = 'farmakodynamikk'
      and t.elementtype = 'mekanismekort'
      and t.data->>'maal' = oppdatering->>'maal'
      and r.kilde = oppdatering->>'kilde'
    order by t.objekt_id
    limit 1;

    if not found then
      raise exception 'Kvetiapin: mekanismekortet % er endret siden siste kuratering.', oppdatering->>'maal';
    end if;

    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: reseptorsubtyper formatert med senket tekst', true);
    perform public.lagre_utkast(
      e.objekt_id,
      e.revisjon,
      e.innhold || jsonb_build_object(
        'data', (e.innhold->'data') || jsonb_build_object('dokument', oppdatering->'dokument')
      )
    );
    perform public.publiser_utkast(e.objekt_id, e.revisjon + 1);
  end loop;

  select r.objekt_id into ref_dpwg
  from public.referanser r
  where r.tilstand = 'publisert' and not r.arkivert
    and r.lenke = 'https://doi.org/10.1038/s41431-023-01347-3'
  order by r.objekt_id limit 1;
  if ref_dpwg is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: DPWG farmakogenetikk', true);
    ref_dpwg := (public.opprett_utkast('referanse', jsonb_build_object(
      'tittel', 'Dutch Pharmacogenetics Working Group (DPWG) guideline for the gene-drug interaction between CYP2D6, CYP3A4 and CYP1A2 and antipsychotics',
      'forfattere', 'Beunk L, Nijenhuis M, Soree B, et al.',
      'aar', '2024',
      'lenke', 'https://doi.org/10.1038/s41431-023-01347-3'
    ))).id;
    perform public.publiser_utkast(ref_dpwg, 1);
  end if;

  select r.objekt_id into ref_cyp3a4_22
  from public.referanser r
  where r.tilstand = 'publisert' and not r.arkivert
    and r.lenke = 'https://doi.org/10.1097/JCP.0000000000000070'
  order by r.objekt_id limit 1;
  if ref_cyp3a4_22 is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: CYP3A4*22 og kvetiapin', true);
    ref_cyp3a4_22 := (public.opprett_utkast('referanse', jsonb_build_object(
      'tittel', 'The influence of the CYP3A4*22 polymorphism on serum concentration of quetiapine in psychiatric patients',
      'forfattere', 'van der Weide K, van der Weide J',
      'aar', '2014',
      'lenke', 'https://doi.org/10.1097/JCP.0000000000000070'
    ))).id;
    perform public.publiser_utkast(ref_cyp3a4_22, 1);
  end if;

  select r.objekt_id into ref_solhaug
  from public.referanser r
  where r.tilstand = 'publisert' and not r.arkivert
    and r.lenke = 'https://doi.org/10.1111/bcp.15849'
  order by r.objekt_id limit 1;
  if ref_solhaug is null then
    perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: farmakogenetikk og TDM', true);
    ref_solhaug := (public.opprett_utkast('referanse', jsonb_build_object(
      'tittel', 'Impact of age, sex and cytochrome P450 genotype on quetiapine and N-desalkylquetiapine serum concentrations: A study based on real-world data from 8118 patients',
      'forfattere', 'Solhaug V, Tveito M, Waade RB, Høiseth G, Molden E, Smith RL',
      'aar', '2023',
      'lenke', 'https://doi.org/10.1111/bcp.15849'
    ))).id;
    perform public.publiser_utkast(ref_solhaug, 1);
  end if;

  if exists (
    select 1 from public.innholdselementer t
    where t.tilstand = 'publisert' and t.infoside_id = side
      and t.panel = 'farmakogenetikk' and t.elementtype = 'riktekst'
  ) then
    raise exception 'Kvetiapin: farmakogenetikk har allerede en redaksjonell fritekst som ikke skal overskrives blindt.';
  end if;

  perform set_config('far.revisjonskilde', 'Monografikuratering av kvetiapin 02.10.2026: farmakogenetisk fritekst', true);
  objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
    'infoside', side,
    'panel', 'farmakogenetikk',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', jsonb_build_object('dokument', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Farmakogenetisk analyse er ikke rutinemessig anbefalt før behandling med kvetiapin. DPWG vurderer CYP3A4-genotyping som potensielt nyttig på individuelt grunnlag. Ved genotype klassifisert som manglende CYP3A4-enzymaktivitet anbefales et alternativt legemiddel ved depresjon og omtrent 30 % av normal dose ved andre indikasjoner."}]},{"type":"paragraph","content":[{"type":"text","text":"Evidensen er begrenset og delvis motstridende. En mindre studie fant økt kvetiapineksponering hos bærere av CYP3A4*22, mens en senere TDM-studie med 8118 pasienter ikke fant effekt av CYP3A4*22. Den store studien fant derimot 7 % og 17 % høyere norkvetiapineksponering ved henholdsvis redusert og manglende CYP2D6-enzymaktivitet; DPWG anbefaler likevel ingen dosejustering basert på CYP2D6 for kvetiapin."}]},{"type":"paragraph","content":[{"type":"text","text":"Testing er derfor mest relevant selektivt, for eksempel ved uventet høy eksponering, uttalte doseavhengige bivirkninger eller markert avvik mellom dose og TDM-resultat etter at etterlevelse, prøvetakingstidspunkt, interaksjoner, alder og leverfunksjon er vurdert. Resultatet bør tolkes sammen med TDM og øvrig klinisk kontekst."}]}]}'::jsonb),
    'referanser', jsonb_build_array(ref_dpwg, ref_cyp3a4_22, ref_solhaug)
  ))).id;
  perform public.publiser_utkast(objekt, 1);
end
$kvetiapin_farmakogenetikk$;
