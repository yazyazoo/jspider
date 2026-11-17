// src/domain/archive-links.ts
var ARCHIVE_HOSTS = ["filestore.me", "terabytez.org"];
function normalizeArchiveUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const knownHost = ARCHIVE_HOSTS.includes(url.hostname);
    const directArchive = /\.(?:rar|rev)$/i.test(url.pathname);
    const bareFileId = /^\/[a-z0-9]{12}\/?$/i.test(url.pathname) && !url.search && !url.hash;
    if (url.protocol !== "https:" || !knownHost || url.port || url.username || url.password) {
      return null;
    }
    return directArchive || bareFileId ? url.href : null;
  } catch {
    return null;
  }
}
function selectArchiveLinks(values, hosts) {
  const selected = new Set(hosts.filter((host) => ARCHIVE_HOSTS.includes(host)));
  return [...new Set(values.map(normalizeArchiveUrl).filter((value) => value !== null))].filter((value) => selected.has(new URL(value).hostname));
}

// src/domain/taskflow-contract.ts
function requireQuickWorkflowPreset(value) {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("Seleziona un preset TaskFlow valido.");
  }
  return value;
}
function normalizeWorkflowName(value) {
  const ascii = value.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
  return ascii.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "").replace(/[_-]+/g, (separators) => separators.includes("-") ? "-" : "_").replace(/^[_-]+|[_-]+$/g, "");
}
function requireWorkflowName(value) {
  const workflowName = normalizeWorkflowName(value);
  if (!workflowName) throw new Error("Inserisci un nome workflow con lettere o numeri ASCII.");
  return workflowName;
}

// src/domain/create-mode.ts
function initialCreateModeState() {
  return { selected: "quick", locked: false };
}
function selectCreateMode(state, selected) {
  return state.locked ? state : { selected, locked: false };
}
function lockCreateMode(state) {
  return { ...state, locked: true };
}
function validatePassword(value) {
  if (/[\r\n\0]/.test(value)) {
    throw new Error("La password RAR contiene caratteri non supportati.");
  }
}
function resolveArchivePassword(variants, manualValue) {
  if (manualValue !== null) {
    validatePassword(manualValue);
    return {
      value: manualValue,
      source: manualValue ? "manual" : "empty",
      conflict: false
    };
  }
  const passwords = [...new Set(variants.map(({ password }) => password).filter(Boolean))];
  for (const password of passwords) validatePassword(password);
  if (passwords.length > 1) return { value: "", source: "conflict", conflict: true };
  if (passwords.length === 1) return { value: passwords[0], source: "detected", conflict: false };
  return { value: "", source: "empty", conflict: false };
}

