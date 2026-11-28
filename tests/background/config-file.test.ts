import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigFileRepository, linkConfigFile, parseLocalConfig, type WritableConfigFile } from '../../src/background/config-file';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('explicit config file authorization', () => {
  function handle(name = 'config.local.json', text = '{"taskflowToken":"keep"}', permission = 'granted') {
    return {
      name,
      requestPermission: vi.fn(async () => permission),
      getFile: vi.fn(async () => ({ text: async () => text })),
    } as unknown as WritableConfigFile;
  }

  it('persists the selected file only after authorization and JSON validation', async () => {
    const file = handle();
    const save = vi.spyOn(ConfigFileRepository.prototype, 'save').mockResolvedValue();
    const publish = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', { storage: { local: { set: publish } } });
    await linkConfigFile(file);
    expect(file.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(save).toHaveBeenCalledWith(file);
    expect(publish).toHaveBeenCalledWith({ 'jspider.configFileRevision': expect.any(Number) });
  });

  it.each([
    ['other.json', '{}', 'granted', 'Seleziona il file'],
    ['config.local.json', '{}', 'denied', 'non concesso'],
    ['config.local.json', '{broken', 'granted', 'JSON valido'],
  ])('does not persist an invalid or unauthorized selection: %s, %s, %s', async (name, text, permission, error) => {
    const save = vi.spyOn(ConfigFileRepository.prototype, 'save').mockResolvedValue();
    await expect(linkConfigFile(handle(name, text, permission))).rejects.toThrow(error);
    expect(save).not.toHaveBeenCalled();
  });

  it('requires an object and preserves every field when parsing', () => {
    expect(() => parseLocalConfig('[]')).toThrow('oggetto JSON');
    expect(parseLocalConfig('{"custom":{"keep":true},"protectedExecution":false}'))
      .toEqual({ custom: { keep: true }, protectedExecution: false });
  });
});
