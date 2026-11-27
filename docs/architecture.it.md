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

`src/sites/catalog.json` è la fonte dichiarativa per ID, origini esatte,
pattern delle pagine e capacità disponibili. Ogni sito supportato vive nella
propria cartella ed esporta un `SiteModule`:

```text
src/sites/
  catalog.json
  contracts.ts
  registry.ts
  titanhd/
    module.ts
    article.ts
  laforestaincantata/
    module.ts
    article.ts
    technical.ts
    lficrypt.ts
```

Il content script conosce soltanto il registro comune e il contratto
`ArticleAdapter`. L’adapter legge titolo corrente, riferimento IMDb, metadati
tecnici, versioni, link agli archivi e funzioni di ringraziamento/sblocco. Il
registro rifiuta corrispondenze assenti o ambigue invece di scegliere in base
all’ordine. Il controllo dell’origine esatta rimane anche dentro ogni adapter.

`SearchProvider` è un contratto opzionale riservato a una futura interfaccia
MultiSearch. Nessuno dei moduli attuali lo implementa: JSpider continua a
lavorare soltanto sulla pagina supportata già aperta e la ricerca non condivide
il percorso delle azioni articolo. Il content script gestisce inoltre l’overlay
portabile usato dai browser Chromium.

## Livello sidebar

`src/sidebar/` mostra le tre fasi:

1. ricerca TMDB e validazione esplicita, seguite dal controllo informativo Emby;
2. proposta delle versioni, selezione manuale, host, ringraziamenti e password RAR;
3. Quick Workflow oppure Create TaskFlow integrato, in modalità esclusive.

La sidebar non si collega mai direttamente a JD e non conserva il token Emby.
Le chiamate API sensibili vengono inoltrate al service worker dell’estensione.
Le schede mostrano sempre i collegamenti alle fonti e aggiungono in modo asincrono
i rating e i premi MDBList disponibili e il rating JustWatch senza bloccare la validazione.

## Livelli background e dominio

`src/background/` gestisce impostazioni e client HTTP. TaskFlow usa lo stesso
token Bearer amministrativo della WebUI. TMDB accetta un token di lettura o una
chiave v3. Emby invia il token solamente come `X-Emby-Token` ed esegue richieste
GET. MDBList viene interrogato per ID TMDB e tipo di contenuto. JustWatch usa
una ricerca GraphQL senza chiave, privilegia la corrispondenza IMDb e ripiega su
titolo, anno e tipo esatti. Dati mancanti o ricerche fallite rimuovono soltanto
il valore: il collegamento di ricerca resta disponibile.
Per una serie TV riconosciuta esattamente, il client Emby recupera il catalogo
delle stagioni, carica l’episodio 1 dell’ultima stagione normale ed espone alla
sidebar ricerche lazy in sola lettura per le altre stagioni. La sidebar conserva
in memoria solo le stagioni aperte per il titolo validato e ignora risposte
asincrone obsolete.

`src/domain/` contiene validazione pura, proposta delle versioni, analisi
ordinata delle submission, costruzione dei payload workflow e risoluzione della
presenza Emby. Gli identificatori package TaskFlow rimangono stringhe opache.

OMDb viene interrogato tramite IMDb ID soltanto quando MDBList non ha restituito
i premi. Non fornisce rating a JSpider, non sovrascrive mai MDBList e ogni errore
rimane non bloccante.

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

Il `manifest.json` sorgente contiene le impostazioni generali dell’estensione e
delle API. Durante la build, `scripts/site-manifest.mjs` valida il catalogo e
genera in `dist/manifest.json` i permessi host, i match dei content script e i
match delle risorse accessibili relativi ai siti. Pattern non validi, duplicati
o appartenenti a origini diverse bloccano la build.
