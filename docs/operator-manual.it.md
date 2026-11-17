[English](operator-manual.md) | Italiano

# Manuale operativo JSpider

Questo manuale accompagna l’operatore nella sidebar, dall’apertura della pagina
di un titolo fino all’invio dei package o alla creazione del workflow.

## Cosa può modificare JSpider

La maggior parte della sidebar prepara dati in sola lettura. Gli effetti
esterni avvengono soltanto quando l’operatore esegue esplicitamente una di
queste azioni:

| Azione | Effetto esterno |
| --- | --- |
| `Ringrazia le versioni selezionate` | Invia il ringraziamento al sito sorgente e rilegge i link sbloccati |
| `Quick Workflow` | Invia i package a TaskFlow/JD e può creare e avviare un workflow |
| `Carica package su JD` | Invia i package a TaskFlow/JD, senza creare ancora il workflow |
| Create/Start nella WebUI TaskFlow | Crea o avvia il workflow attraverso TaskFlow |

Le ricerche TMDB e il controllo presenza Emby sono in sola lettura. JSpider non
chiama mai JD direttamente e non offre comandi di cancellazione o rollback dei
package.

## Prima di aprire la sidebar

1. Apri la pagina del singolo titolo su TitanHD o La Foresta Incantata.
2. Verifica che TaskFlow e TMDB siano configurati. MDBList è facoltativo e
   aggiunge rating e premi. Emby è facoltativo e richiede
   `embyBaseUrl` ed `embyToken` in `config.local.json`.
3. Fai clic sull’icona dell’estensione JSpider. La sidebar compare nella pagina;
   la stessa icona la richiude.

La barra del titolo contiene:

- **Larghezza**: sceglie una delle cinque larghezze dell’overlay portabile.
- **Impostazioni**: apre i campi di collegamento TaskFlow, TMDB, OMDb e MDBList.
- **Aggiorna pagina**: rilegge la scheda corrente e le relative versioni.

Il pulsante in fondo **Apri WebUI TaskFlow** sostituisce la Home JSpider con la
WebUI amministrativa completa. Quando è aperta, il pulsante diventa **Torna a
JSpider**.

Il bordo verde arrotondato indica che gli input obbligatori della fase sono
validi. Le icone `i` nel cerchietto aprono spiegazioni contestuali. Il messaggio
fisso in basso mostra avanzamento ed errori delle operazioni.

## Fase 1 — Trova e valida il titolo

JSpider estrae inizialmente titolo, anno, tipo di contenuto e, quando presente,
ID IMDb dalla pagina aperta. Se TMDB è configurato, avvia automaticamente la
ricerca tramite il riferimento IMDb e mostra i candidati. Nessun candidato
viene validato senza conferma dell’operatore.

### Comandi di ricerca

- Correggi **Titolo**, **Anno** o **Tipo** se i valori estratti sono errati.
- **Cerca tramite IMDb** riprova usando l’ID IMDb della pagina e, se necessario,
  passa al titolo/anno correnti.
- **Cerca su TMDB** esegue una nuova ricerca usando i campi modificati. È il
  comando da usare dopo aver cambiato manualmente il titolo.
- I loghi rating TMDB, IMDb e delle altre fonti aprono il titolo sul sito
  corrispondente senza modificare lo stato di JSpider.

La modifica di titolo, anno o tipo cancella la validazione e il risultato Emby
precedenti.

Se MDBList è configurato, la scheda compatta mostra i rating disponibili di
IMDb, Rotten Tomatoes critica e pubblico, Metacritic, Trakt, Letterboxd e delle
altre fonti come collegamenti con logo e voto. La trama è limitata a tre righe;
**Leggi tutto** la espande e **Mostra meno** la richiude. In questo modo restano
insieme locandina, metadati e comandi. I premi appaiono solo
quando presenti; i valori mancanti vengono omessi e un errore MDBList non
blocca la validazione.

### Conferma dei metadati

Usa **Valida questo titolo** quando il candidato mostrato è corretto. JSpider
memorizza ID TMDB e tipo di contenuto per la fase 3, poi avvia il controllo Emby
in sola lettura.

Usa **Usa esplicitamente titolo e anno senza TMDB ID** soltanto quando il
candidato descrive l’opera corretta ma non vuoi inviarne l’ID TMDB. Il fallback
è disponibile solo con un anno valido di quattro cifre. La fase 3 invierà titolo
e anno al posto di `tmdb_id`; Emby cercherà per titolo/anno e considererà
ambiguo più di un risultato esatto.

### Pannello Emby

Il pannello Emby è informativo e non blocca né modifica il workflow:

- **LED rosso — Presente**: esistono uno o più file corrispondenti; vengono
  mostrati i nomi senza directory ed estensione finale;
- **LED verde — Assente**: non è stato restituito alcun contenuto;
- **ambra — Ambiguo**: titolo/anno hanno prodotto più corrispondenze esatte;
- **ambra — Non verificabile**: permesso, token, rete, HTTP o risposta non valida
  impediscono una conclusione affidabile;
- **In attesa/Verifica**: il titolo non è ancora validato oppure il controllo è
  in corso.

Un errore non viene mai trasformato in “Assente”. Il primo controllo può far
comparire la richiesta di permesso del browser per il dominio HTTPS Emby.

