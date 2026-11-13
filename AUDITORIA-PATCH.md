# Auditoria real dos recursos do Patch

Pacote localizado no repositório em `Patch_Jogo_Completo/`, introduzido em `9a0df50` (upload). A inspeção verificou nomes, formatos, dimensões, transparência, quadros distintos, alinhamento e áudio; não tomou as afirmações do README como prova de recursos funcionais.

## Inventário

90 arquivos, 6.393.436 bytes no pacote auditado:

| Diretório | Conteúdo real |
|---|---|
| `personagem/png/` | 14 PNG RGBA transparentes de 240 × 240 |
| `personagem/gifs/` | 14 GIF de 240 × 240; oito animados e seis com somente um quadro |
| `personagem/` | Spritesheet RGBA 2880 × 3360, 12 colunas × 14 linhas; quadros 240 × 240 |
| `cenarios/` | Seis SVG de 960 × 640 |
| `objetos/` | 24 SVG de 128 × 128, placas opacas com emoji |
| `sons/` | 26 WAV PCM16, mono, 22050 Hz |
| `referencias/` | Uma prancha conceitual de 1536 × 1024 |
| `codigo/` | HTML, CSS e JavaScript de protótipo local |
| raiz | Um `LEIA-ME-PRIMEIRO.txt` |

A prancha é uma composição única com textos, quadros, personagens, cenários, objetos e interface; não são dezenas de sprites transparentes individualizados. Ela tem arte mais detalhada que os recursos individuais reais. Não é carregada como objeto do jogo.

## Personagem e animações

O personagem real do pacote é o coelho branco de contorno rosa, orelhas caídas, laço rosa e coração no peito. Foram preservados seus desenhos. O fundo dos PNG e do spritesheet possui alfa zero; a exibição preta de alguns visualizadores não é fundo incorporado.

Ordem real das linhas do spritesheet (índice zero):

| Linha | Estado | Imagens distintas nos 12 quadros |
|---|---|---:|
| 0 | parado | 8 |
| 1 | piscando | 7 |
| 2 | feliz | 7 |
| 3 | triste | 1 |
| 4 | rindo | 1 |
| 5 | comendo | 7 |
| 6 | banho | 1 |
| 7 | dormindo | 1 |
| 8 | acordando | 1 |
| 9 | carinho | 7 |
| 10 | dancando | 7 |
| 11 | pulando | 5 |
| 12 | brincando | 7 |
| 13 | comemorando | 1 |

Os GIFs `acordando`, `banho`, `comemorando`, `dormindo`, `rindo` e `triste` têm somente um quadro, com duração 1320 ms, apesar da descrição geral de 12 quadros. Os outros têm 12 quadros a 110 ms, com imagens repetidas conforme a tabela.

Os PNG estáticos `acordando`, `parado` e `pulando` são idênticos; `feliz`, `rindo` e `brincando` também compartilham a mesma pose inicial. Portanto, 14 nomes não representam 14 animações distintas prontas.

O alinhamento é consistente: a caixa alfa da pose base vai de (23,25) a (216,229). A respiração/bob oscila aproximadamente quatro pixels; o pulo sobe cerca de 11 pixels. A rotação ocupa x=15..224 e y≥14, preservando margem e sem cortar o desenho.

**Alimentação:** a linha 5 e `comendo.png` têm um alimento laranja com folha desenhado na boca. O jogo não usa essa linha para todos os alimentos. `PetStateMachine` associa `comendo` a quadros neutros; o alimento escolhido é desenhado separadamente pelo controlador. Isso evita repetir o erro de mostrar cenoura ao oferecer maçã.

A máquina de estados não reinicia o mesmo estado a cada consulta, mantém uma interação visual por vez, pisca espontaneamente, reage às necessidades e retorna ao estado apropriado. As linhas estáticas são complementadas com movimentos programados. Comer/carinho/brincar passam por uma reação feliz antes do repouso. Dormir tem respiração suave e acordar possui transição própria.

