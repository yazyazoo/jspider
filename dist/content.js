"use strict";
(() => {
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

  // src/domain/technical.ts
  var RESOLUTION_PROFILES = [
    { maxWidth: 640, maxHeight: 360, resolution: 360 },
    { maxWidth: 864, maxHeight: 480, resolution: 480 },
    { maxWidth: 776, maxHeight: 592, resolution: 576 },
    { maxWidth: 960, maxHeight: 544, resolution: 540 },
    { maxWidth: 1024, maxHeight: 576, resolution: 576 },
    { maxWidth: 1332, maxHeight: 720, resolution: 720 },
    { maxWidth: 1998, maxHeight: 1080, resolution: 1080 },
    { maxWidth: 2664, maxHeight: 1440, resolution: 1440 },
    { maxWidth: 4096, maxHeight: 2160, resolution: 2160 }
  ];
  function resolutionFromDimensions(width, height) {
    if (width === null || height === null || width <= 0 || height <= 0) return null;
    return RESOLUTION_PROFILES.find(
      (profile) => width <= profile.maxWidth && height <= profile.maxHeight
    )?.resolution ?? null;
  }
  function parseQuantity(text, type) {
    const match = String(text ?? "").match(
      /([\d][\d\s.,]*)\s*(kb\/s|Mb\/s|Gb\/s|b\/s|kbps|Mbps|Gbps|bps|GiB|MiB|GB|MB)\b/i
    );
    if (!match?.[1] || !match[2]) return null;
    const unit = match[2].toLowerCase().replace(/^(k|m|g)?bps$/, (_all, prefix) => `${prefix || ""}b/s`);
    let digits = match[1].replace(/\s/g, "");
    if (digits.includes(",")) digits = digits.replace(/\./g, "").replace(",", ".");
    else if (type === "bitrate" && ["kb/s", "b/s"].includes(unit) && /^\d{1,3}(?:\.\d{3})+$/.test(digits)) digits = digits.replace(/\./g, "");
    const value = Number(digits);
    const units = type === "bytes" ? { gib: 1024 ** 3, mib: 1024 ** 2, gb: 1e9, mb: 1e6 } : { "b/s": 1, "kb/s": 1e3, "mb/s": 1e6, "gb/s": 1e9 };
    const multiplier = units[unit];
    return value > 0 && multiplier ? value * multiplier : null;
  }
  function parseDuration(text) {
    let total = 0;
    const pattern = /(\d+(?:[.,]\d+)?)\s*(hours?|ore|ora|h|o|minut[oi]|minutes?|min|m|second[oi]|seconds?|sec|s)(?=\s|\d|$)/gi;
    for (const match of String(text ?? "").matchAll(pattern)) {
      const amount = Number(match[1]?.replace(",", "."));
      const unit = match[2]?.toLowerCase() ?? "";
      total += amount * (/^(?:h|o)/.test(unit) ? 3600 : /^m/.test(unit) ? 60 : 1);
    }
    return total || null;
  }
  function classifySource(label) {
    if (/\b(?:untouched|remux|bdremux)\b/i.test(label)) return "untouched";
    if (/\bweb[ .-]?dl\b/i.test(label)) return "source";
    if (/\b(?:re-?encode|encode|codifica|web-?rip|bd-?rip|br-?rip|x264|x265)\b/i.test(label)) return "encode";
    return "unknown";
  }
  function parseTechnicalReport(report, label = "", summary = "") {
    const sections = { general: {}, video: {} };
    let section = "general";
    const aliases = {
      formato: "format",
      "dimensione file": "file size",
      durata: "duration",
      "bitrate totale": "overall bit rate",
      bitrate: "bit rate",
      "bitrate nominale": "nominal bit rate",
      larghezza: "width",
      altezza: "height",
      "profondit\xE0 bit": "bit depth",
      "dimensione traccia": "stream size",
      "frequenza fotogrammi": "frame rate",
      "formato hdr": "hdr format"
    };
    for (const line of String(report ?? "").split(/\r?\n/)) {
      const heading = line.trim();
      if (/^Video(?: #\d+)?$/i.test(heading)) {
        section = "video";
        continue;
      }
      if (/^(?:General|Generale)$/i.test(heading)) {
        section = "general";
        continue;
      }
      if (/^(?:Audio|Text|Testo|Menu|Image|Immagine|Other|Altro)(?: #\d+)?$/i.test(heading)) {
        section = "other";
        continue;
      }
      const pair = line.match(/^\s*([^:]+?)\s*:\s*(.+)$/);
      if (pair?.[1] && pair[2] && section !== "other") {
        const key = pair[1].trim().toLowerCase();
        sections[section][aliases[key] ?? key] = pair[2].trim();
      }
    }
    const general = sections.general;
    const video = sections.video;
    const hint = `${video.format ?? ""} ${label} ${summary}`;
    const codec = /\b(?:HEVC|H[. ]?265|x265)\b/i.test(hint) ? "HEVC" : /\b(?:AVC|H[. ]?264|x264)\b/i.test(hint) ? "H264" : /\bAV1\b/i.test(hint) ? "AV1" : "";
    const depth = String(video["bit depth"] ?? summary).match(/\b(8|10|12)\s*bits?\b/i);
    const width = Number((video.width ?? "").replace(/\D/g, "")) || null;
    const height = Number((video.height ?? "").replace(/\D/g, "")) || null;
    const namedResolution = Number(label.match(/\b(2160|1080|720|576|480)p\b/i)?.[1]);
    const resolution = resolutionFromDimensions(width, height) ?? namedResolution ?? (/\b4K\b/i.test(label) ? 2160 : null);
    const videoBytes = parseQuantity(video["stream size"], "bytes");
    const duration = parseDuration(video.duration ?? general.duration);
    const explicitVideoBitrate = parseQuantity(video["bit rate"] ?? video["nominal bit rate"], "bitrate") ?? parseQuantity(summary, "bitrate");
    const videoBitrate = explicitVideoBitrate ?? (videoBytes !== null && duration !== null ? videoBytes * 8 / duration : null);
    const totalBytes = parseQuantity(general["file size"], "bytes");
    const overallBitrate = parseQuantity(general["overall bit rate"], "bitrate") ?? (totalBytes !== null && duration !== null ? totalBytes * 8 / duration : null);
    const hdrHint = [video["hdr format"], label, summary].filter(Boolean).join(" ");
    const hdr = [
      /Dolby Vision|\bDV\b/i.test(hdrHint) ? "DV" : "",
      /HDR10\+|HDR10 Plus/i.test(hdrHint) ? "HDR10+" : "",
      /\bHDR10\b/i.test(hdrHint) ? "HDR10" : "",
      /\bHLG\b/i.test(hdrHint) ? "HLG" : ""
    ].filter(Boolean).join(" / ") || (/\bHDR\b/i.test(hdrHint) ? "HDR" : /\bSDR\b/i.test(hdrHint) ? "SDR" : "");
    const sourceFamily = /blu[ .-]?ray|bdremux|bdrip|br-?rip/i.test(label) ? "bluray" : /\bweb[ .-]?(?:dl|rip)\b/i.test(label) ? "web" : "";
    const provider = /\b(?:AMZN|Amazon)\b/i.test(label) ? "amazon" : /\b(?:Netflix|NF)\b/i.test(label) ? "netflix" : /\b(?:iTunes|iT[ .-]WEB)\b/i.test(label) ? "itunes" : /\b(?:Movies Anywhere|MA[ .-]WEB)\b/i.test(label) ? "movies-anywhere" : /\b(?:DSNP|Disney)\b/i.test(label) ? "disney" : /\b(?:ATVP|Apple TV)\b/i.test(label) ? "apple" : "";
    const fpsMatch = video["frame rate"]?.match(/\d+(?:[.,]\d+)?/);
    return {
      codec,
      bitDepth: depth?.[1] ? Number(depth[1]) : null,
      resolution,
      width,
      height,
      videoBitrate,
      overallBitrate,
      videoBytes,
      totalBytes,
      duration,
      fps: fpsMatch?.[0] ? Number(fpsMatch[0].replace(",", ".")) : null,
      hdr,
      category: classifySource(label),
      sourceFamily,
      provider,
      bitrateEstimated: explicitVideoBitrate === null && videoBitrate !== null
    };
  }

  // src/sites/lfi-technical.ts
  function domText(node) {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? "";
    const element = node;
    if (/^(?:SCRIPT|STYLE|NOSCRIPT)$/.test(element.nodeName)) return "";
    if (element.nodeName === "BR") return "\n";
    const value = [...node.childNodes].map(domText).join("");
    return /^(?:DIV|P|PRE|LI|TR|SECTION|ARTICLE|H[1-6])$/.test(element.nodeName) ? `
${value}
` : value;
  }
  function bytes(value) {
    const match = String(value ?? "").match(/([\d][\d\s.,]*)\s*bytes\b/i);
    return match?.[1] ? Number(match[1].replace(/\D/g, "")) || null : null;
  }
  function seconds(value) {
    const text = String(value ?? "");
    const explicit = text.match(/\(([\d.,]+)\s*s\)/i);
    const clock = text.match(/\b(\d{1,3}):(\d{2}):(\d{2}(?:[.,]\d+)?)\b/);
    if (explicit?.[1]) return Number(explicit[1].replace(",", ".")) || null;
    return clock?.[1] && clock[2] && clock[3] ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3].replace(",", ".")) : null;
  }
  function parseLfiTechnical(report, label) {
    const hint = /\bVU\b/i.test(label) ? `${label} untouched` : label;
    const base = parseTechnicalReport(report, hint);
    if (!/\[\s*(?:Info sul file|About file|Traccia video|Video track)\s*\]/i.test(report)) {
      return base;
    }
    const sections = {
      general: {},
      video: {},
      relevant: {}
    };
    let current = "general";
    for (const line of report.split(/\r?\n/)) {
      const header = line.match(/^\s*\[\s*(.*?)\s*\]\s*$/);
      if (header?.[1]) {
        current = /^(?:Info sul file|About file|Info generiche|Generic infos)$/i.test(header[1]) ? "general" : /^(?:Traccia video|Video track)$/i.test(header[1]) ? "video" : /^(?:Dati rilevanti|Relevant data)$/i.test(header[1]) ? "relevant" : "other";
        continue;
      }
      const pair = line.match(/^\s*([^:]+?)\s*:\s*(.+)$/);
      if (pair?.[1] && pair[2] && current !== "other") sections[current][pair[1].trim().toLowerCase()] = pair[2].trim();
    }
    const general = sections.general;
    const video = sections.video;
    const relevant = sections.relevant;
    const duration = seconds(general.durata ?? general.duration) ?? seconds(video.durata ?? video["duration (bs)"]);
    const videoBytes = bytes(video["dimensione stream"] ?? video["stream size"]);
    const totalBytes = bytes(general.dimensione ?? general.size);
    const explicitVideoBitrate = parseQuantity(video["bitrate (bs)"] ?? video.bitrate, "bitrate");
    const resolutionText = String(video.risoluzione ?? video.resolution ?? relevant.risoluzione ?? relevant.resolution ?? "");
    const resolutionMatch = resolutionText.match(/(\d+)\s*x\s*(\d+)/i);
    const width = resolutionMatch?.[1] ? Number(resolutionMatch[1]) : null;
    const height = resolutionMatch?.[2] ? Number(resolutionMatch[2]) : null;
    const codec = parseTechnicalReport("", String(video["codec id"] ?? "")).codec || base.codec;
    const fpsMatch = String(video.framerate ?? "").match(/\d+(?:[.,]\d+)?/);
    return {
      ...base,
      codec,
      width,
      height,
      resolution: resolutionFromDimensions(width, height) ?? base.resolution,
      duration,
      totalBytes,
      videoBytes,
      videoBitrate: explicitVideoBitrate ?? (videoBytes !== null && duration !== null ? videoBytes * 8 / duration : null),
      bitrateEstimated: explicitVideoBitrate === null && videoBytes !== null && duration !== null,
      overallBitrate: totalBytes !== null && duration !== null ? totalBytes * 8 / duration : null,
      fps: fpsMatch?.[0] ? Number(fpsMatch[0].replace(",", ".")) : null
    };
  }

  // src/sites/lficrypt.ts
  function normalizeLfiCryptUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !["lficrypt.org", "www.lficrypt.org"].includes(url.hostname) || url.port || url.username || url.password || !/^\/[a-z0-9]{6,32}\.html$/i.test(url.pathname) || url.search) return null;
      return `https://lficrypt.org${url.pathname}`;
    } catch {
      return null;
    }
  }
  async function resolveLfiCrypt(value, request) {
    const collectorUrl = normalizeLfiCryptUrl(value);
    if (!collectorUrl) throw new Error("Raccoglitore LFiCrypt non valido.");
    const raw = await request(collectorUrl);
    if (raw === null || typeof raw !== "object" || Array.isArray(raw) || raw.ok !== true || !Array.isArray(raw.links) || raw.links.length > 1e4) {
      throw new Error("LFiCrypt non ha restituito una lista di link valida.");
    }
    const links = [...new Set(raw.links.map(normalizeArchiveUrl).filter((link) => link !== null))];
    if (!links.length) throw new Error("Nessun link Filestore o Terabytez disponibile nel raccoglitore LFiCrypt.");
    return links;
  }

  // src/sites/laforestaincantata.ts
  var ORIGIN = "https://laforestaincantata.org";
  var states = /* @__PURE__ */ new WeakMap();
  var clean = (value) => String(value ?? "").replace(/[\t \u00a0]+/g, " ").trim();
  var normalized = (value) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  function normalizeUrl(value) {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.hostname !== "laforestaincantata.org" || url.username || url.password || url.port || url.pathname !== "/index.php" || url.searchParams.getAll("newsid").length !== 1 || !/^[1-9]\d*$/.test(url.searchParams.get("newsid") ?? "")) {
      throw new Error("Apri un articolo della Foresta Incantata.");
    }
    return `${ORIGIN}/index.php?newsid=${url.searchParams.get("newsid")}`;
  }
  function identity(raw, body = "") {
    const year = raw.match(/\((19\d{2}|20\d{2})/)?.[1] ?? "";
    const seasonText = raw.match(/stagion[ei]\s+(\d+(?:\s*[-–,/]\s*\d+)*)/i)?.[1];
    let seasons = seasonText ? [...new Set((seasonText.match(/\d+/g) ?? []).map(Number))] : [];
    if (seasonText && seasons.length === 2 && /[-–]/.test(seasonText) && seasons[1] > seasons[0] && seasons[1] - seasons[0] < 100) {
      seasons = Array.from({ length: seasons[1] - seasons[0] + 1 }, (_, index) => seasons[0] + index);
    }
    const episodic = /\b(?:S\d{1,2}E?\d*|serie\s*tv|stagion[ei])\b/i.test(raw);
    const title = clean(raw.split(/\s*[-–—:]?\s*stagion[ei]\b|\s*\((?:19|20)\d{2}/i)[0]).replace(/\s*[-–—:]\s*$/, "");
    const aliases = [title];
    for (const line of body.split("\n")) {
      const match = line.match(/^\s*Titolo (?:originale|italiano)\s*:\s*(.+)$/i);
      if (match?.[1]) aliases.push(clean(match[1]));
    }
    const mediaKind = episodic ? "tv" : /\b(?:web[ .-]?dl|blu[ .-]?ray|b[dr]rip|untouched|1080p|2160p|720p|4k|full\s*hd)\b/i.test(raw) ? "movie" : "";
    return { title, year, seasons, aliases: aliases.map(normalized).filter(Boolean), mediaKind };
  }
  function sameTitle(left, right) {
    return Boolean(left.title && right.title && left.mediaKind && left.mediaKind === right.mediaKind && left.year && left.year === right.year && left.seasons.join(",") === right.seasons.join(",") && left.aliases.some((alias) => right.aliases.includes(alias)));
  }
  function urls(node) {
    const values = [...node.querySelectorAll('a[href],textarea,input[name="urls"],[data-jd-link]')].flatMap((element) => [element.getAttribute("href"), "value" in element ? element.value : null, element.getAttribute("data-jd-link")]).filter((value) => Boolean(value));
    values.push(domText(node));
    return [...new Set(values.flatMap((value) => value.match(/https?:\/\/[^\s<>"']+/gi) ?? []).map((value) => value.replace(/[),.;]+$/, "")))];
  }
  function password(node) {
    const explicit = [...node.querySelectorAll('input[name="passwords"],textarea[name="passwords"]')].map((element) => element.value).find(Boolean);
    if (explicit) return clean(explicit);
    const found = domText(node).match(/^\s*(?:password(?:\s+(?:archivio|rar|archivi|estrazione))?|psw)\s*:\s*([^\r\n]+)$/im);
    return found?.[1] ? clean(found[1]) : "";
  }
  function readDocument(document2, value) {
    const sourceUrl = normalizeUrl(value);
    const articleId = new URL(sourceUrl).searchParams.get("newsid") ?? "";
    const story = document2.querySelector("#full-story");
    if (!story) throw new Error("Articolo non leggibile: verifica di essere connesso alla Foresta.");
    const raw = clean(document2.querySelector('meta[property="og:title"]')?.content ?? document2.querySelector("#dle-content .title")?.textContent ?? document2.title.split(" \xBB ")[0]);
    if (!raw) throw new Error("Titolo articolo non disponibile.");
    const info = identity(raw, domText(story));
    const cards = [...story.querySelectorAll("[data-film-version-card]")];
    const articleLocked = Boolean(story.querySelector('#thx [onclick*="tanksForNews"]'));
    const allCodings = /\btutte\s+le\s+codifiche(?:\s+disponibili)?\b/i.test(raw);
    const outsideCards = story.cloneNode(true);
    outsideCards.querySelectorAll("[data-film-version-card]").forEach((element) => element.remove());
    const commonPassword = password(outsideCards);
    const seen = /* @__PURE__ */ new Map();
    const variants = (cards.length ? cards : [story]).map((card) => {
      const label = clean(card.querySelector(".film-version-card-read__badge,.film-version-card-read__title,.film-version-name,.film-version-title,.film-version-card__title")?.textContent ?? card.querySelector("[data-report-panel] .film-version-report__title")?.textContent?.replace(/^Report\s*-\s*/i, "") ?? (cards.length ? domText(card).trim().split("\n").find((line) => clean(line)) : ""));
      const foundUrls = urls(card);
      const directLinks = foundUrls.map(normalizeArchiveUrl).filter((link) => link !== null);
      const collectors = foundUrls.map(normalizeLfiCryptUrl).filter((link) => link !== null);
      const unsupportedCollectors = foundUrls.filter((url) => {
        try {
          return /(?:^|\.)filecrypt\.(?:cc|co|to)$/i.test(new URL(url).hostname);
        } catch {
          return false;
        }
      });
      const slug = cards.length ? normalized(label || "versione").replace(/ /g, "-") : "article";
      const count = (seen.get(slug) ?? 0) + 1;
      seen.set(slug, count);
      const key = `foresta:${articleId}:${slug}${count > 1 ? `-${count}` : ""}`;
      const reportNodes = cards.length ? [...card.querySelectorAll("[data-report-panel]")] : [...card.querySelectorAll(".text_spoiler,pre")];
      const report = reportNodes.map(domText).filter((text) => /\b(?:Video|Traccia video|Video track|Codec ID|Format|Formato)\b/i.test(text)).join("\n");
      const technical = parseLfiTechnical(report, cards.length ? `${label} ${raw}` : raw);
      return {
        key,
        packageName: cards.length ? `${info.title}${info.year ? ` (${info.year})` : ""} \u2014 ${label}` : raw,
        articleUrl: sourceUrl,
        articleId,
        password: password(card) || commonPassword,
        links: [...new Set(directLinks)],
        collectors: [...new Set(collectors)],
        unsupportedCollectors,
        linksLoaded: !articleLocked || cards.length > 0 || directLinks.length > 0 || collectors.length > 0,
        technical,
        ...!cards.length && articleLocked && directLinks.length === 0 && collectors.length === 0 ? { locked: true } : {},
        ...info.seasons.length === 1 ? { season: info.seasons[0], technicalSample: true } : {}
      };
    });
    const imdbId = [...story.querySelectorAll("a[href]")].flatMap((anchor) => {
      try {
        const url = new URL(anchor.href);
        const match = /^(?:www\.)?imdb\.com$/.test(url.hostname) ? url.pathname.match(/^\/title\/(tt\d+)\/?$/) : null;
        return match?.[1] ? [match[1]] : [];
      } catch {
        return [];
      }
    })[0] ?? "";
    return {
      siteId: "laforestaincantata",
      siteName: "La Foresta Incantata",
      sourceUrl,
      title: info.title,
      year: info.year,
      mediaKind: info.mediaKind,
      imdbId,
      supportsThanks: true,
      thanksMode: allCodings ? articleLocked && cards.length === 0 ? "unlock-container" : "validate-selection" : "selection",
      thanksHint: "Il ringraziamento pu\xF2 costare 1 doblone per articolo. Pi\xF9 versioni dello stesso articolo vengono sbloccate insieme.",
      variants,
      warnings: []
    };
  }
  function snapshotIdentity(snapshot) {
    return identity(`${snapshot.title} (${snapshot.year}) ${snapshot.mediaKind === "tv" ? "serie tv" : "WEB-DL"}`);
  }
  function markup(document2) {
    return document2.querySelector("#full-story")?.innerHTML;
  }
  function readPage(document2, value) {
    const live = readDocument(document2, value);
    const state = states.get(document2);
    if (!state || state.sourceUrl !== live.sourceUrl || !sameTitle(state.identity, snapshotIdentity(live))) return live;
    if (state.liveMarkup !== markup(document2)) {
      state.liveMarkup = markup(document2);
      state.pages.set(live.sourceUrl, live);
    }
    const primary = state.pages.get(live.sourceUrl) ?? live;
    return {
      ...primary,
      variants: [...state.pages.values()].flatMap((page) => page.variants),
      warnings: [...state.warnings]
    };
  }
  function client(document2) {
    const fetcher = document2.defaultView?.fetch?.bind(document2.defaultView) ?? globalThis.fetch;
    if (typeof fetcher !== "function") throw new Error("Connessione al sito non disponibile.");
    const request = async (url, init = {}) => {
      if (new URL(url).origin !== ORIGIN) throw new Error("Destinazione non autorizzata.");
      const response = await fetcher(url, {
        method: "GET",
        ...init,
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Sito non disponibile (${response.status}).`);
      return response.text();
    };
    const page = async (url) => {
      const target = normalizeUrl(url);
      const parser = document2.defaultView?.DOMParser ?? globalThis.DOMParser;
      return readDocument(new parser().parseFromString(await request(target), "text/html"), target);
    };
    const resolve = async (context) => {
      for (const variant of context.variants) {
        const links = [...variant.links];
        const errors = [];
        delete variant.linkError;
        for (const collector of variant.collectors ?? []) {
          try {
            links.push(...await resolveLfiCrypt(collector, async (target) => JSON.parse(await request(
              `${ORIGIN}/engine/ajax/lficrypt_links.php?url=${encodeURIComponent(target)}`
            ))));
          } catch (reason) {
            errors.push(reason instanceof Error ? reason.message : "errore sconosciuto");
          }
        }
        variant.links = [...new Set(links)];
        if (errors.length) variant.linkError = `LFiCrypt: ${errors.join(" ")}`;
        if (variant.unsupportedCollectors?.length) {
          variant.linkError = `${variant.linkError ? `${variant.linkError} ` : ""}Filecrypt non \xE8 supportato da JSpider.`;
        }
      }
      return context;
    };
    return { request, page, resolve };
  }
  function related(document2, sourceUrl) {
    const anchors = [...document2.querySelectorAll("#lfi-similar-section a[href],#ajax-articolisimili a[href],#full-story a[href]")];
    return [...new Set(anchors.flatMap((anchor) => {
      try {
        const url = normalizeUrl(new URL(anchor.getAttribute("href") ?? "", sourceUrl).href);
        return url === sourceUrl ? [] : [url];
      } catch {
        return [];
      }
    }))];
  }
  async function loadPage(document2, value) {
    const live = readDocument(document2, value);
    const network = client(document2);
    const primary = await network.resolve(live);
    const state = {
      sourceUrl: primary.sourceUrl,
      identity: snapshotIdentity(primary),
      liveMarkup: markup(document2),
      pages: /* @__PURE__ */ new Map([[primary.sourceUrl, primary]]),
      warnings: []
    };
    const candidates = related(document2, primary.sourceUrl);
    if (candidates.length > 20) state.warnings.push("Mostrati al massimo 20 articoli collegati.");
    const targets = candidates.slice(0, 20);
    const results = new Array(targets.length);
    let next = 0;
    const reader = async () => {
      while (next < targets.length) {
        const index = next++;
        const target = targets[index];
        if (!target) continue;
        try {
          const page = await network.page(target);
          if (sameTitle(state.identity, snapshotIdentity(page))) {
            results[index] = { target, page: await network.resolve(page) };
          } else results[index] = { target };
        } catch (reason) {
          results[index] = {
            target,
            error: `Articolo ${new URL(target).searchParams.get("newsid")} non letto: ${reason instanceof Error ? reason.message : "errore sconosciuto"}`
          };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, targets.length) }, reader));
    for (const result of results) {
      if (result?.page) state.pages.set(result.target, result.page);
      if (result?.error) state.warnings.push(result.error);
    }
    states.set(document2, state);
    return readPage(document2, value);
  }
  async function thankSelected(document2, value, variantKeys) {
    const current = readPage(document2, value);
    const selection = [...new Set(variantKeys)];
    if (!selection.length || selection.some((key) => !current.variants.some((variant) => variant.key === key))) {
      throw new Error("Seleziona versioni disponibili prima di ringraziare.");
    }
    const existing = states.get(document2);
    const state = existing && existing.sourceUrl === current.sourceUrl ? existing : {
      sourceUrl: current.sourceUrl,
      identity: snapshotIdentity(current),
      liveMarkup: markup(document2),
      pages: /* @__PURE__ */ new Map([[current.sourceUrl, current]]),
      warnings: []
    };
    const network = client(document2);
    const thanked = [];
    const already = [];
    const failed = [];
    const replacements = {};
    const groups = /* @__PURE__ */ new Map();
    for (const key of selection) {
      const variant = current.variants.find((item) => item.key === key);
      if (!variant?.articleUrl) throw new Error("Articolo sorgente della versione non disponibile.");
      const group = groups.get(variant.articleUrl) ?? [];
      group.push(key);
      groups.set(variant.articleUrl, group);
    }
    for (const [target, selectedKeys] of groups) {
      try {
        let fresh = await network.page(target);
        if (!sameTitle(snapshotIdentity(current), snapshotIdentity(fresh))) {
          throw new Error("Titolo, anno o stagione dell\u2019articolo sono cambiati. Aggiorna il pannello.");
        }
        const wasLocked = fresh.variants.some((variant) => variant.locked);
        if (wasLocked) {
          if (selectedKeys.some((key) => !current.variants.find((variant) => variant.key === key)?.locked)) {
            throw new Error("L\u2019accesso ai link \xE8 cambiato. Aggiorna il pannello prima di ringraziare.");
          }
          let postError;
          try {
            const newsId = new URL(target).searchParams.get("newsid") ?? "";
            const body = new URLSearchParams({ thanks: "tanksForNews", news_id: newsId }).toString();
            const responseText = await network.request(`${ORIGIN}/engine/ajax/thanks.php`, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
              body
            });
            if (responseText.startsWith("LFI_DOBLONI_ERROR:")) {
              throw new Error(responseText.slice("LFI_DOBLONI_ERROR:".length).trim().slice(0, 300));
            }
          } catch (reason) {
            postError = reason instanceof Error ? reason : new Error("Ringraziamento non riuscito.");
          }
          fresh = await network.page(target);
          if (!sameTitle(snapshotIdentity(current), snapshotIdentity(fresh)) || fresh.variants.some((variant) => variant.locked)) {
            throw postError ?? new Error("Ringraziamento non confermato dal sito.");
          }
        }
        fresh = await network.resolve(fresh);
        state.pages.set(target, fresh);
        for (const key of selectedKeys) {
          (wasLocked ? thanked : already).push(key);
          if (!fresh.variants.some((variant) => variant.key === key)) {
            replacements[key] = fresh.variants.map((variant) => variant.key);
          }
        }
        if (target === current.sourceUrl && wasLocked) {
          const widget = document2.querySelector("#thx");
          if (widget) {
            widget.replaceChildren(document2.createTextNode("Articolo ringraziato \xB7 link aggiornati nel pannello JSpider"));
            state.liveMarkup = markup(document2);
          }
        }
      } catch (reason) {
        const error = reason instanceof Error ? reason.message : "Ringraziamento non riuscito.";
        failed.push(...selectedKeys.map((key) => ({ key, error })));
      }
    }
    states.set(document2, state);
    return { context: readPage(document2, value), thanks: { thanked, already, failed, replacements } };
  }
  var laForestaAdapter = {
    id: "laforestaincantata",
    name: "La Foresta Incantata",
    patterns: [`${ORIGIN}/index.php*`],
    matches(value) {
      try {
        return new URL(value).protocol === "https:" && Boolean(normalizeUrl(value));
      } catch {
        return false;
      }
    },
    normalizeUrl,
    readPage,
    loadPage,
    thankSelected
  };

  // src/sites/titanhd.ts
  function pageUrl(value) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "titanhd.space" || url.port || url.username || url.password || !/^\/catalogo\/\d+\/?$/.test(url.pathname)) {
      throw new Error("Apri una scheda titolo TitanHD.");
    }
    return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
  }
  function flattenStructured(value) {
    if (Array.isArray(value)) return value.flatMap(flattenStructured);
    if (value === null || typeof value !== "object") return [];
    const record = value;
    return [record, ...flattenStructured(record["@graph"])];
  }
  function entries(document2) {
    const releasePanels = [...document2.querySelectorAll("[data-rel-panel]")];
    const qualities = releasePanels.length ? releasePanels : [...document2.querySelectorAll("[data-hl]")];
    const items = [];
    for (const quality of qualities) {
      const seasonPanels = [...quality.querySelectorAll("[data-season-panel]")];
      for (const panel of seasonPanels.length ? seasonPanels : [quality]) {
        const node = panel.matches("[data-hl]") ? panel : panel.querySelector("[data-hl]");
        const releaseKey = panel.getAttribute("data-version-key") ?? node?.getAttribute("data-hl-key") ?? "release";
        const qualityTabId = quality.getAttribute("aria-labelledby");
        const seasonTabId = panel.getAttribute("aria-labelledby");
        const qualityTab = qualityTabId ? document2.getElementById(qualityTabId) : null;
        const seasonTab = panel !== quality && seasonTabId ? document2.getElementById(seasonTabId) : null;
        const seasonText = seasonTab?.textContent ?? panel.querySelector("h3")?.textContent ?? "";
        const season = panel !== quality ? Number(releaseKey.match(/^s(\d+)(?:\||$)/i)?.[1] ?? seasonText.match(/Stagione\s+(\d+)/i)?.[1]) || null : null;
        items.push({
          panel,
          qualityTab,
          seasonTab,
          season,
          releaseKey,
          key: `${releaseKey}:${items.length}`
        });
      }
    }
    return items;
  }
  function videoTile(panel) {
    return [...panel.querySelectorAll(".vm-tile")].find((item) => item.querySelector("strong")?.textContent?.trim() === "Video");
  }
  var refreshedPages = /* @__PURE__ */ new WeakMap();
  function structuredMedia(document2) {
    return [...document2.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
      try {
        return flattenStructured(JSON.parse(script.textContent ?? ""));
      } catch {
        return [];
      }
    }).find((item) => {
      const values = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
      return values.some((value) => value === "Movie" || value === "TVSeries");
    }) ?? {};
  }
  function readDocument2(document2, value) {
    const sourceUrl = pageUrl(value);
    const media = structuredMedia(document2);
    const types = Array.isArray(media["@type"]) ? media["@type"] : [media["@type"]];
    const mediaKind = types.includes("Movie") ? "movie" : types.includes("TVSeries") ? "tv" : "";
    const imdbId = [...document2.querySelectorAll("a[href]")].flatMap((anchor) => {
      try {
        const url = new URL(anchor.getAttribute("href") ?? "", sourceUrl);
        const match = /^(?:www\.)?imdb\.com$/.test(url.hostname) ? url.pathname.match(/^\/title\/(tt\d+)/) : null;
        return match?.[1] ? [match[1]] : [];
      } catch {
        return [];
      }
    })[0] ?? "";
    const title = typeof media.name === "string" ? media.name : document2.querySelector("h1")?.textContent?.trim() ?? "";
    const variants = entries(document2).map((entry) => {
      const { panel, qualityTab, season, key, releaseKey } = entry;
      const node = panel.matches("[data-hl]") ? panel : panel.querySelector("[data-hl]");
      let packageName = node?.getAttribute("data-hl-package") ?? [title, qualityTab?.textContent ?? panel.querySelector("h3")?.textContent].filter(Boolean).join(" \u2014 ").replace(/\s+/g, " ").trim();
      if (season !== null && !new RegExp(`\\b(?:S0*${season}|Stagione\\s*${season})\\b`, "i").test(packageName)) {
        packageName += ` \u2014 Stagione ${season}`;
      }
      const summary = [...videoTile(panel)?.querySelectorAll("span") ?? []].map((item) => item.textContent ?? "").join(" ");
      const label = `${packageName} ${qualityTab?.textContent ?? ""} ${releaseKey.replace(/\|/g, " ")}`;
      const technical = parseTechnicalReport(
        panel.querySelector(".vm-report pre, pre")?.textContent ?? "",
        label,
        summary
      );
      technical.totalBytes ??= parseQuantity(panel.querySelector(".vm-size")?.textContent, "bytes");
      const links = node ? [...node.querySelectorAll("[data-hl-links]")].flatMap((element) => (element.getAttribute("data-hl-links") ?? "").split(/\s+/)).map(normalizeArchiveUrl).filter((link) => link !== null) : [];
      return {
        key,
        packageName,
        password: node?.getAttribute("data-hl-password") ?? "",
        links: [...new Set(links)],
        linksLoaded: node !== null,
        technical,
        ...season !== null ? { season, technicalSample: true } : {},
        ...panel.querySelector('[data-locked="1"]') && !links.length ? { locked: true } : {}
      };
    });
    return {
      siteId: "titanhd",
      siteName: "TitanHD",
      supportsThanks: true,
      sourceUrl,
      title,
      year: String(media.datePublished ?? "").slice(0, 4),
      imdbId,
      mediaKind,
      variants
    };
  }
  function readPage2(document2, value) {
    const current = readDocument2(document2, value);
    const refreshed = refreshedPages.get(document2);
    if (!refreshed || refreshed.sourceUrl !== current.sourceUrl) return current;
    const known = new Map(refreshed.variants.map((variant) => [variant.key, variant]));
    current.variants = current.variants.map((variant) => {
      const replacement = known.get(variant.key);
      return variant.links.length || !replacement?.links.length ? variant : replacement;
    });
    return current;
  }
  async function thankSelected2(document2, value, variantKeys) {
    const sourceUrl = pageUrl(value);
    const knownEntries = new Map(entries(document2).map((entry) => [entry.key, entry]));
    const keys = [...new Set(variantKeys)];
    if (!keys.length || keys.some((key) => !knownEntries.has(key))) {
      throw new Error("Seleziona versioni disponibili prima di ringraziare.");
    }
    const mediaId = document2.querySelector(".rel-picker[data-media-id]")?.getAttribute("data-media-id");
    if (!mediaId || typeof globalThis.fetch !== "function") {
      throw new Error("Dati per il ringraziamento non disponibili. Aggiorna la pagina.");
    }
    const request = async (url, options) => {
      const response = await globalThis.fetch(url, {
        ...options,
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store"
      });
      if (response.status === 401) throw new Error("Accedi di nuovo a TitanHD prima di ringraziare.");
      if (!response.ok) throw new Error(`TitanHD non ha confermato la richiesta (${response.status}).`);
      if (response.url && !response.url.startsWith("https://titanhd.space/")) {
        throw new Error("Risposta da un sito diverso.");
      }
      return response;
    };
    const refresh = async () => {
      const response = await request(sourceUrl, { method: "GET" });
      if (response.url && pageUrl(response.url) !== sourceUrl) throw new Error("Pagina cambiata durante il ringraziamento.");
      const snapshotDocument = new DOMParser().parseFromString(await response.text(), "text/html");
      if (snapshotDocument.querySelector(".rel-picker[data-media-id]")?.getAttribute("data-media-id") !== mediaId) {
        throw new Error("Pagina del titolo non disponibile. Accedi al sito e riprova.");
      }
      const context = readDocument2(snapshotDocument, sourceUrl);
      if (keys.some((key) => !context.variants.some((variant) => variant.key === key))) {
        throw new Error("Versioni cambiate. Aggiorna il pannello e riprova.");
      }
      return { context, entries: new Map(entries(snapshotDocument).map((entry) => [entry.key, entry])) };
    };
    let fresh = await refresh();
    const thanked = [];
    const already = [];
    const failed = [];
    const accepted = [];
    for (const key of keys) {
      if (fresh.context.variants.find((variant) => variant.key === key)?.links.length) {
        already.push(key);
        continue;
      }
      try {
        const entry = fresh.entries.get(key);
        const button = entry?.panel.querySelector("button[data-thanks][data-release-key]");
        if (!entry || !button || button.getAttribute("data-release-key") !== entry.releaseKey) {
          throw new Error("Pulsante Ringrazia non disponibile per questa versione.");
        }
        if (button.disabled || button.getAttribute("aria-disabled") === "true") {
          throw new Error("Ringraziamento non disponibile o gi\xE0 in corso.");
        }
        await request("https://titanhd.space/api/media/thanks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mediaId, releaseKey: entry.releaseKey })
        });
        accepted.push(key);
      } catch (reason) {
        failed.push({ key, error: reason instanceof Error ? reason.message : "Ringraziamento non riuscito." });
      }
    }
    if (accepted.length) {
      try {
        fresh = await refresh();
        for (const key of accepted) {
          if (fresh.context.variants.find((variant) => variant.key === key)?.links.length) thanked.push(key);
          else failed.push({ key, error: "Ringraziamento inviato, ma link non ancora disponibili." });
        }
      } catch (reason) {
        const detail = reason instanceof Error ? reason.message : "errore sconosciuto";
        failed.push(...accepted.map((key) => ({ key, error: `Ringraziamento inviato; aggiornamento non riuscito: ${detail}` })));
      }
    }
    refreshedPages.set(document2, fresh.context);
    return { context: fresh.context, thanks: { thanked, already, failed } };
  }
  var titanHdAdapter = {
    id: "titanhd",
    name: "TitanHD",
    patterns: ["https://titanhd.space/catalogo/*"],
    matches(value) {
      try {
        pageUrl(value);
        return true;
      } catch {
        return false;
      }
    },
    normalizeUrl: pageUrl,
    readPage: readPage2,
    thankSelected: thankSelected2
  };

  // src/sites/registry.ts
  var siteAdapters = [titanHdAdapter, laForestaAdapter];
  function resolveSiteAdapter(url) {
    const matches = siteAdapters.filter((adapter) => {
      try {
        return adapter.matches(url);
      } catch {
        return false;
      }
    });
    return matches.length === 1 ? matches[0] : null;
  }

  // src/content/overlay.ts
  var OVERLAY_WIDTHS = [420, 520, 650, 780, 900];
  var OVERLAY_STORAGE_KEY = "jspider.overlayWidth";
  var DEFAULT_WIDTH = 650;
  var HOST_ID = "jspider-overlay-host";
  function supportedWidth(value) {
    return typeof value === "number" && OVERLAY_WIDTHS.includes(value) ? value : DEFAULT_WIDTH;
  }
  function createOverlayController(document2, runtimeUrl, storage) {
    let currentWidth = DEFAULT_WIDTH;
    let frame = null;
    let work = Promise.resolve();
    const readPersistedWidth = async () => {
      const stored = await storage.get(OVERLAY_STORAGE_KEY);
      currentWidth = supportedWidth(stored[OVERLAY_STORAGE_KEY]);
    };
    const state = () => ({ open: frame?.isConnected === true, width: currentWidth });
    const applyWidth = (target, width) => {
      target.style.width = `${width}px`;
      target.style.maxWidth = "calc(100vw - 24px)";
    };
    const enqueue = (operation) => {
      const next = work.then(operation, operation);
      work = next.then(() => void 0, () => void 0);
      return next;
    };
    const toggle = () => enqueue(async () => {
      if (frame?.isConnected) {
        document2.getElementById(HOST_ID)?.remove();
        frame = null;
        return state();
      }
      await readPersistedWidth();
      document2.getElementById(HOST_ID)?.remove();
      const host = document2.createElement("div");
      host.id = HOST_ID;
      const shadow = host.attachShadow({ mode: "open" });
      const style = document2.createElement("style");
      style.textContent = ":host{all:initial}iframe{position:fixed;top:12px;right:12px;height:calc(100vh - 24px);z-index:2147483646;border:1px solid #3b525b;border-radius:18px;box-shadow:0 16px 70px #000a;background:#111d27}";
      frame = document2.createElement("iframe");
      frame.title = "JSpider \u2014 versioni, TMDB e TaskFlow";
      frame.src = runtimeUrl("sidebar.html?surface=overlay");
      applyWidth(frame, currentWidth);
      shadow.append(style, frame);
      (document2.body ?? document2.documentElement).append(host);
      return state();
    });
    const resize = (width) => enqueue(async () => {
      if (!OVERLAY_WIDTHS.includes(width)) {
        throw new Error("Seleziona una larghezza JSpider supportata.");
      }
      currentWidth = width;
      if (frame?.isConnected) applyWidth(frame, width);
      await storage.set({ [OVERLAY_STORAGE_KEY]: width });
      return state();
    });
    const status = () => enqueue(async () => {
      if (!frame?.isConnected) await readPersistedWidth();
      return state();
    });
    return { toggle, resize, status };
  }

  // src/content/index.ts
  var overlay = createOverlayController(
    document,
    (path) => chrome.runtime.getURL(path),
    {
      get: (key) => chrome.storage.local.get(key),
      set: (items) => chrome.storage.local.set(items)
    }
  );
  async function handle(message) {
    const adapter = resolveSiteAdapter(location.href);
    if (!adapter) throw new Error("Questa pagina non \xE8 supportata da JSpider.");
    if (message.action === "overlay.toggle") return overlay.toggle();
    if (message.action === "overlay.status") return overlay.status();
    if (message.action === "overlay.resize") return overlay.resize(Number(message.width));
    if (message.action === "snapshot" || message.action === "refresh") {
      return adapter.loadPage ? adapter.loadPage(document, location.href) : adapter.readPage(document, location.href);
    }
    if (message.action === "thank") {
      if (!adapter.thankSelected) throw new Error("Il sito non supporta il ringraziamento da JSpider.");
      return adapter.thankSelected(document, location.href, message.variantKeys ?? []);
    }
    throw new Error("Azione pagina non supportata.");
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.target !== "content") return void 0;
    void handle(message).then(
      (data) => sendResponse({ ok: true, data }),
      (reason) => sendResponse({
        ok: false,
        error: { message: reason instanceof Error ? reason.message : "Operazione pagina non riuscita." }
      })
    );
    return true;
  });
})();
