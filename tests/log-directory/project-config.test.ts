import { describe, expect, it } from 'vitest';
import {
  alignProjectLogDirectory,
  validateProjectLogPath,
  type ProjectDirectoryHandle,
  type ProjectFileHandle,
} from '../../src/log-directory/project-config';

class MemoryFile implements ProjectFileHandle {
  constructor(public contents: string) {}
  async getFile() {
    return { text: async () => this.contents } as File;
  }
  async createWritable() {
    return {
      write: async (value: string) => { this.contents = value; },
      close: async () => undefined,
    } as never;
  }
}

class MemoryDirectory implements ProjectDirectoryHandle {
  readonly files = new Map<string, MemoryFile>();
  readonly directories = new Map<string, MemoryDirectory>();
  constructor(public name: string) {}
  async getFileHandle(name: string, options?: { create?: boolean }) {
    let file = this.files.get(name);
    if (!file && options?.create) {
      file = new MemoryFile('');
      this.files.set(name, file);
    }
    if (!file) throw new DOMException('missing', 'NotFoundError');
    return file;
  }
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    let directory = this.directories.get(name);
    if (!directory && options?.create) {
      directory = new MemoryDirectory(name);
      this.directories.set(name, directory);
    }
    if (!directory) throw new DOMException('missing', 'NotFoundError');
    return directory;
  }
}

describe('project log path validation', () => {
  it('accepts only an absolute path ending in the selected project and log', () => {
    expect(validateProjectLogPath(
      'C:/Users/yazya/Desktop/vscode/JSpider-follow-season/log/',
      'JSpider-follow-season',
    )).toBe('C:\\Users\\yazya\\Desktop\\vscode\\JSpider-follow-season\\log');
    expect(validateProjectLogPath('/Users/yaz/JSpider/log', 'JSpider'))
      .toBe('/Users/yaz/JSpider/log');

    expect(() => validateProjectLogPath('log', 'JSpider')).toThrow('percorso completo');
    expect(() => validateProjectLogPath('C:\\work\\JSpider\\logs', 'JSpider'))
      .toThrow('terminare con');
    expect(() => validateProjectLogPath('C:\\work\\JSpider\\log', 'JSpider-follow-season'))
      .toThrow('cartella progetto');
  });
});

describe('project config alignment', () => {
  it('preserves secrets, updates root and dist configs, and returns the log handle', async () => {
    const root = new MemoryDirectory('JSpider-follow-season');
    root.files.set('config.local.json', new MemoryFile(JSON.stringify({
      taskflowToken: 'keep-secret', _logDirectory: 'C:\\old\\log',
    })));
    const dist = new MemoryDirectory('dist');
    dist.files.set('config.local.json', new MemoryFile('{"stale":true}'));
    root.directories.set('dist', dist);
    const log = new MemoryDirectory('log');
    root.directories.set('log', log);

    const result = await alignProjectLogDirectory(
      root,
      'C:\\Users\\yazya\\Desktop\\vscode\\JSpider-follow-season\\log',
    );

    expect(result.logHandle).toBe(log);
    expect(result.updatedFiles).toEqual(['config.local.json', 'dist/config.local.json']);
    const rootConfig = JSON.parse(root.files.get('config.local.json')!.contents);
    const distConfig = JSON.parse(dist.files.get('config.local.json')!.contents);
    expect(rootConfig).toEqual({
      taskflowToken: 'keep-secret',
      _logDirectory: 'C:\\Users\\yazya\\Desktop\\vscode\\JSpider-follow-season\\log',
    });
    expect(distConfig).toEqual(rootConfig);
  });

  it('updates only the root config for an extracted extension without dist', async () => {
    const root = new MemoryDirectory('JSpider');
    root.files.set('config.local.json', new MemoryFile('{"tmdbCredential":"secret"}'));

    const result = await alignProjectLogDirectory(
      root, 'C:\\Extensions\\JSpider\\log',
    );

    expect(result.updatedFiles).toEqual(['config.local.json']);
    expect(root.directories.get('log')).toBe(result.logHandle);
    expect(JSON.parse(root.files.get('config.local.json')!.contents)).toMatchObject({
      tmdbCredential: 'secret', _logDirectory: 'C:\\Extensions\\JSpider\\log',
    });
  });

  it('rejects a malformed root config before creating or saving anything', async () => {
    const root = new MemoryDirectory('JSpider');
    root.files.set('config.local.json', new MemoryFile('{broken'));

    await expect(alignProjectLogDirectory(root, 'C:\\Extensions\\JSpider\\log'))
      .rejects.toThrow('config.local.json della root non è un JSON valido');
    expect(root.directories.has('log')).toBe(false);
  });
});
