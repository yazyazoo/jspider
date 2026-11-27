import { describe, expect, it } from 'vitest';
import {
  resolveLogDirectoryPath,
  validateExistingLogPath,
} from '../../src/log-directory/path-validation';

describe('log directory path', () => {
  it('uses config.local.json as the source of truth over stale Chromium storage', () => {
    expect(resolveLogDirectoryPath('C:\\work\\JSpider\\log'))
      .toBe('C:\\work\\JSpider\\log');
    expect(resolveLogDirectoryPath('')).toBe('');
  });

  it('accepts only the configured log directory', () => {
    expect(validateExistingLogPath('C:/work/JSpider/log/', 'log'))
      .toBe('C:\\work\\JSpider\\log');
    expect(() => validateExistingLogPath('C:\\work\\JSpider\\log', 'JSpider'))
      .toThrow('direttamente la cartella');
  });
});
