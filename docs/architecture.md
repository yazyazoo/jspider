English | [Italiano](architecture.it.md)

# Architecture

JSpider is a single Manifest V3 extension. All executable JavaScript is bundled
locally; no remote script is loaded at runtime.

```text
Supported page
  → content script and site scraper
  → JSpider sidebar
  → background service worker
      → TMDB
      → Emby (read-only)
      → TaskFlow API
          → configured JDownloader integration
```

## Page and scraper layer

`src/sites/` contains selective TitanHD and La Foresta Incantata extraction.
The content script reads the current title, IMDb reference, technical metadata,
release versions, archive links, and thank/unlock capabilities. It also owns the
portable in-page overlay used by Chromium browsers.

## Sidebar layer

`src/sidebar/` renders the three phases:

1. TMDB search and explicit validation, followed by informational Emby lookup;
2. version recommendation, manual selection, hosts, thanks, and RAR password;
3. exclusive Quick Workflow or embedded TaskFlow Create flow.

The sidebar never connects directly to JD and does not store the Emby token.
Sensitive API calls are sent to the extension background service worker.

## Background and domain layers

`src/background/` owns settings and HTTP clients. TaskFlow uses the same
administrative Bearer token as its WebUI. TMDB supports a read token or v3 key.
Emby sends its token only as `X-Emby-Token` and performs GET requests.

`src/domain/` contains pure validation, release recommendation, ordered
submission analysis, workflow payload construction, and Emby presence
resolution. TaskFlow package identifiers remain opaque strings.

OMDb currently has configuration storage only; there is no OMDb network client.

## TaskFlow and JD boundary

The only supported path is:

```text
JSpider → public TaskFlow API → TaskFlow JDownloader integration → JD
```

JSpider deliberately contains no MyJDownloader SDK, MyJD authentication or
session, direct JD API calls, Click'n'Load interception, JD-comment creation or
parsing, or compatibility fallback. Ordinary Click'n'Load belongs to the
official MyJDownloader extension.

## Distribution

Source, tests, documentation, and build scripts live in this repository.
`dist/` is generated and ignored. GitHub Release ZIP files contain only the
runtime extension and placeholder configuration example.
