# Recursos do Patch

- `sala.webp`, `cozinha.webp`, `banheiro.webp`, `quarto.webp`, `jardim.webp`, `passeio.webp`: seis cenários novos gerados para esta implementação, convertidos para WebP 768 × 1024.
- `pet-{bebe,filhote,juvenil,jovem,adulto}.webp`: spritesheets 1024 × 1792, quadros de 256 × 256. Reaproveitam os 35 GIFs originais na raiz. Sete linhas: parado, triste, alimentar, dormir, banho, carinho, brincar. Quatro quadros por linha. Transparência preservada.
- `scripts/build-patch-sprites.py`: conversão reproduzível dos GIFs; não altera os originais.
- O jogo usa spritesheets Phaser, movimento, partículas e objetos programados. Os GIFs aparecem apenas na prévia das idades e no painel clássico preservado.
- Sons reutilizados da raiz: `01_clique_botao.wav`, `06_vitoria_pequena.wav`, `14_moeda_caindo.wav`. Não foram adicionadas músicas ou vozes novas.
- Phaser 3.90.0: distribuído localmente em `vendor/`, licença MIT incluída. Os recursos anteriores do site permanecem intactos.
