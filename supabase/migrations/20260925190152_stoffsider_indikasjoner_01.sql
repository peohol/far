-- Referansene (1 av 2)
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;

begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- fk-atomoxetine-medical-valley
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Atomoxetine Medical Valley «Medical Valley»' and r.lenke = 'https://www.felleskatalogen.no/medisin/atomoxetine-medical-valley-medical-valley-663279'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Atomoxetine Medical Valley «Medical Valley»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/atomoxetine-medical-valley-medical-valley-663279"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-fenemal
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fenemal «Orifarm Healthcare»' and r.lenke = 'https://www.felleskatalogen.no/medisin/fenemal-orifarm-healthcare-559027'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Fenemal «Orifarm Healthcare»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/fenemal-orifarm-healthcare-559027"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-pro-epanutin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Pro-Epanutin «Pfizer»' and r.lenke = 'https://www.felleskatalogen.no/medisin/pro-epanutin-pfizer-562994'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Pro-Epanutin «Pfizer»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/pro-epanutin-pfizer-562994"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-neurontin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Neurontin «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/neurontin-viatris-561923'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Neurontin «Viatris»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/neurontin-viatris-561923"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-neurisol
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Neurisol «Oresund Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/neurisol-oresund-pharma-773963'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Neurisol «Oresund Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/neurisol-oresund-pharma-773963"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-shaktatin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Shaktatin «2care4 Generics»' and r.lenke = 'https://www.felleskatalogen.no/medisin/shaktatin-2care4-generics-776078'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Shaktatin «2care4 Generics»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/shaktatin-2care4-generics-776078"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-tegretol
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Tegretol, Tegretol Retard «Novartis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/tegretol-tegretol-retard-novartis-564471'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Tegretol, Tegretol Retard «Novartis»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/tegretol-tegretol-retard-novartis-564471"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-trimonil-retard
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Trimonil Retard «Desitin»' and r.lenke = 'https://www.felleskatalogen.no/medisin/trimonil-retard-desitin-564842'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Trimonil Retard «Desitin»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/trimonil-retard-desitin-564842"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-carbamazepine-essential-pharma
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Carbamazepine Essential Pharma «Essential Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/carbamazepine-essential-pharma-essential-pharma-640712'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Carbamazepine Essential Pharma «Essential Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/carbamazepine-essential-pharma-essential-pharma-640712"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-keppra
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Keppra «UCB»' and r.lenke = 'https://www.felleskatalogen.no/medisin/keppra-ucb-560503'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Keppra «UCB»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/keppra-ucb-560503"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-lithionit
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Lithionit «Karo Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/lithionit-karo-pharma-561032'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Lithionit «Karo Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/lithionit-karo-pharma-561032"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-carblit
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Carblit «XGX Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/carblit-xgx-pharma-763921'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Carblit «XGX Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/carblit-xgx-pharma-763921"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-concerta
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Concerta «Janssen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/concerta-janssen-547617'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Concerta «Janssen»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/concerta-janssen-547617"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-delmosart
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Delmosart «Teva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/delmosart-teva-637791'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Delmosart «Teva»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/delmosart-teva-637791"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-equasym-depot
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Equasym Depot «Takeda»' and r.lenke = 'https://www.felleskatalogen.no/medisin/equasym-depot-takeda-558749'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Equasym Depot «Takeda»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/equasym-depot-takeda-558749"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-medikinet
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Medikinet «Medice»' and r.lenke = 'https://www.felleskatalogen.no/medisin/medikinet-medice-561284'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Medikinet «Medice»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/medikinet-medice-561284"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-methylphenidate-consilient
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Methylphenidate Consilient Health «Consilient Health»' and r.lenke = 'https://www.felleskatalogen.no/medisin/methylphenidate-consilient-health-consilient-health-771087'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Methylphenidate Consilient Health «Consilient Health»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/methylphenidate-consilient-health-consilient-health-771087"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-methylphenidate-sandoz
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Methylphenidate Sandoz «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/methylphenidate-sandoz-sandoz-576552'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Methylphenidate Sandoz «Sandoz»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/methylphenidate-sandoz-sandoz-576552"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-methylphenidate-teva
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Methylphenidate Teva «Teva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/methylphenidate-teva-teva-664113'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Methylphenidate Teva «Teva»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/methylphenidate-teva-teva-664113"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-metylfenidat-medical-valley
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Metylfenidat Medical Valley «Medical Valley»' and r.lenke = 'https://www.felleskatalogen.no/medisin/metylfenidat-medical-valley-medical-valley-730020'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Metylfenidat Medical Valley «Medical Valley»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/metylfenidat-medical-valley-medical-valley-730020"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-ritalin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Ritalin «Infectopharm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/ritalin-infectopharm-563557'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Ritalin «Infectopharm»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/ritalin-infectopharm-563557"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-tuzulby
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Tuzulby «Neuraxpharm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/tuzulby-neuraxpharm-772111'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Tuzulby «Neuraxpharm»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/tuzulby-neuraxpharm-772111"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-trileptal
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Trileptal «Novartis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/trileptal-novartis-564828'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Trileptal «Novartis»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/trileptal-novartis-564828"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-petidin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Petidin «Evolan Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/petidin-evolan-pharma-562766'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Petidin «Evolan Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/petidin-evolan-pharma-562766"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-serdolect
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Serdolect «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/serdolect-lundbeck-563829'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Serdolect «Lundbeck»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/serdolect-lundbeck-563829"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Referansene (2 av 2)
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;

begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- fk-topimax
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Topimax «Janssen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/topimax-janssen-564720'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Topimax «Janssen»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/topimax-janssen-564720"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-qsiva
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Qsiva «VIVUS»' and r.lenke = 'https://www.felleskatalogen.no/medisin/qsiva-vivus-731581'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Qsiva «VIVUS»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/qsiva-vivus-731581"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-orfiril
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Orfiril, Orfiril long, Orfiril Retard «Desitin»' and r.lenke = 'https://www.felleskatalogen.no/medisin/orfiril-orfiril-retard-orfiril-long-desitin-562472'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Orfiril, Orfiril long, Orfiril Retard «Desitin»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/orfiril-orfiril-retard-orfiril-long-desitin-562472"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Atomoksetin
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden stoffet har fra før, eller en ny.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Atomoksetin');

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Atomoxetine Medical Valley «Medical Valley»' and r.lenke = 'https://www.felleskatalogen.no/medisin/atomoxetine-medical-valley-medical-valley-663279'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-atomoxetine-medical-valley';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Atomoksetin');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Atomoksetin"}'::jsonb)).id;
      nye := nye || side_0;
    end if;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'indikasjon'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Barn ≥6 år, ungdom og voksne: ADHD, som del av et omfattende behandlingsprogram. Behandlingen skal startes av lege med relevant kompetanse og erfaring i behandling av ADHD."}]},{"type":"paragraph","content":[{"type":"text","text":"Hos voksne skal det bekreftes at symptomene på ADHD var til stede i barndommen'
    '. Pasienten skal minst ha ADHD av moderat alvorlighetsgrad, med minst moderat nedsatt funksjon i to eller flere situasjoner."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Fenobarbital
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden stoffet har fra før, eller en ny.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Fenobarbital');

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fenemal «Orifarm Healthcare»' and r.lenke = 'https://www.felleskatalogen.no/medisin/fenemal-orifarm-healthcare-559027'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-fenemal';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Fenobarbital');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Fenobarbital"}'::jsonb)).id;
      nye := nye || side_0;
    end if;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'indikasjon'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Epilepsi, ved grand mal, særlig oppvåknings- og innsovningsanfall, fokalmotoriske og fokalsensoriske anfall."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Fenytoin
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden stoffet har fra før, eller en ny.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Fenytoin');

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Pro-Epanutin «Pfizer»' and r.lenke = 'https://www.felleskatalogen.no/medisin/pro-epanutin-pfizer-562994'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-pro-epanutin';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Fenytoin');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Fenytoin"}'::jsonb)).id;
      nye := nye || side_0;
    end if;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'indikasjon'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Felleskatalogen har ingen preparatomtale for fenytoin."}]},{"type":"paragraph","content":[{"type":"text","text":"Pro-Epanutin (fosfenytoin, et prodrug som omdannes til fenytoin): voksne og barn ≥5 år ved status epilepticus, og som anfallsprofylakse ved nevrokirurgiske inngrep."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Flunitrazepam
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden stoffet har fra før, eller en ny.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Flunitrazepam');

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Flunitrazepam');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Flunitrazepam"}'::jsonb)).id;
      nye := nye || side_0;
    end if;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'indikasjon'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Felleskatalogen har ingen preparatomtale for flunitrazepam."}]}]}}'::jsonb
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Gabapentin
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  referanse_1 uuid;
  referanse_2 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden stoffet har fra før, eller en ny.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Gabapentin');

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Neurontin «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/neurontin-viatris-561923'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-neurontin';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Neurisol «Oresund Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/neurisol-oresund-pharma-773963'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-neurisol';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Shaktatin «2care4 Generics»' and r.lenke = 'https://www.felleskatalogen.no/medisin/shaktatin-2care4-generics-776078'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-shaktatin';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Gabapentin');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Gabapentin"}'::jsonb)).id;
      nye := nye || side_0;
    end if;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'indikasjon'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Epilepsi:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Voksne og barn ≥6 år: tilleggsbehandling ved partiell epilepsi med og uten sekundær generalisering."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"tex'
    't","text":"Voksne og ungdom ≥12 år: monoterapi ved partiell epilepsi med og uten sekundær generalisering."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"Voksne: perifer nevropatisk smerte, f.eks. smertefull diabetisk nevropati og postherpetisk nevralgi."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1, referanse_2)
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Karbamazepin
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  referanse_1 uuid;
  referanse_2 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden stoffet har fra før, eller en ny.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Karbamazepin');

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Tegretol, Tegretol Retard «Novartis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/tegretol-tegretol-retard-novartis-564471'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-tegretol';
  end if;
  referanse_1 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Trimonil Retard «Desitin»' and r.lenke = 'https://www.felleskatalogen.no/medisin/trimonil-retard-desitin-564842'
     order by r.objekt_id limit 1);
  if referanse_1 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-trimonil-retard';
  end if;
  referanse_2 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Carbamazepine Essential Pharma «Essential Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/carbamazepine-essential-pharma-essential-pharma-640712'
     order by r.objekt_id limit 1);
  if referanse_2 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-carbamazepine-essential-pharma';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Karbamazepin');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Karbamazepin"}'::jsonb)).id;
      nye := nye || side_0;
    end if;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'indikasjon'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Tegretol, Tegretol Retard og Trimonil Retard:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Epilepsi: komplekse og enkle partielle anfall, primærgeneraliserte anfall, sekundærgeneraliserte anfall med utvikling til tonisk-kloniske anfal'
    'lstyper, og blandede epilepsiformer."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Genuin trigeminusnevralgi."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Alkoholabstinens."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sentralt betinget diabetes insipidus."}]}]},{"ty'
    'pe":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Symptomatisk lindring av smerter ved diabetisk nevropati."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Akutt manisk episode, og profylaktisk behandling av bipolar affektiv lidelse."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"Carbamazepine Essential Pharma: '
    'bare epilepsi."}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0, referanse_1, referanse_2)
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Ketobemidon
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden stoffet har fra før, eller en ny.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Ketobemidon');

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Ketobemidon');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Ketobemidon"}'::jsonb)).id;
      nye := nye || side_0;
    end if;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'indikasjon'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Felleskatalogen har ingen preparatomtale for ketobemidon."}]}]}}'::jsonb
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Levetiracetam
do $import$
declare
  administrator uuid;
  nye uuid[] := '{}';
  objekt uuid;
  side_0 uuid;
  referanse_0 uuid;
  kort uuid;
  revisjon integer;
  publisert boolean;
  innhold jsonb;
  kilder jsonb;
