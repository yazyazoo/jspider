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
| `omdbApiKey` | API key OMDb; salvata per i test ma non ancora usata da un client di rete |
| `mdblistApiKey` | API key MDBList usata per leggere rating e premi |
| `embyBaseUrl` | Origine HTTPS del server Emby |
| `embyToken` | Token API Emby inviato solamente nell’header `X-Emby-Token` |

I valori TaskFlow, TMDB, OMDb e MDBList possono essere salvati anche dal pannello
Impostazioni di JSpider. I valori espliciti in `chrome.storage.local`, compresi
quelli vuoti, hanno la precedenza sui valori locali. Durante l’attuale fase di
test questi campi mostrano intenzionalmente i valori in chiaro.

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
