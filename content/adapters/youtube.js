// Adaptador do YouTube.
// Cada adaptador expõe: matches(), getVideo(), isAdPlaying(), observeTarget().
// Para adicionar outro site, crie um arquivo neste padrão e registre no manifest.

window.__serenaAdapters = window.__serenaAdapters || [];

window.__serenaAdapters.push({
  name: "youtube",

  matches() {
    return location.hostname.endsWith("youtube.com");
  },

  // Elemento <video> principal do player.
  getVideo() {
    return document.querySelector("video.html5-main-video");
  },

  // O player do YouTube adiciona a classe "ad-showing" durante anúncios.
  isAdPlaying() {
    const player = document.querySelector(".html5-video-player");
    return !!player && player.classList.contains("ad-showing");
  },

  // Onde o MutationObserver deve escutar mudanças de classe.
  observeTarget() {
    return document.querySelector(".html5-video-player");
  },
});
