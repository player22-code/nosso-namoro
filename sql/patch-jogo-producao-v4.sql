begin;
-- Extensão do jogo existente. Não migra nem toca na carteira dos cassinos.
alter table public.patch_estado
 add column producao boolean not null default false,
 add column xp_pet bigint not null default 0 check(xp_pet>=0),
 add column xp_legado_base bigint not null default 0,
 add column nivel_premiado integer not null default 1,
 add column estatisticas jsonb not null default '{}'::jsonb,
 add column conquistas jsonb not null default '{}'::jsonb,
 add column missoes_resgatadas jsonb not null default '{}'::jsonb,
 add column casa jsonb not null default '{}'::jsonb,
 add column acessorio text,
 add column brinquedo text;
create table public.patch_operacoes(
 story_id uuid not null references public.stories(id) on delete cascade,
 op_id uuid not null,jogador_id uuid not null references auth.users(id) on delete cascade,
 acao text not null,item text,resultado jsonb not null,criada_em timestamptz not null default now(),
 primary key(story_id,op_id)
);
create table public.patch_cuidados(
 id uuid primary key default gen_random_uuid(),story_id uuid not null references public.stories(id) on delete cascade,
 jogador_id uuid not null references auth.users(id) on delete cascade,
 tipo text not null check(tipo in('banho','dentes','carinho')),etapa text not null,
 blocos integer not null default 0,ultimo_t numeric not null default -1,
 iniciado_em timestamptz not null default now(),etapa_em timestamptz not null default now(),
 expira_em timestamptz not null default now()+interval '5 minutes',
 concluido boolean not null default false,cancelado boolean not null default false,
 higiene_inicial numeric not null,resultado jsonb
);
create index patch_cuidados_historia on public.patch_cuidados(story_id,iniciado_em desc);
alter table public.patch_operacoes enable row level security;
alter table public.patch_cuidados enable row level security;
revoke all on public.patch_operacoes,public.patch_cuidados from public,anon,authenticated;
grant select on public.patch_operacoes,public.patch_cuidados to authenticated;
create policy patch_operacoes_membro on public.patch_operacoes for select to authenticated using(public.cinema_sou_membro(story_id));
create policy patch_cuidados_membro on public.patch_cuidados for select to authenticated using(public.cinema_sou_membro(story_id));
create function patch_privado.xp_limiar(p_nivel integer) returns bigint language sql immutable set search_path='' as $$
 select 100::bigint*greatest(0,p_nivel-1)+10::bigint*greatest(0,p_nivel-1)*greatest(0,p_nivel-2) $$;
create function patch_privado.xp_nivel(p_xp bigint) returns integer language sql immutable set search_path='' as $$
 select greatest(1,least(10000,1+floor((-90+sqrt(8100+40*greatest(0,p_xp)::numeric))/20)::integer)) $$;
create or replace function patch_privado.catalogo() returns jsonb language sql immutable set search_path='' as $$
select '[
{"id":"camiseta_rosa","nome":"Camiseta de coração","tipo":"roupa","categoria":"roupas","preco":18,"min_nivel":1,"descricao":"Camiseta rosa para o Patch.","asset":"pet-juvenil-parado.gif","slot":"roupa"},
{"id":"pijama_lilas","nome":"Pijama das estrelas","tipo":"roupa","categoria":"roupas","preco":24,"min_nivel":1,"descricao":"Pijama lilás para descansar.","asset":"pet-jovem-dormir.gif","slot":"roupa"},
{"id":"oculos_coracao","nome":"Óculos de coração","tipo":"acessorio","categoria":"acessorios","preco":22,"min_nivel":1,"descricao":"Óculos com armação rosa.","asset":"Patch_Jogo_Completo/objetos/coracao.svg","slot":"acessorio"},
{"id":"laco_dourado","nome":"Laço dourado","tipo":"acessorio","categoria":"acessorios","preco":28,"min_nivel":1,"descricao":"Laço com brilho suave.","asset":"Patch_Jogo_Completo/objetos/laco.svg","slot":"acessorio"},
{"id":"tapete_flor","nome":"Tapete de flor","tipo":"decoracao","categoria":"decoracoes","preco":20,"min_nivel":1,"descricao":"Tapete floral para a sala.","asset":"Patch_Jogo_Completo/objetos/flor.svg","comodo":"sala","slot":"tapete"},
{"id":"almofada_lilas","nome":"Almofada lilás","tipo":"decoracao","categoria":"decoracoes","preco":16,"min_nivel":1,"descricao":"Almofada macia no sofá.","asset":"Patch_Jogo_Completo/objetos/sofa.svg","comodo":"sala","slot":"almofada"},
{"id":"vaso_rosa","nome":"Vaso com flores","tipo":"decoracao","categoria":"decoracoes","preco":14,"min_nivel":1,"descricao":"Um vaso florido para a sala.","asset":"Patch_Jogo_Completo/objetos/flor.svg","comodo":"sala","slot":"planta"},
{"id":"vestido_lilas","nome":"Vestido lilás","tipo":"roupa","categoria":"roupas","preco":32,"min_nivel":3,"descricao":"Roupa com saia e detalhes lilás.","asset":"Patch_Jogo_Completo/objetos/vestido.svg","slot":"roupa"},
{"id":"fone_rosa","nome":"Fone rosa","tipo":"acessorio","categoria":"acessorios","preco":30,"min_nivel":4,"descricao":"Fones para o Patch dançar.","asset":"Patch_Jogo_Completo/objetos/fone.svg","slot":"acessorio"},
{"id":"coroa_rosa","nome":"Coroa do carinho","tipo":"acessorio","categoria":"acessorios","preco":45,"min_nivel":6,"descricao":"Uma coroa para seu companheiro.","asset":"Patch_Jogo_Completo/objetos/coroa.svg","slot":"acessorio"},
{"id":"bola_rosa","nome":"Bola rosa","tipo":"brinquedo","categoria":"brinquedos","preco":12,"min_nivel":1,"descricao":"Bola para brincar na sala e jardim.","asset":"Patch_Jogo_Completo/objetos/bola.svg","slot":"brinquedo"},
{"id":"ursinho_rosa","nome":"Ursinho fofo","tipo":"brinquedo","categoria":"brinquedos","preco":25,"min_nivel":2,"descricao":"Um ursinho para abraçar e brincar.","asset":"Patch_Jogo_Completo/objetos/ursinho.svg","slot":"brinquedo"},
{"id":"sofa_rosa","nome":"Sofá dos sonhos","tipo":"movel","categoria":"moveis","preco":40,"min_nivel":3,"descricao":"Um novo sofá rosa para a sala.","asset":"Patch_Jogo_Completo/objetos/sofa.svg","comodo":"sala","slot":"sofa"},
{"id":"cama_nuvem","nome":"Cama de nuvem","tipo":"movel","categoria":"moveis","preco":45,"min_nivel":4,"descricao":"Uma cama fofa para o quarto.","asset":"Patch_Jogo_Completo/objetos/cama.svg","comodo":"quarto","slot":"cama"},
{"id":"tapete_estrelas","nome":"Tapete estrelado","tipo":"decoracao","categoria":"decoracoes","preco":35,"min_nivel":3,"descricao":"Estrelas suaves no chão do quarto.","asset":"Patch_Jogo_Completo/objetos/estrela.svg","comodo":"quarto","slot":"tapete"},
{"id":"flor_jardim","nome":"Flores do jardim","tipo":"decoracao","categoria":"decoracoes","preco":18,"min_nivel":2,"descricao":"Flores adicionais para cuidar.","asset":"Patch_Jogo_Completo/objetos/flor.svg","comodo":"jardim","slot":"planta"},
{"id":"luminaria_coracao","nome":"Luminária de coração","tipo":"movel","categoria":"moveis","preco":28,"min_nivel":2,"descricao":"Luz delicada para o quarto.","asset":"Patch_Jogo_Completo/objetos/coracao.svg","comodo":"quarto","slot":"luz"}
]'::jsonb $$;
alter function patch_privado.alimentos_catalogo() rename to alimentos_catalogo_v3;
create function patch_privado.alimentos_catalogo() returns jsonb language sql immutable set search_path='' as $$
 select jsonb_agg(v||jsonb_build_object('categoria','comidas','min_nivel',1,'descricao','Recupera '||(v->>'saciedade')||' de saciedade.','asset',case v->>'id' when 'leite' then null when 'bolinho' then 'Patch_Jogo_Completo/objetos/bolo.svg' else 'Patch_Jogo_Completo/objetos/'||(v->>'id')||'.svg' end)) from jsonb_array_elements(patch_privado.alimentos_catalogo_v3()) v $$;