// src/domain/recommendations.ts
var priority = { untouched: 3, source: 2, encode: 1, unknown: 0 };
function emptyRecommendation() {
  return { keys: [], reasons: {}, notes: [], comparisons: [] };
}
function recommendVersions(variants, profile = "4k1080", limitMbps = 0) {
  const result = emptyRecommendation();
  if (profile === "manual") return result;
  if (variants.some((variant) => Number.isInteger(variant.season))) {
    const seasons = [...new Set(variants.map((variant) => variant.season ?? null))];
    for (const season of seasons) {
      const group = variants.filter((variant) => (variant.season ?? null) === season).map((variant) => {
        const { season: _season, ...withoutSeason } = variant;
        return withoutSeason;
      });
      const proposal = recommendVersions(group, profile, limitMbps);
      result.keys.push(...proposal.keys);
      Object.assign(result.reasons, proposal.reasons);
      result.comparisons.push(...proposal.comparisons.map((comparison) => ({ ...comparison, season })));
      result.notes.push(...proposal.notes.map((note) => `${season === null ? "" : `Stagione ${season} \xB7 `}${note}`));
    }
    return result;
  }
  const unlimited = limitMbps === null || String(limitMbps).trim() === "" || Number(limitMbps) === 0;
  const tier = (variant) => priority[variant.technical.category];
  const videoRate = (variant) => variant.technical.videoBitrate ?? (variant.technical.videoBytes !== null && variant.technical.duration !== null ? variant.technical.videoBytes * 8 / variant.technical.duration : 0);
  const totalRate = (variant) => variant.technical.overallBitrate ?? (variant.technical.totalBytes !== null && variant.technical.duration !== null ? variant.technical.totalBytes * 8 / variant.technical.duration : 0);
  const withinLimit = (variant) => unlimited || totalRate(variant) > 0 && totalRate(variant) <= Number(limitMbps) * 1e6;
  const rateText = (rate) => `${(rate / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 2 })} Mb/s`;
  const choose = (list, group, resolution, selected) => {
    if (!list.length) {
      if (selected) result.notes.push(`${group}: nessuna versione disponibile.`);
      return;
    }
    const eligible = list.filter(withinLimit);
    for (const variant of list) {
      if (!withinLimit(variant)) {
        result.reasons[variant.key] = "Non proposta: bitrate totale oltre soglia o non disponibile per verificare il limite.";
      }
    }
    if (!eligible.length) {
      result.notes.push(`${group}: nessuna candidata con bitrate totale verificabile entro soglia.`);
      return;
    }
    const highestTier = Math.max(...eligible.map(tier));
    const pool = eligible.filter((variant) => tier(variant) === highestTier);
    const ranked = pool.slice().sort((left, right) => videoRate(right) - videoRate(left) || (right.technical.bitDepth ?? 0) - (left.technical.bitDepth ?? 0) || left.key.localeCompare(right.key));
    const best = ranked[0];
    if (!best) return;
    const technical = pool.map((variant) => variant.technical);
    const issues = [];
    if (technical.some((item) => !item.codec || !item.bitDepth || !item.videoBitrate || !item.duration)) {
      issues.push("dati tecnici mancanti o insufficienti");
    }
    if (technical.some((item) => item.bitrateEstimated)) issues.push("bitrate video stimato");
    if (highestTier === 0) issues.push("tipo di sorgente non indicato");
    const differs = (field) => new Set(
      technical.map((item) => item[field] ?? "")
    ).size > 1;
    if (differs("codec")) issues.push("codec diversi (H.264/HEVC o altri): bitrate non equivalente e nessun rapporto fisso");
    if (differs("bitDepth")) issues.push("profondit\xE0 in bit diverse");
    if (differs("hdr")) issues.push("HDR/SDR diversi: verifica la compatibilit\xE0");
    if (differs("sourceFamily") || differs("provider")) issues.push("sorgenti o provider diversi");
    const spread = (field) => {
      const values = technical.map((item) => item[field]).filter((value) => value !== null && value > 0);
      return values.length > 1 && Math.max(...values) / Math.min(...values) > 1.02;
    };
    if (spread("duration")) issues.push("durate diverse: verifica il montaggio");
    if (spread("width") || spread("height") || spread("fps")) issues.push("dimensioni o frequenze video diverse");
    const tied = ranked.length > 1 && videoRate(ranked[0]) === videoRate(ranked[1]);
    if (tied) issues.push("bitrate equivalenti: profondit\xE0 in bit e ordine stabile risolvono la parit\xE0");
    const uncertain = issues.length > 0;
    const categoryText = {
      untouched: "Priorit\xE0 alla traccia untouched/REMUX",
      source: "Priorit\xE0 alla sorgente WEB-DL",
      encode: "Ricodifica proposta",
      unknown: "Tipologia della sorgente non indicata"
    }[best.technical.category];
    let reason = `${categoryText}. ${unlimited ? "Nessun limite di bitrate. " : `Entro la soglia di ${limitMbps} Mb/s totali. `}`;
    if (videoRate(best) > 0) {
      reason += `${pool.length > 1 ? tied ? "Bitrate video a parit\xE0: " : "Bitrate video pi\xF9 alto fra candidate di pari priorit\xE0: " : "Bitrate video: "}${rateText(videoRate(best))}. `;
    } else reason += "Bitrate video mancante: preferenza provvisoria per profondit\xE0 in bit nota e ordine stabile. ";
    if (pool.length === 1) reason += "Unica candidata con questa priorit\xE0. ";
    reason += uncertain ? `Proposta indicativa, confronto incerto: ${issues.join("; ")}. Puoi cambiarla.` : "Confronto fra candidate compatibili nei dati disponibili; qualit\xE0 stimata dai metadati.";
    result.reasons[best.key] = `${selected ? `Proposta ${group}: ` : `Candidata ${group} (fuori dal profilo): `}${reason}`;
    for (const variant of eligible) {
      if (variant === best) continue;
      result.reasons[variant.key] = tier(variant) < highestTier ? `Alternativa ${group}: priorit\xE0 alla sorgente/untouched proposta, entro i limiti scelti.` : `Alternativa ${group}: ${videoRate(variant) > 0 ? `bitrate video ${rateText(videoRate(variant))}` : "bitrate video non disponibile"}. ${uncertain ? "Confronto incerto; puoi selezionarla al posto della proposta." : "La proposta usa il bitrate video pi\xF9 alto, a parit\xE0 di priorit\xE0."}`;
    }
    result.comparisons.push({ resolution, key: best.key, uncertain, selected, group });
    if (selected) result.keys.push(best.key);
    if (uncertain && selected) result.notes.push(`${group}: proposta indicativa, confronto incerto (${issues.join("; ")}).`);
  };
  const profileResolutions = profile === "4k1080" ? [2160, 1080] : [1080];
  const resolutions = [.../* @__PURE__ */ new Set([
    ...variants.map((variant) => variant.technical.resolution).filter((value) => value !== null && value > 0),
    ...profileResolutions
  ])].sort((left, right) => right - left);
  for (const resolution of resolutions) {
    const list = variants.filter((variant) => variant.technical.resolution === resolution);
    const group = resolution === 2160 ? "4K" : `${resolution}p`;
    if (profile === "1080dual" && resolution === 1080) {
      choose(list.filter((variant) => ["source", "untouched"].includes(variant.technical.category)), "1080 sorgente/untouched", resolution, true);
      choose(list.filter((variant) => variant.technical.category === "encode"), "1080 codifica", resolution, true);
    } else {
      choose(list, group, resolution, profile === "4k1080" && [2160, 1080].includes(resolution));
    }
  }
  return result;
}

// src/domain/taskflow-url.ts
function normalizeTaskFlowBaseUrl(value) {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const secureTransport = url.protocol === "https:" || url.protocol === "http:" && loopback;
  const bareOrigin = !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  if (!secureTransport || !bareOrigin) {
    throw new Error("L\u2019URL TaskFlow deve essere un\u2019origine HTTPS oppure HTTP su loopback, senza credenziali, percorsi, query o frammenti.");
  }
  return url.origin;
}

// src/sidebar/state.ts
function reconcileSelection(previous, explicitlyAdjusted2, available, recommended) {
  const availableKeys = new Set(available);
  const source = explicitlyAdjusted2 ? previous : recommended;
  return [...new Set(source.filter((key) => availableKeys.has(key)))];
}
function applyThankReplacements(selected, replacements, available) {
  const availableKeys = new Set(available);
  return [...new Set(selected.flatMap((key) => replacements[key] ?? [key]).filter((key) => availableKeys.has(key)))];
}
function shouldAutoSearchTmdb(configured, mediaKind) {
  return configured && (mediaKind === "movie" || mediaKind === "tv");
}

