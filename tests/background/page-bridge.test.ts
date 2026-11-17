import { describe, expect, it, vi } from 'vitest';
import { forwardPageMessage } from '../../src/background/page-bridge';

describe('sidebar page bridge', () => {
  it('forwards to the tab that owns the iframe, not whichever tab is active', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, data: { title: 'Owner tab' } });
    await expect(forwardPageMessage(
      41,
      { action: 'snapshot', data: {} },
      sendMessage,
    )).resolves.toEqual({ title: 'Owner tab' });
    expect(sendMessage).toHaveBeenCalledWith(41, { target: 'content', action: 'snapshot' });
  });

  it('rejects calls that do not originate inside a browser tab', async () => {
    await expect(forwardPageMessage(undefined, { action: 'snapshot', data: {} }, vi.fn()))
      .rejects.toThrow('scheda proprietaria');
  });
});
