-- Referansene (1 av 5)
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
  -- reis2009
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Serum concentrations of antidepressant drugs in a naturalistic setting: compilation based on a large therapeutic drug monitoring database' and r.lenke = 'https://doi.org/10.1097/ftd.0b013e31819114ea'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Serum concentrations of antidepressant drugs in a naturalistic setting: compilation based on a large therapeutic drug monitoring database","forfattere":"Reis M et al.","aar":"2009","lenke":"https://doi.org/10.1097/ftd.0b013e31819114ea"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- jonsson2019
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'A Compilation of Serum Concentrations of 12 Antipsychotic Drugs in a Therapeutic Drug Monitoring Setting' and r.lenke = 'https://doi.org/10.1097/FTD.0000000000000585'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"A Compilation of Serum Concentrations of 12 Antipsychotic Drugs in a Therapeutic Drug Monitoring Setting","forfattere":"Jönsson AK et al.","aar":"2019","lenke":"https://doi.org/10.1097/FTD.0000000000000585"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- hiemke2017
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017' and r.lenke = 'https://doi.org/10.1055/s-0043-116492'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017","forfattere":"Hiemke C et al.","aar":"2018","lenke":"https://doi.org/10.1055/s-0043-116492"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- schulz2020
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics' and r.lenke = 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7201985/'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics","forfattere":"Schulz M et al.","aar":"2020","lenke":"https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7201985/"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- referanseomradeprosjektet
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika' and r.lenke = 'https://farmakologiportalen.no/nasjonale_referanseomrader/'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Referanseområdeprosjektet 2005–2008: nasjonale kartleggings- og harmoniseringsprosjekter innen klinisk farmakologi – antidepressiva og antipsykotika","forfattere":"Diakonhjemmet sykehus og St. Olavs hospital","aar":"","lenke":"https://farmakologiportalen.no/nasjonale_referanseomrader/"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-antipsykotika
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Antipsykotika – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/antipsykotika-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Antipsykotika – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/antipsykotika-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-tca
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Trisykliske antidepressiva (TCA) – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/trisykliske-antidepressiva-tca-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Trisykliske antidepressiva (TCA) – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/trisykliske-antidepressiva-tca-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-solian
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Solian «sanofi-aventis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/solian-sanofi-aventis-564002'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Solian «sanofi-aventis»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/solian-sanofi-aventis-564002"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-sarotex
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sarotex «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sarotex-lundbeck-563752'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Sarotex «Lundbeck»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/sarotex-lundbeck-563752"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-amitriptylin-abcur
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Amitriptylin Abcur «Abcur»' and r.lenke = 'https://www.felleskatalogen.no/medisin/amitriptylin-abcur-abcur-640710'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Amitriptylin Abcur «Abcur»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/amitriptylin-abcur-abcur-640710"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-amitriptylin-orifarm
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Amitriptylin Orifarm «Orifarm Generics»' and r.lenke = 'https://www.felleskatalogen.no/medisin/amitriptylin-orifarm-orifarm-generics-655234'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Amitriptylin Orifarm «Orifarm Generics»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/amitriptylin-orifarm-orifarm-generics-655234"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- pharmgkb-amitriptylin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Amitriptyline – guideline annotation' and r.lenke = 'https://www.pharmgkb.org/chemical/PA448385/guidelineAnnotation/PA166105006'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 7', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Amitriptyline – guideline annotation","forfattere":"PharmGKB","aar":"","lenke":"https://www.pharmgkb.org/chemical/PA448385/guidelineAnnotation/PA166105006"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-abilify
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Abilify «Otsuka Pharmaceutical»' and r.lenke = 'https://www.felleskatalogen.no/medisin/abilify-otsuka-pharmaceutical-545656'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Abilify «Otsuka Pharmaceutical»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/abilify-otsuka-pharmaceutical-545656"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-abilify-maintena
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Abilify Maintena «Otsuka Pharmaceutical»' and r.lenke = 'https://www.felleskatalogen.no/medisin/abilify-maintena-otsuka-pharmaceutical-586071'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Abilify Maintena «Otsuka Pharmaceutical»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/abilify-maintena-otsuka-pharmaceutical-586071"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-substansregister-aripiprazol
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Aripiprazol – substansregister' and r.lenke = 'https://www.felleskatalogen.no/medisin/substansregister/aripiprazol'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Aripiprazol – substansregister","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/substansregister/aripiprazol"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-rxulti
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Rxulti «Otsuka Pharmaceutical»' and r.lenke = 'https://www.felleskatalogen.no/medisin/rxulti-otsuka-pharmaceutical-657929'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Rxulti «Otsuka Pharmaceutical»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/rxulti-otsuka-pharmaceutical-657929"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-cipramil-lundbeck
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cipramil «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cipramil-lundbeck-547492'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Cipramil «Lundbeck»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/cipramil-lundbeck-547492"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-cipramil-2care4
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cipramil «2care4»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cipramil-2care4-686468'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Cipramil «2care4»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/cipramil-2care4-686468"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-citalopram-orion
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Citalopram Orion «Orion»' and r.lenke = 'https://www.felleskatalogen.no/medisin/citalopram-orion-orion-591942'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Citalopram Orion «Orion»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/citalopram-orion-orion-591942"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-citalopram
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Citalopram – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/citalopram-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 10', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Citalopram – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/citalopram-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-sinequan-orifarm
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sinequan «Orifarm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sinequan-orifarm-633925'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Sinequan «Orifarm»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/sinequan-orifarm-633925"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-cymbalta-orifarm
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cymbalta «Orifarm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cymbalta-orifarm-669762'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Cymbalta «Orifarm»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/cymbalta-orifarm-669762"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-duloxetin-pensa
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Duloxetin Pensa «Pensa Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/duloxetin-pensa-pensa-pharma-600087'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Duloxetin Pensa «Pensa Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/duloxetin-pensa-pensa-pharma-600087"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-duloxetine-medical-valley
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Duloxetine Medical Valley «Medical Valley»' and r.lenke = 'https://www.felleskatalogen.no/medisin/duloxetine-medical-valley-medical-valley-736548'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Duloxetine Medical Valley «Medical Valley»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/duloxetine-medical-valley-medical-valley-736548"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-duloxetine-viatris
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Duloxetine Viatris «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/duloxetine-viatris-viatris-603041'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Duloxetine Viatris «Viatris»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/duloxetine-viatris-viatris-603041"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Referansene (2 av 5)
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
  -- fk-cipralex-lundbeck
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cipralex «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cipralex-lundbeck-547489'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Cipralex «Lundbeck»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/cipralex-lundbeck-547489"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-cipralex-2care4
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cipralex «2care4»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cipralex-2care4-629344'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Cipralex «2care4»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/cipralex-2care4-629344"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-cipralex-abacus-medicine
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cipralex «Abacus Medicine»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cipralex-abacus-medicine-787300'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Cipralex «Abacus Medicine»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/cipralex-abacus-medicine-787300"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-cipralex-orifarm
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Cipralex «Orifarm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/cipralex-orifarm-574078'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Cipralex «Orifarm»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/cipralex-orifarm-574078"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-escitalopram-actavis
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Escitalopram Actavis «Actavis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/escitalopram-actavis-actavis-571498'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Escitalopram Actavis «Actavis»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/escitalopram-actavis-actavis-571498"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-escitalopram-grindeks
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Escitalopram Grindeks «Grindeks»' and r.lenke = 'https://www.felleskatalogen.no/medisin/escitalopram-grindeks-grindeks-757090'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Escitalopram Grindeks «Grindeks»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/escitalopram-grindeks-grindeks-757090"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-fluoxetin-sandoz
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fluoxetin Sandoz «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/fluoxetin-sandoz-sandoz-576072'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Fluoxetin Sandoz «Sandoz»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/fluoxetin-sandoz-sandoz-576072"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-fluoxetin-viatris
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fluoxetin Viatris «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/fluoxetin-viatris-viatris-559253'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Fluoxetin Viatris «Viatris»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/fluoxetin-viatris-viatris-559253"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-fluoxetine-vitabalans
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fluoxetine Vitabalans «Vitabalans»' and r.lenke = 'https://www.felleskatalogen.no/medisin/fluoxetine-vitabalans-vitabalans-588815'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Fluoxetine Vitabalans «Vitabalans»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/fluoxetine-vitabalans-vitabalans-588815"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-fontex-2care4
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fontex «2care4»' and r.lenke = 'https://www.felleskatalogen.no/medisin/fontex-2care4-686470'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Fontex «2care4»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/fontex-2care4-686470"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-fluoksetin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fluoksetin – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/fluoksetin-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 16', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Fluoksetin – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/fluoksetin-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-fluanxol
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fluanxol, Fluanxol Depot «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/fluanxol-fluanxol-depot-lundbeck-559164'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Fluanxol, Fluanxol Depot «Lundbeck»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/fluanxol-fluanxol-depot-lundbeck-559164"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-fevarin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fevarin «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/fevarin-viatris-559074'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Fevarin «Viatris»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/fevarin-viatris-559074"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-fluvoksamin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fluvoksamin – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/fluvoksamin-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 17', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Fluvoksamin – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/fluvoksamin-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-haldol
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Haldol, Haldol depot «Janssen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/haldol-haldol-depot-janssen-559751'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Haldol, Haldol depot «Janssen»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/haldol-haldol-depot-janssen-559751"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-wellbutrin-retard
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Wellbutrin Retard «GlaxoSmithKline»' and r.lenke = 'https://www.felleskatalogen.no/medisin/wellbutrin-retard-glaxosmithkline-565480'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Wellbutrin Retard «GlaxoSmithKline»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/wellbutrin-retard-glaxosmithkline-565480"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-paritdam
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Paritdam «Accord»' and r.lenke = 'https://www.felleskatalogen.no/medisin/paritdam-accord-685606'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Paritdam «Accord»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/paritdam-accord-685606"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-bupropion-hydrochloride-teva
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Bupropion hydrochloride «Teva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/bupropion-hydrochloride-teva-676386'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Bupropion hydrochloride «Teva»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/bupropion-hydrochloride-teva-676386"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-mysimba-orexigen
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Mysimba «Orexigen»' and r.lenke = 'https://www.felleskatalogen.no/medisin/mysimba-orexigen-642598'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Mysimba «Orexigen»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/mysimba-orexigen-642598"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-mysimba-2care4
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Mysimba «2care4»' and r.lenke = 'https://www.felleskatalogen.no/medisin/mysimba-2care4-710542'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Mysimba «2care4»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/mysimba-2care4-710542"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- helsebiblioteket-bupropion
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Bupropion – behandlingsanbefaling ved forgiftning' and r.lenke = 'https://www.helsebiblioteket.no/forgiftninger/legemidler/bupropion-behandlingsanbefaling-ved-forgiftning'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 8–9', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Bupropion – behandlingsanbefaling ved forgiftning","forfattere":"Helsebiblioteket (Giftinformasjonen)","aar":"","lenke":"https://www.helsebiblioteket.no/forgiftninger/legemidler/bupropion-behandlingsanbefaling-ved-forgiftning"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- kharasch2026
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Pharmacogenetic influence on bupropion bioactivation and clinical outcomes in major depressive disorder' and r.lenke = 'https://doi.org/10.1124/jpet.126.000169'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Importert fra Psykofarmaka.pdf, side 8–9', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Pharmacogenetic influence on bupropion bioactivation and clinical outcomes in major depressive disorder","forfattere":"Kharasch E.D. & Lenze E.J.","aar":"2026","lenke":"https://doi.org/10.1124/jpet.126.000169"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-reagila
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Reagila «Gedeon Richter»' and r.lenke = 'https://www.felleskatalogen.no/medisin/reagila-gedeon-richter-652889'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Reagila «Gedeon Richter»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/reagila-gedeon-richter-652889"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-truxal
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Truxal «Lundbeck»' and r.lenke = 'https://www.felleskatalogen.no/medisin/truxal-lundbeck-564882'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Truxal «Lundbeck»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/truxal-lundbeck-564882"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-anafranil
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Anafranil «Pharma&»' and r.lenke = 'https://www.felleskatalogen.no/medisin/anafranil-pharma-546059'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 23.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Anafranil «Pharma&»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/anafranil-pharma-546059"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;