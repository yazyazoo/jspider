English | [Italiano](operator-manual.it.md)

# JSpider operator manual

This manual follows the operator through the sidebar from opening a supported
title page to submitting packages or creating a workflow. Interface labels are
shown as they appear in JSpider.

## What JSpider can change

Most of the sidebar is read-only preparation. External effects occur only when
the operator explicitly performs one of these actions:

| Action | External effect |
| --- | --- |
| `Ringrazia le versioni selezionate` | Sends thanks to the source site and rereads unlocked links |
| `Quick Workflow` | Submits packages to TaskFlow/JD and may create and start a workflow |
| `Carica package su JD` | Submits packages to TaskFlow/JD, without creating a workflow yet |
| Create/Start inside the TaskFlow WebUI | Creates or starts the workflow through TaskFlow |

TMDB searches and the Emby presence check are read-only. JSpider never calls JD
directly and provides no package deletion or rollback command.

## Before opening the sidebar

1. Open a supported single-title page on TitanHD or La Foresta Incantata.
2. Confirm that TaskFlow and TMDB are configured. MDBList is optional and adds
   ratings and awards. Emby is optional and requires
   `embyBaseUrl` and `embyToken` in `config.local.json`.
3. Click the JSpider extension icon. The in-page sidebar opens; the same icon
   toggles it closed.

The title bar provides:

- **Larghezza**: chooses one of five overlay widths when the portable overlay
  is in use.
- **Log JSON**: opens the local record of the latest Quick Workflow run.
- **Impostazioni**: opens the TaskFlow, TMDB, OMDb and MDBList connection fields.
- **Aggiorna pagina**: rereads the current title page and its versions.

The footer button **Apri WebUI TaskFlow** replaces the JSpider Home with the
complete administrative WebUI. Its label becomes **Torna a JSpider** while the
WebUI is open.

Green rounded borders indicate phases whose current required inputs are valid.
The small circled `i` controls open contextual explanations. The sticky message
at the bottom reports operation progress and errors.

## Phase 1 — Find and validate the title

JSpider initially extracts title, year, media type and, when available, IMDb ID
from the open page. With TMDB configured, it automatically searches through the
IMDb reference and displays candidates. It never validates a candidate without
operator confirmation.

### Search controls

- Edit **Titolo**, **Anno** or **Tipo** if the extracted values are wrong.
- **Cerca tramite IMDb** retries using the page IMDb ID, then falls back to the
  current title/year when necessary.
- **Cerca su TMDB** performs a new title search using the edited fields. Use it
  after manually changing the title.
- The TMDB, IMDb and other rating logos open the matching title on their source
  site and do not change JSpider state.

Editing title, year or type clears the previous validation and Emby result.

Each compact candidate card always shows links for TMDB, IMDb, Rotten Tomatoes
critics and audience, Metacritic, Trakt, Letterboxd, JustWatch, and the other
supported sources. An available score appears beside its logo; otherwise the
logo remains clickable. MDBList supplies its ratings and awards when configured;
when awards are missing, OMDb may fill them without ever overwriting MDBList.
JustWatch is queried without a key and never blocks the flow. The overview is limited
to three lines; **Leggi tutto** expands it and **Mostra meno** collapses it.
This keeps the poster, metadata and actions together. Awards appear only when
available; MDBList, OMDb, or JustWatch lookup failures do not block validation.

### Confirming metadata

Use **Valida questo titolo** when the displayed candidate is correct. JSpider
stores its TMDB ID and media type for phase 3, then starts the read-only Emby
lookup.

Use **Usa esplicitamente titolo e anno senza TMDB ID** only when the candidate
describes the correct work but its TMDB ID must not be sent. This fallback is
available only with a valid four-digit year. Phase 3 will send title and year
instead of `tmdb_id`; Emby also searches by title/year and treats multiple exact
matches as ambiguous.

### Emby panel

The Emby panel is informational and never blocks or changes a workflow:

- **red LED — Presente**: one or more matching files exist; filenames are shown
  without directory and final extension;
- **green LED — Assente**: no matching item was returned;
- **amber — Ambiguo**: title/year produced multiple exact matches;
- **amber — Non verificabile**: permission, token, network, HTTP or malformed
  response prevented a reliable answer;
- **In attesa/Verifica**: validation has not happened yet or the lookup is in
  progress.

For a TV series, the panel lists every available season as compact wrapping
buttons (`S01`, `S02`, ...). The latest normal season is selected automatically;
`S00` is used only when no normal season exists. The selected season shows every
distinct filename for episode 1, without directory or final extension. Click a
different season to load its episode 1. A season without episode 1 says so
explicitly and JSpider never substitutes another episode.

An error is never converted into “Assente”. The first check may trigger a
browser permission request for the configured Emby HTTPS origin.

## Phase 2 — Choose versions and links

Phase 2 selects which release versions become TaskFlow/JD packages.

### Proposal profile

- **4K + 1080p**: proposes preferred candidates for both resolutions when
  available.
- **1080p sorgente/untouched + codifica**: proposes a source/untouched 1080p
  option and an encoded alternative.
