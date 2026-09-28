-- Referansene (1 av 3)
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
  -- fk-xanor
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Xanor, Xanor Depot «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/xanor-xanor-depot-viatris-565512'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Xanor, Xanor Depot «Viatris»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/xanor-xanor-depot-viatris-565512"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-buprenorphine-orifarm
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Buprenorphine Orifarm «Orifarm Generics»' and r.lenke = 'https://www.felleskatalogen.no/medisin/buprenorphine-orifarm-orifarm-generics-571141'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Buprenorphine Orifarm «Orifarm Generics»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/buprenorphine-orifarm-orifarm-generics-571141"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-buprenorphine-sandoz
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Buprenorphine Sandoz «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/buprenorphine-sandoz-sandoz-580062'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Buprenorphine Sandoz «Sandoz»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/buprenorphine-sandoz-sandoz-580062"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-espranor
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Espranor «Ethypharm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/espranor-ethypharm-745102'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Espranor «Ethypharm»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/espranor-ethypharm-745102"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-buvidal
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Buvidal «Camurus»' and r.lenke = 'https://www.felleskatalogen.no/medisin/buvidal-camurus-657698'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Buvidal «Camurus»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/buvidal-camurus-657698"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-bunalict
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Bunalict «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/bunalict-sandoz-646365'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Bunalict «Sandoz»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/bunalict-sandoz-646365"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-zubsolv
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Zubsolv «Accord»' and r.lenke = 'https://www.felleskatalogen.no/medisin/zubsolv-accord-714286'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Zubsolv «Accord»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/zubsolv-accord-714286"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-temgesic
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Temgesic «Eumedica Pharmaceuticals»' and r.lenke = 'https://www.felleskatalogen.no/medisin/temgesic-eumedica-pharmaceuticals-564488'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Temgesic «Eumedica Pharmaceuticals»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/temgesic-eumedica-pharmaceuticals-564488"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-buprenorphine-gl
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Buprenorphine G.L. Pharma «G.L. Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/buprenorphine-g-l-pharma-g-l-pharma-774000'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Buprenorphine G.L. Pharma «G.L. Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/buprenorphine-g-l-pharma-g-l-pharma-774000"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-norspan
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Norspan «Mundipharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/norspan-mundipharma-562137'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Norspan «Mundipharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/norspan-mundipharma-562137"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-bugnanto
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Bugnanto «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/bugnanto-sandoz-646364'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Bugnanto «Sandoz»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/bugnanto-sandoz-646364"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-buprefarm
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Buprefarm «Orifarm Generics»' and r.lenke = 'https://www.felleskatalogen.no/medisin/buprefarm-orifarm-generics-641311'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Buprefarm «Orifarm Generics»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/buprefarm-orifarm-generics-641311"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-rivotril
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Rivotril «Cheplapharm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/rivotril-cheplapharm-563568'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Rivotril «Cheplapharm»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/rivotril-cheplapharm-563568"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-iqtopam
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Iqtopam «XGX Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/iqtopam-xgx-pharma-771776'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Iqtopam «XGX Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/iqtopam-xgx-pharma-771776"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-stesolid
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Stesolid «Actavis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/stesolid-actavis-564172'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Stesolid «Actavis»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/stesolid-actavis-564172"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-valium
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Valium «Atnahs»' and r.lenke = 'https://www.felleskatalogen.no/medisin/valium-atnahs-564977'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Valium «Atnahs»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/valium-atnahs-564977"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-vival
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Vival «Actavis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/vival-actavis-565421'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Vival «Actavis»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/vival-actavis-565421"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-fentanyl-ratiopharm
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fentanyl ratiopharm «ratiopharm»' and r.lenke = 'https://www.felleskatalogen.no/medisin/fentanyl-ratiopharm-ratiopharm-686322'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Fentanyl ratiopharm «ratiopharm»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/fentanyl-ratiopharm-ratiopharm-686322"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-fentanyl-sandoz
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fentanyl Sandoz «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/fentanyl-sandoz-sandoz-573660'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Fentanyl Sandoz «Sandoz»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/fentanyl-sandoz-sandoz-573660"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-abstral
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Abstral «Grünenthal»' and r.lenke = 'https://www.felleskatalogen.no/medisin/abstral-gruunenthal-545659'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Abstral «Grünenthal»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/abstral-gruunenthal-545659"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-instanyl
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Instanyl DoseGuard «Gentili»' and r.lenke = 'https://www.felleskatalogen.no/medisin/instanyl-doseguard-gentili-560085'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Instanyl DoseGuard «Gentili»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/instanyl-doseguard-gentili-560085"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-fentanyl-hameln
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Fentanyl Hameln «Hameln»' and r.lenke = 'https://www.felleskatalogen.no/medisin/fentanyl-hameln-hameln-559044'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Fentanyl Hameln «Hameln»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/fentanyl-hameln-hameln-559044"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-kodein-orifarm
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Kodein «Orifarm Healthcare»' and r.lenke = 'https://www.felleskatalogen.no/medisin/kodein-orifarm-healthcare-560677'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Kodein «Orifarm Healthcare»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/kodein-orifarm-healthcare-560677"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-paralgin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Paralgin forte, Paralgin major «Karo Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/paralgin-forte-paralgin-major-karo-pharma-562631'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Paralgin forte, Paralgin major «Karo Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/paralgin-forte-paralgin-major-karo-pharma-562631"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-pinex-forte
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Pinex Forte «Teva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/pinex-forte-teva-562841'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Pinex Forte «Teva»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/pinex-forte-teva-562841"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Referansene (2 av 3)
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
  -- fk-altermol
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Altermol «Alternova»' and r.lenke = 'https://www.felleskatalogen.no/medisin/altermol-alternova-613735'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Altermol «Alternova»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/altermol-alternova-613735"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-metadon-dne
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Metadon DnE «dne pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/metadon-dne-dne-pharma-561385'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Metadon DnE «dne pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/metadon-dne-dne-pharma-561385"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-metadon-nordic-drugs
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Metadon Nordic Drugs «Nordic Drugs»' and r.lenke = 'https://www.felleskatalogen.no/medisin/metadon-nordic-drugs-nordic-drugs-590291'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Metadon Nordic Drugs «Nordic Drugs»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/metadon-nordic-drugs-nordic-drugs-590291"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-metadon-abcur
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Metadon Abcur «Abcur»' and r.lenke = 'https://www.felleskatalogen.no/medisin/metadon-abcur-abcur-581374'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Metadon Abcur «Abcur»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/metadon-abcur-abcur-581374"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-levopidon
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Levopidon «Navamedic»' and r.lenke = 'https://www.felleskatalogen.no/medisin/levopidon-navamedic-654472'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Levopidon «Navamedic»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/levopidon-navamedic-654472"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-dolcontin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Dolcontin «Mundipharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/dolcontin-mundipharma-548098'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Dolcontin «Mundipharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/dolcontin-mundipharma-548098"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-malfin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Malfin «Teva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/malfin-teva-569134'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Malfin «Teva»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/malfin-teva-569134"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-morfin-abcur
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Morfin Abcur «Abcur»' and r.lenke = 'https://www.felleskatalogen.no/medisin/morfin-abcur-abcur-588167'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Morfin Abcur «Abcur»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/morfin-abcur-abcur-588167"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-morfin-orifarm
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Morfin «Orifarm Healthcare»' and r.lenke = 'https://www.felleskatalogen.no/medisin/morfin-orifarm-healthcare-561671'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Morfin «Orifarm Healthcare»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/morfin-orifarm-healthcare-561671"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-oramorph
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Oramorph «Molteni»' and r.lenke = 'https://www.felleskatalogen.no/medisin/oramorph-molteni-573631'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Oramorph «Molteni»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/oramorph-molteni-573631"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-morfin-epidural
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Morfin Epidural «Orifarm Healthcare»' and r.lenke = 'https://www.felleskatalogen.no/medisin/morfin-epidural-orifarm-healthcare-561666'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Morfin Epidural «Orifarm Healthcare»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/morfin-epidural-orifarm-healthcare-561666"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-apodorm
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Apodorm «Actavis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/apodorm-actavis-546120'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Apodorm «Actavis»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/apodorm-actavis-546120"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-oxycontin
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'OxyContin «Mundipharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/oxycontin-mundipharma-562548'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"OxyContin «Mundipharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/oxycontin-mundipharma-562548"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-oxynorm
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'OxyNorm «Mundipharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/oxynorm-mundipharma-562551'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"OxyNorm «Mundipharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/oxynorm-mundipharma-562551"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-oxycodone-actavis
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Oxycodone Actavis «Actavis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/oxycodone-actavis-actavis-585277'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Oxycodone Actavis «Actavis»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/oxycodone-actavis-actavis-585277"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-reltebon-depot
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Reltebon Depot «Teva»' and r.lenke = 'https://www.felleskatalogen.no/medisin/reltebon-depot-teva-589342'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Reltebon Depot «Teva»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/reltebon-depot-teva-589342"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-oxycodone-hameln
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Oxycodone Hameln «Hameln»' and r.lenke = 'https://www.felleskatalogen.no/medisin/oxycodone-hameln-hameln-657543'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Oxycodone Hameln «Hameln»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/oxycodone-hameln-hameln-657543"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-targiniq
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Targiniq «Mundipharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/targiniq-mundipharma-564421'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Targiniq «Mundipharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/targiniq-mundipharma-564421"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-tanonalla
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Tanonalla «Sandoz»' and r.lenke = 'https://www.felleskatalogen.no/medisin/tanonalla-sandoz-697368'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Tanonalla «Sandoz»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/tanonalla-sandoz-697368"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-sobril
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Sobril «Pfizer»' and r.lenke = 'https://www.felleskatalogen.no/medisin/sobril-pfizer-563995'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Sobril «Pfizer»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/sobril-pfizer-563995"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-delipam
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Delipam «2care4 Generics»' and r.lenke = 'https://www.felleskatalogen.no/medisin/delipam-2care4-generics-740382'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Delipam «2care4 Generics»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/delipam-2care4-generics-740382"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-palexia
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Palexia «Grünenthal»' and r.lenke = 'https://www.felleskatalogen.no/medisin/palexia-gruunenthal-587504'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Palexia «Grünenthal»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/palexia-gruunenthal-587504"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-palexia-mikstur
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Palexia mikstur «Grünenthal»' and r.lenke = 'https://www.felleskatalogen.no/medisin/palexia-gruunenthal-674878'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Palexia mikstur «Grünenthal»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/palexia-gruunenthal-674878"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-tapentadol-gl
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Tapentadol G.L. Pharma «G.L. Pharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/tapentadol-g-l-pharma-g-l-pharma-771810'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Tapentadol G.L. Pharma «G.L. Pharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/tapentadol-g-l-pharma-g-l-pharma-771810"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-palexia-depot
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Palexia depot «Grünenthal»' and r.lenke = 'https://www.felleskatalogen.no/medisin/palexia-depot-gruunenthal-570394'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Palexia depot «Grünenthal»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/palexia-depot-gruunenthal-570394"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- Referansene (3 av 3)
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
  -- fk-tapentadol-medical-valley
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Tapentadol Medical Valley «Medical Valley»' and r.lenke = 'https://www.felleskatalogen.no/medisin/tapentadol-medical-valley-medical-valley-731870'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Tapentadol Medical Valley «Medical Valley»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/tapentadol-medical-valley-medical-valley-731870"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-nobligan
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Nobligan, Nobligan Retard «Grünenthal»' and r.lenke = 'https://www.felleskatalogen.no/medisin/nobligan-nobligan-retard-gruunenthal-562037'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Nobligan, Nobligan Retard «Grünenthal»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/nobligan-nobligan-retard-gruunenthal-562037"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-tramadol-hexal
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Tramadol HEXAL «HEXAL»' and r.lenke = 'https://www.felleskatalogen.no/medisin/tramadol-hexal-hexal-564758'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Tramadol HEXAL «HEXAL»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/tramadol-hexal-hexal-564758"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-tramagetic
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Tramagetic OD, Tramagetic Retard «Mundipharma»' and r.lenke = 'https://www.felleskatalogen.no/medisin/tramagetic-od-tramagetic-retard-mundipharma-564764'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Tramagetic OD, Tramagetic Retard «Mundipharma»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/tramagetic-od-tramagetic-retard-mundipharma-564764"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-tramadol-actavis
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Tramadol Actavis «Actavis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/tramadol-actavis-actavis-587676'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Tramadol Actavis «Actavis»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/tramadol-actavis-actavis-587676"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-tramadol-paracetamol-orion
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Tramadol/Paracetamol Orion «Orion»' and r.lenke = 'https://www.felleskatalogen.no/medisin/tramadol-paracetamol-orion-orion-631463'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Tramadol/Paracetamol Orion «Orion»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/tramadol-paracetamol-orion-orion-631463"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-stilnoct
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Stilnoct «sanofi-aventis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/stilnoct-sanofi-aventis-564177'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Stilnoct «sanofi-aventis»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/stilnoct-sanofi-aventis-564177"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-imovane
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Imovane «sanofi-aventis»' and r.lenke = 'https://www.felleskatalogen.no/medisin/imovane-sanofi-aventis-560033'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Imovane «sanofi-aventis»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/imovane-sanofi-aventis-560033"}'::jsonb)).id;
    nye := nye || objekt;
  end if;
  -- fk-zopiclone-grindeks
  objekt := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Zopiclone Grindeks «Grindeks»' and r.lenke = 'https://www.felleskatalogen.no/medisin/zopiclone-grindeks-grindeks-759296'
     order by r.objekt_id limit 1);
  if objekt is null then
    perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
    objekt := (public.opprett_utkast('referanse', '{"tittel":"Zopiclone Grindeks «Grindeks»","forfattere":"Felleskatalogen","aar":"","lenke":"https://www.felleskatalogen.no/medisin/zopiclone-grindeks-grindeks-759296"}'::jsonb)).id;
    nye := nye || objekt;
  end if;

  -- Alt som ble opprettet, publiseres i den rekkefølgen det ble laget:
  -- referansene og sidene før det som peker på dem.
  foreach objekt in array nye loop
    perform public.publiser_utkast(objekt, 1);
  end loop;
