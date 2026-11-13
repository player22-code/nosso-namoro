-- Executar após a migração V4 na MESMA transação externa. Encerrar com ROLLBACK.
-- Nenhum identificador de usuário nem dado pessoal é devolvido no resultado.
do $$ declare s uuid;u uuid;v uuid;r jsonb;begin
 select min(user_id::text)::uuid,max(user_id::text)::uuid into u,v from public.story_members where story_id=(select story_id from public.story_members group by story_id having count(distinct user_id)>=2 limit 1);
 insert into public.stories default values returning id into s;
 insert into public.story_members(story_id,user_id) values(s,u),(s,v);
 perform set_config('patch.test_story',s::text,true);perform set_config('patch.test_user',u::text,true);perform set_config('patch.test_partner',v::text,true);perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.patch_ler(s);update public.patch_partidas set finalizada=true where story_id=s;update public.patch_cuidados set cancelado=true where story_id=s;
 update public.mascote_casal set experiencia=1150,nivel=12,estado='feliz',fome=65,sono=60,updated_at=now(),necessidades_at=now() where story_id=s;
 update public.patch_estado set producao=false where story_id=s;
 r:=public.patch_ler(s);assert (r->>'nivel')::int=12 and (r->>'xp_atual')::int=160,'migration preserves level and fractional XP';
 update public.mascote_casal set experiencia=0,nivel=1 where story_id=s;
 update public.patch_estado set moedas=200,xp_pet=0,xp_legado_base=0,nivel_premiado=1,xp_hoje=0,jogos_hoje=0,estatisticas='{}',conquistas='{}',casa='{}',missoes_resgatadas='{}',progresso='{}',presente_dia=null,ultimas_acoes='{}',necessidades='{"fome":65,"higiene":20,"sono":60,"diversao":40,"carinho":20}',alimentos='{"cenoura":3,"maca":2,"leite":1,"banana":0,"morango":0,"bolinho":0}',atualizado_em=now() where story_id=s;
 -- História de teste é nova; não altera inventários de histórias existentes.
end $$;
set local role authenticated;
do $$ declare s uuid:=current_setting('patch.test_story')::uuid;r jsonb;op uuid:=gen_random_uuid();begin
 r:=public.patch_ler(s);assert (r->>'producao')::boolean and jsonb_array_length(r->'missoes')>=6,'production state';
 begin update public.patch_estado set moedas=99999 where story_id=s;raise exception 'DIRECT WRITE';exception when insufficient_privilege then null;end;
 begin perform patch_privado.xp_dar(s,99);raise exception 'PRIVATE HELPER';exception when insufficient_privilege then null;end;
 r:=public.patch_executar(s,'comprar','camiseta_rosa',op);assert (r->>'moedas')::int=182,'server price';
 r:=public.patch_executar(s,'comprar','camiseta_rosa',op);assert (r->>'repetido')::boolean and (r->'estado_atual'->>'moedas')::int=182,'operation replay no double debit';
 begin perform public.patch_executar(s,'comprar','camiseta_rosa',gen_random_uuid());raise exception 'DUPLICATE UNIQUE';exception when raise_exception then if sqlerrm='DUPLICATE UNIQUE' then raise;end if;end;
 begin perform public.patch_executar(s,'comprar','coroa_rosa',gen_random_uuid());raise exception 'LOCK BYPASS';exception when raise_exception then if sqlerrm='LOCK BYPASS' then raise;end if;end;
 r:=public.patch_executar(s,'vestir','camiseta_rosa',gen_random_uuid());assert r->>'roupa'='camiseta_rosa','equip';
 perform set_config('request.jwt.claim.sub',current_setting('patch.test_partner'),true);r:=public.patch_ler(s);assert (r->>'moedas')::int=182 and r->>'roupa'='camiseta_rosa','partner same pet';
 begin perform public.patch_executar(s,'comprar','camiseta_rosa',op);raise exception 'OTHER OWNER REPLAY';exception when raise_exception then if sqlerrm='OTHER OWNER REPLAY' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);assert not exists(select from public.patch_estado where story_id=s),'RLS outsider';
 begin perform public.patch_ler(s);raise exception 'OUTSIDER RPC';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',current_setting('patch.test_user'),true);
end $$;
reset role;
do $$ declare s uuid:=current_setting('patch.test_story')::uuid;r jsonb;begin
 update public.patch_estado set xp_pet=220,nivel_premiado=3 where story_id=s;
 r:=public.patch_executar(s,'comprar','sofa_rosa',gen_random_uuid());r:=public.patch_executar(s,'instalar','sofa_rosa',gen_random_uuid());assert r->'casa'->'sala'->>'sofa'='sofa_rosa','house install';
 r:=public.patch_executar(s,'comprar_comida','banana',gen_random_uuid());assert (r->'alimentos'->>'banana')::int=1,'food stock';
 r:=public.patch_executar(s,'alimentar','banana',gen_random_uuid());assert (r->'alimentos'->>'banana')::int=0,'food consumption';
 update public.patch_estado set ultimas_acoes='{}' where story_id=s;
 r:=public.patch_executar(s,'dormir',null,gen_random_uuid());assert (r->>'dormindo')::boolean,'sleep';
 update public.patch_estado set atualizado_em=now()-interval '1 hour' where story_id=s;
 update public.mascote_casal set updated_at=now()-interval '1 hour',necessidades_at=now()-interval '1 hour' where story_id=s;
 r:=public.patch_executar(s,'comodo','banheiro',gen_random_uuid());assert not (r->>'dormindo')::boolean and (r->'necessidades'->>'sono')::numeric<60,'offline sleep before wake';
 update public.patch_estado set necessidades=necessidades||'{"higiene":20}',ultimas_acoes='{}',atualizado_em=now() where story_id=s;
