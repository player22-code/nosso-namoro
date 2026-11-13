# Patch — jogo integrado ao Nossa História

A implementação de produção está preparada na branch `feat/patch-producao` para revisão por Pull Request. A `main` não é alterada automaticamente. As correções do PR #11 também estão incluídas nesta branch. O pacote `Patch_Jogo_Completo/` foi auditado e preservado integralmente.

## O que está implementado

- Phaser 3.90.0 dentro da área original do Patch, com seis cômodos, transições, personagem do pacote, objetos manipuláveis e navegação do site preservada.
- Máquina exclusiva com 14 estados, respiração, piscadas espontâneas, humor por necessidades, sono e despertar. As linhas estáticas recebem movimento programado. A animação de alimentação usa quadros neutros e o alimento selecionado, evitando o alimento laranja embutido na arte original.
- Cozinha com geladeira, estoque compartilhado, seis alimentos e alimentação por toque ou arraste válido até a boca. Soltar fora não consome o item.
- Banho por quatro blocos de gestos reais, higiene progressiva, enxágue e secagem; escovação com três blocos na boca; carinho por gesto. O servidor valida duração, distância, ordem, área, autoria, intervalo e conclusão. Há alternativa por teclado.
- Sala com bola, ursinho desbloqueável, dança, carinho e descanso; quarto com luz/cama e recuperação offline por timestamps; jardim com rega e borboletas; passeio com movimentação e coleta.
- Cinco necessidades, incluindo energia, com valores limitados, desgaste temporal limitado e sem morte permanente.
- Seis categorias de loja, confirmação de compra, estoque, inventário, itens por nível, roupas/acessórios alinhados ao personagem e instalação de móveis/decoração por cômodo. Seleções persistentes.
- XP com curva crescente, preservação do nível antigo na migração, recompensa única por nível, comemoração, missões diárias individuais e conquistas permanentes com datas e resgates protegidos.
- Três minijogos: corações por movimentação/colisão; memória com imagens, movimentos e tempo; percurso com obstáculos, saltos, colisões e três vidas. Cada um tem instruções, dificuldade, pontuação, resultado, recompensa confirmada, reinício e retorno. Há tratamento de falha de rede ao confirmar e cancelamento de partidas abandonadas.
- 26 efeitos WAV do pacote com volume, mute por conta, respeito ao autoplay e limite de vozes. Não foram adicionadas músicas de terceiros.
- Rolagem vertical nativa sobre o canvas por padrão. **Mover objetos** centraliza o cenário e permite arraste; ao soltar ou mudar de cômodo volta a rolar normalmente. Os cuidados por gesto usam esse modo explicitamente. Modais nativos respeitam a altura da tela e ficam acima da navegação fixa.

## Organização

`patch-game.js` coordena a integração com o site. Os módulos em `patch-game/` separam assets, áudio, personagem/estados, necessidades, nível, salvamento idempotente, cuidados por gestos, painéis, cena da casa e minijogos. Não há build ou servidor de aplicação novo: continua sendo um site estático com Supabase.

`AUDITORIA-PATCH.md` registra o inventário real, limitações dos GIFs/sprites e origem dos vetores adicionais. Os cenários verticais detalhados já existentes foram reaproveitados; a prancha conceitual não foi usada como objetos recortados. Quarenta objetos SVG originais transparentes complementam os cartões opacos do pacote. Os GIFs originais permanecem disponíveis, mas não controlam o jogo.

## Persistência, migração e segurança

A história (`story_id`) continua identificando o pet compartilhado; `story_members` determina quem pode acessá-lo. Auth, fotos, chat, histórias, cassinos, planos e carteiras individuais não foram substituídos.

As migrações V1, V2 e V3 já existem no projeto conectado. **A V4 está preparada e testada, mas não aplicada permanentemente.** Ela deve ser implantada junto com o frontend desta branch. Não execute a V4 duas vezes.

