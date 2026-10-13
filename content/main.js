// Serena — núcleo do content script.
// Detecta anúncios via adaptador do site e ajusta o volume do <video>.

(() => {
  const DEFAULTS = {
    enabled: true,
    mode: "mute", // "mute" | "reduce"
    reduceLevel: 15, // % de volume quando mode === "reduce"
  };

  let settings = { ...DEFAULTS };
  let settingsLoaded = false;
  let adActive = false;
  let savedVolume = null;
  let savedMuted = null;
  let applying = false;
  let observer = null;
  let observedEl = null;
  let guardedVideo = null;

  const log = (...args) => console.log("[Serena]", ...args);

  const adapter = (window.__serenaAdapters || []).find((a) => a.matches());
  if (!adapter) {
    console.warn("[Serena] nenhum adaptador encontrado para", location.hostname);
    return;
  }
  log("online, adaptador:", adapter.name);

  function targetVolume() {
    return Math.max(0, Math.min(1, settings.reduceLevel / 100));
  }

  function volumeMatchesTarget(video) {
    if (settings.mode === "mute") return video.muted;
    return !video.muted && Math.abs(video.volume - targetVolume()) < 0.01;
  }

  // --- Configurações (chrome.storage.sync) ---
  function releaseControl() {
    if (!adActive && savedVolume === null) return;
    adActive = false;
    restoreVolume();
  }

  function applyStoredSettings() {
    if (!settings.enabled) {
      releaseControl();
      return;
    }
    if (adActive) applyAdVolume();
    else onStateMaybeChanged();
  }

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    settingsLoaded = true;
    ensureObserver();
    applyStoredSettings();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (newValue !== undefined) settings[key] = newValue;
    }
    applyStoredSettings();
  });

  // --- Controle de volume ---
  function applyAdVolume() {
    const video = adapter.getVideo();
    if (!video) return;

    if (savedVolume === null) {
      savedVolume = video.volume;
      savedMuted = video.muted;
    }

    applying = true;
    try {
      if (settings.mode === "mute") {
        video.muted = true;
      } else {
        video.muted = false;
        video.volume = targetVolume();
      }
    } finally {
      // volumechange dispara de forma síncrona em vários browsers
      applying = false;
    }
  }

  function restoreVolume() {
    const video = adapter.getVideo();
    if (video && savedVolume !== null) {
      applying = true;
      try {
        video.volume = savedVolume;
        video.muted = savedMuted;
      } finally {
        applying = false;
      }
    }
    savedVolume = null;
    savedMuted = null;
  }

  // O YouTube pode reativar o som ou restaurar o volume durante o anúncio.
  function guardVolume() {
    const video = adapter.getVideo();
    if (!video || video === guardedVideo) return;
    guardedVideo = video;
    video.addEventListener("volumechange", () => {
      if (!settings.enabled || !adActive || applying) return;
      if (volumeMatchesTarget(video)) return;
      log("YouTube alterou o volume — reaplicando modo:", settings.mode);
      applyAdVolume();
    });
  }

  function onStateMaybeChanged() {
    if (!settingsLoaded) return;
    if (!settings.enabled) {
      releaseControl();
      return;
    }
    guardVolume();
    const nowAd = adapter.isAdPlaying();
    if (nowAd === adActive) return;
    adActive = nowAd;
    if (adActive) {
      log("anúncio detectado — aplicando modo:", settings.mode);
      applyAdVolume();
    } else {
      log("anúncio terminou — restaurando volume");
      restoreVolume();
    }
  }

  // --- Status para o popup ---
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "getStatus") return;
    sendResponse({
      ok: true,
      site: adapter.name,
      enabled: settings.enabled,
      adActive: settings.enabled && adActive,
      mode: settings.mode,
      reduceLevel: settings.reduceLevel,
    });
  });

  // --- Observação do player ---
  // O YouTube é uma SPA: o player pode não existir ainda ou ser recriado.
  function ensureObserver() {
    const target = adapter.observeTarget();
    if (!target || target === observedEl) return;

    if (observer) observer.disconnect();
    observedEl = target;
    log("player encontrado, observando. Classes atuais:", target.className);
    observer = new MutationObserver(onStateMaybeChanged);
    observer.observe(target, {
      attributes: true,
      attributeFilter: ["class"],
    });
    onStateMaybeChanged();
  }

  // Checagem leve e periódica: garante observer vivo após navegação SPA,
  // reaplica o volume se o YouTube tiver restaurado o nível no meio do anúncio,
  // e serve de rede de segurança caso alguma mutação seja perdida.
  setInterval(() => {
    if (!settingsLoaded) return;
    ensureObserver();
    if (!settings.enabled) {
      releaseControl();
      return;
    }
    onStateMaybeChanged();
    if (adActive) {
      const video = adapter.getVideo();
      if (video && !volumeMatchesTarget(video)) applyAdVolume();
    }
  }, 1000);
})();