end $$;
-- O tempo é ajustado apenas dentro da transação de teste para validar as janelas reais.
do $$ declare s uuid:=current_setting('patch.test_story')::uuid;c jsonb;r jsonb;pts jsonb;typ text;i int;b numeric;before_coins int;begin
 foreach typ in array array['banho','dentes','carinho'] loop
  c:=public.patch_cuidado_iniciar(s,typ);assert c->>'tipo'=typ,'care start';
  perform set_config('request.jwt.claim.sub',current_setting('patch.test_partner'),true);
  begin perform public.patch_cuidado_avancar((c->>'id')::uuid,'esfregar','[]');raise exception 'PARTNER CARE';exception when insufficient_privilege then null;end;
  perform set_config('request.jwt.claim.sub',current_setting('patch.test_user'),true);
  begin perform public.patch_cuidado_avancar((c->>'id')::uuid,case typ when 'banho' then 'esfregar' when 'dentes' then 'escovar' else 'acariciar' end,'[]');raise exception 'NO GESTURE';exception when raise_exception then if sqlerrm='NO GESTURE' then raise;end if;end;
  update public.patch_cuidados set iniciado_em=now()-interval '30 seconds' where id=(c->>'id')::uuid;
  for i in 1..case typ when 'banho' then 4 when 'dentes' then 3 else 1 end loop
   select jsonb_agg(jsonb_build_object('x',case when j%2=0 then .1 else .9 end,'y',.5,'t',(i-1)*900+100+j*100)) into pts from generate_series(0,7)j;
   r:=public.patch_cuidado_avancar((c->>'id')::uuid,case typ when 'banho' then 'esfregar' when 'dentes' then 'escovar' else 'acariciar' end,pts);
   assert (r->>'blocos_concluidos')::int=i,'validated care blocks';
  end loop;
  if typ='banho' then
   assert r->>'etapa'='enxaguar' and (r->>'higiene_preview')::numeric>=52,'progressive hygiene';
   begin perform public.patch_cuidado_avancar((c->>'id')::uuid,'secar','[]');raise exception 'WRONG STEP';exception when raise_exception then if sqlerrm='WRONG STEP' then raise;end if;end;
   update public.patch_cuidados set etapa_em=now()-interval '1 second' where id=(c->>'id')::uuid;r:=public.patch_cuidado_avancar((c->>'id')::uuid,'enxaguar','[]');
   update public.patch_cuidados set etapa_em=now()-interval '1 second' where id=(c->>'id')::uuid;r:=public.patch_cuidado_avancar((c->>'id')::uuid,'secar','[]');
  end if;
  assert (r->>'concluido')::boolean,'care finished';select moedas into before_coins from public.patch_estado where story_id=s;
  r:=public.patch_cuidado_avancar((c->>'id')::uuid,'qualquer','[]');assert (r->>'repetido')::boolean and (select moedas from public.patch_estado where story_id=s)=before_coins,'care final idempotent';
 end loop;
