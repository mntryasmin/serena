# Serena

Extensão de navegador para quem prefere ouvir anúncios com o som mais baixo. No YouTube, a Serena reduz o volume — ou deixa o player mudo — enquanto o anúncio toca, e devolve o volume de antes quando ele termina.

## O que ela faz

- Liga e desliga sem desinstalar: desligada, o volume do player fica intacto
- Detecta o anúncio no player do YouTube
- Aplica **mudo total** ou **volume reduzido** (de 0% a 100%, em passos de 5%)
- Restaura o volume original ao fim do anúncio — e também na hora em que é desligada

Clique no ícone da extensão para ver o status da aba, ligar ou desligar a Serena e escolher o modo. O padrão é ligada, em mudo total; no modo reduzido, o nível inicial é 15%. As preferências ficam salvas no navegador.

## Como funciona

O player do YouTube marca o anúncio com a classe CSS `ad-showing`. A extensão observa essa mudança: no início do anúncio, guarda o volume atual e aplica o modo escolhido; no fim, restaura o que estava antes. Se o player mudar o volume no meio do anúncio — inclusive tirando o mudo — a Serena reaplica a configuração.

## Instalação

### Chrome, Edge ou Brave

1. Abra `chrome://extensions` (no Edge, `edge://extensions`)
2. Ative o **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação** e selecione esta pasta
4. Abra um vídeo no YouTube

### Firefox

1. Abra `about:debugging#/runtime/this-firefox`
2. Clique em **Carregar extensão temporária…**
3. Selecione o `manifest.json` desta pasta

A extensão temporária some ao fechar o Firefox. Para instalação permanente, ela precisa estar assinada pela Mozilla.

## Estrutura

```
manifest.json            Configuração da extensão (Manifest V3)
content/
  main.js                Núcleo: observa o player e controla o volume
  adapters/
    youtube.js           Adaptador do YouTube (detecção de anúncio)
popup/
  popup.html / popup.js  Configurações (salvas em chrome.storage.sync)
  fonts/                 Figtree e Fraunces, usadas no popup
icons/                   Ícones 32, 48 e 128 px (verde no navegador, branco no popup)
scripts/
  generate-icons.mjs     Desenha a marca e rasteriza os ícones
docs/
  index.html             Redireciona para a política de privacidade
  privacy/               Política de privacidade (GitHub Pages)
```

## Privacidade

A Serena não coleta dados. Só guarda três preferências: se está ligada, o modo (mudo ou volume reduzido) e o nível do volume reduzido. O texto completo está em `docs/privacy/`, para uma URL estável exigida pelas lojas.

1. Crie o repositório no GitHub e faça o push deste projeto
2. Em **Settings → Pages**: Source = Deploy from a branch; Branch = `main` (ou `master`), pasta `/docs`
3. Após o deploy, a URL fica: `https://<seu-usuario>.github.io/serena/privacy/`
4. Use essa URL no Chrome Web Store ou na AMO

## Limitações

- Se o YouTube mudar a classe `ad-showing`, a detecção precisa ser atualizada. Ela é estável há anos, mas não é uma API oficial.
- Funciona no navegador, hoje no YouTube. Apps de desktop ficam de fora.