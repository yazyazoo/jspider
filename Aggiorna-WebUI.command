#!/bin/sh

cd -- "$(dirname -- "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '[ERRORE] Node.js 22 o successivo non è disponibile nel PATH.'
  exit_code=1
elif ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' '[ERRORE] npm non è disponibile nel PATH.'
  exit_code=1
else
  npm run update:webui
  exit_code=$?
fi

printf '\n'
if [ "$exit_code" -eq 0 ]; then
  printf '%s\n' 'WebUI TaskFlow aggiornata. Ricarica JSpider dalla pagina delle estensioni.'
else
  printf '%s\n' 'Aggiornamento non completato. La versione precedente è stata conservata.'
fi
printf '%s' 'Premi Invio per chiudere... '
read -r _answer
exit "$exit_code"
