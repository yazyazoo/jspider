[English](architecture.md) | Italiano

# Architettura

JSpider è una singola estensione Manifest V3. Tutto il JavaScript eseguibile è
incluso localmente; durante l’esecuzione non vengono caricati script remoti.

```text
Pagina supportata
  → content script e scraper del sito
  → sidebar JSpider
  → service worker in background
      → TMDB
      → MDBList (rating e premi in sola lettura)
      → Emby (sola lettura)
      → API TaskFlow
          → integrazione JDownloader configurata
```

## Livello pagina e scraper

`src/sites/` contiene l’estrazione selettiva per TitanHD e La Foresta
Incantata. Il content script legge titolo corrente, riferimento IMDb, metadati
tecnici, versioni, link agli archivi e funzioni di ringraziamento/sblocco.
Gestisce inoltre l’overlay portabile nella pagina usato dai browser Chromium.

## Livello sidebar

`src/sidebar/` mostra le tre fasi:

1. ricerca TMDB e validazione esplicita, seguite dal controllo informativo Emby;
2. proposta delle versioni, selezione manuale, host, ringraziamenti e password RAR;
3. Quick Workflow oppure Create TaskFlow integrato, in modalità esclusive.

La sidebar non si collega mai direttamente a JD e non conserva il token Emby.
Le chiamate API sensibili vengono inoltrate al service worker dell’estensione.
Le schede mostrano subito il voto nativo TMDB, poi aggiungono in modo asincrono
i rating e i premi MDBList disponibili senza bloccare la validazione.

## Livelli background e dominio

`src/background/` gestisce impostazioni e client HTTP. TaskFlow usa lo stesso
token Bearer amministrativo della WebUI. TMDB accetta un token di lettura o una
chiave v3. Emby invia il token solamente come `X-Emby-Token` ed esegue richieste
GET. MDBList viene interrogato per ID TMDB e tipo di contenuto; dati mancanti o
ricerche fallite vengono omessi.

`src/domain/` contiene validazione pura, proposta delle versioni, analisi
ordinata delle submission, costruzione dei payload workflow e risoluzione della
presenza Emby. Gli identificatori package TaskFlow rimangono stringhe opache.

OMDb dispone attualmente soltanto della configurazione; non esiste ancora un
client di rete OMDb.

## Confine TaskFlow e JD

L’unico percorso supportato è:

```text
JSpider → API pubblica TaskFlow → integrazione JDownloader di TaskFlow → JD
```

JSpider non contiene volutamente SDK MyJDownloader, autenticazione o sessioni
MyJD, chiamate dirette alle API JD, intercettazione Click'n'Load, creazione o
lettura dei commenti JD, né fallback di compatibilità. Il normale Click'n'Load
appartiene all’estensione ufficiale MyJDownloader.

## Distribuzione

Sorgenti, test, documentazione e script di build vivono in questa repository.
`dist/` viene generata e versionata, così un clone è subito caricabile. La
configurazione locale rimane esclusa. Gli ZIP delle GitHub Release contengono
solamente l’estensione runtime e l’esempio di configurazione con segnaposto.