A V4 acrescenta XP progressivo, estatísticas, missões, conquistas, casa e itens equipados a `patch_estado`; mantém `mascote_casal` e o XP antigo para migração sem redução de nível. Acrescenta `patch_operacoes` para idempotência e `patch_cuidados` para sessões de interação. Mantém inventário, desafios e liquidação de partidas existentes. Novas tabelas têm RLS e apenas leitura para o navegador autenticado; comandos passam por wrappers INVOKER e funções privadas autorizadas, com `search_path` fixo, transação e bloqueio da história.

O servidor calcula preços, posse, desbloqueios, necessidades, prêmios e XP. UUIDs de operação são reutilizados após falha de rede para não debitar duas vezes. A carteira do Patch é independente dos cassinos. Limites: até 30 moedas/dia em cuidados, 10 atividades premiadas/dia, 100 XP/dia, cooldowns e estoque máximo de 99 unidades por alimento. A renovação diária usa meia-noite UTC. O progresso só é apresentado como confirmado após resposta do servidor; não há economia local como substituto da nuvem.

As provas de movimentos e jogos validam plausibilidade e limites, mas não constituem proteção absoluta contra automação de um navegador controlado pelo usuário.

## Implantação após revisão

1. Rever o PR e `sql/patch-jogo-producao-v4.sql`; confirmar backup/migrações V1–V3 existentes no ambiente de destino.
2. Em uma janela conjunta, aplicar a V4 no Supabase e publicar o frontend aprovado pelo fluxo normal de GitHub Pages. **Não aplicar a V4 isoladamente mantendo a interface antiga por longo período:** o banho novo exige o protocolo interativo.
3. Confirmar a conclusão do deploy, atualizar abas antigas e testar duas contas reais do mesmo casal. Nenhuma chave secreta é necessária no frontend.
4. Não executar os arquivos de testes SQL em autocommit: são preparados para uma transação externa encerrada obrigatoriamente com `ROLLBACK`.

## Testes executados e limites

- `scripts/validar-patch-assets.py`: inventário, dimensões, quadros, transparência e áudio do pacote real.
- `tests/patch-producao.cjs`: Chromium com assets reais e sessões/RPCs simuladas em 320, 390 e 1280 px: 14 estados, necessidades/energia, XP, seis categorias, confirmação de compras, roupas/casa, missões/conquistas, som/volume, ausência de arquivos quebrados e overflow. Gestos reais de ponteiro para banho/dentes/carinho e reenvio do mesmo UUID após uma desconexão posterior ao débito em 390 px.
- `tests/patch-minigames.cjs`: Phaser real, três jogos, colisões, memória, relógio, vitória/derrota, reinício, cancelamento e repetição da mesma confirmação após erro de rede.
- `tests/patch-runtime.mjs`: UUID idempotente e isolamento de respostas atrasadas de cuidados após troca de conta.
- `tests/patch-producao.sql`: executado no Supabase real junto à V4 dentro de `BEGIN/ROLLBACK`, com história temporária e participantes existentes sem exportar identificadores. Cobriu migração de nível, preços, resgates e comandos duplicados, parceiro, terceiro, anon, RLS, roupa/casa, alimentos, sono/despertar, gestos/ordem/progresso de higiene, cuidados repetidos, quatro atividades e bônus de nível. Nada do teste foi persistido.
- Regressões existentes de início, preferências de conta e carregamento de imagens executadas separadamente. Também passou a verificação de interface em 844 × 390 (horizontal).

Ainda não foram validados iPhone/Safari físico, duas pessoas autenticadas em dispositivos físicos, Realtime através de redes reais nem uma corrida simultânea de conexões reais. A validação do banco cobre os dois papéis e a idempotência em sequência; a concorrência usa transações/bloqueios, mas requer validação operacional após implantação. Arte esquelética detalhada e novos conteúdos continuam sendo possíveis melhorias; não são apresentados como implementados.

O carregamento do Phaser e do palco ocorre ao aproximar o Patch da viewport; o carregador exibe progresso e permite tentar novamente após falhas. Os recursos do jogo (sheet, vetores, sons curtos e seis fundos) são pré-carregados para transições imediatas; não se alega streaming individual de cada cômodo. Não há Service Worker novo nem cache público de fotos privadas.