begin
  select p.id into administrator from public.profiles p where p.username = 'peohol' and p.role = 'admin';
  if administrator is null then
    raise notice 'Fant ingen administrator med brukernavnet %, så importen hoppes over.', 'peohol';
    return;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', administrator, 'role', 'authenticated')::text, true);
  -- Siden stoffet har fra før, eller en ny.
  select s.objekt_id into side_0 from public.infosider s
    where s.tilstand = 'utkast' and lower(s.navn) = lower('Levetiracetam');

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Keppra «UCB»' and r.lenke = 'https://www.felleskatalogen.no/medisin/keppra-ucb-560503'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-keppra';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Levetiracetam');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Levetiracetam"}'::jsonb)).id;
      nye := nye || side_0;
    end if;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 25.09.2026', true);
  kort := null;
  select e.objekt_id, u.revisjon, u.revisjon = p.revisjon, r.innhold into kort, revisjon, publisert, innhold
    from public.innholdselementer e
    join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
    left join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
    join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = u.revisjon
    where e.tilstand = 'utkast' and e.infoside_id = side_0 and e.panel = 'indikasjon'
      and e.elementtype = 'riktekst' and (e.data ->> 'tittel') is not distinct from null
    order by e.posisjon, e.objekt_id limit 1;
  if kort is null then
    objekt := (public.opprett_utkast('innholdselement', jsonb_build_object(
      'infoside', side_0,
    'panel', 'indikasjon',
    'posisjon', 0,
    'elementtype', 'riktekst',
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Alle legemiddelformer:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Voksne og ungdom >16 år med nylig diagnostisert epilepsi: monoterapi ved partielle anfall med eller uten sekundær generalisering."}]}]},{"type":"listItem","content":['
    '{"type":"paragraph","content":[{"type":"text","text":"Voksne og ungdom >12 år: tilleggsbehandling av myoklone anfall ved juvenil myoklon epilepsi, og av primære generaliserte tonisk-kloniske anfall ved idiopatisk generalisert epilepsi."}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"Tilleggsbehandling av partielle anfall med eller uten sekundær generalisering:"}]},{"type":"bulletList'
    '","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Mikstur og tabletter: voksne, ungdom, barn og spedbarn >1 måned."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Konsentrat til infusjonsvæske: voksne, ungdom og barn >4 år, som alternativ når peroral administrering midlertidig ikke er mulig."}]}]}]}]}}'::jsonb,
    'referanser', jsonb_build_array(referanse_0)
    ))).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;