begin;
-- Trocar efetivamente de cômodo acorda; calcula o descanso antes de acordar.
create or replace function patch_privado.visao(p_story uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.patch_estado;m public.mascote_casal;hoje date:=(now() at time zone 'UTC')::date;pr jsonb;inv jsonb;esperas jsonb;
begin
 perform patch_privado.autorizar(p_story);select * into strict s from public.patch_estado where story_id=p_story;select * into strict m from public.mascote_casal where story_id=p_story;
 select coalesce(jsonb_agg(item_id),'[]'::jsonb) into inv from public.patch_inventario where story_id=p_story;
 select coalesce(jsonb_object_agg(k,greatest(0,ceil((s.ultimas_acoes->>k)::numeric+dur-extract(epoch from now())))),'{}'::jsonb) into esperas from(values('alimentar',15),('banho',45),('carinho',15),('brincar',30),('dancar',30),('regar',45)) t(k,dur) where s.ultimas_acoes ? k;
 pr:=case when s.dia=hoje then s.progresso else '{}'::jsonb end;
 return jsonb_build_object('story_id',p_story,'nome',m.nome,'necessidades',patch_privado.necessidades(s,m),'experiencia',m.experiencia,'nivel',1+m.experiencia/100,'moedas',s.moedas,'dormindo',m.estado='dormindo','comodo',s.comodo,'roupa',s.roupa,'decoracao',s.decoracao,'inventario',inv,'catalogo',patch_privado.catalogo(),'dia',hoje,'progresso',pr,'missao_resgatada',s.dia=hoje and s.missao_resgatada,'presente_disponivel',s.presente_dia is distinct from hoje,'jogos_hoje',case when s.dia=hoje then s.jogos_hoje else 0 end,'xp_hoje',case when s.dia=hoje then s.xp_hoje else 0 end,'renova_em',((hoje+1)::timestamp at time zone 'UTC'),'servidor_em',now(),'esperas',esperas,'alimentos',s.alimentos,'catalogo_alimentos',patch_privado.alimentos_catalogo(),'recompensas_cuidados',case when s.dia_cuidados=hoje then s.recompensas_cuidados else 0 end,'limite_cuidados',30);
end $$;
create or replace function patch_privado.acao(p_story uuid,p_acao text,p_item text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.patch_estado;m public.mascote_casal;n jsonb;hoje date:=(now() at time zone 'UTC')::date;cool integer:=0;xp integer:=0;custo integer:=0;item jsonb;tipo text;ultimo double precision;agora double precision:=extract(epoch from now());progresso integer;premio integer:=0;quantidade integer;
begin
 perform patch_privado.iniciar(p_story);select * into strict s from public.patch_estado where story_id=p_story for update;select * into strict m from public.mascote_casal where story_id=p_story for update;n:=patch_privado.necessidades(s,m);
 if s.dia_cuidados<>hoje then s.dia_cuidados:=hoje;s.recompensas_cuidados:=0;end if;
 if s.dia<>hoje then s.dia:=hoje;s.progresso:='{}';s.missao_resgatada:=false;s.xp_hoje:=0;s.jogos_hoje:=0;end if;
 if p_acao is null or p_acao not in('comodo','alimentar','banho','carinho','brincar','dancar','dormir','acordar','regar','comprar','comprar_comida','vestir','decorar','presente','missao') then raise exception 'Ação inválida';end if;
 if m.estado='dormindo' and p_acao in('alimentar','banho','carinho','brincar','dancar','regar') then raise exception 'O Patch está dormindo. Acorde antes de cuidar dele.';end if;
 cool:=case p_acao when 'alimentar' then 15 when 'banho' then 45 when 'carinho' then 15 when 'brincar' then 30 when 'dancar' then 30 when 'regar' then 45 else 0 end;
 ultimo:=coalesce((s.ultimas_acoes->>p_acao)::double precision,0);
 if cool>0 and agora-ultimo<cool then raise exception 'Espere % segundos para repetir este cuidado',ceil(cool-(agora-ultimo));end if;
 if p_acao='comodo' then
  if p_item is null or p_item not in('sala','cozinha','banheiro','quarto','jardim','passeio') then raise exception 'Cômodo inválido';end if;
  if p_item<>s.comodo and m.estado='dormindo' then m.estado:='feliz';end if;
  s.comodo:=p_item;
 elsif p_acao='comprar_comida' then
  select value into item from jsonb_array_elements(patch_privado.alimentos_catalogo()) where value->>'id'=p_item;
  if item is null then raise exception 'Alimento inválido';end if;
  quantidade:=coalesce((s.alimentos->>p_item)::integer,0);
  if quantidade>=99 then raise exception 'Você já tem o estoque máximo deste alimento';end if;
  custo:=(item->>'preco')::integer;
  s.alimentos:=s.alimentos||jsonb_build_object(p_item,quantidade+1);
 elsif p_acao='alimentar' then
  select value into item from jsonb_array_elements(patch_privado.alimentos_catalogo()) where value->>'id'=p_item;
  if item is null then raise exception 'Alimento inválido';end if;
  quantidade:=coalesce((s.alimentos->>p_item)::integer,0);
  if quantidade<1 then raise exception 'Este alimento acabou. Compre mais na aba Comidas.';end if;
  if (n->>'fome')::numeric<8 then raise exception 'O Patch já está satisfeito.';end if;
  s.alimentos:=s.alimentos||jsonb_build_object(p_item,quantidade-1);
  n:=n||jsonb_build_object('fome',greatest(0,(n->>'fome')::numeric-(item->>'saciedade')::integer),'diversao',least(100,(n->>'diversao')::numeric+3));xp:=4;premio:=2;
 elsif p_acao='banho' then
  if (n->>'higiene')::numeric<85 then premio:=2;end if;
  n:=n||jsonb_build_object('higiene',least(100,(n->>'higiene')::numeric+45),'carinho',least(100,(n->>'carinho')::numeric+4));xp:=5;
 elsif p_acao='carinho' then if (n->>'carinho')::numeric<90 then premio:=1;end if;n:=n||jsonb_build_object('carinho',least(100,(n->>'carinho')::numeric+18),'diversao',least(100,(n->>'diversao')::numeric+5));xp:=2;
 elsif p_acao in('brincar','dancar') then if (n->>'diversao')::numeric<90 then premio:=1;end if;n:=n||jsonb_build_object('diversao',least(100,(n->>'diversao')::numeric+18),'fome',least(100,(n->>'fome')::numeric+4),'sono',least(100,(n->>'sono')::numeric+4));xp:=3;
 elsif p_acao='dormir' then m.estado:='dormindo';s.comodo:='quarto';
 elsif p_acao='acordar' then m.estado:='feliz';
 elsif p_acao='regar' then if (n->>'diversao')::numeric<90 then premio:=1;end if;n:=n||jsonb_build_object('diversao',least(100,(n->>'diversao')::numeric+7),'higiene',greatest(0,(n->>'higiene')::numeric-2));xp:=2;
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
 premio:=least(premio,greatest(0,30-s.recompensas_cuidados),999999-s.moedas);
 s.moedas:=s.moedas+premio;s.recompensas_cuidados:=s.recompensas_cuidados+premio;
 xp:=least(xp,100-s.xp_hoje);s.xp_hoje:=s.xp_hoje+xp;
 update public.mascote_casal set fome=round((n->>'fome')::numeric)::integer,sono=round((n->>'sono')::numeric)::integer,felicidade=round((n->>'diversao')::numeric)::integer,energia=100-round((n->>'sono')::numeric)::integer,experiencia=m.experiencia+xp,nivel=1+(m.experiencia+xp)/100,estado=m.estado,updated_at=now(),necessidades_at=now(),updated_by=auth.uid() where story_id=p_story;
 update public.patch_estado set alimentos=s.alimentos,recompensas_cuidados=s.recompensas_cuidados,dia_cuidados=s.dia_cuidados,moedas=s.moedas,necessidades=n,comodo=s.comodo,roupa=s.roupa,decoracao=s.decoracao,dia=s.dia,progresso=s.progresso,missao_resgatada=s.missao_resgatada,presente_dia=s.presente_dia,xp_hoje=s.xp_hoje,jogos_hoje=s.jogos_hoje,ultimas_acoes=s.ultimas_acoes,atualizado_em=now() where story_id=p_story;
 return patch_privado.visao(p_story)||jsonb_build_object('recompensa_acao',premio);
end $$;
notify pgrst,'reload schema';
commit;
