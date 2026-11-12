# Evolução do pet

O coelhinho mantém o laço rosa e muda de tamanho e roupa conforme o nível existente. Não há migração de banco, alteração de saldo ou de custo das ações.

| Fase | Níveis | Roupa |
| --- | --- | --- |
| Bebê | 1–4 | Macacão e babador |
| Filhote | 5–9 | Jardineira |
| Juvenil | 10–19 | Camiseta e short |
| Jovem | 20–29 | Moletom e calça |
| Adulto | 30+ | Camisa e cardigan |

O cálculo permanece `floor(max(0, experiencia) / 100) + 1`. Pets existentes começam na fase correspondente à sua experiência atual. A mudança de idade é visual; não reinicia o progresso.

Os 35 arquivos `pet-{idade}-{acao}.gif` ficam na mesma pasta do `index.html`. Idades: `bebe`, `filhote`, `juvenil`, `jovem`, `adulto`. Ações: `parado`, `triste`, `alimentar`, `dormir`, `banho`, `carinho`, `brincar`. Cada arquivo tem quatro quadros, 256 × 256 px e ciclo de um segundo com fundo transparente. Dormir usa pijama; banho usa banheira e espuma. As artes foram geradas para esta alteração a partir da referência do pet original e os quadros foram recortados e codificados com FFmpeg.

As animações temporárias retornam ao estado atual após 3,2 segundos, preservando o comportamento anterior. Se o nível mudar durante uma ação, a fase nova aparece ao terminar a ação. Os GIFs anteriores foram mantidos como alternativa caso um arquivo novo não carregue.

A introdução ganhou um cartão de vidro. A mensagem diária mantém sua localização e usa texto escuro no modo dia e claro no modo noite.

## Verificação local

Com um servidor HTTP na raiz do projeto em `127.0.0.1:8765`, execute:

- `node tests/pet-idades.cjs`
- `node tests/interface-vidro.cjs`
- `node tests/cassinos-expressoes.cjs`

Os testes usam dados simulados; não movimentam moedas nem acessam contas reais.
