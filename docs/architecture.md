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
      → MDBList (read-only ratings and awards)
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
Candidate cards always expose provider links, then add available MDBList ratings,
awards, and the keyless JustWatch rating asynchronously without blocking validation.

## Background and domain layers

`src/background/` owns settings and HTTP clients. TaskFlow uses the same
administrative Bearer token as its WebUI. TMDB supports a read token or v3 key.
Emby sends its token only as `X-Emby-Token` and performs GET requests. MDBList
is queried by TMDB ID and media kind. JustWatch uses a keyless GraphQL lookup,
prefers an IMDb match, and falls back to exact title, year, and media kind.
Missing data or failed enrichment removes only the value; the provider search
link remains available.
For an exact TV-series match, the Emby client retrieves the season catalog,
loads episode 1 for the latest normal season, and exposes lazy read-only season
lookups to the sidebar. The sidebar caches only seasons opened for the current
validated title and rejects stale asynchronous results.

`src/domain/` contains pure validation, release recommendation, ordered
submission analysis, workflow payload construction, and Emby presence
resolution. TaskFlow package identifiers remain opaque strings.

OMDb is queried by IMDb ID only when MDBList did not return awards. It does not
supply ratings to JSpider, never overwrites MDBList, and every failure is non-blocking.

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
`dist/` is generated and tracked so a clone is immediately loadable. Local
configuration remains ignored. GitHub Release ZIP files contain only the
runtime extension and placeholder configuration example.