// src/sidebar/controller.ts
function applyCreateModeView(state, view) {
  const quick = state.selected === "quick";
  view.quickPanel.hidden = !quick;
  view.taskflowPanel.hidden = quick;
  view.quickChoice.checked = quick;
  view.taskflowChoice.checked = !quick;
  view.quickChoice.disabled = state.locked;
  view.taskflowChoice.disabled = state.locked;
}
function autoSearchSnapshot(snapshot2, configured, search) {
  if (!shouldAutoSearchTmdb(configured, snapshot2.mediaKind) || snapshot2.mediaKind !== "movie" && snapshot2.mediaKind !== "tv") {
    return Promise.resolve(null);
  }
  return search({
    title: snapshot2.title,
    year: snapshot2.year,
    mediaKind: snapshot2.mediaKind,
    imdbId: snapshot2.imdbId,
    mode: "auto"
  });
}
var LatestResultGate = class {
  #revision = 0;
  async run(operation) {
    const revision = ++this.#revision;
    try {
      const result = await operation();
      return revision === this.#revision ? result : null;
    } catch (reason) {
      if (revision !== this.#revision) return null;
      throw reason;
    }
  }
  invalidate() {
    this.#revision += 1;
  }
};
function clearTmdbView(view) {
  view.results.replaceChildren();
  view.validation.textContent = "";
}
async function initializeOverlayWidthControl(pageUrl, view, getStatus) {
  let overlay = false;
  try {
    overlay = new URL(pageUrl).searchParams.get("surface") === "overlay";
  } catch {
    overlay = false;
  }
  if (!overlay) return false;
  view.container.hidden = false;
  const status2 = await getStatus();
  view.select.value = String(status2.width);
  return true;
}
async function runSidebarStartup(dependencies) {
  await Promise.all([
    dependencies.loadSettings(),
    dependencies.initializeOverlayWidth()
  ]);
  void dependencies.loadCatalog().catch(() => void 0);
  await dependencies.readSnapshot();
}

// src/sidebar/taskflow-create-bridge.ts
var bridgedPresetChanges = /* @__PURE__ */ new WeakSet();
var commonTaskDataKeys = ["media_kind", "tmdb", "unrar"];
function buildTaskFlowSeedData(seed) {
  return {
    media_kind: seed.mediaKind,
    tmdb: seed.tmdb,
    ...seed.password ? { unrar: { password: seed.password } } : {}
  };
}
function selectablePackageIds(ui) {
  if (!ui.store) return null;
  if (!Array.isArray(ui.store.selectablePackages)) {
    throw new Error("WebUI TaskFlow incompatibile: manca il catalogo dei package selezionabili.");
  }
  return new Set(ui.store.selectablePackages.map(({ id }) => id));
}
function hasPackages(ui, packageIds) {
  const available = selectablePackageIds(ui);
  if (!available) return false;
  return packageIds.every((id) => available.has(id));
}
function parseTaskData(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function preserveCommonDataAcrossPresetChanges(ui) {
  if (bridgedPresetChanges.has(ui)) return;
  if (typeof ui.changePreset !== "function") {
    throw new Error("WebUI TaskFlow incompatibile: manca il selettore preset richiesto.");
  }
  const original = ui.changePreset;
  ui.changePreset = (presetCode) => {
    const before = parseTaskData(ui.createState.taskJson);
    const common = Object.fromEntries(commonTaskDataKeys.flatMap((key) => before && Object.hasOwn(before, key) ? [[key, before[key]]] : []));
    original.call(ui, presetCode);
    const after = parseTaskData(ui.createState.taskJson) ?? {};
    ui.createState.taskJson = JSON.stringify({ ...after, ...common }, null, 2);
    ui.requestUpdate();
  };
  bridgedPresetChanges.add(ui);
}
async function waitForCatalog(ui, packageIds) {
  const deadline = Date.now() + 1e4;
  while (!hasPackages(ui, packageIds) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
async function openTaskFlowCreate(ui, seed, configuration, wait = waitForCatalog) {
  ui.view = "create";
  ui.configure(configuration);
  await wait(ui, seed.packageIds);
  if (!hasPackages(ui, seed.packageIds)) {
    const available = selectablePackageIds(ui) ?? /* @__PURE__ */ new Set();
    const missing = seed.packageIds.filter((id) => !available.has(id));
    throw new Error(`La WebUI non trova i package caricati: ${missing.join(", ")}.`);
  }
  preserveCommonDataAcrossPresetChanges(ui);
  ui.createState = {
    ...ui.createState,
    packageIds: [...seed.packageIds],
    workflowName: seed.workflowName,
    taskJson: JSON.stringify(buildTaskFlowSeedData(seed), null, 2)
  };
  ui.requestUpdate();
}

// src/sidebar/tooltips.ts
function triggerFrom(target) {
  return target instanceof Element ? target.closest("[data-tooltip]") : null;
}
function tooltipFor(trigger) {
  const id = trigger.getAttribute("aria-describedby");
  return id ? trigger.ownerDocument.getElementById(id) : null;
}
function positionTooltip(trigger, tooltip) {
  const margin = 12;
  const gap = 7;
  const bounds = trigger.getBoundingClientRect();
  const tooltipBounds = tooltip.getBoundingClientRect();
  const viewport = trigger.ownerDocument.documentElement;
  const window = trigger.ownerDocument.defaultView;
  const viewportWidth = viewport.clientWidth || window?.innerWidth || 0;
  const viewportHeight = viewport.clientHeight || window?.innerHeight || 0;
  const maxLeft = Math.max(margin, viewportWidth - tooltipBounds.width - margin);
  const left = Math.min(Math.max(bounds.left, margin), maxLeft);
  const below = bounds.bottom + gap;
  const above = bounds.top - gap - tooltipBounds.height;
  const top = below + tooltipBounds.height <= viewportHeight - margin ? below : Math.max(margin, above);
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}
function initializeTooltips(root) {
  let active = null;
  let pinned = false;
  const hide = () => {
    if (!active) return;
    const tooltip = tooltipFor(active);
    if (tooltip) tooltip.hidden = true;
    active.setAttribute("aria-expanded", "false");
    active = null;
    pinned = false;
  };
  const show = (trigger, pin = false) => {
    const tooltip = tooltipFor(trigger);
    if (!tooltip || tooltip.getAttribute("role") !== "tooltip") return;
    if (active !== trigger) {
      hide();
      pinned = pin;
    } else if (pin) {
      pinned = true;
    }
    active = trigger;
    tooltip.hidden = false;
    positionTooltip(trigger, tooltip);
    trigger.setAttribute("aria-expanded", "true");
  };
  const containsActive = (target) => {
    if (!(target instanceof Node) || !active) return false;
    return active.contains(target) || Boolean(tooltipFor(active)?.contains(target));
  };
  const pointerOver = (event) => {
    const trigger = triggerFrom(event.target);
    if (trigger) show(trigger);
  };
  const pointerOut = (event) => {
    const pointer = event;
    if (!active || !(event.target instanceof Node)) return;
    const leavingActiveArea = active.contains(event.target) || Boolean(tooltipFor(active)?.contains(event.target));
    if (!pinned && leavingActiveArea && !containsActive(pointer.relatedTarget)) hide();
  };
  const focusIn = (event) => {
    const trigger = triggerFrom(event.target);
    if (trigger) show(trigger);
  };
  const focusOut = (event) => {
    const focus = event;
    if (!pinned && triggerFrom(event.target) === active && !containsActive(focus.relatedTarget)) hide();
  };
  const click = (event) => {
    const trigger = triggerFrom(event.target);
    if (!trigger) {
      if (!containsActive(event.target)) hide();
      return;
    }
    if (active === trigger && pinned) hide();
    else show(trigger, true);
  };
  const keydown = (event) => {
    if (event.key === "Escape") hide();
  };
  root.addEventListener("pointerover", pointerOver);
  root.addEventListener("pointerout", pointerOut);
  root.addEventListener("focusin", focusIn);
  root.addEventListener("focusout", focusOut);
  root.addEventListener("click", click);
  root.addEventListener("keydown", keydown);
  return () => {
    hide();
    root.removeEventListener("pointerover", pointerOver);
    root.removeEventListener("pointerout", pointerOut);
    root.removeEventListener("focusin", focusIn);
    root.removeEventListener("focusout", focusOut);
    root.removeEventListener("click", click);
    root.removeEventListener("keydown", keydown);
  };
}

// src/sidebar/popover.ts
function initializeDismissiblePopover(button, panel, root) {
  const setOpen = (open) => {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  };
  const click = (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (button.contains(target)) {
      setOpen(panel.hidden);
    } else if (!panel.contains(target)) {
      setOpen(false);
    }
  };
  const keydown = (event) => {
    if (event.key === "Escape") setOpen(false);
  };
  root.addEventListener("click", click);
  root.addEventListener("keydown", keydown);
  return () => {
    setOpen(false);
    root.removeEventListener("click", click);
    root.removeEventListener("keydown", keydown);
  };
}

// src/sidebar/candidates.ts
function externalButton(document2, href, label) {
  const link = document2.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "button-link secondary";
  link.textContent = label;
  return link;
}
function renderCandidateCards(container, candidates2, validatedId, handlers) {
  const document2 = container.ownerDocument;
  container.replaceChildren();
  for (const candidate of candidates2) {
    const card = document2.createElement("article");
    card.className = `candidate${validatedId === candidate.id ? " validated" : ""}`;
    const poster = candidate.poster ? document2.createElement("img") : document2.createElement("div");
    poster.className = "poster";
    if (poster instanceof HTMLImageElement) {
      poster.src = candidate.poster;
      poster.alt = "";
    } else {
      poster.textContent = "Nessuna locandina";
    }
    const body = document2.createElement("div");
    const title = document2.createElement("h3");
    title.textContent = `${candidate.title}${candidate.year ? ` (${candidate.year})` : ""}`;
    const overview = document2.createElement("p");
    overview.textContent = candidate.overview || "Trama non disponibile.";
    const actions = document2.createElement("div");
    actions.className = "candidate-actions";
    const validate = document2.createElement("button");
    validate.type = "button";
    validate.textContent = "Valida questo titolo";
    validate.addEventListener("click", () => handlers.validate(candidate));
    const fallback = document2.createElement("button");
    fallback.type = "button";
    fallback.className = "secondary candidate-fallback";
    fallback.append(
      "Usa esplicitamente titolo",
      document2.createElement("br"),
      " e anno senza TMDB ID"
    );
    fallback.disabled = !/^\d{4}$/.test(candidate.year);
    fallback.addEventListener("click", () => handlers.fallback(candidate));
    actions.append(
      validate,
      externalButton(document2, candidate.url, "Apri su TMDB"),
      externalButton(document2, candidate.imdbUrl, "Apri su IMDb"),
      fallback
    );
    body.append(title, overview, actions);
    card.append(poster, body);
    container.append(card);
  }
}

// src/sidebar/phase-validation.ts
function resolvePhaseValidity(input2) {
  const phase1 = input2.metadataValid;
  const phase2 = input2.variants.length > 0 && input2.variants.every((variant) => selectArchiveLinks(variant.links, input2.hosts).length > 0) && !input2.passwordConflict;
  const phase3 = phase1 && phase2 && input2.taskflowConfigured && input2.workflowNameValid && (!input2.quickPresetRequired || input2.quickPresetSelected);
  return { phase1, phase2, phase3 };
}
function applyPhaseValidity(validity, sections) {
  for (const key of ["phase1", "phase2", "phase3"]) {
    sections[key].classList.toggle("validated-phase", validity[key]);
  }
}

// src/sidebar/settings-form.ts
function fillSettingsFields(settings2, fields) {
  fields.taskflowBaseUrl.value = settings2.taskflowBaseUrl;
  fields.taskflowToken.value = settings2.taskflowToken;
  fields.tmdbCredential.value = settings2.tmdbCredential;
  fields.omdbApiKey.value = settings2.omdbApiKey;
}
function readSettingsFields(fields) {
  return {
    taskflowBaseUrl: fields.taskflowBaseUrl.value,
    taskflowToken: fields.taskflowToken.value,
    tmdbCredential: fields.tmdbCredential.value,
    omdbApiKey: fields.omdbApiKey.value
  };
}

// src/sidebar/technical-summary.ts
function formatMetric(value, divisor, suffix) {
  return value === null ? "\u2014" : `${(value / divisor).toLocaleString("it-IT", { maximumFractionDigits: 2 })} ${suffix}`;
}
function formatBytes(value) {
  if (value === null || !Number.isFinite(value) || value <= 0) return "\u2014";
  const gibibyte = 1024 ** 3;
  const mebibyte = 1024 ** 2;
  const [divisor, unit] = value >= gibibyte ? [gibibyte, "GiB"] : [mebibyte, "MiB"];
  return `${(value / divisor).toLocaleString("it-IT", { maximumFractionDigits: 2 })} ${unit}`;
}
function formatTechnicalSummary(technical) {
  return [
    technical.resolution ? `${technical.resolution}p` : "Risoluzione \u2014",
    technical.codec || "Codec \u2014",
    technical.hdr || "",
    `Video ${formatMetric(technical.videoBitrate, 1e6, "Mb/s")}`,
    `Totale ${formatMetric(technical.overallBitrate, 1e6, "Mb/s")}`,
    `File ${formatBytes(technical.totalBytes)}`,
    `Traccia video ${formatBytes(technical.videoBytes)}`
  ].filter(Boolean).join(" \xB7 ");
}

// src/sidebar/full-webui.ts
function initializeFullWebUiToggle(view, dependencies) {
  let ui = null;
  const toggle = () => {
    if (!view.panel.hidden) {
      view.home.hidden = false;
      view.panel.hidden = true;
      view.button.textContent = "Apri WebUI TaskFlow";
      return;
    }
    view.button.disabled = true;
    void (async () => {
      try {
        const configuration = await dependencies.loadConfiguration();
        if (!ui) {
          const candidate = await dependencies.createUi();
          candidate.view = "dashboard";
          candidate.configure(configuration);
          view.panel.replaceChildren(candidate);
          ui = candidate;
        } else {
          ui.configure(configuration);
        }
        view.status.textContent = "";
        view.home.hidden = true;
        view.panel.hidden = false;
        view.button.textContent = "Torna a JSpider";
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "Configurazione non disponibile.";
        view.status.textContent = `WebUI TaskFlow non disponibile: ${message}`;
        view.home.hidden = false;
        view.panel.hidden = true;
      } finally {
        view.button.disabled = false;
      }
    })();
  };
  view.button.addEventListener("click", toggle);
  return () => view.button.removeEventListener("click", toggle);
}

// src/sidebar/preset-cleanup.ts
function resolvePresetCleanup(presetCode, presets) {
  if (!presetCode) return true;
  const preset = presets.find((candidate) => candidate.code === presetCode);
  return preset?.defaults?.cleanup_on_success === true;
}

// src/sidebar/emby-status.ts
function led(document2, state) {
  const node = document2.createElement("span");
  node.className = `emby-led ${state}`;
  node.setAttribute("aria-hidden", "true");
  return node;
}
function renderEmbyStatus(container, status2) {
  const document2 = container.ownerDocument;
  container.replaceChildren();
  container.className = `emby-status ${status2.state}`;
  const heading = document2.createElement("strong");
  heading.className = "emby-heading";
  heading.textContent = "Libreria Emby";
  container.append(heading);
  const list = document2.createElement("div");
  list.className = "emby-file-list";
  container.append(list);
  if (status2.state === "present" || status2.state === "ambiguous") {
    const files = status2.files.length ? status2.files : ["Nome file non disponibile"];
    for (const file of files) {
      const row = document2.createElement("div");
      row.className = "emby-file-row";
      const name = document2.createElement("span");
      name.className = "emby-file-name";
      name.textContent = file;
      row.append(led(document2, status2.state === "present" ? "present" : "ambiguous"), name);
      list.append(row);
    }
  } else {
    const row = document2.createElement("div");
    row.className = "emby-file-row";
    row.append(led(document2, status2.state));
    if (status2.state === "idle") row.append("Valida il titolo per controllare la libreria.");
    if (status2.state === "checking") row.append("Controllo in corso\u2026");
    if (status2.state === "absent") row.append("Nessun file trovato.");
    if (status2.state === "unavailable") row.append(status2.message);
    list.append(row);
  }
  const label = document2.createElement("span");
  label.className = "emby-result-label";
  label.textContent = {
    idle: "In attesa",
    checking: "Verifica",
    present: "Presente",
    absent: "Assente",
    ambiguous: "Ambiguo",
    unavailable: "Non verificabile"
  }[status2.state];
  container.append(label);
}

// src/sidebar/index.ts
var element = (id) => document.getElementById(id);
var input = (id) => element(id);
var select = (id) => element(id);
var snapshot = null;
var selectedKeys = [];
var explicitlyAdjusted = false;
var candidates = [];
var metadata = null;
var catalog = null;
var settings = null;
var createMode = initialCreateModeState();
var manualPassword = null;
var tmdbResultGate = new LatestResultGate();
var embyResultGate = new LatestResultGate();
renderEmbyStatus(element("emby-status"), { state: "idle" });
initializeTooltips(document);
initializeDismissiblePopover(
  element("settings-button"),
  element("settings-panel"),
  document
);
initializeFullWebUiToggle({
  home: element("home-view"),
  panel: element("taskflow-full-panel"),
  button: element("open-taskflow-webui"),
  status: element("status")
}, {
  loadConfiguration: taskFlowConfiguration,
  createUi: async () => {
    await customElements.whenDefined("taskflow-ui");
    return document.createElement("taskflow-ui");
  }
});
async function background(action, data = {}) {
  const response = await chrome.runtime.sendMessage({ target: "background", action, ...data });
  if (!response.ok) {
    const error = new Error(response.error?.message ?? "Operazione non riuscita.");
    Object.assign(error, response.error);
    throw error;
  }
  return response.data;
}
async function page(action, data = {}) {
  return background("page.forward", { request: { action, data } });
}
function status(message, error = false) {
  const node = element("status");
  node.textContent = message;
  node.classList.toggle("error", error);
}
function settingsFields() {
  return {
    taskflowBaseUrl: input("taskflow-url"),
    taskflowToken: input("taskflow-token"),
    tmdbCredential: input("tmdb-token"),
    omdbApiKey: input("omdb-api-key")
  };
}
function selectedVariants() {
  const selected = new Set(selectedKeys);
  return snapshot?.variants.filter((variant) => selected.has(variant.key)) ?? [];
}
function selectedHosts() {
  return [
    ...input("filestore").checked ? ["filestore.me"] : [],
    ...input("terabytez").checked ? ["terabytez.org"] : []
  ];
}
function recommendation() {
  return recommendVersions(
    snapshot?.variants ?? [],
    select("profile").value,
    input("limit").value === "" ? null : Number(input("limit").value)
  );
}
function renderVersions() {
  const container = element("versions");
  container.replaceChildren();
  const proposal = recommendation();
  selectedKeys = reconcileSelection(
    selectedKeys,
    explicitlyAdjusted,
    snapshot?.variants.map((variant) => variant.key) ?? [],
    proposal.keys
  );
  const selected = new Set(selectedKeys);
  for (const variant of snapshot?.variants ?? []) {
    const card = document.createElement("article");
    card.className = "version-card";
    const label = document.createElement("label");
    label.className = "version-choice";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.has(variant.key);
    checkbox.addEventListener("change", () => {
      explicitlyAdjusted = true;
      selectedKeys = checkbox.checked ? [.../* @__PURE__ */ new Set([...selectedKeys, variant.key])] : selectedKeys.filter((key) => key !== variant.key);
      renderVersions();
    });
    const title = document.createElement("strong");
    title.textContent = variant.packageName;
    label.append(checkbox, title);
    const technical = document.createElement("p");
    technical.className = "muted small";
    technical.textContent = formatTechnicalSummary(variant.technical);
    const reason = document.createElement("p");
    reason.className = "version-reason small";
    reason.textContent = proposal.reasons[variant.key] ?? "Scelta manuale.";
    if (variant.locked) reason.textContent += " Ringrazia l\u2019articolo per sbloccare i link.";
    if (variant.linkError) reason.textContent += ` ${variant.linkError}`;
    card.append(label, technical, reason);
    container.append(card);
  }
  element("recommendation-notes").textContent = proposal.notes.join(" ");
  input("thank-selected").disabled = !snapshot?.supportsThanks || !selectedKeys.length;
  const links = selectedVariants().flatMap((variant) => variant.links);
  element("filestore-count").textContent = `\xB7 ${links.filter((link) => new URL(link).hostname === "filestore.me").length}`;
  element("terabytez-count").textContent = `\xB7 ${links.filter((link) => new URL(link).hostname === "terabytez.org").length}`;
  syncPasswordField();
  renderCreateState();
}
function renderCandidates() {
  const results = element("results");
  renderCandidateCards(
    results,
    candidates,
    metadata?.mode === "validated" ? metadata.id : null,
    {
      validate(candidate) {
        metadata = { mode: "validated", id: candidate.id, mediaKind: candidate.mediaKind };
        element("validation-state").textContent = `Validato: ${candidate.title} \xB7 TMDB ${candidate.id}`;
        renderCandidates();
        renderCreateState();
        void checkEmby({ mode: "tmdb", tmdbId: candidate.id, mediaKind: candidate.mediaKind });
      },
      fallback(candidate) {
        metadata = {
          mode: "fallback",
          title: candidate.title,
          year: candidate.year,
          mediaKind: candidate.mediaKind
        };
        element("validation-state").textContent = `Fallback confermato manualmente: ${candidate.title} (${candidate.year}).`;
        renderCandidates();
        renderCreateState();
        void checkEmby({
          mode: "title",
          title: candidate.title,
          ...candidate.year ? { year: Number(candidate.year) } : {},
          mediaKind: candidate.mediaKind
        });
      }
    }
  );
}
async function checkEmby(input2) {
  embyResultGate.invalidate();
  if (!settings?.embyConfigured || !settings.embyBaseUrl) {
    renderEmbyStatus(element("emby-status"), {
      state: "unavailable",
      message: "Emby non configurato in config.local.json."
    });
    return;
  }
  renderEmbyStatus(element("emby-status"), { state: "checking" });
  try {
    const result = await embyResultGate.run(async () => {
      const url = new URL(settings.embyBaseUrl);
      const originPattern = `${url.protocol}//${url.hostname}/*`;
      const permission = chrome.permissions.request({ origins: [originPattern] });
      if (!await permission) throw new Error("Permesso di collegamento a Emby non concesso.");
      return background("emby.check", { input: input2 });
    });
    if (result) renderEmbyStatus(element("emby-status"), result);
  } catch (reason) {
    renderEmbyStatus(element("emby-status"), {
      state: "unavailable",
      message: reason instanceof Error ? reason.message : "Controllo Emby non riuscito."
    });
  }
}
function applyTmdbResult(result) {
  candidates = result.candidates;
  metadata = null;
  renderCandidates();
  renderCreateState();
  element("search-status").textContent = candidates.length ? result.method === "imdb" ? "Corrispondenza tramite IMDb trovata \xB7 conferma manualmente il titolo." : `${candidates.length} candidati trovati \xB7 valida manualmente.` : "Nessun candidato trovato. Modifica titolo o anno e ripeti la ricerca.";
}
function clearTmdbSelection() {
  embyResultGate.invalidate();
  metadata = null;
  candidates = [];
  clearTmdbView({
    results: element("results"),
    validation: element("validation-state")
  });
  renderEmbyStatus(element("emby-status"), { state: "idle" });
  renderCreateState();
}
function renderCatalog() {
  const preset = select("workflow-preset");
  const previous = preset.value;
  preset.replaceChildren(new Option("Seleziona un preset TaskFlow", ""));
  for (const item of catalog?.presets ?? []) preset.append(new Option(`${item.name} (${item.code})`, item.code));
  if ([...preset.options].some((option) => option.value === previous)) preset.value = previous;
  const selectedPreset = catalog?.presets.find((item) => item.code === preset.value);
  input("cleanup").checked = resolvePresetCleanup(preset.value, catalog?.presets ?? []);
  element("preset-summary").textContent = selectedPreset ? `Ereditato dal server: ${selectedPreset.tasks.join(" \u2192 ")}` : "Seleziona un preset TaskFlow per usare Quick Workflow.";
  renderCreateState();
}
function syncPasswordField() {
  const resolution = resolveArchivePassword(selectedVariants(), manualPassword);
  input("rar-password").value = resolution.value;
  element("rar-password-state").textContent = resolution.conflict ? "Le versioni selezionate hanno password diverse: inserisci manualmente quella da usare." : resolution.source === "detected" ? "Password rilevata dalle versioni selezionate." : resolution.source === "manual" ? "Password impostata manualmente." : "";
  element("rar-password-state").classList.toggle("error-text", resolution.conflict);
}
function workflowPassword() {
  const resolution = resolveArchivePassword(selectedVariants(), manualPassword);
  if (resolution.conflict) throw new Error("Scegli manualmente la password RAR da usare.");
  return resolution.value;
}
function renderCreateState() {
  applyCreateModeView(createMode, {
    quickPanel: element("quick-panel"),
    taskflowPanel: element("taskflow-panel"),
    quickChoice: input("mode-quick"),
    taskflowChoice: input("mode-taskflow")
  });
  const autodownload = input("autodownload").checked;
  const workflowNameValid = Boolean(normalizeWorkflowName(input("workflow-name").value));
  let passwordConflict = true;
  try {
    passwordConflict = resolveArchivePassword(selectedVariants(), manualPassword).conflict;
  } catch {
    passwordConflict = true;
  }
  const validity = resolvePhaseValidity({
    metadataValid: metadata !== null,
    variants: selectedVariants(),
    hosts: selectedHosts(),
    passwordConflict,
    taskflowConfigured: Boolean(settings?.taskflowConfigured),
    workflowNameValid,
    quickPresetRequired: createMode.selected === "quick" && autodownload,
    quickPresetSelected: Boolean(select("workflow-preset").value)
  });
  applyPhaseValidity(validity, {
    phase1: element("phase-1"),
    phase2: element("phase-2"),
    phase3: element("phase-3")
  });
  select("workflow-preset").disabled = createMode.locked || !autodownload;
  input("cleanup").disabled = createMode.locked || !autodownload;
  input("quick-workflow").disabled = createMode.locked || !snapshot || !validity.phase3;
  input("load-packages").disabled = createMode.locked || !snapshot || !validity.phase3;
}
async function readSnapshot(action = "snapshot") {
  tmdbResultGate.invalidate();
  status("Lettura della scheda e delle versioni\u2026");
  const fresh = await page(action);
  const previousIdentity = snapshot ? `${snapshot.siteId}:${snapshot.sourceUrl}` : "";
  snapshot = fresh;
  clearTmdbSelection();
  if (previousIdentity && previousIdentity !== `${fresh.siteId}:${fresh.sourceUrl}`) {
    selectedKeys = [];
    explicitlyAdjusted = false;
    manualPassword = null;
    createMode = initialCreateModeState();
    element("taskflow-create-slot").replaceChildren();
    element("taskflow-create-state").textContent = "";
  }
  element("source-name").textContent = fresh.siteName.toUpperCase();
  element("source").textContent = `${fresh.title}${fresh.year ? ` (${fresh.year})` : ""} \xB7 ${fresh.variants.length} versioni`;
  input("title").value = fresh.title;
  input("year").value = fresh.year;
  select("kind").value = fresh.mediaKind;
  if (!input("workflow-name").value) input("workflow-name").value = normalizeWorkflowName(`${fresh.title}_${fresh.year}`);
  element("thanks-hint").textContent = fresh.thanksHint ?? "Le versioni gi\xE0 sbloccate vengono saltate.";
  renderVersions();
  status("Scheda aggiornata.");
  if (settings?.tmdbConfigured) element("search-status").textContent = "Ricerca TMDB tramite IMDb in corso\u2026";
  try {
    const result = await tmdbResultGate.run(() => autoSearchSnapshot(
      fresh,
      Boolean(settings?.tmdbConfigured),
      (input2) => background("tmdb.search", { input: input2 })
    ));
    if (result) applyTmdbResult(result);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Ricerca TMDB non riuscita.";
    element("search-status").textContent = `Ricerca automatica non riuscita: ${message}`;
  }
}
async function loadSettingsSummary() {
  settings = await background("settings.get");
  fillSettingsFields(settings, settingsFields());
  element("settings-state").textContent = `TaskFlow: ${settings.taskflowConfigured ? "configurato" : "token mancante"} \xB7 TMDB: ${settings.tmdbConfigured ? "configurato" : "token mancante"} \xB7 OMDb: ${settings.omdbConfigured ? "configurato" : "API key mancante"} \xB7 Emby: ${settings.embyConfigured ? "configurato" : "config locale mancante"} \xB7 backend JD in produzione non verificato per commit.`;
  renderCreateState();
}
async function loadCatalog() {
  if (settings?.taskflowConfigured) {
    try {
      catalog = await background("taskflow.catalog");
      renderCatalog();
    } catch (reason) {
      element("preset-summary").textContent = reason instanceof Error ? reason.message : "Catalogo TaskFlow non disponibile.";
    }
  }
}
async function taskFlowConfiguration() {
  const auth = await background("settings.taskflowToken");
  return {
    apiUrl: auth.baseUrl,
    getAccessToken: async () => (await background("settings.taskflowToken")).token,
    theme: "dark"
  };
}
async function initializeOverlayWidth() {
  await initializeOverlayWidthControl(location.href, {
    container: element("overlay-width-control"),
    select: select("overlay-width")
  }, () => page("overlay.status"));
}
element("refresh").addEventListener("click", () => void readSnapshot("refresh").catch((reason) => status(reason.message, true)));
select("profile").addEventListener("change", () => {
  explicitlyAdjusted = false;
  renderVersions();
});
input("limit").addEventListener("input", () => {
  explicitlyAdjusted = false;
  renderVersions();
});
for (const id of ["filestore", "terabytez", "workflow-name"]) input(id).addEventListener("input", renderCreateState);
input("autodownload").addEventListener("change", renderCreateState);
select("workflow-preset").addEventListener("change", renderCatalog);
input("rar-password").addEventListener("input", () => {
  manualPassword = input("rar-password").value;
  syncPasswordField();
  renderCreateState();
});
for (const [id, mode] of [["mode-quick", "quick"], ["mode-taskflow", "taskflow"]]) {
  input(id).addEventListener("change", () => {
    createMode = selectCreateMode(createMode, mode);
    renderCreateState();
  });
}
select("overlay-width").addEventListener("change", () => {
  void page("overlay.resize", {
    width: Number(select("overlay-width").value)
  }).then((result) => {
    select("overlay-width").value = String(result.width);
  }).catch((reason) => status(reason instanceof Error ? reason.message : "Larghezza non aggiornata.", true));
});
for (const id of ["title", "year", "kind"]) element(id).addEventListener("input", () => {
  tmdbResultGate.invalidate();
  clearTmdbSelection();
});
element("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void (async () => {
    clearTmdbSelection();
    element("search-status").textContent = "Ricerca TMDB in corso\u2026";
    const result = await tmdbResultGate.run(() => background("tmdb.search", {
      input: { title: input("title").value, year: input("year").value, mediaKind: select("kind").value, imdbId: snapshot?.imdbId ?? "", mode: "title" }
    }));
    if (result) applyTmdbResult(result);
  })().catch((reason) => {
    element("search-status").textContent = reason.message;
    status(reason.message, true);
  });
});
element("imdb-search").addEventListener("click", () => {
  void (async () => {
    clearTmdbSelection();
    element("search-status").textContent = "Ricerca tramite IMDb, con fallback titolo\u2026";
    const result = await tmdbResultGate.run(() => background("tmdb.search", {
      input: { title: input("title").value, year: input("year").value, mediaKind: select("kind").value, imdbId: snapshot?.imdbId ?? "", mode: "auto" }
    }));
    if (result) applyTmdbResult(result);
  })().catch((reason) => status(reason.message, true));
});
element("thank-selected").addEventListener("click", () => {
  void (async () => {
    status("Ringraziamento e rilettura dei link\u2026");
    const result = await page("thank", { variantKeys: selectedKeys });
    snapshot = result.context;
    selectedKeys = applyThankReplacements(selectedKeys, result.thanks.replacements ?? {}, snapshot.variants.map((variant) => variant.key));
    explicitlyAdjusted = true;
    renderVersions();
    status(`Ringraziate: ${result.thanks.thanked.length} \xB7 gi\xE0 sbloccate: ${result.thanks.already.length} \xB7 errori: ${result.thanks.failed.length}`, Boolean(result.thanks.failed.length));
  })().catch((reason) => status(reason.message, true));
});
element("settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void (async () => {
    const visibleSettings = readSettingsFields(settingsFields());
    const baseUrl = normalizeTaskFlowBaseUrl(visibleSettings.taskflowBaseUrl.trim());
    const url = new URL(baseUrl);
    const originPattern = `${url.protocol}//${url.hostname}/*`;
    if (!await chrome.permissions.contains({ origins: [originPattern] })) {
      const granted = await chrome.permissions.request({ origins: [originPattern] });
      if (!granted) throw new Error("Permesso di collegamento a TaskFlow non concesso.");
    }
    const patch = { ...visibleSettings, taskflowBaseUrl: baseUrl };
    settings = await background("settings.save", { settings: patch });
    await loadSettingsSummary();
    await loadCatalog();
    status("Collegamenti salvati soltanto nell\u2019estensione.");
  })().catch((reason) => status(reason.message, true));
});
function reportSubmissionError(reason) {
  const detail = reason.analysis?.failures?.map((failure) => `${failure.inputName}: ${failure.error ?? "errore"}`).join("; ");
  status(`${reason.message}${detail ? ` ${detail}` : ""}`, true);
}
element("quick-workflow").addEventListener("click", () => {
  void (async () => {
    if (createMode.selected !== "quick" || createMode.locked) return;
    const autodownload = input("autodownload").checked;
    if (autodownload && !metadata) throw new Error("Valida un candidato TMDB o conferma il fallback.");
    const variants = selectedVariants();
    const hosts = selectedHosts();
    const preset = autodownload ? requireQuickWorkflowPreset(select("workflow-preset").value) : select("workflow-preset").value;
    const workflow = autodownload ? {
      workflowName: requireWorkflowName(input("workflow-name").value),
      metadata,
      password: workflowPassword(),
      cleanupOnSuccess: input("cleanup").checked,
      preset
    } : void 0;
    createMode = lockCreateMode(createMode);
    renderCreateState();
    status(autodownload ? "Quick Workflow: Submission \u2192 Create \u2192 Start in corso. Non ripetere l\u2019invio." : "Submission al LinkGrabber in corso. Non ripetere l\u2019invio.");
    const result = await background("taskflow.quickWorkflow", {
      variants,
      hosts,
      autodownload,
      ...workflow ? { workflow } : {}
    });
    if (result.submissionOnly) {
      status(`Submission completata: ${result.submission.outcomes.length} pacchetti lasciati nel LinkGrabber.`);
      return;
    }
    if (!result.createdWorkflow) throw new Error("TaskFlow non ha restituito il workflow creato.");
    if (result.startError) {
      status(`Workflow ${result.createdWorkflow.id} creato, ma Start non riuscito: ${result.startError.message ?? "errore"}. Aprilo nella WebUI e riprova soltanto Start, senza reinviare i package.`, true);
    } else {
      status(`Workflow ${result.createdWorkflow.id} creato e avviato \xB7 stato ${result.startedWorkflow?.status ?? "accettato"}.`);
    }
  })().catch((reason) => reportSubmissionError(reason));
});
element("load-packages").addEventListener("click", () => {
  void (async () => {
    if (createMode.selected !== "taskflow" || createMode.locked) return;
    if (!metadata) throw new Error("Valida un candidato TMDB o conferma il fallback.");
    const variants = selectedVariants();
    const hosts = selectedHosts();
    const workflowName = requireWorkflowName(input("workflow-name").value);
    const password = workflowPassword();
    createMode = lockCreateMode(createMode);
    renderCreateState();
    status("Caricamento package su JD in corso. Non ripetere l\u2019invio.");
    const submission = await background("taskflow.loadPackages", {
      variants,
      hosts
    });
    await customElements.whenDefined("taskflow-ui");
    const ui = document.createElement("taskflow-ui");
    element("taskflow-create-slot").replaceChildren(ui);
    const tmdb = metadata.mode === "validated" ? { tmdb_id: metadata.id } : { title: metadata.title, year: Number(metadata.year) };
    await openTaskFlowCreate(ui, {
      packageIds: submission.taskflowIds,
      workflowName,
      mediaKind: metadata.mediaKind,
      tmdb,
      password
    }, await taskFlowConfiguration());
    element("taskflow-create-state").textContent = `${submission.outcomes.length} package caricati su JD. Completa il workflow nella WebUI.`;
    status("Package caricati su JD. La WebUI Create \xE8 pronta.");
  })().catch((reason) => reportSubmissionError(reason));
});
void (async () => {
  await runSidebarStartup({
    loadSettings: loadSettingsSummary,
    initializeOverlayWidth,
    loadCatalog,
    readSnapshot
  });
})().catch((reason) => status(reason instanceof Error ? reason.message : "Avvio JSpider non riuscito.", true));
