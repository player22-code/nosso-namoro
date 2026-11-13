# Nosso Patch — primeira versão jogável 2D

Implementação isolada na branch `feat/patch-jogo-2d`. Não fazer merge/publicação automática. A migração aditiva `patch_jogo_2d_v1` já foi aplicada no Supabase conectado; o site em `main` continua com sua interface anterior. Nenhuma história, foto, saldo anterior ou progresso pessoal foi excluído ou reiniciado.

## Como jogar

Acesse sua história, abra **Nosso pet** e aguarde o cenário. O Patch mantém o nome, a experiência e as cinco idades do mascote existente. A evolução acontece nos níveis 1, 5, 10, 20 e 30; **Progresso** apresenta uma prévia sem seleção manual.

- **Sala:** carinho por toque, bola arrastável, dança e deslocamento pelo chão.
- **Cozinha:** abrir/fechar geladeira, selecionar alimentos e arrastar até o personagem; botões equivalentes disponíveis.
- **Banheiro:** sabonete/arrastar para esfregar → chuveiro → toalha. O cuidado só é confirmado no final.
- **Quarto:** cama ou lâmpada alternam sono; o descanso é recuperado pelo tempo real, mesmo fora do site.
- **Jardim:** flores, regador e bola interativos.
- **Passeio:** coleta de três corações durante 15 segundos; personagem caminha até os objetos.
- **Minijogos:** memória de três pares, oito corações caindo e saltos para coletar estrelas.
- **Loja/inventário:** quatro roupas/acessórios e três decorações; compra, equipar e retornar à aparência original.
- **Tarefas:** alimentar, dar banho e fazer carinho; presente e missão diários. Dias renovam à meia-noite UTC.

As animações usam os quadros originais como sprites Phaser, acrescidos de tweens, movimentos, partículas, alimentos, água e objetos interativos. Nenhum GIF é usado como mecanismo do cenário. Há tratamento de movimento reduzido. O áudio depende da autorização do navegador e do botão **Som**, cuja preferência é salva por conta usando o sistema existente.

## Progresso e economia

`mascote_casal` continua sendo a fonte do nome, XP, idade e estado de sono. As cinco necessidades variam com o tempo. Fome e sono brutos altos indicam necessidade; as barras visuais mostram saciedade e descanso, portanto barras cheias são boas. O jogo apresenta comportamento triste quando alguma necessidade está baixa.

`patch_estado` guarda necessidades precisas, cômodo, personalização, missões e uma carteira virtual **compartilhada**, independente da carteira individual usada nos cassinos/cuidados clássicos. Começa com 40 moedas; presente dá 8/dia, missão 10/dia, cada minijogo vencido até 3 e passeio completo 1. Não há aposta nem custo de entrada. Até 10 atividades premiadas e 100 XP novos por dia, com intervalos entre cuidados. Alimento custa 1–2 e banho 1. Os preços reais vêm do servidor.

`patch_inventario` guarda compras; `patch_partidas` registra desafios, provas, validade e liquidação. Os dois integrantes leem o mesmo progresso. Realtime confirma mudanças, com consulta de segurança a cada 15 segundos enquanto visível. Ações também confirmam imediatamente o estado retornado pelo servidor. Falhas de rede não criam ganhos locais ou compras pendentes fictícias.

As tabelas têm RLS por participação na história e somente SELECT para o navegador autenticado. Escritas e recompensas passam por funções privadas com autorização, bloqueio por história e validação de preço/posse/tempo/prova; os wrappers públicos são SECURITY INVOKER e não aceitam valores de saldo/prêmio. Repetir uma liquidação não duplica moedas. Não há chave secreta no frontend. As provas e limites reduzem fraude; não representam proteção absoluta contra automação de um jogo executado no navegador.

## Arquivos

- `index.html`: montagem da área e ponte para Supabase, cuidados clássicos preservados em um painel recolhível, eventos de história/conta e preferência de som.
- `patch-game.js`, `patch-game.css`: controlador, cena Phaser, interações e interface.
- `patch/assets/`: seis cenários e cinco spritesheets; documentação de origem na pasta.
- `vendor/`: Phaser 3.90.0 fixado e licença MIT.
- `sql/patch-jogo-v1.sql`: migração instalada; não executar novamente sem verificar histórico, pois cria objetos novos.
- `tests/patch-jogo.cjs`, `tests/patch-jogo.sql`: testes do navegador e banco. `tests/preferencias-conta.cjs`: preferência de som incluída.
- `scripts/build-patch-sprites.py`: reconstrução dos sprites a partir dos GIFs originais.

## Validação e limites

Os testes SQL rodam na instalação real em BEGIN/ROLLBACK, usando participantes existentes apenas dentro da transação, sem exportar dados pessoais nem persistir alterações de teste. Verificam cuidados, preços, inventário, acesso dos dois membros, bloqueio de terceiros/anônimos, RLS, sono ao longo do tempo, limites, quatro atividades e liquidação idempotente.

Os testes Chromium usam um backend de teste e entradas reais de mouse/toque para cobrir telas de 320, 390 e 1280 px, seis cômodos, arrastar alimento, banho em etapas, dormir, jardim, loja, missões, idades, atualização recebida, quatro atividades vencidas e derrota sem prêmio. Passaram também as suítes `pet-idades`, `interface-vidro`, `inicio-referencia`, `preferencias-conta`, `cassinos-expressoes` e `imagens-carregamento`. Isso não substitui uma sessão de duas pessoas em dispositivos físicos com autenticação real. iOS/Safari físico ainda não foi validado.

Para rodar o navegador: servir a raiz com `python -m http.server 8765 --bind 127.0.0.1`, disponibilizar Playwright e Chromium em `/usr/bin/chromium`, executar `node tests/patch-jogo.cjs`. O SQL de teste exige uma transação externa encerrada com ROLLBACK; nunca executar em autocommit. Os testes de interface existentes continuam separados.

Esta é uma primeira versão jogável com seis ambientes, três minijogos curtos, sete itens e uma missão diária composta. Novos conteúdos, missões variadas, móveis reposicionáveis e animação esquelética detalhada permanecem evoluções futuras. Os acessórios atuais são sobreposições programadas; as roupas originais de cada idade são preservadas nos sprites. Não há gravação/repetição de voz.

A consulta aos advisors após a migração não apontou novos avisos relativos a `patch_*`. Existem avisos anteriores fora deste escopo, incluindo [search_path de função antiga](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) e [funções públicas SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable); não foram alteradas funções antigas de outras áreas.