Não há animação esquelética detalhada ou quadros de caminhada completa no spritesheet real. Deslocamento, alongamento, rotação e partículas são complementos programados, sem alegar que existiam no pacote.

## Objetos e cenários

Os 24 objetos SVG originais são placas rosa com um emoji `<text>`, dependente da fonte e do sistema operacional. Não são os objetos isolados detalhados da prancha. Foram mantidos no repositório, sem exclusão, mas não usados como substitutos silenciosos de arte transparente.

`patch-game/assets/objects/` fornece 40 vetores originais programados, de fundo transparente, com geometria e caminhos próprios e sem fontes, emoji ou placa opaca. Incluem os seis alimentos, hambúrguer, bola, ursinho, ferramentas de banho, escova, espelho, regador, flores, borboleta, móveis, roupas, acessórios e ícones. São desenhos 2D simples coerentes com a paleta; não se afirma equivalência à arte 3D da prancha.

Os cenários SVG do pacote são horizontais 3:2; os seis cenários WebP detalhados já existentes em `patch/assets/` são verticais 3:4 e continuam disponíveis. Seu reaproveitamento evita distorcer o personagem ou perder a qualidade visual já presente.

Não havia escova/espelho isolados, roupas em camadas alinhadas para cada idade nem móveis detalhados recortados da prancha; os complementos originais atendem as interações sem usar arquivos proprietários de outro jogo.

## Áudio

Os 26 arquivos são WAV reais, todos PCM de 16 bits, mono, 22050 Hz. Duram entre 0,09 e 0,79 segundo; os 26 hashes são distintos. O pico fica em aproximadamente 0,25 da escala, sem amostras saturadas na leitura. Nenhuma extensão foi trocada para MP3.

Nomes auditados: `toque_botao`, `abrir_menu`, `fechar_menu`, `comer`, `beber`, `banho_agua`, `espuma`, `secar`, `escovar_dentes`, `dormir`, `acordar`, `brincar`, `carinho`, `beijo`, `risada`, `triste`, `nivel_up`, `moeda_coletar`, `compra`, `missao_concluida`, `minijogo_inicio`, `minijogo_vitoria`, `minijogo_derrota`, `trocar_comodo`, `bolha`, `estrela`.

`AudioManager` respeita o desbloqueio do navegador, o controle de som e volume da conta; evita repetição do mesmo efeito em intervalos inferiores a 100 ms, limita a três vozes e destrói os sons ao concluir ou encerrar a cena. Efeitos recusados por autoplay não são reproduzidos atrasados fora de contexto. Não foi introduzida música ambiente de terceiros.

## Código inicial e segurança

O código do pacote usa DOM/GIF, `localStorage`, cache busting `Date.now()` e moedas/XP calculados no navegador. Não possui Phaser ou Supabase, roupas equipadas visualmente, missões diárias completas ou compartilhamento de progresso. O próprio README reconhece tratar-se de protótipo.

A implementação principal reaproveita recursos e ideias funcionais, preservando a autenticação e a economia validada no Supabase. O protótipo não substitui o `index.html` do site nem se torna a autoridade sobre moedas.

## Reproduzir a inspeção

Requer Python e Pillow apenas para auditoria, sem dependência extra no site:

```sh
python scripts/validar-patch-assets.py
```

O script somente lê os arquivos e imprime JSON com dimensões, alfa, quadros distintos, parâmetros dos WAV e avisos. Aceita um diretório alternativo como argumento. As estatísticas acima foram obtidas por esse processo e por inspeção visual do PNG base, da alimentação, do spritesheet completo e da prancha. Uma prova isolada em Chromium reproduziu os 14 estados e comparou cinco capturas em tempos diferentes por estado, confirmando movimento visível em todos (incluindo os complementos programados das linhas estáticas), quadros neutros na alimentação, 40 texturas vetoriais e 26 WAV carregados sem erro/404. Confirmou também desbloqueio por gesto, som desativado respeitado e descarte da voz após reprodução. Essa prova não substitui os testes integrados de todas as interações.
