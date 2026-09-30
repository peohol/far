-- Diskusjoner: tråder kan slettes, og flyttes til en annen side.
--
-- Den som startet en tråd, kan slette den så lenge ingen andre har skrevet
-- noe i den og den ikke er arkivert. En administrator kan slette alle tråder,
-- også de arkiverte. Kommentarene, hjertene, besøkene og varslene om tråden
-- går med.
--
-- En tråd som står på feil side, kan flyttes til en annen, i en kategori der
-- eller i en ny. Alle innloggede kan gjøre det, som med flyttingene ellers,
-- men ikke med en arkivert tråd. Kommentarene og hjertene følger med.

comment on table public.diskusjoner is
  'Trådene på fagsidene og fortolkningssidene. Kan arkiveres, og slettes av den som startet dem før andre har skrevet i dem, eller av en administrator. Skrives gjennom funksjonene.';

-- Om tråden bare har innlegg fra den som startet den. Kommentarer som står
-- igjen som «Slettet», har ingen forfatter og teller ikke.
create function intern.diskusjon_bare_egne(diskusjon uuid, bruker uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.diskusjonskommentarer k
    where k.diskusjon_id = diskusjon_bare_egne.diskusjon
      and not k.slettet
      and k.forfatter_id is distinct from diskusjon_bare_egne.bruker
  )
$$;

-- Sletter tråden, med alt i den.
create function public.slett_diskusjon(diskusjon uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bruker uuid := intern.krev_innlogget();
  traad public.diskusjoner%rowtype;
begin
  select * into traad from public.diskusjoner d where d.id = slett_diskusjon.diskusjon for update;
  if traad.id is null then
    raise exception 'Tråden finnes ikke lenger.' using errcode = 'P0002';
  end if;
  if not public.er_admin() and not (
    traad.forfatter_id = bruker
    and traad.arkivert_kl is null
    and intern.diskusjon_bare_egne(traad.id, bruker)
  ) then
    raise exception 'Du kan bare slette en tråd du har startet selv, før andre har skrevet i den.' using errcode = '42501';
  end if;
  delete from public.diskusjoner d where d.id = traad.id;
  if traad.arkivert_kl is null then
    perform intern.ordne_diskusjoner(traad.side, traad.kategori_id);
  end if;
end;
$$;

comment on function public.slett_diskusjon(uuid) is
  'Sletter tråden med kommentarene. Den som startet den, før andre har skrevet i den; en administrator alltid.';

-- Flytter tråden sist i en kategori på en annen side. Med `ny_kategori` og
-- `ny_emoji` lages kategorien der, og `kategori` er uten betydning.
create function public.flytt_diskusjon_til_side(
  diskusjon uuid,
  side text,
  kategori uuid,
  ny_kategori text default null,
  ny_emoji text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  traad public.diskusjoner%rowtype;
  valgt uuid := flytt_diskusjon_til_side.kategori;
begin
  perform intern.krev_innlogget();
  select * into traad from public.diskusjoner d where d.id = flytt_diskusjon_til_side.diskusjon for update;
  if traad.id is null or traad.arkivert_kl is not null then
    raise exception 'Tråden er arkivert eller finnes ikke.' using errcode = '42501';
  end if;
  if traad.side = flytt_diskusjon_til_side.side then
    raise exception 'Tråden står alt på den siden.' using errcode = '22023';
  end if;
  if flytt_diskusjon_til_side.ny_kategori is not null then
    valgt := public.opprett_diskusjonskategori(
      flytt_diskusjon_til_side.side,
      flytt_diskusjon_til_side.ny_kategori,
      coalesce(flytt_diskusjon_til_side.ny_emoji, '')
    );
  elsif not exists (
    select 1 from public.diskusjonskategorier k where k.id = valgt and k.side = flytt_diskusjon_til_side.side
  ) then
    raise exception 'Velg en kategori på siden tråden skal flyttes til.' using errcode = '23503';
  end if;

  update public.diskusjoner d
  set side = flytt_diskusjon_til_side.side, kategori_id = valgt
  where d.id = traad.id;
  perform intern.ordne_diskusjoner(flytt_diskusjon_til_side.side, valgt, traad.id, null);
  perform intern.ordne_diskusjoner(traad.side, traad.kategori_id);
end;
$$;

comment on function public.flytt_diskusjon_til_side(uuid, text, uuid, text, text) is
  'Flytter tråden sist i en kategori på en annen side, eventuelt i en ny kategori der.';

revoke all on function
  public.slett_diskusjon(uuid),
  public.flytt_diskusjon_til_side(uuid, text, uuid, text, text)
from public, anon, authenticated, service_role;

grant execute on function
  public.slett_diskusjon(uuid),
  public.flytt_diskusjon_til_side(uuid, text, uuid, text, text)
to authenticated;

revoke all on all functions in schema intern from public, anon, authenticated, service_role;
