# Nosso Patch — primeira versão jogável 2D

O Patch foi publicado na `main` com autorização do usuário (PR #10). As correções de controles são preparadas em `fix/patch-controles-toque`. As migrações `patch_jogo_2d_v1`, `patch_comidas_cuidados_v2` e `patch_controles_v3` estão instaladas no Supabase. Nenhuma história, foto, saldo anterior ou progresso pessoal foi excluído ou reiniciado.

## Como jogar

Acesse sua história, abra **Jogar com o Patch** e aguarde o cenário. O Patch mantém o nome, a experiência e as cinco idades do mascote existente. A evolução acontece nos níveis 1, 5, 10, 20 e 30; **Progresso** apresenta uma prévia sem seleção manual.

- **Sala:** carinho por toque, bola arrastável, dança e deslocamento pelo chão.
- **Cozinha:** abrir/fechar geladeira, selecionar entre seis alimentos do estoque e arrastar até o personagem; botões equivalentes disponíveis. A aba **Comidas** abre o mercadinho para comprar uma unidade por vez e mostra preço, saciedade e quantidade disponível.
- **Banheiro:** sabonete/arrastar para esfregar → chuveiro → toalha. O cuidado só é confirmado no final.
- **Quarto:** cama ou lâmpada alternam sono; o descanso é recuperado pelo tempo real, mesmo fora do site. Trocar efetivamente de cômodo acorda o Patch no servidor; tocar novamente no mesmo quarto mantém o sono.
- **Jardim:** flores, regador e bola interativos.
- **Passeio:** coleta de três corações durante 15 segundos; personagem caminha até os objetos.
- **Minijogos:** memória de três pares, oito corações caindo e saltos para coletar estrelas.
- **Loja/inventário:** quatro roupas/acessórios e três decorações; compra, equipar e retornar à aparência original.
- **Tarefas:** alimentar, dar banho e fazer carinho; presente e missão diários. Dias renovam à meia-noite UTC.

As animações usam os quadros originais como sprites Phaser, acrescidos de tweens, movimentos, partículas, alimentos, água e objetos interativos. A animação de comer usa quadros neutros e o ícone do alimento selecionado; os quadros antigos com cenoura desenhada não são usados no jogo 2D. Nenhum GIF é usado como mecanismo do cenário. Há tratamento de movimento reduzido. O áudio depende da autorização do navegador e do botão **Som**, cuja preferência é salva por conta usando o sistema existente.

## Progresso e economia

`mascote_casal` continua sendo a fonte do nome, XP, idade e estado de sono. As cinco necessidades variam com o tempo. Fome e sono brutos altos indicam necessidade; as barras visuais mostram saciedade e descanso, portanto barras cheias são boas. O jogo apresenta comportamento triste quando alguma necessidade está baixa.

`patch_estado` guarda necessidades precisas, cômodo, personalização, missões e uma carteira virtual **compartilhada**, independente da carteira individual usada nos cassinos/cuidados clássicos. Começa com 40 moedas; presente dá 8/dia, missão 10/dia, cada minijogo vencido até 3 e passeio completo 1. Não há aposta nem custo de entrada. Até 10 atividades premiadas e 100 XP novos por dia, com intervalos entre cuidados. Os cuidados dão moedas quando melhoram uma necessidade: alimentar e banho até 2; carinho, brincar, dança e regar até 1. Limite independente de 30 moedas por dia em cuidados, com intervalos por ação e renovação à meia-noite UTC. Dar banho não custa moedas. Alimentar consome um item comprado anteriormente. Os preços e as recompensas reais vêm do servidor.

`patch_estado.alimentos` guarda o estoque compartilhado, iniciando com três cenouras, duas maçãs e um leite; banana, morango e bolinho podem ser comprados. Cada alimento custa 2–6 moedas e recupera 18–35 de saciedade. Estoque máximo de 99 unidades por alimento, validado no servidor.

`patch_inventario` guarda compras; `patch_partidas` registra desafios, provas, validade e liquidação. Os dois integrantes leem o mesmo progresso. Realtime confirma mudanças, com consulta de segurança a cada 15 segundos enquanto visível. Ações também confirmam imediatamente o estado retornado pelo servidor. Falhas de rede não criam ganhos locais ou compras pendentes fictícias.

As tabelas têm RLS por participação na história e somente SELECT para o navegador autenticado. Escritas e recompensas passam por funções privadas com autorização, bloqueio por história e validação de preço/posse/tempo/prova; os wrappers públicos são SECURITY INVOKER e não aceitam valores de saldo/prêmio. Repetir uma liquidação não duplica moedas. Não há chave secreta no frontend. As provas e limites reduzem fraude; não representam proteção absoluta contra automação de um jogo executado no navegador.

## Arquivos

- `index.html`: montagem da área e ponte para Supabase, cuidados clássicos preservados em um painel recolhível, eventos de história/conta e preferência de som.
- `patch-game.js`, `patch-game.css`: controlador, cena Phaser, interações e interface.
- `patch/assets/`: seis cenários e cinco spritesheets; documentação de origem na pasta.
- `vendor/`: Phaser 3.90.0 fixado e licença MIT.
- `sql/patch-jogo-v1.sql` e `sql/patch-comidas-cuidados-v2.sql`: migrações instaladas em ordem; não executar novamente sem verificar histórico, pois cria objetos novos.
- `tests/patch-jogo.cjs`, `tests/patch-jogo.sql` e `tests/patch-comidas.sql`: testes do navegador e banco. `tests/preferencias-conta.cjs`: preferência de som incluída.
- `scripts/build-patch-sprites.py`: reconstrução dos sprites a partir dos GIFs originais.

## Validação e limites

Os testes SQL rodam na instalação real em BEGIN/ROLLBACK, usando participantes existentes apenas dentro da transação, sem exportar dados pessoais nem persistir alterações de teste. Verificam cuidados, preços, inventário, acesso dos dois membros, bloqueio de terceiros/anônimos, RLS, sono ao longo do tempo, limites, quatro atividades e liquidação idempotente. O teste adicional valida compra/consumo de alimentos, estoque compartilhado, saldo insuficiente, bloqueio de estoque vazio, limite de 99 unidades e recompensa diária dos cuidados.

Os testes Chromium usam um backend de teste e entradas reais de mouse/toque para cobrir telas de 320, 390 e 1280 px, mercadinho com seis alimentos, compra e consumo, moedas por cuidado, seis cômodos, arrastar alimento, banho em etapas, dormir, jardim, loja, missões, idades, atualização recebida, quatro atividades vencidas e derrota sem prêmio. Passaram também as suítes `pet-idades`, `interface-vidro`, `inicio-referencia`, `preferencias-conta`, `cassinos-expressoes` e `imagens-carregamento`. Isso não substitui uma sessão de duas pessoas em dispositivos físicos com autenticação real. iOS/Safari físico ainda não foi validado.

Para rodar o navegador: servir a raiz com `python -m http.server 8765 --bind 127.0.0.1`, disponibilizar Playwright e Chromium em `/usr/bin/chromium`, executar `node tests/patch-jogo.cjs`. O SQL de teste exige uma transação externa encerrada com ROLLBACK; nunca executar em autocommit. Os testes de interface existentes continuam separados.

Esta é uma primeira versão jogável com seis ambientes, três minijogos curtos, sete itens e uma missão diária composta. Novos conteúdos, missões variadas, móveis reposicionáveis e animação esquelética detalhada permanecem evoluções futuras. Os acessórios atuais são sobreposições programadas; as roupas originais de cada idade são preservadas nos sprites. Não há gravação/repetição de voz.

A consulta aos advisors após a migração não apontou novos avisos relativos a `patch_*`. Existem avisos anteriores fora deste escopo, incluindo [search_path de função antiga](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) e [funções públicas SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable); não foram alteradas funções antigas de outras áreas.

O jogo usa Talking Tom como referência para o ciclo de cuidar, alternar cômodos e progredir, mantendo personagem e cenários próprios. Não replica todo o catálogo de funcionalidades ou conteúdo de Talking Tom.

## Controles de toque e banho

Deslizar verticalmente sobre o cenário rola a página. Toques só são aceitos ao soltar, com limite de deslocamento; um gesto de rolagem não faz carinho nem alimenta acidentalmente. O canvas não bloqueia eventos de toque ou roda do mouse por padrão. O modo **Mover objetos** centraliza o cenário, permite arrastar e volta à rolagem normal ao soltar ou mudar de cômodo. Comidas, bola, regador e ferramentas também funcionam por toque, sem precisar arrastar.

Os botões de ação têm ícones, títulos e estado. Os intervalos são calculados pelo servidor e aparecem como contadores. Banho: **Ensaboar → Enxaguar → Secar**, com espuma, água e toalha animadas. Cada etapa só libera a seguinte ao concluir; trocar de cômodo, abrir outro painel ou repetir o comando durante a animação é bloqueado. O servidor só confirma e recompensa o banho depois da secagem; falha de rede permite tentar a secagem novamente.

`tests/patch-controles.cjs` usa gestos de toque CDP reais em Chromium para verificar rolagem, arraste, ausência de cuidado acidental, seis alimentos corretos, despertar, banho sequencial e contadores em 320/390/1280 px. As sessões/RPCs do navegador são simuladas; as regras reais do Supabase são verificadas em transações revertidas por `tests/patch-controles.sql` junto às suítes SQL anteriores.
