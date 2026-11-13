-- Executar depois de patch-jogo.sql na mesma transação, finalizando com ROLLBACK.
do $$ declare s uuid:=current_setting('patch.test_story')::uuid;v jsonb;b int;begin
 update public.patch_estado set ultimas_acoes='{}',alimentos='{"cenoura":0,"maca":0,"leite":0,"banana":0,"morango":0,"bolinho":0}',moedas=40,recompensas_cuidados=0,necessidades='{"fome":80,"higiene":20,"sono":40,"diversao":20,"carinho":20}' where story_id=s;
 update public.mascote_casal set estado='feliz',updated_at=now() where story_id=s;
 begin perform public.patch_acao(s,'alimentar','cenoura');raise exception 'EMPTY STOCK ALLOWED';exception when raise_exception then if sqlerrm='EMPTY STOCK ALLOWED' then raise;end if;end;
 v:=public.patch_acao(s,'comprar_comida','banana');assert (v->'alimentos'->>'banana')::int=1 and (v->>'moedas')::int=37,'buy food authoritative price';
 v:=public.patch_acao(s,'alimentar','banana');assert (v->'alimentos'->>'banana')::int=0 and (v->>'moedas')::int=39 and (v->>'recompensa_acao')::int=2,'consume and reward';
 begin perform public.patch_acao(s,'comprar_comida','inventado');raise exception 'UNKNOWN FOOD ALLOWED';exception when raise_exception then if sqlerrm='UNKNOWN FOOD ALLOWED' then raise;end if;end;
 update public.patch_estado set alimentos=alimentos||'{"maca":99}' where story_id=s;
 begin perform public.patch_acao(s,'comprar_comida','maca');raise exception 'STOCK CAP BYPASS';exception when raise_exception then if sqlerrm='STOCK CAP BYPASS' then raise;end if;end;
 select moedas into b from public.patch_estado where story_id=s;
 update public.patch_estado set recompensas_cuidados=29 where story_id=s;
 v:=public.patch_acao(s,'banho');assert (v->>'recompensa_acao')::int=1 and (v->>'moedas')::int=b+1 and (v->>'recompensas_cuidados')::int=30,'daily care coin cap';
 v:=public.patch_acao(s,'carinho');assert (v->>'recompensa_acao')::int=0 and (v->>'moedas')::int=b+1,'no reward past cap';
 -- A mudança de dia em minijogos não bloqueia a renovação independente dos cuidados.
 update public.patch_estado set dia=(now() at time zone 'UTC')::date,dia_cuidados=(now() at time zone 'UTC')::date-1,ultimas_acoes='{}' where story_id=s;
 v:=public.patch_acao(s,'carinho');assert (v->>'recompensa_acao')::int=1 and (v->>'recompensas_cuidados')::int=1,'care day resets independently';
 perform set_config('request.jwt.claim.sub',current_setting('patch.test_partner'),true);
 v:=public.patch_ler(s);assert (v->'alimentos'->>'maca')::int=99,'shared food inventory';
 perform set_config('request.jwt.claim.sub',current_setting('patch.test_user'),true);
 update public.patch_estado set moedas=0 where story_id=s;
 begin perform public.patch_acao(s,'comprar_comida','bolinho');raise exception 'OVERSPEND';exception when raise_exception then if sqlerrm='OVERSPEND' then raise;end if;end;
 assert (select (alimentos->>'bolinho')::int from public.patch_estado where story_id=s)=0,'failed buy rolled back';
end $$;
