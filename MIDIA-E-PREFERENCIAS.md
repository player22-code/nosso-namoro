# Imagens, preferências e chamadas

## Carregamento

As miniaturas de Compartilhar Memórias acompanham a chegada de cada foto. Enquanto o download privado está pendente, o botão mostra “Carregando foto…”. A seleção e os elementos já carregados são preservados. Requisições simultâneas compartilham o mesmo download, uploads reutilizam o arquivo local e respostas de uma história anterior ou de uma sessão encerrada não repovoam o cache.

Os bytes dos GIFs de reação e do cabeçalho são reaproveitados. Cada repetição recebe um Blob URL novo para reiniciar a animação, sem acrescentar parâmetros que forcem outro download. O cache de artes públicas é separado das fotos privadas, limitado e apenas em memória. A antecipação de recursos usa no máximo duas tarefas e respeita a opção de economia de dados do navegador.

Oito artes passaram a usar WebP sem perda, preservando as dimensões, os pixels visíveis e o canal alfa. Total dos originais: 10.537.383 bytes; versões WebP: 7.800.308 bytes (26% menores). Os PNGs originais permanecem no repositório. As molduras mantêm alternativa PNG. A inicialização do pet e do chat acontece em paralelo aos downloads da galeria.

## Preferências por conta

Os botões de música e tema permanecem visíveis para a sessão autenticada, inclusive ao rolar e trocar de aba. A interface não os oculta conforme a posição da página.

Tema, faixa, volume, intenção de reprodução e posição da música, sons e volumes de avisos, moldura e foto escolhidas, abas permitidas, história selecionada, aposta e áudio dos cassinos, painéis de detalhes e posição da janela da chamada usam `public.nh_preferencias_usuario`, com RLS por `auth.uid()`. Um cache local separado pelo ID da conta permite aplicar as escolhas antes da resposta da rede. Alterações pendentes são sincronizadas ao reconectar. A interface informa quando há somente uma cópia local pendente.

As permissões existentes de Modo Solo continuam valendo na restauração das abas. Não são persistidos tokens, fotos privadas, rascunhos de senha ou permissões de câmera/microfone. Perfil, modo, história, galeria, cinema e progresso do pet continuam nos fluxos de banco já existentes. A reprodução de áudio restaurada depende de interação e das permissões do navegador.

O SQL de revisão está em `sql/preferencias-e-video.sql`; ele **já foi aplicado** no projeto `xttqhfaapgimaxfendzr` pela migração `preferencias_usuario_e_chamadas_video`. Não o execute novamente. A alteração é aditiva: nova tabela de preferências e coluna `voz_chamadas.media_type`, com padrão `audio`. Nenhuma política existente de chamadas foi ampliada. Teste transacional real confirmou acesso apenas à própria preferência, bloqueio de troca de proprietário e bloqueio anônimo; as linhas de teste foram revertidas.

## Chamadas e avisos

A videochamada usa o mesmo WebRTC e as mesmas tabelas `voz_chamadas`/`voz_sinais` da chamada de áudio. O vídeo recebido aparece na área maior e a câmera local, sem áudio de retorno, no retângulo menor. A janela fica fora do painel de chat, permitindo movê-la, minimizar sem encerrar e ampliar para tela cheia. A câmera e o microfone só são solicitados ao iniciar ou atender; finalizar interrompe as trilhas e os toques.

Os sons enviados pelo usuário foram copiados sem alterações para a raiz:

- `toque-ligacao.mp3`: recebendo chamada, em repetição enquanto toca.
- `chamando-ligacao.mp3`: chamando o parceiro, em repetição enquanto aguarda.
- `notificacao-mensagem.mp3`: nova mensagem recebida.

Avisos de mensagem aparecem no topo por quatro segundos e entram/saem com deslocamento vertical. Avisos de ligação permanecem até atender, recusar ou a chamada encerrar. A chamada não atendida encerra após 60 segundos. Os controles permitem desligar câmera, alternar câmera e silenciar microfone. Os sons dependem da política de reprodução do navegador; o aviso visual continua disponível quando o áudio automático é bloqueado.

## Validação

- `node tests/imagens-carregamento.cjs`: fotos progressivas, cache, erros, troca de história/logout, quatro molduras e repetição de GIF sem novo download.
- `node tests/preferencias-conta.cjs`: restauração em outra sessão, isolamento entre contas, botões estáveis e recuperação de sincronização pendente.
- `node tests/chamadas-video.cjs`: interface e sinalização de áudio/vídeo entre sessões simuladas, consentimento antes da captura, controles da janela, limpeza de mídia e duração dos avisos.
- Regressões existentes: `interface-vidro.cjs`, `pet-idades.cjs`, `cassinos-expressoes.cjs` e `inicio-referencia.cjs`.

O Chromium gerenciado deste ambiente bloqueia captura real, conexões WebRTC diretas e tela cheia nativa por política. O teste de chamadas usa mídia, transporte e Supabase simulados: **não valida vídeo ou áudio real entre aparelhos**. A implementação mantém o método de conexão da chamada de áudio existente; nenhum provedor de chamadas foi substituído ou contratado.