## Fase 2 — Scegli versioni e link

La fase 2 determina quali versioni diventano package TaskFlow/JD.

### Profilo di proposta

- **4K + 1080p**: propone i candidati preferiti per entrambe le risoluzioni,
  quando disponibili.
- **1080p sorgente/untouched + codifica**: propone una versione 1080p
  sorgente/untouched e un’alternativa codificata.
- **Scelta manuale**: non propone automaticamente; decide l’operatore.

**Scarta sorgenti oltre · Mb/s totali** applica un limite al bitrate totale.
Vuoto oppure `0` significa nessun limite. Le proposte usano i metadati
disponibili e restano indicative; tutte le checkbox sono modificabili.

Ogni scheda mostra risoluzione, codec/HDR, bitrate video e totale, dimensione
del file e della traccia video, oltre alla motivazione della proposta. Eventuali
link bloccati o dati incompleti vengono segnalati nella motivazione.

### Sblocco e scelta degli host

**Ringrazia le versioni selezionate** ringrazia soltanto le versioni spuntate,
salta quelle già sbloccate, rilegge i link e mantiene sidebar e selezione aperte.
È l’unica scrittura della sidebar sul sito sorgente.

In **Host da inviare**, seleziona almeno un host che disponga di link per ogni
versione scelta. I contatori mostrano i link attualmente disponibili. La
submission include soltanto i link degli host spuntati.

### Password RAR

JSpider combina le password rilevate nelle versioni scelte. Una sola password
viene compilata automaticamente. Se le versioni riportano password diverse, la
fase 2 resta non valida finché l’operatore non inserisce manualmente quella
corretta. Il valore finale viene passato ai dati `unrar` del workflow; JSpider
non estrae direttamente gli archivi.

## Fase 3 — Scegli il percorso di creazione

Inserisci un **Nome workflow** con lettere o numeri ASCII. JSpider normalizza
spazi e caratteri non supportati. La fase 3 diventa valida soltanto quando le
fasi 1 e 2 sono valide e TaskFlow è configurato.

Scegli un solo ramo prima della submission. Quando l’invio inizia, JSpider
blocca le due modalità per impedire di mescolare accidentalmente i percorsi.

### Quick Workflow

Quick Workflow è il percorso semplificato predefinito.

1. Seleziona un **Preset TaskFlow**. Sotto il selettore appare la sequenza task.
2. Controlla **Autodownload** e **Cleanup**.
3. Fai clic una sola volta su **Quick Workflow**.

Quando selezioni un preset, il suo valore predefinito `cleanup_on_success` ha la
precedenza e aggiorna la checkbox Cleanup. Dopo puoi modificarla esplicitamente.

Con **Autodownload attivo**, un clic esegue in ordine:

```text
Submission package → Create workflow → Start workflow
```

Il preset è obbligatorio. Se una submission non restituisce un ID package
TaskFlow persistito e confermato, JSpider non crea il workflow.

Con **Autodownload disattivato**, JSpider esegue soltanto la Submission. I
package restano nel LinkGrabber di JD, non avvengono Create o Start e il preset
non è obbligatorio.

Non fare un secondo clic mentre il messaggio indica che l’operazione è in
corso. Se Create riesce ma Start fallisce, usa la WebUI TaskFlow per ripetere
soltanto **Start**, senza reinviare i package.

### TaskFlow

Questo ramo lascia la creazione sotto il controllo della WebUI TaskFlow
integrata.

1. Seleziona **TaskFlow**.
2. Fai clic una sola volta su **Carica package su JD**.
3. Attendi l’apertura della vista Create integrata.
4. Controlla preset, ordine task, parametri e cleanup nella WebUI.
5. Usa Create/Start nella WebUI quando tutto è pronto.

Il primo pulsante esegue soltanto la Submission dei package e precompila nella
vista Create i dati comuni:

- ID package TaskFlow;
- nome workflow;
- tipo di contenuto;
- ID TMDB validato oppure fallback esplicito titolo/anno;
- password RAR, se presente.

Il workflow **non viene ancora creato**. La WebUI integrata è l’autorità per
preset, ordine task, JSON dei task, cleanup e azione finale Create/Start.

## Gestione sicura degli errori

- **Submission non confermata**: non ripetere immediatamente l’azione. Il
  package potrebbe essere già visibile in JD anche se TaskFlow non è riuscito a
  confermarlo e persisterlo. Controlla prima JD e l’elenco package TaskFlow.
- **Workflow creato, Start fallito**: apri TaskFlow e ripeti soltanto Start.
- **Elenco preset non disponibile**: controlla URL/token TaskFlow e
  connettività; Quick Workflow con Autodownload resta bloccato finché non puoi
  selezionare un preset.
- **Pulsante disabilitato**: controlla bordi verdi delle fasi, link e host
  selezionati, conflitti password RAR, nome workflow e configurazione TaskFlow.
- **Titolo o link non aggiornati**: usa **Aggiorna pagina**. Dopo modifiche al
  codice o alla configurazione, ricarica l’estensione decompressa e aggiorna la
  pagina del titolo.

JSpider non contiene volutamente un comando “cancella package da JD”. Se
l’operatore abbandona una submission, la pulizia si esegue direttamente in JD o
tramite gli strumenti amministrativi TaskFlow appropriati.
