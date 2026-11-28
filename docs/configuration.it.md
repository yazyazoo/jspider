[English](configuration.md) | Italiano

# Configurazione

JSpider usa `config.local.json` come persistenza principale. Il file
versionato `config.example.json` contiene tutte le chiavi supportate con valori
segnaposto.

Per le build dai sorgenti, conserva `config.local.json` nella radice della
repository. `npm run build` lo copia in `dist/`; il file locale copiato rimane
escluso anche se la cartella compilata è versionata. Per una Release scaricata,
crea il file direttamente accanto al `manifest.json` estratto.

Apri **Impostazioni → Collega config.local.json**, seleziona quel singolo file e
consenti la scrittura. Il file collegato diventa la fonte letta direttamente da
JSpider: per le build dai sorgenti scegli quello nella root della repository.
La copia in `dist` serve solo all’avvio prima del collegamento e viene aggiornata
dalla build. Non serve autorizzare l’intera cartella progetto.

## Campi

| Chiave | Scopo |
| --- | --- |
| `taskflowBaseUrl` | Origine TaskFlow, senza `/api/v1` |
| `protectedExecution` | Booleano (default `true`), modificabile dal JSON e dalla checkbox “Esecuzione protetta” |
| `taskflowToken` | Token Bearer amministrativo usato dalla WebUI e dal client API TaskFlow |
| `tmdbCredential` | Token di lettura TMDB oppure API key v3 |
| `omdbApiKey` | API key OMDb usata esclusivamente come fallback dei premi mancanti in MDBList |
| `mdblistApiKey` | API key MDBList usata per leggere rating e premi |
| `embyBaseUrl` | Origine HTTPS del server Emby |
| `embyToken` | Token API Emby inviato solamente nell’header `X-Emby-Token` |
| `_logDirectory` | Percorso completo della cartella `log`, mostrato in chiaro e usato come oracolo durante l’autorizzazione Chromium |

I campi delle impostazioni, inclusi Emby, percorso log ed esecuzione protetta,
leggono il JSON. **Salva impostazioni** aggiorna prima il file collegato e poi
la copia in `chrome.storage.local`. Lo storage Chromium non è mai una fonte dei
valori. Le chiavi non modificate o non ancora riconosciute nel JSON sono conservate.
Le modifiche esterne al file sono rilette aprendo le impostazioni e durante le
operazioni API. I valori restano visibili in chiaro durante questa fase di test.

Senza collegamento al file è possibile leggere il config incluso nell’estensione,
ma il salvataggio viene bloccato con un messaggio esplicito. Se la scrittura fallisce,
non viene mostrato un falso successo e Chromium non riceve i valori non salvati.
Un JSON malformato viene segnalato; non viene sostituito con vecchi valori Chromium.
Il browser può richiedere una nuova autorizzazione dopo una revoca o reinstallazione.

La ricerca Emby è in sola lettura, usa l’ID TMDB validato quando disponibile e
passa a titolo/anno solo dopo la scelta esplicita del fallback.

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

Configura `_logDirectory` nel JSON o dal campo nelle impostazioni e salva, poi usa
**Impostazioni → Autorizza cartella log**. Nella pagina aperta dall’estensione
seleziona direttamente la cartella `log` mostrata, non la root del progetto.
JSpider conserva l’autorizzazione Chromium e associa l’handle al percorso del
config. Il file JSON resta l’oracolo e ha precedenza su eventuali percorsi
obsoleti rimasti nello storage del browser.

Lo stato **CONFIG E CHROMIUM ALLINEATI** conferma che il percorso completo nel
JSON e quello autorizzato dal browser coincidono. Gli stati **CONFIG MANCANTE**,
**CHROMIUM NON AUTORIZZATO** e **NON ALLINEATI** indicano esattamente quale parte
deve essere corretta.

Se Chromium conserva già un handle `log` precedente, usa **Conferma cartella
già autorizzata**: associa il percorso completo visibile all’handle esistente
senza riaprire il selettore.

Ogni Quick Workflow crea un file JSON leggibile con data e ora locale all’inizio
del nome, seguite dal nome workflow. Ordinando la cartella per nome si ottiene
quindi l’ordine cronologico. JSpider aggiorna lo stesso file dopo ogni richiesta, risposta o
errore: la cartella diventa quindi anche lo storico dei workflow. Se Chromium
dimentica il permesso, seleziona nuovamente la cartella. Svuotare l’ultimo log
dalla sidebar non elimina i file storici.
