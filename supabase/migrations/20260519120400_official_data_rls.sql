alter table public.official_matchdays enable row level security;
alter table public.official_matches enable row level security;

drop policy if exists official_matchdays_select_auth on public.official_matchdays;
create policy official_matchdays_select_auth on public.official_matchdays
for select to authenticated
using (true);

drop policy if exists official_matches_select_auth on public.official_matches;
create policy official_matches_select_auth on public.official_matches
for select to authenticated
using (true);