end $$;
do $$ declare s uuid:=current_setting('patch.test_story')::uuid;g jsonb;r jsonb;proof jsonb;typ text;coins int;begin
 foreach typ in array array['memoria','coracoes','estrelas','passeio'] loop
  update public.patch_partidas set iniciada_em=now()-interval '2 minutes' where story_id=s;
  g:=public.patch_partida_iniciar(s,typ,'normal');
  begin perform public.patch_executar(s,'comodo','sala',gen_random_uuid());raise exception 'ACTION DURING GAME';exception when raise_exception then if sqlerrm='ACTION DURING GAME' then raise;end if;end;
  if typ='memoria' then select jsonb_agg(pair) into proof from(select jsonb_agg(i)pair from generate_series(0,5)i group by g->'desafio'->'cartas'->i)q;
  elsif typ in('coracoes','passeio') then select jsonb_agg(jsonb_build_object('id',value->'id','em',(value->>'inicio')::int+1000)) into proof from jsonb_array_elements(g->'desafio'->'alvos');
  else select jsonb_agg((v::text::int)-300) into proof from jsonb_array_elements(g->'desafio'->'tempos')v;end if;
  begin perform public.patch_partida_finalizar((g->>'id')::uuid,proof);raise exception 'FAST REWARD';exception when raise_exception then if sqlerrm='FAST REWARD' then raise;end if;end;
  update public.patch_partidas set iniciada_em=now()-interval '20 seconds' where id=(g->>'id')::uuid;
  r:=public.patch_partida_finalizar((g->>'id')::uuid,proof);assert (r->>'premio')::int=case when typ='passeio' then 1 else 3 end,'valid game reward '||typ;
  select moedas into coins from public.patch_estado where story_id=s;r:=public.patch_partida_finalizar((g->>'id')::uuid,proof);assert (r->>'repetido')::boolean and (select moedas from public.patch_estado where story_id=s)=coins,'game no double settlement';
 end loop;
 update public.patch_estado set progresso=progresso||'{"alimentar":3,"banho":1,"carinho":3,"jogos":2,"coletas":10,"comprar_comida":1}' where story_id=s;
 r:=public.patch_executar(s,'resgatar_missao','refeicoes',gen_random_uuid());
 begin perform public.patch_executar(s,'resgatar_missao','refeicoes',gen_random_uuid());raise exception 'DOUBLE MISSION';exception when raise_exception then if sqlerrm='DOUBLE MISSION' then raise;end if;end;
 r:=public.patch_executar(s,'resgatar_conquista','primeira_compra',gen_random_uuid());
 begin perform public.patch_executar(s,'resgatar_conquista','primeira_compra',gen_random_uuid());raise exception 'DOUBLE ACHIEVEMENT';exception when raise_exception then if sqlerrm='DOUBLE ACHIEVEMENT' then raise;end if;end;
 update public.patch_estado set xp_pet=99,nivel_premiado=1,xp_legado_base=(select experiencia from public.mascote_casal where story_id=s),xp_hoje=0 where story_id=s;
 select moedas into coins from public.patch_estado where story_id=s;perform patch_privado.xp_dar(s,1);perform patch_privado.registrar(s,null,0);r:=public.patch_ler(s);assert (r->>'nivel')::int=2 and (r->>'moedas')::int=coins+5,'level bonus';perform public.patch_ler(s);assert (select moedas from public.patch_estado where story_id=s)=coins+5,'no repeat level bonus';
end $$;
do $$ declare s uuid:=current_setting('patch.test_story')::uuid;r jsonb;c jsonb;before_n int;begin
 update public.patch_estado set moedas=0,jogos_hoje=10 where story_id=s;
 select coalesce((alimentos->>'banana')::int,0) into before_n from public.patch_estado where story_id=s;
 begin perform public.patch_executar(s,'comprar_comida','banana',gen_random_uuid());raise exception 'OVERSPEND';exception when raise_exception then if sqlerrm='OVERSPEND' then raise;end if;end;
 assert (select (alimentos->>'banana')::int from public.patch_estado where story_id=s)=before_n,'failed purchase atomic';
 begin perform public.patch_partida_iniciar(s,'memoria','normal');raise exception 'DAILY GAME CAP';exception when raise_exception then if sqlerrm='DAILY GAME CAP' then raise;end if;end;
 update public.patch_estado set xp_hoje=100,ultimas_acoes='{}',comodo='sala' where story_id=s;assert patch_privado.xp_dar(s,99)=0,'daily XP cap';
 r:=public.patch_executar(s,'descansar',null,gen_random_uuid());
 begin perform public.patch_executar(s,'descansar',null,gen_random_uuid());raise exception 'REST COOLDOWN';exception when raise_exception then if sqlerrm='REST COOLDOWN' then raise;end if;end;
 c:=public.patch_cuidado_iniciar(s,'carinho');
 begin perform public.patch_cuidado_avancar((c->>'id')::uuid,'acariciar','[{"x":999,"y":0.5,"t":1},{"x":0,"y":0.5,"t":100},{"x":1,"y":0.5,"t":200},{"x":0,"y":0.5,"t":300},{"x":1,"y":0.5,"t":800}]');raise exception 'FORGED GESTURE';exception when raise_exception then if sqlerrm='FORGED GESTURE' then raise;end if;end;
 r:=public.patch_cuidado_cancelar((c->>'id')::uuid);assert r->'estado'->'cuidado_ativo'='null'::jsonb,'care cancelled and recoverable';
 assert not exists(select from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'patch_%' and p.prosecdef),'no exposed privileged entry';
 assert (select bool_and(relrowsecurity) from pg_class where oid in('public.patch_operacoes'::regclass,'public.patch_cuidados'::regclass)),'new tables RLS';
end $$;
do $$ declare s uuid:=current_setting('patch.test_story')::uuid;before_tid text;begin perform public.patch_ler(s);select ctid::text into before_tid from public.patch_estado where story_id=s;perform public.patch_ler(s);assert (select ctid::text from public.patch_estado where story_id=s)=before_tid,'read polling cannot generate Realtime feedback updates';end $$;
set local role anon;
do $$ begin begin perform public.patch_ler(current_setting('patch.test_story')::uuid);raise exception 'ANON';exception when insufficient_privilege then null;end;end $$;
reset role;
