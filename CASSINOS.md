# Cassinos do Amor e do Girinnho

A aba Jogos mantém uma entrada para cada cassino. A nova janela apresenta os dois lado a lado no computador e um seletor de tema no celular. Início, Planos, Bônus, Perfil, o botão + da carteira e Fechar acionam controles reais do site existente. A imagem enviada pelo usuário foi preservada como `cassinos-referencia.jpg`: janelas CSS reaproveitam seus cabeçalhos e símbolos; as grades, resultados, controles e saldo são elementos independentes e interativos.

## Arquivos localizados

O `index.html` original já possuía um Cassino do Amor com arte de tigre e um Girininho acessível por `/girininho777`. Foram encontrados personagens e animações do coelho em `cassino/`, temas em `assets/`, cenários em `imagens/`, GIFs do personagem masculino (`cucoparado.gif`, `cucofeliz.gif`, `cucotriste.gif`) e vários PNG, WAV, OGG e WebM na raiz. Os WebM de tigre não são usados no novo tema. O comando secreto foi preservado.

Não foram encontrados no checkout, nos diretórios acessíveis do ambiente ou nos anexos disponibilizados:

- `index_cassinos_mesma_pasta.html`
- `cassinos_coelhinho_girinnho_animacoes_e_sons.zip`
- `nossa_historia_coelho_girinnho_github.zip`

Não há PNG dedicado do personagem masculino nem GIF exclusivo de supervitória dele. O cabeçalho enviado mostra esse personagem; suas reações usam os três GIFs existentes. A supervitória combina `cucofeliz.gif`, moedas e destaque animado. Não foram inventados arquivos, personagens ou animações ausentes.

## Mudanças e recursos

- `index.html`: substitui apenas os dois antigos diálogos/controladores dos cassinos, acrescenta a segunda entrada visível e carrega o novo CSS/JS. Todos os oito scripts anteriores fora dos cassinos foram mantidos integralmente. Fotos, histórias, chat, músicas, planos, mascote, quiz e compatibilidade permanecem no arquivo.
- `cassinos.js` e `cassinos.css`: interface, animações, ajustes de 1 a 3 moedas, áudio, giro manual, até 10 giros automáticos, validação de respostas e navegação.
- `cassinos-referencia.jpg`: imagem anexada pelo usuário, copiada sem edição.
- `coelho_parado.png`, `coelho_idle.gif`, `coelho_vitoria.gif`, `coelho_derrota.gif`, `coelho_grande_vitoria.gif`: cópias dos recursos existentes em `cassino/` para cumprir a colocação na raiz. Os originais foram preservados.
- `simbolo_coracao.png`, `simbolo_moeda.png`, `simbolo_trevo.png`: cópias dos símbolos existentes para a raiz. Os demais símbolos usam a referência ou `ft_ouro.png`, `ft_fogos.png` e `ft_cartas.png`, já existentes na raiz.
- GIFs reaproveitados sem novas cópias: `cucoparado.gif`, `cucofeliz.gif`, `cucotriste.gif` e `chuva_moedas.gif`.
- Sons reaproveitados sem novas cópias: `01_clique_botao.wav`, `18_abrir_menu.wav`, `02_iniciar_rodada.wav`, `03_roleta_girando.wav`, `04_roleta_parando.wav`, `14_moeda_caindo.wav`, `06_vitoria_pequena.wav`, `09_super_win.wav`, `05_sem_premio.wav`; música `bgsound.ogg`.
- `tests/cassinos.cjs` e `tests/verify-assets.py`: verificações reproduzíveis.

Todos os recursos utilizados pelos cassinos ficam na mesma pasta de `index.html`. Nenhum recurso pessoal anterior foi apagado ou sobrescrito. Nenhum novo som foi gerado. Apenas as cópias necessárias à exigência de raiz foram adicionadas.

## Carteira e regras

A integração conserva `nh_meu_saldo` e `cassino_girar` no Supabase. Não há saldo fictício de produção, gravação de moedas no localStorage, compra de fichas ou crédito feito pelo navegador. O RPC recebe a história autenticada e `p_aposta` de 1, 2 ou 3, os valores já oferecidos no site anterior. Um único giro pode estar pendente entre os dois temas; Fechar e parar Auto continuam disponíveis. Alterações de conta/história descartam respostas antigas da interface.

A tabela mantém as regras já descritas no site: três linhas horizontais, sequências iguais contadas a partir da esquerda, 3/4/5 iguais pagando 3×/7×/15× por linha. Os prêmios das linhas se somam e o custo é descontado uma vez. A palavra WILD é parte da arte, sem regra de substituição. O servidor continua sendo a autoridade: a interface verifica o prêmio recebido e interrompe Auto se houver divergência, sem criar ou corrigir créditos por conta própria.

Auto precisa ser acionado pelo usuário e para ao completar 10 giros, sair, trocar de tema, ocultar a página, trocar de conta/história, ocorrer um erro ou faltar saldo. Parar não cancela o RPC de uma rodada já enviada; nenhuma falha é repetida automaticamente. Sons começam após ativação e falhas de autorização do navegador são tratadas. A música do site é pausada durante a janela e retomada ao sair se estava tocando.

## Validação e limites

Execute na raiz:

```sh
node --check cassinos.js
python tests/verify-assets.py
python -m http.server 8765 --bind 127.0.0.1
# Em outro terminal, com Playwright e Chromium disponíveis:
node tests/cassinos.cjs
```

Resultado executado: PASS em 1280×900, 390×844 e 320×640, sem erros JavaScript nem recursos locais ausentes nas sessões de teste. A verificação estática confirmou 24 recursos usados pelo controlador/CSS, GIFs de personagens animados e decodificação dos cabeçalhos de imagem/WAV. Todos os scripts inline restantes passaram em `node --check`.

O teste do navegador usa respostas simuladas do Supabase, explicitamente limitadas ao navegador de teste. Ele verifica desktop 1280×900 e celular 390×844 e 320×640: grades 5×3, abrir/fechar, foco e Escape, +/−, GIRAR, animação/resultado estável, linhas de 3/4/5, soma de linhas, erro e resposta inválida, bloqueio de giro concorrente, parada e limite de Auto, falta de saldo, áudio, imagens e caminhos, atalhos de navegação e controles anteriores de interface.

Limite: não foi disponibilizada uma sessão autenticada do site ou acesso administrativo ao Supabase. Estes testes não comprovam a implementação SQL, probabilidades reais, saldo/crédito real, OAuth, envio de fotos, chat ao vivo, checkout ou serviços externos. As funções anteriores foram preservadas e seus controles de interface foram verificados onde indicado. Revisar o RPC real autenticado antes de mesclar, especialmente a tabela de prêmios. Não houve migração de banco, publicação do site ou alteração direta da `main`.
