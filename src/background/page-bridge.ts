interface PageBridgeRequest {
  action: string;
  data?: Record<string, unknown>;
}

interface RuntimeResponse {
  ok?: boolean;
  data?: unknown;
  error?: { message?: string };
}

type SendMessage = (tabId: number, message: Record<string, unknown>) => Promise<unknown>;

export async function forwardPageMessage(
  ownerTabId: number | undefined,
  request: PageBridgeRequest,
  sendMessage: SendMessage,
): Promise<unknown> {
  if (!Number.isInteger(ownerTabId)) {
    throw new Error('Impossibile individuare la scheda proprietaria di JSpider.');
  }
  if (!request || typeof request.action !== 'string' || !request.action) {
    throw new Error('Azione pagina non valida.');
  }
  const message = {
    target: 'content',
    action: request.action,
    ...(request.data ?? {}),
  };
  const response = await sendMessage(ownerTabId as number, message) as RuntimeResponse;
  if (!response || response.ok !== true) {
    throw new Error(response?.error?.message ?? 'La pagina non ha risposto.');
  }
  return response.data;
}
