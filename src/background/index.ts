import { handle, serializeError } from './application';
import { handleActionClick } from './sidepanel';

chrome.action.onClicked.addListener((tab) => {
  void handleActionClick(tab, {
    sendMessage: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'background') return undefined;
  if (message.action === 'taskflow.quickWorkflow' || message.action === 'taskflow.loadPackages') {
    sendResponse({ ok: false, error: { message: 'Avvia questa operazione dalla scheda di esecuzione JSpider.' } });
    return false;
  }
  void handle(message, sender).then(
    (data) => sendResponse({ ok: true, data }),
    (reason) => sendResponse({ ok: false, error: serializeError(reason) }),
  );
  return true;
});
