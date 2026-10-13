const DEFAULTS = { enabled: true, mode: "mute", reduceLevel: 15 };
const HINT_ON = "O volume original volta sozinho quando o anúncio termina.";
const HINT_OFF = "Desligada, a Serena não altera o volume dos anúncios.";
const hasStorage = typeof chrome !== "undefined" && !!chrome.storage?.sync;
const hasTabs = typeof chrome !== "undefined" && !!chrome.tabs;

const modeButtons = document.querySelectorAll(".mode");
const level = document.getElementById("level");
const levelValue = document.getElementById("levelValue");
const levelRow = document.getElementById("levelRow");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("statusText");
const power = document.getElementById("power");
const powerLabel = document.getElementById("powerLabel");
const hint = document.getElementById("hint");

function isEnabled() {
  return power.getAttribute("aria-checked") === "true";
}

function setModeUI(mode) {
  modeButtons.forEach((btn) => {
    const selected = btn.dataset.mode === mode;
    btn.setAttribute("aria-checked", selected ? "true" : "false");
  });
  const reduce = mode === "reduce";
  levelRow.classList.toggle("disabled", !reduce);
  levelRow.setAttribute("aria-hidden", reduce ? "false" : "true");
}

function setEnabledUI(enabled) {
  power.setAttribute("aria-checked", enabled ? "true" : "false");
  powerLabel.textContent = enabled ? "Ligada" : "Desligada";
  document.body.classList.toggle("is-off", !enabled);
  hint.textContent = enabled ? HINT_ON : HINT_OFF;
}

function render(settings) {
  const enabled = settings.enabled !== false;
  setEnabledUI(enabled);
  setModeUI(settings.mode);
  level.value = settings.reduceLevel;
  levelValue.textContent = `${settings.reduceLevel}%`;
  if (!enabled) setStatus("Desligada", "off");
}

function setStatus(text, kind) {
  statusText.textContent = text;
  statusEl.classList.remove("active", "ad", "warn", "off");
  if (kind) statusEl.classList.add(kind);
}

function save(partial) {
  if (hasStorage) chrome.storage.sync.set(partial);
}

async function refreshStatus() {
  if (!isEnabled()) {
    setStatus("Desligada", "off");
    return;
  }
  if (!hasTabs) {
    setStatus("Verificando…");
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || "";
    if (!tab?.id || !/youtube\.com/i.test(url)) {
      setStatus("Fora do YouTube", "warn");
      return;
    }

    const res = await chrome.tabs.sendMessage(tab.id, { type: "getStatus" });
    if (!res?.ok) {
      setStatus("Recarregue a página do YouTube", "warn");
      return;
    }

    if (res.adActive) {
      const detail =
        res.mode === "mute"
          ? "Anúncio em mudo"
          : `Anúncio · volume em ${res.reduceLevel}%`;
      setStatus(detail, "ad");
    } else {
      setStatus("Online · sem anúncio", "active");
    }
  } catch {
    setStatus("Recarregue a página do YouTube", "warn");
  }
}

if (hasStorage) {
  chrome.storage.sync.get(DEFAULTS, render);
} else {
  render(DEFAULTS);
}

power.addEventListener("click", () => {
  const enabled = !isEnabled();
  save({ enabled });
  setEnabledUI(enabled);
  refreshStatus();
});

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    save({ mode });
    setModeUI(mode);
    refreshStatus();
  });
});

level.addEventListener("input", () => {
  levelValue.textContent = `${level.value}%`;
});

level.addEventListener("change", () => {
  save({ reduceLevel: Number(level.value) });
  refreshStatus();
});

refreshStatus();
if (hasTabs) setInterval(refreshStatus, 1000);
