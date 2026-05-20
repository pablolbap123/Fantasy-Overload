create table if not exists public.challenge_sync_status (
  id text primary key default 'overload-series',
  source_url text not null default 'https://challenge.place/c/68486e1155cbb0e036a0559f/stage/69de85f89e7d357d88be816c',
  status text not null default 'idle' check (status in ('idle', 'checking', 'ok', 'changed', 'error')),
  message text not null default 'Sincronizacion preparada.',
  snapshot_hash text,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.challenge_sync_status enable row level security;

drop policy if exists challenge_sync_status_select_auth on public.challenge_sync_status;
create policy challenge_sync_status_select_auth on public.challenge_sync_status
for select to authenticated
using (true);

insert into public.challenge_sync_status (id)
values ('overload-series')
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'challenge_sync_status'
  ) then
    alter publication supabase_realtime add table public.challenge_sync_status;
  end if;
end $$;
