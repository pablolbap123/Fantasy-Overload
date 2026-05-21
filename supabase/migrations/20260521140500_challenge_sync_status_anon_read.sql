alter table public.challenge_sync_status enable row level security;

drop policy if exists challenge_sync_status_select_public on public.challenge_sync_status;
create policy challenge_sync_status_select_public on public.challenge_sync_status
for select to anon
using (true);