- **Scelta manuale**: makes no automatic proposal; the operator selects cards.

**Scarta sorgenti oltre · Mb/s totali** applies a total bitrate ceiling. Empty
or `0` means unlimited. Recommendations use the available metadata and remain
advisory; every checkbox can be changed manually.

Within the same resolution and source-priority tier, JSpider compares only the
video-track bitrate. Its equivalent-quality estimate uses the empirical factors
AVC/H.264 `×1` and HEVC/H.265 `×2`; total bitrate does not affect ranking and is
used only by the optional ceiling. Reasons state the decision briefly and add
`Indicativa` only when data is incomplete or not directly comparable.

Each version card shows resolution, codec/HDR, video and total bitrate, total
file size, video-track size and an explanation of the proposal. A locked or
incomplete source is called out in the explanation.

### Unlocking and host selection

**Ringrazia le versioni selezionate** sends thanks only for selected versions,
skips versions already unlocked, rereads their links and keeps the sidebar and
selection open. This is the only source-site write performed by the sidebar.

Under **Host da inviare**, select at least one host that has links for every
selected version. The counters show the currently available links per host.
Only links for checked hosts are included in submission.

### RAR password

JSpider combines passwords detected from selected versions. A single detected
password is filled automatically. If selected versions disagree, phase 2 is
invalid until the operator enters the intended password manually. The final
value is passed to the workflow `unrar` data; JSpider does not extract archives.

## Phase 3 — Choose the creation path

Enter a **Nome workflow** containing ASCII letters or numbers. JSpider
normalizes spaces and unsupported characters for TaskFlow. Phase 3 becomes
valid only when phases 1 and 2 are valid and TaskFlow is configured.

Choose exactly one branch before submission. After a submission begins, JSpider
locks the two mode controls to prevent accidentally mixing the paths.

### Quick Workflow

Before the first run, open **Settings**, choose the Quick Workflow log folder,
and select the repository's local `log` directory in the JSpider authorization
page. Every run is then mirrored progressively to its own JSON history file.

Quick Workflow is the default simplified path.

1. Select a **Preset TaskFlow**. Its task sequence is displayed below the
   selector.
2. Review **Autodownload** and **Cleanup**.
3. Click **Quick Workflow** once.

When a preset is selected, its `cleanup_on_success` default wins and updates the
visible Cleanup checkbox. The operator may then change the checkbox explicitly.

With **Autodownload enabled**, one click performs this ordered sequence:

```text
Submission packages → Create workflow → Start workflow
```

The preset is required. JSpider creates nothing if any submission result lacks
a confirmed persistent TaskFlow package ID.

With **Autodownload disabled**, JSpider performs Submission only. Packages stay
in JD LinkGrabber, no Create or Start occurs, and no preset is required.

Do not click again while the status says the operation is running. If Create
succeeds but Start fails, use the TaskFlow WebUI to retry **Start only**; do not
resubmit packages.

#### Quick Workflow JSON log

The title-bar **Log JSON** button stores and displays only the latest Quick
Workflow run. Expandable sections are appended in order: Submission request and
response, Create request and response, then Start request and response. An
error is recorded under its exact phase with the structured details returned.

The log updates while the run progresses, survives closing the sidebar and is
not cleared when opening the WebUI. **Copia tutto** copies the complete JSON
document; **Svuota** removes it from local extension storage. Values are
deliberately shown in clear text and may include links, RAR passwords, names
and identifiers. API keys, TaskFlow tokens and HTTP headers are not added.

### TaskFlow

This branch keeps creation under the embedded TaskFlow WebUI.

1. Select **TaskFlow**.
2. Click **Carica package su JD** once.
3. Wait for the embedded Create view.
4. Review preset, task order, task parameters and cleanup in the WebUI.
5. Use the WebUI Create/Start action when ready.

The first button performs package Submission only and then pre-fills both
branches’ shared data in the Create view:

- TaskFlow package IDs;
- workflow name;
- media kind;
- validated TMDB ID, or explicit title/year fallback;
- RAR password when present.

It does **not** create the workflow. The embedded WebUI is authoritative for
preset, task order, task JSON, cleanup and the final Create/Start action.

## Handling failures safely

- **Quick Workflow error**: open **Log JSON** before repeating the operation and
  inspect the latest recorded phase and response.
- **Submission could not be confirmed**: do not immediately repeat the action.
  The package may already be visible in JD even though TaskFlow could not
  confirm and persist it. Inspect JD and the TaskFlow package list first.
- **Workflow created, Start failed**: open TaskFlow and retry Start only.
- **Preset list unavailable**: verify TaskFlow URL/token and connectivity; Quick
  Workflow with Autodownload stays blocked until a preset can be selected.
- **Button disabled**: check the green phase borders, selected links/hosts, RAR
  password conflicts, workflow name and TaskFlow configuration.
- **Stale title or links**: use **Aggiorna pagina**. After changing extension
  code or configuration files, reload the unpacked extension and refresh the
  title page.

JSpider intentionally has no “cancel packages from JD” action. If an operator
abandons a submission, package cleanup is performed directly in JD or through
the appropriate TaskFlow administrative controls.
