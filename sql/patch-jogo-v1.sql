begin;
create schema if not exists patch_privado;
revoke all on schema patch_privado from public, anon;
grant usage on schema patch_privado to authenticated;
create table public.patch_estado(
 story_id uuid primary key references public.stories(id) on delete cascade,
 moedas integer not null default 40 check(moedas between 0 and 999999),
 necessidades jsonb not null,
 comodo text not null default 'sala' check(comodo in('sala','cozinha','banheiro','quarto','jardim','passeio')),
 roupa text,decoracao text,
 dia date not null default (now() at time zone 'UTC')::date,
 progresso jsonb not null default '{}'::jsonb,
 missao_resgatada boolean not null default false,
 presente_dia date,
 xp_hoje integer not null default 0 check(xp_hoje between 0 and 100),
 jogos_hoje integer not null default 0 check(jogos_hoje between 0 and 10),
 ultimas_acoes jsonb not null default '{}'::jsonb,
 atualizado_em timestamptz not null default now()
);
create table public.patch_inventario(
 story_id uuid not null references public.stories(id) on delete cascade,
 item_id text not null,comprado_em timestamptz not null default now(),primary key(story_id,item_id)
);
create table public.patch_partidas(
 id uuid primary key default gen_random_uuid(),story_id uuid not null references public.stories(id) on delete cascade,
 jogador_id uuid not null references auth.users(id) on delete cascade,
 tipo text not null check(tipo in('coracoes','memoria','estrelas','passeio')),
 desafio jsonb not null,iniciada_em timestamptz not null default now(),expira_em timestamptz not null default now()+interval '5 minutes',
 finalizada boolean not null default false,premio integer not null default 0 check(premio between 0 and 3)
);
create index patch_partidas_historia on public.patch_partidas(story_id,jogador_id,iniciada_em desc);
alter table public.patch_estado enable row level security;
alter table public.patch_inventario enable row level security;
alter table public.patch_partidas enable row level security;
revoke all on public.patch_estado,public.patch_inventario,public.patch_partidas from anon,authenticated;
grant select on public.patch_estado,public.patch_inventario,public.patch_partidas to authenticated;
create policy patch_estado_membros on public.patch_estado for select to authenticated using(public.cinema_sou_membro(story_id));
create policy patch_inventario_membros on public.patch_inventario for select to authenticated using(public.cinema_sou_membro(story_id));
create policy patch_partidas_proprias on public.patch_partidas for select to authenticated using(jogador_id=(select auth.uid()) and public.cinema_sou_membro(story_id));
create function patch_privado.autorizar(p_story uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin if auth.uid() is null or not exists(select 1 from public.story_members where story_id=p_story and user_id=auth.uid()) then raise exception 'Acesso negado ao Patch' using errcode='42501';end if;end $$;
create function patch_privado.catalogo() returns jsonb language sql immutable set search_path='' as $$
select '[{"id":"camiseta_rosa","nome":"Camiseta de coração","tipo":"roupa","preco":18},{"id":"pijama_lilas","nome":"Pijama das estrelas","tipo":"roupa","preco":24},{"id":"oculos_coracao","nome":"Óculos de coração","tipo":"roupa","preco":22},{"id":"laco_dourado","nome":"Laço dourado","tipo":"roupa","preco":28},{"id":"tapete_flor","nome":"Tapete de flor","tipo":"decoracao","preco":20},{"id":"almofada_lilas","nome":"Almofada lilás","tipo":"decoracao","preco":16},{"id":"vaso_rosa","nome":"Vaso com flores","tipo":"decoracao","preco":14}]'::jsonb $$;
create function patch_privado.iniciar(p_story uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.mascote_casal;
begin
 perform patch_privado.autorizar(p_story);perform pg_advisory_xact_lock(hashtextextended(p_story::text,0));
 select * into m from public.mascote_casal where story_id=p_story;
 if not exists(select 1 from public.patch_estado where story_id=p_story) then select * into m from public.mascote_casal_iniciar(p_story);end if;
 insert into public.patch_estado(story_id,necessidades) values(p_story,jsonb_build_object('fome',m.fome,'higiene',85,'sono',m.sono,'diversao',m.felicidade,'carinho',85)) on conflict do nothing;
end $$;
create function patch_privado.necessidades(s public.patch_estado,m public.mascote_casal) returns jsonb language plpgsql stable set search_path='' as $$
declare d double precision:=least(168,greatest(0,extract(epoch from now()-s.atualizado_em)/3600));legacy double precision;f double precision:=(s.necessidades->>'fome')::double precision;so double precision:=(s.necessidades->>'sono')::double precision;di double precision:=(s.necessidades->>'diversao')::double precision;hi double precision:=(s.necessidades->>'higiene')::double precision;ca double precision:=(s.necessidades->>'carinho')::double precision;dormindo boolean:=m.estado='dormindo';
begin
 if m.updated_at>s.atualizado_em+interval '1 millisecond' then
  legacy:=least(168,greatest(0,extract(epoch from now()-coalesce(m.necessidades_at,m.updated_at))/3600));
  f:=m.fome+legacy*(case when dormindo then 2 else 6 end);so:=m.sono+legacy*(case when dormindo then -18 else 5 end);di:=m.felicidade-legacy*(case when dormindo then 2 else 7 end);
 else f:=f+d*(case when dormindo then 2 else 6 end);so:=so+d*(case when dormindo then -18 else 5 end);di:=di-d*(case when dormindo then 2 else 7 end);end if;
 hi:=hi-d*(case when dormindo then 2 else 5 end);ca:=ca-d*(case when dormindo then 2 else 6 end);
 return jsonb_build_object('fome',least(100,greatest(0,f)),'higiene',least(100,greatest(0,hi)),'sono',least(100,greatest(0,so)),'diversao',least(100,greatest(0,di)),'carinho',least(100,greatest(0,ca)));
end $$;
create function patch_privado.visao(p_story uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.patch_estado;m public.mascote_casal;hoje date:=(now() at time zone 'UTC')::date;pr jsonb;inv jsonb;
begin
 perform patch_privado.autorizar(p_story);select * into strict s from public.patch_estado where story_id=p_story;select * into strict m from public.mascote_casal where story_id=p_story;
 select coalesce(jsonb_agg(item_id),'[]'::jsonb) into inv from public.patch_inventario where story_id=p_story;
 pr:=case when s.dia=hoje then s.progresso else '{}'::jsonb end;
 return jsonb_build_object('story_id',p_story,'nome',m.nome,'necessidades',patch_privado.necessidades(s,m),'experiencia',m.experiencia,'nivel',1+m.experiencia/100,'moedas',s.moedas,'dormindo',m.estado='dormindo','comodo',s.comodo,'roupa',s.roupa,'decoracao',s.decoracao,'inventario',inv,'catalogo',patch_privado.catalogo(),'dia',hoje,'progresso',pr,'missao_resgatada',s.dia=hoje and s.missao_resgatada,'presente_disponivel',s.presente_dia is distinct from hoje,'jogos_hoje',case when s.dia=hoje then s.jogos_hoje else 0 end,'xp_hoje',case when s.dia=hoje then s.xp_hoje else 0 end,'renova_em',((hoje+1)::timestamp at time zone 'UTC'),'servidor_em',now());
end $$;
create function patch_privado.ler(p_story uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform patch_privado.iniciar(p_story);return patch_privado.visao(p_story);end $$;
create function patch_privado.acao(p_story uuid,p_acao text,p_item text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.patch_estado;m public.mascote_casal;n jsonb;hoje date:=(now() at time zone 'UTC')::date;cool integer:=0;xp integer:=0;custo integer:=0;item jsonb;tipo text;ultimo double precision;agora double precision:=extract(epoch from now());progresso integer;
begin
 perform patch_privado.iniciar(p_story);select * into strict s from public.patch_estado where story_id=p_story for update;select * into strict m from public.mascote_casal where story_id=p_story for update;n:=patch_privado.necessidades(s,m);
 if s.dia<>hoje then s.dia:=hoje;s.progresso:='{}';s.missao_resgatada:=false;s.xp_hoje:=0;s.jogos_hoje:=0;end if;
 if p_acao is null or p_acao not in('comodo','alimentar','banho','carinho','brincar','dancar','dormir','acordar','regar','comprar','vestir','decorar','presente','missao') then raise exception 'Ação inválida';end if;
 if m.estado='dormindo' and p_acao in('alimentar','banho','carinho','brincar','dancar','regar') then raise exception 'O Patch está dormindo. Acorde antes de cuidar dele.';end if;
 cool:=case p_acao when 'alimentar' then 15 when 'banho' then 45 when 'carinho' then 15 when 'brincar' then 30 when 'dancar' then 30 when 'regar' then 45 else 0 end;
 ultimo:=coalesce((s.ultimas_acoes->>p_acao)::double precision,0);
 if cool>0 and agora-ultimo<cool then raise exception 'Espere % segundos para repetir este cuidado',ceil(cool-(agora-ultimo));end if;
 if p_acao='comodo' then
  if p_item is null or p_item not in('sala','cozinha','banheiro','quarto','jardim','passeio') then raise exception 'Cômodo inválido';end if;s.comodo:=p_item;
 elsif p_acao='alimentar' then
  if p_item is null or p_item not in('cenoura','maca','leite') then raise exception 'Alimento inválido';end if;
  if (n->>'fome')::numeric<8 then raise exception 'O Patch já está satisfeito.';end if;
  custo:=case p_item when 'leite' then 2 else 1 end;n:=n||jsonb_build_object('fome',greatest(0,(n->>'fome')::numeric-25),'diversao',least(100,(n->>'diversao')::numeric+3));xp:=4;
 elsif p_acao='banho' then custo:=1;n:=n||jsonb_build_object('higiene',least(100,(n->>'higiene')::numeric+45),'carinho',least(100,(n->>'carinho')::numeric+4));xp:=5;
 elsif p_acao='carinho' then n:=n||jsonb_build_object('carinho',least(100,(n->>'carinho')::numeric+18),'diversao',least(100,(n->>'diversao')::numeric+5));xp:=2;
 elsif p_acao in('brincar','dancar') then n:=n||jsonb_build_object('diversao',least(100,(n->>'diversao')::numeric+18),'fome',least(100,(n->>'fome')::numeric+4),'sono',least(100,(n->>'sono')::numeric+4));xp:=3;
 elsif p_acao='dormir' then m.estado:='dormindo';s.comodo:='quarto';
 elsif p_acao='acordar' then m.estado:='feliz';
 elsif p_acao='regar' then n:=n||jsonb_build_object('diversao',least(100,(n->>'diversao')::numeric+7),'higiene',greatest(0,(n->>'higiene')::numeric-2));xp:=2;
 elsif p_acao='comprar' then
  select v into item from jsonb_array_elements(patch_privado.catalogo()) v where v->>'id'=p_item;
  if item is null then raise exception 'Item inválido';end if;
  if exists(select 1 from public.patch_inventario where story_id=p_story and item_id=p_item) then raise exception 'Este item já está no inventário';end if;
  custo:=(item->>'preco')::integer;
 elsif p_acao in('vestir','decorar') then
  tipo:=case p_acao when 'vestir' then 'roupa' else 'decoracao' end;
  if p_item='padrao' then if p_acao='vestir' then s.roupa:=null;else s.decoracao:=null;end if;
  else
   select v into item from jsonb_array_elements(patch_privado.catalogo()) v where v->>'id'=p_item and v->>'tipo'=tipo;
   if item is null or not exists(select 1 from public.patch_inventario where story_id=p_story and item_id=p_item) then raise exception 'Item não adquirido';end if;
   if p_acao='vestir' then s.roupa:=p_item;else s.decoracao:=p_item;end if;
  end if;
 elsif p_acao='presente' then
  if s.presente_dia=hoje then raise exception 'Presente de hoje já resgatado';end if;s.presente_dia:=hoje;s.moedas:=s.moedas+8;
 elsif p_acao='missao' then
  if s.missao_resgatada or coalesce((s.progresso->>'alimentar')::int,0)<1 or coalesce((s.progresso->>'banho')::int,0)<1 or coalesce((s.progresso->>'carinho')::int,0)<1 then raise exception 'Complete os três cuidados de hoje antes de resgatar';end if;
  s.missao_resgatada:=true;s.moedas:=s.moedas+10;xp:=10;
 end if;
 if custo>s.moedas then raise exception 'Moedas do Patch insuficientes';end if;s.moedas:=s.moedas-custo;
 if p_acao='comprar' then insert into public.patch_inventario(story_id,item_id) values(p_story,p_item);end if;
 if cool>0 then s.ultimas_acoes:=s.ultimas_acoes||jsonb_build_object(p_acao,agora);s.progresso:=s.progresso||jsonb_build_object(p_acao,coalesce((s.progresso->>p_acao)::integer,0)+1);end if;
 xp:=least(xp,100-s.xp_hoje);s.xp_hoje:=s.xp_hoje+xp;
 update public.mascote_casal set fome=round((n->>'fome')::numeric)::integer,sono=round((n->>'sono')::numeric)::integer,felicidade=round((n->>'diversao')::numeric)::integer,energia=100-round((n->>'sono')::numeric)::integer,experiencia=m.experiencia+xp,nivel=1+(m.experiencia+xp)/100,estado=m.estado,updated_at=now(),necessidades_at=now(),updated_by=auth.uid() where story_id=p_story;
 update public.patch_estado set moedas=s.moedas,necessidades=n,comodo=s.comodo,roupa=s.roupa,decoracao=s.decoracao,dia=s.dia,progresso=s.progresso,missao_resgatada=s.missao_resgatada,presente_dia=s.presente_dia,xp_hoje=s.xp_hoje,jogos_hoje=s.jogos_hoje,ultimas_acoes=s.ultimas_acoes,atualizado_em=now() where story_id=p_story;
 return patch_privado.visao(p_story);
end $$;
create function patch_privado.partida_iniciar(p_story uuid,p_tipo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.patch_estado;j public.patch_partidas;d jsonb;hoje date:=(now() at time zone 'UTC')::date;
begin
 perform patch_privado.iniciar(p_story);select * into strict s from public.patch_estado where story_id=p_story for update;
 if p_tipo is null or p_tipo not in('coracoes','memoria','estrelas','passeio') then raise exception 'Minijogo inválido';end if;
 if exists(select 1 from public.mascote_casal where story_id=p_story and estado='dormindo') then raise exception 'Acorde o Patch antes de jogar';end if;
 if s.dia=hoje and s.jogos_hoje>=10 then raise exception 'As 10 recompensas de jogos de hoje já foram recebidas. Volte amanhã.';end if;
 if exists(select 1 from public.patch_partidas where story_id=p_story and jogador_id=auth.uid() and iniciada_em>now()-interval '5 seconds') then raise exception 'Aguarde um instante para começar outra partida';end if;
 if p_tipo='memoria' then select jsonb_build_object('cartas',jsonb_agg(v)) into d from(select v from unnest(array[0,0,1,1,2,2]) v order by random()) q;
 elsif p_tipo='coracoes' then select jsonb_build_object('alvos',jsonb_agg(jsonb_build_object('id',i,'x',round((.15+random()*.7)::numeric,3),'inicio',i*1100,'duracao',3000)),'duracao',12000) into d from generate_series(0,7) i;
 elsif p_tipo='estrelas' then d:='{"tempos":[2000,3600,5200,6800,8400,10000,11600],"duracao":12500}'::jsonb;
 else d:='{"alvos":[{"id":0,"x":0.2,"inicio":1000,"duracao":6000},{"id":1,"x":0.75,"inicio":5000,"duracao":6000},{"id":2,"x":0.45,"inicio":9000,"duracao":6000}],"duracao":15000}'::jsonb;end if;
 update public.patch_partidas set finalizada=true where story_id=p_story and jogador_id=auth.uid() and not finalizada;
 insert into public.patch_partidas(story_id,jogador_id,tipo,desafio) values(p_story,auth.uid(),p_tipo,d) returning * into j;
 return jsonb_build_object('id',j.id,'tipo',j.tipo,'desafio',j.desafio,'iniciada_em',j.iniciada_em,'expira_em',j.expira_em);
end $$;
create function patch_privado.partida_finalizar(p_partida uuid,p_resposta jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.patch_partidas;s public.patch_estado;m public.mascote_casal;hoje date:=(now() at time zone 'UTC')::date;elapsed numeric;acertos integer:=0;ids integer[]:='{}';a jsonb;b jsonb;v jsonb;idx integer;at_ms numeric;previous_ms numeric:=-10000;i integer;ia integer;ib integer;matched integer[]:='{}';xp integer;n jsonb;
begin
 if auth.uid() is null then raise exception 'Acesso negado' using errcode='42501';end if;
 select * into j from public.patch_partidas where id=p_partida;
 if not found or j.jogador_id<>auth.uid() then raise exception 'Partida indisponível' using errcode='42501';end if;
 perform patch_privado.autorizar(j.story_id);perform pg_advisory_xact_lock(hashtextextended(j.story_id::text,0));
 select * into strict s from public.patch_estado where story_id=j.story_id for update;select * into strict j from public.patch_partidas where id=p_partida for update;
 if j.finalizada then return jsonb_build_object('repetido',true,'premio',j.premio,'estado',patch_privado.visao(j.story_id));end if;
 if now()>j.expira_em then raise exception 'A partida expirou';end if;
 if p_resposta is null or jsonb_typeof(p_resposta)<>'array' or jsonb_array_length(p_resposta)>60 then raise exception 'Registro de partida inválido';end if;
 elapsed:=extract(epoch from now()-j.iniciada_em)*1000;
 if j.tipo='memoria' then
  if elapsed<6000 or jsonb_array_length(p_resposta)<3 then raise exception 'Partida rápida demais';end if;
  for v in select value from jsonb_array_elements(p_resposta) loop
   ia:=(v->>0)::integer;ib:=(v->>1)::integer;
   if ia is null or ib is null or ia<0 or ia>5 or ib<0 or ib>5 or ia=ib or ia=any(matched) or ib=any(matched) then raise exception 'Jogada inválida';end if;
   if j.desafio->'cartas'->ia=j.desafio->'cartas'->ib then matched:=matched||array[ia,ib];end if;
  end loop;
  if cardinality(matched)=6 then acertos:=6;end if;
 elsif j.tipo in('coracoes','passeio') then
  if elapsed<(j.desafio->>'duracao')::numeric-600 then raise exception 'A atividade ainda não terminou';end if;
  for v in select value from jsonb_array_elements(p_resposta) loop
   idx:=(v->>'id')::integer;at_ms:=(v->>'em')::numeric;
   select value into a from jsonb_array_elements(j.desafio->'alvos') where (value->>'id')::integer=idx;
   if a is null or idx=any(ids) or at_ms is null or at_ms<(a->>'inicio')::numeric or at_ms>(a->>'inicio')::numeric+(a->>'duracao')::numeric+250 or at_ms>elapsed+250 then raise exception 'Coleta inválida';end if;
   ids:=ids||idx;acertos:=acertos+1;
  end loop;
 else
  if elapsed<12000 then raise exception 'A atividade ainda não terminou';end if;
  for v in select value from jsonb_array_elements(p_resposta) loop at_ms:=v::text::numeric;if at_ms<0 or at_ms>12500 or at_ms-previous_ms<650 then raise exception 'Salto inválido';end if;previous_ms:=at_ms;end loop;
  for a in select value from jsonb_array_elements(j.desafio->'tempos') loop
   if exists(select 1 from jsonb_array_elements(p_resposta) x where x::text::numeric between a::text::numeric-600 and a::text::numeric-80) then acertos:=acertos+1;end if;
  end loop;
 end if;
 if s.dia<>hoje then s.dia:=hoje;s.progresso:='{}';s.missao_resgatada:=false;s.xp_hoje:=0;s.jogos_hoje:=0;end if;
 j.premio:=case when s.jogos_hoje>=10 then 0 when j.tipo='memoria' and acertos=6 then 3 when j.tipo in('coracoes','estrelas') and acertos>=5 then 3 when j.tipo='passeio' and acertos=3 then 1 else 0 end;
 update public.patch_partidas set finalizada=true,premio=j.premio where id=j.id;
 if j.premio>0 then
  select * into strict m from public.mascote_casal where story_id=j.story_id for update;n:=patch_privado.necessidades(s,m);xp:=least(6,100-s.xp_hoje);
  n:=n||jsonb_build_object('diversao',least(100,(n->>'diversao')::numeric+15),'sono',least(100,(n->>'sono')::numeric+4));
  update public.patch_estado set moedas=moedas+j.premio,jogos_hoje=s.jogos_hoje+1,xp_hoje=s.xp_hoje+xp,dia=s.dia,progresso=s.progresso||jsonb_build_object('jogos',coalesce((s.progresso->>'jogos')::integer,0)+1),missao_resgatada=s.missao_resgatada,necessidades=n,atualizado_em=now() where story_id=j.story_id;
  update public.mascote_casal set experiencia=experiencia+xp,nivel=1+(experiencia+xp)/100,felicidade=round((n->>'diversao')::numeric),fome=round((n->>'fome')::numeric),sono=round((n->>'sono')::numeric),energia=100-round((n->>'sono')::numeric),updated_at=now(),necessidades_at=now(),updated_by=auth.uid() where story_id=j.story_id;
 end if;
 return jsonb_build_object('premio',j.premio,'acertos',acertos,'estado',patch_privado.visao(j.story_id));
end $$;
create function public.patch_ler(p_story uuid) returns jsonb language sql security invoker set search_path='' as $$ select patch_privado.ler(p_story) $$;
create function public.patch_acao(p_story uuid,p_acao text,p_item text default null) returns jsonb language sql security invoker set search_path='' as $$ select patch_privado.acao(p_story,p_acao,p_item) $$;
create function public.patch_partida_iniciar(p_story uuid,p_tipo text) returns jsonb language sql security invoker set search_path='' as $$ select patch_privado.partida_iniciar(p_story,p_tipo) $$;
create function public.patch_partida_finalizar(p_partida uuid,p_resposta jsonb) returns jsonb language sql security invoker set search_path='' as $$ select patch_privado.partida_finalizar(p_partida,p_resposta) $$;
revoke all on all functions in schema patch_privado from public,anon;
grant execute on all functions in schema patch_privado to authenticated;
revoke all on function public.patch_ler(uuid),public.patch_acao(uuid,text,text),public.patch_partida_iniciar(uuid,text),public.patch_partida_finalizar(uuid,jsonb) from public,anon;
grant execute on function public.patch_ler(uuid),public.patch_acao(uuid,text,text),public.patch_partida_iniciar(uuid,text),public.patch_partida_finalizar(uuid,jsonb) to authenticated;
-- Realtime é opcional: o cliente também confirma o estado por polling.
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='patch_estado') then alter publication supabase_realtime add table public.patch_estado;end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='patch_inventario') then alter publication supabase_realtime add table public.patch_inventario;end if;
end if;end $$;
commit;
