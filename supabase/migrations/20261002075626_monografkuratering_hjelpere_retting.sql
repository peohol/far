-- Retting av to hjelpefunksjoner for monografkurateringer
-- (`*_monografkuratering_hjelpere.sql`, `docs/monografkuratering.md`).
--
--   * `kuratering_start` hopper nå over på en helt fersk database, der ingen
--     profiler finnes ennå, også når siden er laget av en tidligere migrasjon.
--     Finnes det profiler, men ikke kuratoren, stopper den fortsatt når siden
--     finnes, så produksjonen aldri hopper over en kuratering i stillhet.
--   * `kuratering_referanse` regner også utkast med: en referanse med samme
--     lenke som bare finnes som utkast, eller med en upublisert arkivering,
--     stopper migrasjonen i stedet for at det publiseres en referanse til ved
--     siden av.

create or replace function intern.kuratering_start(p_slug text, p_kurator text default 'peohol')
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  kurator uuid;
  side uuid;
begin
  select p.id into kurator from public.profiles p where p.username = p_kurator and p.role = 'admin';
  select s.objekt_id into side from public.infosider s where s.tilstand = 'publisert' and s.slug = p_slug;

  if kurator is null then
    if side is not null and exists (select 1 from public.profiles) then
      raise exception 'Stoffsiden «%» finnes, men ikke administratoren %, som kurateringen føres på.', p_slug, p_kurator;
    end if;
    raise notice 'Fant ingen administrator %, så kurateringen av «%» hoppes over.', p_kurator, p_slug;
    return null;
  end if;
  if side is null then
    raise exception 'Fant ingen publisert stoffside med nøkkelen «%».', p_slug;
  end if;

  -- Ingen andre kan legge til, endre eller fjerne elementer eller referanser
  -- før kurateringen er ferdig, så det preflighten fant, står til den er
  -- skrevet. Lesing går som før.
  lock table public.innholdselementer, public.referanser in share row exclusive mode;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', kurator, 'role', 'authenticated')::text, true);
  return side;
end;
$$;

comment on function intern.kuratering_start(text, text) is
  'Logger inn som kuratoren, låser elementene og referansene mot andre endringer til migrasjonen er ferdig, og gir den publiserte stoffsiden med nøkkelen. Null uten kuratorprofil; feil om siden finnes og andre profiler finnes, men ikke kuratoren.';

create or replace function intern.kuratering_referanse(p_innhold jsonb, p_kilde text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  treff uuid[];
begin
  if nullif(btrim(p_kilde), '') is null then
    raise exception 'En kuratering må ha en kilde i historikken.';
  end if;
  if coalesce(p_innhold->>'lenke', '') = '' then
    raise exception 'En kilde i en kuratering må ha en lenke.';
  end if;
  -- Utkast og publiserte sammen: en referanse som bare finnes som utkast, er
  -- også redaksjonelt arbeid kurateringen ikke skal gå forbi. En referanse
  -- som er arkivert både i utkastet og publisert, er lagt bort og telles ikke.
  select array_agg(distinct r.objekt_id) into treff
  from public.referanser r
  where r.lenke = p_innhold->>'lenke' and not r.arkivert;

  if cardinality(treff) > 1 then
    raise exception 'Lenken % står på % referanser. Duplikatene må avklares først.', p_innhold->>'lenke', cardinality(treff);
  end if;
  if cardinality(treff) = 1 then
    if not exists (select 1 from public.referanser r where r.objekt_id = treff[1] and r.tilstand = 'publisert')
      or exists (select 1 from public.referanser r where r.objekt_id = treff[1] and r.arkivert) then
      raise exception 'Lenken % står på en referanse som bare finnes som utkast, eller som er i ferd med å arkiveres eller hentes fram. Den må avklares først.',
        p_innhold->>'lenke';
    end if;
    return treff[1];
  end if;

  perform set_config('far.revisjonskilde', p_kilde, true);
  treff := array[(public.opprett_utkast('referanse', p_innhold)).id];
  perform public.publiser_utkast(treff[1], 1);
  return treff[1];
end;
$$;

comment on function intern.kuratering_referanse(jsonb, text) is
  'Den publiserte referansen med lenken, eller en ny, publisert referanse. Stopper hvis lenken står på flere (utkast medregnet), eller på en som bare er utkast eller har en upublisert arkivering.';

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