end
$import$;

-- APR
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
  -- Siden koden har fra før, eller en ny.
  select a.hovedside_id into side_0 from public.laboratorieanalytter a
    where a.kode = 'APR' and a.tilstand = 'utkast';

  -- Referansene siden siterer. De er lagt inn og publisert i den første blokken.
  referanse_0 := (select r.objekt_id from public.referanser r
     where r.tilstand = 'publisert' and not r.arkivert
       and r.tittel = 'Xanor, Xanor Depot «Viatris»' and r.lenke = 'https://www.felleskatalogen.no/medisin/xanor-xanor-depot-viatris-565512'
     order by r.objekt_id limit 1);
  if referanse_0 is null then
    raise exception 'Referansen % er ikke publisert. Kjør blokken for referansene først.', 'fk-xanor';
  end if;

  if side_0 is null then
    -- Sidene: en side med samme navn som alt finnes, brukes.
    select s.objekt_id into side_0 from public.infosider s
      where s.tilstand = 'utkast' and lower(s.navn) = lower('Alprazolam');
    if side_0 is null then
      perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
      side_0 := (public.opprett_utkast('infoside', '{"navn":"Alprazolam"}'::jsonb)).id;
      nye := nye || side_0;
    end if;

    perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);
    objekt := (public.opprett_utkast('laboratorieanalytt', jsonb_build_object(
      'kode', 'APR',
      'hovedside', side_0,
      'komponenter', jsonb_build_array(side_0)
    ))).id;
    nye := nye || objekt;
  end if;
  perform set_config('far.revisjonskilde', 'Importert fra Felleskatalogen', true);

  -- indikasjon/riktekst
  perform set_config('far.revisjonskilde', 'Hentet fra Felleskatalogen 28.09.2026', true);
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
    'data', '{"dokument":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Xanor og Xanor Depot: symptomatisk korttidsbehandling av angst hos voksne, bare når lidelsen er alvorlig, hemmende eller utsetter personen for ekstremt ubehag."}]}]}}'::jsonb,
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