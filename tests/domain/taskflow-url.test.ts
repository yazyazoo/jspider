import { describe, expect, it } from 'vitest';
import { normalizeTaskFlowBaseUrl } from '../../src/domain/taskflow-url';

describe('normalizeTaskFlowBaseUrl', () => {
  it('keeps secure origins and local development ports', () => {
    expect(normalizeTaskFlowBaseUrl('https://taskflow.example/')).toBe('https://taskflow.example');
    expect(normalizeTaskFlowBaseUrl('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080');
  });

  it('rejects insecure remote servers and URL credentials or suffixes', () => {
    expect(() => normalizeTaskFlowBaseUrl('http://taskflow.example')).toThrow('HTTPS');
    expect(() => normalizeTaskFlowBaseUrl('https://user:secret@taskflow.example')).toThrow('HTTPS');
    expect(() => normalizeTaskFlowBaseUrl('https://taskflow.example/base')).toThrow('origine');
  });
});
