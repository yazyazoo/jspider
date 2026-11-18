[English](README.md) | Italiano

# JSpider

JSpider è un’estensione Chromium Manifest V3 che legge le pagine supportate,
confronta le versioni disponibili, valida i metadati tramite TMDB, mostra rating
e premi tramite MDBList, segnala se
un titolo è già presente in Emby e crea workflow attraverso le API pubbliche
TaskFlow.

```text
JSpider → API TaskFlow → integrazione JDownloader di TaskFlow → JD
```

JSpider non contiene SDK MyJDownloader, login, sessioni, protocolli basati sui
commenti JD, chiamate dirette a JD o intercettazione Click'n'Load. Il normale
Click'n'Load rimane responsabilità dell’estensione ufficiale MyJDownloader.

## Installare una release

1. Scarica [jspider-v0.1.0.zip](https://github.com/yazyazoo/jspider/releases/download/v0.1.0/jspider-v0.1.0.zip)
   dalle [GitHub Releases](https://github.com/yazyazoo/jspider/releases).
2. Estrai l’archivio in una cartella permanente.
3. Copia `config.example.json` come `config.local.json` e inserisci endpoint e
   credenziali richiesti.
4. Apri la pagina delle estensioni in un browser Chromium, abilita la modalità
   sviluppatore e scegli **Carica estensione non pacchettizzata**.
5. Seleziona la cartella estratta che contiene `manifest.json`.

Gli archivi Release non contengono mai `config.local.json` o credenziali
private.

In alternativa, clona la repository e carica la cartella già compilata
[dist/](https://github.com/yazyazoo/jspider/tree/main/dist). Prima dell’uso
crea `dist/config.local.json` dall’esempio incluso; il file locale rimane
escluso da Git.

## Sviluppo

Requisiti: Node.js 22+ e un browser Chromium 120+.

```powershell
npm ci
npm run verify
```

La build aggiorna la cartella versionata `JSpider/dist`. Carica `JSpider/dist`
come estensione non pacchettizzata; non caricare la radice della repository.
Quando esiste `config.local.json` nella radice, la build locale lo copia in
`dist/`, ma quella configurazione locale rimane esclusa da Git.

Per creare lo stesso ZIP privo di segreti usato dalle Release:

```powershell
npm run package:extension
```

L’archivio viene scritto in `release/` con `manifest.json` alla radice.

## Documentazione

- [Configurazione](docs/configuration.it.md)
- [Installazione e distribuzione](docs/installation.it.md)
- [Sviluppo](docs/development.it.md)
- [Architettura](docs/architecture.it.md)
- [Manuale operativo](docs/operator-manual.it.md)

## Flusso principale

La sidebar nella pagina condivide validazione del titolo e selezione delle
versioni fra due modalità di creazione esclusive:

- **Quick Workflow** invia i package e usa un preset TaskFlow per Create e
  Start. Con Autodownload disattivato, l’invio si ferma nel LinkGrabber.
- **TaskFlow** invia i package e apre la vista Create TaskFlow integrata con i
  metadati comuni precompilati; quella vista rimane l’autorità per preset, task,
  parametri, cleanup, Create e Start.

Il pannello Emby nella fase 1 è informativo e in sola lettura. L’indicatore
rosso segnala file presenti, il verde indica contenuto assente; stati ambigui o
non verificabili restano distinti e non influenzano la creazione del workflow.
Per le serie TV, pulsanti compatti delle stagioni disposti a capo aprono
automaticamente l’ultima stagione normale e mostrano i nomi file dell’episodio 1
della stagione selezionata.

## Licenza

JSpider è distribuito con licenza GPL-3.0-or-later. Consulta `NOTICE` per la
provenienza. La WebUI TaskFlow inclusa mantiene la propria licenza MIT in
`vendor/taskflow-ui`.
