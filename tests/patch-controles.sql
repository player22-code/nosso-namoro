-- Depois de patch-jogo.sql, na mesma transação de teste encerrada por ROLLBACK.
do $$ declare s uuid:=current_setting('patch.test_story')::uuid;v jsonb;begin
 perform public.patch_acao(s,'dormir');v:=public.patch_acao(s,'comodo','quarto');assert (v->>'dormindo')::boolean,'same room preserves sleep';
 v:=public.patch_acao(s,'comodo','cozinha');assert not (v->>'dormindo')::boolean and v->>'comodo'='cozinha','room transition wakes';
 update public.patch_estado set ultimas_acoes='{}' where story_id=s;
 v:=public.patch_acao(s,'carinho');assert (v->'esperas'->>'carinho')::int between 14 and 15,'authoritative cooldown returned';
end $$;
