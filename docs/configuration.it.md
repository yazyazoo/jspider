[English](configuration.md) | Italiano

# Configurazione

JSpider legge `config.local.json` dalla radice dell’estensione. Il file
versionato `config.example.json` contiene tutte le chiavi supportate con valori
segnaposto.

Per le build dai sorgenti, conserva `config.local.json` nella radice della
repository. `npm run build` lo copia in `dist/`; il file locale copiato rimane
escluso anche se la cartella compilata è versionata. Per una Release scaricata,
crea il file direttamente accanto al `manifest.json` estratto.

## Campi

| Chiave | Scopo |
| --- | --- |
| `taskflowBaseUrl` | Origine TaskFlow, senza `/api/v1` |
| `taskflowToken` | Token Bearer amministrativo usato dalla WebUI e dal client API TaskFlow |
| `tmdbCredential` | Token di lettura TMDB oppure API key v3 |
| `omdbApiKey` | API key OMDb usata esclusivamente come fallback dei premi mancanti in MDBList |
| `mdblistApiKey` | API key MDBList usata per leggere rating e premi |
| `embyBaseUrl` | Origine HTTPS del server Emby |
| `embyToken` | Token API Emby inviato solamente nell’header `X-Emby-Token` |
| `_logDirectory` | Percorso completo della cartella `log`, mostrato in chiaro e allineato automaticamente dal selettore JSpider |

I valori TaskFlow, TMDB, OMDb e MDBList possono essere salvati anche dal pannello
Impostazioni di JSpider. Ogni proprietà esplicitamente presente in
`config.local.json`, compreso un valore vuoto, ha la precedenza e viene
sincronizzata in `chrome.storage.local`. Lo storage Edge è usato come fallback
soltanto per proprietà assenti dal JSON. Durante l’attuale fase di test questi
campi mostrano intenzionalmente i valori in chiaro.

Emby viene configurato esclusivamente tramite `config.local.json`. La ricerca è
in sola lettura, usa l’ID TMDB validato quando disponibile e passa a titolo/anno
solo dopo la scelta esplicita del fallback.

## Gestione dei segreti

- `config.local.json`, `.env*`, chiavi, certificati e `release/` sono esclusi
  da Git. La cartella compilata `dist/` è versionata, ma ogni
  `dist/config.local.json` resta escluso grazie alla regola sul nome del file.
- Il packaging esclude esplicitamente `config.local.json` anche quando una build
  locale lo ha copiato in `dist/`.
- I token TaskFlow ed Emby non vengono inseriti negli URL delle richieste né
  mostrati nel pannello di stato Emby. MDBList richiede la propria chiave nella
  query; JSpider la oscura nei messaggi di errore HTTP e di rete.
- Usa endpoint HTTPS per TaskFlow ed Emby, così le credenziali sono cifrate
  durante il transito.

Non sostituire mai i segnaposto di `config.example.json` con credenziali reali.

## Cartella log Quick Workflow

Inserisci il percorso completo della cartella `log` e usa **Impostazioni →
Allinea cartella progetto e config**. Nella pagina aperta dall’estensione devi
selezionare la root del progetto (`JSpider` o `JSpider-follow-season`), non la
cartella `log`. JSpider verifica che il percorso inserito appartenga alla root
selezionata, crea `log` se manca, conserva l’autorizzazione Chromium e aggiorna
`config.local.json` sia nella root sia in `dist` quando quest’ultima esiste. Gli
altri valori, incluse chiavi e token, restano invariati.

Lo stato **CONFIG E CHROMIUM ALLINEATI** conferma che il percorso completo nel
JSON e quello autorizzato dal browser coincidono. Gli stati **CONFIG MANCANTE**,
**CHROMIUM NON AUTORIZZATO** e **NON ALLINEATI** indicano esattamente quale parte
deve essere corretta.

Se Chromium conserva già un handle `log` precedente, usa **Conferma cartella
già autorizzata**: associa il percorso completo visibile all’handle esistente
senza riaprire il selettore. È anche il percorso consigliato sulle versioni
Chromium 157 per Windows affette dalla regressione che può restituire
erroneamente `AbortError` dopo una selezione valida.

Ogni Quick Workflow crea un file JSON leggibile con data e ora locale all’inizio
del nome, seguite dal nome workflow. Ordinando la cartella per nome si ottiene
quindi l’ordine cronologico. JSpider aggiorna lo stesso file dopo ogni richiesta, risposta o
errore: la cartella diventa quindi anche lo storico dei workflow. Se Chromium
dimentica il permesso, seleziona nuovamente la cartella. Svuotare l’ultimo log
dalla sidebar non elimina i file storici.
