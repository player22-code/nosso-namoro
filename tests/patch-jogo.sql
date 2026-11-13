-- Executar após o schema na MESMA transação e encerrar com ROLLBACK.
-- Usa identificadores existentes sem os exportar; nenhuma alteração é persistida.
do $$ declare s uuid;u uuid;v uuid;begin
 select story_id into strict s from public.story_members group by story_id having count(distinct user_id)>=2 limit 1;
 select min(user_id::text)::uuid,max(user_id::text)::uuid into u,v from public.story_members where story_id=s;
 perform set_config('patch.test_story',s::text,true);perform set_config('patch.test_user',u::text,true);perform set_config('patch.test_partner',v::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.patch_ler(s);
 update public.mascote_casal set fome=65,sono=70,estado='feliz',updated_at=now(),necessidades_at=now() where story_id=s;
 update public.patch_estado set moedas=40,necessidades='{"fome":65,"higiene":30,"sono":70,"diversao":45,"carinho":40}',atualizado_em=now() where story_id=s;
end $$;
set local role authenticated;
do $$ declare s uuid:=current_setting('patch.test_story')::uuid;v jsonb;before_coins int;begin
 v:=public.patch_ler(s);assert (v->>'moedas')::int=40,'initial wallet';
 begin update public.patch_estado set moedas=99999 where story_id=s;raise exception 'CLIENT WRITE ALLOWED';exception when insufficient_privilege then null;end;
 begin perform public.patch_acao(s,'vestir','pijama_lilas');raise exception 'UNOWNED EQUIP ALLOWED';exception when raise_exception then if sqlerrm='UNOWNED EQUIP ALLOWED' then raise;end if;end;
 v:=public.patch_acao(s,'alimentar','cenoura');assert (v->>'moedas')::int=39 and (v->'necessidades'->>'fome')::numeric=40,'feed';
 begin perform public.patch_acao(s,'alimentar','cenoura');raise exception 'COOLDOWN BYPASS';exception when raise_exception then if sqlerrm='COOLDOWN BYPASS' then raise;end if;end;
 v:=public.patch_acao(s,'banho');assert (v->>'moedas')::int=38 and (v->'necessidades'->>'higiene')::numeric=75,'bath';
 v:=public.patch_acao(s,'carinho');assert (v->'necessidades'->>'carinho')::numeric=62,'care';
 v:=public.patch_acao(s,'missao');assert (v->>'moedas')::int=48,'mission';
 begin perform public.patch_acao(s,'missao');raise exception 'DOUBLE MISSION';exception when raise_exception then if sqlerrm='DOUBLE MISSION' then raise;end if;end;
 v:=public.patch_acao(s,'presente');assert (v->>'moedas')::int=56,'gift';
 begin perform public.patch_acao(s,'presente');raise exception 'DOUBLE GIFT';exception when raise_exception then if sqlerrm='DOUBLE GIFT' then raise;end if;end;
 v:=public.patch_acao(s,'comprar','camiseta_rosa');assert (v->>'moedas')::int=38,'server price';
 v:=public.patch_acao(s,'vestir','camiseta_rosa');assert v->>'roupa'='camiseta_rosa','equip';
 v:=public.patch_acao(s,'comprar','vaso_rosa');v:=public.patch_acao(s,'decorar','vaso_rosa');assert v->>'decoracao'='vaso_rosa','decor';
 perform set_config('request.jwt.claim.sub',current_setting('patch.test_partner'),true);
 v:=public.patch_ler(s);assert v->>'roupa'='camiseta_rosa' and (v->>'moedas')::int=24,'partner shared';
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
 assert not exists(select from public.patch_estado where story_id=s),'outsider RLS';
 begin perform public.patch_ler(s);raise exception 'OUTSIDER ALLOWED';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',current_setting('patch.test_user'),true);
 v:=public.patch_acao(s,'dormir');assert (v->>'dormindo')::boolean,'sleep';
end $$;
reset role;
update public.patch_estado set atualizado_em=now()-interval '1 hour' where story_id=current_setting('patch.test_story')::uuid;
update public.mascote_casal set updated_at=now()-interval '1 hour',necessidades_at=now()-interval '1 hour' where story_id=current_setting('patch.test_story')::uuid;
set local role authenticated;
do $$ declare s uuid:=current_setting('patch.test_story')::uuid;v jsonb;begin
 v:=public.patch_ler(s);assert (v->'necessidades'->>'sono')::numeric=52,'sleep recovers over time';
 perform public.patch_acao(s,'acordar');
end $$;
reset role;
-- Cada partida passa pelo gerador real e valida prova/tempo/dono/idempotência.
do $$ declare s uuid:=current_setting('patch.test_story')::uuid;g jsonb;r jsonb;proof jsonb;typ text;before_coins int;begin
 foreach typ in array array['memoria','coracoes','estrelas','passeio'] loop
  update public.patch_partidas set iniciada_em=now()-interval '1 minute' where story_id=s;
  g:=public.patch_partida_iniciar(s,typ);
  if typ='memoria' then
   select jsonb_agg(pair) into proof from (select jsonb_agg(i) pair from generate_series(0,5)i group by g->'desafio'->'cartas'->i)q;
  elsif typ in('coracoes','passeio') then
   select jsonb_agg(jsonb_build_object('id',value->'id','em',(value->>'inicio')::int+700)) into proof from jsonb_array_elements(g->'desafio'->'alvos');
  else proof:='[1700,3300,4900,6500,8100,9700,11300]';end if;
  begin perform public.patch_partida_finalizar((g->>'id')::uuid,proof);raise exception 'FAST REWARD';exception when raise_exception then if sqlerrm='FAST REWARD' then raise;end if;end;
  update public.patch_partidas set iniciada_em=now()-interval '20 seconds' where id=(g->>'id')::uuid;
  select moedas into before_coins from public.patch_estado where story_id=s;
  r:=public.patch_partida_finalizar((g->>'id')::uuid,proof);assert (r->>'premio')::int=case when typ='passeio' then 1 else 3 end,'valid game reward '||typ;
  r:=public.patch_partida_finalizar((g->>'id')::uuid,proof);assert (r->>'repetido')::boolean,'idempotency';
  assert (select moedas from public.patch_estado where story_id=s)=before_coins+case when typ='passeio' then 1 else 3 end,'no double settlement';
 end loop;
 update public.patch_estado set jogos_hoje=10 where story_id=s;
 begin perform public.patch_partida_iniciar(s,'memoria');raise exception 'CAP BYPASS';exception when raise_exception then if sqlerrm='CAP BYPASS' then raise;end if;end;
end $$;
do $$ declare s uuid:=current_setting('patch.test_story')::uuid;g jsonb;r jsonb;before_coins int;begin
 update public.patch_estado set jogos_hoje=0,xp_hoje=99,ultimas_acoes='{}' where story_id=s;
 perform public.patch_acao(s,'carinho');assert (select xp_hoje from public.patch_estado where story_id=s)=100,'XP cap';
 update public.patch_partidas set iniciada_em=now()-interval '1 minute' where story_id=s;
 g:=public.patch_partida_iniciar(s,'coracoes');
 perform set_config('request.jwt.claim.sub',current_setting('patch.test_partner'),true);
 begin perform public.patch_partida_finalizar((g->>'id')::uuid,'[]');raise exception 'PARTNER SETTLED OTHER GAME';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',current_setting('patch.test_user'),true);
 update public.patch_partidas set iniciada_em=now()-interval '20 seconds' where id=(g->>'id')::uuid;
 select moedas into before_coins from public.patch_estado where story_id=s;
 r:=public.patch_partida_finalizar((g->>'id')::uuid,'[]');assert (r->>'premio')::int=0,'loss no reward';assert (select moedas from public.patch_estado where story_id=s)=before_coins,'loss preserves coins';
end $$;
set local role anon;
do $$ begin
 begin perform public.patch_ler(current_setting('patch.test_story')::uuid);raise exception 'ANON EXECUTE ALLOWED';exception when insufficient_privilege then null;end;
end $$;
reset role;
