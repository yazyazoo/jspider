[English](development.md) | Italiano

# Sviluppo

## Requisiti

- Node.js 22 o successivo
- npm con il lockfile incluso nella repository
- Chrome, Edge, Brave, Vivaldi, Opera o un altro browser Chromium 120+

## Installazione e verifica

```powershell
npm ci
npm run verify
```

`verify` esegue il controllo TypeScript, tutti i test Vitest, l’audit
MyJD/legacy e la build di produzione tramite esbuild.

Comandi singoli:

```powershell
npm run check
npm test
npm run audit:legacy
npm run build
```

## Caricare l’estensione

L’output della build è `JSpider/dist`. Apri la pagina delle estensioni del
browser, abilita la modalità sviluppatore, scegli **Carica estensione non
pacchettizzata** e seleziona quella cartella.

Dopo modifiche al manifest, al service worker o ai content script, ricostruisci
e usa il comando Ricarica della scheda dell’estensione. Se è cambiato un content
script, aggiorna anche la pagina del titolo supportato.

## Configurazione durante lo sviluppo

Copia `config.example.json` come `config.local.json` nella radice e compilalo
localmente. La build copia il file in `dist/`; entrambe le posizioni sono
ignorate. La build funziona anche se il file locale è assente.

## Creare una release candidata

```powershell
npm run package:extension
```

Il comando ripete la verifica completa e crea
`release/jspider-v<versione>.zip`. Lo ZIP contiene direttamente i file runtime
alla radice ed esclude sempre la configurazione locale.

## Automazione

`.github/workflows/ci.yml` verifica push e pull request ed espone la cartella
compilata come artefatto del workflow. `.github/workflows/release.yml` rimane
inattivo finché non viene pubblicato un tag `v*`; prima di creare una GitHub
Release richiede che le versioni di tag, package e manifest coincidano.

Non creare tag, pubblicare Release o eseguire deploy senza autorizzazione
esplicita.
