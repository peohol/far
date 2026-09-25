-- Redigeringen av scenarioregelsett: regelsettet og kommentarene det peker
-- på, lagret som utkast i én transaksjon, slik intervallregelsettene lagres.
--
-- Kommentarene er egne objekter (public.kommentarer), og regelsettet eier
-- ikke tekstene. Når redigeringen endrer en tekst eller gir en plassering sin
-- egen, må kommentaren og regelsettet lagres sammen: enten alt eller
-- ingenting, og hver mot revisjonen redigeringen åpnet.
--
-- Lagringen av kommentarene flyttes til en felles hjelper, som
-- lagre_intervallregelsett også bruker. Den gjør nøyaktig det samme som før.

-- De nye og endrede kommentarene et regelsett lagres med:
--
--   [{ "id", "revisjon", "innhold" }]
--
-- der `revisjon` er den redigeringen åpnet, eller null for en ny kommentar
-- med den ID-en. Hver lagres mot sin revisjon, så en konflikt stopper det hele.
create function intern.lagre_kommentarendringer(p_kommentarer jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  kommentar jsonb;
  kommentar_id uuid;
begin
  if jsonb_typeof(p_kommentarer) is distinct from 'array' then
    raise exception 'Kommentarene må være en liste.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_kommentarer) > 50 then
    raise exception 'Høyst 50 kommentarer kan lagres sammen med et regelsett.' using errcode = '22023';
  end if;

  for kommentar in
    select e.v from jsonb_array_elements(p_kommentarer) with ordinality e(v, nr) order by e.nr
  loop
    if jsonb_typeof(kommentar) is distinct from 'object' then
      raise exception 'En kommentar må være et objekt.' using errcode = '22023';
    end if;
    perform intern.krev_felt(kommentar, array['id', 'revisjon', 'innhold']);
    kommentar_id := intern.id(kommentar, 'id');
    if jsonb_typeof(kommentar -> 'revisjon') = 'null' then
      perform intern.opprett_objekt('kommentar', kommentar_id, kommentar -> 'innhold');
    else
      if (select o.type from public.redigerbare_objekter o where o.id = kommentar_id) is distinct from 'kommentar' then
        raise exception 'Fant ikke kommentaren som skulle lagres.' using errcode = 'PT404';
      end if;
      perform public.lagre_utkast(kommentar_id, intern.heltall(kommentar, 'revisjon'), kommentar -> 'innhold');
    end if;
  end loop;
end;
$$;

create or replace function public.lagre_intervallregelsett(
  objekt uuid, forventet_revisjon integer, innhold jsonb, kommentarer jsonb
)
returns public.objektstatus
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_admin();
  if (select o.type from public.redigerbare_objekter o where o.id = objekt) is distinct from 'intervallregelsett' then
    raise exception 'Fant ikke regelsettet.' using errcode = 'PT404';
  end if;
  perform intern.lagre_kommentarendringer(kommentarer);
  return public.lagre_utkast(objekt, forventet_revisjon, innhold);
end;
$$;

create function public.lagre_scenarioregelsett(
  objekt uuid, forventet_revisjon integer, innhold jsonb, kommentarer jsonb
)
returns public.objektstatus
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform intern.krev_admin();
  if (select o.type from public.redigerbare_objekter o where o.id = objekt) is distinct from 'scenarioregelsett' then
    raise exception 'Fant ikke regelsettet.' using errcode = 'PT404';
  end if;
  perform intern.lagre_kommentarendringer(kommentarer);
  return public.lagre_utkast(objekt, forventet_revisjon, innhold);
end;
$$;

comment on function public.lagre_scenarioregelsett(uuid, integer, jsonb, jsonb) is
  'Lagrer et scenarioregelsett og de nye og endrede kommentarene det bruker, som utkast i én transaksjon. Avvises med PT409 hvis noen av revisjonene er endret. Krever administrator.';

-- --- Rettigheter -----------------------------------------------------------

revoke all on function public.lagre_scenarioregelsett(uuid, integer, jsonb, jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.lagre_scenarioregelsett(uuid, integer, jsonb, jsonb) to authenticated;

revoke all on function intern.lagre_kommentarendringer(jsonb)
from public, anon, authenticated, service_role;
