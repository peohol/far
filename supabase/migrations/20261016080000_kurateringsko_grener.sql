-- Kurateringskøen følger kurateringsgrenene i OUSFAR (docs/kurateringsko.md,
-- «Kurateringsgrenene»): køen leser hver gren med stoff, art, status,
-- revisjon, kontrollrunde og tidspunktene, aldri fagtekst eller formål.
-- Bare serveren kan kalle den (tjenesterollen, fra `/api/kuratering-ko`, som
-- slipper inn arbeidsflyten «Kurateringskø» på main med GitHubs OIDC-token).

create function public.kuratering_kostatus()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'stoff', g.stoff,
    'art', g.art,
    'status', g.status,
    'revisjon', g.revisjon,
    'runde', g.runde,
    'oppdatert_kl', g.oppdatert_kl,
    'publisert_kl', g.publisert_kl
  ) order by g.opprettet_kl), '[]'::jsonb)
  from kuratering.grener g
$$;

comment on function public.kuratering_kostatus() is
  'Kurateringsgrenene slik kurateringskøen følger dem: ingen fagtekst. Bare for serveren (docs/kurateringsko.md).';

revoke all on function public.kuratering_kostatus() from public, anon, authenticated, service_role;
grant execute on function public.kuratering_kostatus() to service_role;
