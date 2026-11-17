import { describe, expect, it, vi } from 'vitest';
import { handleActionClick, isSupportedOverlayUrl } from '../../src/background/sidepanel';

describe('JSpider action routing', () => {
  it('recognizes only exact supported title and article URLs', () => {
    expect(isSupportedOverlayUrl('https://titanhd.space/catalogo/14481')).toBe(true);
    expect(isSupportedOverlayUrl('https://laforestaincantata.org/index.php?newsid=77')).toBe(true);
    expect(isSupportedOverlayUrl('https://titanhd.space/catalogo/')).toBe(false);
    expect(isSupportedOverlayUrl('https://laforestaincantata.org/index.php')).toBe(false);
    expect(isSupportedOverlayUrl('https://example.com/catalogo/14481')).toBe(false);
  });

  it('asks the supported tab content script to toggle the overlay', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, data: { open: true, width: 650 } });
    const handled = await handleActionClick({
      id: 9,
      url: 'https://titanhd.space/catalogo/14481',
    }, { sendMessage });

    expect(handled).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith(9, { target: 'content', action: 'overlay.toggle' });
  });

  it('ignores unsupported pages without requiring the Side Panel API', async () => {
    const sendMessage = vi.fn();
    await expect(handleActionClick({ id: 9, url: 'https://example.com/' }, { sendMessage }))
      .resolves.toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
