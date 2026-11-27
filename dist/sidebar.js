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
  const codecFamily = (codec) => {
    if (/^(?:HEVC|H\.?265)$/i.test(codec.trim())) return "hevc";
    if (/^(?:AVC|H\.?264)$/i.test(codec.trim())) return "avc";
    return "other";
  };
  const equivalentVideoRate = (variant) => videoRate(variant) * (codecFamily(variant.technical.codec) === "hevc" ? 2 : 1);
  const totalRate = (variant) => variant.technical.overallBitrate ?? (variant.technical.totalBytes !== null && variant.technical.duration !== null ? variant.technical.totalBytes * 8 / variant.technical.duration : 0);
  const withinLimit = (variant) => unlimited || totalRate(variant) > 0 && totalRate(variant) <= Number(limitMbps) * 1e6;
  const rateText = (rate) => `${(rate / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 2 })} Mb/s`;
  const comparisonText = (variant) => {
    const rate = videoRate(variant);
    const family = codecFamily(variant.technical.codec);
    if (family === "hevc") return `HEVC ${rateText(rate)} \xB7 equiv. AVC ${rateText(equivalentVideoRate(variant))}`;
    if (family === "avc") return `AVC ${rateText(rate)}`;
    return `${variant.technical.codec || "Codec \u2014"} ${rateText(rate)}`;
  };
  const choose = (list, group, resolution, selected) => {
    if (!list.length) {
      if (selected) result.notes.push(`${group}: nessuna versione disponibile.`);
      return;
    }
    const eligible = list.filter(withinLimit);
    for (const variant of list) {
      if (!withinLimit(variant)) {
        result.reasons[variant.key] = totalRate(variant) > 0 ? "Esclusa: bitrate totale oltre il limite." : "Esclusa: bitrate totale non disponibile.";
      }
    }
    if (!eligible.length) {
      result.notes.push(`${group}: nessuna candidata con bitrate totale verificabile entro soglia.`);
      return;
    }
    const highestTier = Math.max(...eligible.map(tier));
    const pool = eligible.filter((variant) => tier(variant) === highestTier);
    const ranked = pool.slice().sort((left, right) => equivalentVideoRate(right) - equivalentVideoRate(left) || (right.technical.bitDepth ?? 0) - (left.technical.bitDepth ?? 0) || videoRate(left) - videoRate(right) || left.key.localeCompare(right.key));
    const best = ranked[0];
    if (!best) return;
    const technical = pool.map((variant) => variant.technical);
    const issues = [];
    if (technical.some((item) => !item.codec || !item.bitDepth || !item.videoBitrate || !item.duration)) {
      issues.push("dati incompleti");
    }
    if (technical.some((item) => item.bitrateEstimated)) issues.push("bitrate stimato");
    if (highestTier === 0) issues.push("sorgente non riconosciuta");
    const differs = (field) => new Set(
      technical.map((item) => item[field] ?? "")
    ).size > 1;
    if (differs("codec") && technical.some((item) => codecFamily(item.codec) === "other")) {
      issues.push("codec non confrontabili");
    }
    if (differs("bitDepth")) issues.push("bit depth diversa");
    if (differs("hdr")) issues.push("HDR/SDR");
    if (differs("sourceFamily") || differs("provider")) issues.push("sorgenti diverse");
    const spread = (field) => {
      const values = technical.map((item) => item[field]).filter((value) => value !== null && value > 0);
      return values.length > 1 && Math.max(...values) / Math.min(...values) > 1.02;
    };
    if (spread("duration")) issues.push("durata diversa");
    if (spread("width") || spread("height") || spread("fps")) issues.push("dimensioni/FPS diversi");
    const uncertain = issues.length > 0;
    const singleText = {
      untouched: "priorit\xE0 REMUX",
      source: "unica versione WEB-DL",
      encode: "unica versione codificata",
      unknown: "unica candidata"
    }[best.technical.category];
    const prefix = selected ? "Proposta" : `Candidata ${group}`;
    const decision = pool.length > 1 ? videoRate(best) > 0 ? comparisonText(best) : "bitrate video non disponibile" : singleText;
    let reason = `${prefix}: ${decision}.`;
    if (uncertain) reason += ` Indicativa: ${issues.join(" \xB7 ")}.`;
    result.reasons[best.key] = reason;
    for (const variant of eligible) {
      if (variant === best) continue;
      result.reasons[variant.key] = tier(variant) < highestTier ? highestTier >= priority.source ? "Alternativa: priorit\xE0 inferiore alla sorgente/REMUX." : "Alternativa: priorit\xE0 inferiore." : videoRate(variant) > 0 ? `Alternativa: ${comparisonText(variant)}.` : "Alternativa: bitrate video non disponibile.";
    }
    result.comparisons.push({ resolution, key: best.key, uncertain, selected, group });
    if (selected) result.keys.push(best.key);
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

// src/domain/media-ratings.ts
var sourceOrder = [
  "imdb",
  "tomatoes",
  "popcorn",
  "metacritic",
  "metacriticuser",
  "letterboxd",
  "trakt",
  "rogerebert",
  "myanimelist",
  "justwatch"
];
var labels = {
  imdb: "IMDb",
  tomatoes: "Rotten Tomatoes critica",
  popcorn: "Rotten Tomatoes pubblico",
  metacritic: "Metacritic",
  metacriticuser: "Metacritic utenti",
  letterboxd: "Letterboxd",
  trakt: "Trakt",
  rogerebert: "Roger Ebert",
  myanimelist: "MyAnimeList",
  justwatch: "JustWatch"
};
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function relativePath(value, prefix) {
  if (typeof value !== "string" || !prefix.test(value) || value.includes("..") || value.includes("\\")) return null;
  return value;
}
function finiteValue(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function textValue(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}
function ratingValue(source, value) {
  if (source === "tomatoes" || source === "popcorn" || source === "trakt") return `${textValue(value)}%`;
  if (source === "rogerebert") return `${textValue(value)}/4`;
  return textValue(value);
}
function searchQuery(input2) {
  return [input2.title.trim(), input2.year.trim()].filter(Boolean).join(" ");
}
function queryUrl(origin, pathname, key, value) {
  const url = new URL(pathname, origin);
  url.searchParams.set(key, value);
  return url.toString();
}
function providerSearchUrl(source, input2) {
  const query = searchQuery(input2);
  if (source === "imdb") return queryUrl("https://www.imdb.com", "/find/", "q", query) + "&s=tt";
  if (source === "tomatoes" || source === "popcorn") {
    return queryUrl("https://www.rottentomatoes.com", "/search", "search", query);
  }
  if (source === "metacritic" || source === "metacriticuser") {
    return `https://www.metacritic.com/search/${encodeURIComponent(query)}/`;
  }
  if (source === "letterboxd") return `https://letterboxd.com/search/${encodeURIComponent(query)}/`;
  if (source === "trakt") {
    return `https://trakt.tv/search/tmdb/${input2.tmdbId}?id_type=${input2.mediaKind === "movie" ? "movie" : "show"}`;
  }
  if (source === "rogerebert") return queryUrl("https://www.rogerebert.com", "/search", "query", query);
  if (source === "myanimelist") {
    const url = new URL("/anime.php", "https://myanimelist.net");
    url.searchParams.set("q", query);
    url.searchParams.set("cat", "anime");
    return url.toString();
  }
  return queryUrl("https://www.justwatch.com", "/it/cerca", "q", query);
}
function sourceUrl(source, item, ratings, ids, mediaKind) {
  const imdb = typeof ids.imdb === "string" && /^tt\d+$/.test(ids.imdb) ? ids.imdb : "";
  if (source === "imdb") return imdb ? `https://www.imdb.com/title/${imdb}/` : null;
  if (source === "trakt") {
    return Number.isSafeInteger(ids.trakt) && Number(ids.trakt) > 0 ? `https://trakt.tv/${mediaKind === "movie" ? "movies" : "shows"}/${String(ids.trakt)}` : null;
  }
  if (source === "myanimelist") {
    return Number.isSafeInteger(ids.mal) && Number(ids.mal) > 0 ? `https://myanimelist.net/anime/${String(ids.mal)}` : null;
  }
  if (source === "tomatoes" || source === "popcorn") {
    const path = relativePath(item.url, /^\/(?:m|tv)\/[A-Za-z0-9._~/-]+$/);
    return path ? `https://www.rottentomatoes.com${path}` : null;
  }
  if (source === "letterboxd") {
    const path = relativePath(item.url, /^\/film\/[A-Za-z0-9._~/-]+$/);
    return path ? `https://letterboxd.com${path}` : null;
  }
  if (source === "metacritic" || source === "metacriticuser") {
    const ownPath = relativePath(item.url, /^\/[A-Za-z0-9._~-]+$/);
    const critic = ratings.find((rating) => rating.source === "metacritic");
    const criticPath = relativePath(critic?.url, /^\/[A-Za-z0-9._~-]+$/);
    const path = ownPath ?? criticPath;
    return path ? `https://www.metacritic.com/${mediaKind === "movie" ? "movie" : "tv"}${path}/` : null;
  }
  if (source === "rogerebert") {
    const slug = typeof item.url === "string" && /^[A-Za-z0-9._~-]+$/.test(item.url) ? item.url : "";
    return slug ? `https://www.rogerebert.com/reviews/${slug}` : null;
  }
  return null;
}
function normalizeMdbListMedia(value, input2) {
  const body = record(value) ?? {};
  const ids = record(body.ids) ?? {};
  const rawRatings = Array.isArray(body.ratings) ? body.ratings.map(record).filter((item) => item !== null) : [];
  const ratings = [];
  for (const source of sourceOrder) {
    const item = rawRatings.find((candidate) => candidate.source === source) ?? {};
    const valueNumber = finiteValue(item.value);
    const url = sourceUrl(source, item, rawRatings, ids, input2.mediaKind) ?? providerSearchUrl(source, input2);
    const votes = Number.isSafeInteger(item.votes) && Number(item.votes) >= 0 ? Number(item.votes) : null;
    ratings.push({
      source,
      label: labels[source],
      value: valueNumber === null ? null : ratingValue(source, valueNumber),
      votes,
      url
    });
  }
  const imdb = typeof ids.imdb === "string" && /^tt\d+$/.test(ids.imdb) ? ids.imdb : "";
  const awardsText = typeof body.awards === "string" ? body.awards.trim() : "";
  const awards = awardsText && awardsText !== "N/A" && imdb ? { text: awardsText, url: `https://www.imdb.com/title/${imdb}/awards/` } : null;
  return { ratings, awards, imdbId: imdb || null };
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
var BITRATE_LIMIT_STORAGE_KEY = "jspider.bitrateLimitMbps";
function normalizeBitrateLimit(value) {
  if (value === "") return "";
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).trim();
  const number = Number(text);
  return text && Number.isFinite(number) && number >= 0 ? text : "";
}
function createBitrateLimitState(storage) {
  let pendingWrite = Promise.resolve();
  return {
    async load() {
      await pendingWrite;
      const stored = await storage.get(BITRATE_LIMIT_STORAGE_KEY);
      return normalizeBitrateLimit(stored[BITRATE_LIMIT_STORAGE_KEY]);
    },
    save(value) {
      const normalized = normalizeBitrateLimit(value);
      pendingWrite = pendingWrite.then(() => storage.set({
        [BITRATE_LIMIT_STORAGE_KEY]: normalized
      }));
      return pendingWrite;
    }
  };
}
function resolveThanksPresentation(mode) {
  return {
    showUnlock: mode === "unlock-container",
    showSelection: mode !== "unlock-container",
    selectionLabel: mode === "validate-selection" ? "Conferma le versioni selezionate" : "Ringrazia le versioni selezionate"
  };
}
function shouldSubmitSelectionThanks(mode) {
  return mode !== "validate-selection";
}
function validateUnlockedSelection(variants) {
  if (!variants.length) return "Seleziona almeno una versione.";
  return variants.some((variant) => variant.locked || !variant.linksLoaded || !variant.links.length) ? "Una o pi\xF9 versioni selezionate non hanno link disponibili." : null;
}

// src/sidebar/controller.ts
function directImdbId(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const match = url.origin === "https://www.imdb.com" ? url.pathname.match(/^\/title\/(tt\d+)\/?$/) : null;
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
async function loadCandidateEnrichments(candidates2, configured, lookup, justWatchLookup = async () => null, omdbConfigured = false, omdbAwardsLookup = async () => null) {
  const enrichments = /* @__PURE__ */ new Map();
  await Promise.all(candidates2.map(async (candidate) => {
    const input2 = {
      tmdbId: candidate.id,
      mediaKind: candidate.mediaKind,
      title: candidate.title,
      year: candidate.year
    };
    let enrichment = normalizeMdbListMedia({}, input2);
    if (configured) try {
      const loaded = await lookup(input2);
      const fallback = enrichment;
      const bySource = new Map(fallback.ratings.map((rating) => [rating.source, rating]));
      for (const rating of loaded.ratings) bySource.set(rating.source, rating);
      enrichment = {
        ratings: fallback.ratings.map((rating) => bySource.get(rating.source) ?? rating),
        awards: loaded.awards,
        imdbId: loaded.imdbId
      };
    } catch {
    }
    const imdbId = enrichment.imdbId ?? directImdbId(candidate.imdbUrl);
    if (imdbId !== enrichment.imdbId) enrichment = { ...enrichment, imdbId };
    if (omdbConfigured && !enrichment.awards && imdbId) try {
      const awards = await omdbAwardsLookup(imdbId);
      if (awards) enrichment = { ...enrichment, awards };
    } catch {
    }
    try {
      const justWatch = await justWatchLookup({ ...input2, imdbId: enrichment.imdbId });
      if (justWatch) {
        enrichment = {
          ...enrichment,
          ratings: enrichment.ratings.map((rating) => rating.source === "justwatch" ? justWatch : rating)
        };
      }
    } catch {
    }
    enrichments.set(candidate.id, enrichment);
  }));
  return enrichments;
}
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
function renderUnlockPrompt(document2, container, onUnlock) {
  container.replaceChildren();
  const prompt = document2.createElement("div");
  prompt.className = "unlock-versions-prompt";
  const button = document2.createElement("button");
  button.type = "button";
  button.className = "unlock-versions";
  button.textContent = "Ringrazia e carica le versioni";
  button.addEventListener("click", onUnlock);
  prompt.append(button);
  container.append(prompt);
  return button;
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
  void dependencies.refreshOptionalStatus().catch(() => void 0);
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
  const window2 = trigger.ownerDocument.defaultView;
  const viewportWidth = viewport.clientWidth || window2?.innerWidth || 0;
  const viewportHeight = viewport.clientHeight || window2?.innerHeight || 0;
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
var ratingLogos = {
  imdb: "imdb.png",
  tomatoes: "rotten-tomatoes.png",
  popcorn: "rotten-audience.png",
  metacritic: "metacritic.png",
  metacriticuser: "metacritic-user.png",
  letterboxd: "letterboxd.png",
  trakt: "trakt.png",
  rogerebert: "roger-ebert.png",
  myanimelist: "myanimelist.png",
  justwatch: "justwatch.svg"
};
function ratingLogo(source, value) {
  const numericValue = value === null ? Number.NaN : Number.parseFloat(value);
  if (source === "tomatoes" && numericValue < 60) return "rotten-tomatoes-rotten.png";
  if (source === "popcorn" && numericValue < 60) return "rotten-audience-rotten.png";
  return ratingLogos[source];
}
function ratingLink(document2, source, logoFile, sourceLabel, value, href, title) {
  const link = document2.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = `rating-badge rating-${source}`;
  link.title = title;
  link.setAttribute("aria-label", title);
  const icon = logoFile ? document2.createElement("img") : document2.createElement("span");
  icon.className = logoFile ? "rating-logo" : "rating-icon";
  if (icon instanceof HTMLImageElement) {
    icon.src = `assets/ratings/${logoFile}`;
    icon.alt = sourceLabel;
  } else {
    icon.textContent = sourceLabel;
    icon.setAttribute("aria-hidden", "true");
  }
  link.append(icon);
  if (value) {
    const score = document2.createElement("span");
    score.className = "rating-value";
    score.textContent = value;
    link.append(score);
  }
  return link;
}
function renderRatings(document2, candidate, enrichment) {
  const container = document2.createElement("div");
  container.className = "candidate-ratings";
  const tmdbValue = candidate.voteAverage === null ? null : candidate.voteAverage.toFixed(1);
  const tmdbTitle = tmdbValue === null ? "Apri su TMDB" : `TMDB: ${tmdbValue}${candidate.voteCount > 0 ? ` \xB7 ${new Intl.NumberFormat("it-IT").format(candidate.voteCount)} voti` : ""}`;
  container.append(ratingLink(
    document2,
    "tmdb",
    "tmdb.png",
    "TMDB",
    tmdbValue,
    candidate.url,
    tmdbTitle
  ));
  for (const rating of enrichment?.ratings ?? []) {
    const votes = rating.votes === null ? "" : ` \xB7 ${new Intl.NumberFormat("it-IT").format(rating.votes)} voti`;
    const title = rating.value === null ? `Apri ${rating.label}` : `${rating.label}: ${rating.value}${votes}`;
    container.append(ratingLink(
      document2,
      rating.source,
      ratingLogo(rating.source, rating.value),
      rating.label,
      rating.value,
      rating.url,
      title
    ));
  }
  if (enrichment?.awards) {
    const awards = ratingLink(
      document2,
      "awards",
      null,
      "\u{1F3C6}",
      enrichment.awards.text,
      enrichment.awards.url,
      enrichment.awards.text
    );
    awards.classList.add("rating-awards");
    container.append(awards);
  }
  return container.childElementCount ? container : null;
}
function renderCandidateCards(container, candidates2, validatedId, handlers, ratingsById = /* @__PURE__ */ new Map()) {
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
    body.className = "candidate-body";
    const title = document2.createElement("h3");
    title.textContent = `${candidate.title}${candidate.year ? ` (${candidate.year})` : ""}`;
    const overview = document2.createElement("p");
    overview.className = "candidate-overview";
    overview.id = `candidate-overview-${candidate.mediaKind}-${candidate.id}`;
    overview.textContent = candidate.overview || "Trama non disponibile.";
    const overviewToggle = candidate.overview.trim().length > 160 ? document2.createElement("button") : null;
    if (overviewToggle) {
      overviewToggle.type = "button";
      overviewToggle.className = "overview-toggle";
      overviewToggle.textContent = "Leggi tutto";
      overviewToggle.setAttribute("aria-expanded", "false");
      overviewToggle.setAttribute("aria-controls", overview.id);
      overviewToggle.addEventListener("click", () => {
        const expanded = overview.classList.toggle("expanded");
        overviewToggle.textContent = expanded ? "Mostra meno" : "Leggi tutto";
        overviewToggle.setAttribute("aria-expanded", String(expanded));
      });
    }
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
      fallback
    );
    body.append(title, overview);
    if (overviewToggle) body.append(overviewToggle);
    const ratings = renderRatings(document2, candidate, ratingsById.get(candidate.id));
    if (ratings) body.append(ratings);
    body.append(actions);
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
  fields.mdblistApiKey.value = settings2.mdblistApiKey;
}
function readSettingsFields(fields) {
  return {
    taskflowBaseUrl: fields.taskflowBaseUrl.value,
    taskflowToken: fields.taskflowToken.value,
    tmdbCredential: fields.tmdbCredential.value,
    omdbApiKey: fields.omdbApiKey.value,
    mdblistApiKey: fields.mdblistApiKey.value
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
function formatDuration(value) {
  if (value === null || !Number.isFinite(value) || value <= 0) return "\u2014";
  const minutes = Math.floor(value / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours} h ${remainingMinutes} min` : `${minutes} min`;
}
function formatTechnicalSummary(technical) {
  const metadata2 = [
    technical.resolution ? `${technical.resolution}p` : "Risoluzione \u2014",
    technical.codec || "Codec \u2014",
    technical.hdr || "",
    `Durata ${formatDuration(technical.duration)}`
  ].filter(Boolean).join(" \xB7 ");
  const fileDetails = [
    `Totale File: ${formatMetric(technical.overallBitrate, 1e6, "Mb/s")}`,
    `File ${formatBytes(technical.totalBytes)}`
  ].filter(Boolean).join(" \xB7 ");
  const videoDetails = [
    `Traccia Video: ${formatMetric(technical.videoBitrate, 1e6, "Mb/s")}`,
    `Traccia video ${formatBytes(technical.videoBytes)}`
  ].filter(Boolean).join(" \xB7 ");
  return `${metadata2} \xB7
${fileDetails}
${videoDetails}`;
}
function renderTechnicalSummary(document2, technical) {
  const paragraph = document2.createElement("p");
  paragraph.className = "version-technical muted small";
  const lines = formatTechnicalSummary(technical).split("\n");
  lines.forEach((line, index) => {
    if (index > 0) paragraph.append(document2.createTextNode("\n"));
    const strong = document2.createElement("strong");
    strong.className = "version-technical-line";
    strong.textContent = line;
    paragraph.append(strong);
  });
  return paragraph;
}
function declaredResolution(label) {
  const named = label.match(/\b(2160|1440|1080|720|576|540|480|360)p\b/i)?.[1];
  if (named) return { value: Number(named), text: `${named}p` };
  return /\b4K\b/i.test(label) ? { value: 2160, text: "4K" } : null;
}
function renderResolutionAmbiguity(document2, label, technical) {
  const declared = declaredResolution(label);
  if (!declared || technical.resolution === null || declared.value === technical.resolution) return null;
  const warning = document2.createElement("p");
  warning.className = "version-ambiguity small";
  warning.textContent = `${technical.resolution}p da MediaInfo \xB7 articolo etichettato ${declared.text}.`;
  return warning;
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
var DEFAULT_QUICK_WORKFLOW_PRESET = "default-with-cleanup";
function resolvePresetSelection(previousCode, presets) {
  if (previousCode && presets.some((preset) => preset.code === previousCode)) return previousCode;
  return presets.some((preset) => preset.code === DEFAULT_QUICK_WORKFLOW_PRESET) ? DEFAULT_QUICK_WORKFLOW_PRESET : "";
}
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
function renderEmbyStatus(container, status2, options = {}) {
  const document2 = container.ownerDocument;
  container.replaceChildren();
  container.className = `emby-status ${status2.state}`;
  const heading = document2.createElement("strong");
  heading.className = "emby-heading";
  heading.textContent = "Libreria Emby";
  container.append(heading);
  if (status2.state === "present" && status2.series) {
    const seasons = document2.createElement("div");
    seasons.className = "emby-season-list";
    seasons.setAttribute("aria-label", "Stagioni presenti in Emby");
    for (const season of status2.series.seasons) {
      const button = document2.createElement("button");
      button.type = "button";
      button.className = "emby-season-button";
      button.textContent = `S${String(season.number).padStart(2, "0")}`;
      button.title = season.name;
      button.setAttribute("aria-pressed", String(season.id === status2.series.selectedSeasonId));
      button.disabled = options.loadingSeasonId === season.id;
      button.addEventListener("click", () => options.onSeasonSelect?.(season.id));
      seasons.append(button);
    }
    container.append(seasons);
  }
  const list = document2.createElement("div");
  list.className = "emby-file-list";
  container.append(list);
  if (status2.state === "present" || status2.state === "ambiguous") {
    const selectedSeries = status2.state === "present" ? status2.series : void 0;
    const selectedSeasonId = selectedSeries?.selectedSeasonId ?? null;
    const loading = selectedSeasonId !== null && options.loadingSeasonId === selectedSeasonId;
    const message = selectedSeries && status2.files.length === 0 ? options.seasonError ?? (loading ? "Caricamento episodio 1\u2026" : "Episodio 1 non presente.") : null;
    const files = status2.files.length ? status2.files : message ? [] : ["Nome file non disponibile"];
    if (message) {
      const row = document2.createElement("div");
      row.className = "emby-file-row";
      row.append(led(document2, options.seasonError ? "unavailable" : loading ? "checking" : "absent"), message);
      list.append(row);
    }
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
var EmbyPanelController = class {
  constructor(container, loadSeason) {
    this.container = container;
    this.loadSeason = loadSeason;
  }
  container;
  loadSeason;
  status = { state: "idle" };
  cache = /* @__PURE__ */ new Map();
  revision = 0;
  setStatus(status2) {
    this.revision += 1;
    this.cache.clear();
    this.status = status2;
    if (status2.state === "present" && status2.series?.selectedSeasonId) {
      this.cache.set(status2.series.selectedSeasonId, [...status2.files]);
    }
    this.render();
  }
  async selectSeason(seasonId) {
    const current = this.status;
    if (current.state !== "present" || !current.series || !current.series.seasons.some((season) => season.id === seasonId)) return;
    const revision = ++this.revision;
    const cached = this.cache.get(seasonId);
    this.status = {
      ...current,
      files: cached ? [...cached] : [],
      series: { ...current.series, selectedSeasonId: seasonId }
    };
    if (cached) {
      this.render();
      return;
    }
    this.render({ loadingSeasonId: seasonId });
    try {
      const result = await this.loadSeason(current.series.seriesId, seasonId);
      if (revision !== this.revision || result.seasonId !== seasonId) return;
      this.cache.set(seasonId, [...result.files]);
      this.status = { ...this.status, files: [...result.files] };
      this.render();
    } catch (reason) {
      if (revision !== this.revision) return;
      this.render({
        seasonError: reason instanceof Error ? reason.message : "Controllo stagione Emby non riuscito."
      });
    }
  }
  render(options = {}) {
    renderEmbyStatus(this.container, this.status, {
      ...options,
      onSeasonSelect: (seasonId) => {
        void this.selectSeason(seasonId);
      }
    });
  }
};

// src/sidebar/quick-workflow-log.ts
var phaseLabel = { submission: "Submission", create: "Create", start: "Start" };
var kindLabel = { request: "richiesta", response: "risposta", error: "errore" };
function copyText(value, root = document, execute = (command) => root.execCommand(command)) {
  const source = root.createElement("textarea");
  source.dataset.quickLogCopySource = "";
  source.value = value;
  source.setAttribute("readonly", "");
  source.style.position = "fixed";
  source.style.opacity = "0";
  root.body.append(source);
  source.select();
  try {
    return execute("copy");
  } finally {
    source.remove();
  }
}
function renderQuickWorkflowLog(view, log) {
  view.entries.replaceChildren();
  view.copyButton.disabled = log === null;
  view.clearButton.disabled = log === null;
  if (!log) {
    view.state.textContent = "Nessuna esecuzione Quick Workflow registrata.";
    return;
  }
  view.state.textContent = log.entries.length ? `Ultima esecuzione: ${new Date(log.startedAt).toLocaleString("it-IT")}` : "Quick Workflow avviato; in attesa del primo JSON.";
  for (const entry of log.entries) {
    const details = document.createElement("details");
    details.className = "quick-log-entry";
    if (entry.kind === "error") {
      details.classList.add("error");
      details.open = true;
    }
    const summary = document.createElement("summary");
    const time = new Date(entry.timestamp).toLocaleTimeString("it-IT");
    summary.textContent = `${phaseLabel[entry.phase]} \xB7 ${kindLabel[entry.kind]} \xB7 ${time}`;
    const json = document.createElement("pre");
    json.textContent = JSON.stringify(
      entry.metadata ? { metadata: entry.metadata, body: entry.payload } : entry.payload,
      null,
      2
    );
    details.append(summary, json);
    view.entries.append(details);
  }
}
function initializeQuickWorkflowLog(view, dependencies) {
  let current = null;
  const refresh = async () => {
    current = await dependencies.load();
    renderQuickWorkflowLog(view, current);
  };
  const copy = async () => {
    if (!current) return;
    await dependencies.copy(JSON.stringify(current, null, 2));
  };
  const clear = async () => {
    await dependencies.clear();
    current = null;
    renderQuickWorkflowLog(view, null);
  };
  const copyClick = () => {
    void copy();
  };
  const clearClick = () => {
    void clear();
  };
  view.copyButton.addEventListener("click", copyClick);
  view.clearButton.addEventListener("click", clearClick);
  renderQuickWorkflowLog(view, null);
  return {
    refresh,
    copy,
    clear,
    dispose() {
      view.copyButton.removeEventListener("click", copyClick);
      view.clearButton.removeEventListener("click", clearClick);
    }
  };
}

// src/sidebar/log-directory-settings.ts
function renderLogDirectoryStatus(view, status2) {
  view.pathInput.value = status2.configuredPath;
  view.chooseButton.textContent = "Autorizza cartella log";
  if (!status2.configuredPath) {
    view.state.textContent = "CONFIG MANCANTE \xB7 inserisci il percorso completo della cartella log.";
    return;
  }
  if (!status2.configured || !status2.name || status2.permission === "prompt" || status2.permission === "denied" || status2.permission === "missing") {
    view.state.textContent = `CHROMIUM NON AUTORIZZATO \xB7 config: ${status2.configuredPath}.`;
    return;
  }
  if (!status2.authorizedPath) {
    view.state.textContent = `NON ALLINEATI \xB7 config: ${status2.configuredPath} \xB7 Chromium: percorso completo non verificato.`;
    return;
  }
  if (status2.configuredPath !== status2.authorizedPath) {
    view.state.textContent = `NON ALLINEATI \xB7 config: ${status2.configuredPath} \xB7 Chromium: ${status2.authorizedPath}.`;
    return;
  }
  view.chooseButton.textContent = "Riautorizza cartella log";
  view.state.textContent = `CONFIG E CHROMIUM ALLINEATI \xB7 ${status2.configuredPath}.`;
}
function initializeLogDirectorySettings(view, dependencies) {
  const refresh = async () => {
    renderLogDirectoryStatus(view, await dependencies.loadStatus());
  };
  const choose = () => {
    const path = view.pathInput.value.trim();
    if (!path) {
      view.state.textContent = "CONFIG MANCANTE \xB7 inserisci il percorso completo della cartella log.";
      return;
    }
    view.state.textContent = "Seleziona direttamente la cartella log nella nuova scheda JSpider.";
    void dependencies.openPicker(path);
  };
  view.chooseButton.addEventListener("click", choose);
  return {
    refresh,
    dispose() {
      view.chooseButton.removeEventListener("click", choose);
    }
  };
}

// src/sidebar/webui-version.ts
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function checkTaskFlowWebUiVersion(embedded, fetcher = fetch) {
  const response = await fetcher(embedded.source, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const liveSha256 = await sha256Hex(await response.arrayBuffer());
  return {
    state: liveSha256 === embedded.sha256 ? "current" : "update-available",
    liveSha256,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified")
  };
}
function initializeWebUiVersionCheck(view, dependencies) {
  let disposed = false;
  const refresh = async () => {
    view.button.disabled = true;
    view.state.classList.remove("error-text");
    view.state.textContent = "Controllo versione WebUI in corso\u2026";
    try {
      const embedded = await dependencies.loadEmbedded();
      const result = await (dependencies.check ?? checkTaskFlowWebUiVersion)(embedded);
      if (disposed) return;
      const shortHash = result.liveSha256.slice(0, 12);
      view.state.textContent = result.state === "current" ? `WebUI TaskFlow aggiornata \xB7 ${shortHash}` : `Aggiornamento disponibile \xB7 esegui Aggiorna-WebUI.cmd su Windows oppure Aggiorna-WebUI.command su macOS dalla root JSpider.`;
    } catch (reason) {
      if (disposed) return;
      const message = reason instanceof Error ? reason.message : "errore sconosciuto";
      view.state.textContent = `Versione WebUI non verificabile: ${message}`;
      view.state.classList.add("error-text");
    } finally {
      if (!disposed) view.button.disabled = false;
    }
  };
  const click = () => {
    void refresh();
  };
  view.button.addEventListener("click", click);
  return {
    refresh,
    dispose() {
      disposed = true;
      view.button.removeEventListener("click", click);
    }
  };
}

// src/sidebar/follow-season.ts
function hostLabel(hosts) {
  return hosts.map((host) => host === "filestore.me" ? "Filestore" : "Terabytez").join(" + ");
}
function sameHosts(left, right) {
  return [...left].sort().join("|") === [...right].sort().join("|");
}
function historicalHostsToAdopt(result, currentHosts, allowAdoption) {
  if (!allowAdoption || result.matchedFiles !== 0 || !result.historicalHosts || sameHosts(result.historicalHosts, currentHosts)) return null;
  return [...result.historicalHosts];
}
function describeFollowSeasonState(input2) {
  if (!input2.enabled) return { text: "Disattivato.", blocking: false, tone: "idle" };
  if (!input2.availability.available) {
    return { text: input2.availability.reason, blocking: true, tone: "error" };
  }
  if (input2.preparation.pending) {
    return { text: "Confronto con lo storico Segui\u2026", blocking: true, tone: "active" };
  }
  if (input2.preparation.error) {
    return { text: input2.preparation.error, blocking: true, tone: "error" };
  }
  const result = input2.preparation.result;
  if (!result) {
    return { text: "Storico Segui da verificare.", blocking: true, tone: "idle" };
  }
  if (!result.newCount) {
    return {
      text: "Nessun nuovo link da elaborare per questa stagione e questo host.",
      blocking: true,
      tone: "active"
    };
  }
  const summary = `Segui S${input2.availability.season} attivo su ${hostLabel(input2.hosts)} \xB7 ${result.processedCount} link gi\xE0 elaborati \xB7 ${result.newCount} nuovi.`;
  const changedHost = result.matchedFiles === 0 && result.historicalHosts && !sameHosts(result.historicalHosts, input2.hosts);
  return {
    text: changedHost ? `${summary} Host diverso dallo storico: viene usata una catena host separata.` : summary,
    blocking: false,
    tone: "active"
  };
}
function resolveFollowSeasonAvailability(input2) {
  if (input2.metadata?.mode !== "validated" || input2.metadata.mediaKind !== "tv") {
    return { available: false, reason: "Valida una serie con ID TMDB per usare Segui stagione." };
  }
  const seasons = [...new Set(input2.variants.map((variant) => variant.season))];
  if (!input2.variants.length || seasons.length !== 1 || !Number.isSafeInteger(seasons[0])) {
    return { available: false, reason: "Segui stagione richiede versioni di una sola stagione." };
  }
  if (!input2.hosts.length) {
    return { available: false, reason: "Seleziona almeno un host per usare Segui stagione." };
  }
  if (input2.createMode !== "quick") {
    return { available: false, reason: "Segui stagione \xE8 disponibile soltanto con Quick Workflow." };
  }
  if (!input2.autodownload) {
    return { available: false, reason: "Segui stagione richiede Autodownload attivo." };
  }
  if (!input2.logStatus.configured || !input2.logStatus.name || !["granted", "unknown"].includes(input2.logStatus.permission)) {
    return { available: false, reason: "Configura e autorizza la cartella log per usare Segui stagione." };
  }
  return { available: true, season: seasons[0] };
}
var FollowSeasonPreparationController = class {
  revision = 0;
  current = { pending: false, result: null, error: null };
  state() {
    return this.current;
  }
  invalidate() {
    this.revision += 1;
    this.current = { pending: false, result: null, error: null };
  }
  async prepare(load) {
    const revision = ++this.revision;
    this.current = { pending: true, result: null, error: null };
    try {
      const result = await load();
      if (revision !== this.revision) return null;
      this.current = { pending: false, result, error: null };
      return result;
    } catch (reason) {
      if (revision !== this.revision) return null;
      const message = reason instanceof Error ? reason.message : "Preparazione Segui non riuscita.";
      this.current = { pending: false, result: null, error: message };
      throw reason;
    }
  }
};

// src/sidebar/index.ts
var element = (id) => document.getElementById(id);
var input = (id) => element(id);
var select = (id) => element(id);
var snapshot = null;
var selectedKeys = [];
var explicitlyAdjusted = false;
var candidates = [];
var candidateRatings = /* @__PURE__ */ new Map();
var metadata = null;
var catalog = null;
var settings = null;
var createMode = initialCreateModeState();
var manualPassword = null;
var logDirectoryStatus = {
  configured: false,
  name: null,
  permission: "missing"
};
var followDependencySignature = "";
var followRefreshScheduled = false;
var adoptHistoricalHostsOnNextPreparation = false;
var tmdbResultGate = new LatestResultGate();
var embyResultGate = new LatestResultGate();
var ratingsResultGate = new LatestResultGate();
var followPreparation = new FollowSeasonPreparationController();
var bitrateLimitState = createBitrateLimitState({
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items)
});
var embyPanel = new EmbyPanelController(
  element("emby-status"),
  (seriesId, seasonId) => background("emby.season", { seriesId, seasonId })
);
embyPanel.setStatus({ state: "idle" });
initializeTooltips(document);
initializeDismissiblePopover(
  element("settings-button"),
  element("settings-panel"),
  document
);
initializeWebUiVersionCheck({
  button: element("webui-version-check"),
  state: element("webui-version-state")
}, {
  async loadEmbedded() {
    const response = await fetch(chrome.runtime.getURL("taskflow-ui-version.json"), {
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`metadati incorporati HTTP ${response.status}`);
    return response.json();
  }
});
var quickLogButton = element("quick-log-button");
var logDirectorySettings = initializeLogDirectorySettings({
  pathInput: input("log-directory-config"),
  state: element("log-directory-state"),
  chooseButton: element("log-directory-choose")
}, {
  async loadStatus() {
    const [directory, summary, stored] = await Promise.all([
      background("taskflow.logDirectory.status").catch(() => ({ configured: false, name: null, permission: "missing" })),
      background("settings.get"),
      chrome.storage.local.get("jspider.logDirectoryPath")
    ]);
    logDirectoryStatus = directory;
    return {
      ...directory,
      configuredPath: summary.logDirectoryConfig,
      authorizedPath: typeof stored["jspider.logDirectoryPath"] === "string" ? stored["jspider.logDirectoryPath"] : null
    };
  },
  async openPicker(path) {
    await chrome.storage.local.set({ "jspider.logDirectoryDraft": path });
    await chrome.tabs.create({ url: chrome.runtime.getURL("log-directory.html") });
  }
});
initializeDismissiblePopover(
  quickLogButton,
  element("quick-log-panel"),
  document
);
var quickLog = initializeQuickWorkflowLog({
  state: element("quick-log-state"),
  entries: element("quick-log-entries"),
  copyButton: element("quick-log-copy"),
  clearButton: element("quick-log-clear")
}, {
  load: () => background("taskflow.quickWorkflowLog.get"),
  async clear() {
    await background("taskflow.quickWorkflowLog.clear");
  },
  async copy(value) {
    if (!copyText(value)) window.prompt("Copia il log JSON Quick Workflow", value);
  }
});
var refreshQuickLog = () => void quickLog.refresh().catch((reason) => {
  element("quick-log-state").textContent = reason instanceof Error ? reason.message : "Log Quick Workflow non disponibile.";
});
quickLogButton.addEventListener("click", refreshQuickLog);
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes["jspider.quickWorkflowLog"]) refreshQuickLog();
  if (areaName === "local" && (changes["jspider.logDirectoryName"] || changes["jspider.logDirectoryPath"] || changes["jspider.logDirectoryRevision"])) {
    void logDirectorySettings.refresh().then(renderCreateState);
  }
});
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
    omdbApiKey: input("omdb-api-key"),
    mdblistApiKey: input("mdblist-api-key")
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
function followAvailability() {
  return resolveFollowSeasonAvailability({
    metadata,
    variants: selectedVariants(),
    hosts: selectedHosts(),
    createMode: createMode.selected,
    autodownload: input("autodownload").checked,
    logStatus: logDirectoryStatus
  });
}
function followContext(availability = followAvailability()) {
  const validatedMetadata = metadata;
  if (!availability.available || validatedMetadata?.mode !== "validated") {
    throw new Error(availability.available ? "Dati Segui stagione non validi." : availability.reason);
  }
  const validatedTitle = candidates.find((candidate) => candidate.id === validatedMetadata.id)?.title ?? input("title").value.trim();
  return {
    mediaKind: "tv",
    tmdbId: validatedMetadata.id,
    season: availability.season,
    hosts: selectedHosts(),
    title: validatedTitle
  };
}
function currentFollowSignature() {
  return JSON.stringify({
    metadata,
    variants: selectedVariants().map((variant) => ({
      key: variant.key,
      season: variant.season,
      links: variant.links
    })),
    hosts: selectedHosts(),
    createMode: createMode.selected,
    autodownload: input("autodownload").checked,
    logDirectoryStatus,
    title: input("title").value
  });
}
function syncFollowDependencies() {
  const signature = currentFollowSignature();
  if (signature === followDependencySignature) return;
  followDependencySignature = signature;
  followPreparation.invalidate();
  if (!input("follow-season").checked || !followAvailability().available || followRefreshScheduled) return;
  followRefreshScheduled = true;
  queueMicrotask(() => {
    followRefreshScheduled = false;
    void refreshFollowPreparation().catch(() => void 0);
  });
}
function renderFollowSeasonState() {
  const checkbox = input("follow-season");
  const availability = followAvailability();
  checkbox.disabled = createMode.locked || !availability.available && !checkbox.checked;
  const presentation = describeFollowSeasonState({
    enabled: checkbox.checked,
    availability,
    preparation: followPreparation.state(),
    hosts: selectedHosts()
  });
  const container = checkbox.closest(".follow-season-control");
  container?.classList.toggle("active", checkbox.checked && presentation.tone === "active");
  container?.classList.toggle("error", checkbox.checked && presentation.tone === "error");
  element("follow-season-state").textContent = !checkbox.checked && !availability.available ? availability.reason : presentation.text;
  return { blocking: checkbox.checked && presentation.blocking };
}
async function refreshFollowPreparation() {
  const availability = followAvailability();
  if (!availability.available) {
    followPreparation.invalidate();
    renderCreateState();
    return null;
  }
  const follow = followContext(availability);
  const pending = followPreparation.prepare(() => background(
    "taskflow.followSeason.prepare",
    { follow, variants: selectedVariants() }
  ));
  renderCreateState();
  try {
    const result = await pending;
    if (!result) return null;
    const historicalHosts = historicalHostsToAdopt(
      result,
      selectedHosts(),
      adoptHistoricalHostsOnNextPreparation
    );
    adoptHistoricalHostsOnNextPreparation = false;
    if (historicalHosts) {
      input("filestore").checked = historicalHosts.includes("filestore.me");
      input("terabytez").checked = historicalHosts.includes("terabytez.org");
      renderCreateState();
      return null;
    }
    return result;
  } finally {
    renderCreateState();
  }
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
  const thanksPresentation = resolveThanksPresentation(snapshot?.thanksMode);
  const selectionThanksButton = element("thank-selected");
  selectionThanksButton.textContent = thanksPresentation.selectionLabel;
  const selectionThanksContainer = selectionThanksButton.closest(".button-info");
  if (selectionThanksContainer) selectionThanksContainer.hidden = !thanksPresentation.showSelection;
  if (thanksPresentation.showUnlock) {
    selectedKeys = [];
    explicitlyAdjusted = false;
    const unlockButton = renderUnlockPrompt(document, container, () => {
      unlockButton.disabled = true;
      void unlockVersionContainer().catch((reason) => {
        status(reason instanceof Error ? reason.message : "Ringraziamento non riuscito.", true);
        if (unlockButton.isConnected) unlockButton.disabled = false;
      });
    });
    element("recommendation-notes").textContent = "";
    selectionThanksButton.disabled = true;
    element("filestore-count").textContent = "";
    element("terabytez-count").textContent = "";
    syncPasswordField();
    renderCreateState();
    return;
  }
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
    const technical = renderTechnicalSummary(document, variant.technical);
    const ambiguity = renderResolutionAmbiguity(document, variant.packageName, variant.technical);
    const reason = document.createElement("p");
    reason.className = "version-reason small";
    reason.textContent = proposal.reasons[variant.key] ?? "Scelta manuale.";
    if (variant.locked) reason.textContent += " Ringrazia l\u2019articolo per sbloccare i link.";
    if (variant.linkError) reason.textContent += ` ${variant.linkError}`;
    card.append(label, technical);
    if (ambiguity) card.append(ambiguity);
    card.append(reason);
    container.append(card);
  }
  element("recommendation-notes").textContent = proposal.notes.join(" ");
  selectionThanksButton.disabled = !snapshot?.supportsThanks || !selectedKeys.length;
  const links = selectedVariants().flatMap((variant) => variant.links);
  element("filestore-count").textContent = `\xB7 ${links.filter((link) => new URL(link).hostname === "filestore.me").length}`;
  element("terabytez-count").textContent = `\xB7 ${links.filter((link) => new URL(link).hostname === "terabytez.org").length}`;
  syncPasswordField();
  renderCreateState();
}
async function unlockVersionContainer() {
  const placeholder = snapshot?.variants.find((variant) => variant.locked);
  if (!placeholder) throw new Error("Contenitore delle versioni non disponibile. Aggiorna la pagina.");
  status("Ringraziamento e caricamento delle versioni\u2026");
  const result = await page("thank", { variantKeys: [placeholder.key] });
  if (result.thanks.failed.length) {
    throw new Error(result.thanks.failed.map((failure) => failure.error).join("; "));
  }
  snapshot = result.context;
  selectedKeys = [];
  explicitlyAdjusted = false;
  renderVersions();
  status(`${snapshot.variants.length} versioni caricate e analizzate.`);
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
    },
    candidateRatings
  );
}
async function enrichCandidateRatings(current) {
  const result = await ratingsResultGate.run(() => loadCandidateEnrichments(
    current,
    Boolean(settings?.mdblistConfigured),
    (lookupInput) => background("mdblist.lookup", { input: lookupInput }),
    (lookupInput) => background("justwatch.lookup", { input: lookupInput }),
    Boolean(settings?.omdbConfigured),
    (imdbId) => background("omdb.awards", { imdbId })
  ));
  if (!result) return;
  candidateRatings = result;
  renderCandidates();
}
async function checkEmby(input2) {
  embyResultGate.invalidate();
  if (!settings?.embyConfigured || !settings.embyBaseUrl) {
    embyPanel.setStatus({
      state: "unavailable",
      message: "Emby non configurato in config.local.json."
    });
    return;
  }
  embyPanel.setStatus({ state: "checking" });
  try {
    const result = await embyResultGate.run(async () => {
      const url = new URL(settings.embyBaseUrl);
      const originPattern = `${url.protocol}//${url.hostname}/*`;
      const permission = chrome.permissions.request({ origins: [originPattern] });
      if (!await permission) throw new Error("Permesso di collegamento a Emby non concesso.");
      return background("emby.check", { input: input2 });
    });
    if (result) embyPanel.setStatus(result);
  } catch (reason) {
    embyPanel.setStatus({
      state: "unavailable",
      message: reason instanceof Error ? reason.message : "Controllo Emby non riuscito."
    });
  }
}
function applyTmdbResult(result) {
  ratingsResultGate.invalidate();
  candidates = result.candidates;
  candidateRatings = /* @__PURE__ */ new Map();
  metadata = null;
  renderCandidates();
  renderCreateState();
  element("search-status").textContent = candidates.length ? result.method === "imdb" ? "Corrispondenza tramite IMDb trovata \xB7 conferma manualmente il titolo." : `${candidates.length} candidati trovati \xB7 valida manualmente.` : "Nessun candidato trovato. Modifica titolo o anno e ripeti la ricerca.";
  void enrichCandidateRatings(candidates).catch(() => void 0);
}
function clearTmdbSelection() {
  embyResultGate.invalidate();
  ratingsResultGate.invalidate();
  metadata = null;
  candidates = [];
  candidateRatings = /* @__PURE__ */ new Map();
  clearTmdbView({
    results: element("results"),
    validation: element("validation-state")
  });
  embyPanel.setStatus({ state: "idle" });
  renderCreateState();
}
function renderCatalog() {
  const preset = select("workflow-preset");
  const previous = preset.value;
  preset.replaceChildren(new Option("Seleziona un preset TaskFlow", ""));
  for (const item of catalog?.presets ?? []) preset.append(new Option(`${item.name} (${item.code})`, item.code));
  preset.value = resolvePresetSelection(previous, catalog?.presets ?? []);
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
  syncFollowDependencies();
  const followState = renderFollowSeasonState();
  select("workflow-preset").disabled = createMode.locked || !autodownload;
  input("cleanup").disabled = createMode.locked || !autodownload;
  input("quick-workflow").disabled = createMode.locked || !snapshot || !validity.phase3 || followState.blocking;
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
  input("log-directory-config").value = settings.logDirectoryConfig;
  element("settings-state").textContent = `TaskFlow: ${settings.taskflowConfigured ? "configurato" : "token mancante"} \xB7 TMDB: ${settings.tmdbConfigured ? "configurato" : "token mancante"} \xB7 OMDb: ${settings.omdbConfigured ? "configurato" : "API key mancante"} \xB7 MDBList: ${settings.mdblistConfigured ? "configurato" : "API key mancante"} \xB7 Emby: ${settings.embyConfigured ? "configurato" : "config locale mancante"}.`;
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
  void bitrateLimitState.save(input("limit").value).catch((reason) => {
    console.warn("JSpider: limite bitrate non salvato.", reason);
  });
});
for (const id of ["filestore", "terabytez"]) input(id).addEventListener("input", () => {
  adoptHistoricalHostsOnNextPreparation = false;
  renderCreateState();
});
input("workflow-name").addEventListener("input", renderCreateState);
input("autodownload").addEventListener("change", renderCreateState);
input("follow-season").addEventListener("change", () => {
  adoptHistoricalHostsOnNextPreparation = input("follow-season").checked;
  followPreparation.invalidate();
  renderCreateState();
  if (input("follow-season").checked && followAvailability().available) {
    void refreshFollowPreparation().catch(() => void 0);
  }
});
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
    if (!shouldSubmitSelectionThanks(snapshot?.thanksMode)) {
      const validationError = validateUnlockedSelection(selectedVariants());
      if (validationError) throw new Error(validationError);
      status(`${selectedKeys.length} versioni selezionate confermate.`);
      return;
    }
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
    let variants = selectedVariants();
    const hosts = selectedHosts();
    let follow;
    if (input("follow-season").checked) {
      followPreparation.invalidate();
      const prepared = await refreshFollowPreparation();
      if (!prepared) throw new Error("Lo storico Segui \xE8 cambiato: riprova Quick Workflow.");
      if (!prepared.newCount || !prepared.variants.length) {
        throw new Error("Nessun nuovo link da elaborare per questa stagione e questo host.");
      }
      variants = prepared.variants;
      follow = followContext();
    }
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
      ...follow ? { follow } : {},
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
  input("limit").value = await bitrateLimitState.load().catch(() => "");
  await runSidebarStartup({
    loadSettings: loadSettingsSummary,
    initializeOverlayWidth,
    loadCatalog,
    refreshOptionalStatus: async () => {
      await logDirectorySettings.refresh();
      renderCreateState();
    },
    readSnapshot
  });
})().catch((reason) => status(reason instanceof Error ? reason.message : "Avvio JSpider non riuscito.", true));
