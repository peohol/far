-- Stenger triggerfunksjonen for kall utenfra.
--
-- `handter_ny_auth_bruker()` kjører som eier (`security definer`) fordi den
-- skal kunne skrive i profiltabellen. Postgres gir som standard alle roller
-- rett til å kjøre nye funksjoner, og da dukker den opp som et kallbart
-- endepunkt i data-API-et. Et slikt kall ville uansett blitt avvist —
-- triggerfunksjoner kan bare kjøres av en trigger — men rettigheten har
-- ingenting der å gjøre, og sikkerhetsrådgiveren i Supabase sier fra om den.

revoke all on function public.handter_ny_auth_bruker() from public, anon, authenticated;
