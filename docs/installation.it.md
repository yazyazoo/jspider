[English](installation.md) | Italiano

# Installazione e distribuzione

JSpider è disponibile in due formati pronti all’uso. Nessuna distribuzione
pubblica contiene `config.local.json` o credenziali private.

## ZIP della Release

Scarica [jspider-v0.1.0.zip](https://github.com/yazyazoo/jspider/releases/download/v0.1.0/jspider-v0.1.0.zip)
dalla [pagina Release di JSpider](https://github.com/yazyazoo/jspider/releases),
quindi:

1. Estrai lo ZIP in una cartella permanente.
2. Copia `config.example.json` come `config.local.json` nella stessa cartella.
3. Inserisci i valori TaskFlow, TMDB, OMDb ed eventualmente Emby.
4. Apri la pagina delle estensioni Chromium e attiva la modalità sviluppatore.
5. Scegli **Carica estensione non pacchettizzata** e seleziona la cartella
   estratta che contiene `manifest.json`.

I file sono direttamente alla radice dello ZIP: non serve compilare i
sorgenti.

## Cartella dist versionata

La repository contiene una
[cartella dist/ compilata](https://github.com/yazyazoo/jspider/tree/main/dist).
Dopo il clone puoi caricarla direttamente:

1. Crea `dist/config.local.json` da `dist/config.example.json`.
2. Compila la configurazione locale.
3. Scegli **Carica estensione non pacchettizzata** e seleziona `dist/` nella
   repository.

Non selezionare la radice della repository. `dist/config.local.json` rimane
escluso da Git anche se gli altri file di `dist/` sono versionati.

## Regola per i manutentori

`dist/` viene generata da `npm run build` e committata insieme alla modifica
dei sorgenti che l’ha prodotta. `release/` rimane locale ed esclusa; il file
`jspider-v<versione>.zip` viene pubblicato come asset di una GitHub Release.