create function patch_privado.missoes_catalogo() returns jsonb language sql immutable set search_path='' as $$
select '[{"id":"refeicoes","nome":"Hora das refeições","descricao":"Alimente o Patch três vezes.","chave":"alimentar","objetivo":3,"recompensa":{"moedas":6,"xp":6}},
{"id":"banho","nome":"Banho caprichado","descricao":"Conclua um banho interativo.","chave":"banho","objetivo":1,"recompensa":{"moedas":5,"xp":5}},
{"id":"carinhos","nome":"Momento de carinho","descricao":"Faça carinho três vezes.","chave":"carinho","objetivo":3,"recompensa":{"moedas":4,"xp":4}},
{"id":"jogos","nome":"Diversão em dobro","descricao":"Conclua dois minijogos.","chave":"jogos","objetivo":2,"recompensa":{"moedas":8,"xp":8}},
{"id":"compras","nome":"Despensa abastecida","descricao":"Compre um alimento.","chave":"comprar_comida","objetivo":1,"recompensa":{"moedas":3,"xp":3}},
{"id":"coracoes","nome":"Caça aos corações","descricao":"Colete cinco corações em atividades.","chave":"coletas","objetivo":5,"recompensa":{"moedas":4,"xp":4}}]'::jsonb $$;
create function patch_privado.conquistas_catalogo() returns jsonb language sql immutable set search_path='' as $$
select '[{"id":"primeira_refeicao","nome":"Primeira refeição","descricao":"Alimente o Patch.","icone":"🥕","chave":"alimentar","objetivo":1,"moedas":5},
{"id":"primeiro_banho","nome":"Limpinho!","descricao":"Conclua um banho.","icone":"🛁","chave":"banho","objetivo":1,"moedas":5},
{"id":"primeiro_carinho","nome":"Amizade começando","descricao":"Faça carinho.","icone":"💗","chave":"carinho","objetivo":1,"moedas":3},
{"id":"primeiro_nivel","nome":"Crescendo juntos","descricao":"Alcance o nível 2.","icone":"⭐","chave":"nivel","objetivo":2,"moedas":8},
{"id":"dez_jogos","nome":"Companhia divertida","descricao":"Conclua dez minijogos.","icone":"🎮","chave":"jogos","objetivo":10,"moedas":12},
{"id":"cem_carinhos","nome":"Cem abraços","descricao":"Faça cem carinhos.","icone":"💞","chave":"carinho","objetivo":100,"moedas":20},
{"id":"primeira_compra","nome":"Primeira compra","descricao":"Compre um item ou alimento.","icone":"🛍","chave":"compras","objetivo":1,"moedas":4},
{"id":"primeira_decoracao","nome":"Casa com amor","descricao":"Instale uma decoração ou móvel.","icone":"🏡","chave":"instalar","objetivo":1,"moedas":5}]'::jsonb $$;
-- Os corpos anteriores permanecem para compatibilidade de ações sem protocolo novo.
alter function patch_privado.acao(uuid,text,text) rename to acao_v3;
alter function patch_privado.visao(uuid) rename to visao_v3;
create function patch_privado.preparar(p_story uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.patch_estado;m public.mascote_casal;l integer;delta integer;hoje date:=(now() at time zone 'UTC')::date;
begin
 perform patch_privado.iniciar(p_story);
 select * into strict s from public.patch_estado where story_id=p_story for update;
 select * into strict m from public.mascote_casal where story_id=p_story for update;
 if not s.producao then
  l:=greatest(1,1+m.experiencia/100);
  update public.patch_estado set producao=true,xp_pet=patch_privado.xp_limiar(l)+(m.experiencia%100)*(100+20::bigint*(l-1))/100,xp_legado_base=m.experiencia,nivel_premiado=l where story_id=p_story;
 end if;
 if s.dia<>hoje then update public.patch_estado set dia=hoje,progresso='{}',missao_resgatada=false,xp_hoje=0,jogos_hoje=0,missoes_resgatadas='{}' where story_id=p_story;end if;
end $$;
create function patch_privado.xp_dar(p_story uuid,p_xp integer) returns integer language plpgsql security definer set search_path='' as $$
declare ganho integer;
begin
 select least(greatest(0,p_xp),100-xp_hoje) into ganho from public.patch_estado where story_id=p_story for update;
 update public.patch_estado set xp_hoje=xp_hoje+ganho where story_id=p_story;
 update public.mascote_casal set experiencia=experiencia+ganho where story_id=p_story;
 return ganho;
end $$;
create function patch_privado.registrar(p_story uuid,p_evento text,p_qtd integer default 1) returns void language plpgsql security definer set search_path='' as $$
declare s public.patch_estado;m public.mascote_casal;delta bigint;l integer;bonus integer:=0;c jsonb;valor integer;con jsonb;
begin
 select * into strict s from public.patch_estado where story_id=p_story for update;
 select * into strict m from public.mascote_casal where story_id=p_story for update;
 delta:=greatest(0,m.experiencia-s.xp_legado_base);s.xp_pet:=s.xp_pet+delta;s.xp_legado_base:=m.experiencia;l:=patch_privado.xp_nivel(s.xp_pet);
 if l>s.nivel_premiado then bonus:=least(100,5*(l-s.nivel_premiado));s.moedas:=least(999999,s.moedas+bonus);s.nivel_premiado:=l;end if;
 if p_evento is not null and p_qtd>0 then
  s.estatisticas:=s.estatisticas||jsonb_build_object(p_evento,coalesce((s.estatisticas->>p_evento)::integer,0)+p_qtd);
  if p_evento in('comprar','comprar_comida') then s.estatisticas:=s.estatisticas||jsonb_build_object('compras',coalesce((s.estatisticas->>'compras')::integer,0)+p_qtd);end if;
 end if;
 s.estatisticas:=s.estatisticas||jsonb_build_object('nivel',l);
 con:=s.conquistas;
 for c in select value from jsonb_array_elements(patch_privado.conquistas_catalogo()) loop
  valor:=coalesce((s.estatisticas->>(c->>'chave'))::integer,0);
  if valor>=(c->>'objetivo')::integer and not con ? (c->>'id') then con:=con||jsonb_build_object(c->>'id',jsonb_build_object('data',now(),'resgatada',false));end if;
 end loop;
 update public.patch_estado set moedas=s.moedas,xp_pet=s.xp_pet,xp_legado_base=s.xp_legado_base,nivel_premiado=s.nivel_premiado,estatisticas=s.estatisticas,conquistas=con where story_id=p_story and row(moedas,xp_pet,xp_legado_base,nivel_premiado,estatisticas,conquistas) is distinct from row(s.moedas,s.xp_pet,s.xp_legado_base,s.nivel_premiado,s.estatisticas,con);
end $$;
create function patch_privado.visao(p_story uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare base jsonb;s public.patch_estado;l integer;ms jsonb;cs jsonb;care public.patch_cuidados;game public.patch_partidas;hoje date:=(now() at time zone 'UTC')::date;
begin
 perform patch_privado.autorizar(p_story);
 select * into strict s from public.patch_estado where story_id=p_story;
 select * into care from public.patch_cuidados where story_id=p_story and not concluido and not cancelado and expira_em>now() order by iniciado_em desc limit 1;
 select * into game from public.patch_partidas where story_id=p_story and not finalizada and expira_em>now() order by iniciada_em desc limit 1;
 base:=patch_privado.visao_v3(p_story);
 base:=jsonb_set(base,'{esperas,descansar}',to_jsonb(greatest(0,ceil(coalesce((s.ultimas_acoes->>'descansar')::numeric,0)+60-extract(epoch from now())))),true);
 base:=jsonb_set(base,'{esperas,dentes}',to_jsonb(greatest(0,ceil(coalesce((s.ultimas_acoes->>'dentes')::numeric,0)+45-extract(epoch from now())))),true);
 l:=case when s.producao then patch_privado.xp_nivel(s.xp_pet) else (base->>'nivel')::integer end;
 select coalesce(jsonb_agg(v||jsonb_build_object('progresso',least((v->>'objetivo')::int,case when s.dia=hoje then coalesce((s.progresso->>(v->>'chave'))::int,0) else 0 end),'concluida',s.dia=hoje and coalesce((s.progresso->>(v->>'chave'))::int,0)>=(v->>'objetivo')::int,'resgatada',s.dia=hoje and coalesce((s.missoes_resgatadas->>(v->>'id'))::boolean,false))),'[]') into ms from jsonb_array_elements(patch_privado.missoes_catalogo())v;
 select coalesce(jsonb_agg(v||jsonb_build_object('progresso',least((v->>'objetivo')::int,coalesce((s.estatisticas->>(v->>'chave'))::int,0)),'desbloqueada_em',s.conquistas->(v->>'id')->>'data','resgatada',coalesce((s.conquistas->(v->>'id')->>'resgatada')::boolean,false),'recompensa',jsonb_build_object('moedas',(v->>'moedas')::int,'xp',0))),'[]') into cs from jsonb_array_elements(patch_privado.conquistas_catalogo())v;
 return base||jsonb_build_object('producao',s.producao,'nivel',l,'xp_total',s.xp_pet,'xp_atual',greatest(0,s.xp_pet-patch_privado.xp_limiar(l)),'xp_proximo',100+20*(l-1),'missoes',ms,'conquistas',cs,'estatisticas',s.estatisticas,'casa',s.casa,'acessorio',s.acessorio,'brinquedo',s.brinquedo,'atividade_ativa',case when game.id is null then null else jsonb_build_object('id',game.id,'tipo',game.tipo,'jogador_id',game.jogador_id,'expira_em',game.expira_em) end,'cuidado_ativo',case when care.id is null then null else patch_privado.cuidado_visao(care) end);
end $$;
create or replace function patch_privado.ler(p_story uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform patch_privado.preparar(p_story);perform patch_privado.registrar(p_story,null,0);return patch_privado.visao(p_story);end $$;
create function patch_privado.acao(p_story uuid,p_acao text,p_item text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.patch_estado;v jsonb;item jsonb;cat text;room text;slot text;pr integer;xp integer;own boolean;l integer;reward integer:=0;
begin
 perform patch_privado.preparar(p_story);select * into strict s from public.patch_estado where story_id=p_story for update;l:=patch_privado.xp_nivel(s.xp_pet);
 if p_acao in('comodo','alimentar','carinho','brincar','dancar','dormir','acordar','regar','descansar') and exists(select from public.patch_partidas where story_id=p_story and not finalizada and expira_em>now()) then raise exception 'Finalize ou encerre a atividade antes de cuidar do Patch';end if;
 if p_acao in('comodo','alimentar','carinho','brincar','dancar','dormir','acordar','regar') and exists(select from public.patch_cuidados where story_id=p_story and not concluido and not cancelado and expira_em>now()) then raise exception 'Conclua ou cancele o cuidado em andamento';end if;
 if p_acao in('banho','escovar') then raise exception 'Use o cuidado interativo para concluir esta ação';end if;
 if p_acao in('comprar','vestir','acessorio','brinquedo','instalar','decorar') then
  if p_item='padrao' and p_acao in('vestir','acessorio','brinquedo','decorar') then
   update public.patch_estado set roupa=case when p_acao='vestir' then null else roupa end,acessorio=case when p_acao='acessorio' then null else acessorio end,brinquedo=case when p_acao='brinquedo' then null else brinquedo end,decoracao=case when p_acao='decorar' then null else decoracao end,casa=case when p_acao='decorar' then '{}' else casa end where story_id=p_story;
  else
   select value into item from jsonb_array_elements(patch_privado.catalogo()) where value->>'id'=p_item;
   if item is null then raise exception 'Item inválido';end if;cat:=item->>'categoria';
   select exists(select from public.patch_inventario where story_id=p_story and item_id=p_item) into own;
   if p_acao='comprar' then
    if own then raise exception 'Este item já está no inventário';end if;
    if l<(item->>'min_nivel')::int then raise exception 'Alcance o nível % para desbloquear este item',item->>'min_nivel';end if;
    pr:=(item->>'preco')::int;if s.moedas<pr then raise exception 'Moedas do Patch insuficientes';end if;
    update public.patch_estado set moedas=moedas-pr where story_id=p_story;insert into public.patch_inventario(story_id,item_id) values(p_story,p_item);
   else
    if not own then raise exception 'Item não adquirido';end if;
    if cat='roupas' and p_acao='vestir' then update public.patch_estado set roupa=p_item where story_id=p_story;
    elsif cat='acessorios' and p_acao in('vestir','acessorio') then update public.patch_estado set acessorio=p_item where story_id=p_story;
    elsif cat='brinquedos' and p_acao='brinquedo' then update public.patch_estado set brinquedo=p_item where story_id=p_story;
    elsif cat in('moveis','decoracoes') and p_acao in('instalar','decorar') then
     room:=item->>'comodo';slot:=item->>'slot';
     update public.patch_estado set casa=casa||jsonb_build_object(room,coalesce(casa->room,'{}')||jsonb_build_object(slot,p_item)),decoracao=case when p_acao='decorar' then p_item else decoracao end where story_id=p_story;
    else raise exception 'Ação incompatível com este item';end if;
   end if;
  end if;
 elsif p_acao='resgatar_missao' then
  select value into item from jsonb_array_elements(patch_privado.missoes_catalogo()) where value->>'id'=p_item;
  if item is null or coalesce((s.progresso->>(item->>'chave'))::int,0)<(item->>'objetivo')::int then raise exception 'Missão ainda não concluída';end if;
  if coalesce((s.missoes_resgatadas->>p_item)::boolean,false) then raise exception 'Recompensa já recebida';end if;
  reward:=(item->'recompensa'->>'moedas')::int;
  update public.patch_estado set moedas=least(999999,moedas+reward),missoes_resgatadas=missoes_resgatadas||jsonb_build_object(p_item,true) where story_id=p_story;
  perform patch_privado.xp_dar(p_story,(item->'recompensa'->>'xp')::int);
 elsif p_acao='resgatar_conquista' then
  select value into item from jsonb_array_elements(patch_privado.conquistas_catalogo()) where value->>'id'=p_item;
  if item is null or not s.conquistas ? p_item then raise exception 'Conquista ainda bloqueada';end if;
  if coalesce((s.conquistas->p_item->>'resgatada')::boolean,false) then raise exception 'Recompensa já recebida';end if;
  reward:=(item->>'moedas')::int;
  update public.patch_estado set moedas=least(999999,moedas+reward),conquistas=jsonb_set(conquistas,array[p_item,'resgatada'],'true') where story_id=p_story;
 elsif p_acao='descansar' then
  if s.comodo<>'sala' or exists(select from public.mascote_casal where story_id=p_story and estado='dormindo') then raise exception 'Descanse no sofá da sala';end if;
  if exists(select from public.patch_cuidados where story_id=p_story and not concluido and not cancelado and expira_em>now()) then raise exception 'Conclua o cuidado antes de descansar';end if;
  if extract(epoch from now())-coalesce((s.ultimas_acoes->>'descansar')::numeric,0)<60 then raise exception 'Aguarde um minuto entre descansos';end if;
  select patch_privado.necessidades(s,m) into v from public.mascote_casal m where m.story_id=p_story;
  v:=v||jsonb_build_object('sono',greatest(0,(v->>'sono')::numeric-8));perform patch_privado.persistir_necessidades(p_story,v);
  update public.patch_estado set ultimas_acoes=ultimas_acoes||jsonb_build_object('descansar',extract(epoch from now())) where story_id=p_story;
  perform patch_privado.xp_dar(p_story,1);
 elsif p_acao='restaurar_casa' then update public.patch_estado set casa='{}',decoracao=null where story_id=p_story;
 else
  v:=patch_privado.acao_v3(p_story,p_acao,p_item);reward:=coalesce((v->>'recompensa_acao')::int,0);
 end if;
 if p_acao in('comprar','comprar_comida') then update public.patch_estado set progresso=progresso||jsonb_build_object(p_acao,coalesce((progresso->>p_acao)::int,0)+1) where story_id=p_story;end if;
 perform patch_privado.registrar(p_story,case when p_acao in('decorar','instalar') and p_item<>'padrao' then 'instalar' else p_acao end,1);
 return patch_privado.visao(p_story)||jsonb_build_object('recompensa_acao',reward);
end $$;
create function public.patch_executar(p_story uuid,p_acao text,p_item text,p_op_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.patch_operacoes;res jsonb;
begin
 perform patch_privado.autorizar(p_story);if p_op_id is null then raise exception 'Identificador de operação obrigatório';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_story::text,0));
 select * into old from public.patch_operacoes where story_id=p_story and op_id=p_op_id;
 if found then
  if old.jogador_id<>auth.uid() or old.acao is distinct from p_acao or old.item is distinct from p_item then raise exception 'Identificador de operação já utilizado';end if;
  return old.resultado||jsonb_build_object('repetido',true,'estado_atual',patch_privado.visao(p_story));
 end if;
 res:=patch_privado.acao(p_story,p_acao,p_item);
 insert into public.patch_operacoes(story_id,op_id,jogador_id,acao,item,resultado) values(p_story,p_op_id,auth.uid(),p_acao,p_item,res);
 return res;
end $$;
-- O endpoint privilegiado fica privado; o wrapper público é INVOKER.
alter function public.patch_executar(uuid,text,text,uuid) set schema patch_privado;
alter function patch_privado.patch_executar(uuid,text,text,uuid) rename to executar;
create function public.patch_executar(p_story uuid,p_acao text,p_item text,p_op_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select patch_privado.executar(p_story,p_acao,p_item,p_op_id) $$;
create function patch_privado.persistir_necessidades(p_story uuid,p_n jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.patch_estado set necessidades=p_n,atualizado_em=now() where story_id=p_story;
 update public.mascote_casal set fome=round((p_n->>'fome')::numeric),sono=round((p_n->>'sono')::numeric),energia=100-round((p_n->>'sono')::numeric),felicidade=round((p_n->>'diversao')::numeric),updated_at=now(),necessidades_at=now(),updated_by=auth.uid() where story_id=p_story;
end $$;
create function patch_privado.cuidado_visao(c public.patch_cuidados) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',c.id,'tipo',c.tipo,'etapa',c.etapa,'progresso',least(100,c.blocos*100/(case c.tipo when 'banho' then 4 when 'dentes' then 3 else 1 end)),'blocos_concluidos',c.blocos,'jogador_id',c.jogador_id,'decorrido_ms',greatest(0,extract(epoch from now()-c.iniciado_em)*1000),'expira_em',c.expira_em,'concluido',c.concluido,'cancelado',c.cancelado,'desafio',jsonb_build_object('blocos',case c.tipo when 'banho' then 4 when 'dentes' then 3 else 1 end,'distancia_minima',case c.tipo when 'banho' then .7 when 'dentes' then .45 else .6 end,'duracao_minima',case c.tipo when 'carinho' then 600 else 650 end,'zonas',jsonb_build_object('x_min',0,'y_min',0,'x_max',1,'y_max',1),'etapas',case c.tipo when 'banho' then '["esfregar","enxaguar","secar"]'::jsonb when 'dentes' then '["escovar"]'::jsonb else '["acariciar"]'::jsonb end)) $$;
create function patch_privado.cuidado_iniciar(p_story uuid,p_tipo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.patch_cuidados;s public.patch_estado;m public.mascote_casal;n jsonb;cool integer;last_start numeric;
begin
 perform patch_privado.preparar(p_story);
 if p_tipo is null or p_tipo not in('banho','dentes','carinho') then raise exception 'Cuidado inválido';end if;
 select * into strict s from public.patch_estado where story_id=p_story for update;
 select * into strict m from public.mascote_casal where story_id=p_story for update;
 if m.estado='dormindo' then raise exception 'Acorde o Patch antes de cuidar';end if;
 if p_tipo in('banho','dentes') and s.comodo<>'banheiro' then raise exception 'Entre no banheiro para este cuidado';end if;
 select * into c from public.patch_cuidados where story_id=p_story and not concluido and not cancelado and expira_em>now() order by iniciado_em desc limit 1;
 if found then
  if c.jogador_id=auth.uid() and c.tipo=p_tipo then return patch_privado.cuidado_visao(c)||jsonb_build_object('estado',patch_privado.visao(p_story));end if;
  raise exception 'Outro cuidado está em andamento. Retome ou cancele antes de iniciar';
 end if;
 if exists(select from public.patch_partidas where story_id=p_story and not finalizada and expira_em>now()) then raise exception 'Finalize ou saia da atividade antes de cuidar';end if;
 cool:=case p_tipo when 'carinho' then 15 else 45 end;
 last_start:=greatest(coalesce((s.ultimas_acoes->>('care_start_'||p_tipo))::numeric,0),coalesce((s.ultimas_acoes->>p_tipo)::numeric,0));
 if extract(epoch from now())-last_start<cool then raise exception 'Espere % segundos para repetir este cuidado',ceil(cool-(extract(epoch from now())-last_start));end if;
 n:=patch_privado.necessidades(s,m);
 insert into public.patch_cuidados(story_id,jogador_id,tipo,etapa,higiene_inicial) values(p_story,auth.uid(),p_tipo,case p_tipo when 'banho' then 'esfregar' when 'dentes' then 'escovar' else 'acariciar' end,(n->>'higiene')::numeric) returning * into c;
 update public.patch_estado set ultimas_acoes=ultimas_acoes||jsonb_build_object('care_start_'||p_tipo,extract(epoch from now())) where story_id=p_story;
 return patch_privado.cuidado_visao(c)||jsonb_build_object('estado',patch_privado.visao(p_story));
end $$;
create function patch_privado.cuidado_avancar(p_cuidado uuid,p_etapa text,p_gestos jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.patch_cuidados;s public.patch_estado;m public.mascote_casal;n jsonb;point jsonb;x numeric;y numeric;t numeric;px numeric;py numeric;pt numeric;first_t numeric;distance numeric:=0;elapsed numeric;min_ms integer;min_dist numeric;total integer;finish boolean:=false;reward integer:=0;xp integer:=0;res jsonb;hoje date:=(now() at time zone 'UTC')::date;
begin
 select * into c from public.patch_cuidados where id=p_cuidado;
 if not found or c.jogador_id<>auth.uid() then raise exception 'Cuidado indisponível' using errcode='42501';end if;
 perform patch_privado.preparar(c.story_id);
 select * into strict c from public.patch_cuidados where id=p_cuidado for update;
 if c.concluido then return patch_privado.cuidado_visao(c)||jsonb_build_object('repetido',true,'estado',patch_privado.visao(c.story_id));end if;
 if c.cancelado or c.expira_em<now() then raise exception 'Cuidado encerrado. Comece novamente';end if;
 if p_etapa is distinct from c.etapa then raise exception 'Conclua a etapa % primeiro',c.etapa;end if;
 select * into strict s from public.patch_estado where story_id=c.story_id for update;
 select * into strict m from public.mascote_casal where story_id=c.story_id for update;
 if m.estado='dormindo' or (c.tipo in('banho','dentes') and s.comodo<>'banheiro') then raise exception 'O Patch não está disponível neste ambiente';end if;
 n:=patch_privado.necessidades(s,m);elapsed:=extract(epoch from now()-c.iniciado_em)*1000;
 if c.etapa in('esfregar','escovar','acariciar') then
  if p_gestos is null or jsonb_typeof(p_gestos)<>'array' or jsonb_array_length(p_gestos)<5 or jsonb_array_length(p_gestos)>200 then raise exception 'Faça um movimento contínuo no personagem';end if;
  if (p_gestos->(jsonb_array_length(p_gestos)-1)->>'t')::numeric<=c.ultimo_t then return patch_privado.cuidado_visao(c)||jsonb_build_object('repetido',true,'estado',patch_privado.visao(c.story_id));end if;
  for point in select value from jsonb_array_elements(p_gestos) loop
   x:=(point->>'x')::numeric;y:=(point->>'y')::numeric;t:=(point->>'t')::numeric;
   if x is null or y is null or t is null or x<0 or x>1 or y<0 or y>1 or t<0 or t>elapsed+350 then raise exception 'Movimento fora da área válida';end if;
   if first_t is null then first_t:=t;if t<=c.ultimo_t then raise exception 'Movimento já registrado';end if;
   elsif t-pt<15 then raise exception 'Movimento rápido demais';end if;
   if pt is not null then distance:=distance+sqrt((x-px)^2+(y-py)^2);end if;px:=x;py:=y;pt:=t;
  end loop;
  min_ms:=case c.tipo when 'carinho' then 600 else 650 end;min_dist:=case c.tipo when 'banho' then .7 when 'dentes' then .45 else .6 end;
  if pt-first_t<min_ms or distance<min_dist then raise exception 'Continue movimentando para concluir esta parte';end if;
  c.ultimo_t:=pt;c.blocos:=c.blocos+1;total:=case c.tipo when 'banho' then 4 when 'dentes' then 3 else 1 end;
  if c.tipo='banho' then n:=n||jsonb_build_object('higiene',least(100,(n->>'higiene')::numeric+8));if c.blocos>=total then c.etapa:='enxaguar';c.etapa_em:=now();end if;
  elsif c.tipo='dentes' then n:=n||jsonb_build_object('higiene',least(100,(n->>'higiene')::numeric+5));if c.blocos>=total then finish:=true;end if;
  else finish:=true;end if;
 elsif c.etapa='enxaguar' then
  if extract(epoch from now()-c.etapa_em)*1000<500 then raise exception 'Aguarde a água enxaguar a espuma';end if;c.etapa:='secar';c.etapa_em:=now();
 elsif c.etapa='secar' then
  if extract(epoch from now()-c.etapa_em)*1000<700 then raise exception 'Continue secando um pouco mais';end if;finish:=true;
 end if;
 if finish then
  if c.tipo='banho' then n:=n||jsonb_build_object('higiene',least(100,(n->>'higiene')::numeric+13));xp:=5;if c.higiene_inicial<85 then reward:=2;end if;
  elsif c.tipo='dentes' then n:=n||jsonb_build_object('higiene',least(100,(n->>'higiene')::numeric+5));xp:=4;if c.higiene_inicial<90 then reward:=1;end if;
  else if (n->>'carinho')::numeric<90 then reward:=1;end if;n:=n||jsonb_build_object('carinho',least(100,(n->>'carinho')::numeric+18),'diversao',least(100,(n->>'diversao')::numeric+5));xp:=2;end if;
  if s.dia_cuidados<>hoje then s.dia_cuidados:=hoje;s.recompensas_cuidados:=0;end if;
  reward:=least(reward,30-s.recompensas_cuidados,999999-s.moedas);
  update public.patch_estado set moedas=moedas+reward,recompensas_cuidados=s.recompensas_cuidados+reward,dia_cuidados=s.dia_cuidados,ultimas_acoes=ultimas_acoes||jsonb_build_object(c.tipo,extract(epoch from now())),progresso=progresso||jsonb_build_object(c.tipo,coalesce((progresso->>c.tipo)::int,0)+1) where story_id=c.story_id;
  perform patch_privado.xp_dar(c.story_id,xp);c.concluido:=true;c.etapa:='concluido';
 end if;
 perform patch_privado.persistir_necessidades(c.story_id,n);
 update public.patch_cuidados set etapa=c.etapa,blocos=c.blocos,ultimo_t=c.ultimo_t,etapa_em=c.etapa_em,concluido=c.concluido where id=c.id;
 if finish then perform patch_privado.registrar(c.story_id,c.tipo,1);end if;
 res:=patch_privado.cuidado_visao(c)||jsonb_build_object('higiene_preview',(n->>'higiene')::numeric,'recompensa_acao',reward,'estado',patch_privado.visao(c.story_id));
 if finish then update public.patch_cuidados set resultado=res where id=c.id;end if;
 return res;
end $$;
create function patch_privado.cuidado_cancelar(p_cuidado uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.patch_cuidados;
begin
 select * into c from public.patch_cuidados where id=p_cuidado;
 if not found or c.jogador_id<>auth.uid() then raise exception 'Cuidado indisponível' using errcode='42501';end if;
 perform patch_privado.preparar(c.story_id);
 update public.patch_cuidados set cancelado=true where id=c.id and not concluido;
 return jsonb_build_object('cancelado',true,'estado',patch_privado.visao(c.story_id));
end $$;
create function public.patch_cuidado_iniciar(p_story uuid,p_tipo text) returns jsonb language sql security invoker set search_path='' as $$ select patch_privado.cuidado_iniciar(p_story,p_tipo) $$;
create function public.patch_cuidado_avancar(p_cuidado uuid,p_etapa text,p_gestos jsonb) returns jsonb language sql security invoker set search_path='' as $$ select patch_privado.cuidado_avancar(p_cuidado,p_etapa,p_gestos) $$;
create function public.patch_cuidado_cancelar(p_cuidado uuid) returns jsonb language sql security invoker set search_path='' as $$ select patch_privado.cuidado_cancelar(p_cuidado) $$;
-- Minijogos compartilham as regras existentes; a dificuldade é definida no servidor.
alter function public.patch_partida_iniciar(uuid,text) rename to patch_partida_iniciar_v3;
alter function patch_privado.partida_iniciar(uuid,text) rename to partida_iniciar_v3;
create function patch_privado.partida_iniciar(p_story uuid,p_tipo text,p_dificuldade text default 'normal') returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.patch_estado;j public.patch_partidas;d jsonb;count_targets int;duration_ms int;step_ms int;
begin
 perform patch_privado.preparar(p_story);select * into strict s from public.patch_estado where story_id=p_story for update;
 if p_tipo is null or p_tipo not in('coracoes','memoria','estrelas','passeio') or p_dificuldade is null or p_dificuldade not in('facil','normal','dificil','easy','hard') then raise exception 'Atividade ou dificuldade inválida';end if;
 p_dificuldade:=case p_dificuldade when 'easy' then 'facil' when 'hard' then 'dificil' else p_dificuldade end;
 if exists(select from public.patch_cuidados where story_id=p_story and not concluido and not cancelado and expira_em>now()) then raise exception 'Conclua ou cancele o cuidado antes de jogar';end if;
 if exists(select from public.mascote_casal where story_id=p_story and estado='dormindo') then raise exception 'Acorde o Patch antes de jogar';end if;
 if s.jogos_hoje>=10 then raise exception 'As 10 recompensas de hoje já foram recebidas';end if;
 if exists(select from public.patch_partidas where story_id=p_story and jogador_id=auth.uid() and iniciada_em>now()-interval '5 seconds') then raise exception 'Aguarde um instante para começar outra partida';end if;
 if p_tipo='memoria' then
  duration_ms:=case p_dificuldade when 'facil' then 120000 when 'dificil' then 60000 else 90000 end;
  select jsonb_build_object('cartas',jsonb_agg(v),'duracao',duration_ms) into d from(select v from unnest(array[0,0,1,1,2,2])v order by random())q;
 elsif p_tipo='coracoes' then
  count_targets:=case p_dificuldade when 'facil' then 8 when 'dificil' then 12 else 10 end;duration_ms:=case p_dificuldade when 'facil' then 12000 when 'dificil' then 18000 else 15000 end;
  select jsonb_build_object('alvos',jsonb_agg(jsonb_build_object('id',i,'x',round((.15+random()*.7)::numeric,3),'inicio',i*1100,'duracao',3000)),'duracao',duration_ms) into d from generate_series(0,count_targets-1)i;
 elsif p_tipo='estrelas' then
  duration_ms:=case p_dificuldade when 'facil' then 12000 when 'dificil' then 18000 else 15000 end;step_ms:=case p_dificuldade when 'facil' then 1600 when 'dificil' then 1200 else 1400 end;
  select jsonb_build_object('tempos',jsonb_agg(i),'duracao',duration_ms,'vidas',3) into d from generate_series(2000,duration_ms-1000,step_ms)i;
 else d:='{"alvos":[{"id":0,"x":0.2,"inicio":1000,"duracao":6000},{"id":1,"x":0.75,"inicio":5000,"duracao":6000},{"id":2,"x":0.45,"inicio":9000,"duracao":6000}],"duracao":15000}'::jsonb;end if;
 d:=d||jsonb_build_object('dificuldade',p_dificuldade);
 update public.patch_partidas set finalizada=true where story_id=p_story and jogador_id=auth.uid() and not finalizada;
 insert into public.patch_partidas(story_id,jogador_id,tipo,desafio) values(p_story,auth.uid(),p_tipo,d) returning * into j;
 return jsonb_build_object('id',j.id,'tipo',j.tipo,'desafio',d,'iniciada_em',j.iniciada_em,'expira_em',j.expira_em);
end $$;
create function public.patch_partida_iniciar(p_story uuid,p_tipo text,p_dificuldade text default 'normal') returns jsonb language sql security invoker set search_path='' as $$ select patch_privado.partida_iniciar(p_story,p_tipo,p_dificuldade) $$;
create or replace function patch_privado.partida_finalizar(p_partida uuid,p_resposta jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<liquidacao>>
declare j public.patch_partidas;s public.patch_estado;m public.mascote_casal;elapsed numeric;v jsonb;a jsonb;ia int;ib int;idx int;at_ms numeric;previous_ms numeric:=-10000;matched int[]:='{}';ids int[]:='{}';acertos int:=0;passados int:=0;falhas int:=0;premio int:=0;xp int;duracao int;n jsonb;
begin
 select * into j from public.patch_partidas where id=p_partida;
 if not found or auth.uid() is null or j.jogador_id<>auth.uid() then raise exception 'Partida indisponível' using errcode='42501';end if;
 perform patch_privado.preparar(j.story_id);select * into strict s from public.patch_estado where story_id=j.story_id for update;select * into strict j from public.patch_partidas where id=p_partida for update;
 if j.finalizada then return jsonb_build_object('repetido',true,'premio',j.premio,'estado',patch_privado.visao(j.story_id));end if;
 if now()>j.expira_em then raise exception 'A partida expirou';end if;
 if p_resposta is null or jsonb_typeof(p_resposta)<>'array' or jsonb_array_length(p_resposta)>100 then raise exception 'Registro de partida inválido';end if;
 elapsed:=extract(epoch from now()-j.iniciada_em)*1000;duracao:=(j.desafio->>'duracao')::int;
 if j.tipo='memoria' then
  if elapsed<6000 then raise exception 'Partida rápida demais';end if;
  for v in select value from jsonb_array_elements(p_resposta) loop
   if jsonb_typeof(v)<>'array' or jsonb_array_length(v)<>2 then raise exception 'Jogada inválida';end if;
   ia:=(v->>0)::int;ib:=(v->>1)::int;
   if ia is null or ib is null or ia<0 or ia>5 or ib<0 or ib>5 or ia=ib or ia=any(matched) or ib=any(matched) then raise exception 'Jogada inválida';end if;
   if j.desafio->'cartas'->ia=j.desafio->'cartas'->ib then matched:=matched||array[ia,ib];end if;
  end loop;
  acertos:=cardinality(matched)/2;
  if acertos=3 and elapsed<=duracao+1500 then premio:=3;end if;
 elsif j.tipo in('coracoes','passeio') then
  if elapsed<duracao-600 then raise exception 'A atividade ainda não terminou';end if;
  for v in select value from jsonb_array_elements(p_resposta) loop
   idx:=(v->>'id')::int;at_ms:=(v->>'em')::numeric;select value into a from jsonb_array_elements(j.desafio->'alvos') where (value->>'id')::int=idx;
   if a is null or idx=any(ids) or at_ms is null or at_ms<(a->>'inicio')::numeric or at_ms>(a->>'inicio')::numeric+(a->>'duracao')::numeric+250 or at_ms>elapsed+250 then raise exception 'Coleta inválida';end if;
   ids:=ids||idx;acertos:=acertos+1;
  end loop;
  if j.tipo='passeio' then premio:=case when acertos=3 then 1 else 0 end;else premio:=least(3,floor(acertos*3.0/jsonb_array_length(j.desafio->'alvos'))::int);end if;
 else
  for v in select value from jsonb_array_elements(p_resposta) loop
   at_ms:=v::text::numeric;if at_ms<0 or at_ms>least(elapsed+250,duracao) or at_ms-previous_ms<650 then raise exception 'Salto inválido';end if;previous_ms:=at_ms;
  end loop;
  for a in select value from jsonb_array_elements(j.desafio->'tempos') loop
   if a::text::numeric<=elapsed+100 then
    passados:=passados+1;
    if exists(select from jsonb_array_elements(p_resposta)x where x::text::numeric between a::text::numeric-600 and a::text::numeric-80) then acertos:=acertos+1;else falhas:=falhas+1;end if;
    if falhas>=3 then exit;end if;
   end if;
  end loop;
  if elapsed<duracao-400 and falhas<3 then raise exception 'O percurso ainda está em andamento';end if;
  premio:=least(3,floor(acertos*3.0/greatest(1,jsonb_array_length(j.desafio->'tempos')))::int);
 end if;
 if s.jogos_hoje>=10 then premio:=0;end if;premio:=least(premio,999999-s.moedas);
 update public.patch_partidas set finalizada=true,premio=liquidacao.premio where id=j.id;
 -- Qualquer partida válida concluída conta na missão; o limite premiado continua dez.
 update public.patch_estado set moedas=moedas+premio,jogos_hoje=jogos_hoje+case when premio>0 then 1 else 0 end,
 progresso=progresso||jsonb_build_object('jogos',coalesce((progresso->>'jogos')::int,0)+1,'coletas',coalesce((progresso->>'coletas')::int,0)+case when j.tipo in('coracoes','passeio') then acertos else 0 end) where story_id=j.story_id;
 if premio>0 then
  perform patch_privado.xp_dar(j.story_id,6);
  select * into strict m from public.mascote_casal where story_id=j.story_id;n:=patch_privado.necessidades(s,m);n:=n||jsonb_build_object('diversao',least(100,(n->>'diversao')::numeric+15),'sono',least(100,(n->>'sono')::numeric+4));perform patch_privado.persistir_necessidades(j.story_id,n);
 end if;
 perform patch_privado.registrar(j.story_id,'jogos',1);
 if j.tipo in('coracoes','passeio') then perform patch_privado.registrar(j.story_id,'coletas',acertos);end if;
 return jsonb_build_object('premio',premio,'acertos',acertos,'colisoes',falhas,'estado',patch_privado.visao(j.story_id));
end $$;
create function patch_privado.partida_cancelar(p_partida uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.patch_partidas;
begin
 select * into j from public.patch_partidas where id=p_partida;
 if not found or j.jogador_id<>auth.uid() then raise exception 'Partida indisponível' using errcode='42501';end if;
 perform patch_privado.preparar(j.story_id);
 update public.patch_partidas set finalizada=true,premio=case when finalizada then premio else 0 end where id=j.id;
 return jsonb_build_object('cancelado',true,'estado',patch_privado.visao(j.story_id));
end $$;
create function public.patch_partida_cancelar(p_partida uuid) returns jsonb language sql security invoker set search_path='' as $$ select patch_privado.partida_cancelar(p_partida) $$;
-- Apenas entradas de negócio são invocáveis pelo papel web; helpers internos não são APIs.
revoke all on all functions in schema patch_privado from public,anon,authenticated;
grant execute on function patch_privado.ler(uuid),patch_privado.acao(uuid,text,text),patch_privado.executar(uuid,text,text,uuid),patch_privado.partida_iniciar(uuid,text,text),patch_privado.partida_finalizar(uuid,jsonb),patch_privado.partida_cancelar(uuid),patch_privado.cuidado_iniciar(uuid,text),patch_privado.cuidado_avancar(uuid,text,jsonb),patch_privado.cuidado_cancelar(uuid) to authenticated;
revoke all on function public.patch_executar(uuid,text,text,uuid),public.patch_partida_iniciar(uuid,text,text),public.patch_partida_cancelar(uuid),public.patch_cuidado_iniciar(uuid,text),public.patch_cuidado_avancar(uuid,text,jsonb),public.patch_cuidado_cancelar(uuid) from public,anon;
grant execute on function public.patch_executar(uuid,text,text,uuid),public.patch_partida_iniciar(uuid,text,text),public.patch_partida_cancelar(uuid),public.patch_cuidado_iniciar(uuid,text),public.patch_cuidado_avancar(uuid,text,jsonb),public.patch_cuidado_cancelar(uuid) to authenticated;
do $$ begin if exists(select from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.patch_cuidados;end if;end $$;
notify pgrst,'reload schema';
commit;
