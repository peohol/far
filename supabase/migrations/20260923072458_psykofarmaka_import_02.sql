-- Referansene (3 av 5)
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
  -- pharmgkb-klomipramin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Annotation of CPIC Guideline for clomipramine and CYP2C19, CYP2D6' and r.lenke = 'https://www.pharmgkb.org/guidelineAnnotation/PA166105007'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 18', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Annotation of CPIC Guideline for clomipramine and CYP2C19, CYP2D6","forfattere":"PharmGKB","aar":"","lenke":"https://www.pharmgkb.org/guidelineAnnotation/PA166105007"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-clozapin-hexal
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Clozapin HEXAL «HEXAL»' and r.lenke = 'https://www.felleskatalogen.no/medisin/clozapin-hexal-hexal-547590'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Clozapin HEXAL «HEXAL»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/clozapin-hexal-hexal-547590"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-leponex
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Leponex «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/leponex-viatris-560891'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Leponex «Viatris»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/leponex-viatris-560891"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-seroquel
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Seroquel «AstraZeneca»' and r.lenke = 'https://www.felleskatalogen.no/medisin/seroquel-astrazeneca-563858'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Seroquel «AstraZeneca»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/seroquel-astrazeneca-563858"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-lamictal
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Lamictal «GlaxoSmithKline»' and r.lenke = 'https://www.felleskatalogen.no/medisin/lamictal-glaxosmithkline-560748'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Lamictal «GlaxoSmithKline»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/lamictal-glaxosmithkline-560748"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-levomepromazine-orion
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Levomepromazine Orion «Orion»' and r.lenke = 'https://www.felleskatalogen.no/medisin/levomepromazine-orion-orion-579882'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Levomepromazine Orion «Orion»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/levomepromazine-orion-orion-579882"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-latuda
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Latuda «Angelini Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/latuda-angelini-pharma-589608'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Latuda «Angelini Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/latuda-angelini-pharma-589608"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-lurasidone-accord
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Lurasidone Accord «Accord»' and r.lenke = 'https://www.felleskatalogen.no/medisin/lurasidone-accord-accord-761387'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Lurasidone Accord «Accord»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/lurasidone-accord-accord-761387"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-mianserin-viatris
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Mianserin Viatris «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/mianserin-viatris-viatris-633380'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Mianserin Viatris «Viatris»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/mianserin-viatris-viatris-633380"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-mianserin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Mianserin – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/mianserin-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 20', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Mianserin – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/mianserin-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-mirtazapin-bluefish
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Mirtazapin Bluefish «Bluefish»' and r.lenke = 'https://www.felleskatalogen.no/medisin/mirtazapin-bluefish-bluefish-575244'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Mirtazapin Bluefish «Bluefish»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/mirtazapin-bluefish-bluefish-575244"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-mirtazapin-hexal
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Mirtazapin HEXAL «HEXAL»' and r.lenke = 'https://www.felleskatalogen.no/medisin/mirtazapin-hexal-hexal-561580'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Mirtazapin HEXAL «HEXAL»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/mirtazapin-hexal-hexal-561580"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-mirtazapin-orion
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Mirtazapin Orion «Orion»' and r.lenke = 'https://www.felleskatalogen.no/medisin/mirtazapin-orion-orion-633220'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Mirtazapin Orion «Orion»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/mirtazapin-orion-orion-633220"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-remeron
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Remeron, Remeron-S «Organon»' and r.lenke = 'https://www.felleskatalogen.no/medisin/remeron-remeron-s-organon-563380'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Remeron, Remeron-S «Organon»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/remeron-remeron-s-organon-563380"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-mirtazapin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Mirtazapin – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/mirtazapin-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 21', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Mirtazapin – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/mirtazapin-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-noritren
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Noritren «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/noritren-lundbeck-562088'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Noritren «Lundbeck»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/noritren-lundbeck-562088"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-zyprexa
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Zyprexa, Zyprexa Velotab «Cheplapharm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/zyprexa-zyprexa-velotab-cheplapharm-565738'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Zyprexa, Zyprexa Velotab «Cheplapharm»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/zyprexa-zyprexa-velotab-cheplapharm-565738"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-zypadhera
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'ZypAdhera «Cheplapharm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/zypadhera-cheplapharm-565731'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"ZypAdhera «Cheplapharm»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/zypadhera-cheplapharm-565731"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-olanzapine-accord
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Olanzapine Accord «Accord»' and r.lenke = 'https://www.felleskatalogen.no/medisin/olanzapine-accord-accord-579885'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Olanzapine Accord «Accord»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/olanzapine-accord-accord-579885"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-olanzapine-teva
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Olanzapine Teva «Teva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/olanzapine-teva-teva-562369'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Olanzapine Teva «Teva»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/olanzapine-teva-teva-562369"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-olanzapine-viatris
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Olanzapine Viatris «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/olanzapine-viatris-viatris-727920'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Olanzapine Viatris «Viatris»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/olanzapine-viatris-viatris-727920"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-xeplion
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Xeplion «Janssen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/xeplion-janssen-571586'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Xeplion «Janssen»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/xeplion-janssen-571586"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-trevicta
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Trevicta «Janssen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/trevicta-janssen-628177'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Trevicta «Janssen»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/trevicta-janssen-628177"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-palmeux
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Palmeux «Amdipharm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/palmeux-amdipharm-724412'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Palmeux «Amdipharm»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/palmeux-amdipharm-724412"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-paliperidon-zentiva
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Paliperidon Zentiva «Zentiva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/paliperidon-zentiva-zentiva-779603'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Paliperidon Zentiva «Zentiva»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/paliperidon-zentiva-zentiva-779603"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Referansene (4 av 5)
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
  -- deleon2020
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Personalizing dosing of risperidone, paliperidone and clozapine using therapeutic drug monitoring and pharmacogenetics' and r.lenke = 'https://doi.org/10.1016/j.neuropharm.2019.05.033'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 54', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Personalizing dosing of risperidone, paliperidone and clozapine using therapeutic drug monitoring and pharmacogenetics","forfattere":"de Leon J","aar":"2020","lenke":"https://doi.org/10.1016/j.neuropharm.2019.05.033"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-paroxetin-aristo
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Paroxetin Aristo «Aristo Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/paroxetin-aristo-aristo-pharma-673904'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Paroxetin Aristo «Aristo Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/paroxetin-aristo-aristo-pharma-673904"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-seroxat
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Seroxat «GlaxoSmithKline»' and r.lenke = 'https://www.felleskatalogen.no/medisin/seroxat-glaxosmithkline-563860'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Seroxat «GlaxoSmithKline»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/seroxat-glaxosmithkline-563860"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-paroksetin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Paroksetin – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/paroksetin-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 23', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Paroksetin – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/paroksetin-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-trilafon-dekanoat
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Trilafon dekanoat «Orion»' and r.lenke = 'https://www.felleskatalogen.no/medisin/trilafon-dekanoat-orion-564813'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Trilafon dekanoat «Orion»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/trilafon-dekanoat-orion-564813"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-risperdal
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Risperdal «Janssen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/risperdal-janssen-563543'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Risperdal «Janssen»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/risperdal-janssen-563543"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-risperdal-consta
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Risperdal Consta «Janssen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/risperdal-consta-janssen-563537'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Risperdal Consta «Janssen»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/risperdal-consta-janssen-563537"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-okedi
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Okedi «ROVI»' and r.lenke = 'https://www.felleskatalogen.no/medisin/okedi-rovi-757488'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Okedi «ROVI»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/okedi-rovi-757488"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-risperidon-sandoz
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Risperidon Sandoz «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/risperidon-sandoz-sandoz-563550'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Risperidon Sandoz «Sandoz»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/risperidon-sandoz-sandoz-563550"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-risperidone-grindeks
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Risperidone Grindeks «Grindeks»' and r.lenke = 'https://www.felleskatalogen.no/medisin/risperidone-grindeks-grindeks-758708'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Risperidone Grindeks «Grindeks»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/risperidone-grindeks-grindeks-758708"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-sertralin-bluefish
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sertralin Bluefish «Bluefish»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sertralin-bluefish-bluefish-568495'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Sertralin Bluefish «Bluefish»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/sertralin-bluefish-bluefish-568495"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-sertralin-hexal
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sertralin HEXAL «HEXAL»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sertralin-hexal-hexal-596732'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Sertralin HEXAL «HEXAL»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/sertralin-hexal-hexal-596732"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-sertralin-zentiva
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sertralin Zentiva «Zentiva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sertralin-zentiva-zentiva-760489'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Sertralin Zentiva «Zentiva»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/sertralin-zentiva-zentiva-760489"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-sertraline-accord
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sertraline Accord «Accord»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sertraline-accord-accord-655239'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Sertraline Accord «Accord»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/sertraline-accord-accord-655239"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-zoloft
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Zoloft «2care4»' and r.lenke = 'https://www.felleskatalogen.no/medisin/zoloft-2care4-639548'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Zoloft «2care4»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/zoloft-2care4-639548"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-sertralin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sertralin – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/sertralin-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 24', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Sertralin – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/sertralin-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-surmontil
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Surmontil «Neuraxpharm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/surmontil-neuraxpharm-564275'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Surmontil «Neuraxpharm»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/surmontil-neuraxpharm-564275"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-efexor-depot
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Efexor Depot «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/efexor-depot-viatris-548246'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Efexor Depot «Viatris»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/efexor-depot-viatris-548246"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-venlafaxin-bluefish
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Venlafaxin Bluefish «Bluefish»' and r.lenke = 'https://www.felleskatalogen.no/medisin/venlafaxin-bluefish-bluefish-568499'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Venlafaxin Bluefish «Bluefish»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/venlafaxin-bluefish-bluefish-568499"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-venlafaxin-krka
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Venlafaxin Krka «KRKA»' and r.lenke = 'https://www.felleskatalogen.no/medisin/venlafaxin-krka-krka-565050'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Venlafaxin Krka «KRKA»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/venlafaxin-krka-krka-565050"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-venlazid
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Venlazid «Medical Valley»' and r.lenke = 'https://www.felleskatalogen.no/medisin/venlazid-medical-valley-640741'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Venlazid «Medical Valley»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/venlazid-medical-valley-640741"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-venlafaksin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Venlafaksin – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/venlafaksin-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 28', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Venlafaksin – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/venlafaksin-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-brintellix
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Brintellix «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/brintellix-lundbeck-589918'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Brintellix «Lundbeck»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/brintellix-lundbeck-589918"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- chen2017
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Vortioxetine: Clinical Pharmacokinetics and Drug Interactions' and r.lenke = 'https://doi.org/10.1007/s40262-017-0612-7'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 30', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Vortioxetine: Clinical Pharmacokinetics and Drug Interactions","forfattere":"Chen et al.","aar":"2017","lenke":"https://doi.org/10.1007/s40262-017-0612-7"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-ziprasidon-actavis
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Ziprasidon Actavis «Actavis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/ziprasidon-actavis-actavis-584182'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Ziprasidon Actavis «Actavis»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/ziprasidon-actavis-actavis-584182"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Referansene (5 av 5)
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
  -- fk-cisordinol
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cisordinol «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cisordinol-lundbeck-547526'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Cisordinol «Lundbeck»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/cisordinol-lundbeck-547526"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-cisordinol-acutard
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cisordinol-Acutard «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cisordinol-acutard-lundbeck-547522'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Cisordinol-Acutard «Lundbeck»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/cisordinol-acutard-lundbeck-547522"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-cisordinol-depot
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cisordinol Depot «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cisordinol-depot-lundbeck-547524'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Cisordinol Depot «Lundbeck»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/cisordinol-depot-lundbeck-547524"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;