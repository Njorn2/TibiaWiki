# Como atualizar o mapa

O mapa do Tibia Wiki lê as imagens da branch `main` do repositório [TibiaWikiBR/map-images](https://github.com/TibiaWikiBR/map-images). O merge do pull request publica. O wiki acompanha essa branch, então não é preciso editar o Tibia Wiki a cada mapa novo.

O wiki só mostra um bloco onde existe um `Minimap_Color`. Onde não houver PNG, o mapa fica vazio. Só quem tem permissão de escrita publica. Ninguém envia direto para `main`, e o check `proteger-imagens` recusa pull request que apague um PNG ou o `tiles.json`.

## Quando o Tibia muda o mapa ou abre uma área

1. Pegue a pasta `minimap` do cliente, ou o `minimap.zip` com os mesmos arquivos. Os arquivos `Minimap_WaypointCost_*.png` são ignorados.
2. Clone o repositório das imagens, se ainda não tiver:

   ```bash
   git clone git@github.com:TibiaWikiBR/map-images.git
   ```

3. Na pasta deste repositório (TibiaWiki), junte os blocos novos ao clone. O mesmo `x_y_z` substitui o bloco antigo. O resto permanece. Nada é apagado. O comando também grava `versao.txt`, que faz o navegador buscar a imagem nova.

   ```bash
   node Mapa/import-minimap.mjs ~/Projects/Umanthir/TibiaData/minimap ../map-images
   ```

4. No clone, crie um branch, commit e abra o pull request:

   ```bash
   git checkout -b mapas-AAAA-MM-DD
   git add -A
   git commit -m "Atualiza o minimapa."
   git push -u origin HEAD
   gh pr create --repo TibiaWikiBR/map-images --title "Atualiza o minimapa" --body "Blocos novos ou substituídos. Nenhum PNG foi apagado."
   ```

5. Espere o check `proteger-imagens` passar e faça o merge. Ao entrar na `main`, o workflow limpa o cache do jsDelivr dos arquivos alterados, do `tiles.json`, do `houses.json` e do `versao.txt`. O mapa do wiki passa a usar essa `main`.

Confira `https://cdn.jsdelivr.net/gh/TibiaWikiBR/map-images@main/versao.txt` depois do merge. O primeiro acesso pode levar um minuto.

## Quando mudam as casas

O checkbox **Houses** usa a lista ao vivo do SDK (`wiki.houses()`), que traz o nome e o aluguel. A porta não vem nessa lista. Ela está em `houses.json`, no mesmo repositório das imagens: a chave é o slug e o valor é `[x, y, z]`.

Se o cliente mudar a porta de uma casa, gere o arquivo de novo a partir da pasta das casas publicadas (cada JSON no formato `umanthir.house.v1`) e inclua o `houses.json` e o `versao.txt` no pull request:

```bash
node Mapa/import-houses.mjs ~/Projects/Umanthir/.local-run/leech-data/versions/<versao>/house-export ../map-images/houses.json
```

Substituir o `houses.json` não apaga PNG, então o check aceita. Apagar uma casa do jogo não apaga o PNG do mapa. Se uma casa sair da lista da API, o ícone deixa de aparecer mesmo que a porta antiga ainda esteja no arquivo.

## Se algo sair errado

A tag `v2026-11-25` continua no ar com o mapa publicado nessa data. Ela não recebe mapas novos. Para voltar a ela, em `MediaWiki:Common.js/mapa.js` troque `TILE_BASE` para `https://cdn.jsdelivr.net/gh/TibiaWikiBR/map-images@v2026-11-25` e aumente o `v=` do carregador em `MediaWiki:Common.js`. Não apague tags: o jsDelivr não esquece o que já serviu.
