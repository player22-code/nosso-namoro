-- Preferências individuais. Não contém fotos, tokens nem dados de pagamento.
begin;
create table public.nh_preferencias_usuario (
 user_id uuid primary key references auth.users(id) on delete cascade,
 config jsonb not null default '{}'::jsonb check (jsonb_typeof(config)='object' and octet_length(config::text)<=16384),
 updated_at timestamptz not null default now()
);
alter table public.nh_preferencias_usuario enable row level security;
revoke all on public.nh_preferencias_usuario from anon, authenticated;
grant select, insert, update on public.nh_preferencias_usuario to authenticated;
create policy preferencias_select_proprias on public.nh_preferencias_usuario for select to authenticated using ((select auth.uid())=user_id);
create policy preferencias_insert_proprias on public.nh_preferencias_usuario for insert to authenticated with check ((select auth.uid())=user_id);
create policy preferencias_update_proprias on public.nh_preferencias_usuario for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
alter table public.voz_chamadas add column media_type text not null default 'audio' check (media_type in ('audio','video'));
commit;
