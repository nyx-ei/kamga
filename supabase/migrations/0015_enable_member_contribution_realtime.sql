-- Ticket #17: publish member contribution changes for Supabase Realtime progress refresh.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'member_contributions'
    )
  then
    alter publication supabase_realtime add table public.member_contributions;
  end if;
end
$$;
