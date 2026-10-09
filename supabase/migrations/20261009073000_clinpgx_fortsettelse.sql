-- ClinPGx: én kjøring kan gå over flere omganger.
--
-- Hver omgang er ett kall til /api/clinpgx-synk, som Vercel stopper etter 300
-- sekunder. Rekker ikke omgangen alle de koblede kjemikaliene, avsluttes
-- kjøringen som `delvis` med resten utsatt, og neste omgang fortsetter den samme
-- kjøringen med kjemikaliene den ikke har hentet ennå (docs/clinpgx.md).
--
-- Bare utvidelser: en ny funksjon, og en funksjon byttet ut med samme signatur
-- og samme svar som før, pluss ett felt. Ingenting slettes.
--
-- En kjøring står `pagar` bare mens en omgang pågår, og alle omgangene til
-- sammen holdes under en halvtime (høyst seks omganger på rundt fire minutter),
-- så grensen på en halvtime i `clinpgx_start_synk` og i «Datakilder» gjelder
-- fortsatt hele kjøringen.

-- Som før, med `sist_synk`: kjøringen som sist hentet kjemikaliet eller noterte
-- en feil på det. En omgang som fortsetter en kjøring, hopper over dem.
create or replace function public.clinpgx_koblede_kjemikalier()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with koblet as (
    select k ->> 'clinpgx_id' as id, min(k ->> 'navn') as navn
    from public.innholdselementer e,
         jsonb_array_elements(case when jsonb_typeof(e.data -> 'kjemikalier') = 'array' then e.data -> 'kjemikalier' else '[]' end) k
    where e.elementtype = 'clinpgxkobling'
      and e.panel <> 'fjernet'
      and k ->> 'clinpgx_id' ~ '^PA[0-9]+$'
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'navn', k.navn, 'sist_hentet_kl', c.sist_hentet_kl, 'sist_synk', c.sist_synk)
                            order by c.sist_hentet_kl nulls first, k.id), '[]')
  from koblet k
  left join clinpgx.kjemikalier c on c.clinpgx_id = k.id
$$;

-- Åpner en kjøring som ble avsluttet med kjemikalier utsatt, for neste omgang,
-- og gir tellingen så langt. Bare den nyeste kjøringen, og bare innen en time:
-- har en annen kjøring startet etterpå, eller har det gått lenger, er det den
-- nye kjøringen som gjelder.
create function public.clinpgx_fortsett_synk(synk bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s clinpgx.synkroniseringer;
begin
  select * into s from clinpgx.synkroniseringer where id = synk for update;
  if not found then
    raise exception 'Synkroniseringen % finnes ikke.', synk using errcode = 'PT404';
  end if;
  if s.status <> 'delvis' or coalesce((s.antall ->> 'utsatt')::integer, 0) = 0 then
    raise exception 'Synkroniseringen % har ingen utsatte kjemikalier å fortsette med.', synk using errcode = 'PT409';
  end if;
  if exists (select 1 from clinpgx.synkroniseringer n where n.id > synk) then
    raise exception 'En nyere synkronisering fra ClinPGx har startet etter %.', synk using errcode = 'PT409';
  end if;
  if s.avsluttet_kl < now() - interval '1 hour' then
    raise exception 'Synkroniseringen % ble avsluttet for over en time siden; start en ny.', synk using errcode = 'PT409';
  end if;

  update clinpgx.synkroniseringer
  set status = 'pagar', avsluttet_kl = null
  where id = synk;
  return s.antall;
end;
$$;

revoke all on function public.clinpgx_fortsett_synk(bigint) from public, anon, authenticated, service_role;
grant execute on function public.clinpgx_fortsett_synk(bigint) to service_role;
